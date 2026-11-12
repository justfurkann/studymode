import { describe, expect, it } from 'vitest'
import { pageTitle } from './pageTitle'
import type { Course, Note } from './types'

const courses = [{ id: 'c1', name: 'Mesleki İngilizce' }, { id: 'c2', name: 'Biyoloji' }] as Course[]
const notes = [{ id: 'n1', courseId: 'c1', title: 'Unit 3' }, { id: 'n2', courseId: 'c2', title: 'Hücre zarı' }] as Note[]

describe('browser tab names', () => {
  it('puts the course first on a note, so tabs of different courses differ', () => {
    expect(pageTitle('/not/n1', '', courses, notes)).toBe('Mesleki İngilizce · Unit 3 · StudyMode')
    expect(pageTitle('/not/n2', '', courses, notes)).toBe('Biyoloji · Hücre zarı · StudyMode')
  })

  it('names a course page and its exams after the course', () => {
    expect(pageTitle('/ders/c2', '', courses, notes)).toBe('Biyoloji · StudyMode')
    expect(pageTitle('/ders/c2/sinav', '', courses, notes)).toBe('Biyoloji · Sınav · StudyMode')
    expect(pageTitle('/ders/c2/sinav/e1', '', courses, notes)).toBe('Biyoloji · Sınav · StudyMode')
  })

  it('shows which course or note is being reviewed', () => {
    expect(pageTitle('/tekrar', '', courses, notes)).toBe('Tekrar · StudyMode')
    expect(pageTitle('/tekrar', '?ders=c1&secim=1', courses, notes)).toBe('Mesleki İngilizce · Tekrar · StudyMode')
    expect(pageTitle('/tekrar', '?not=n2', courses, notes)).toBe('Biyoloji · Hücre zarı · Tekrar · StudyMode')
  })

  it('falls back to plain names while data is missing', () => {
    expect(pageTitle('/not/missing', '', courses, notes)).toBe('Not · StudyMode')
    expect(pageTitle('/ders/missing', '', courses, notes)).toBe('Ders · StudyMode')
    expect(pageTitle('/dersler/', '', courses, notes)).toBe('Dersler · StudyMode')
  })

  it('leaves pages that set their own name alone', () => {
    expect(pageTitle('/hakkinda', '', courses, notes)).toBeNull()
    expect(pageTitle('/', '', courses, notes)).toBe('StudyMode')
  })
})
