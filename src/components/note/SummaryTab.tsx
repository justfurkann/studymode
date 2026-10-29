import type { Note } from '../../lib/types'

export function SummaryTab({ note }: { note: Note }) {
  const summary = note.summary
  if (!summary) return null

  return (
    <div className="section" style={{ gap: 24 }}>
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
            {summary.keyTerms.map((term) => (
              <div className="term" key={term.term}>
                <strong>{term.term}</strong>
                <p>{term.definition}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {note.generator === 'local' && (
        <p className="subtle">
          Basit mod bu cümleleri notundan seçti; yeni bilgi eklemez. Daha iyi bir özet için yapay zekâ ile yeniden hazırlayabilirsin.
        </p>
      )}
    </div>
  )
}
