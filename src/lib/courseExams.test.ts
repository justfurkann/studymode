import { describe, expect, it } from 'vitest'
import { examCountdown, examDateForCard, examsForCourse, nearestExamFor, nextExamDate, upcomingExams } from './courseExams'
import { schedule } from './srs'
import type { Course, CourseExam } from './types'

const now = new Date(2026, 9, 30, 12)
const course = (id: string, examDate: string | null = null): Course => ({ id, name: id, color: '#000', examDate, createdAt: '', updatedAt: '' })
const exam = (o: Partial<CourseExam>): CourseExam => ({ id: Math.random().toString(), courseId: 'c1', kind: 'vize', title: null, date: '2026-11-07', weight: null, noteIds: [], createdAt: '', updatedAt: '', ...o })

describe('course exams', () => {
  it('shows the old single exam date when a course has no exam records', () => {
    const data = { courses: [course('c1', '2026-11-05')], courseExams: [] }
    const [legacy] = examsForCourse(data, 'c1')
    expect(legacy.date).toBe('2026-11-05')
    expect(examCountdown(legacy, now)?.text).toBe('Sınava 6 gün')
  })

  it('prefers real exam records over the old date', () => {
    const data = { courses: [course('c1', '2026-11-05')], courseExams: [exam({ date: '2026-11-20', kind: 'final' })] }
    expect(examsForCourse(data, 'c1').map((e) => e.kind)).toEqual(['final'])
  })

  it('finds the nearest upcoming exam that covers a note', () => {
    const data = {
      courses: [course('c1')],
      courseExams: [
        exam({ kind: 'quiz', date: '2026-10-28', noteIds: ['n1'] }), // already over
        exam({ kind: 'vize', date: '2026-11-07', noteIds: ['n2'] }), // other notes
        exam({ kind: 'final', date: '2026-12-20', noteIds: [] }), // whole course
      ],
    }
    expect(nearestExamFor(data, 'c1', 'n1', now)?.exam.kind).toBe('final')
    expect(nearestExamFor(data, 'c1', 'n2', now)?.exam.kind).toBe('vize')
    // Cards without a note are only covered by whole-course exams.
    expect(nearestExamFor(data, 'c1', null, now)?.exam.kind).toBe('final')
    expect(upcomingExams(data, now).map((e) => e.exam.kind)).toEqual(['vize', 'final'])
  })

  it('caps a card review interval by the exam covering its note', () => {
    const data = { courses: [course('c1')], courseExams: [exam({ date: '2026-11-07', noteIds: ['n1'] }), exam({ kind: 'final', date: '2027-01-20' })] }
    const card = { courseId: 'c1', noteId: 'n1' }
    expect(examDateForCard(data, card, now)).toBe('2026-11-07')
    const result = schedule({ interval: 30, ease: 2.5, reps: 5, lapses: 0 }, 'easy', now, examDateForCard(data, card, now))
    expect(result.interval).toBe(4) // 8 days to the midterm → at most half of it
    const other = schedule({ interval: 30, ease: 2.5, reps: 5, lapses: 0 }, 'easy', now, examDateForCard(data, { courseId: 'c1', noteId: 'n9' }, now))
    expect(other.interval).toBeGreaterThan(4)
  })

  it('writes countdowns in natural Turkish', () => {
    expect(examCountdown(exam({ kind: 'final', date: '2026-11-07' }), now)?.text).toBe('Finale 8 gün')
    expect(examCountdown(exam({ kind: 'butunleme', date: '2026-11-07' }), now)?.text).toBe('Bütünlemeye 8 gün')
    expect(examCountdown(exam({ kind: 'vize', date: '2026-10-31' }), now)?.text).toBe('Vize yarın')
    expect(examCountdown(exam({ kind: 'diger', title: 'Proje sunumu', date: '2026-11-07' }), now)?.text).toBe('Proje sunumu: 8 gün kaldı')
    expect(examCountdown(exam({ date: '2026-10-01' }), now)).toBeNull()
  })

  it('picks the next upcoming date to keep the old course date in sync', () => {
    expect(nextExamDate([{ date: '2026-12-20' }, { date: '2026-10-01' }, { date: '2026-11-07' }], now)).toBe('2026-11-07')
    expect(nextExamDate([{ date: '2026-10-01' }], now)).toBeNull()
  })
})
