import { examDateForCard, upcomingExams } from './courseExams'
import { examReadiness } from './examFocus'
import { isDue } from './srs'
import { localDayKey, mergeStudyDays } from './streak'
import type { Card, Course, StudyData, StudyDay } from './types'

/*
 * The new Tekrar (same rules as the iOS app, docs/IOS_SYNC.md "Ortak kural: yeni Tekrar"):
 * one session a day with a goal (15 cards by default), "Biraz daha" adds 10 more, at most 5 new
 * cards a day, only cards of notes the student has read or tested, nearest exam first.
 * The scheduler (srs.ts) and the four grades do not change.
 */

/** "Biraz daha" adds this many cards to today's goal. */
export const EXTRA_STEP = 10
/** At most this many never-seen cards start in one day. */
export const MAX_NEW_PER_DAY = 5
const START_EASE = 2.5

/** Never answered: no reps, no lapses and the starting ease ("Bilemedim" on a new card lowers the ease). */
export const isNewCard = (card: Pick<Card, 'reps' | 'lapses' | 'ease'>) => card.reps === 0 && card.lapses === 0 && card.ease === START_EASE

/** Answered "Bilemedim" before: a lapse, or back at zero reps after an answer. */
export const wasFailed = (card: Pick<Card, 'reps' | 'lapses' | 'ease'>) => card.lapses > 0 || (card.reps === 0 && !isNewCard(card))

/** Notes whose summary was read (Tanış or Anla step done) or that have a test result. */
export function readyNoteIds(data: Pick<StudyData, 'notes' | 'attempts'>): Set<string> {
  const ready = new Set(data.attempts.map((a) => a.noteId))
  for (const note of data.notes) {
    const steps = note.summary?.completedSteps ?? []
    if (steps.includes('tanis') || steps.includes('anla')) ready.add(note.id)
  }
  return ready
}

/** A new card may start: no note (added by hand, or its note is gone), or a read/tested note. */
export function cardAllowed(card: Pick<Card, 'noteId'>, ready: Set<string>, noteIds: Set<string>): boolean {
  return !card.noteId || !noteIds.has(card.noteId) || ready.has(card.noteId)
}

/** Today's reviews and new cards, added up over every device. */
export function todayCounts(studyDays: StudyDay[], now = new Date()): { reviews: number; newCards: number } {
  const today = localDayKey(now)
  const row = mergeStudyDays(studyDays.filter((d) => d.day === today))[0]
  return { reviews: row?.reviews ?? 0, newCards: row?.newCards ?? 0 }
}

/**
 * The cards for the next `slots` answers, in order: nearest exam first (courses without an exam
 * last), then cards answered wrong before, then the most overdue, and new cards last (`newLeft` at most;
 * only those of read or tested notes, or without a note).
 */
export function buildDailyQueue(data: StudyData, slots: number, newLeft: number, now = new Date()): Card[] {
  if (slots <= 0) return []
  const ready = readyNoteIds(data)
  const noteIds = new Set(data.notes.map((n) => n.id))
  const examOf = new Map<string, string>()
  const examKey = (card: Card) => {
    const key = `${card.courseId}|${card.noteId ?? ''}`
    if (!examOf.has(key)) examOf.set(key, examDateForCard(data, card, now) ?? '9999-99-99')
    return examOf.get(key)!
  }
  const order = (a: Card, b: Card) =>
    examKey(a).localeCompare(examKey(b)) ||
    Number(wasFailed(b)) - Number(wasFailed(a)) ||
    Date.parse(a.due) - Date.parse(b.due)
  // The read-or-tested gate is for new cards only: a card answered once always comes back when due.
  const candidates = data.cards.filter((c) => isDue(c, now) && (!isNewCard(c) || cardAllowed(c, ready, noteIds)))
  const seen = candidates.filter((c) => !isNewCard(c)).sort(order)
  const fresh = candidates.filter(isNewCard).sort(order).slice(0, Math.max(0, newLeft))
  return [...seen, ...fresh].slice(0, slots)
}

/** "Biraz daha" for today, kept in this browser so a reload does not lose it. */
const EXTRA_KEY = 'studymode.review.extra'

export function readExtra(now = new Date()): number {
  try {
    const saved = JSON.parse(localStorage.getItem(EXTRA_KEY) ?? 'null') as { day?: string; extra?: number } | null
    return saved?.day === localDayKey(now) && Number.isFinite(saved.extra) ? Math.max(0, saved.extra!) : 0
  } catch {
    return 0
  }
}

export function saveExtra(extra: number, now = new Date()) {
  try {
    localStorage.setItem(EXTRA_KEY, JSON.stringify({ day: localDayKey(now), extra }))
  } catch {
    // Private mode: the extra cards last until the page is reloaded.
  }
}

export interface DailyReview {
  /** Today's goal including "Biraz daha". */
  goal: number
  /** Answers given today (all devices). */
  done: number
  /** Cards that can still come today: the goal left, or fewer when fewer cards are ready. */
  left: number
  newLeft: number
  queue: Card[]
}

export function dailyReview(data: StudyData, baseGoal: number, extra: number, now = new Date()): DailyReview {
  const goal = Math.max(1, baseGoal) + Math.max(0, extra)
  const { reviews, newCards } = todayCounts(data.studyDays, now)
  const newLeft = Math.max(0, MAX_NEW_PER_DAY - newCards)
  const queue = buildDailyQueue(data, goal - reviews, newLeft, now)
  return { goal, done: reviews, left: queue.length, newLeft, queue }
}

/** Is there anything for "Biraz daha"? */
export const moreAvailable = (data: StudyData, now = new Date()) =>
  buildDailyQueue(data, 1, MAX_NEW_PER_DAY - todayCounts(data.studyDays, now).newCards, now).length > 0

export interface CourseReadiness {
  course: Course
  /** 0-100, or null when the course has no notes yet. */
  readiness: number | null
  /** The nearest exam's date when the readiness is measured for it. */
  examDate: string | null
}

/**
 * Per course readiness, with the same formula as the Sınavlar tab: for the nearest exam's notes when
 * the course has one, otherwise for all its notes. Courses with an exam first.
 */
export function courseReadiness(data: StudyData, now = new Date()): CourseReadiness[] {
  const exams = upcomingExams(data, now)
  return data.courses
    .filter((course) => data.cards.some((c) => c.courseId === course.id))
    .map((course) => {
      const exam = exams.find((e) => e.course.id === course.id)?.exam
      return { course, readiness: examReadiness(data, exam ?? { courseId: course.id, noteIds: [] }), examDate: exam?.date ?? null }
    })
    .sort((a, b) => (a.examDate ?? '9999').localeCompare(b.examDate ?? '9999') || a.course.name.localeCompare(b.course.name, 'tr'))
}
