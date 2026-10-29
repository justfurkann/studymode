import { ArrowLeft, ArrowRight, BookText, Check, FileText, Layers, ListChecks, PenLine, RefreshCw, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { NoteEditor } from '../components/NoteEditor'
import { AiSignupPrompt } from '../components/AiSignupPrompt'
import { CardsTab } from '../components/note/CardsTab'
import { PracticeTab } from '../components/note/PracticeTab'
import { QuizTab } from '../components/note/QuizTab'
import { SummaryTab } from '../components/note/SummaryTab'
import { Alert, Empty, Modal, Spinner, useConfirm, useToast } from '../components/ui'
import { readingMinutes, relativeDate, wordCount } from '../lib/format'
import { findSourceMatch } from '../lib/noteTools'
import { computeNoteProgress, computeTopicMastery } from '../lib/learningPath'
import { generateLocally } from '../lib/localGenerator'
import { aiAvailability, useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import type { Generator, LearningStepId, Note } from '../lib/types'

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
        const { generateStudySet, partialChunkMessage } = await import('../lib/ai')
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
  const [editing, setEditing] = useState(false)
  const [confirm, confirmation] = useConfirm()
  const [regenerating, setRegenerating] = useState(false)
  // A link from an exam review can open the source tab with a quote to highlight (?alinti=…).
  const [highlightedSource, setHighlightedSource] = useState<string | null>(() => params.get('alinti'))
  const highlightRef = useRef<HTMLElement | null>(null)
  const note = store.data.notes.find((n) => n.id === id)
  const requested = params.get('sekme') as TabId | null
  const tab: TabId = TABS.some((t) => t.id === requested) ? requested! : 'ozet'

  useEffect(() => {
    if (tab === 'kaynak' && highlightedSource && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [tab, highlightedSource])

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
  const progress = computeNoteProgress(note, store.data.cards, store.data.attempts)
  const mastery = computeTopicMastery(note, store.data.cards, store.data.attempts)

  const requestedStep = params.get('adim') as LearningStepId | null
  const summaryStep: 'tanis' | 'anla' =
    requestedStep === 'anla'
      ? 'anla'
      : requestedStep === 'tanis'
        ? 'tanis'
        : progress.steps[0].done && !progress.steps[1].done
          ? 'anla'
          : 'tanis'

  const activeStepId: LearningStepId =
    tab === 'ozet'
      ? summaryStep
      : tab === 'kartlar'
        ? 'pekistir'
        : tab === 'test'
          ? 'sina'
          : tab === 'uygula'
            ? 'anlat'
            : progress.currentStep.id

  function goToStep(stepId: LearningStepId) {
    if (stepId === 'tanis' || stepId === 'anla') {
      setParams({ adim: stepId }, { replace: true })
    } else if (stepId === 'pekistir') {
      setParams({ sekme: 'kartlar' }, { replace: true })
    } else if (stepId === 'sina') {
      setParams({ sekme: 'test' }, { replace: true })
    } else if (stepId === 'anlat') {
      setParams({ sekme: 'uygula' }, { replace: true })
    }
    window.scrollTo(0, 0)
  }

  function showSourceInNote(excerpt: string) {
    setHighlightedSource(excerpt)
    setParams({ sekme: 'kaynak' }, { replace: true })
  }

  async function remove() {
    if (!note || !await confirm(`“${note.title}” notu ve kartları silinsin mi?`)) return
    store.deleteNote(note.id)
    toast('Not silindi')
    navigate(course ? `/ders/${course.id}` : '/dersler')
  }

  const sourceMatch = tab === 'kaynak' && highlightedSource ? findSourceMatch(note.content, highlightedSource) : null

  return (
    <div className="page">
      <Link to={course ? `/ders/${course.id}` : '/dersler'} className="back-link">
        <ArrowLeft size={16} /> {course?.name ?? 'Dersler'}
      </Link>

      <div className="page-header">
        <div>
          <h1>{note.title}</h1>
          <div className="btn-row">
            <span className="subtle">
              {wordCount(note.content).toLocaleString('tr-TR')} kelime · {readingMinutes(note.content)} dk okuma · {relativeDate(note.createdAt)}
            </span>
            {note.generator === 'ai' && <span className="chip chip-accent">Yapay zekâ ile hazırlandı</span>}
            {note.generator === 'local' && <span className="chip">{note.summary?.origin === 'demo' ? 'Hazır örnek set' : 'Basit mod'}</span>}
          </div>
        </div>
        <div className="btn-row header-actions">
          <button className="btn btn-sm" onClick={() => setEditing(true)}>
            <PenLine size={15} /> Düzenle
          </button>
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

      {confirmation}
      {editing && <NoteEditor note={note} onClose={() => setEditing(false)} />}
      {note.summary?.sourceChanged && (
        <Alert tone="warning">Kaynak metin değişti. Özet, kartlar ve sorular önceki metne ait; güncellemek için Yeniden hazırla’yı seç.</Alert>
      )}
      {!!note.summary?.tags?.length && (
        <div className="btn-row">
          {note.summary.tags.map((t) => (
            <span key={t} className="chip">
              #{t}
            </span>
          ))}
        </div>
      )}

      {!note.generator ? (
        <div className="panel">
          <div className="form">
            <h2>Bu not için çalışma seti hazırlanmadı</h2>
            <GenerateChoice note={note} onDone={() => toast('Çalışma seti hazır')} />
          </div>
        </div>
      ) : (
        <>
          {/* 5-Step Guided Learning Roadmap for Zero-Knowledge Students */}
          <section className="roadmap no-print" aria-label="Adım adım öğrenme yolu">
            <div className="roadmap-head">
              <div>
                <div className="roadmap-title-row">
                  <strong>Adım Adım Öğrenme Yolu</strong>
                  <span className={`chip ${progress.isCompleted ? 'chip-success' : 'chip-accent'}`}>
                    {progress.isCompleted ? 'Tamamlandı (%100)' : `${progress.completedCount}/${progress.totalSteps} adım · %${progress.percent}`}
                  </span>
                </div>
                <p className="subtle">
                  {progress.isCompleted
                    ? 'Bu konunun 5 adımını da tamamladın! İstediğin adıma tekrar göz atabilirsin.'
                    : `Sıradaki önerilen adım: ${progress.currentStep.stepNumber}. ${progress.currentStep.title} — ${progress.currentStep.description}`}
                </p>
              </div>
              {!progress.isCompleted && activeStepId !== progress.currentStep.id && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => goToStep(progress.currentStep.id)}>
                  Sıradaki adıma geç <ArrowRight size={15} />
                </button>
              )}
            </div>

            <div className="dual-metrics" aria-label="İlerleme ve konu hâkimiyeti">
              <div className="metric-card">
                <div className="metric-card-top">
                  <span className="guided-kicker">ÇALIŞMA İLERLEMESİ</span>
                  <strong>%{progress.percent}</strong>
                </div>
                <span className="subtle">
                  {progress.completedCount}/{progress.totalSteps} adım tamamlandı
                </span>
              </div>
              <div className="metric-card">
                <div className="metric-card-top">
                  <span className="guided-kicker">KONU HÂKİMİYETİ</span>
                  <strong style={{ color: mastery.assessed ? (mastery.percent >= 70 ? 'var(--success)' : 'var(--warning)') : 'var(--text-2)' }}>
                    {mastery.assessed ? `%${mastery.percent}` : 'Ölçülmedi'}
                  </strong>
                </div>
                <span className="subtle">{mastery.detail}</span>
              </div>
            </div>

            <div className="roadmap-steps" role="group" aria-label="Öğrenme adımları">
              {progress.steps.map((step) => {
                const isCurrentView = activeStepId === step.id
                const isNextRecommended = !progress.isCompleted && progress.currentStep.id === step.id
                return (
                  <button
                    key={step.id}
                    type="button"
                    aria-current={isCurrentView ? 'step' : undefined}
                    className={`roadmap-step ${step.done ? 'done' : ''} ${isCurrentView ? 'active' : ''} ${isNextRecommended ? 'recommended' : ''}`}
                    onClick={() => goToStep(step.id)}
                  >
                    <div className="roadmap-step-top">
                      <span className="roadmap-num">{step.done ? <Check size={13} /> : step.stepNumber}</span>
                      <span className="roadmap-step-name">{step.shortTitle}</span>
                    </div>
                    <span className="roadmap-step-meta">{step.statusText}</span>
                  </button>
                )
              })}
            </div>
          </section>

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
            {tab === 'ozet' && <SummaryTab note={note} activeStep={summaryStep} onGoToStep={goToStep} />}
            {tab === 'kartlar' && <CardsTab note={note} onGoToStep={goToStep} onShowSource={showSourceInNote} />}
            <div hidden={tab !== 'test'}>
              <QuizTab key={JSON.stringify(note.questions)} note={note} active={tab === 'test'} onGoToStep={goToStep} onShowSource={showSourceInNote} />
            </div>
            <div hidden={tab !== 'uygula'}>
              <PracticeTab key={note.practice.map((p) => p.id).join()} note={note} />
            </div>
            {tab === 'kaynak' && (
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

