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
    expect(planFormat({ mcqCount: 10, openCount: 0, blankCount: 0 })).toBe('test')
    expect(planFormat({ mcqCount: 0, openCount: 3, blankCount: 0 })).toBe('classic')
    expect(planFormat({ mcqCount: 20, openCount: 2, blankCount: 0 })).toBe('mixed')
    expect(planFormat({ mcqCount: 0, openCount: 0, blankCount: 6 })).toBe('mixed')
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

  const blank = (answer: string, prompt = `${answer} ile ilgili ___ cümle.`) => ({ type: 'blank' as const, prompt, options: [], answerIndex: -1, explanation: '', modelAnswer: answer, source: '' })

  it('keeps at most the asked number of each type, ordered like a real exam', () => {
    const list = normalizeExam([mcq(1), open(1), blank('Ribozom'), mcq(2), mcq(3), open(2), open(3)], 'mixed', 5, { mcq: 2, open: 2, blank: 1 })
    expect(list.map((q) => q.type)).toEqual(['mcq', 'mcq', 'blank', 'open', 'open'])
  })

  it('gives fill-in-the-blank sentences one shared bank with words that fit nowhere', () => {
    const list = normalizeExam([blank('Ribozom'), blank('Mitokondri'), blank('Golgi')], 'mixed', 3, { mcq: 0, open: 0, blank: 3 }, {
      distractors: ['Lizozom', 'ribozom', 'Sentrozom', 'Koful', 'Plastit'],
      distractorCount: 3,
    })
    const bank = list[0].options
    expect(list.every((q) => q.options === bank || q.options.join() === bank.join())).toBe(true)
    // The answer duplicate ("ribozom") is not a distractor; three real extras are added.
    expect([...bank].sort()).toEqual(['Golgi', 'Koful', 'Lizozom', 'Mitokondri', 'Ribozom', 'Sentrozom'].sort())
    for (const q of list) expect(bank[q.answerIndex]).toBe(q.modelAnswer)
    expect(list[0].prompt).toContain('_____')
  })

  it('drops blanks with no gap, two gaps, a repeated answer, or when none were asked for', () => {
    const raw = [blank('A', 'Boşluksuz cümle.'), blank('B', '___ ve ___'), blank('C'), blank('c')]
    expect(normalizeExam(raw, 'mixed', 4, { mcq: 0, open: 0, blank: 4 }).map((q) => q.modelAnswer)).toEqual(['C'])
    expect(normalizeExam([blank('C')], 'mixed', 4, { mcq: 1, open: 1 })).toHaveLength(0)
    expect(normalizeExam([blank('C')], 'mixed', 4)).toHaveLength(0)
  })
})
