import { describe, expect, it } from 'vitest'
import { checkMerged, mergeContents, mergedTitle, mergeMessage, NOTE_MAX_CHARS } from './mergeNotes'

describe('merging notes and files', () => {
  it('keeps each part under its own heading, in order, and skips empty ones', () => {
    expect(mergeContents([{ title: 'Hafta 1', content: ' Hücre. ' }, { title: '', content: 'Doku.' }, { title: 'Boş', content: '  ' }])).toBe('# Hafta 1\n\nHücre.\n\n# Adsız\n\nDoku.')
  })

  it('suggests a title the student can change', () => {
    expect(mergedTitle(['Hafta 1', 'Hafta 2', 'Hafta 3'])).toBe('Hafta 1 + 2 not daha')
    expect(mergedTitle(['Tek'])).toBe('Tek')
    expect(mergedTitle([' ', ''])).toBe('Birleşik not')
  })

  it('says how many parts a long note takes, and refuses one the database would refuse', () => {
    const short = checkMerged('a'.repeat(5_000))
    expect(short).toEqual({ chars: 5_000, parts: 1, tooLong: false })
    expect(mergeMessage(short, true)).toBe('Toplam 5.000 karakter.')
    const long = checkMerged('a'.repeat(61_000))
    expect(long.parts).toBe(4)
    expect(mergeMessage(long, true)).toMatch(/yaklaşık 4 bölümde hazırlar \(4 hak\); metin kesilmez/)
    expect(mergeMessage(long, false)).toBe('Toplam 61.000 karakter.')
    const huge = checkMerged('a'.repeat(NOTE_MAX_CHARS + 1))
    expect(huge.tooLong).toBe(true)
    expect(mergeMessage(huge, true)).toMatch(/çok uzun/)
  })
})
