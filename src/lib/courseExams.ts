import { daysUntil } from './srs'
import type { CourseExamDraft } from './store'
import type { Card, Course, CourseExam, CourseExamKind, StudyData } from './types'

export const EXAM_KINDS: Array<{ id: CourseExamKind; label: string }> = [
  { id: 'vize', label: 'Vize' },
  { id: 'final', label: 'Final' },
  { id: 'butunleme', label: 'Bütünleme' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'diger', label: 'Diğer' },
]

const LABELS: Record<CourseExamKind, string> = { vize: 'Vize', final: 'Final', butunleme: 'Bütünleme', quiz: 'Quiz', diger: 'Sınav' }
/** "Vizeye 8 gün" needs the dative form of each name. */
const DATIVE: Record<CourseExamKind, string> = { vize: 'Vizeye', final: 'Finale', butunleme: 'Bütünlemeye', quiz: 'Quiz’e', diger: 'Sınava' }
/** After a course name the suffix goes on the exam word: "Biyoloji vizesi", "Biyoloji vizesine". */
const POSSESSIVE: Record<CourseExamKind, string> = { vize: 'vizesi', final: 'finali', butunleme: 'bütünlemesi', quiz: 'quizi', diger: 'sınavı' }
const POSSESSIVE_DATIVE: Record<CourseExamKind, string> = { vize: 'vizesine', final: 'finaline', butunleme: 'bütünlemesine', quiz: 'quizine', diger: 'sınavına' }

export const examName = (exam: Pick<CourseExam, 'kind' | 'title'>) => (exam.kind === 'diger' && exam.title?.trim() ? exam.title.trim() : LABELS[exam.kind])

/** How long after its start time an exam counts as finished. */
export const EXAM_LENGTH_MS = 60 * 60 * 1000

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

/** "9:30", "09.30" or "09:30:00" → "09:30"; anything else → null. */
export function cleanExamTime(value: string | null | undefined): string | null {
  const match = value?.trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/)
  if (!match) return null
  const time = `${match[1].padStart(2, '0')}:${match[2]}`
  return TIME.test(time) ? time : null
}

type Timed = Pick<CourseExam, 'date'> & { time?: string | null }

/**
 * The moment an exam is over: one hour after its start time, or the end of the day when no time
 * was entered. Null for a broken date.
 */
export function examEnd(exam: Timed): Date | null {
  const [y, m, d] = exam.date.split('-').map(Number)
  if (!y || !m || !d) return null
  const time = cleanExamTime(exam.time)
  if (!time) return new Date(y, m - 1, d + 1)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(new Date(y, m - 1, d, hours, minutes).getTime() + EXAM_LENGTH_MS)
}

export function examEnded(exam: Timed, now = new Date()): boolean {
  const end = examEnd(exam)
  return end !== null && now.getTime() >= end.getTime()
}

/** Days left for an exam that is not over yet; null for a finished one or a broken date. */
function daysLeft(exam: Timed, now: Date): number | null {
  const days = daysUntil(exam.date, now)
  if (days === null || examEnded(exam, now)) return null
  // A late exam (23:30) is still running a little after midnight.
  return Math.max(0, days)
}

/** Short countdown, e.g. "Vizeye 8 gün", "Final yarın", "Vize bugün 10:00"; null for a finished exam. */
export function examCountdown(exam: Pick<CourseExam, 'kind' | 'title' | 'date' | 'time'>, now = new Date()): { text: string; days: number; tone: 'danger' | 'warning' | 'neutral' } | null {
  const days = daysLeft(exam, now)
  if (days === null) return null
  const name = examName(exam)
  const tone = days <= 1 ? 'danger' : days <= 7 ? 'warning' : 'neutral'
  const time = cleanExamTime(exam.time)
  const at = time ? ` ${time}` : ''
  if (days === 0) return { text: `${name} bugün${at}`, days, tone }
  if (days === 1) return { text: `${name} yarın${at}`, days, tone }
  // Custom names ("Proje sunumu") cannot be declined reliably, so they get a neutral form.
  const text = exam.kind === 'diger' && exam.title?.trim() ? `${name}: ${days} gün kaldı` : `${DATIVE[exam.kind]} ${days} gün`
  return { text, days, tone }
}

/** Countdown with the course name, e.g. "Biyoloji vizesine 8 gün kaldı", "Biyoloji finali yarın". */
export function courseExamPhrase(courseName: string, exam: Pick<CourseExam, 'kind' | 'title'>, days: number): string {
  const when = days === 0 ? 'bugün' : days === 1 ? 'yarın' : null
  if (exam.kind === 'diger' && exam.title?.trim()) return `${courseName} · ${exam.title.trim()}${when ? ` ${when}` : `: ${days} gün kaldı`}`
  return when ? `${courseName} ${POSSESSIVE[exam.kind]} ${when}` : `${courseName} ${POSSESSIVE_DATIVE[exam.kind]} ${days} gün kaldı`
}

/** "28 Ekim Çarşamba" style date for an exam day, with the time when there is one. */
export const examDateText = (date: string, time?: string | null) => {
  const day = new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
  const clean = cleanExamTime(time)
  return clean ? `${day}, ${clean}` : day
}

/** Stands in for the single exam date of courses created before multiple exams existed. */
export function legacyExam(course: Course): CourseExam | null {
  if (!course.examDate) return null
  return { id: `legacy-${course.id}`, courseId: course.id, kind: 'diger', title: null, date: course.examDate, weight: null, noteIds: [], createdAt: course.createdAt, updatedAt: course.updatedAt }
}

export const isLegacyExam = (exam: Pick<CourseExam, 'id'>) => exam.id.startsWith('legacy-')

/** A course's exams sorted by date; the old single date stands in when there are none. */
export function examsForCourse(data: Pick<StudyData, 'courses' | 'courseExams'>, courseId: string): CourseExam[] {
  const exams = data.courseExams.filter((e) => e.courseId === courseId)
  if (exams.length) return [...exams].sort((a, b) => a.date.localeCompare(b.date))
  const course = data.courses.find((c) => c.id === courseId)
  const legacy = course && legacyExam(course)
  return legacy ? [legacy] : []
}

export const examCovers = (exam: Pick<CourseExam, 'noteIds'>, noteId: string | null) =>
  exam.noteIds.length === 0 || (noteId !== null && exam.noteIds.includes(noteId))

/** Exams that are not over yet across all courses, nearest first. */
export function upcomingExams(data: Pick<StudyData, 'courses' | 'courseExams'>, now = new Date()): Array<{ exam: CourseExam; course: Course; days: number }> {
  return data.courses
    .flatMap((course) => examsForCourse(data, course.id).map((exam) => ({ exam, course, days: daysLeft(exam, now) })))
    .filter((e): e is { exam: CourseExam; course: Course; days: number } => e.days !== null)
    .sort((a, b) => a.days - b.days || (a.exam.time ?? '').localeCompare(b.exam.time ?? ''))
}

/** Exams that are over, the most recent first. */
export function finishedExams(data: Pick<StudyData, 'courses' | 'courseExams'>, now = new Date()): Array<{ exam: CourseExam; course: Course }> {
  return data.courses
    .flatMap((course) => examsForCourse(data, course.id).map((exam) => ({ exam, course })))
    .filter((e) => examEnded(e.exam, now))
    .sort((a, b) => b.exam.date.localeCompare(a.exam.date) || (b.exam.time ?? '').localeCompare(a.exam.time ?? ''))
}

export const hasGrade = (exam: Pick<CourseExam, 'grade'>) => typeof exam.grade === 'number'

/** After this long nobody is still waiting for a grade; the exam stops asking on the home page. */
export const GRADE_WAIT_DAYS = 21

/** Finished exams whose grade has not been entered yet and that are recent enough to still ask about. */
export function examsAwaitingGrade(data: Pick<StudyData, 'courses' | 'courseExams'>, now = new Date()) {
  return finishedExams(data, now).filter((e) => !hasGrade(e.exam) && (daysUntil(e.exam.date, now) ?? -Infinity) >= -GRADE_WAIT_DAYS)
}

/** "78", "78,5" → number between 0 and 100; null when it is not a valid grade. */
export function parseGrade(text: string): number | null {
  const clean = text.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(clean)) return null
  const value = Number(clean)
  return value >= 0 && value <= 100 ? value : null
}

export const gradeText = (grade: number) => String(Math.round(grade * 100) / 100).replace('.', ',')

/**
 * What the student should enter next for a course: once the midterm is over and nothing else is
 * on the calendar, the final. Null when there is nothing to suggest.
 */
export function nextExamToAdd(exams: CourseExam[], now = new Date()): CourseExamKind | null {
  if (!exams.length || exams.some((e) => !examEnded(e, now))) return null
  if (exams.some((e) => e.kind === 'final')) return null
  // A midterm from last term should not keep asking for a final.
  const recent = exams.some((e) => e.kind === 'vize' && (daysUntil(e.date, now) ?? -Infinity) >= -GRADE_WAIT_DAYS)
  return recent ? 'final' : null
}

/** A course's exams as they are saved, ready to be changed and passed to `saveCourseExams`. */
export function examDrafts(data: Pick<StudyData, 'courses' | 'courseExams'>, courseId: string): CourseExamDraft[] {
  return examsForCourse(data, courseId).map((e) => ({
    // The old single date becomes a real exam record the first time it is saved.
    id: isLegacyExam(e) ? undefined : e.id,
    kind: e.kind,
    title: e.title,
    date: e.date,
    time: e.time ?? null,
    weight: e.weight,
    grade: e.grade ?? null,
    noteIds: e.noteIds,
  }))
}

/** The nearest upcoming exam that covers a note (or a card without a note: only whole-course exams). */
export function nearestExamFor(data: Pick<StudyData, 'courses' | 'courseExams'>, courseId: string, noteId: string | null, now = new Date()) {
  return upcomingExams(data, now).find((e) => e.course.id === courseId && examCovers(e.exam, noteId)) ?? null
}

/** Date that caps a card's review interval: the nearest exam covering its note. */
export const examDateForCard = (data: Pick<StudyData, 'courses' | 'courseExams'>, card: Pick<Card, 'courseId' | 'noteId'>, now = new Date()) =>
  nearestExamFor(data, card.courseId, card.noteId, now)?.exam.date ?? null

/** Next upcoming exam date among `exams`, used to keep Course.examDate in sync. */
export function nextExamDate(exams: Timed[], now = new Date()): string | null {
  return (
    exams
      .filter((e) => daysLeft(e, now) !== null)
      .map((e) => e.date)
      .sort()[0] ?? null
  )
}
