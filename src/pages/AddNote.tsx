import { ArrowLeft, Check, CircleAlert, FileText, FileUp, Plus, Sparkles, Wand2, X } from 'lucide-react'
import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AiSignupPrompt } from '../components/AiSignupPrompt'
import { Alert, Spinner, useToast } from '../components/ui'
import { ACCEPTED_NOTE_EXTENSIONS, extractNoteText } from '../lib/importNote'
import { generateLocally } from '../lib/localGenerator'
import { aiAvailability, useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import type { GeneratedSet, Generator } from '../lib/types'
import { freshImport } from '../lib/version'

const NEW_COURSE = '__new__'
const MIN_CHARS = 120
const MAX_BATCH = 20

type ItemStatus = 'reading' | 'ready' | 'unreadable' | 'working' | 'done' | 'failed'

interface BatchItem {
  key: string
  fileName: string
  title: string
  content: string
  status: ItemStatus
  message: string
  noteId: string | null
}

const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
const isLongEnough = (text: string) => text.replace(/\s/g, '').length >= MIN_CHARS

export function AddNote() {
  const store = useStore()
  const settings = useSettings()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const courses = store.data.courses
  const ai = aiAvailability(settings, !!store.session)

  const [courseId, setCourseId] = useState(params.get('ders') ?? courses[0]?.id ?? NEW_COURSE)
  const [newCourse, setNewCourse] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [source, setSource] = useState<'file' | 'text'>('file')
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [readProgress, setReadProgress] = useState<{ done: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<Generator>(ai.ok ? 'ai' : 'local')
  const [busy, setBusy] = useState(false)
  const [chunkStatus, setChunkStatus] = useState('')
  const [error, setError] = useState('')
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null)
  const [batch, setBatch] = useState<BatchItem[] | null>(null)
  const [batchFinished, setBatchFinished] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const updateItem = (key: string, patch: Partial<BatchItem>) =>
    setBatch((items) => items?.map((item) => (item.key === key ? { ...item, ...patch } : item)) ?? null)

  const makeTranscriber = () =>
    ai.ok
      ? async (images: import('../lib/ai').TranscribeImage[]) => {
          const { transcribeImages } = await freshImport(() => import('../lib/ai'))
          return transcribeImages(images, settings)
        }
      : undefined

  async function readFile(file: File) {
    setError('')
    setReading(true)
    setReadProgress(null)
    try {
      const text = await extractNoteText(file, {
        transcribe: makeTranscriber(),
        onProgress: (done, total) => setReadProgress({ done, total }),
      })
      setContent(text)
      setFileName(file.name)
      if (!title) setTitle(titleFromFile(file.name))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dosya okunamadı.')
    } finally {
      setReading(false)
      setReadProgress(null)
    }
  }

  async function addFiles(list: FileList | File[]) {
    const files = [...list]
    if (!files.length) return
    setError('')
    if (files.length === 1 && !batch && !content) return readFile(files[0])

    // A file is already loaded on its own: it becomes the first item of the list.
    const carried: BatchItem[] =
      !batch && content && isLongEnough(content)
        ? [{ key: crypto.randomUUID(), fileName: fileName || 'Yapıştırılan metin', title: title || titleFromFile(fileName) || 'Adsız not', content, status: 'ready', message: '', noteId: null }]
        : []
    if (!batch && content) {
      setContent('')
      setFileName('')
      setTitle('')
    }
    const existing = batch ?? carried
    const room = MAX_BATCH - existing.length
    if (files.length > room) setError(`Tek seferde en fazla ${MAX_BATCH} dosya ekleyebilirsin. İlk ${Math.max(room, 0)} dosya alındı.`)
    const items: BatchItem[] = files.slice(0, Math.max(room, 0)).map((file) => ({
      key: crypto.randomUUID(),
      fileName: file.name,
      title: titleFromFile(file.name),
      content: '',
      status: 'reading',
      message: '',
      noteId: null,
    }))
    setBatch([...existing, ...items])

    // PDFs and images are parsed one at a time to keep the page responsive.
    const transcribe = makeTranscriber()
    for (const [i, item] of items.entries()) {
      try {
        const text = await extractNoteText(files[i], {
          transcribe,
          onProgress: (done, total) => updateItem(item.key, { message: `${done}/${total} sayfa okundu` }),
        })
        updateItem(item.key, isLongEnough(text) ? { content: text, status: 'ready', message: '' } : { status: 'unreadable', message: 'Çok kısa' })
      } catch (e) {
        updateItem(item.key, { status: 'unreadable', message: e instanceof Error ? e.message : 'Okunamadı' })
      }
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragOver(false)
    void addFiles(event.dataTransfer.files)
  }

  /** Builds a study set; `onChunk` reports progress for long notes that are processed in parts. */
  async function buildSet(text: string, noteTitle: string, generator: Generator, onChunk?: (status: string) => void): Promise<{ set: GeneratedSet; warning: string }> {
    if (generator === 'local') return { set: generateLocally(text), warning: '' }
    const { generateStudySet, partialChunkMessage } = await freshImport(() => import('../lib/ai'))
    const set = await generateStudySet(text, noteTitle, settings, (done, total) => {
      if (total > 1) onChunk?.(`Uzun not ${total} bölüme ayrıldı · ${done}/${total} bölüm işlendi`)
    })
    return { set, warning: partialChunkMessage(set) }
  }

  async function generate(noteId: string, generator: Generator) {
    setBusy(true)
    setError('')
    setChunkStatus('')
    try {
      const { set, warning } = await buildSet(content, title, generator, setChunkStatus)
      store.applyGenerated(noteId, set, generator)
      if (warning) toast(warning)
      navigate(`/not/${noteId}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Çalışma seti oluşturulamadı.')
      setBusy(false)
    } finally {
      setChunkStatus('')
    }
  }

  function resolveCourse(): string | null {
    if (courseId !== NEW_COURSE) return courseId
    if (!newCourse.trim()) {
      setError('Ders adını yaz.')
      return null
    }
    const id = store.addCourse({ name: newCourse }).id
    setCourseId(id)
    return id
  }

  async function submitBatch() {
    const target = resolveCourse()
    if (!target || !batch) return
    setBusy(true)
    setError('')
    let failed = 0
    for (const item of batch) {
      if (item.status !== 'ready' && item.status !== 'failed') continue
      updateItem(item.key, { status: 'working', message: '' })
      const noteId = item.noteId ?? store.addNote({ courseId: target, title: item.title.trim() || titleFromFile(item.fileName), content: item.content.trim() }).id
      try {
        const { set, warning } = await buildSet(item.content, item.title, mode, (status) => updateItem(item.key, { message: status }))
        store.applyGenerated(noteId, set, mode)
        updateItem(item.key, { status: 'done', noteId, message: warning })
      } catch (e) {
        failed += 1
        updateItem(item.key, { status: 'failed', noteId, message: e instanceof Error ? e.message : 'Hazırlanamadı' })
      }
    }
    setBusy(false)
    setBatchFinished(true)
    if (!failed) {
      toast('Tüm notlar hazır')
      navigate(`/ders/${target}`, { replace: true })
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (batch) return submitBatch()
    if (savedNoteId) return generate(savedNoteId, mode)
    const target = resolveCourse()
    if (!target) return
    const note = store.addNote({ courseId: target, title: title.trim() || 'Adsız not', content: content.trim() })
    setSavedNoteId(note.id)
    await generate(note.id, mode)
  }

  const readyCount = batch?.filter((i) => i.status === 'ready' || i.status === 'failed').length ?? 0
  const stillReading = batch?.some((i) => i.status === 'reading') ?? false
  const doneCount = batch?.filter((i) => i.status === 'done').length ?? 0
  const courseOk = courseId !== NEW_COURSE || !!newCourse.trim()
  const canSubmit = batch
    ? !busy && !stillReading && readyCount > 0 && courseOk
    : !busy && !reading && isLongEnough(content) && courseOk

  const fileInputEl = (
    <input
      ref={fileInput}
      type="file"
      accept={ACCEPTED_NOTE_EXTENSIONS}
      multiple
      hidden
      aria-label="Not dosyası"
      onChange={(e) => {
        if (e.target.files) void addFiles(e.target.files)
        e.target.value = ''
      }}
    />
  )

  return (
    <div className="page page-narrow">
      <button type="button" className="back-link btn-ghost" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Geri
      </button>
      <div className="page-header">
        <div>
          <h1>Not ekle</h1>
          <p className="muted">Notundan özet, çalışma kartları, test ve açık uçlu sorular hazırlayalım. Birden fazla dosya seçersen her biri ayrı not olur.</p>
        </div>
      </div>

      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <label className="field">
            <span>Ders</span>
            <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!!savedNoteId || busy || batchFinished}>
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

        {batch ? (
          <div className="field">
            <span>
              {batch.length} dosya {busy ? `· ${doneCount}/${batch.filter((i) => i.status !== 'unreadable').length} hazırlandı` : ''}
            </span>
            <div className="panel panel-tight list">
              {batch.map((item) => (
                <div className="list-item" key={item.key}>
                  <BatchIcon status={item.status} />
                  <div className="grow">
                    {item.status === 'ready' && !busy ? (
                      <input
                        className="input"
                        style={{ minHeight: 34, padding: '4px 8px' }}
                        value={item.title}
                        aria-label={`${item.fileName} başlığı`}
                        onChange={(e) => updateItem(item.key, { title: e.target.value })}
                      />
                    ) : (
                      <div className="title">{item.title}</div>
                    )}
                    <div className="subtle">
                      {item.status === 'reading' && (item.message ? `${item.message}…` : 'Okunuyor…')}
                      {item.status === 'ready' && `${item.content.length.toLocaleString('tr-TR')} karakter`}
                      {item.status === 'working' && (item.message || (mode === 'ai' ? 'Yapay zekâ okuyor…' : 'Hazırlanıyor…'))}
                      {item.status === 'done' && item.noteId && (
                        <>
                          <Link to={`/not/${item.noteId}`} style={{ color: 'var(--accent-text)' }}>
                            Hazır — nota git
                          </Link>
                          {item.message && <span style={{ color: 'var(--warning)', display: 'block' }}>{item.message}</span>}
                        </>
                      )}
                      {(item.status === 'unreadable' || item.status === 'failed') && <span style={{ color: 'var(--danger)' }}>{item.message}</span>}
                    </div>
                  </div>
                  {!busy && !item.noteId && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      aria-label={`${item.fileName} dosyasını çıkar`}
                      onClick={() => setBatch((items) => (items && items.length > 1 ? items.filter((i) => i.key !== item.key) : null))}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!busy && !batchFinished && batch.length < MAX_BATCH && (
              <div>
                <button type="button" className="btn btn-sm" onClick={() => fileInput.current?.click()}>
                  <Plus size={15} /> Dosya ekle
                </button>
                {fileInputEl}
              </div>
            )}
            {batch.some((i) => i.status === 'unreadable') && (
              <p className="subtle">Okunamayan dosyalar atlanır.</p>
            )}
          </div>
        ) : (
          <>
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
                <strong role={reading ? 'status' : undefined}>
                  {reading
                    ? readProgress
                      ? `${readProgress.done}/${readProgress.total} sayfa okundu`
                      : 'Dosya okunuyor…'
                    : 'Dosyaları buraya bırak ya da seç'}
                </strong>
                <span className="subtle">
                  PDF (taranmış dahil), fotoğraf (.jpg, .png, .webp), Word, PowerPoint, TXT veya Markdown · birden fazla seçebilirsin (en fazla {MAX_BATCH}) · dosya başına 10 MB
                </span>
                {fileInputEl}
              </div>
            )}

            {(source === 'text' || content) && (
              <label className="field">
                {fileName && (
                  <span>
                    {fileName} okundu — gerekirse düzenleyebilirsin.{' '}
                    {!savedNoteId && (
                      <>
                        <button type="button" className="btn btn-sm" onClick={() => fileInput.current?.click()}>
                          <Plus size={15} /> Dosya ekle
                        </button>{' '}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setContent(''), setFileName(''))}>
                          Bu dosyayı kaldır
                        </button>
                        {fileInputEl}
                      </>
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
                  {content && !isLongEnough(content) ? ` · en az ${MIN_CHARS} karakter gerekli` : ''}
                </span>
              </label>
            )}
          </>
        )}

        <div className="field">
          <span>Nasıl hazırlansın?</span>
          <div className="choice-grid">
            <button type="button" className="choice" aria-pressed={mode === 'ai'} onClick={() => setMode('ai')} disabled={!ai.ok || busy}>
              <strong>
                <Sparkles size={17} /> Yapay zekâ
              </strong>
              <span className="subtle">
                {ai.label} · Her türlü notta çalışır; anlamaya yönelik sorular ve açıklamalar yazar.
                {!ai.ok && ` ${ai.reason}`}
              </span>
            </button>
            <button type="button" className="choice" aria-pressed={mode === 'local'} onClick={() => setMode('local')} disabled={busy}>
              <strong>
                <Wand2 size={17} /> Basit mod
              </strong>
              <span className="subtle">Ücretsiz, notun cihazından çıkmaz. En iyi “Kavram: açıklama” biçimindeki notlarda çalışır.</span>
            </button>
          </div>
          <AiSignupPrompt />
          {!ai.ok && settings.provider !== 'shared' && (
            <p className="subtle">
              <Link to="/ayarlar" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
                Ayarlara git
              </Link>
            </p>
          )}
          {ai.ok && mode === 'ai' && settings.provider === 'shared' && (
            <p className="subtle">Ücretsiz modda notun Google Gemini ile işlenir; Google ücretsiz kullanımdaki içerikleri ürünlerini geliştirmek için kullanabilir. Kişisel bilgi içeren notları yükleme.</p>
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

        {batchFinished && batch?.some((i) => i.status === 'failed') && (
          <Alert tone="warning">
            Bazı notlar hazırlanamadı. Notlar kaydedildi; tekrar deneyebilir ya da başka bir modla hazırlayabilirsin.
          </Alert>
        )}

        <div className="btn-row">
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit}>
            {busy ? (
              <>
                <Spinner />{' '}
                {batch
                  ? `Hazırlanıyor… ${doneCount}/${batch.filter((i) => i.status !== 'unreadable').length}`
                  : mode === 'ai'
                    ? chunkStatus || 'Yapay zekâ notunu okuyor… (1 dk kadar sürebilir)'
                    : 'Hazırlanıyor…'}
              </>
            ) : batch ? (
              batchFinished ? 'Kalanları tekrar dene' : `${readyCount} notu kaydet ve hazırla`
            ) : savedNoteId ? (
              'Tekrar dene'
            ) : (
              'Kaydet ve hazırla'
            )}
          </button>
          {batchFinished && (
            <Link to={`/ders/${courseId}`} className="btn btn-lg">
              Derse git
            </Link>
          )}
        </div>
      </form>
    </div>
  )
}

function BatchIcon({ status }: { status: ItemStatus }) {
  if (status === 'reading' || status === 'working') return <Spinner size={18} />
  if (status === 'done') return <Check size={18} style={{ color: 'var(--success)' }} />
  if (status === 'unreadable' || status === 'failed') return <CircleAlert size={18} style={{ color: 'var(--danger)' }} />
  return <FileText size={18} className="muted" />
}
