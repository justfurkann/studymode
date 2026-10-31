import { ArrowRight, CalendarPlus, ClipboardList, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { examPercent } from '../components/ExamReview'
import { ExamFocusCard } from '../components/ExamFocusCard'
import { SemesterEditor } from '../components/SemesterEditor'
import { useToast } from '../components/ui'
import { examCountdown, examName, examsForCourse, upcomingExams } from '../lib/courseExams'
import { buildIcs, examReadiness, pickExamFocus } from '../lib/examFocus'
import { daysUntil } from '../lib/srs'
import { useStore } from '../lib/store'
import { useLoadDemo } from '../lib/useDemo'

function downloadIcs(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'studymode-sinavlar.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "Sınavlar" tab: the semester's exam calendar, what to start with now, and mock exams per course. */
export function ExamHub() {
  const store = useStore()
  const { data } = store
  const toast = useToast()
  const loadDemo = useLoadDemo()
  const now = new Date()
  const upcoming = upcomingExams(data, now)
  const [editing, setEditing] = useState(() => !data.courses.length || !upcoming.length)
  const focus = pickExamFocus(data, now)

  const past = data.courses
    .flatMap((course) => examsForCourse(data, course.id).map((exam) => ({ exam, course, days: daysUntil(exam.date, now) ?? 0 })))
    .filter((e) => e.days < 0)
    .sort((a, b) => b.exam.date.localeCompare(a.exam.date))
  const withoutExam = data.courses.filter((c) => !examsForCourse(data, c.id).length)

  const rows = data.courses
    .map((course) => {
      const next = upcoming.find((e) => e.course.id === course.id)?.exam ?? null
      const last = data.exams.filter((e) => e.courseId === course.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
      const notes = data.notes.filter((n) => n.courseId === course.id).length
      return { course, next, last, notes, days: next ? (daysUntil(next.date, now) ?? Infinity) : Infinity }
    })
    // Courses with the nearest exam first.
    .sort((a, b) => a.days - b.days || a.course.name.localeCompare(b.course.name, 'tr'))

  function exportCalendar() {
    downloadIcs(buildIcs(upcoming, now))
    toast('Takvim dosyası indirildi. Açınca telefonun takvimine eklenir.')
  }

  return (
    <div className="page page-narrow exams-page">
      <div className="page-header">
        <div>
          <h1>Sınavlar</h1>
          <p className="muted">Bütün sınav tarihlerin bir arada. Hangisine önce çalışacağını biz söyleyelim.</p>
        </div>
        {!editing && (
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              <Plus size={16} /> Sınav ekle
            </button>
          </div>
        )}
      </div>

      {editing && <SemesterEditor onDone={() => setEditing(false)} />}

      {!editing && focus && <ExamFocusCard focus={focus} />}

      {upcoming.length > 0 && (
        <section className="section" aria-label="Sınav takvimi">
          <div className="section-head">
            <h2>Takvim</h2>
            <button className="btn btn-sm" onClick={exportCalendar}>
              <CalendarPlus size={15} /> Telefon takvimine ekle
            </button>
          </div>
          <div className="panel panel-tight list">
            {upcoming.map(({ exam, course }) => {
              const countdown = examCountdown(exam, now)!
              const readiness = examReadiness(data, exam)
              const d = new Date(`${exam.date}T12:00:00`)
              return (
                <Link key={exam.id} to={`/ders/${course.id}`} className="list-item exam-cal-row" aria-label={`${course.name} ${examName(exam)}, ${countdown.text}`}>
                  <span className={`exam-date ${countdown.days <= 3 ? 'is-soon' : ''}`} aria-hidden="true">
                    <strong>{d.getDate()}</strong>
                    <span>{d.toLocaleDateString('tr-TR', { month: 'short' })}</span>
                  </span>
                  <div className="grow">
                    <div className="title">
                      <span className="course-swatch" style={{ background: course.color, width: 8, height: 8 }} /> {course.name} · {examName(exam)}
                    </div>
                    <div className="subtle">
                      {d.toLocaleDateString('tr-TR', { weekday: 'long' })}
                      {exam.weight != null ? ` · Ağırlık %${exam.weight}` : ''}
                      {readiness === null ? ' · Henüz not yok' : ` · Hazırlık %${readiness}`}
                    </div>
                  </div>
                  <span className={`chip ${countdown.tone === 'neutral' ? '' : `chip-${countdown.tone}`}`}>{countdown.text}</span>
                </Link>
              )
            })}
          </div>
          <p className="subtle">Takvim dosyasını açınca sınavlar telefonunun takvimine eklenir; bir gün önceden hatırlatılır.</p>
        </section>
      )}

      {!editing && withoutExam.length > 0 && (
        <p className="subtle">
          Sınav tarihi girilmemiş: {withoutExam.map((c) => c.name).join(', ')}.{' '}
          <button className="link-button" onClick={() => setEditing(true)}>
            Tarih ekle
          </button>
        </p>
      )}

      {past.length > 0 && (
        <details className="exam-past">
          <summary>Geçmiş sınavlar ({past.length})</summary>
          <div className="list">
            {past.map(({ exam, course }) => (
              <Link key={exam.id} to={`/ders/${course.id}`} className="list-item">
                <div className="grow">
                  <div className="title">
                    {course.name} · {examName(exam)}
                  </div>
                  <div className="subtle">{new Date(`${exam.date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
              </Link>
            ))}
          </div>
        </details>
      )}

      <section className="section" aria-label="Sınav provası">
        <div className="section-head">
          <div>
            <h2>Sınav provası</h2>
            <span className="subtle">Bir ders seç, sınavın nasıl olacağını anlat; ona benzer bir deneme sınavı hazırlayalım.</span>
          </div>
        </div>
        {!rows.length ? (
          <div className="panel">
            <p className="muted">Prova için önce bir ders ve not lazım. Notlarından sorular çıkarıp gerçek sınava benzer bir deneme hazırlarız.</p>
            <div className="btn-row">
              <Link to="/not-ekle" className="btn btn-sm">
                <ClipboardList size={15} /> Not ekle
              </Link>
              <button className="btn btn-sm" onClick={loadDemo}>
                Örnek notla dene
              </button>
            </div>
          </div>
        ) : (
          <div className="exam-hub">
            {rows.map(({ course, next, last, notes }) => {
              const countdown = next ? examCountdown(next, now) : null
              const target = `/ders/${course.id}/sinav${next ? `?sinav=${next.id}` : ''}`
              return (
                <Link key={course.id} to={target} className="exam-hub-row" aria-label={`${course.name} için prova hazırla`}>
                  <span className="course-swatch" style={{ background: course.color }} />
                  <div className="grow">
                    <div className="title">{course.name}</div>
                    <div className="subtle">
                      {notes ? `${notes} not` : 'Henüz not yok'}
                      {next ? ` · ${examName(next)}` : ''}
                      {last ? ` · Son prova: ${examPercent(last.score, last.total)} puan` : ' · Henüz prova yok'}
                    </div>
                  </div>
                  {countdown && <span className={`chip ${countdown.tone === 'neutral' ? '' : `chip-${countdown.tone}`}`}>{countdown.text}</span>}
                  <ArrowRight size={18} className="muted" />
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
