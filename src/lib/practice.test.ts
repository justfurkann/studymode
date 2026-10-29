import { describe, expect, it } from 'vitest'
import { answeredCount, canCompletePractice, isMeaningfulAnswer } from './practice'
import type { PracticeItem } from './types'

const item = (draft?: string, graded = false): PracticeItem => ({
  id: Math.random().toString(),
  question: 'Soru?',
  answer: 'Cevap',
  hint: null,
  draft,
  evaluation: graded ? { score: 0.5, feedback: 'İyi', gradedAt: '2026-10-30T10:00:00Z' } : null,
})

describe('practice answers', () => {
  it('only counts answers that actually say something', () => {
    expect(isMeaningfulAnswer('')).toBe(false)
    expect(isMeaningfulAnswer('a')).toBe(false)
    expect(isMeaningfulAnswer('bilmiyorum ki')).toBe(false)
    expect(isMeaningfulAnswer('................................')).toBe(false)
    expect(isMeaningfulAnswer('Mitokondri hücrede enerji üreten organeldir.')).toBe(true)
  })

  it('allows finishing step 5 only after a real answer or a grading', () => {
    expect(canCompletePractice({ practice: [item(), item('kısa')] })).toBe(false)
    expect(canCompletePractice({ practice: [item(), item('Ribozom amino asitleri birleştirerek protein yapar.')] })).toBe(true)
    expect(canCompletePractice({ practice: [item('', true)] })).toBe(true)
    expect(answeredCount([item(), item('', true), item('Hücre zarı seçici geçirgen bir yapıdır.')])).toBe(2)
  })
})
