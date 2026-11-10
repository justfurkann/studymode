import { describe, expect, it } from 'vitest'
import {
  cleanExamTime,
  courseExamPhrase,
  examCountdown,
  examDateForCard,
  examDrafts,
  examEnded,
  examsAwaitingGrade,
  examsForCourse,
  finishedExams,
  nearestExamFor,
  nextExamDate,
  nextExamToAdd,
  parseGrade,
  upcomingExams,
} from './courseExams'
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

  it('names the course and puts the suffix on the exam word', () => {
    expect(courseExamPhrase('Biyoloji', { kind: 'vize', title: null }, 8)).toBe('Biyoloji vizesine 8 gün kaldı')
    expect(courseExamPhrase('Biyoloji', { kind: 'final', title: null }, 1)).toBe('Biyoloji finali yarın')
    expect(courseExamPhrase('Biyoloji', { kind: 'diger', title: null }, 0)).toBe('Biyoloji sınavı bugün')
    expect(courseExamPhrase('Biyoloji', { kind: 'diger', title: 'Proje sunumu' }, 5)).toBe('Biyoloji · Proje sunumu: 5 gün kaldı')
  })
})

describe('finished exams: time, grade, what comes next', () => {
  it('ends an exam one hour after its start time, or at the end of the day without one', () => {
    const timed = exam({ date: '2026-10-30', time: '10:00' })
    expect(examEnded(timed, new Date(2026, 9, 30, 10, 59))).toBe(false)
    expect(examEnded(timed, new Date(2026, 9, 30, 11, 0))).toBe(true)
    const untimed = exam({ date: '2026-10-30' })
    expect(examEnded(untimed, new Date(2026, 9, 30, 23, 59))).toBe(false)
    expect(examEnded(untimed, new Date(2026, 9, 31, 0, 0))).toBe(true)
    // An evening exam that runs past midnight is still "today" until it ends.
    const late = exam({ date: '2026-10-30', time: '23:30' })
    expect(examCountdown(late, new Date(2026, 9, 31, 0, 10))?.text).toBe('Vize bugün 23:30')
    expect(examCountdown(late, new Date(2026, 9, 31, 0, 30))).toBeNull()
  })

  it('accepts the time formats people type and rejects the rest', () => {
    expect(cleanExamTime('9:30')).toBe('09:30')
    expect(cleanExamTime('09.30')).toBe('09:30')
    expect(cleanExamTime('13:45:00')).toBe('13:45')
    expect(cleanExamTime('25:00')).toBeNull()
    expect(cleanExamTime('')).toBeNull()
    expect(cleanExamTime(undefined)).toBeNull()
  })

  it('moves an exam from the calendar to the finished list once it is over', () => {
    const data = { courses: [course('c1')], courseExams: [exam({ id: 'v', date: '2026-10-30', time: '10:00' }), exam({ id: 'f', kind: 'final', date: '2026-12-20' })] }
    const before = new Date(2026, 9, 30, 9)
    expect(upcomingExams(data, before).map((e) => e.exam.id)).toEqual(['v', 'f'])
    expect(examCountdown(data.courseExams[0], before)?.text).toBe('Vize bugün 10:00')
    expect(finishedExams(data, before)).toEqual([])
    expect(upcomingExams(data, now).map((e) => e.exam.id)).toEqual(['f'])
    expect(finishedExams(data, now).map((e) => e.exam.id)).toEqual(['v'])
    // The old single course date and card scheduling follow the next exam that is still ahead.
    expect(nextExamDate(data.courseExams, now)).toBe('2026-12-20')
    expect(examDateForCard(data, { courseId: 'c1', noteId: null }, now)).toBe('2026-12-20')
  })

  it('waits for a grade until one is entered, and stops asking about old exams', () => {
    const data = {
      courses: [course('c1')],
      courseExams: [
        exam({ id: 'recent', date: '2026-10-20' }),
        exam({ id: 'graded', kind: 'quiz', date: '2026-10-22', grade: 0 }),
        exam({ id: 'old', kind: 'quiz', date: '2026-05-01' }),
        exam({ id: 'ahead', kind: 'final', date: '2026-12-20' }),
      ],
    }
    expect(examsAwaitingGrade(data, now).map((e) => e.exam.id)).toEqual(['recent'])
    expect(finishedExams(data, now).map((e) => e.exam.id)).toEqual(['graded', 'recent', 'old'])
  })

  it('reads grades with a comma or a dot and refuses anything outside 0-100', () => {
    expect(parseGrade('78')).toBe(78)
    expect(parseGrade(' 78,5 ')).toBe(78.5)
    expect(parseGrade('100')).toBe(100)
    expect(parseGrade('0')).toBe(0)
    expect(parseGrade('101')).toBeNull()
    expect(parseGrade('-5')).toBeNull()
    expect(parseGrade('AA')).toBeNull()
    expect(parseGrade('')).toBeNull()
  })

  it('asks for the final once the midterm is over and nothing else is planned', () => {
    const vize = exam({ date: '2026-10-20' })
    expect(nextExamToAdd([vize], now)).toBe('final')
    expect(nextExamToAdd([exam({ date: '2026-11-07' })], now)).toBeNull() // midterm still ahead
    expect(nextExamToAdd([vize, exam({ kind: 'final', date: '2026-12-20' })], now)).toBeNull()
    expect(nextExamToAdd([vize, exam({ kind: 'quiz', date: '2026-11-05' })], now)).toBeNull() // something is planned
    expect(nextExamToAdd([exam({ date: '2026-03-01' })], now)).toBeNull() // last term
    expect(nextExamToAdd([exam({ kind: 'quiz', date: '2026-10-20' })], now)).toBeNull()
    expect(nextExamToAdd([], now)).toBeNull()
  })

  it('turns the old single exam date into a draft without an id, keeping time and grade of real exams', () => {
    expect(examDrafts({ courses: [course('c1', '2026-10-01')], courseExams: [] }, 'c1')).toEqual([
      { id: undefined, kind: 'diger', title: null, date: '2026-10-01', time: null, weight: null, grade: null, noteIds: [] },
    ])
    const real = exam({ id: 'v', date: '2026-10-20', time: '09:30', grade: 82, weight: 40 })
    expect(examDrafts({ courses: [course('c1')], courseExams: [real] }, 'c1')[0]).toMatchObject({ id: 'v', time: '09:30', grade: 82, weight: 40 })
  })
})
