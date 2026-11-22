import { describe, expect, it } from 'vitest'
import { BIG_EXAMS, bigExamCountdown, bigExamFor, daysToBigExam } from './bigExams'

describe('YKS / LGS countdown', () => {
  it('lise counts down to YKS, ortaokul to LGS, others get none', () => {
    expect(bigExamFor('lise')?.name).toBe('YKS')
    expect(bigExamFor('ortaokul')?.name).toBe('LGS')
    expect(bigExamFor('universite')).toBeNull()
    expect(bigExamFor(null)).toBeNull()
  })

  it('uses the official 2027 days', () => {
    expect(BIG_EXAMS.yks.date).toBe('2027-06-19')
    expect(BIG_EXAMS.lgs.date).toBe('2027-06-13')
    // 13 June 2027 is a Sunday, 19 June a Saturday.
    expect(new Date(2027, 5, 13).getDay()).toBe(0)
    expect(new Date(2027, 5, 19).getDay()).toBe(6)
  })

  it('counts whole days, says yarın / bugün, and stops after the exam', () => {
    expect(daysToBigExam(BIG_EXAMS.yks, new Date(2026, 10, 22, 23, 30))).toBe(209)
    expect(bigExamCountdown(BIG_EXAMS.yks, new Date(2026, 10, 22, 9))).toBe('YKS’ye 209 gün')
    expect(bigExamCountdown(BIG_EXAMS.lgs, new Date(2027, 5, 12, 8))).toBe('LGS yarın')
    expect(bigExamCountdown(BIG_EXAMS.lgs, new Date(2027, 5, 13, 20))).toBe('LGS bugün')
    expect(bigExamCountdown(BIG_EXAMS.lgs, new Date(2027, 5, 14, 8))).toBeNull()
  })
})
