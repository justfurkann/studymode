import { ArrowLeft, FileUp, Sparkles, Wand2 } from 'lucide-react'
import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Spinner } from '../components/ui'
import { ACCEPTED_NOTE_EXTENSIONS, extractNoteText } from '../lib/importNote'
import { generateLocally } from '../lib/localGenerator'
import { useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import type { Generator } from '../lib/types'

const NEW_COURSE = '__new__'
const MIN_CHARS = 120

export function AddNote() {
  const store = useStore()
  const settings = useSettings()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const courses = store.data.courses
  const hasKey = !!settings.apiKey

  const [courseId, setCourseId] = useState(params.get('ders') ?? courses[0]?.id ?? NEW_COURSE)
  const [newCourse, setNewCourse] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [source, setSource] = useState<'file' | 'text'>('file')
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<Generator>(hasKey ? 'ai' : 'local')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function readFile(file: File) {
    setError('')
    setReading(true)
    try {
      const text = await extractNoteText(file)
      setContent(text)
      setFileName(file.name)
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dosya okunamadı.')
    } finally {
      setReading(false)
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files[0]
    if (file) void readFile(file)
  }

  async function generate(noteId: string, generator: Generator) {
    setBusy(true)
    setError('')
    try {
      const set = generator === 'ai' ? await (await import('../lib/ai')).generateWithAi(content, title, settings.apiKey, settings.model) : generateLocally(content)
      store.applyGenerated(noteId, set, generator)
      navigate(`/not/${noteId}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Çalışma seti oluşturulamadı.')
      setBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (savedNoteId) return generate(savedNoteId, mode)
    let targetCourse = courseId
    if (courseId === NEW_COURSE) {
      if (!newCourse.trim()) return setError('Ders adını yaz.')
      targetCourse = store.addCourse({ name: newCourse }).id
      setCourseId(targetCourse)
    }
    const note = store.addNote({ courseId: targetCourse, title: title.trim() || 'Adsız not', content: content.trim() })
    setSavedNoteId(note.id)
    await generate(note.id, mode)
  }

  const tooShort = content.replace(/\s/g, '').length < MIN_CHARS
  const canSubmit = !busy && !reading && !tooShort && (courseId !== NEW_COURSE || !!newCourse.trim())

  return (
    <div className="page page-narrow">
      <button type="button" className="back-link btn-ghost" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Geri
      </button>
      <div className="page-header">
        <div>
          <h1>Not ekle</h1>
          <p className="muted">Notundan özet, çalışma kartları, test ve açık uçlu sorular hazırlayalım.</p>
        </div>
      </div>

      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <label className="field">
            <span>Ders</span>
            <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!!savedNoteId}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_COURSE}>+ Yeni ders</option>
            </select>
          </label>
          {courseId === NEW_COURSE ? (
            <label className="field">
              <span>Yeni dersin adı</span>
              <input className="input" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} placeholder="Örn. Organik Kimya" maxLength={120} />
            </label>
          ) : (
            <span />
          )}
        </div>

        <label className="field">
          <span>Not başlığı</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. 3. hafta – Hücre zarı" maxLength={200} disabled={!!savedNoteId} />
        </label>

        <div className="field">
          <span>Not içeriği</span>
          <div className="segmented" role="tablist" aria-label="Not kaynağı">
            <button type="button" role="tab" aria-selected={source === 'file'} onClick={() => setSource('file')} disabled={!!savedNoteId}>
              Dosya yükle
            </button>
            <button type="button" role="tab" aria-selected={source === 'text'} onClick={() => setSource('text')} disabled={!!savedNoteId}>
              Metin yapıştır
            </button>
          </div>
        </div>

        {source === 'file' && !content && (
          <div
            className={`dropzone ${dragOver ? 'over' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
            onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {reading ? <Spinner size={28} /> : <FileUp size={28} className="muted" />}
            <strong>{reading ? 'Dosya okunuyor…' : 'Dosyayı buraya bırak ya da seç'}</strong>
            <span className="subtle">PDF, TXT veya Markdown · en fazla 10 MB · taranmış PDF desteklenmiyor</span>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_NOTE_EXTENSIONS}
              hidden
              aria-label="Not dosyası"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void readFile(file)
                e.target.value = ''
              }}
            />
          </div>
        )}

        {(source === 'text' || content) && (
          <label className="field">
            {fileName && (
              <span>
                {fileName} okundu — gerekirse düzenleyebilirsin.{' '}
                {!savedNoteId && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setContent(''), setFileName(''))}>
                    Başka dosya seç
                  </button>
                )}
              </span>
            )}
            <textarea
              className="textarea"
              aria-label="Ders notun"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ders notunu buraya yapıştır…"
              readOnly={!!savedNoteId}
              style={{ minHeight: 260 }}
            />
            <span className="subtle" style={{ fontWeight: 400 }}>
              {content.length.toLocaleString('tr-TR')} karakter
              {content && tooShort ? ` · en az ${MIN_CHARS} karakter gerekli` : ''}
            </span>
          </label>
        )}

        <div className="field">
          <span>Nasıl hazırlansın?</span>
          <div className="choice-grid">
            <button type="button" className="choice" aria-pressed={mode === 'ai'} onClick={() => setMode('ai')} disabled={!hasKey}>
              <strong>
                <Sparkles size={17} /> Yapay zekâ
              </strong>
              <span className="subtle">
                Her türlü notta çalışır; anlamaya yönelik sorular ve açıklamalar yazar.
                {!hasKey && ' Ayarlardan API anahtarı eklemen gerekiyor.'}
              </span>
            </button>
            <button type="button" className="choice" aria-pressed={mode === 'local'} onClick={() => setMode('local')}>
              <strong>
                <Wand2 size={17} /> Basit mod
              </strong>
              <span className="subtle">Ücretsiz, notun cihazından çıkmaz. En iyi “Kavram: açıklama” biçimindeki notlarda çalışır.</span>
            </button>
          </div>
          {!hasKey && (
            <p className="subtle">
              <Link to="/ayarlar" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
                Yapay zekâyı ayarlardan açabilirsin
              </Link>
            </p>
          )}
        </div>

        {error && (
          <Alert tone="danger">
            {error}
            {savedNoteId && (
              <div className="btn-row" style={{ marginTop: 10 }}>
                {mode === 'ai' && (
                  <button type="button" className="btn btn-sm" onClick={() => (setMode('local'), void generate(savedNoteId, 'local'))}>
                    Basit modla dene
                  </button>
                )}
                <Link to={`/not/${savedNoteId}`} className="btn btn-sm">
                  Notu kartsız kaydet
                </Link>
              </div>
            )}
          </Alert>
        )}

        <div className="btn-row">
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit}>
            {busy ? (
              <>
                <Spinner /> {mode === 'ai' ? 'Yapay zekâ notunu okuyor… (1 dk kadar sürebilir)' : 'Hazırlanıyor…'}
              </>
            ) : savedNoteId ? (
              'Tekrar dene'
            ) : (
              'Kaydet ve hazırla'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
