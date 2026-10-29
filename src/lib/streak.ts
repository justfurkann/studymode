import type { StudyDay } from './types'

export const DEFAULT_DAILY_GOAL = 20
export const MIN_DAILY_GOAL = 1
export const MAX_DAILY_GOAL = 500

export function clampDailyGoal(value: unknown, fallback = DEFAULT_DAILY_GOAL): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(MAX_DAILY_GOAL, Math.max(MIN_DAILY_GOAL, Math.round(num)))
}

/** Formats a Date as YYYY-MM-DD in the user's local timezone. */
export function localDayKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Steps back `offsetDays` local calendar days from `dayKey` (YYYY-MM-DD). */
export function shiftLocalDay(dayKey: string, offsetDays: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(y, m - 1, d + offsetDays, 12, 0, 0)
  return localDayKey(date)
}

/** A day counts as studied if at least 1 card was reviewed or at least 1 quiz/exam was completed. */
export function isDayStudied(day: Pick<StudyDay, 'reviews' | 'quizzes'> | undefined): boolean {
  if (!day) return false
  return day.reviews >= 1 || day.quizzes >= 1
}

/**
 * Combines rows for the same `day`. Each row has its own id and records activity from one device
 * (or from guest use before signing in), so the counts add up.
 */
export function mergeStudyDays(days: StudyDay[]): StudyDay[] {
  const byDay = new Map<string, StudyDay>()
  for (const item of days) {
    const existing = byDay.get(item.day)
    if (!existing) {
      byDay.set(item.day, item)
    } else {
      byDay.set(item.day, {
        ...existing,
        reviews: existing.reviews + item.reviews,
        quizzes: existing.quizzes + item.quizzes,
        updatedAt: existing.updatedAt >= item.updatedAt ? existing.updatedAt : item.updatedAt,
      })
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

/**
 * Updates or creates today's `StudyDay` record in local time.
 * Returns both the updated array and the single upserted `StudyDay` row for persistence.
 */
export function recordStudyActivity(
  studyDays: StudyDay[],
  delta: { reviews?: number; quizzes?: number },
  now: Date = new Date(),
  makeId: () => string = () => crypto.randomUUID(),
): { studyDays: StudyDay[]; updated: StudyDay } {
  const today = localDayKey(now)
  const iso = now.toISOString()
  const existing = studyDays.find((d) => d.day === today)
  const updated: StudyDay = existing
    ? {
        ...existing,
        reviews: Math.max(0, existing.reviews + (delta.reviews ?? 0)),
        quizzes: Math.max(0, existing.quizzes + (delta.quizzes ?? 0)),
        updatedAt: iso,
      }
    : {
        id: makeId(),
        day: today,
        reviews: Math.max(0, delta.reviews ?? 0),
        quizzes: Math.max(0, delta.quizzes ?? 0),
        createdAt: iso,
        updatedAt: iso,
      }

  const next = existing ? studyDays.map((d) => (d.id === existing.id ? updated : d)) : [...studyDays, updated]
  return { studyDays: next, updated }
}

export interface StreakSummary {
  todayKey: string
  todayReviews: number
  todayQuizzes: number
  dailyGoal: number
  goalPercent: number
  goalMet: boolean
  studiedToday: boolean
  /** Consecutive studied days ending today (or ending yesterday if not yet studied today). */
  streak: number
}

export function computeStreakSummary(studyDays: StudyDay[], dailyGoal = DEFAULT_DAILY_GOAL, now: Date = new Date()): StreakSummary {
  const goal = clampDailyGoal(dailyGoal)
  const merged = mergeStudyDays(studyDays)
  const byDay = new Map(merged.map((d) => [d.day, d]))
  const todayKey = localDayKey(now)
  const todayRecord = byDay.get(todayKey)
  const todayReviews = todayRecord?.reviews ?? 0
  const todayQuizzes = todayRecord?.quizzes ?? 0
  const studiedToday = isDayStudied(todayRecord)

  let streak = 0
  let cursor = studiedToday ? todayKey : shiftLocalDay(todayKey, -1)
  while (isDayStudied(byDay.get(cursor))) {
    streak += 1
    cursor = shiftLocalDay(cursor, -1)
  }

  const goalPercent = Math.min(100, Math.round((todayReviews / goal) * 100))
  const goalMet = todayReviews >= goal

  return {
    todayKey,
    todayReviews,
    todayQuizzes,
    dailyGoal: goal,
    goalPercent,
    goalMet,
    studiedToday,
    streak,
  }
}
