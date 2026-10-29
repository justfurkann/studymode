import { describe, expect, it } from 'vitest'
import { AiError, localExplainConcept, mergeStudySets, normalizeStudySet, splitNoteIntoChunks, type RawStudySet } from './index'

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

describe('splitNoteIntoChunks & mergeStudySets', () => {
  it('splits long notes on paragraph boundaries without dropping middle content', () => {
    const p1 = 'Birinci bölüm: ' + 'A'.repeat(120)
    const p2 = 'Orta bölüm (önemli konu): ' + 'B'.repeat(120)
    const p3 = 'Son bölüm: ' + 'C'.repeat(120)
    const full = `${p1}\n\n${p2}\n\n${p3}`

    const chunks = splitNoteIntoChunks(full, 200)
    expect(chunks.length).toBe(3)
    expect(chunks[0]).toContain('Birinci bölüm')
    expect(chunks[1]).toContain('Orta bölüm (önemli konu)')
    expect(chunks[2]).toContain('Son bölüm')
  })

  it('merges study sets from multiple chunks and deduplicates repeated items', () => {
    const set1 = normalizeStudySet(base)
    const set2 = normalizeStudySet({
      summary: {
        overview: 'Bölüm 2 özeti.',
        points: ['Mitokondri enerji üretir.', 'Lizozom sindirim yapar.'],
        keyTerms: [
          { term: 'Ribozom', definition: 'Protein sentezler.' },
          { term: 'Lizozom', definition: 'Hücre içi sindirim.' },
        ],
      },
      cards: [{ front: 'Lizozom ne yapar?', back: 'Sindirim yapar.', source: 'Lizozom: ...' }],
      questions: [
        {
          prompt: 'Hücre içi sindirim nerede gerçekleşir?',
          options: ['Lizozom', 'Ribozom', 'Çekirdek', 'Golgi'],
          answerIndex: 0,
          explanation: 'Lizozom enzimleri sindirim yapar.',
          source: 'Lizozom sindirim yapar.',
        },
      ],
      practice: [{ question: 'Lizozomun görevini açıkla.', answer: 'Sindirim.', hint: 'Enzim' }],
    })

    const merged = mergeStudySets([set1, set2])
    expect(merged.summary.overview).toBe('Hücre yapıları. Bölüm 2 özeti.')
    expect(merged.summary.points).toEqual(['Mitokondri enerji üretir.', 'Lizozom sindirim yapar.'])
    expect(merged.summary.keyTerms).toHaveLength(2)
    expect(merged.cards).toHaveLength(2)
    expect(merged.questions).toHaveLength(2)
    expect(merged.practice).toHaveLength(2)
  })

  it('provides structured local explanations for all 3 modes', () => {
    const context = 'Mitokondri ökaryot hücrelerde oksijenli solunum ile ATP enerjisi üreten organeldir. Hücrenin enerji ihtiyacı arttığında mitokondri sayısı da artar.'
    expect(localExplainConcept({ title: 'Biyoloji', topic: 'Mitokondri', context, mode: 'simple' })).toContain('Kısaca ifade etmek gerekirse')
    expect(localExplainConcept({ title: 'Biyoloji', topic: 'Mitokondri', context, mode: 'example' })).toContain('somutlaştırmak için')
    expect(localExplainConcept({ title: 'Biyoloji', topic: 'Mitokondri', context, mode: 'step_by_step' })).toContain('1. Adım:')
  })
})

