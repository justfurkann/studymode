import { ArrowRight, BookOpen, Check, ListChecks, PenLine, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toggleCompletedStep } from '../../lib/learningPath'
import { useStore } from '../../lib/store'
import type { LearningStepId, Note, Question } from '../../lib/types'
import { Empty, useToast } from '../ui'

const LETTERS = 'ABCDEF'

export function QuizTab({
  note,
  active = true,
  onGoToStep,
  onShowSource,
}: {
  note: Note
  active?: boolean
  onGoToStep?: (step: LearningStepId) => void
  onShowSource?: (source: string) => void
}) {
  const store = useStore()
  const toast = useToast()
  const questions = note.questions
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])
  const [converted, setConverted] = useState(false)

  const finished = answers.length === questions.length && questions.length > 0
  const question = questions[index]

  useEffect(() => {
    if (finished || !active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return
      const n = LETTERS.indexOf(event.key.toUpperCase())
      if (!checked && n >= 0 && n < (question?.options.length ?? 0)) setSelected(n)
      if (event.key === 'Enter') {
        event.preventDefault()
        if (checked) next()
        else if (selected !== null) setChecked(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!questions.length) {
    return (
      <div className="panel">
        <Empty icon={<ListChecks size={32} />} title="Bu not için soru yok">
          <p>Basit mod bu notta soru çıkaramadı. Yapay zekâ ile yeniden hazırlamayı deneyebilirsin.</p>
        </Empty>
      </div>
    )
  }

  function next() {
    if (selected === null) return
    const all = [...answers, selected]
    setAnswers(all)
    setSelected(null)
    setChecked(false)
    if (all.length === questions.length) {
      const wrong = questions.filter((q, i) => all[i] !== q.answerIndex)
      const score = questions.length - wrong.length
      store.addAttempt({
        courseId: note.courseId,
        noteId: note.id,
        score,
        total: questions.length,
        wrongIds: wrong.map((q) => q.id),
      })
      if (score / questions.length >= 0.7 && note.summary) {
        store.updateNote(note.id, { summary: toggleCompletedStep(note.summary, 'sina', true) })
      }
    } else {
      setIndex(index + 1)
    }
  }

  function restart() {
    setIndex(0)
    setSelected(null)
    setChecked(false)
    setAnswers([])
    setConverted(false)
  }

  if (finished) {
    const wrong = questions.map((q, i) => ({ q, given: answers[i] })).filter(({ q, given }) => given !== q.answerIndex)
    const score = questions.length - wrong.length
    const ratio = score / questions.length

    function toCards() {
      store.addCards(
        wrong.map(({ q }) => ({
          courseId: note.courseId,
          noteId: note.id,
          front: stripPrompt(q),
          back: `${q.options[q.answerIndex]}${q.explanation ? `\n\n${q.explanation}` : ''}`,
          source: q.source,
        })),
      )
      setConverted(true)
      toast(`${wrong.length} kart eklendi`)
    }

    function advanceToStep5() {
      if (note.summary) {
        store.updateNote(note.id, { summary: toggleCompletedStep(note.summary, 'sina', true) })
      }
      onGoToStep?.('anlat')
    }

    return (
      <div className="section" style={{ gap: 20 }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span className="subtle">Sonuç</span>
          <div className="score">
            {score}/{questions.length}
          </div>
          <p className="muted">
            {ratio === 1
              ? 'Hepsi doğru, harika! Şimdi son adımda konuyu kendi cümlelerinle anlatarak ustalığını pekiştir.'
              : ratio >= 0.7
                ? 'İyi gidiyorsun. Yanlışlarına göz atıp 5. adıma geçebilirsin.'
                : 'Bu konuyu biraz daha çalışmalısın. Yanlışlarını karta çevirip tekrar et.'}
          </p>
          <div className="btn-row">
            <button className="btn" onClick={restart}>
              <RotateCcw size={16} /> Tekrar çöz
            </button>
            {wrong.length > 0 && (
              <button className="btn btn-primary" onClick={toCards} disabled={converted}>
                {converted ? 'Kartlara eklendi' : 'Yanlışlarımı karta çevir'}
              </button>
            )}
            {onGoToStep && (
              <button className="btn btn-primary" onClick={advanceToStep5}>
                <PenLine size={16} /> 5. Adıma Geç: Kendi Cümlelerinle Anlat <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {wrong.length > 0 && (
          <section className="section">
            <h2>Yanlışların</h2>
            {wrong.map(({ q, given }) => (
              <div className="panel" key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>{q.prompt}</p>
                <p style={{ color: 'var(--danger)', display: 'flex', gap: 8 }}>
                  <X size={18} /> {q.options[given]}
                </p>
                <p style={{ color: 'var(--success)', display: 'flex', gap: 8 }}>
                  <Check size={18} /> {q.options[q.answerIndex]}
                </p>
                {q.explanation && <p className="muted">{q.explanation}</p>}
                {q.source && (
                  <div className="source-row">
                    <p className="source">“{q.source}”</p>
                    {onShowSource && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onShowSource(q.source!)}>
                        <BookOpen size={14} /> Kaynağında gör
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    )
  }

  const correct = question.answerIndex

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="section-head">
          <span className="subtle">
            Soru {index + 1} / {questions.length}
          </span>
          <span className="subtle">
            <span className="kbd">A–D</span> seç · <span className="kbd">Enter</span> devam
          </span>
        </div>
        <div className="progress" aria-hidden>
          <div style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
      </div>

      <p className="question">{question.prompt}</p>

      <div className="options" role="radiogroup" aria-label="Seçenekler">
        {question.options.map((option, i) => {
          const state = checked ? (i === correct ? 'correct' : i === selected ? 'wrong' : '') : i === selected ? 'selected' : ''
          return (
            <button
              key={i}
              className={`option ${state}`}
              role="radio"
              aria-checked={selected === i}
              disabled={checked}
              onClick={() => setSelected(i)}
            >
              <span className="letter">{LETTERS[i]}</span>
              <span>{option}</span>
            </button>
          )
        })}
      </div>

      {checked && (
        <div className="explain" role="status">
          <strong style={{ color: selected === correct ? 'var(--success)' : 'var(--danger)' }}>
            {selected === correct ? 'Doğru!' : `Yanlış — doğru cevap ${LETTERS[correct]}.`}
          </strong>
          {question.explanation && <p>{question.explanation}</p>}
          {question.source && (
            <div className="source-row">
              <p className="source">“{question.source}”</p>
              {onShowSource && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onShowSource(question.source!)}>
                  <BookOpen size={14} /> Kaynağında gör
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
        {checked ? (
          <button className="btn btn-primary" onClick={next}>
            {index + 1 === questions.length ? 'Sonucu gör' : 'Sonraki soru'}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={selected === null} onClick={() => setChecked(true)}>
            Kontrol et
          </button>
        )}
      </div>
    </div>
  )
}

/** Local-mode prompts start with an instruction line; keep only the part a card needs. */
function stripPrompt(q: Question) {
  return q.prompt.replace(/^Notlarına göre bu açıklama hangi kavrama ait\?\s*/u, 'Bu açıklama hangi kavrama ait?\n')
}
