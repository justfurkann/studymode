import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ExamFocus } from '../lib/examFocus'

/** "Şimdi bununla başla": the one exam that needs the student most, and the next step for it. */
export function ExamFocusCard({ focus }: { focus: ExamFocus }) {
  return (
    <section className="focus-card" aria-label="Şimdi bununla başla">
      <span className="focus-card-label">
        <span className="course-swatch" style={{ background: focus.course.color }} /> Şimdi bununla başla
      </span>
      <h2>{focus.headline}</h2>
      <p className="muted">{focus.reason}</p>
      {focus.readiness !== null && (
        <div className="progress" role="progressbar" aria-label="Sınava hazırlık" aria-valuenow={focus.readiness} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${Math.max(3, focus.readiness)}%` }} />
        </div>
      )}
      <div>
        <Link to={focus.actionUrl} className="btn btn-primary">
          {focus.actionLabel} <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}
