import { ArrowLeft, ClipboardList, Clock, RotateCcw, Sparkles, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AiSignupPrompt } from '../components/AiSignupPrompt'
import { ExamReview } from '../components/ExamReview'
import { Alert, Empty, Spinner, useToast, useConfirm } from '../components/ui'
import type { ExamDifficulty, ExamFormat } from '../lib/ai/tasks'
import { examCountdown, examName, examsForCourse } from '../lib/courseExams'
import { examFromNotes, normalizeExam, noteForSource, scoreExam, type ExamQuestion, type ExamResult } from '../lib/exam'
import { aiAvailability, useSettings } from '../lib/settings'
import { clearActiveExam, loadActiveExam, saveActiveExam, secondsRemaining, type ActiveExamDraft, type ExamAnswer } from '../lib/examSession'
import { daysUntil } from '../lib/srs'
import { useStore } from '../lib/store'

type Phase = 'setup' | 'preparing' | 'running' | 'grading' | 'result'
type Answer = ExamAnswer

const LETTERS = 'ABCDEF'
const COUNTS = [5, 10, 15, 20, 30]
const DURATIONS = [0, 15, 30, 45, 60, 90]
const FORMATS: Array<{ id: ExamFormat; label: string }> = [
  { id: 'test', label: 'Test' },
  { id: 'classic', label: 'Klasik' },
  { id: 'mixed', label: 'Karışık' },
]
const DIFFICULTIES: Array<{ id: ExamDifficulty; label: string }> = [
  { id: 'easy', label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard', label: 'Zor' },
]
/** Rough guard so one request stays well under model and server limits. */
const MAX_NOTE_CHARS = 600_000

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** sessionStorage can throw when the browser blocks site data; the exam then just isn't kept on reload. */
const session = (() => {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage
  } catch {
    return undefined
  }
})()

export function Exam() {
  const { id } = useParams()
  const store = useStore()
  const [confirm, confirmation] = useConfirm()
  const settings = useSettings()
  const toast = useToast()
  const ai = aiAvailability(settings, !!store.session)
  const course = store.data.courses.find((c) => c.id === id)
  const notes = useMemo(() => store.data.notes.filter((n) => n.courseId === id), [store.data.notes, id])

  const initialDraft = useMemo(() => loadActiveExam(session, id), [id])
  const [params] = useSearchParams()
  const upcoming = examsForCourse(store.data, id ?? '').filter((e) => (daysUntil(e.date) ?? -1) >= 0)
  /** Notes an exam covers; an exam without a list covers the whole course. */
  const notesFor = (examId: string) => {
    const exam = upcoming.find((e) => e.id === examId)
    const scoped = exam?.noteIds.filter((noteId) => notes.some((n) => n.id === noteId)) ?? []
    return scoped.length ? scoped : notes.map((n) => n.id)
  }
  // The exam picked on the course page (?sinav=…), else the nearest one.
  const [targetExam, setTargetExam] = useState(() => {
    const requested = params.get('sinav')
    return upcoming.find((e) => e.id === requested)?.id ?? upcoming[0]?.id ?? ''
  })

  const [phase, setPhase] = useState<Phase>(() => (initialDraft ? 'running' : 'setup'))
  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(initialDraft?.noteIds?.length ? initialDraft.noteIds : notesFor(targetExam)),
  )
  const [useAi, setUseAi] = useState(() => initialDraft?.useAi ?? ai.ok)
  const [format, setFormat] = useState<ExamFormat>(() => initialDraft?.format ?? 'test')
  const [count, setCount] = useState(10)
  const [minutes, setMinutes] = useState(() => initialDraft?.minutes ?? 30)
  const [difficulty, setDifficulty] = useState<ExamDifficulty>(() => initialDraft?.difficulty ?? 'medium')
  const [pastQuestions, setPastQuestions] = useState('')
  const [error, setError] = useState('')

  const [questions, setQuestions] = useState<ExamQuestion[]>(() => initialDraft?.questions ?? [])
  const [answers, setAnswers] = useState<Answer[]>(() => initialDraft?.answers ?? [])
  const [endsAt, setEndsAt] = useState<number | null>(() => initialDraft?.endsAt ?? null)
  const [secondsLeft, setSecondsLeft] = useState(() =>
    secondsRemaining(initialDraft?.endsAt ?? null) ?? 0,
  )
  const [result, setResult] = useState<ExamResult | null>(null)
  const [converted, setConverted] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const submitted = useRef(false)
  const startedAt = useRef(initialDraft?.startedAt ?? 0)
  const examSource = useRef<'ai' | 'local'>(initialDraft?.examSource ?? 'local')

  const chosen = notes.filter((n) => selected.has(n.id))
  const chosenChars = chosen.reduce((sum, n) => sum + n.content.length, 0)
  const effectiveFormat: ExamFormat = useAi ? format : 'test'

  // Persist running exam state in sessionStorage so accidental page reload does not lose answers.
  useEffect(() => {
    // Never write back an exam that has been submitted (effects can re-run after finish() cleared it).
    if (!id || phase !== 'running' || !questions.length || submitted.current) return
    {
      const draft: ActiveExamDraft = {
        questions,
        answers,
        endsAt,
        minutes,
        startedAt: startedAt.current,
        examSource: examSource.current,
        format,
        difficulty,
        useAi,
        noteIds: [...selected],
      }
      saveActiveExam(session, id, draft)
    }
  }, [id, phase, questions, answers, endsAt, minutes, format, difficulty, useAi, selected])

  // Warn before leaving a running exam.
  useEffect(() => {
    if (phase !== 'running') return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [phase])

  // Wall-clock Date.now() timer so background tab throttling never drifts the countdown.
  useEffect(() => {
    if (phase !== 'running' || !minutes || !endsAt) return
    const syncClock = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    syncClock()
    const timer = window.setInterval(syncClock, 500)
    window.addEventListener('visibilitychange', syncClock)
    window.addEventListener('focus', syncClock)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('visibilitychange', syncClock)
      window.removeEventListener('focus', syncClock)
    }
  }, [phase, minutes, endsAt])

  useEffect(() => {
    if (phase === 'running' && minutes && endsAt && secondsLeft === 0) {
      toast('Süre doldu')
      void finish()
    }
    // Runs only when the clock reaches 0; finish() from this render already sees the latest answers.
  }, [secondsLeft, phase, minutes, endsAt])

  if (!course) {
    return (
      <div className="page">
        <Empty icon={<ClipboardList size={32} />} title="Ders bulunamadı">
          <Link to="/dersler" className="btn">
            Derslere dön
          </Link>
        </Empty>
      </div>
    )
  }

  async function start() {
    setError('')
    if (!chosen.length) return setError('En az bir not seç.')
    let list: ExamQuestion[]
    if (useAi) {
      if (chosenChars > MAX_NOTE_CHARS) return setError('Seçtiğin notlar tek bir sınav için çok uzun. Daha az not seç.')
      setPhase('preparing')
      try {
        const { generateExam } = await import('../lib/ai')
        const raw = await generateExam(
          { courseName: course!.name, notes: chosen.map((n) => ({ title: n.title, text: n.content })), format, count, difficulty, pastQuestions },
          settings,
        )
        list = normalizeExam(raw.questions, format, count).map((q) => {
          const note = chosen.length === 1 ? chosen[0] : noteForSource(chosen, q.source)
          return { ...q, noteId: note?.id ?? null, noteTitle: note?.title ?? null }
        })
      } catch (e) {
        setPhase('setup')
        return setError(e instanceof Error ? e.message : 'Sınav hazırlanamadı.')
      }
      if (!list.length) {
        setPhase('setup')
        return setError('Bu notlardan sınav sorusu çıkarılamadı. Başka notlar seçip tekrar dene.')
      }
    } else {
      list = examFromNotes(chosen, count)
      if (!list.length) return setError('Seçtiğin notlarda hazır test sorusu yok. Notları yapay zekâ ile hazırla ya da yapay zekâ ile sınav oluştur.')
      if (list.length < count) toast(`Seçtiğin notlarda ${list.length} hazır soru vardı; sınav ${list.length} sorudan oluşuyor.`)
    }
    const nowMs = Date.now()
    const nextEndsAt = minutes > 0 ? nowMs + minutes * 60 * 1000 : null
    setQuestions(list)
    setAnswers(list.map(() => null))
    setEndsAt(nextEndsAt)
    setSecondsLeft(minutes * 60)
    setResult(null)
    setConverted(false)
    setSavedId(null)
    submitted.current = false
    startedAt.current = nowMs
    examSource.current = useAi ? 'ai' : 'local'
    setPhase('running')
    window.scrollTo({ top: 0 })
  }

  async function finish() {
    if (submitted.current) return
    submitted.current = true
    clearActiveExam(session, course?.id)
    const openToGrade = questions
      .map((q, i) => ({ q, i, answer: answers[i] }))
      .filter(({ q, answer }) => q.type === 'open' && typeof answer === 'string' && answer.trim())
    const graded = new Map<number, { score: number; feedback: string }>()
    if (openToGrade.length) {
      setPhase('grading')
      try {
        const { gradeAnswers } = await import('../lib/ai')
        const results = await gradeAnswers(
          { items: openToGrade.map(({ q, answer }) => ({ question: q.prompt, modelAnswer: q.modelAnswer, criteria: q.explanation, answer: String(answer) })) },
          settings,
        )
        openToGrade.forEach(({ i }, k) => graded.set(i, results[k]))
      } catch (e) {
        setError(`Klasik cevaplar puanlanamadı: ${e instanceof Error ? e.message : 'bilinmeyen hata'}. Örnek cevaplarla kendin karşılaştırabilirsin.`)
        openToGrade.forEach(({ i }) => graded.set(i, { score: 0, feedback: 'Puanlanamadı — örnek cevapla karşılaştır.' }))
      }
    }
    const scored = scoreExam(questions, answers, graded)
    setResult(scored)
    // Keep the exam so it can be reviewed later and progress can be tracked per course.
    const record = store.addExam({
      courseId: course!.id,
      format: effectiveFormat,
      difficulty: examSource.current === 'ai' ? difficulty : null,
      source: examSource.current,
      noteIds: chosen.map((n) => n.id),
      questions,
      answers,
      scores: scored.scores,
      feedback: scored.feedback,
      score: scored.total,
      total: questions.length,
      durationSeconds: minutes ? Math.round((Date.now() - startedAt.current) / 1000) : null,
    })
    setSavedId(record.id)
    setPhase('result')
    window.scrollTo({ top: 0 })
  }

  async function confirmFinish() {
    const empty = answers.filter((a) => a === null || (typeof a === 'string' && !a.trim())).length
    if (empty && !await confirm(`${empty} soru boş. Yine de sınavı bitirmek istiyor musun?`)) return
    void finish()
  }

  function toCards() {
    if (!result) return
    const weak = questions.filter((_, i) => result.scores[i] < 0.7)
    store.addCards(
      weak.map((q) => ({
        courseId: course!.id,
        noteId: null,
        front: q.prompt,
        back: q.type === 'mcq' ? `${q.options[q.answerIndex]}${q.explanation ? `\n\n${q.explanation}` : ''}` : q.modelAnswer,
        source: q.source,
      })),
    )
    setConverted(true)
    toast(`${weak.length} kart eklendi`)
  }

  const header = (
    <>{confirmation}<Link to={`/ders/${course.id}`} className="back-link">
      <ArrowLeft size={16} /> {course.name}
    </Link></>
  )

  // ---------- Setup ----------
  if (phase === 'setup' || phase === 'preparing') {
    const busy = phase === 'preparing'
    return (
      <div className="page page-narrow">
        {header}
        <div className="page-header">
          <div>
            <h1>Sınav provası</h1>
            <p className="muted">Sınavın nasıl olacağını söyle, ona benzer bir deneme hazırlayalım.</p>
          </div>
        </div>

        {!notes.length ? (
          <div className="panel">
            <Empty icon={<ClipboardList size={32} />} title="Bu derste henüz not yok">
              <Link to={`/not-ekle?ders=${course.id}`} className="btn btn-primary">
                Not ekle
              </Link>
            </Empty>
          </div>
        ) : (
          <div className="form">
            {upcoming.length > 0 && (
              <label className="field">
                <span>Hangi sınava hazırlanıyorsun?</span>
                <select
                  className="select"
                  value={targetExam}
                  disabled={busy}
                  onChange={(e) => {
                    setTargetExam(e.target.value)
                    if (e.target.value) setSelected(new Set(notesFor(e.target.value)))
                  }}
                >
                  {upcoming.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {examCountdown(exam)?.text ?? examName(exam)}
                    </option>
                  ))}
                  <option value="">Belirli bir sınav değil</option>
                </select>
              </label>
            )}
            <div className="field">
              <span>Sınava hangi konular dahil?</span>
              <div className="panel panel-tight list">
                {notes.map((n) => (
                  <label key={n.id} className="list-item" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(n.id)}
                      disabled={busy}
                      onChange={(e) => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(n.id)
                        else next.delete(n.id)
                        setSelected(next)
                      }}
                    />
                    <span className="grow title">{n.title}</span>
                    <span className="subtle">{n.questions.length} hazır soru</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <span>Sorular nereden gelsin?</span>
              <div className="choice-grid">
                <button type="button" className="choice" aria-pressed={useAi} onClick={() => setUseAi(true)} disabled={!ai.ok || busy}>
                  <strong>
                    <Sparkles size={17} /> Yapay zekâ yeni sorular yazsın
                  </strong>
                  <span className="subtle">{ai.ok ? `${ai.label} · Test, klasik veya karışık; zorluk ve hocanın tarzına göre.` : ai.reason}</span>
                </button>
                <button type="button" className="choice" aria-pressed={!useAi} onClick={() => setUseAi(false)} disabled={busy}>
                  <strong>
                    <Wand2 size={17} /> Hazır sorulardan karıştır
                  </strong>
                  <span className="subtle">Notlarının test sorularından karışık bir deneme. Yalnızca test; yapay zekâ gerekmez.</span>
                </button>
              </div>
              <AiSignupPrompt reason="Yapay zekâ hocanın tarzına benzer test ve klasik sorular yazsın, cevaplarını puanlasın." />
            </div>

            {useAi && (
              <>
                <div className="field">
                  <span>Sınav türü</span>
                  <div className="segmented" role="group" aria-label="Sınav türü">
                    {FORMATS.map((f) => (
                      <button type="button" key={f.id} aria-pressed={format === f.id} onClick={() => setFormat(f.id)} disabled={busy}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span>Zorluk</span>
                  <div className="segmented" role="group" aria-label="Zorluk">
                    {DIFFICULTIES.map((d) => (
                      <button type="button" key={d.id} aria-pressed={difficulty === d.id} onClick={() => setDifficulty(d.id)} disabled={busy}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="form-row">
              <label className="field">
                <span>Soru sayısı</span>
                <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={busy}>
                  {COUNTS.map((c) => (
                    <option key={c} value={c}>
                      {c} soru
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Süre</span>
                <select className="select" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} disabled={busy}>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d ? `${d} dakika` : 'Süre yok'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {useAi && (
              <label className="field">
                <span>Hocanın geçmiş sınav soruları (isteğe bağlı)</span>
                <textarea
                  className="textarea"
                  style={{ minHeight: 120 }}
                  value={pastQuestions}
                  onChange={(e) => setPastQuestions(e.target.value)}
                  placeholder="Eski sınavlardan birkaç soru yapıştır; yapay zekâ hocanın soru tarzını taklit eder."
                  disabled={busy}
                />
              </label>
            )}

            {error && <Alert tone="danger">{error}</Alert>}

            <div className="btn-row">
              <button className="btn btn-primary btn-lg" onClick={start} disabled={busy || !chosen.length}>
                {busy ? (
                  <>
                    <Spinner /> Sınav hazırlanıyor… (1-2 dk sürebilir)
                  </>
                ) : (
                  'Sınavı başlat'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- Running ----------
  if (phase === 'running' || phase === 'grading') {
    const answered = answers.filter((a) => a !== null && !(typeof a === 'string' && !a.trim())).length
    const grading = phase === 'grading'
    return (
      <div className="page page-narrow">{confirmation}
        <div className="exam-bar">
          <span>
            <strong>{course.name}</strong> · {answered}/{questions.length} cevaplandı
          </span>
          {minutes > 0 && (
            <span className={`chip ${secondsLeft < 60 ? 'chip-danger' : secondsLeft < 300 ? 'chip-warning' : ''}`} aria-label="Kalan süre">
              <Clock size={14} /> {formatTime(secondsLeft)}
            </span>
          )}
        </div>

        {questions.map((q, i) => (
          <section className="panel" key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-label={`Soru ${i + 1}`}>
            <span className="subtle">
              Soru {i + 1} · {q.type === 'mcq' ? 'Test' : 'Klasik'}
              {q.noteTitle ? ` · ${q.noteTitle}` : ''}
            </span>
            <p className="question">{q.prompt}</p>
            {q.type === 'mcq' ? (
              <div className="options" role="radiogroup" aria-label={`Soru ${i + 1} seçenekleri`}>
                {q.options.map((option, k) => (
                  <button
                    key={k}
                    className={`option ${answers[i] === k ? 'selected' : ''}`}
                    role="radio"
                    aria-checked={answers[i] === k}
                    disabled={grading}
                    onClick={() => setAnswers(answers.map((a, j) => (j === i ? k : a)))}
                  >
                    <span className="letter">{LETTERS[k]}</span>
                    <span>{option}</span>
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                className="textarea"
                style={{ minHeight: 140 }}
                aria-label={`Soru ${i + 1} cevabın`}
                value={(answers[i] as string | null) ?? ''}
                disabled={grading}
                onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                placeholder="Cevabını yaz…"
              />
            )}
          </section>
        ))}

        <div className="btn-row">
          <button className="btn btn-primary btn-lg" onClick={confirmFinish} disabled={grading}>
            {grading ? (
              <>
                <Spinner /> Klasik cevapların puanlanıyor…
              </>
            ) : (
              'Sınavı bitir'
            )}
          </button>
        </div>
      </div>
    )
  }

  // ---------- Result ----------
  return (
    <div className="page page-narrow">
      {header}
      {error && <Alert tone="warning">{error}</Alert>}
      <ExamReview
        title="Sınav sonucu"
        questions={questions}
        answers={answers}
        scores={result?.scores ?? []}
        feedback={result?.feedback ?? []}
        score={result?.total ?? 0}
        notes={notes}
        meta={savedId ? 'Sonuç kaydedildi; ders sayfasındaki sınav geçmişinden tekrar açabilirsin.' : undefined}
        actions={
          <>
            <button className="btn" onClick={() => setPhase('setup')}>
              <RotateCcw size={16} /> Yeni prova
            </button>
            {result && result.scores.some((s) => s < 0.7) && (
              <button className="btn btn-primary" onClick={toCards} disabled={converted}>
                {converted ? 'Kartlara eklendi' : 'Eksiklerimi karta çevir'}
              </button>
            )}
          </>
        }
      />
    </div>
  )
}
