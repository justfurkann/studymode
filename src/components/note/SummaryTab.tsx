import { ArrowLeft, ArrowRight, BookOpenText, Check, ChevronDown, ChevronRight, Gem, Headphones, HelpCircle, Image as ImageIcon, KeyRound, ListChecks, MoreHorizontal, Scale } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ExplainMode } from '../../lib/ai'
import { toggleCheckedTerm, toggleCompletedStep } from '../../lib/learningPath'
import { aiAvailability, useSettings } from '../../lib/settings'
import { AiSignupPrompt } from '../AiSignupPrompt'
import { useStore } from '../../lib/store'
import type { Note, SummarySubTab } from '../../lib/types'
import { Modal, Spinner } from '../ui'
import { freshImport } from '../../lib/version'
import { ComparisonTab, MemoryCodingTab } from './MemoryTabs'
import { PodcastTab, VisualTab } from './VisualAndPodcastTabs'
import { FullSummary } from './FullSummary'

/** The extra study tools, folded into one "Araçlar" menu so the step bar stays short. */
const TOOLS: Array<{ id: SummarySubTab; label: string; text: string; icon: typeof KeyRound; premium?: boolean }> = [
  { id: 'kodlama', label: 'Hafıza kodlaması', text: 'Kısaltma ve kodlarla akılda tut', icon: KeyRound },
  { id: 'karsilastir', label: 'Karşılaştırma', text: 'Karıştırdığın iki kavramı yan yana koy', icon: Scale },
  { id: 'gorsel', label: 'Görsel & Şema', text: 'Kavram haritası ve görseller', icon: ImageIcon, premium: true },
  { id: 'podcast', label: 'Podcast', text: 'Notu iki kişilik sohbet olarak dinle', icon: Headphones, premium: true },
]

function StepTools({ active, onStep }: { active: SummarySubTab; onStep: (step: SummarySubTab) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const current = TOOLS.find((t) => t.id === active)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const Icon = current?.icon ?? MoreHorizontal
  return (
    <div className="step-tools" ref={box}>
      <button type="button" aria-pressed={!!current} aria-expanded={open} aria-controls="step-tools-menu" onClick={() => setOpen((v) => !v)}>
        <Icon size={14} /> {current ? current.label : 'Araçlar'} <ChevronDown size={14} className="step-tools-chev" aria-hidden />
      </button>
      {open && (
        <div id="step-tools-menu" className="step-tools-menu" role="group" aria-label="Çalışma araçları">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={active === t.id}
              onClick={() => {
                setOpen(false)
                onStep(t.id)
              }}
            >
              <span className="step-tools-icon" aria-hidden>
                <t.icon size={16} />
              </span>
              <span className="step-tools-text">
                <strong>
                  {t.label} {t.premium && <Gem size={12} className="prem-gem" aria-label="Premium özellik içerir" />}
                </strong>
                <span>{t.text}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const EXPLAIN_MODES: Array<{ mode: ExplainMode; label: string }> = [
  { mode: 'simple', label: 'Daha basit anlat' },
  { mode: 'example', label: 'Günlük hayattan örnek ver' },
  { mode: 'step_by_step', label: 'Bana adım adım öğret' },
]

function ConceptExplainer({
  note,
  topic,
  compact = false,
}: {
  note: Note
  topic: string
  compact?: boolean
}) {
  const store = useStore()
  const settings = useSettings()
  const ai = aiAvailability(settings, !!store.session)
  const [open, setOpen] = useState(false)
  const [activeMode, setActiveMode] = useState<ExplainMode | null>(null)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')
  /** Why the reply is the offline fallback (only related sentences from the note), or '' for a real AI answer. */
  const [fallbackReason, setFallbackReason] = useState('')

  async function ask(mode: ExplainMode) {
    setActiveMode(mode)
    setBusy(true)
    try {
      const { explainConcept, localExplainConcept, contextAround } = await freshImport(() => import('../../lib/ai'))
      // Only the passage around the concept is sent: it is what the explanation needs, and it keeps
      // requests small for long notes.
      const context = contextAround(note.content, topic, 8_000)
      if (ai.ok) {
        try {
          setReply(await explainConcept({ title: note.title, topic, context, mode }, settings))
          setFallbackReason('')
          store.recordActivity()
          return
        } catch (e) {
          setFallbackReason(`Yapay zekâya ulaşılamadı (${e instanceof Error ? e.message : 'bilinmeyen hata'}). Notundaki ilgili cümleler gösteriliyor.`)
        }
      } else {
        setFallbackReason('Yapay zekâ kapalı olduğu için notundaki ilgili cümleler gösteriliyor; bu bir açıklama değil.')
      }
      setReply(localExplainConcept({ title: note.title, topic, context, mode }))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`btn btn-ghost btn-sm ${compact ? 'explain-trigger-compact' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <HelpCircle size={14} /> Bu konuyu anlamadım
      </button>
    )
  }

  return (
    <div
      className="explain-helper"
      onClick={(e) => e.stopPropagation()}
      role="region"
      aria-label="Konu açıklama seçenekleri"
    >
      <div className="explain-helper-head">
        <span className="subtle" style={{ fontWeight: 600 }}>
          Nasıl açıklamamı istersin?
        </span>
        <div className="btn-row" style={{ gap: 6 }}>
          {EXPLAIN_MODES.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              className={`btn btn-sm ${activeMode === opt.mode ? 'btn-primary' : ''}`}
              disabled={busy}
              onClick={() => ask(opt.mode)}
            >
              {busy && activeMode === opt.mode ? <Spinner size={13} /> : null}
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setOpen(false)
              setReply('')
              setActiveMode(null)
            }}
          >
            Kapat
          </button>
        </div>
      </div>
      {reply && fallbackReason && <p className="subtle">{fallbackReason}</p>}
      {reply && fallbackReason && !ai.ok && <AiSignupPrompt reason="Yapay zekâ kavramı daha basit anlatsın, örnek versin ya da adım adım öğretsin." />}
      {reply && (
        <div className="explain-helper-reply prewrap" role="status">
          {reply}
        </div>
      )}
    </div>
  )
}

export function SummaryEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const store = useStore()
  const [overview, setOverview] = useState(note.summary?.overview ?? '')
  const [points, setPoints] = useState(note.summary?.points.join('\n') ?? '')
  const [terms, setTerms] = useState(note.summary?.keyTerms.map(t => `${t.term}: ${t.definition}`).join('\n') ?? '')
  function save(e: FormEvent) {
    e.preventDefault()
    store.updateNote(note.id, {
      summary: {
        ...note.summary,
        overview: overview.trim(),
        points: points.split('\n').map(s => s.trim()).filter(Boolean),
        keyTerms: terms.split('\n').flatMap(line => {
          const i = line.indexOf(':')
          return i > 0 && line.slice(i + 1).trim()
            ? [{ term: line.slice(0, i).trim(), definition: line.slice(i + 1).trim() }]
            : []
        }),
      },
    })
    onClose()
  }
  return (
    <Modal title="Özeti düzenle" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label className="field">
          Genel özet
          <textarea className="textarea" value={overview} onChange={e => setOverview(e.target.value)} maxLength={10000} />
        </label>
        <label className="field">
          Ana noktalar (her satıra bir madde)
          <textarea className="textarea" rows={6} value={points} onChange={e => setPoints(e.target.value)} maxLength={30000} />
        </label>
        <label className="field">
          Kavramlar (kavram: açıklama)
          <textarea className="textarea" rows={5} value={terms} onChange={e => setTerms(e.target.value)} maxLength={30000} />
        </label>
        <button className="btn btn-primary">Özeti kaydet</button>
      </form>
    </Modal>
  )
}

export function SummaryTab({
  note,
  activeStep = 'tanis',
  onStep,
  onNext,
}: {
  note: Note
  activeStep?: SummarySubTab
  onStep: (step: SummarySubTab) => void
  /** Goes on to the test once the main points are read. */
  onNext: () => void
}) {
  const store = useStore()
  const [pointIndex, setPointIndex] = useState(0)
  const summary = note.summary
  if (!summary) return null

  const checkedTerms = new Set(summary.checkedTerms ?? [])
  const completedSteps = new Set(summary.completedSteps ?? [])
  const tanisDone =
    completedSteps.has('tanis') ||
    (summary.keyTerms.length > 0 && summary.keyTerms.every(t => checkedTerms.has(t.term)))
  const anlaDone = completedSteps.has('anla')

  const totalPoints = summary.points.length
  const safePointIndex = totalPoints > 0 ? Math.min(pointIndex, totalPoints - 1) : 0

  function handleCheckTerm(term: string) {
    if (!summary) return
    store.updateNote(note.id, { summary: toggleCheckedTerm(summary, term) })
  }

  function completeStep1() {
    if (!summary) return
    store.updateNote(note.id, { summary: toggleCompletedStep(summary, 'tanis', true) })
    onStep('anla')
  }

  function completeStep2() {
    if (!summary) return
    let next = toggleCompletedStep(summary, 'tanis', true)
    next = toggleCompletedStep(next, 'anla', true)
    store.updateNote(note.id, { summary: next })
    onNext()
  }

  return (
    <div className="section summary-print" style={{ gap: 20 }}>
      {activeStep !== 'tam' && (
        <button type="button" className="full-summary-open no-print" onClick={() => onStep('tam')}>
          <BookOpenText size={22} aria-hidden />
          <span>
            <strong>Tam özet</strong>
            <span>{summary.detailed ? 'Konunun ayrıntılı anlatımı tek sayfada' : 'Bütün özeti tek sayfada oku, istersen ayrıntılı anlatım hazırlat'}</span>
          </span>
          <ChevronRight size={20} aria-hidden />
        </button>
      )}
      <div className="segmented summary-steps no-print" role="group" aria-label="Özet adımları">
        <button type="button" aria-pressed={activeStep === 'tanis'} onClick={() => onStep('tanis')}>
          <span className={`step-dot ${tanisDone ? 'done' : ''}`}>{tanisDone ? <Check size={12} /> : '1'}</span> Kavramlar
        </button>
        <button type="button" aria-pressed={activeStep === 'anla'} onClick={() => onStep('anla')}>
          <span className={`step-dot ${anlaDone ? 'done' : ''}`}>{anlaDone ? <Check size={12} /> : '2'}</span> Ana noktalar
        </button>
        {activeStep === 'tam' && (
          <button type="button" aria-pressed onClick={() => onStep('tam')}>
            <BookOpenText size={14} /> Tam özet
          </button>
        )}
        <StepTools active={activeStep} onStep={onStep} />
      </div>

      {activeStep === 'tam' ? (
        <FullSummary note={note} onBack={() => onStep(tanisDone ? 'anla' : 'tanis')} onTest={completeStep2} />
      ) : activeStep === 'kodlama' ? (
        <MemoryCodingTab note={note} onGoCompare={() => onStep('karsilastir')} />
      ) : activeStep === 'karsilastir' ? (
        <ComparisonTab note={note} onNext={completeStep2} />
      ) : activeStep === 'gorsel' ? (
        <VisualTab note={note} onGoPodcast={() => onStep('podcast')} />
      ) : activeStep === 'podcast' ? (
        <PodcastTab note={note} onNext={completeStep2} />
      ) : activeStep === 'tanis' ? (
        <div className="section no-print" style={{ gap: 16 }} aria-label="Kavramlar">
          {summary.overview && (
            <div className="guided-overview-card">
              <p>{summary.overview}</p>
            </div>
          )}

          {summary.keyTerms.length > 0 && (
            <div className="section" style={{ gap: 10 }}>
              <div className="section-head">
                <span className="subtle" style={{ fontWeight: 600 }}>
                  Anladığın kavrama dokun · {checkedTerms.size}/{summary.keyTerms.length}
                </span>
                {checkedTerms.size < summary.keyTerms.length && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const allTerms = summary.keyTerms.map(t => t.term)
                      store.updateNote(note.id, { summary: toggleCompletedStep({ ...summary, checkedTerms: allTerms }, 'tanis', true) })
                    }}
                  >
                    Hepsini anladım
                  </button>
                )}
              </div>
              <div className="term-check-grid">
                {summary.keyTerms.map((term, i) => {
                  const isChecked = checkedTerms.has(term.term)
                  return (
                    <div key={i} className={`term-check-card ${isChecked ? 'checked' : ''}`}>
                      <button type="button" className="term-check-hit" onClick={() => handleCheckTerm(term.term)} aria-pressed={isChecked}>
                        <div className="term-check-top">
                          <strong>{term.term}</strong>
                          {isChecked && (
                            <span className="term-check-badge">
                              <Check size={13} /> Anladım
                            </span>
                          )}
                        </div>
                        <p>{term.definition}</p>
                      </button>
                      <ConceptExplainer note={note} topic={`${term.term}: ${term.definition}`} compact />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="study-next">
            <button type="button" className="btn btn-primary btn-lg" onClick={completeStep1}>
              Devam: Ana noktalar <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : totalPoints > 0 ? (
        <div className="point-stepper no-print">
          <div className="study-progress">
            <span className="subtle">
              Madde {safePointIndex + 1} / {totalPoints}
            </span>
            <div className="progress" aria-hidden>
              <div style={{ width: `${((safePointIndex + 1) / totalPoints) * 100}%` }} />
            </div>
          </div>

          <div className="point-focus-card" style={{ flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span className="point-focus-num">{safePointIndex + 1}</span>
              <p className="point-focus-text">{summary.points[safePointIndex]}</p>
            </div>
            <ConceptExplainer key={safePointIndex} note={note} topic={summary.points[safePointIndex]} />
          </div>

          <div className="card-answer">
            <button type="button" className="btn btn-lg" disabled={safePointIndex === 0} onClick={() => setPointIndex(Math.max(0, safePointIndex - 1))} aria-label="Önceki madde">
              <ArrowLeft size={16} /> Geri
            </button>
            {safePointIndex + 1 < totalPoints ? (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setPointIndex(safePointIndex + 1)}>
                Anladım <ArrowRight size={16} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-lg" onClick={completeStep2}>
                <ListChecks size={16} /> Teste geç
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="study-next no-print">
          <button type="button" className="btn btn-primary btn-lg" onClick={completeStep2}>
            <ListChecks size={16} /> Teste geç
          </button>
        </div>
      )}

      {/* The steps above already walk through this content; the full summary stays one click away
          and is always included when printing. */}
      {activeStep !== 'tam' && (
      <div className="summary-reference collapsed">
        <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => onStep('tam')} style={{ alignSelf: 'flex-start' }}>
          <BookOpenText size={16} /> Tam özeti tek sayfada gör
        </button>
        <div className="summary-reference-body">
          {summary.overview && (
            <div className="panel">
              <p className="prose">{summary.overview}</p>
            </div>
          )}

          {summary.points.length > 0 && (
            <section className="section">
              <h2>Ana noktalar</h2>
              <div className="panel" style={{ paddingBlock: 6 }}>
                <ol className="points">
                  {summary.points.map((point, i) => (
                    <li key={i}>
                      <span className="n">{i + 1}</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {summary.keyTerms.length > 0 && (
            <section className="section">
              <h2>Kavramlar</h2>
              <div className="terms">
                {summary.keyTerms.map((term, i) => (
                  <div className="term" key={i}>
                    <strong>{term.term}</strong>
                    <p>{term.definition}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      )}

      {note.generator === 'local' && summary.origin !== 'demo' && (
        <p className="subtle">Basit mod cümleleri notundan seçer; yeni bilgi eklemez. Daha iyi açıklamalar için yapay zekâ ile yeniden hazırlayabilirsin.</p>
      )}
    </div>
  )
}
