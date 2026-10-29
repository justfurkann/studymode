import { ArrowLeft, ClipboardList, Clock, RotateCcw, Sparkles, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExamReview } from '../components/ExamReview'
import { Alert, Empty, Spinner, useToast, useConfirm } from '../components/ui'
import type { ExamDifficulty, ExamFormat } from '../lib/ai/tasks'
import { examFromNotes, normalizeExam, scoreExam, type ExamQuestion, type ExamResult } from '../lib/exam'
import { aiAvailability, useSettings } from '../lib/settings'
import { useStore } from '../lib/store'

type Phase = 'setup' | 'preparing' | 'running' | 'grading' | 'result'
type Answer = number | string | null

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

export function Exam() {
  const { id } = useParams()
  const store = useStore()
  const [confirm, confirmation] = useConfirm()
  const settings = useSettings()
  const toast = useToast()
  const ai = aiAvailability(settings, !!store.session)
  const course = store.data.courses.find((c) => c.id === id)
  const notes = useMemo(() => store.data.notes.filter((n) => n.courseId === id), [store.data.notes, id])

  const [phase, setPhase] = useState<Phase>('setup')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(notes.map((n) => n.id)))
  const [useAi, setUseAi] = useState(ai.ok)
  const [format, setFormat] = useState<ExamFormat>('test')
  const [count, setCount] = useState(10)
  const [minutes, setMinutes] = useState(30)
  const [difficulty, setDifficulty] = useState<ExamDifficulty>('medium')
  const [pastQuestions, setPastQuestions] = useState('')
  const [error, setError] = useState('')

  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [converted, setConverted] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const submitted = useRef(false)
  const startedAt = useRef(0)
  const examSource = useRef<'ai' | 'local'>('local')

  const chosen = notes.filter((n) => selected.has(n.id))
  const chosenChars = chosen.reduce((sum, n) => sum + n.content.length, 0)
  const effectiveFormat: ExamFormat = useAi ? format : 'test'

  // Warn before leaving a running exam.
  useEffect(() => {
    if (phase !== 'running') return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [phase])

  useEffect(() => {
    if (phase !== 'running' || !minutes) return
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [phase, minutes])

  useEffect(() => {
    if (phase === 'running' && minutes && secondsLeft === 0) {
      toast('Süre doldu')
      void finish()
    }
    // Runs only when the clock changes; finish() from this render already sees the latest answers.
  }, [secondsLeft])

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
        list = normalizeExam(raw.questions, format, count)
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
    setQuestions(list)
    setAnswers(list.map(() => null))
    setSecondsLeft(minutes * 60)
    setResult(null)
    setConverted(false)
    setSavedId(null)
    submitted.current = false
    startedAt.current = Date.now()
    examSource.current = useAi ? 'ai' : 'local'
    setPhase('running')
    window.scrollTo({ top: 0 })
  }

  async function finish() {
    if (submitted.current) return
    submitted.current = true
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
