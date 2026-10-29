import { describe, expect, it } from 'vitest'
import { AiError, normalizeStudySet, type RawStudySet } from './ai'

const base: RawStudySet = {
  summary: { overview: ' Hücre  yapıları. ', points: ['Mitokondri enerji üretir.', ' '], keyTerms: [{ term: 'Ribozom', definition: 'Protein sentezler.' }] },
  cards: [
    { front: 'Mitokondri ne yapar?', back: 'Enerji üretir.', source: 'Mitokondri: ...' },
    { front: '', back: 'boş', source: '' },
  ],
  questions: [
    { prompt: 'Protein sentezi nerede olur?', options: ['Ribozom', 'Lizozom', 'Çekirdek', 'Zar'], answerIndex: 0, explanation: 'Notta yazıyor.', source: '' },
    { prompt: 'Bozuk', options: ['A', 'B'], answerIndex: 5, explanation: '', source: '' },
    { prompt: 'Tekrarlı', options: ['A', 'A', 'B', 'C'], answerIndex: 0, explanation: '', source: '' },
  ],
  practice: [{ question: 'Mitokondri ile ribozomu karşılaştır.', answer: 'İkisi de...', hint: '' }],
}

describe('normalizeStudySet', () => {
  it('keeps valid items and drops malformed ones', () => {
    const set = normalizeStudySet(base)
    expect(set.summary.overview).toBe('Hücre yapıları.')
    expect(set.summary.points).toEqual(['Mitokondri enerji üretir.'])
    expect(set.cards).toHaveLength(1)
    expect(set.questions).toHaveLength(1)
    expect(set.questions[0].source).toBeNull()
    expect(set.practice[0].hint).toBeNull()
  })

  it('rejects an empty result', () => {
    expect(() =>
      normalizeStudySet({ summary: { overview: '', points: [], keyTerms: [] }, cards: [], questions: [], practice: [] }),
    ).toThrow(AiError)
  })
})
