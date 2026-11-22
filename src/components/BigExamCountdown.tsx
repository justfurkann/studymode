import { CalendarClock, X } from 'lucide-react'
import { useState } from 'react'
import { bigExamCountdown, bigExamFor, bigExamHidden, hideBigExam } from '../lib/bigExams'
import { useEducation } from '../lib/education'

/** Bugün, for lise and ortaokul: "YKS’ye 209 gün". Can be hidden ("benim sınavım değil"). */
export function BigExamCountdown() {
  const education = useEducation()
  const exam = bigExamFor(education?.level)
  const [hidden, setHidden] = useState(() => (exam ? bigExamHidden(exam) : true))
  if (!exam || hidden) return null
  const text = bigExamCountdown(exam)
  if (!text) return null
  return (
    <section className="big-exam" aria-label={`${exam.name} geri sayımı`}>
      <CalendarClock size={22} aria-hidden="true" />
      <div>
        <strong>{text}</strong>
        <span className="subtle">{exam.detail}</span>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={`${exam.name} geri sayımını gizle`}
        title="Bu yıl bu sınava girmiyorsan gizle"
        onClick={() => {
          hideBigExam(exam)
          setHidden(true)
        }}
      >
        <X size={16} />
      </button>
    </section>
  )
}
