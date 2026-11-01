import { courseExamPhrase, examCovers, examName, examsForCourse, isLegacyExam, upcomingExams } from './courseExams'
import { computeNoteProgress, computeTopicMastery } from './learningPath'
import type { CourseExamDraft } from './store'
import { buildSmartStudyPlan } from './studyPlan'
import type { Course, CourseExam, Note, StudyData } from './types'

/*
 * The "Sınavlar" tab: which exam needs the student most right now, a quick way to enter the whole
 * semester at once, and an export to the phone's calendar.
 */

/** Without a test or card review a note counts at most this much: clicking through steps is not knowing. */
export const UNTESTED_CAP = 40
/** Exams further away than this do not ask for attention yet. */
export const FOCUS_WINDOW_DAYS = 45
/** An exam this well prepared does not need to be pushed. */
export const READY_PERCENT = 85

export function notesForExam(data: Pick<StudyData, 'notes'>, exam: Pick<CourseExam, 'courseId' | 'noteIds'>): Note[] {
  return data.notes.filter((n) => n.courseId === exam.courseId && examCovers(exam, n.id))
}

/**
 * How ready the student is for an exam, 0-100, averaged over the notes it covers; null when the
 * course has no notes yet (we cannot know, so we do not guess).
 */
export function examReadiness(data: StudyData, exam: Pick<CourseExam, 'courseId' | 'noteIds'>): number | null {
  const notes = notesForExam(data, exam)
  if (!notes.length) return null
  const total = notes.reduce((sum, note) => {
    const mastery = computeTopicMastery(note, data.cards, data.attempts)
    if (mastery.assessed) return sum + mastery.percent
    if (!note.generator) return sum
    return sum + Math.min(UNTESTED_CAP, computeNoteProgress(note, data.cards, data.attempts).percent * 0.4)
  }, 0)
  return Math.round(total / notes.length)
}

/** Higher means "work on this first": closer, heavier and less prepared exams win. */
export function examUrgency(days: number, weight: number | null, readiness: number | null): number {
  const gap = 1 - (readiness ?? 0) / 100
  const weightFactor = weight == null ? 1 : 0.5 + Math.min(100, Math.max(0, weight)) / 100
  return (gap * weightFactor) / (days + 1)
}

export interface ExamFocus {
  exam: CourseExam
  course: Course
  days: number
  readiness: number | null
  /** e.g. "Biyoloji vizesine 3 gün kaldı" */
  headline: string
  /** Why this, in a short sentence. */
  reason: string
  actionLabel: string
  actionUrl: string
  /** The note the action opens, when it is one note (so other lists on Bugün do not repeat it). */
  noteId?: string
}

/** The one exam to start with now, and what to do for it. Null when nothing is close or everything is ready. */
export function pickExamFocus(data: StudyData, now = new Date()): ExamFocus | null {
  const candidates = upcomingExams(data, now)
    .filter((e) => e.days <= FOCUS_WINDOW_DAYS)
    .map((e) => ({ ...e, readiness: examReadiness(data, e.exam) }))
    .filter((e) => e.readiness === null || e.readiness < READY_PERCENT)
    .map((e) => ({ ...e, urgency: examUrgency(e.days, e.exam.weight, e.readiness) }))
    .sort((a, b) => b.urgency - a.urgency || a.days - b.days)
  const top = candidates[0]
  if (!top) return null
  const { exam, course, days, readiness } = top
  const headline = courseExamPhrase(course.name, exam, days)

  if (readiness === null) {
    return {
      exam,
      course,
      days,
      readiness,
      headline,
      reason: 'Bu derste henüz not yok. Önce ders notunu ekle, gerisini birlikte planlayalım.',
      actionLabel: 'Not ekle',
      actionUrl: `/not-ekle?ders=${course.id}`,
    }
  }

  const plan = buildSmartStudyPlan(data, now, Number.MAX_SAFE_INTEGER)
  const item = plan.items.find((i) => i.note.courseId === course.id && examCovers(exam, i.note.id))
  const ready = `Hazırlığın: %${readiness}.`
  if (item) {
    return {
      exam,
      course,
      days,
      readiness,
      headline,
      reason: `${ready} Sıradaki: ${item.note.title}.`,
      actionLabel: item.actionLabel,
      actionUrl: item.targetUrl,
      noteId: item.note.id,
    }
  }
  return {
    exam,
    course,
    days,
    readiness,
    headline,
    reason: `${ready} Notların çalışılmış görünüyor; kendini bir provayla dene.`,
    actionLabel: 'Prova yap',
    actionUrl: `/ders/${course.id}/sinav${isLegacyExam(exam) ? '' : `?sinav=${exam.id}`}`,
  }
}

// ---------- Semester setup ----------

export interface SemesterRow {
  name: string
  /** YYYY-MM-DD or '' */
  vize: string
  final: string
}

export const normalizeCourseName = (name: string) => name.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()

/** One row per course, prefilled with its current midterm and final dates. */
export function semesterRows(data: Pick<StudyData, 'courses' | 'courseExams'>): SemesterRow[] {
  return [...data.courses]
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .map((course) => {
      const exams = examsForCourse(data, course.id).filter((e) => !isLegacyExam(e))
      return {
        name: course.name,
        vize: exams.find((e) => e.kind === 'vize')?.date ?? '',
        final: exams.find((e) => e.kind === 'final')?.date ?? '',
      }
    })
}

/**
 * The exam list of a course after the semester table is saved: the first midterm and final get the
 * new dates (or are added), every other exam (bütünleme, quiz, a second midterm, weights, coverage)
 * stays as it was. An empty cell changes nothing; it never deletes an exam.
 */
export function mergeSemesterExams(existing: CourseExam[], row: Pick<SemesterRow, 'vize' | 'final'>): CourseExamDraft[] {
  const drafts: CourseExamDraft[] = existing
    .filter((e) => !isLegacyExam(e))
    .map((e) => ({ id: e.id, kind: e.kind, title: e.title, date: e.date, weight: e.weight, noteIds: e.noteIds }))
  for (const kind of ['vize', 'final'] as const) {
    const date = row[kind]
    if (!date) continue
    const current = drafts.find((d) => d.kind === kind)
    if (current) current.date = date
    else drafts.push({ kind, date, noteIds: [] })
  }
  return drafts
}

export interface SemesterPlan {
  create: Array<{ name: string; exams: CourseExamDraft[] }>
  update: Array<{ courseId: string; exams: CourseExamDraft[] }>
}

/** Turns the table into what to create and what to update. Rows without a name are skipped; repeated names count once. */
export function planSemester(data: Pick<StudyData, 'courses' | 'courseExams'>, rows: SemesterRow[]): SemesterPlan {
  const plan: SemesterPlan = { create: [], update: [] }
  const seen = new Set<string>()
  for (const row of rows) {
    const name = row.name.replace(/\s+/g, ' ').trim()
    const key = normalizeCourseName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const course = data.courses.find((c) => normalizeCourseName(c.name) === key)
    if (course) {
      const before = data.courseExams.filter((e) => e.courseId === course.id)
      const exams = mergeSemesterExams(before, row)
      const changed = exams.length !== before.length || exams.some((d) => before.find((e) => e.id === d.id)?.date !== d.date)
      if (changed) plan.update.push({ courseId: course.id, exams })
    } else {
      plan.create.push({ name: name.slice(0, 120), exams: mergeSemesterExams([], row) })
    }
  }
  return plan
}

// ---------- Calendar export (.ics) ----------

const icsText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** RFC 5545 lines are at most 75 octets; longer ones continue on the next line after a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += n
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const compactDate = (date: string) => date.replaceAll('-', '')

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.toISOString().slice(0, 10)
}

/** All-day events with a reminder the day before, for Google Calendar, Apple Calendar and others. */
export function buildIcs(items: Array<{ exam: CourseExam; course: Course }>, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StudyMode//Sinavlar//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:StudyMode sınavları']
  for (const { exam, course } of items) {
    const title = `${course.name} · ${examName(exam)}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${exam.id}@studymode.fun`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(exam.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(exam.date))}`,
      `SUMMARY:${icsText(title)}`,
      `DESCRIPTION:${icsText(exam.weight != null ? `Ağırlık %${exam.weight}. StudyMode ile hazırlan: https://studymode.fun/sinav` : 'StudyMode ile hazırlan: https://studymode.fun/sinav')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(`Yarın: ${title}`)}`,
      'TRIGGER:-PT15H',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
