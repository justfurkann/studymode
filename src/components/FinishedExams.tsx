import { CalendarPlus, Check, CircleCheck, Hourglass, Pencil } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { examDateText, examDrafts, examName, examsAwaitingGrade, examsForCourse, gradeText, hasGrade, nextExamToAdd, parseGrade } from '../lib/courseExams'
import { useStore } from '../lib/store'
import type { Course, CourseExam, CourseExamKind } from '../lib/types'
import { useToast } from './ui'

const NEXT_LABEL: Partial<Record<CourseExamKind, string>> = { final: 'Final' }

/**
 * A finished exam: "Bitti · not bekleniyor" with a field for the grade, or the grade once it is in.
 * `showCourse` adds the course name for lists that mix courses.
 */
export function FinishedExamRow({ exam, course, showCourse = false }: { exam: CourseExam; course: Course; showCourse?: boolean }) {
  const store = useStore()
  const toast = useToast()
  const graded = hasGrade(exam)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const name = showCourse ? `${course.name} · ${examName(exam)}` : examName(exam)
  const open = !graded || editing

  function saveGrade(grade: number | null) {
    const sameExam = (d: { id?: string }) => (d.id ? d.id === exam.id : true)
    // A course from before several exams existed has a single unsaved exam; saving turns it into a record.
    const drafts = examDrafts(store.data, course.id).map((d) => (sameExam(d) ? { ...d, grade } : d))
    store.saveCourseExams(course.id, drafts)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const grade = parseGrade(text)
    if (grade === null) return setError('0 ile 100 arasında bir not yaz.')
    saveGrade(grade)
    setEditing(false)
    setText('')
    setError('')
    toast(`${name}: notun kaydedildi`)
  }

  return (
    <div className="exam-done" role="group" aria-label={`${name}, bitti`}>
      <div className="exam-done-main">
        {graded ? <CircleCheck size={18} className="muted" /> : <Hourglass size={18} className="muted" />}
        <div className="grow">
          <div className="title">
            {showCourse ? (
              <Link to={`/ders/${course.id}`}>
                <span className="course-swatch" style={{ background: course.color, width: 8, height: 8 }} /> {name}
              </Link>
            ) : (
              name
            )}
            {exam.weight != null && <span className="subtle"> · %{exam.weight}</span>}
          </div>
          <div className="subtle">{examDateText(exam.date, exam.time)}</div>
        </div>
        {graded ? (
          <>
            <span className="chip chip-success">Notun: {gradeText(exam.grade!)}</span>
            {!editing && (
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label={`${name} notunu düzelt`}
                onClick={() => {
                  setText(gradeText(exam.grade!))
                  setEditing(true)
                }}
              >
                <Pencil size={15} />
              </button>
            )}
          </>
        ) : (
          <span className="chip chip-warning">Bitti · not bekleniyor</span>
        )}
      </div>
      {open && (
        <form className="exam-done-form" onSubmit={submit}>
          <input
            className="input"
            inputMode="decimal"
            aria-label={`${name} notu`}
            placeholder="Notun (0-100)"
            value={text}
            maxLength={6}
            onChange={(e) => {
              setText(e.target.value)
              setError('')
            }}
          />
          <button type="submit" className="btn btn-sm btn-primary" disabled={!text.trim()}>
            <Check size={15} /> Notu kaydet
          </button>
          {editing && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  saveGrade(null)
                  setEditing(false)
                  setText('')
                }}
              >
                Notu sil
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
                Vazgeç
              </button>
            </>
          )}
          {error && (
            <span role="alert" style={{ color: 'var(--danger)' }}>
              {error}
            </span>
          )}
        </form>
      )}
    </div>
  )
}

/** "Vize bitti, final ne zaman?": one date (and an optional time) puts the next exam on the calendar. */
export function NextExamPrompt({ course, kind, showCourse = false }: { course: Course; kind: CourseExamKind; showCourse?: boolean }) {
  const store = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const label = NEXT_LABEL[kind] ?? 'Sınav'

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!date) return
    store.saveCourseExams(course.id, [...examDrafts(store.data, course.id), { kind, date, time: time || null, noteIds: [] }])
    toast(`${course.name}: ${label.toLocaleLowerCase('tr-TR')} takvime eklendi`)
  }

  return (
    <form className="exam-next" onSubmit={submit} aria-label={`${course.name} ${label.toLocaleLowerCase('tr-TR')} tarihi`}>
      <div className="exam-next-text">
        <CalendarPlus size={18} className="muted" />
        <div className="grow">
          <div className="title">{showCourse ? `${course.name}: sırada ${label.toLocaleLowerCase('tr-TR')} var` : `Sırada ${label.toLocaleLowerCase('tr-TR')} var`}</div>
          <div className="subtle">Tarihi belli olunca gir; çalışma planın ona göre kurulsun.</div>
        </div>
        {!open && (
          <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
            {label} tarihi ekle
          </button>
        )}
      </div>
      <div className="exam-next-fields" hidden={!open}>
        <label className="semester-date">
          <span>{label} tarihi</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required={open} />
        </label>
        <label className="semester-date">
          <span>Saat (isteğe bağlı)</span>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-sm btn-primary" disabled={!date}>
          Ekle
        </button>
      </div>
    </form>
  )
}

/**
 * Everything that waits on the student after exams end, across courses: grades not entered yet and
 * courses whose next exam date is missing. Renders nothing when there is nothing to do.
 */
export function FinishedExams({ limit, moreLink = false }: { limit?: number; moreLink?: boolean }) {
  const { data } = useStore()
  const now = new Date()
  const awaiting = examsAwaitingGrade(data, now)
  const next = data.courses
    .map((course) => ({ course, kind: nextExamToAdd(examsForCourse(data, course.id), now) }))
    .filter((e): e is { course: Course; kind: CourseExamKind } => e.kind !== null)
  if (!awaiting.length && !next.length) return null
  const shownAwaiting = limit ? awaiting.slice(0, limit) : awaiting
  const shownNext = limit ? next.slice(0, Math.max(1, limit - shownAwaiting.length)) : next
  const hidden = awaiting.length + next.length - shownAwaiting.length - shownNext.length

  return (
    <section className="section" aria-label="Biten sınavlar">
      <div className="section-head">
        <div>
          <h2>Biten sınavlar</h2>
          <span className="subtle">Notun açıklanınca gir, sıradaki sınavın tarihini ekle.</span>
        </div>
      </div>
      <div className="panel panel-tight exam-done-list">
        {shownAwaiting.map(({ exam, course }) => (
          <FinishedExamRow key={exam.id} exam={exam} course={course} showCourse />
        ))}
        {shownNext.map(({ course, kind }) => (
          <NextExamPrompt key={course.id} course={course} kind={kind} showCourse />
        ))}
      </div>
      {moreLink && hidden > 0 && (
        <p className="subtle">
          <Link to="/sinav">{hidden} tane daha var, Sınavlar sayfasında gör</Link>
        </p>
      )}
    </section>
  )
}
