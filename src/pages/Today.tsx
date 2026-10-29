import { ArrowRight, Brain, CalendarClock, FileText, Target } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { DEMO_COURSE_NAME, DEMO_NOTE_CONTENT, DEMO_NOTE_TITLE } from '../lib/demo'
import { courseStats, dueCards, examLabel, relativeDate } from '../lib/format'
import { generateLocally } from '../lib/localGenerator'
import { daysUntil } from '../lib/srs'
import { useStore } from '../lib/store'

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
    store.applyGenerated(note.id, generateLocally(DEMO_NOTE_CONTENT), 'local')
    navigate(`/not/${note.id}`)
  }

  if (!data.courses.length) {
    return (
      <div className="page page-narrow">
        <div className="page-header">
          <div>
            <h1>Hoş geldin 👋</h1>
            <p className="muted">Notlarını yükle; özet, test ve tekrar kartlarıyla sınava kadar düzenli çalış.</p>
          </div>
        </div>
        <div className="panel steps">
          <div className="step">
            <span className="step-num">1</span>
            <h3>Dersini oluştur</h3>
            <p className="subtle">Dönemdeki derslerini ve sınav tarihlerini ekle.</p>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <h3>Notunu yükle</h3>
            <p className="subtle">PDF, TXT veya Markdown yükle ya da metni yapıştır.</p>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <h3>Her gün biraz tekrar et</h3>
            <p className="subtle">Uygulama hangi kartı ne zaman tekrar edeceğini hesaplar.</p>
          </div>
        </div>
        <div className="btn-row">
          <Link to="/dersler?yeni=1" className="btn btn-primary btn-lg">
            İlk dersimi oluştur <ArrowRight size={18} />
          </Link>
          <button className="btn btn-lg" onClick={loadDemo}>
            Örnek notla dene
          </button>
        </div>
      </div>
    )
  }

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
          <h1>Bugün</h1>
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
              return (
                <Link key={note.id} to={`/not/${note.id}`} className="list-item">
                  <FileText size={18} style={{ color: course?.color }} />
                  <div className="grow">
                    <div className="title">{note.title}</div>
                    <div className="subtle">
                      {course?.name} · {relativeDate(note.updatedAt, now)}
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
