import { ArrowRight, BookOpen, Check, ListChecks, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toggleCompletedStep } from '../../lib/learningPath'
import { useStore } from '../../lib/store'
import type { Note, Question, QuizAttempt } from '../../lib/types'
import { Empty, useToast } from '../ui'

const LETTERS = 'ABCDEF'

export function QuizTab({
  note,
  active = true,
  onNext,
  onShowSource,
}: {
  note: Note
  active?: boolean
  /** Goes on to the cards, where mistakes turned into cards are practised. */
  onNext?: () => void
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
  const [retaking, setRetaking] = useState(false)

  const finished = answers.length === questions.length && questions.length > 0
  // A finished test stays visible when the student comes back to the note, until they choose to retake it.
  const lastAttempt = store.data.attempts
    .filter((a) => a.noteId === note.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const showingPast = !finished && !retaking && answers.length === 0 && !!lastAttempt
  const question = questions[index]

  useEffect(() => {
    if (finished || showingPast || !active) return
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
        answers: all,
      })
      // The test measures where the student stands, so finishing it completes the step at any score.
      if (note.summary && !note.summary.completedSteps?.includes('sina')) {
        store.updateNote(note.id, { summary: toggleCompletedStep(note.summary, 'sina', true) })
      }
    } else {
      setIndex(index + 1)
    }
  }

  function restart() {
    setRetaking(true)
    setIndex(0)
    setSelected(null)
    setChecked(false)
    setAnswers([])
    setConverted(false)
  }

  if (finished || showingPast) {
    const past = showingPast ? pastResult(questions, lastAttempt!) : null
    const wrong = past ? past.wrong : questions.map((q, i) => ({ q, given: answers[i] as number | undefined })).filter(({ q, given }) => given !== q.answerIndex)
    const total = past ? lastAttempt!.total : questions.length
    const score = past ? lastAttempt!.score : questions.length - wrong.length
    const ratio = score / total

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


    return (
      <div className="section" style={{ gap: 20 }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span className="subtle">
            {past ? `Son sonucun · ${new Date(lastAttempt!.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}` : 'Sonuç'}
          </span>
          <div className="score">
            {score}/{total}
          </div>
          <p className="muted">
            {ratio === 1
              ? 'Hepsi doğru, harika! 🎉'
              : ratio >= 0.7
                ? 'İyi gidiyorsun. Eksiklerini karta çevir, kartlarla kapat.'
                : 'Eksiklerin belli oldu. Yanlışlarını karta çevir, kartlarla çalış.'}
          </p>
          <div className="btn-row">
            <button className="btn" onClick={restart}>
              <RotateCcw size={16} /> Tekrar çöz
            </button>
            {wrong.length > 0 && (
              <button className="btn" onClick={toCards} disabled={converted}>
                {converted ? 'Kartlara eklendi' : 'Yanlışlarımı karta çevir'}
              </button>
            )}
            {onNext && (
              <button className="btn btn-primary" onClick={onNext}>
                Kartlarla pekiştir <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {past?.outdated && <p className="subtle">Sorular bu testten sonra yeniden hazırlandığı için yanlışların ayrıntısı gösterilemiyor.</p>}
        {wrong.length > 0 && (
          <section className="section">
            <h2>Yanlışların</h2>
            {wrong.map(({ q, given }) => (
              <div className="panel" key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>{q.prompt}</p>
                {given !== undefined && (
                  <p style={{ color: 'var(--danger)', display: 'flex', gap: 8 }}>
                    <X size={18} /> {q.options[given]}
                  </p>
                )}
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
        {index === 0 && !checked && !lastAttempt && <p className="muted">Önce ne bildiğini görelim. Bilmediğin soruda tahmin etme; yanlışlar karta dönüşür.</p>}
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

/**
 * Rebuilds the wrong answers of a saved attempt. Older attempts have no chosen options, and a note
 * regenerated since the attempt has different questions; both still show the score.
 */
export function pastResult(questions: Question[], attempt: QuizAttempt): { wrong: Array<{ q: Question; given: number | undefined }>; outdated: boolean } {
  const wrongIds = new Set(attempt.wrongIds)
  const sameQuestions = questions.length === attempt.total && attempt.wrongIds.every((id) => questions.some((q) => q.id === id))
  if (!sameQuestions) return { wrong: [], outdated: attempt.score < attempt.total }
  const answersMatch = attempt.answers?.length === questions.length
  return {
    wrong: questions
      .map((q, i) => ({ q, given: answersMatch ? attempt.answers![i] : undefined }))
      .filter(({ q }) => wrongIds.has(q.id)),
    outdated: false,
  }
}

/** Local-mode prompts start with an instruction line; keep only the part a card needs. */
function stripPrompt(q: Question) {
  return q.prompt.replace(/^Notlarına göre bu açıklama hangi kavrama ait\?\s*/u, 'Bu açıklama hangi kavrama ait?\n')
}
