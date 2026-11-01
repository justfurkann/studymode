import { describe, expect, it } from 'vitest'
import { computeXp, levelOf, levelTitle, nextTitle, xpForLevel } from './xp'
import { emptyData } from './types'

describe('XP and levels', () => {
  it('levels need 100, 300, 600, 1000… XP in total', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000])
    expect(levelOf(0)).toMatchObject({ level: 1, into: 0, span: 100, toNext: 100, progress: 0 })
    expect(levelOf(99).level).toBe(1)
    expect(levelOf(100)).toMatchObject({ level: 2, into: 0, span: 200 })
    expect(levelOf(450)).toMatchObject({ level: 3, into: 150, span: 300, toNext: 150, progress: 0.5 })
    expect(levelOf(-5).level).toBe(1)
  })

  it('titles change at set levels', () => {
    expect(levelTitle(1)).toBe('Çaylak')
    expect(levelTitle(4)).toBe('Not Avcısı')
    expect(levelTitle(5)).toBe('Kart Ustası')
    expect(levelTitle(99)).toBe('Efsane')
    expect(nextTitle(5)).toEqual({ level: 8, title: 'Fosforlu Kalem' })
    expect(nextTitle(40)).toBeNull()
  })

  it('XP comes from what was done, with a breakdown', () => {
    const data = emptyData()
    data.studyDays = [
      { id: 'a', day: '2026-11-01', reviews: 30, quizzes: 2, actions: 1, createdAt: '', updatedAt: '' },
      { id: 'b', day: '2026-11-02', reviews: 10, quizzes: 0, createdAt: '', updatedAt: '' },
      // Another device, same day: counts add up.
      { id: 'c', day: '2026-11-02', reviews: 5, quizzes: 0, createdAt: '', updatedAt: '' },
    ]
    data.attempts = [
      { id: 'q1', courseId: 'c', noteId: 'n', score: 5, total: 5, wrongIds: [], createdAt: '' },
      { id: 'q2', courseId: 'c', noteId: 'n', score: 3, total: 5, wrongIds: [], createdAt: '' },
    ]
    data.notes = [{ generator: 'ai' }, { generator: null }] as never
    const xp = computeXp(data, { dedektif: 'x', glitch: 'y' })
    const by = Object.fromEntries(xp.parts.map((p) => [p.key, p]))
    expect(by.review).toMatchObject({ count: 45, xp: 90 })
    expect(by.quiz).toMatchObject({ count: 2, xp: 30 })
    expect(by.perfect).toMatchObject({ count: 1, xp: 10 })
    expect(by.note).toMatchObject({ count: 1, xp: 20 })
    expect(by.action).toMatchObject({ count: 1, xp: 3 })
    expect(by.day).toMatchObject({ count: 2, xp: 20 })
    // Dedektif is Destansı (100), Glitch Hunter Efsanevi (250).
    expect(by.achievement).toMatchObject({ count: 2, xp: 350 })
    expect(xp.total).toBe(90 + 30 + 10 + 20 + 3 + 20 + 350)
  })
})
