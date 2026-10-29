import { describe, expect, it } from 'vitest'
import { daysUntil, intervalLabel, isDue, newCardState, schedule } from './srs'

const now = new Date(2026, 9, 29, 12, 0, 0)

describe('schedule', () => {
  it('moves a new card through the learning steps', () => {
    const first = schedule(newCardState(now), 'good', now)
    expect(first.interval).toBe(1)
    expect(first.reps).toBe(1)
    const second = schedule(first, 'good', now)
    expect(second.interval).toBe(3)
    const third = schedule(second, 'good', now)
    expect(third.interval).toBe(7.5)
  })

  it('brings a forgotten card back within minutes and counts the lapse', () => {
    const learned = { interval: 10, ease: 2.5, reps: 4, lapses: 0 }
    const result = schedule(learned, 'again', now)
    expect(result.interval).toBe(0)
    expect(result.reps).toBe(0)
    expect(result.lapses).toBe(1)
    expect(result.ease).toBe(2.3)
    expect(intervalLabel(result, now)).toBe('10 dk')
  })

  it('never lets ease fall below the minimum', () => {
    let state = { interval: 5, ease: 1.35, reps: 3, lapses: 0 }
    state = { ...state, ...schedule(state, 'hard', now) }
    expect(state.ease).toBe(1.3)
  })

  it('rewards easy answers with longer gaps', () => {
    const good = schedule({ interval: 10, ease: 2.5, reps: 3, lapses: 0 }, 'good', now)
    const easy = schedule({ interval: 10, ease: 2.5, reps: 3, lapses: 0 }, 'easy', now)
    expect(easy.interval).toBeGreaterThan(good.interval)
  })

  it('keeps reviews before an upcoming exam', () => {
    const result = schedule({ interval: 20, ease: 2.5, reps: 5, lapses: 0 }, 'easy', now, '2026-11-08')
    expect(result.interval).toBe(5)
  })
})

describe('daysUntil and isDue', () => {
  it('counts calendar days to an exam', () => {
    expect(daysUntil('2026-11-01', now)).toBe(3)
    expect(daysUntil('2026-10-29', now)).toBe(0)
    expect(daysUntil(null, now)).toBeNull()
  })

  it('treats cards due now as due', () => {
    expect(isDue({ due: now.toISOString() }, now)).toBe(true)
    expect(isDue({ due: new Date(now.getTime() + 1000).toISOString() }, now)).toBe(false)
  })
})
