import { ArrowLeft, Lightbulb, ListChecks, Printer, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { aiAvailability, useSettings } from '../../lib/settings'
import { useStore } from '../../lib/store'
import type { DetailedSummary, Note } from '../../lib/types'
import { freshImport } from '../../lib/version'
import { AiSignupPrompt } from '../AiSignupPrompt'
import { Alert, Spinner, useToast } from '../ui'

/*
 * "Tam özet": the whole summary on one page, to read top to bottom (or print). On request the AI
 * writes a detailed version of the note, section by section with explanations, the facts to learn,
 * the note's own examples and what to watch for in the exam. It is saved with the note.
 */

const anchor = (i: number) => `tam-ozet-${i + 1}`

export function FullSummary({ note, onBack, onTest }: { note: Note; onBack: () => void; onTest: () => void }) {
  const store = useStore()
  const settings = useSettings()
  const toast = useToast()
  const ai = aiAvailability(settings, !!store.session)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  // The note may change while the AI writes (another tab, a sync); save onto the latest one.
  const latest = useRef(note)
  latest.current = note

  const summary = note.summary
  if (!summary) return null
  const detailed = summary.detailed

  async function write() {
    setBusy(true)
    setError('')
    setProgress('')
    try {
      const { generateDetailedSummary } = await freshImport(() => import('../../lib/ai'))
      const result: DetailedSummary = await generateDetailedSummary(note.content, note.title, settings, (done, total) => {
        if (total > 1) setProgress(`Uzun not ${total} bölümde yazılıyor · ${done}/${total}`)
      })
      const current = latest.current.summary
      if (current) store.updateNote(note.id, { summary: { ...current, detailed: result } })
      store.recordActivity()
      toast(result.failedParts ? 'Ayrıntılı özet hazır (bazı bölümler yazılamadı)' : 'Ayrıntılı özet hazır')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ayrıntılı özet hazırlanamadı.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <article className="full-summary" aria-label="Tam özet">
      <div className="full-summary-bar no-print">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={16} /> Adım adım çalışmaya dön
        </button>
        <button type="button" className="btn btn-sm" onClick={() => window.print()}>
          <Printer size={16} /> Yazdır / PDF
        </button>
      </div>

      <header className="full-summary-head">
        <span className="chip chip-accent">Tam özet</span>
        <h2>{note.title}</h2>
        {(detailed?.intro || summary.overview) && <p className="full-summary-lead">{detailed?.intro || summary.overview}</p>}
      </header>

      {!detailed && (
        <div className="panel full-summary-cta-panel no-print">
          <div>
            <strong>
              <Sparkles size={17} aria-hidden /> Konuyu baştan sona anlatan ayrıntılı özet
            </strong>
            <p className="subtle">
              Yapay zekâ notunu bölüm bölüm açıklasın: ezberlenecekler, nottaki örnekler ve sınavda dikkat edilecekler. Bir kez hazırlanır, notunla saklanır.
            </p>
          </div>
          {ai.ok ? (
            <button type="button" className="btn btn-primary" onClick={write} disabled={busy}>
              {busy ? <Spinner size={16} /> : <Sparkles size={16} />} {busy ? 'Yazılıyor…' : 'Ayrıntılı özet hazırla'}
            </button>
          ) : (
            <AiSignupPrompt reason="Ayrıntılı özet yapay zekâ ile yazılır. Ücretsiz hesap aç ya da giriş yap." />
          )}
          {busy && <p className="subtle">{progress || 'Not okunuyor ve anlatılıyor; uzun notlarda bir dakika sürebilir.'}</p>}
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      {detailed && summary.sourceChanged && (
        <Alert tone="warning">Not bu özetten sonra değişti. Güncel hâli için ayrıntılı özeti yeniden yaz.</Alert>
      )}
      {detailed?.failedParts ? <Alert tone="warning">Uzun notun {detailed.failedParts} bölümü yazılamadı; özet eksik olabilir. Yeniden yazmayı deneyebilirsin.</Alert> : null}

      {detailed && detailed.sections.length > 2 && (
        <nav className="panel full-summary-toc no-print" aria-label="İçindekiler">
          <strong>İçindekiler</strong>
          <ol>
            {detailed.sections.map((s, i) => (
              <li key={i}>
                <a href={`#${anchor(i)}`} onClick={(e) => (e.preventDefault(), document.getElementById(anchor(i))?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}>
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {detailed?.sections.map((section, i) => (
        <section key={i} id={anchor(i)} className="full-summary-section">
          <h3>
            <span className="full-summary-num">{i + 1}</span> {section.heading}
          </h3>
          {section.paragraphs.map((p, j) => (
            <p key={j} className="prose">
              {p}
            </p>
          ))}
          {section.bullets.length > 0 && (
            <ul className="full-summary-bullets">
              {section.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
          {section.example && (
            <div className="full-summary-example">
              <Lightbulb size={16} aria-hidden />
              <p>
                <strong>Örnek: </strong>
                {section.example}
              </p>
            </div>
          )}
        </section>
      ))}

      {detailed && detailed.takeaways.length > 0 && (
        <section className="full-summary-takeaways">
          <h3>
            <TriangleAlert size={17} aria-hidden /> Sınavda dikkat
          </h3>
          <ul>
            {detailed.takeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
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

      <div className="full-summary-foot no-print">
        {detailed && ai.ok && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={write} disabled={busy}>
            {busy ? <Spinner size={15} /> : <RefreshCw size={15} />} {busy ? progress || 'Yeniden yazılıyor…' : 'Ayrıntılı özeti yeniden yaz'}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={onTest}>
          <ListChecks size={16} /> Okudum, teste geç
        </button>
      </div>
    </article>
  )
}
