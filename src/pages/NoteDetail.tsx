import { ArrowLeft, BookText, FileText, Layers, ListChecks, PenLine, RefreshCw, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CardsTab } from '../components/note/CardsTab'
import { PracticeTab } from '../components/note/PracticeTab'
import { QuizTab } from '../components/note/QuizTab'
import { SummaryTab } from '../components/note/SummaryTab'
import { Alert, Empty, Modal, Spinner, useToast } from '../components/ui'
import { readingMinutes, relativeDate, wordCount } from '../lib/format'
import { generateLocally } from '../lib/localGenerator'
import { aiAvailability, useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import type { Generator, Note } from '../lib/types'

const TABS = [
  { id: 'ozet', label: 'Özet', icon: BookText },
  { id: 'kartlar', label: 'Kartlar', icon: Layers },
  { id: 'test', label: 'Test', icon: ListChecks },
  { id: 'uygula', label: 'Uygula', icon: PenLine },
  { id: 'kaynak', label: 'Kaynak', icon: FileText },
] as const

type TabId = (typeof TABS)[number]['id']

function GenerateChoice({ note, onDone, onClose }: { note: Note; onDone: () => void; onClose?: () => void }) {
  const store = useStore()
  const settings = useSettings()
  const ai = aiAvailability(settings, !!store.session)
  const [busy, setBusy] = useState<Generator | null>(null)
  const [error, setError] = useState('')

  async function run(generator: Generator) {
    setBusy(generator)
    setError('')
    try {
      const set = generator === 'ai' ? await (await import('../lib/ai')).generateStudySet(note.content, note.title, settings) : generateLocally(note.content)
      store.applyGenerated(note.id, set, generator)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Çalışma seti oluşturulamadı.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="form">
      {note.generator && (
        <p className="muted">Henüz çalışmadığın kartlar ve sorular yenileriyle değiştirilir. Çalıştığın kartların ilerlemesi korunur.</p>
      )}
      <div className="choice-grid">
        <button className="choice" onClick={() => run('ai')} disabled={!ai.ok || !!busy}>
          <strong>{busy === 'ai' ? <Spinner size={17} /> : <Sparkles size={17} />} Yapay zekâ</strong>
          <span className="subtle">{ai.ok ? (busy === 'ai' ? 'Notun okunuyor, 1 dk kadar sürebilir…' : `${ai.label} · Daha iyi özet ve sorular.`) : ai.reason}</span>
        </button>
        <button className="choice" onClick={() => run('local')} disabled={!!busy}>
          <strong>
            <Wand2 size={17} /> Basit mod
          </strong>
          <span className="subtle">Ücretsiz, cihazında çalışır.</span>
        </button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {onClose && (
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={!!busy}>
            Vazgeç
          </button>
        </div>
      )}
    </div>
  )
}

export function NoteDetail() {
  const { id } = useParams()
  const store = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [regenerating, setRegenerating] = useState(false)
  const note = store.data.notes.find((n) => n.id === id)
  const requested = params.get('sekme') as TabId | null
  const tab: TabId = TABS.some((t) => t.id === requested) ? requested! : 'ozet'

  if (!note) {
    return (
      <div className="page">
        <Empty icon={<FileText size={32} />} title="Not bulunamadı">
          <Link to="/dersler" className="btn">
            Derslere dön
          </Link>
        </Empty>
      </div>
    )
  }

  const course = store.data.courses.find((c) => c.id === note.courseId)
  const cardCount = store.data.cards.filter((c) => c.noteId === note.id).length
  const counts: Partial<Record<TabId, number>> = { kartlar: cardCount, test: note.questions.length, uygula: note.practice.length }

  function remove() {
    if (!note || !window.confirm(`“${note.title}” notu ve kartları silinsin mi?`)) return
    store.deleteNote(note.id)
    toast('Not silindi')
    navigate(course ? `/ders/${course.id}` : '/dersler')
  }

  function rename() {
    if (!note) return
    const title = window.prompt('Not başlığı', note.title)?.trim()
    if (title) store.updateNote(note.id, { title })
  }

  return (
    <div className="page">
      <Link to={course ? `/ders/${course.id}` : '/dersler'} className="back-link">
        <ArrowLeft size={16} /> {course?.name ?? 'Dersler'}
      </Link>

      <div className="page-header">
        <div>
          <h1 onDoubleClick={rename} title="Yeniden adlandırmak için çift tıkla">
            {note.title}
          </h1>
          <div className="btn-row">
            <span className="subtle">
              {wordCount(note.content).toLocaleString('tr-TR')} kelime · {readingMinutes(note.content)} dk okuma · {relativeDate(note.createdAt)}
            </span>
            {note.generator === 'ai' && <span className="chip chip-accent">Yapay zekâ ile hazırlandı</span>}
            {note.generator === 'local' && <span className="chip">Basit mod</span>}
          </div>
        </div>
        <div className="btn-row header-actions">
          {note.generator && (
            <button className="btn btn-sm" onClick={() => setRegenerating(true)}>
              <RefreshCw size={15} /> Yeniden hazırla
            </button>
          )}
          <button className="btn btn-ghost btn-icon btn-danger" aria-label="Notu sil" onClick={remove}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      {!note.generator ? (
        <div className="panel">
          <div className="form">
            <h2>Bu not için çalışma seti hazırlanmadı</h2>
            <GenerateChoice note={note} onDone={() => toast('Çalışma seti hazır')} />
          </div>
        </div>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label="Not bölümleri">
            {TABS.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                role="tab"
                aria-selected={tab === tabId}
                onClick={() => setParams(tabId === 'ozet' ? {} : { sekme: tabId }, { replace: true })}
              >
                <Icon size={16} /> {label}
                {counts[tabId] !== undefined && <span className="tab-count">{counts[tabId]}</span>}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === 'ozet' && <SummaryTab note={note} />}
            {tab === 'kartlar' && <CardsTab note={note} />}
            {tab === 'test' && <QuizTab key={note.updatedAt} note={note} />}
            {tab === 'uygula' && <PracticeTab key={note.updatedAt} note={note} />}
            {tab === 'kaynak' && (
              <div className="panel">
                <p className="prewrap" style={{ lineHeight: 1.7 }}>
                  {note.content}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {!note.generator && (
        <section className="section">
          <h2>Not içeriği</h2>
          <div className="panel">
            <p className="prewrap" style={{ lineHeight: 1.7 }}>
              {note.content}
            </p>
          </div>
        </section>
      )}

      {regenerating && (
        <Modal title="Yeniden hazırla" onClose={() => setRegenerating(false)}>
          <GenerateChoice
            note={note}
            onClose={() => setRegenerating(false)}
            onDone={() => {
              setRegenerating(false)
              toast('Çalışma seti yenilendi')
            }}
          />
        </Modal>
      )}
    </div>
  )
}
