import { daysUntil } from './srs'
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

/** Short countdown, e.g. "Vizeye 8 gün", "Final yarın", "Vize bugün"; null for a past exam. */
export function examCountdown(exam: Pick<CourseExam, 'kind' | 'title' | 'date'>, now = new Date()): { text: string; days: number; tone: 'danger' | 'warning' | 'neutral' } | null {
  const days = daysUntil(exam.date, now)
  if (days === null || days < 0) return null
  const name = examName(exam)
  const tone = days <= 1 ? 'danger' : days <= 7 ? 'warning' : 'neutral'
  if (days === 0) return { text: `${name} bugün`, days, tone }
  if (days === 1) return { text: `${name} yarın`, days, tone }
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

/** "28 Ekim Çarşamba" style date for an exam day. */
export const examDateText = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })

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

/** Upcoming exams (today or later) across all courses, nearest first. */
export function upcomingExams(data: Pick<StudyData, 'courses' | 'courseExams'>, now = new Date()): Array<{ exam: CourseExam; course: Course; days: number }> {
  return data.courses
    .flatMap((course) => examsForCourse(data, course.id).map((exam) => ({ exam, course, days: daysUntil(exam.date, now) })))
    .filter((e): e is { exam: CourseExam; course: Course; days: number } => e.days !== null && e.days >= 0)
    .sort((a, b) => a.days - b.days)
}

/** The nearest upcoming exam that covers a note (or a card without a note: only whole-course exams). */
export function nearestExamFor(data: Pick<StudyData, 'courses' | 'courseExams'>, courseId: string, noteId: string | null, now = new Date()) {
  return upcomingExams(data, now).find((e) => e.course.id === courseId && examCovers(e.exam, noteId)) ?? null
}

/** Date that caps a card's review interval: the nearest exam covering its note. */
export const examDateForCard = (data: Pick<StudyData, 'courses' | 'courseExams'>, card: Pick<Card, 'courseId' | 'noteId'>, now = new Date()) =>
  nearestExamFor(data, card.courseId, card.noteId, now)?.exam.date ?? null

/** Next upcoming exam date among `exams`, used to keep Course.examDate in sync. */
export function nextExamDate(exams: Array<Pick<CourseExam, 'date'>>, now = new Date()): string | null {
  return (
    exams
      .map((e) => e.date)
      .filter((date) => (daysUntil(date, now) ?? -1) >= 0)
      .sort()[0] ?? null
  )
}
