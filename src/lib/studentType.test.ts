import { describe, expect, it } from 'vitest'
import { axisBars, examWord, isTypeId, optionText, profileOf, QUESTIONS, resultOf, TYPE_ORDER, TYPES, type TypeId } from './studentType'

/** Answers someone who really is `id` would give: on each question, the option closest to that type. */
function answersOf(id: TypeId): number[] {
  const target = TYPES[id].profile
  return QUESTIONS.map((q) => {
    let best = 0
    let bestScore = -Infinity
    q.options.forEach((o, i) => {
      const score = Object.entries(o.delta).reduce((sum, [axis, v]) => sum + (v ?? 0) * target[axis as keyof typeof target], 0)
      if (score > bestScore) (bestScore = score), (best = i)
    })
    return best
  })
}

describe('which student type are you', () => {
  it('has 10 questions with 4 options each', () => {
    expect(QUESTIONS).toHaveLength(10)
    for (const q of QUESTIONS) expect(q.options).toHaveLength(4)
  })

  for (const id of TYPE_ORDER) {
    it(`a student who answers like "${TYPES[id].name}" gets that type`, () => {
      const result = resultOf(answersOf(id))
      expect(result.type.id).toBe(id)
      expect(result.runnerUp.id).not.toBe(id)
      expect(result.matches[0].percent).toBeGreaterThanOrEqual(result.matches[1].percent)
    })
  }

  it('every type comes up for a fair share of all possible answer sets (no type is a dead end, none dominates)', () => {
    // A fixed pseudo-random sample of answer sets (the full 4^10 takes seconds).
    let seed = 7
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    const counts: Record<string, number> = {}
    const total = 40_000
    for (let n = 0; n < total; n++) {
      const id = resultOf(QUESTIONS.map(() => Math.floor(rand() * 4))).type.id
      counts[id] = (counts[id] ?? 0) + 1
    }
    for (const id of TYPE_ORDER) {
      expect(counts[id] / total).toBeGreaterThan(0.04)
      expect(counts[id] / total).toBeLessThan(0.22)
    }
  })

  it('profiles stay within −1..1 and the bars name the side the student leans to', () => {
    const p = profileOf([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    for (const v of Object.values(p)) expect(Math.abs(v)).toBeLessThanOrEqual(1)
    const bars = axisBars({ plan: 0.8, depth: -0.4, social: 0, night: -1, style: 0 })
    expect(bars.map((b) => b.label)).toEqual(['Planlı', 'Sonuca odaklı', 'Grupla', 'Sabahçı'])
    expect(bars.map((b) => b.percent)).toEqual([90, 70, 50, 100])
  })

  it('match percentages run from best to worst', () => {
    const { matches } = resultOf(answersOf('gecekusu'))
    expect(matches).toHaveLength(8)
    for (let i = 1; i < matches.length; i++) expect(matches[i - 1].percent).toBeGreaterThanOrEqual(matches[i].percent)
    expect(matches[0].percent).toBeLessThanOrEqual(100)
    expect(matches.at(-1)!.percent).toBeGreaterThanOrEqual(0)
  })

  it('speaks each level’s language where the exam comes up, and every option has a picture and a reaction', () => {
    const morning = QUESTIONS.find((q) => q.id === 'sabah')!
    expect(morning.text(examWord('universite'))).toBe('Vize sabahı. Neredesin?')
    expect(morning.text(examWord('lise'))).toBe('Yazılı sabahı. Neredesin?')
    expect(morning.text(examWord('mezun'))).toBe('Sınav sabahı. Neredesin?')
    expect(optionText(QUESTIONS[0].options[1], examWord('lise'))).toBe('Plan mı? Kalkınca bakarız')
    for (const q of QUESTIONS) for (const o of q.options) expect(o.react.length).toBeGreaterThan(3)
    for (const id of TYPE_ORDER) expect(TYPES[id].you).toHaveLength(3)
  })

  it('every type has a buddy that is another type, and recognises ids', () => {
    for (const id of TYPE_ORDER) {
      expect(TYPES[TYPES[id].buddy]).toBeDefined()
      expect(TYPES[id].buddy).not.toBe(id)
    }
    expect(isTypeId('gecekusu')).toBe(true)
    expect(isTypeId('yok')).toBe(false)
  })
})
