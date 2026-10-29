import { ArrowLeft, ClipboardList, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExamReview, examFormatLabel } from '../components/ExamReview'
import { Empty, useConfirm, useToast } from '../components/ui'
import { useStore } from '../lib/store'

function durationText(seconds: number | null) {
  if (seconds === null) return 'süresiz'
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `${minutes} dk sürdü`
}

/** A saved mock exam, opened from the course page. */
export function ExamHistory() {
  const { id, examId } = useParams()
  const store = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, confirmation] = useConfirm()
  const course = store.data.courses.find((c) => c.id === id)
  const exam = store.data.exams.find((e) => e.id === examId && e.courseId === id)

  if (!course || !exam) {
    return (
      <div className="page">
        <Empty icon={<ClipboardList size={32} />} title="Sınav bulunamadı">
          <Link to={course ? `/ders/${course.id}` : '/dersler'} className="btn">
            Geri dön
          </Link>
        </Empty>
      </div>
    )
  }

  async function remove() {
    if (!exam || !(await confirm('Bu sınav sonucu silinsin mi?'))) return
    store.deleteExam(exam.id)
    toast('Sınav sonucu silindi')
    navigate(`/ders/${course!.id}`, { replace: true })
  }

  const date = new Date(exam.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="page page-narrow">
      {confirmation}
      <Link to={`/ders/${course.id}`} className="back-link">
        <ArrowLeft size={16} /> {course.name}
      </Link>
      <ExamReview
        title={`Sınav provası · ${date}`}
        questions={exam.questions}
        answers={exam.answers}
        scores={exam.scores}
        feedback={exam.feedback}
        score={exam.score}
        meta={`${examFormatLabel(exam.format, exam.difficulty)} · ${exam.source === 'ai' ? 'Yapay zekâ soruları' : 'Hazır sorular'} · ${durationText(exam.durationSeconds)}`}
        actions={
          <>
            <Link to={`/ders/${course.id}/sinav`} className="btn btn-primary">
              Yeni prova
            </Link>
            <button className="btn btn-ghost btn-danger" onClick={remove}>
              <Trash2 size={16} /> Sil
            </button>
          </>
        }
      />
    </div>
  )
}
