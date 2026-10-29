import { describe, expect, it } from 'vitest'
import { clampDailyGoal, computeStreakSummary, localDayKey, mergeStudyDays, recordStudyActivity } from './streak'
import type { StudyDay } from './types'

const makeDay = (day: string, reviews: number, quizzes = 0): StudyDay => ({
  id: `id-${day}`,
  day,
  reviews,
  quizzes,
  createdAt: `${day}T10:00:00.000Z`,
  updatedAt: `${day}T10:00:00.000Z`,
})

describe('streak and daily goal', () => {
  it('uses local calendar date rather than UTC for day boundaries', () => {
    const localLateNight = new Date(2026, 3, 19, 23, 45, 0) // April 19, 2026 23:45 local time
    expect(localDayKey(localLateNight)).toBe('2026-04-19')
  })

  it('counts a day as studied when at least 1 card is reviewed OR 1 quiz/exam is finished', () => {
    const now = new Date(2026, 3, 19, 14, 0, 0)
    const empty = computeStreakSummary([], 20, now)
    expect(empty.studiedToday).toBe(false)
    expect(empty.streak).toBe(0)

    const withQuizOnly = computeStreakSummary([makeDay('2026-04-19', 0, 1)], 20, now)
    expect(withQuizOnly.studiedToday).toBe(true)
    expect(withQuizOnly.streak).toBe(1)

    const withReviewOnly = computeStreakSummary([makeDay('2026-04-19', 1, 0)], 20, now)
    expect(withReviewOnly.studiedToday).toBe(true)
    expect(withReviewOnly.streak).toBe(1)
  })

  it('computes consecutive day streaks across studied days and preserves yesterday streak before today is studied', () => {
    const now = new Date(2026, 3, 19, 12, 0, 0) // 2026-04-19
    const days: StudyDay[] = [
      makeDay('2026-04-15', 10, 0),
      makeDay('2026-04-16', 0, 1), // studied via quiz
      makeDay('2026-04-17', 5, 0),
      makeDay('2026-04-18', 22, 1),
    ]

    // Before studying on 2026-04-19, the active streak from yesterday is still 4 days
    const beforeToday = computeStreakSummary(days, 20, now)
    expect(beforeToday.studiedToday).toBe(false)
    expect(beforeToday.streak).toBe(4)

    // Once studied on 2026-04-19, streak becomes 5 days
    const afterToday = computeStreakSummary([...days, makeDay('2026-04-19', 12, 0)], 20, now)
    expect(afterToday.studiedToday).toBe(true)
    expect(afterToday.streak).toBe(5)
    expect(afterToday.todayReviews).toBe(12)
    expect(afterToday.goalPercent).toBe(60)
    expect(afterToday.goalMet).toBe(false)
  })

  it('resets streak to 0 when both today and yesterday were missed', () => {
    const now = new Date(2026, 3, 19, 12, 0, 0)
    const days = [makeDay('2026-04-16', 15, 1), makeDay('2026-04-17', 8, 0)]
    const summary = computeStreakSummary(days, 20, now)
    expect(summary.streak).toBe(0)
  })

  it('records and increments card reviews and quizzes on the current local day without going below 0', () => {
    const now = new Date(2026, 3, 19, 9, 30, 0)
    const step1 = recordStudyActivity([], { reviews: 1 }, now, () => 'day-1')
    expect(step1.updated.day).toBe('2026-04-19')
    expect(step1.updated.reviews).toBe(1)
    expect(step1.updated.quizzes).toBe(0)

    const step2 = recordStudyActivity(step1.studyDays, { reviews: 2, quizzes: 1 }, now)
    expect(step2.studyDays).toHaveLength(1)
    expect(step2.updated.reviews).toBe(3)
    expect(step2.updated.quizzes).toBe(1)

    // Undo review does not drop below zero
    const step3 = recordStudyActivity(step2.studyDays, { reviews: -10 }, now)
    expect(step3.updated.reviews).toBe(0)
    expect(step3.updated.quizzes).toBe(1)
  })

  it('clamps daily goal to a valid range', () => {
    expect(clampDailyGoal(20)).toBe(20)
    expect(clampDailyGoal(0)).toBe(1)
    expect(clampDailyGoal(-5)).toBe(1)
    expect(clampDailyGoal(9999)).toBe(500)
    expect(clampDailyGoal('35')).toBe(35)
    expect(clampDailyGoal('abc', 20)).toBe(20)
  })

  it('adds up rows that two devices created for the same day', () => {
    const row = (id: string, reviews: number, quizzes: number) =>
      ({ id, day: '2026-10-29', reviews, quizzes, createdAt: '2026-10-29T08:00:00Z', updatedAt: `2026-10-29T0${id}:00:00Z` }) as StudyDay
    const [merged] = mergeStudyDays([row('1', 10, 0), row('2', 8, 1)])
    expect(merged).toMatchObject({ reviews: 18, quizzes: 1, updatedAt: '2026-10-29T02:00:00Z' })
    const summary = computeStreakSummary([row('1', 10, 0), row('2', 8, 1)], 20, new Date(2026, 9, 29, 15))
    expect(summary.todayReviews).toBe(18)
  })
})
