import { describe, expect, it } from 'vitest'
import { normalizeExam } from './exam'
import { DEFAULT_PLAN, loadExamPlan, planFormat, sanitizePlan, saveExamPlan } from './examPlan'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  }
}

describe('exam plan', () => {
  it('derives the format from the counts', () => {
    expect(planFormat({ mcqCount: 10, openCount: 0 })).toBe('test')
    expect(planFormat({ mcqCount: 0, openCount: 3 })).toBe('classic')
    expect(planFormat({ mcqCount: 20, openCount: 2 })).toBe('mixed')
  })

  it('falls back to defaults for broken or odd values', () => {
    expect(sanitizePlan(null)).toEqual(DEFAULT_PLAN)
    const plan = sanitizePlan({ mcqCount: 7, openCount: 0, minutes: -5, difficulty: 'brutal', info: 'x'.repeat(5000) })
    expect(plan.mcqCount).toBe(DEFAULT_PLAN.mcqCount)
    expect(plan.minutes).toBe(DEFAULT_PLAN.minutes)
    expect(plan.difficulty).toBe('medium')
    expect(plan.info).toHaveLength(2000)
  })

  it('remembers a plan per exam and uses the course plan for a new exam', () => {
    const storage = memoryStorage()
    const plan = { ...DEFAULT_PLAN, mcqCount: 20, openCount: 3, minutes: 75, info: 'Tanım ağırlıklı' }
    saveExamPlan(storage, 'c1', 'vize', plan)
    expect(loadExamPlan(storage, 'c1', 'vize')).toEqual(plan)
    expect(loadExamPlan(storage, 'c1', 'final')).toEqual(plan)
    expect(loadExamPlan(storage, 'c2', 'vize')).toEqual(DEFAULT_PLAN)
  })

  it('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } } as unknown as Storage
    expect(loadExamPlan(broken, 'c1', '')).toEqual(DEFAULT_PLAN)
    expect(() => saveExamPlan(broken, 'c1', '', DEFAULT_PLAN)).not.toThrow()
  })
})

describe('normalizeExam with a split', () => {
  const mcq = (n: number) => ({ type: 'mcq' as const, prompt: `Soru ${n}`, options: ['A', 'B', 'C', 'D'], answerIndex: 0, explanation: '', modelAnswer: '', source: '' })
  const open = (n: number) => ({ type: 'open' as const, prompt: `Klasik ${n}`, options: [], answerIndex: -1, explanation: '', modelAnswer: 'Cevap', source: '' })

  it('keeps at most the asked number of each type, in order', () => {
    const list = normalizeExam([mcq(1), open(1), mcq(2), mcq(3), open(2), open(3)], 'mixed', 4, { mcq: 2, open: 2 })
    expect(list.map((q) => q.prompt)).toEqual(['Soru 1', 'Klasik 1', 'Soru 2', 'Klasik 2'])
  })
})
