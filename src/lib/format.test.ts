import { describe, expect, it } from 'vitest'
import { cardMastery } from './format'
import type { Card } from './types'

const card = (reps: number, interval: number, lapses = 0) => ({ reps, interval, lapses }) as Card

describe('cardMastery', () => {
  it('splits cards into new, learning and mastered', () => {
    const result = cardMastery([card(0, 0), card(0, 0, 1), card(2, 3), card(6, 21), card(8, 40)])
    expect(result).toEqual({ fresh: 1, learning: 2, mastered: 2, total: 5, percent: 40 })
  })

  it('handles a course without cards', () => {
    expect(cardMastery([]).percent).toBe(0)
  })
})
