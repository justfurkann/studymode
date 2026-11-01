import { ArrowLeft, Check, Copy, Download, FileText, MoreHorizontal, Pencil, PenLine, Printer, RefreshCw, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { NoteEditor } from '../components/NoteEditor'
import { AiSignupPrompt } from '../components/AiSignupPrompt'
import { CardsTab } from '../components/note/CardsTab'
import { PracticeTab } from '../components/note/PracticeTab'
import { QuizTab } from '../components/note/QuizTab'
import { SummaryEditor, SummaryTab } from '../components/note/SummaryTab'
import { Alert, Empty, Modal, Spinner, useConfirm, useToast } from '../components/ui'
import { readingMinutes, relativeDate, wordCount } from '../lib/format'
import { downloadText, findSourceMatch, summaryMarkdown } from '../lib/noteTools'
import { computeNoteProgress, computeTopicMastery } from '../lib/learningPath'
import { generateLocally } from '../lib/localGenerator'
import { aiAvailability, useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import type { Generator, LearningStepId, Note, SummarySubTab } from '../lib/types'
import { freshImport } from '../lib/version'

/** The study flow, in order: read, measure, practise, explain. Each view covers one or two learning steps. */
const VIEWS = [
  { id: 'ozet', label: 'Özet', steps: ['tanis', 'anla'] },
  { id: 'test', label: 'Test', steps: ['sina'] },
  { id: 'kartlar', label: 'Kartlar', steps: ['pekistir'] },
  { id: 'uygula', label: 'Anlat', steps: ['anlat'] },
] as const satisfies ReadonlyArray<{ id: string; label: string; steps: readonly LearningStepId[] }>

type TabId = (typeof VIEWS)[number]['id'] | 'kaynak'

const viewOfStep = (step: LearningStepId): TabId =>
  step === 'tanis' || step === 'anla' ? 'ozet' : step === 'sina' ? 'test' : step === 'pekistir' ? 'kartlar' : 'uygula'

/** The note's less frequent actions, kept out of the way of studying. */
function NoteMenu({ items }: { items: Array<{ label: string; icon: ReactNode; onSelect: () => void; danger?: boolean } | false> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <button className="btn btn-ghost btn-icon" aria-label="Diğer işlemler" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {items.filter((i) => i !== false).map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={item.danger ? 'menu-danger' : ''}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}



function GenerateChoice({ note, onDone, onClose }: { note: Note; onDone: () => void; onClose?: () => void }) {
  const store = useStore()
  const toast = useToast()
  const settings = useSettings()
  const ai = aiAvailability(settings, !!store.session)
  const [busy, setBusy] = useState<Generator | null>(null)
  const [chunkStatus, setChunkStatus] = useState('')
  const [error, setError] = useState('')

  async function run(generator: Generator) {
    setBusy(generator)
    setChunkStatus('')
    setError('')
    try {
      let warning = ''
      let set
      if (generator === 'ai') {
        const { generateStudySet, partialChunkMessage } = await freshImport(() => import('../lib/ai'))
        const result = await generateStudySet(note.content, note.title, settings, (done, total) => {
          if (total > 1) setChunkStatus(`Uzun not ${total} bölüme ayrıldı · ${done}/${total} bölüm işlendi`)
        })
        set = result
        warning = partialChunkMessage(result)
      } else {
        set = generateLocally(note.content)
      }
      store.applyGenerated(note.id, set, generator)
      if (warning) toast(warning)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Çalışma seti oluşturulamadı.')
    } finally {
      setBusy(null)
      setChunkStatus('')
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
          <span className="subtle">
            {ai.ok
              ? busy === 'ai'
                ? chunkStatus || 'Notun okunuyor, 1 dk kadar sürebilir…'
                : `${ai.label} · Daha iyi özet ve sorular.`
              : ai.reason}
          </span>
        </button>
        <button className="choice" onClick={() => run('local')} disabled={!!busy}>
          <strong>
            <Wand2 size={17} /> Basit mod
          </strong>
          <span className="subtle">Ücretsiz, cihazında çalışır.</span>
        </button>
      </div>
      <AiSignupPrompt />
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
  const [editing, setEditing] = useState<'note' | 'summary' | null>(null)
  const [confirm, confirmation] = useConfirm()
  const [regenerating, setRegenerating] = useState(false)
  // A link from an exam review can open the source tab with a quote to highlight (?alinti=…).
  const [highlightedSource, setHighlightedSource] = useState<string | null>(() => params.get('alinti'))
  const highlightRef = useRef<HTMLElement | null>(null)
  const note = store.data.notes.find((n) => n.id === id)
  const requested = params.get('sekme')

  const progress = note ? computeNoteProgress(note, store.data.cards, store.data.attempts) : null
  const cardCount = note ? store.data.cards.filter((c) => c.noteId === note.id).length : 0
  // Opening a note goes straight to the next thing to study; links can still ask for a view. The
  // landing view is chosen once per note, so finishing a step mid-round never moves the screen.
  const landing = useRef<{ noteId: string; view: TabId } | null>(null)
  if (note && progress && landing.current?.noteId !== note.id) {
    landing.current = {
      noteId: note.id,
      view: progress.isCompleted ? (cardCount ? 'kartlar' : 'ozet') : viewOfStep(progress.currentStep.id),
    }
  }
  const requestedStep = params.get('adim')
  const isSummarySubTab = (v: string | null): v is SummarySubTab =>
    v === 'tanis' || v === 'anla' || v === 'kodlama' || v === 'karsilastir'
  const tab: TabId =
    requested === 'kaynak' || VIEWS.some((v) => v.id === requested)
      ? (requested as TabId)
      : isSummarySubTab(requestedStep)
        ? 'ozet'
        : (landing.current?.view ?? 'ozet')

  useEffect(() => {
    if (tab === 'kaynak' && highlightedSource && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [tab, highlightedSource])

  if (!note || !progress) {
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
  const counts: Partial<Record<TabId, number>> = { kartlar: cardCount, test: note.questions.length, uygula: note.practice.length }
  const mastery = computeTopicMastery(note, store.data.cards, store.data.attempts)

  const summaryStep: SummarySubTab = isSummarySubTab(requestedStep)
    ? requestedStep
    : progress.steps[0].done && !progress.steps[1].done
      ? 'anla'
      : 'tanis'

  function show(view: TabId, step?: SummarySubTab) {
    setParams(view === 'ozet' ? (step ? { adim: step } : {}) : { sekme: view }, { replace: true })
    window.scrollTo(0, 0)
  }

  function showSourceInNote(excerpt: string) {
    setHighlightedSource(excerpt)
    show('kaynak')
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryMarkdown(note!))
      toast('Özet kopyalandı')
    } catch {
      toast('Panoya erişilemedi. Markdown indir seçeneğini kullanabilirsin.')
    }
  }

  function printSummary() {
    // Only the summary view is laid out for printing.
    if (tab !== 'ozet') show('ozet')
    window.setTimeout(() => window.print(), 150)
  }

  async function remove() {
    if (!note || !(await confirm(`“${note.title}” notu ve kartları silinsin mi?`))) return
    store.deleteNote(note.id)
    toast('Not silindi')
    navigate(course ? `/ders/${course.id}` : '/dersler')
  }

  const sourceMatch = tab === 'kaynak' && highlightedSource ? findSourceMatch(note.content, highlightedSource) : null
  const recommended = progress.isCompleted ? null : viewOfStep(progress.currentStep.id)

  return (
    <div className="page note-page">
      <Link to={course ? `/ders/${course.id}` : '/dersler'} className="back-link">
        <ArrowLeft size={16} /> {course?.name ?? 'Dersler'}
      </Link>

      <div className="note-head">
        <div className="grow">
          <h1>{note.title}</h1>
          <p className="subtle note-meta">
            {[
              note.generator === 'ai' && <span key="g">Yapay zekâ</span>,
              note.generator === 'local' && <span key="g">{note.summary?.origin === 'demo' ? 'Hazır örnek set' : 'Basit mod'}</span>,
              note.generator && progress.percent > 0 && <span key="p">%{progress.percent} tamamlandı</span>,
              mastery.assessed && (
                <span key="m" style={{ color: mastery.percent >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                  Hâkimiyet %{mastery.percent}
                </span>
              ),
              ...(note.summary?.tags ?? []).map((t) => <span key={`t-${t}`}>#{t}</span>),
            ]
              .filter(Boolean)
              // The separator sticks to the item before it, so a wrapped line never starts with "·".
              .map((item, i) => (i ? [<span key={`s${i}`} aria-hidden>{'\u00a0· '}</span>, item] : item))}
          </p>
        </div>
        <NoteMenu
          items={[
            { label: 'Kaynak metin', icon: <FileText size={16} />, onSelect: () => show('kaynak') },
            { label: 'Notu düzenle', icon: <PenLine size={16} />, onSelect: () => setEditing('note') },
            !!note.summary && { label: 'Özeti düzenle', icon: <Pencil size={16} />, onSelect: () => setEditing('summary') },
            !!note.generator && { label: 'Yeniden hazırla', icon: <RefreshCw size={16} />, onSelect: () => setRegenerating(true) },
            !!note.summary && { label: 'Özeti kopyala', icon: <Copy size={16} />, onSelect: copySummary },
            !!note.summary && { label: 'Markdown indir', icon: <Download size={16} />, onSelect: () => downloadText(`${note.title}.md`, summaryMarkdown(note)) },
            !!note.summary && { label: 'PDF / Yazdır', icon: <Printer size={16} />, onSelect: printSummary },
            { label: 'Notu sil', icon: <Trash2 size={16} />, onSelect: remove, danger: true },
          ]}
        />
      </div>

      {confirmation}
      {editing === 'note' && <NoteEditor note={note} onClose={() => setEditing(null)} />}
      {editing === 'summary' && <SummaryEditor note={note} onClose={() => setEditing(null)} />}
      {note.summary?.sourceChanged && (
        <Alert tone="warning">Kaynak metin değişti. Özet, kartlar ve sorular önceki metne ait; güncellemek için menüden Yeniden hazırla’yı seç.</Alert>
      )}

      {!note.generator ? (
        <>
          <div className="panel">
            <div className="form">
              <h2>Bu not için çalışma seti hazırlanmadı</h2>
              <GenerateChoice note={note} onDone={() => toast('Çalışma seti hazır')} />
            </div>
          </div>
          <section className="section">
            <h2>Not içeriği</h2>
            <div className="panel">
              <p className="prewrap" style={{ lineHeight: 1.7 }}>
                {note.content}
              </p>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="study-steps no-print" role="tablist" aria-label="Çalışma adımları">
            {VIEWS.map((view, i) => {
              const done = view.steps.every((step) => progress.steps.find((s) => s.id === step)?.done)
              return (
                <button
                  key={view.id}
                  role="tab"
                  aria-selected={tab === view.id}
                  className={`${done ? 'done' : ''} ${recommended === view.id ? 'recommended' : ''}`}
                  onClick={() => show(view.id)}
                >
                  <span className={`step-dot ${done ? 'done' : ''}`}>{done ? <Check size={12} /> : i + 1}</span>
                  {view.label}
                  {counts[view.id] !== undefined && <span className="tab-count">{counts[view.id]}</span>}
                </button>
              )
            })}
          </div>

          <div role="tabpanel">
            {tab === 'ozet' && <SummaryTab note={note} activeStep={summaryStep} onStep={(step) => show('ozet', step)} onNext={() => show('test')} />}
            <div hidden={tab !== 'test'}>
              <QuizTab key={JSON.stringify(note.questions)} note={note} active={tab === 'test'} onNext={() => show('kartlar')} onShowSource={showSourceInNote} />
            </div>
            {tab === 'kartlar' && <CardsTab note={note} onNext={() => show('uygula')} onShowSource={showSourceInNote} />}
            <div hidden={tab !== 'uygula'}>
              <PracticeTab key={note.practice.map((p) => p.id).join()} note={note} />
            </div>
          </div>
        </>
      )}

      {tab === 'kaynak' && (
        <section className="section" aria-label="Kaynak metin">
          <div className="section-head">
            <h2>Kaynak metin</h2>
            <span className="subtle">
              {wordCount(note.content).toLocaleString('tr-TR')} kelime · {readingMinutes(note.content)} dk · {relativeDate(note.createdAt)}
            </span>
          </div>
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {highlightedSource && (
              <div className="source-banner" role="status">
                <div className="btn-row">
                  <strong>Sorunun geçtiği bölüm</strong>
                  {sourceMatch?.sectionLabel && <span className="chip chip-accent">{sourceMatch.sectionLabel}</span>}
                  {!sourceMatch && <span className="subtle">Alıntı metinde tam eşleşmedi: “{highlightedSource}”</span>}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHighlightedSource(null)}>
                  <X size={14} /> Vurguyu kaldır
                </button>
              </div>
            )}
            <p className="prewrap" style={{ lineHeight: 1.7 }}>
              {sourceMatch ? (
                <>
                  {note.content.slice(0, sourceMatch.start)}
                  <mark id="kaynak-vurgu" ref={highlightRef} className="source-highlight">
                    {note.content.slice(sourceMatch.start, sourceMatch.end)}
                  </mark>
                  {note.content.slice(sourceMatch.end)}
                </>
              ) : (
                note.content
              )}
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
