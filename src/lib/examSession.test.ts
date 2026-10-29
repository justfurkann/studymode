import { describe, expect, it } from 'vitest'
import { clearActiveExam, examStorageKey, loadActiveExam, saveActiveExam, secondsRemaining, type ActiveExamDraft } from './examSession'

function memoryStorage() {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), map }
}

const draft = (overrides: Partial<ActiveExamDraft> = {}): ActiveExamDraft => ({
  questions: [{ id: 'q1', type: 'mcq', prompt: 'Soru?', options: ['a', 'b'], answerIndex: 0, explanation: '', modelAnswer: '', source: null, noteTitle: null }],
  answers: [1],
  endsAt: null,
  minutes: 0,
  startedAt: 1,
  examSource: 'local',
  format: 'test',
  difficulty: 'medium',
  useAi: false,
  noteIds: ['n1'],
  ...overrides,
})

describe('active exam storage', () => {
  it('keeps exams per course', () => {
    const storage = memoryStorage()
    saveActiveExam(storage, 'A', draft())
    expect(loadActiveExam(storage, 'A')?.answers).toEqual([1])
    expect(loadActiveExam(storage, 'B')).toBeNull()
    clearActiveExam(storage, 'A')
    expect(loadActiveExam(storage, 'A')).toBeNull()
  })

  it('removes broken or mismatched entries instead of retrying them on every visit', () => {
    const storage = memoryStorage()
    storage.setItem(examStorageKey('A'), '{not json')
    expect(loadActiveExam(storage, 'A')).toBeNull()
    expect(storage.map.has(examStorageKey('A'))).toBe(false)
    storage.setItem(examStorageKey('B'), JSON.stringify(draft({ answers: [] })))
    expect(loadActiveExam(storage, 'B')).toBeNull()
    expect(storage.map.has(examStorageKey('B'))).toBe(false)
  })

  it('returns an exam whose time ran out so it can be submitted with the answers given', () => {
    const storage = memoryStorage()
    saveActiveExam(storage, 'A', draft({ endsAt: Date.now() - 60_000, minutes: 15 }))
    const loaded = loadActiveExam(storage, 'A')
    expect(loaded?.answers).toEqual([1])
    expect(secondsRemaining(loaded!.endsAt)).toBe(0)
    expect(secondsRemaining(null)).toBeNull()
  })
})
