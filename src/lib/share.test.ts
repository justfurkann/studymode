import { describe, expect, it } from 'vitest'
import { buildSnapshot, newToken, parseSnapshot, snapshotCounts } from './share'
import { emptyData, type StudyData } from './types'

const T = '2026-10-01T00:00:00Z'
const now = new Date(2026, 9, 31, 10)

function sample(): StudyData {
  return {
    ...emptyData(),
    courses: [
      { id: 'c1', name: 'Biyoloji', color: '#0f9b8e', examDate: '2026-11-10', createdAt: T, updatedAt: T },
      { id: 'c2', name: 'Tarih', color: '#e5484d', examDate: null, createdAt: T, updatedAt: T },
    ],
    notes: [
      {
        id: 'n2',
        courseId: 'c1',
        title: 'Doku',
        content: 'Doku metni',
        summary: null,
        questions: [],
        practice: [],
        generator: null,
        createdAt: '2026-10-03T00:00:00Z',
        updatedAt: T,
      },
      {
        id: 'n1',
        courseId: 'c1',
        title: 'Hücre',
        content: 'Hücre metni',
        summary: { overview: 'Özet', points: ['p'], keyTerms: [{ term: 'Zar', definition: 'Sınır' }], tags: ['vize'], completedSteps: ['tanis', 'anla'], checkedTerms: ['Zar'], origin: 'demo' },
        questions: [{ id: 'q1', prompt: 'Soru?', options: ['a', 'b'], answerIndex: 1, explanation: 'Çünkü', source: null }],
        practice: [{ id: 'p1', question: 'Anlat', answer: 'Model', hint: 'İpucu', draft: 'Benim gizli cevabım', evaluation: { score: 0.4, feedback: 'Eksik', gradedAt: T } }],
        generator: 'ai',
        createdAt: '2026-10-02T00:00:00Z',
        updatedAt: T,
      },
      { id: 'n3', courseId: 'c2', title: 'Osmanlı', content: 'x', summary: null, questions: [], practice: [], generator: null, createdAt: T, updatedAt: T },
    ],
    cards: [
      { id: 'k1', courseId: 'c1', noteId: 'n1', front: 'Zar?', back: 'Sınır', source: null, due: T, interval: 30, ease: 2.7, reps: 6, lapses: 2, createdAt: T, updatedAt: T },
      { id: 'k2', courseId: 'c1', noteId: null, front: 'Elle', back: 'Kart', source: null, due: T, interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: T, updatedAt: T },
      { id: 'k3', courseId: 'c2', noteId: 'n3', front: 'Başka', back: 'Ders', source: null, due: T, interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: T, updatedAt: T },
    ],
    attempts: [{ id: 'a1', courseId: 'c1', noteId: 'n1', score: 1, total: 5, wrongIds: [], createdAt: T }],
    courseExams: [
      { id: 'e1', courseId: 'c1', kind: 'vize', title: null, date: '2026-11-10', weight: 40, noteIds: ['n1'], createdAt: T, updatedAt: T },
      { id: 'e0', courseId: 'c1', kind: 'quiz', title: null, date: '2026-10-10', weight: null, noteIds: [], createdAt: T, updatedAt: T },
    ],
  }
}

describe('course snapshot', () => {
  it('carries the content of one course and none of the owner progress', () => {
    const s = buildSnapshot(sample(), 'c1', now)!
    expect(s.course).toEqual({ name: 'Biyoloji', color: '#0f9b8e' })
    expect(s.notes.map((n) => n.title)).toEqual(['Hücre', 'Doku'])
    expect(s.notes[0].summary).toEqual({ overview: 'Özet', points: ['p'], keyTerms: [{ term: 'Zar', definition: 'Sınır' }], tags: ['vize'] })
    expect(s.notes[0].practice).toEqual([{ question: 'Anlat', answer: 'Model', hint: 'İpucu' }])
    expect(s.notes[0].questions[0]).not.toHaveProperty('id')
    expect(s.cards).toEqual([
      { front: 'Zar?', back: 'Sınır', source: null, note: 0 },
      { front: 'Elle', back: 'Kart', source: null, note: null },
    ])
    // Only upcoming exams, with coverage pointing at the shared notes.
    expect(s.exams).toEqual([{ kind: 'vize', title: null, date: '2026-11-10', weight: 40, notes: [0] }])
    const text = JSON.stringify(s)
    for (const secret of ['Benim gizli cevabım', 'Eksik', 'completedSteps', 'checkedTerms', 'reps', 'lapses', 'Osmanlı', 'wrongIds']) expect(text).not.toContain(secret)
    expect(snapshotCounts(s)).toEqual({ notes: 2, cards: 2, questions: 1, exams: 1 })
  })

  it('survives a round trip through JSON and rejects broken or hostile data', () => {
    const s = buildSnapshot(sample(), 'c1', now)!
    expect(parseSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s)
    expect(parseSnapshot({ ...s, v: 2 })).toBeNull()
    expect(parseSnapshot({ ...s, cards: [{ front: 'a', back: 'b', source: null, note: 9 }] })).toBeNull()
    expect(parseSnapshot({ ...s, exams: [{ ...s.exams[0], notes: [5] }] })).toBeNull()
    expect(parseSnapshot({ ...s, course: { name: '', color: '#000' } })).toBeNull()
    expect(parseSnapshot('nope')).toBeNull()
  })

  it('returns nothing for an unknown course', () => {
    expect(buildSnapshot(sample(), 'nope', now)).toBeNull()
  })
})

describe('share token', () => {
  it('is 22 letters and digits and practically never repeats', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => newToken()))
    expect(tokens.size).toBe(500)
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9]{22}$/)
  })
})
