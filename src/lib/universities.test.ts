import { describe, expect, it } from 'vitest'
import { fold, searchUniversities, UNIVERSITIES } from './universities'

describe('university search', () => {
  it('finds schools by the short names students use, without Turkish letters', () => {
    expect(searchUniversities('odtu')[0].name).toBe('Orta Doğu Teknik Üniversitesi')
    expect(searchUniversities('ODTÜ')[0].name).toBe('Orta Doğu Teknik Üniversitesi')
    expect(searchUniversities('itu')[0].name).toBe('İstanbul Teknik Üniversitesi')
    expect(searchUniversities('bogazici')[0].short).toBe('Boğaziçi')
    expect(searchUniversities('deu')[0].name).toBe('Dokuz Eylül Üniversitesi')
  })

  it('finds by any word of the name and by city', () => {
    expect(searchUniversities('hacettepe').map((u) => u.name)).toContain('Hacettepe Üniversitesi')
    expect(searchUniversities('trabzon').map((u) => u.name)).toContain('Karadeniz Teknik Üniversitesi')
    expect(searchUniversities('ege', 3)[0].name).toBe('Ege Üniversitesi')
  })

  it('returns nothing for an empty search and respects the limit', () => {
    expect(searchUniversities('  ')).toEqual([])
    expect(searchUniversities('universitesi', 5)).toHaveLength(5)
  })

  it('has no duplicate names, and every school has a short name and a city', () => {
    const names = UNIVERSITIES.map((u) => u.name)
    expect(new Set(names).size).toBe(names.length)
    for (const u of UNIVERSITIES) {
      expect(u.short.length).toBeGreaterThan(1)
      expect(u.city.length).toBeGreaterThan(1)
    }
    expect(UNIVERSITIES.length).toBeGreaterThan(190)
  })

  it('folds Turkish letters and case', () => {
    expect(fold('İSTANBUL Şehir ÇĞÖÜ')).toBe('istanbul sehir cgou')
  })
})
