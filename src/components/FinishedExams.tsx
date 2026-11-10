import { ArrowRight, Check, Pencil, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { examDateText, examDrafts, examName, examsAwaitingGrade, examsForCourse, gradeText, hasGrade, nextExamToAdd, parseGrade } from '../lib/courseExams'
import { gradeKey, hideExamAsks, nextKey, useHiddenExamAsks } from '../lib/hiddenExams'
import { useStore } from '../lib/store'
import type { Course, CourseExam, CourseExamKind, StudyData } from '../lib/types'
import { useToast } from './ui'

const NEXT_LABEL: Partial<Record<CourseExamKind, string>> = { final: 'Final' }
const nextLabel = (kind: CourseExamKind) => NEXT_LABEL[kind] ?? 'Sınav'

/** Date and optional time for the course's next exam (the final after a midterm). */
function NextExamForm({ course, kind, onDone }: { course: Course; kind: CourseExamKind; onDone: () => void }) {
  const store = useStore()
  const toast = useToast()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const label = nextLabel(kind)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!date) return
    store.saveCourseExams(course.id, [...examDrafts(store.data, course.id), { kind, date, time: time || null, noteIds: [] }])
    toast(`${course.name}: ${label.toLocaleLowerCase('tr-TR')} takvime eklendi`)
    onDone()
  }

  return (
    <form className="exam-done-form" onSubmit={submit} aria-label={`${course.name} ${label.toLocaleLowerCase('tr-TR')} tarihi`}>
      <label className="semester-date">
        <span>{label} tarihi</span>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="semester-date">
        <span>Saat (isteğe bağlı)</span>
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-sm btn-primary" disabled={!date}>
        Ekle
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onDone}>
        Vazgeç
      </button>
    </form>
  )
}

/**
 * A finished exam on one short row: "Bitti · not bekleniyor" until the grade is in, then the grade.
 * The grade field (and the final's date, when `nextKind` is given) open only when asked for.
 * `showCourse` adds the course name for lists that mix courses; `onHide` adds "Gizle".
 */
export function FinishedExamRow({
  exam,
  course,
  showCourse = false,
  nextKind = null,
  onHide,
}: {
  exam: CourseExam
  course: Course
  showCourse?: boolean
  nextKind?: CourseExamKind | null
  onHide?: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const graded = hasGrade(exam)
  const [open, setOpen] = useState<null | 'grade' | 'next'>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const name = showCourse ? `${course.name} · ${examName(exam)}` : examName(exam)

  function saveGrade(grade: number | null) {
    const sameExam = (d: { id?: string }) => (d.id ? d.id === exam.id : true)
    // A course from before several exams existed has a single unsaved exam; saving turns it into a record.
    const drafts = examDrafts(store.data, course.id).map((d) => (sameExam(d) ? { ...d, grade } : d))
    store.saveCourseExams(course.id, drafts)
    setOpen(null)
    setText('')
    setError('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const grade = parseGrade(text)
    if (grade === null) return setError('0 ile 100 arasında bir not yaz.')
    saveGrade(grade)
    toast(`${name}: notun kaydedildi`)
  }

  return (
    <div className="exam-done" role="group" aria-label={`${name}, bitti`}>
      <div className="exam-done-main">
        <div className="exam-done-text">
          <div className="title">
            {showCourse ? (
              <Link to={`/ders/${course.id}`}>
                <span className="course-swatch" style={{ background: course.color, width: 8, height: 8 }} /> {name}
              </Link>
            ) : (
              name
            )}
          </div>
          <div className="exam-done-meta">
            {graded ? <span className="chip chip-success">Notun: {gradeText(exam.grade!)}</span> : <span className="chip chip-warning">Bitti · not bekleniyor</span>}
            <span className="subtle">
              {examDateText(exam.date, exam.time)}
              {exam.weight != null ? ` · %${exam.weight}` : ''}
            </span>
          </div>
        </div>
        {!open && (
          <div className="exam-done-actions">
            {graded ? (
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label={`${name} notunu düzelt`}
                onClick={() => {
                  setText(gradeText(exam.grade!))
                  setOpen('grade')
                }}
              >
                <Pencil size={15} />
              </button>
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => setOpen('grade')}>
                Not gir
              </button>
            )}
            {nextKind && (
              <button type="button" className="btn btn-sm" onClick={() => setOpen('next')}>
                {nextLabel(nextKind)} tarihi ekle
              </button>
            )}
            {onHide && (
              <button type="button" className="btn btn-ghost btn-icon" aria-label={`${name}: gizle`} title="Gizle" onClick={onHide}>
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      {open === 'grade' && (
        <form className="exam-done-form" onSubmit={submit}>
          <input
            className="input exam-grade-input"
            inputMode="decimal"
            aria-label={`${name} notu`}
            placeholder="0-100"
            value={text}
            maxLength={6}
            autoFocus
            onChange={(e) => {
              setText(e.target.value)
              setError('')
            }}
          />
          <button type="submit" className="btn btn-sm btn-primary" disabled={!text.trim()}>
            <Check size={15} /> Kaydet
          </button>
          {graded && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => saveGrade(null)}>
              Notu sil
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setOpen(null)
              setError('')
            }}
          >
            Vazgeç
          </button>
          {error && (
            <span role="alert" style={{ color: 'var(--danger)' }}>
              {error}
            </span>
          )}
        </form>
      )}
      {open === 'next' && nextKind && <NextExamForm course={course} kind={nextKind} onDone={() => setOpen(null)} />}
    </div>
  )
}

/** "Sırada final var" for a course whose finished exams need nothing else. */
export function NextExamPrompt({ course, kind, showCourse = false, onHide }: { course: Course; kind: CourseExamKind; showCourse?: boolean; onHide?: () => void }) {
  const [open, setOpen] = useState(false)
  const label = nextLabel(kind)
  const title = `Sırada ${label.toLocaleLowerCase('tr-TR')} var`

  return (
    <div className="exam-done" role="group" aria-label={`${course.name}: ${title.toLocaleLowerCase('tr-TR')}`}>
      <div className="exam-done-main">
        <div className="exam-done-text">
          <div className="title">
            {showCourse ? (
              <Link to={`/ders/${course.id}`}>
                <span className="course-swatch" style={{ background: course.color, width: 8, height: 8 }} /> {course.name}
              </Link>
            ) : (
              title
            )}
          </div>
          <div className="subtle">{showCourse ? `${title}. Tarihi belli olunca gir.` : 'Tarihi belli olunca gir.'}</div>
        </div>
        {!open && (
          <div className="exam-done-actions">
            <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
              {label} tarihi ekle
            </button>
            {onHide && (
              <button type="button" className="btn btn-ghost btn-icon" aria-label={`${course.name}: gizle`} title="Gizle" onClick={onHide}>
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      {open && <NextExamForm course={course} kind={kind} onDone={() => setOpen(false)} />}
    </div>
  )
}

interface Asks {
  /** Finished exams still waiting for a grade, with the course's next exam to add when there is one. */
  exams: Array<{ exam: CourseExam; course: Course; nextKind: CourseExamKind | null }>
  /** Courses that only need their next exam's date. */
  next: Array<{ course: Course; kind: CourseExamKind }>
}

/** What still waits on the student after exams end, minus what they chose to hide. */
export function pendingExamAsks(data: Pick<StudyData, 'courses' | 'courseExams'>, hidden: Set<string>, now = new Date()): Asks {
  const nextOf = new Map<string, CourseExamKind>()
  for (const course of data.courses) {
    const kind = nextExamToAdd(examsForCourse(data, course.id), now)
    if (kind && !hidden.has(nextKey(course.id))) nextOf.set(course.id, kind)
  }
  const awaiting = examsAwaitingGrade(data, now).filter((e) => !hidden.has(gradeKey(e.exam.id)))
  // The final's date is offered on the course's most recent waiting exam, not on a row of its own.
  const carried = new Set<string>()
  const exams = awaiting.map(({ exam, course }) => {
    const nextKind = carried.has(course.id) ? null : (nextOf.get(course.id) ?? null)
    if (nextKind) carried.add(course.id)
    return { exam, course, nextKind }
  })
  const next = data.courses.filter((c) => nextOf.has(c.id) && !carried.has(c.id)).map((course) => ({ course, kind: nextOf.get(course.id)! }))
  return { exams, next }
}

/** The exams tab's "Biten sınavlar": short rows, each one can be hidden. Nothing when nothing waits. */
export function FinishedExams() {
  const { data } = useStore()
  const hidden = useHiddenExamAsks()
  const { exams, next } = pendingExamAsks(data, hidden)
  if (!exams.length && !next.length) return null

  return (
    <section className="section" aria-label="Biten sınavlar">
      <div className="section-head">
        <div>
          <h2>Biten sınavlar</h2>
          <span className="subtle">Notun açıklanınca gir. İstemediğini çarpıyla gizle; sınav “Geçmiş sınavlar”da durur.</span>
        </div>
      </div>
      <div className="panel panel-tight exam-done-list">
        {exams.map(({ exam, course, nextKind }) => (
          <FinishedExamRow
            key={exam.id}
            exam={exam}
            course={course}
            showCourse
            nextKind={nextKind}
            onHide={() => hideExamAsks([gradeKey(exam.id), ...(nextKind ? [nextKey(course.id)] : [])])}
          />
        ))}
        {next.map(({ course, kind }) => (
          <NextExamPrompt key={course.id} course={course} kind={kind} showCourse onHide={() => hideExamAsks([nextKey(course.id)])} />
        ))}
      </div>
    </section>
  )
}

/** Today: one line that leads to the exams tab, and can be dismissed for good. */
export function FinishedExamsNotice() {
  const { data } = useStore()
  const hidden = useHiddenExamAsks()
  const { exams, next } = pendingExamAsks(data, hidden)
  if (!exams.length && !next.length) return null
  const text = exams.length
    ? `${exams.length} sınavın bitti. Notun açıklandıysa gir.`
    : `${next.length} dersin vizesi bitti. Final tarihini ekle.`

  return (
    <div className="exam-notice" role="group" aria-label="Biten sınavlar">
      <Link to="/sinav" className="exam-notice-link">
        <span>{text}</span>
        <ArrowRight size={16} />
      </Link>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label="Biten sınavları gizle"
        title="Gizle"
        onClick={() => hideExamAsks([...exams.map((e) => gradeKey(e.exam.id)), ...exams.filter((e) => e.nextKind).map((e) => nextKey(e.course.id)), ...next.map((n) => nextKey(n.course.id))])}
      >
        <X size={16} />
      </button>
    </div>
  )
}
