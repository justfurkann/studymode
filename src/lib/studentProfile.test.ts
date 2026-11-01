import { describe, expect, it } from 'vitest'
import { fromQuiz, newer, parseSaved, resultPath } from './studentProfile'
import { resultOf } from './studentType'

describe('student type on the profile', () => {
  const result = resultOf([3, 3, 0, 1, 3, 1, 1, 0, 1, 3])
  const saved = fromQuiz(result, 'universite', 'ODTÜ', new Date('2026-11-01T10:00:00Z'))

  it('keeps the type, the fit, the four axes, level and school', () => {
    expect(saved.type).toBe(result.type.id)
    expect(saved.axes).toHaveLength(4)
    for (const n of saved.axes) expect(Math.abs(n)).toBeLessThanOrEqual(100)
    expect(saved).toMatchObject({ level: 'universite', school: 'ODTÜ', runnerUp: result.runnerUp.id, at: '2026-11-01T10:00:00.000Z' })
  })

  it('reads back what it wrote and rejects junk', () => {
    expect(parseSaved(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    expect(parseSaved({ type: 'yok', at: 'x' })).toBeNull()
    expect(parseSaved(null)).toBeNull()
    expect(parseSaved({ type: 'kasif', at: '2026', axes: [500, -500], percent: 300, level: 'uzay' })).toEqual({ type: 'kasif', at: '2026', axes: [100, -100, 0, 0], percent: 100, level: null, school: '', runnerUp: null })
  })

  it('links to the same card', () => {
    const path = resultPath(saved)
    expect(path).toMatch(new RegExp(`^/ogrenci-tipi\\?tip=${saved.type}&p=`))
    expect(path).toContain('okul=ODT%C3%9C')
  })

  it('the newest result wins, wherever it was taken', () => {
    const older = { ...saved, type: 'avci' as const, at: '2026-10-01T00:00:00Z' }
    expect(newer(older, saved)).toBe(saved)
    expect(newer(saved, older)).toBe(saved)
    expect(newer(null, older)).toBe(older)
  })
})
