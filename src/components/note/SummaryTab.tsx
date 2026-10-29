import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Compass, Copy, Download, Layers, Pencil, Printer, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toggleCheckedTerm, toggleCompletedStep } from '../../lib/learningPath'
import { downloadText, summaryMarkdown } from '../../lib/noteTools'
import { useStore } from '../../lib/store'
import type { LearningStepId, Note } from '../../lib/types'
import { Alert, Modal, useToast } from '../ui'

function SummaryEditor({ note, onClose }: { note: Note; onClose: () => void }) {
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
  onGoToStep,
}: {
  note: Note
  activeStep?: 'tanis' | 'anla'
  onGoToStep?: (step: LearningStepId) => void
}) {
  const store = useStore()
  const [editing, setEditing] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const [error, setError] = useState('')
  const [pointIndex, setPointIndex] = useState(0)
  const toast = useToast()
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(summaryMarkdown(note))
      toast('Özet kopyalandı')
      setError('')
    } catch {
      setError('Panoya erişilemedi. Markdown indir seçeneğini kullanabilirsin.')
    }
  }

  function handleCheckTerm(term: string) {
    if (!summary) return
    const next = toggleCheckedTerm(summary, term)
    store.updateNote(note.id, { summary: next })
  }

  function completeStep1() {
    if (!summary) return
    const next = toggleCompletedStep(summary, 'tanis', true)
    store.updateNote(note.id, { summary: next })
    onGoToStep?.('anla')
  }

  function completeStep2() {
    if (!summary) return
    let next = toggleCompletedStep(summary, 'tanis', true)
    next = toggleCompletedStep(next, 'anla', true)
    store.updateNote(note.id, { summary: next })
    toast('2. Adım tamamlandı! Şimdi kartlarla pekiştirelim.')
    onGoToStep?.('pekistir')
  }

  return (
    <div className="section summary-print" style={{ gap: 24 }}>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between' }}>
        <div className="btn-row">
          <button className="btn btn-sm" onClick={copy}>
            <Copy size={15} /> Kopyala
          </button>
          <button className="btn btn-sm" onClick={() => downloadText(`${note.title}.md`, summaryMarkdown(note))}>
            <Download size={15} /> Markdown indir
          </button>
          <button className="btn btn-sm" onClick={() => window.print()}>
            <Printer size={15} /> PDF / Yazdır
          </button>
          <button className="btn btn-sm" onClick={() => setEditing(true)}>
            <Pencil size={15} /> Özeti düzenle
          </button>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {/* Guided Step-by-Step Coach for Zero-Knowledge Learners */}
      <div className="guided-box no-print" aria-label="Adım adım konu rehberi">
        <div className="guided-box-head">
          <div className="guided-stage-tabs" role="group" aria-label="Özet çalışma adımları">
            <button
              type="button"
              className={`guided-stage-btn ${activeStep === 'tanis' ? 'active' : ''}`}
              onClick={() => onGoToStep?.('tanis')}
            >
              <span className={`step-dot ${tanisDone ? 'done' : ''}`}>{tanisDone ? <Check size={12} /> : '1'}</span>
              <span>1. Adım: Kavramlarla Tanış</span>
            </button>
            <button
              type="button"
              className={`guided-stage-btn ${activeStep === 'anla' ? 'active' : ''}`}
              onClick={() => onGoToStep?.('anla')}
            >
              <span className={`step-dot ${anlaDone ? 'done' : ''}`}>{anlaDone ? <Check size={12} /> : '2'}</span>
              <span>2. Adım: Madde Madde Anla</span>
            </button>
          </div>
          <span className="subtle">Sıfırdan başlayanlar için rehber</span>
        </div>

        {activeStep === 'tanis' ? (
          <div className="guided-stage-body">
            <div className="guided-intro">
              <Compass size={18} className="guided-icon" />
              <div>
                <strong>Konuya sıfırdan başlıyoruz: Önce büyük resmi ve terimleri tanı</strong>
                <p className="muted">
                  Bütün notu tek seferde ezberlemeye çalışma. Önce bu konunun ne anlattığını oku, ardından temel kavramların üzerine tıklayarak tanıdığını işaretle.
                </p>
              </div>
            </div>

            {summary.overview && (
              <div className="guided-overview-card">
                <span className="guided-kicker">BÜYÜK RESİM — BU KONU NE ANLATIYOR?</span>
                <p>{summary.overview}</p>
              </div>
            )}

            {summary.keyTerms.length > 0 && (
              <div className="section" style={{ gap: 10 }}>
                <div className="section-head">
                  <span className="subtle" style={{ fontWeight: 600 }}>
                    Temel kavramları kontrol et ({checkedTerms.size}/{summary.keyTerms.length} anlaşıldı)
                  </span>
                  {checkedTerms.size < summary.keyTerms.length && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const allTerms = summary.keyTerms.map(t => t.term)
                        const next = toggleCompletedStep({ ...summary, checkedTerms: allTerms }, 'tanis', true)
                        store.updateNote(note.id, { summary: next })
                      }}
                    >
                      Tümünü anladım işaretle
                    </button>
                  )}
                </div>
                <div className="term-check-grid">
                  {summary.keyTerms.map((term, i) => {
                    const isChecked = checkedTerms.has(term.term)
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`term-check-card ${isChecked ? 'checked' : ''}`}
                        onClick={() => handleCheckTerm(term.term)}
                        aria-pressed={isChecked}
                      >
                        <div className="term-check-top">
                          <strong>{term.term}</strong>
                          <span className="term-check-badge">
                            {isChecked ? (
                              <>
                                <Check size={13} /> Anladım
                              </>
                            ) : (
                              'Anladım işaretle'
                            )}
                          </span>
                        </div>
                        <p>{term.definition}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="guided-footer">
              <span className="subtle">
                {tanisDone
                  ? 'Harika! Temel kavramlara aşina oldun.'
                  : 'Kavramlara göz attıysan madde madde konu anlatımına geçebilirsin.'}
              </span>
              <button type="button" className="btn btn-primary" onClick={completeStep1}>
                2. Adıma Geç: Madde Madde Anla <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="guided-stage-body">
            <div className="guided-intro">
              <Sparkles size={18} className="guided-icon" />
              <div>
                <strong>2. Adım: Ana noktaları sindire sindire ilerle</strong>
                <p className="muted">
                  Alt alta bütün maddeleri okumak yerine her maddeyi tek tek düşünerek ilerle. Hepsini bitirdiğinde kartlarla pekiştirme adımına geçeceğiz.
                </p>
              </div>
            </div>

            {totalPoints > 0 ? (
              <div className="point-stepper">
                <div className="section-head">
                  <span className="subtle" style={{ fontWeight: 600 }}>
                    Ana Nokta {safePointIndex + 1} / {totalPoints}
                  </span>
                  <div className="point-dots" aria-hidden>
                    {summary.points.map((_, idx) => (
                      <span
                        key={idx}
                        className={`point-dot ${idx === safePointIndex ? 'active' : idx < safePointIndex ? 'Read' : ''}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="progress" aria-hidden>
                  <div style={{ width: `${((safePointIndex + 1) / totalPoints) * 100}%` }} />
                </div>

                <div className="point-focus-card">
                  <span className="point-focus-num">{safePointIndex + 1}</span>
                  <p className="point-focus-text">{summary.points[safePointIndex]}</p>
                </div>

                <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={safePointIndex === 0}
                    onClick={() => setPointIndex(Math.max(0, safePointIndex - 1))}
                  >
                    <ArrowLeft size={16} /> Önceki madde
                  </button>

                  {safePointIndex + 1 < totalPoints ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setPointIndex(safePointIndex + 1)}
                    >
                      Anladım, sıradaki madde ({safePointIndex + 2}/{totalPoints}) <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={completeStep2}>
                      <Layers size={16} /> 2. Adımı Tamamla → Kartlarla Pekiştir
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="guided-footer">
                <span className="subtle">Özeti okuduysan kartlarla pekiştirme adımına geçebilirsin.</span>
                <button type="button" className="btn btn-primary" onClick={completeStep2}>
                  2. Adımı Tamamla → Kartlarla Pekiştir <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* The guide above already walks through this content; the full summary stays one click away
          and is always included when printing. */}
      <div className={`summary-reference ${showFull ? '' : 'collapsed'}`}>
        <button
          type="button"
          className="btn btn-ghost btn-sm no-print"
          aria-expanded={showFull}
          onClick={() => setShowFull(!showFull)}
          style={{ alignSelf: 'flex-start' }}
        >
          {showFull ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {showFull ? 'Tam özeti gizle' : 'Tam özeti tek sayfada gör'}
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

      {note.generator === 'local' && summary.origin !== 'demo' && (
        <p className="subtle">
          Basit mod cümleleri notundan seçer; yeni bilgi eklemez. Daha kapsamlı açıklamalar için yapay zekâ ile yeniden hazırlayabilirsin.
        </p>
      )}

      {anlaDone && (
        <div className="panel no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
            <span>Konu özeti ve kavramlar tamamlandı. Sıradaki adım: Kartlarla hafızada yoklama.</span>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onGoToStep?.('pekistir')}>
            3. Adıma Geç: Kartlar <ArrowRight size={15} />
          </button>
        </div>
      )}

      {editing && <SummaryEditor note={note} onClose={() => setEditing(false)} />}
    </div>
  )
}
