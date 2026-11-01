import { describe, expect, it } from 'vitest'
import { buildReceipt, formatLine, isNightOwlHour } from './receipt'
import { emptyData, type Card, type StudyData } from './types'

const at = (h: number, m = 0) => new Date(2026, 10, 1, h, m)
const noFocus = { focus: {}, rounds: {} }

function card(id: string, courseId: string, updatedAt: string, reps = 1): Card {
  return { id, courseId, noteId: null, front: 'f', back: 'b', source: null, due: updatedAt, interval: 1, ease: 2.5, reps, lapses: 0, createdAt: updatedAt, updatedAt }
}

function sample(): StudyData {
  const data = emptyData()
  const today = at(14).toISOString()
  data.courses = [
    { id: 'c1', name: 'Hücre Biyolojisi' } as StudyData['courses'][number],
    { id: 'c2', name: 'Genel Kimya' } as StudyData['courses'][number],
  ]
  data.cards = [card('a', 'c1', today), card('b', 'c1', today), card('c', 'c2', today), card('d', 'c2', today, 0), card('e', 'c2', at(14).toISOString().replace('2026-11-01', '2026-10-20'))]
  data.studyDays = [{ id: 's', day: '2026-11-01', reviews: 40, quizzes: 1, actions: 0, createdAt: today, updatedAt: today }]
  data.attempts = [{ id: 'q', courseId: 'c1', noteId: 'n', score: 8, total: 10, wrongIds: [], createdAt: today }]
  return data
}

describe('study receipt', () => {
  it('lists courses, cards, tests, focus and breaks of the day', () => {
    const r = buildReceipt(sample(), 'gun', { focus: { '2026-11-01': 45 }, rounds: { '2026-11-01': 3 } }, at(15))
    const text = r.lines.map((l) => formatLine(l))
    expect(text[0]).toMatch(/^1x HÜCRE BİYOLOJİSİ \.+ 2 KART$/)
    expect(text[1]).toMatch(/^1x GENEL KİMYA \.+ 1 KART$/)
    expect(r.lines).toContainEqual({ qty: '40x', label: 'ÇEVRİLEN KART', value: '40 TEKRAR' })
    expect(r.lines).toContainEqual({ qty: '1x', label: 'TEST', value: '%80' })
    expect(r.lines).toContainEqual({ qty: '1x', label: 'ODAK SÜRESİ', value: '45 DK' })
    expect(r.lines).toContainEqual({ qty: '3x', label: 'KAHVE MOLASI', value: '0,00 TL' })
    expect(r.total.value).toBe('95 PUAN')
    expect(r.empty).toBe(false)
    expect(r.time).toBe('15:00')
  })

  it('calls the small hours the night shift', () => {
    const r = buildReceipt(sample(), 'gun', noFocus, at(2, 14))
    expect(r.time).toBe('GECE 02:14')
    expect(r.register).toBe('#GECE-VARDİYASI')
    expect(r.verdict).toBe('MENTAL HASAR: YÜKSEK AMA GEÇECEK')
    expect(isNightOwlHour(at(4, 59))).toBe(true)
    expect(isNightOwlHour(at(5))).toBe(false)
  })

  it('names the register after a close exam', () => {
    const data = sample()
    data.courseExams = [{ id: 'e', courseId: 'c1', kind: 'vize', title: null, date: '2026-11-03', weight: null, noteIds: [], createdAt: '', updatedAt: '' }]
    expect(buildReceipt(data, 'gun', noFocus, at(15)).register).toBe('#VİZE-ACISI')
    data.courseExams[0].date = '2026-11-10'
    expect(buildReceipt(data, 'gun', noFocus, at(15)).register).toBe('#VİZE-HAFTASI')
  })

  it('a week counts the last seven days, a day only today', () => {
    const data = sample()
    data.studyDays.push({ id: 't', day: '2026-10-28', reviews: 10, quizzes: 0, createdAt: '', updatedAt: '' })
    expect(buildReceipt(data, 'gun', noFocus, at(15)).lines.find((l) => l.label === 'ÇEVRİLEN KART')?.value).toBe('40 TEKRAR')
    expect(buildReceipt(data, 'hafta', noFocus, at(15)).lines.find((l) => l.label === 'ÇEVRİLEN KART')?.value).toBe('50 TEKRAR')
  })

  it('says so when nothing was studied, and the code is stable', () => {
    const r = buildReceipt(emptyData(), 'gun', noFocus, at(15))
    expect(r.empty).toBe(true)
    expect(r.lines).toEqual([])
    expect(r.code).toBe(buildReceipt(emptyData(), 'gun', noFocus, at(15)).code)
    expect(r.code).toMatch(/^\d{10}$/)
  })

  it('pads lines with dots to the receipt width', () => {
    expect(formatLine({ qty: '1x', label: 'A', value: 'B' }, 12)).toBe('1x A ..... B')
    expect(formatLine({ qty: '', label: 'SERİ', value: '5 GÜN' }, 16)).toBe('SERİ ..... 5 GÜN')
  })
})
