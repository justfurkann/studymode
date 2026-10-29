import { ArrowRight, Brain, CalendarClock, Compass, FileText, Target } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Welcome } from '../components/Welcome'
import { firstName } from '../lib/auth'
import { createDemoSet, DEMO_COURSE_NAME, DEMO_NOTE_CONTENT, DEMO_NOTE_TITLE } from '../lib/demo'
import { courseStats, dueCards, examLabel, relativeDate } from '../lib/format'
import { computeNoteProgress } from '../lib/learningPath'
import { daysUntil } from '../lib/srs'
import { useStore } from '../lib/store'
import type { LearningStepId, Note } from '../lib/types'

function stepUrl(note: Note, stepId: LearningStepId): string {
  if (stepId === 'tanis' || stepId === 'anla') return `/not/${note.id}?adim=${stepId}`
  if (stepId === 'pekistir') return `/not/${note.id}?sekme=kartlar`
  if (stepId === 'sina') return `/not/${note.id}?sekme=test`
  return `/not/${note.id}?sekme=uygula`
}

export function Today() {
  const store = useStore()
  const { data } = store
  const navigate = useNavigate()
  const now = new Date()
  const due = dueCards(data.cards, now)
  const dateText = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })

  function loadDemo() {
    const course = store.addCourse({ name: DEMO_COURSE_NAME })
    const note = store.addNote({ courseId: course.id, title: DEMO_NOTE_TITLE, content: DEMO_NOTE_CONTENT })
    store.applyGenerated(note.id, createDemoSet(), 'local')
    navigate(`/not/${note.id}`)
  }

  if (!data.courses.length) return <Welcome onDemo={loadDemo} />

  const exams = data.courses
    .map((course) => ({ course, days: daysUntil(course.examDate, now), stats: courseStats(data, course, now) }))
    .filter((e): e is typeof e & { days: number } => e.days !== null && e.days >= 0)
    .sort((a, b) => a.days - b.days)

  const latestAttempt = new Map<string, (typeof data.attempts)[number]>()
  for (const attempt of data.attempts) {
    const prev = latestAttempt.get(attempt.noteId)
    if (!prev || prev.createdAt < attempt.createdAt) latestAttempt.set(attempt.noteId, attempt)
  }
  const weak = [...latestAttempt.values()]
    .filter((a) => a.score / a.total < 0.7)
    .map((a) => ({ attempt: a, note: data.notes.find((n) => n.id === a.noteId) }))
    .filter((w) => w.note)
    .slice(0, 4)

  const recent = [...data.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  const courseOf = (id: string) => data.courses.find((c) => c.id === id)

  const inProgressNotes = [...data.notes]
    .filter((n) => n.generator !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((note) => ({ note, progress: computeNoteProgress(note, data.cards, data.attempts) }))
    .filter(({ progress }) => !progress.isCompleted)
    .slice(0, 3)

  const nextDue = data.cards
    .filter((c) => Date.parse(c.due) > now.getTime())
    .sort((a, b) => a.due.localeCompare(b.due))[0]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="subtle" style={{ textTransform: 'capitalize' }}>
            {dateText}
          </p>
          <h1>{firstName(store.session?.user) ? `Merhaba ${firstName(store.session?.user)}` : 'Bugün'}</h1>
        </div>
      </div>

      {due.length > 0 ? (
        <section className="hero" aria-label="Tekrar">
          <div>
            <div className="count">{due.length}</div>
            <p>kart bugün tekrar bekliyor · yaklaşık {Math.max(1, Math.round(due.length * 0.25))} dk</p>
          </div>
          <Link to="/tekrar" className="btn btn-lg">
            <Brain size={18} /> Tekrara başla
          </Link>
        </section>
      ) : (
        <section className="hero done" aria-label="Tekrar">
          <div>
            <h2>{data.cards.length ? 'Bugünlük tekrarların bitti 🎉' : 'Henüz tekrar kartın yok'}</h2>
            <p>
              {data.cards.length
                ? nextDue
                  ? `Sıradaki kart ${new Date(nextDue.due).toLocaleString('tr-TR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })} zamanında gelecek.`
                  : 'Yeni not ekleyerek devam edebilirsin.'
                : 'Bir not ekleyip çalışma seti oluşturduğunda kartlar burada görünür.'}
            </p>
          </div>
          <Link to="/not-ekle" className="btn">
            Not ekle
          </Link>
        </section>
      )}

      {inProgressNotes.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Adım adım öğrenmeye devam et</h2>
            <span className="subtle">Sıfırdan 5 adımda konuyu tamamla</span>
          </div>
          <div className="panel panel-tight list">
            {inProgressNotes.map(({ note, progress }) => {
              const course = courseOf(note.courseId)
              const target = stepUrl(note, progress.currentStep.id)
              return (
                <Link key={note.id} to={target} className="list-item">
                  <Compass size={18} style={{ color: course?.color ?? 'var(--accent)' }} />
                  <div className="grow">
                    <div className="title">{note.title}</div>
                    <div className="subtle">
                      {course?.name} · Sıradaki: {progress.currentStep.stepNumber}. Adım ({progress.currentStep.title})
                    </div>
                  </div>
                  <span className="chip chip-accent">
                    {progress.completedCount}/{progress.totalSteps} adım
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {exams.length > 0 && (
        <section className="section">
          <h2>Yaklaşan sınavlar</h2>
          <div className="panel panel-tight list">
            {exams.map(({ course, stats }) => {
              const label = examLabel(course.examDate, now)!
              return (
                <Link key={course.id} to={`/ders/${course.id}`} className="list-item">
                  <CalendarClock size={18} style={{ color: course.color }} />
                  <div className="grow">
                    <div className="title">{course.name}</div>
                    <div className="subtle">
                      {stats.notes} not · {stats.due ? `${stats.due} kart tekrar bekliyor` : 'tekrarlar güncel'}
                    </div>
                  </div>
                  <span className={`chip ${label.tone === 'neutral' ? '' : `chip-${label.tone}`}`}>{label.text}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {weak.length > 0 && (
        <section className="section">
          <h2>Tekrar çalışman gereken konular</h2>
          <div className="panel panel-tight list">
            {weak.map(({ attempt, note }) => (
              <Link key={attempt.id} to={`/not/${note!.id}?sekme=test`} className="list-item">
                <Target size={18} style={{ color: 'var(--warning)' }} />
                <div className="grow">
                  <div className="title">{note!.title}</div>
                  <div className="subtle">{courseOf(note!.courseId)?.name}</div>
                </div>
                <span className="chip chip-warning">
                  Son test {attempt.score}/{attempt.total}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Son notlar</h2>
          <Link to="/dersler" className="btn btn-ghost btn-sm">
            Tüm dersler
          </Link>
        </div>
        {recent.length ? (
          <div className="panel panel-tight list">
            {recent.map((note) => {
              const course = courseOf(note.courseId)
              const progress = note.generator ? computeNoteProgress(note, data.cards, data.attempts) : null
              return (
                <Link key={note.id} to={`/not/${note.id}`} className="list-item">
                  <FileText size={18} style={{ color: course?.color }} />
                  <div className="grow">
                    <div className="title">{note.title}</div>
                    <div className="subtle">
                      {course?.name} · {relativeDate(note.updatedAt, now)}
                      {progress ? ` · %${progress.percent} tamamlandı` : ''}
                    </div>
                  </div>
                  <ArrowRight size={16} className="muted" />
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="panel">
            <p className="muted">
              Henüz not yok. <Link to="/not-ekle" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>İlk notunu ekle</Link>
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
