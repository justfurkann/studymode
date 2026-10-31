import { describe, expect, it } from 'vitest'
import { buildIcs, examReadiness, examUrgency, mergeSemesterExams, pickExamFocus, planSemester, semesterRows } from './examFocus'
import { emptyData, type Course, type CourseExam, type Note, type StudyData } from './types'

const now = new Date(2026, 9, 31, 10)
const T = '2026-10-01T00:00:00Z'

const course = (id: string, name: string): Course => ({ id, name, color: '#000', examDate: null, createdAt: T, updatedAt: T })
const exam = (id: string, courseId: string, kind: CourseExam['kind'], date: string, extra: Partial<CourseExam> = {}): CourseExam => ({
  id,
  courseId,
  kind,
  title: null,
  date,
  weight: null,
  noteIds: [],
  createdAt: T,
  updatedAt: T,
  ...extra,
})
const note = (id: string, courseId: string, title: string, generated = true): Note => ({
  id,
  courseId,
  title,
  content: 'metin',
  summary: generated ? { overview: 'Özet', points: ['a'], keyTerms: [] } : null,
  questions: [],
  practice: [],
  generator: generated ? 'ai' : null,
  createdAt: T,
  updatedAt: T,
})
const attempt = (noteId: string, courseId: string, score: number, total: number) => ({ id: `a-${noteId}`, courseId, noteId, score, total, wrongIds: [], createdAt: T })

function data(patch: Partial<StudyData>): StudyData {
  return { ...emptyData(), ...patch }
}

describe('exam readiness and urgency', () => {
  it('is unknown without notes and uses test results when there are some', () => {
    const d = data({
      courses: [course('c1', 'Biyoloji')],
      notes: [note('n1', 'c1', 'Hücre'), note('n2', 'c1', 'Doku')],
      attempts: [attempt('n1', 'c1', 4, 5)],
    })
    expect(examReadiness(data({ courses: [course('c1', 'Biyoloji')] }), exam('e', 'c1', 'vize', '2026-11-05'))).toBeNull()
    // n1 tested at 80%, n2 untouched: average 40.
    expect(examReadiness(d, exam('e', 'c1', 'vize', '2026-11-05'))).toBe(40)
    // An exam covering only n1.
    expect(examReadiness(d, exam('e', 'c1', 'vize', '2026-11-05', { noteIds: ['n1'] }))).toBe(80)
  })

  it('ranks closer, heavier and less prepared exams higher', () => {
    expect(examUrgency(2, null, 50)).toBeGreaterThan(examUrgency(10, null, 50))
    expect(examUrgency(5, 60, 50)).toBeGreaterThan(examUrgency(5, 20, 50))
    expect(examUrgency(5, null, 20)).toBeGreaterThan(examUrgency(5, null, 70))
  })
})

describe('pickExamFocus', () => {
  it('asks for notes first when the urgent course has none', () => {
    const d = data({ courses: [course('c1', 'Biyoloji')], courseExams: [exam('e1', 'c1', 'vize', '2026-11-03')] })
    const focus = pickExamFocus(d, now)!
    expect(focus.headline).toBe('Biyoloji vizesine 3 gün kaldı')
    expect(focus.actionLabel).toBe('Not ekle')
    expect(focus.actionUrl).toBe('/not-ekle?ders=c1')
    expect(focus.readiness).toBeNull()
  })

  it('picks the most urgent exam and points to its next note', () => {
    const d = data({
      courses: [course('c1', 'Biyoloji'), course('c2', 'Tarih')],
      notes: [note('n1', 'c1', 'Hücre'), note('n2', 'c2', 'Osmanlı')],
      attempts: [attempt('n1', 'c1', 1, 5)],
      courseExams: [exam('e1', 'c1', 'vize', '2026-11-04', { weight: 40 }), exam('e2', 'c2', 'vize', '2026-11-20')],
    })
    const focus = pickExamFocus(d, now)!
    expect(focus.course.id).toBe('c1')
    expect(focus.reason).toContain('Hazırlığın: %20')
    expect(focus.reason).toContain('Hücre')
    expect(focus.actionUrl).toContain('/not/n1')
  })

  it('ignores past, far away and well prepared exams', () => {
    const d = data({
      courses: [course('c1', 'Biyoloji'), course('c2', 'Tarih')],
      notes: [note('n1', 'c1', 'Hücre')],
      attempts: [attempt('n1', 'c1', 5, 5)],
      courseExams: [exam('e1', 'c1', 'vize', '2026-11-04'), exam('e2', 'c2', 'final', '2027-02-01'), exam('e3', 'c2', 'vize', '2026-10-20')],
    })
    expect(pickExamFocus(d, now)).toBeNull()
  })
})

describe('semester setup', () => {
  const existing = [
    exam('v', 'c1', 'vize', '2026-11-10', { weight: 40, noteIds: ['n1'] }),
    exam('q', 'c1', 'quiz', '2026-11-01'),
  ]

  it('updates the midterm date, adds a final and keeps everything else', () => {
    const drafts = mergeSemesterExams(existing, { vize: '2026-11-12', final: '2027-01-08' })
    expect(drafts).toEqual([
      { id: 'v', kind: 'vize', title: null, date: '2026-11-12', weight: 40, noteIds: ['n1'] },
      { id: 'q', kind: 'quiz', title: null, date: '2026-11-01', weight: null, noteIds: [] },
      { kind: 'final', date: '2027-01-08', noteIds: [] },
    ])
  })

  it('never deletes an exam because a cell was left empty', () => {
    expect(mergeSemesterExams(existing, { vize: '', final: '' })).toHaveLength(2)
  })

  it('creates new courses, updates existing ones by name and skips blanks, repeats and unchanged rows', () => {
    const d = data({
      courses: [course('c1', 'Biyoloji'), course('c2', 'Tarih')],
      courseExams: [...existing, exam('t', 'c2', 'vize', '2026-11-15')],
    })
    const plan = planSemester(d, [
      { name: '  biyoloji ', vize: '2026-11-12', final: '' },
      { name: 'Tarih', vize: '2026-11-15', final: '' },
      { name: 'Fizik', vize: '2026-11-18', final: '2027-01-12' },
      { name: 'fizik', vize: '2026-11-19', final: '' },
      { name: '', vize: '2026-11-20', final: '' },
      { name: 'Kimya', vize: '', final: '' },
    ])
    expect(plan.update.map((u) => u.courseId)).toEqual(['c1'])
    expect(plan.create).toEqual([
      { name: 'Fizik', exams: [{ kind: 'vize', date: '2026-11-18', noteIds: [] }, { kind: 'final', date: '2027-01-12', noteIds: [] }] },
      { name: 'Kimya', exams: [] },
    ])
  })

  it('prefills one row per course with its midterm and final', () => {
    const d = data({ courses: [course('c2', 'Tarih'), course('c1', 'Biyoloji')], courseExams: existing })
    expect(semesterRows(d)).toEqual([
      { name: 'Biyoloji', vize: '2026-11-10', final: '' },
      { name: 'Tarih', vize: '', final: '' },
    ])
  })
})

describe('calendar export', () => {
  it('writes all-day events with a reminder the day before', () => {
    const ics = buildIcs([{ exam: exam('e1', 'c1', 'vize', '2026-11-30', { weight: 40 }), course: course('c1', 'Biyoloji, Giriş') }], new Date(Date.UTC(2026, 9, 31, 8)))
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261130\r\n')
    expect(ics).toContain('DTEND;VALUE=DATE:20261201\r\n')
    expect(ics).toContain('SUMMARY:Biyoloji\\, Giriş · Vize\r\n')
    expect(ics).toContain('UID:e1@studymode.fun')
    expect(ics).toContain('TRIGGER:-PT15H')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
})
