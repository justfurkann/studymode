import type { Card } from './types'

export type Grade = 'again' | 'hard' | 'good' | 'easy'

const DAY = 24 * 60 * 60 * 1000
const MIN_EASE = 1.3
const RELEARN_MINUTES = 10

export interface ScheduleResult {
  due: string
  interval: number
  ease: number
  reps: number
  lapses: number
}

/** Whole days from `now` until the local start of `examDate`; null if there is no upcoming exam. */
export function daysUntil(examDate: string | null, now = new Date()): number | null {
  if (!examDate) return null
  const [y, m, d] = examDate.split('-').map(Number)
  if (!y || !m || !d) return null
  const exam = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((exam.getTime() - today.getTime()) / DAY)
}

/**
 * A small SM-2 style scheduler. Intervals are in days.
 * With an upcoming exam, intervals are capped so the card comes back
 * at least twice before the exam instead of being scheduled after it.
 */
export function schedule(card: Pick<Card, 'interval' | 'ease' | 'reps' | 'lapses'>, grade: Grade, now = new Date(), examDate: string | null = null): ScheduleResult {
  let { interval, ease, reps, lapses } = card

  if (grade === 'again') {
    return {
      due: new Date(now.getTime() + RELEARN_MINUTES * 60 * 1000).toISOString(),
      interval: 0,
      ease: Math.max(MIN_EASE, ease - 0.2),
      reps: 0,
      lapses: reps > 0 ? lapses + 1 : lapses,
    }
  }

  if (grade === 'hard') {
    interval = reps === 0 ? 1 : Math.max(1, interval * 1.2)
    ease = Math.max(MIN_EASE, ease - 0.15)
  } else if (grade === 'good') {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : interval * ease
  } else {
    interval = reps === 0 ? 4 : Math.max(interval + 1, interval * ease * 1.3)
    ease += 0.15
  }

  const left = daysUntil(examDate, now)
  if (left !== null && left > 0) interval = Math.min(interval, Math.max(1, Math.floor(left / 2)))

  interval = Math.round(interval * 10) / 10
  return {
    due: new Date(now.getTime() + Math.round(interval) * DAY).toISOString(),
    interval,
    ease: Math.round(ease * 100) / 100,
    reps: reps + 1,
    lapses,
  }
}

export function isDue(card: Pick<Card, 'due'>, now = new Date()): boolean {
  return Date.parse(card.due) <= now.getTime()
}

/** Short Turkish label for when a card will come back, e.g. "10 dk", "3 gün". */
export function intervalLabel(result: ScheduleResult, now = new Date()): string {
  const ms = Date.parse(result.due) - now.getTime()
  if (ms < 60 * 60 * 1000) return `${Math.max(1, Math.round(ms / 60000))} dk`
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days} gün`
  return `${Math.round(days / 30)} ay`
}

export const newCardState = (now = new Date()) => ({
  due: now.toISOString(),
  interval: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
})
