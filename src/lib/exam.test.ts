import { describe, expect, it } from 'vitest'
import { examFromNotes, normalizeExam, noteForSource, scoreExam } from './exam'
import type { Note } from './types'

const mcq = { type: 'mcq' as const, prompt: 'Soru?', options: ['A', 'B', 'C', 'D'], answerIndex: 2, explanation: 'Çünkü', modelAnswer: '', source: ' kaynak ' }
const open = { type: 'open' as const, prompt: 'Açıkla.', options: [], answerIndex: -1, explanation: 'Kriter', modelAnswer: 'Tam cevap', source: '' }

describe('normalizeExam', () => {
  it('keeps the requested format and drops malformed questions', () => {
    const raw = [mcq, open, { ...mcq, answerIndex: 9 }, { ...open, modelAnswer: ' ' }]
    expect(normalizeExam(raw, 'mixed', 10).map((q) => q.type)).toEqual(['mcq', 'open'])
    expect(normalizeExam(raw, 'test', 10).map((q) => q.type)).toEqual(['mcq'])
    expect(normalizeExam(raw, 'classic', 10).map((q) => q.type)).toEqual(['open'])
    expect(normalizeExam([mcq, mcq, mcq], 'test', 2)).toHaveLength(2)
    expect(normalizeExam([mcq], 'test', 1)[0].source).toBe('kaynak')
  })
})

describe('examFromNotes', () => {
  it('mixes prepared questions from all notes', () => {
    const note = (title: string, n: number) =>
      ({ title, questions: Array.from({ length: n }, (_, i) => ({ id: `${title}${i}`, prompt: `${title} ${i}`, options: ['a', 'b'], answerIndex: 0, explanation: '', source: null })) }) as unknown as Note
    const exam = examFromNotes([note('X', 3), note('Y', 3)], 4, () => 0.5)
    expect(exam).toHaveLength(4)
    expect(new Set(exam.map((q) => q.noteTitle))).toEqual(new Set(['X', 'Y']))
  })
})

describe('scoreExam', () => {
  it('scores multiple choice and uses grader scores for open answers', () => {
    const questions = normalizeExam([mcq, mcq, open, open], 'mixed', 4)
    const result = scoreExam(questions, [2, 0, 'cevabım', ''], new Map([[2, { score: 0.5, feedback: 'Eksik' }]]))
    expect(result.scores).toEqual([1, 0, 0.5, 0])
    expect(result.total).toBe(1.5)
    expect(result.feedback[3]).toBe('Cevap verilmedi.')
  })
})

describe('noteForSource', () => {
  it('finds the note that contains a quoted passage', () => {
    const notes = [
      { id: 'n1', content: 'Mitokondri enerji üretir.' },
      { id: 'n2', content: 'Slayt 4\nRibozom protein sentezini gerçekleştirir.' },
    ] as Note[]
    expect(noteForSource(notes, 'ribozom protein sentezini')?.id).toBe('n2')
    expect(noteForSource(notes, 'Hiç geçmeyen bir cümle')).toBeNull()
    expect(noteForSource(notes, null)).toBeNull()
  })
})
