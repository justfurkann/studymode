import { ArrowRight, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { examPercent } from '../components/ExamReview'
import { Empty } from '../components/ui'
import { examCountdown, examName, examsForCourse } from '../lib/courseExams'
import { daysUntil } from '../lib/srs'
import { useStore } from '../lib/store'
import { useLoadDemo } from '../lib/useDemo'

/** "Sınav provası" tab: pick a course, then describe its exam and get a practice run. */
export function ExamHub() {
  const { data } = useStore()
  const loadDemo = useLoadDemo()
  const now = new Date()

  const rows = data.courses
    .map((course) => {
      const next = examsForCourse(data, course.id).find((e) => (daysUntil(e.date, now) ?? -1) >= 0) ?? null
      const last = data.exams.filter((e) => e.courseId === course.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
      const notes = data.notes.filter((n) => n.courseId === course.id).length
      return { course, next, last, notes, days: next ? (daysUntil(next.date, now) ?? Infinity) : Infinity }
    })
    // Courses with the nearest exam first.
    .sort((a, b) => a.days - b.days || a.course.name.localeCompare(b.course.name, 'tr'))

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <h1>Sınav provası</h1>
          <p className="muted">Bir ders seç, sınavın nasıl olacağını anlat; ona benzer bir deneme sınavı hazırlayalım.</p>
        </div>
      </div>

      {!rows.length ? (
        <div className="panel">
          <Empty icon={<ClipboardList size={32} />} title="Prova için önce bir ders ve not lazım">
            <p className="muted">Notlarından sorular çıkarıp gerçek sınava benzer bir deneme hazırlarız.</p>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <Link to="/not-ekle" className="btn btn-primary">
                Not ekle
              </Link>
              <button className="btn" onClick={loadDemo}>
                Örnek notla dene
              </button>
            </div>
          </Empty>
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
    </div>
  )
}
