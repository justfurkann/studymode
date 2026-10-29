import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ExamQuestion } from '../lib/types'

const FORMAT_LABELS = { test: 'Test', classic: 'Klasik', mixed: 'Karışık' } as const
const DIFFICULTY_LABELS = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' } as const

export function examFormatLabel(format: keyof typeof FORMAT_LABELS, difficulty: keyof typeof DIFFICULTY_LABELS | null) {
  return difficulty ? `${FORMAT_LABELS[format]} · ${DIFFICULTY_LABELS[difficulty]}` : FORMAT_LABELS[format]
}

export const examPercent = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0)

/** Score summary and per-question review, shared by a just-finished exam and one opened from history. */
export function ExamReview({
  title,
  questions,
  answers,
  scores,
  feedback,
  score,
  meta,
  actions,
}: {
  title: string
  questions: ExamQuestion[]
  answers: Array<number | string | null>
  scores: number[]
  feedback: string[]
  score: number
  meta?: string
  actions?: ReactNode
}) {
  const total = questions.length
  const percent = examPercent(score, total)
  return (
    <>
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <span className="subtle">{title}</span>
        <div className="score">{percent} puan</div>
        <p className="muted">
          {total} sorudan {Number(score.toFixed(1))} doğru karşılık.{' '}
          {percent >= 85 ? 'Bu konulara hazırsın gibi görünüyor.' : percent >= 60 ? 'Fena değil; aşağıdaki eksiklerine odaklan.' : 'Bu konuları biraz daha çalışmalısın. Eksiklerini karta çevirip tekrar et.'}
        </p>
        {meta && <p className="subtle">{meta}</p>}
        {actions && <div className="btn-row">{actions}</div>}
      </div>

      <section className="section">
        <h2>Cevapların</h2>
        {questions.map((q, i) => {
          const value = scores[i] ?? 0
          const good = value >= 0.7
          const answer = answers[i]
          return (
            <div className="panel" key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="section-head">
                <span className="subtle">Soru {i + 1}</span>
                <span className={`chip ${good ? 'chip-success' : value > 0 ? 'chip-warning' : 'chip-danger'}`}>
                  {q.type === 'mcq' ? (good ? 'Doğru' : 'Yanlış') : `${Math.round(value * 100)}/100`}
                </span>
              </div>
              <p style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>{q.prompt}</p>
              {q.type === 'mcq' ? (
                <>
                  {!good && (
                    <p style={{ color: 'var(--danger)', display: 'flex', gap: 8 }}>
                      <X size={18} /> {typeof answer === 'number' ? q.options[answer] : 'Boş bıraktın'}
                    </p>
                  )}
                  <p style={{ color: 'var(--success)', display: 'flex', gap: 8 }}>
                    <Check size={18} /> {q.options[q.answerIndex]}
                  </p>
                  {q.explanation && <p className="muted">{q.explanation}</p>}
                </>
              ) : (
                <>
                  <div className="explain">
                    <strong>Senin cevabın</strong>
                    <p className="prewrap">{(typeof answer === 'string' && answer.trim()) || '—'}</p>
                  </div>
                  {feedback[i] && <p>{feedback[i]}</p>}
                  <div className="explain">
                    <strong>Örnek cevap</strong>
                    <p className="prewrap">{q.modelAnswer}</p>
                  </div>
                </>
              )}
              {q.source && <p className="source">“{q.source}”</p>}
            </div>
          )
        })}
      </section>
    </>
  )
}
