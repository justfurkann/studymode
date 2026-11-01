import { describe, expect, it } from 'vitest'
import { ageGroup, educationLabel, needsEducation, parseEducation } from './education'

describe('education on the profile', () => {
  it('reads answers safely and drops what does not belong', () => {
    expect(parseEducation(null)).toBeNull()
    expect(parseEducation({ level: 'uzay' })).toBeNull()
    const lise = parseEducation({ level: 'lise', school: 'X Lisesi', department: 'Fen', birthYear: 'abc', gender: 'robot', v: 2 })!
    // A school, department or year is only kept for university levels; bad values become null.
    expect(lise).toMatchObject({ school: '', department: '', birthYear: null, gender: null })
  })

  it('asks again when something is missing: old answers, or a university student without department and year', () => {
    expect(needsEducation(null)).toBe(true)
    expect(needsEducation(parseEducation({ level: 'universite', school: 'ODTÜ' }))).toBe(true)
    expect(needsEducation(parseEducation({ level: 'universite', school: 'ODTÜ', department: 'Fizik', classYear: '2. sınıf', v: 2 }))).toBe(false)
    expect(needsEducation(parseEducation({ level: 'lise', v: 2 }))).toBe(false)
  })

  it('labels and age groups', () => {
    expect(educationLabel(parseEducation({ level: 'universite', school: 'ODTÜ', department: 'Fizik', classYear: '2. sınıf', v: 2 })!)).toBe('ODTÜ · Fizik · 2. sınıf')
    expect(educationLabel(parseEducation({ level: 'lise', v: 2 })!)).toBe('Lise')
    const now = new Date(2026, 10, 1)
    expect([2014, 2010, 2006, 2002, 1990].map((y) => ageGroup(y, now))).toEqual(['15 altı', '15-18', '19-22', '23-26', '27+'])
    expect(ageGroup(null, now)).toBeNull()
  })
})
