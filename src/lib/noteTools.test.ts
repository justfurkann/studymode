import { describe, it, expect } from 'vitest'
import { matchesNote, summaryMarkdown } from './noteTools'
import type { Note } from './types'
const note = { title: 'İktisat', content: 'Fırsat maliyeti seçimlerin sonucudur.', summary: { overview: 'Seçimler', points: ['Kaynaklar sınırlıdır.'], keyTerms: [{ term: 'Maliyet', definition: 'Vazgeçilen alternatif.' }], tags: ['vize'] } } as Note
describe('note tools', () => {
  it('searches Turkish titles, source text and tags with combined filters', () => {
    expect(matchesNote(note, 'İKTİSAT')).toBe(true)
    expect(matchesNote(note, 'fırsat', 'vize')).toBe(true)
    expect(matchesNote(note, 'vize')).toBe(true)
    expect(matchesNote(note, 'fırsat', 'final')).toBe(false)
  })
  it('exports meaningful summary and concept content', () => {
    const text = summaryMarkdown(note)
    expect(text).toContain('# İktisat')
    expect(text).toContain('- Kaynaklar sınırlıdır.')
    expect(text).toContain('**Maliyet:** Vazgeçilen alternatif.')
  })
})
