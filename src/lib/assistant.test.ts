import { describe, expect, it } from 'vitest'
import { userPrompt } from './ai/tasks'
import { boldParts, buildAssistantContext, cardFromAnswer, CONVERSATION_TTL_MS, loadConversation, placeFromPath, plainReply, replyBlocks, saveConversation, selectionQuestion, suggestionsFor } from './assistant'
import type { Course, Note } from './types'

const T = '2026-11-01T00:00:00Z'
function note(id: string, courseId: string, title: string, content: string, updatedAt = T, overview = ''): Note {
  return { id, courseId, title, content, summary: overview ? { overview, points: ['Nokta'], keyTerms: [{ term: 'Terim', definition: 'Tanım' }] } : null, questions: [], practice: [], generator: 'ai', createdAt: T, updatedAt }
}
const course = (id: string, name: string): Course => ({ id, name, color: '#000', examDate: null, createdAt: T, updatedAt: T })

describe('Fosfor context', () => {
  const notes = [
    note('a', 'fiz', 'Eski not', 'Eski içerik. '.repeat(50), '2026-10-01T00:00:00Z'),
    note('b', 'fiz', 'Yeni not', 'Yeni içerik.', '2026-10-20T00:00:00Z', 'Yeni notun özeti.'),
    note('c', 'fiz', 'Açık not', 'Açık notun metni. '.repeat(2000)),
    note('d', 'kim', 'Kimya', 'Kimya metni.'),
  ]

  it('puts the open note first (more of it), then the newest others; only that course', () => {
    const ctx = buildAssistantContext(notes, 'fiz', 'c')
    expect(ctx.indexOf('Açık not (şu an açık)')).toBe(4)
    expect(ctx.indexOf('Yeni not')).toBeLessThan(ctx.indexOf('Eski not'))
    expect(ctx).toContain('Yeni notun özeti.')
    expect(ctx).toContain('- Terim: Tanım')
    expect(ctx).not.toContain('Kimya')
    expect(ctx.length).toBeLessThanOrEqual(16_000)
  })

  it('sends nothing for a general question and stays within a small budget', () => {
    expect(buildAssistantContext(notes, null, null)).toBe('')
    expect(buildAssistantContext(notes, 'fiz', 'c', 1_000).length).toBeLessThanOrEqual(1_000)
  })

  it('knows the course from the address', () => {
    const courses = [course('fiz', 'Fizik'), course('kim', 'Kimya')]
    expect(placeFromPath('/not/c', notes, courses)).toEqual({ courseId: 'fiz', noteId: 'c' })
    expect(placeFromPath('/ders/kim/sinav', notes, courses)).toEqual({ courseId: 'kim', noteId: null })
    expect(placeFromPath('/tekrar', notes, courses)).toEqual({ courseId: null, noteId: null })
  })

  it('shows **bold** as bold and nothing else', () => {
    expect(boldParts('a **b** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c', bold: false },
    ])
  })

  it('caps what reaches the model, whatever the app sends', () => {
    const prompt = userPrompt('chat', {
      course: 'Fizik',
      context: 'x'.repeat(50_000),
      history: Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `tur ${i} ${'y'.repeat(3_000)}` })),
      question: 'Soru?',
    })
    expect(prompt).toContain('<course>Fizik</course>')
    expect(prompt).toContain('<question>Soru?</question>')
    expect(prompt).not.toContain('tur 19 ')
    expect(prompt).toContain('tur 29 ')
    expect(prompt.length).toBeLessThan(18_000 + 10 * 1_600 + 500)
  })
})

describe('Fosfor replies and extras', () => {
  it('reads paragraphs, bullet and numbered lists', () => {
    expect(replyBlocks('Kısaca:\n- Bir\n- **İki**\n\n1. İlk\n2) İkinci\nSon söz.')).toEqual([
      { kind: 'p', text: 'Kısaca:' },
      { kind: 'ul', items: ['Bir', '**İki**'] },
      { kind: 'ol', items: ['İlk', 'İkinci'] },
      { kind: 'p', text: 'Son söz.' },
    ])
    expect(replyBlocks('Tek satır.')).toEqual([{ kind: 'p', text: 'Tek satır.' }])
  })

  it('makes a card from a question and an answer, without bold marks', () => {
    expect(plainReply('Kalp **kanı** pompalar.')).toBe('Kalp kanı pompalar.')
    const card = cardFromAnswer('  Sol karıncık   neden kalın? ', 'Çünkü **bütün vücuda** pompalar.')
    expect(card).toEqual({ front: 'Sol karıncık neden kalın?', back: 'Çünkü bütün vücuda pompalar.' })
    expect(cardFromAnswer('x'.repeat(300), 'y').front.length).toBe(198)
  })

  it('suggests starters for a note, a course or nothing', () => {
    expect(suggestionsFor('note')[0].label).toBe('Bu notu 3 maddede özetle')
    expect(suggestionsFor('course').map((s) => s.label)).toContain('Bana bir soru sor')
    expect(suggestionsFor('general').length).toBeGreaterThan(0)
  })

  it('asks about a selected word or a longer passage', () => {
    expect(selectionQuestion('  Kalp   kası ')).toBe('“Kalp kası” ne demek? Kısaca açıkla.')
    expect(selectionQuestion('Sol karıncık en kalın duvarlı odadır çünkü')).toMatch(/^Şu kısmı basitçe açıklar mısın\?\n“Sol karıncık/)
    expect(selectionQuestion('a '.repeat(600)).length).toBeLessThan(460)
  })
})

describe('Fosfor conversations on this device', () => {
  const mem = new Map<string, string>()
  const fake = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
  Object.assign(globalThis, { localStorage: fake, sessionStorage: fake })

  it('keeps a conversation per course and forgets it after a week', () => {
    const now = Date.UTC(2026, 10, 4)
    saveConversation('fiz', [{ id: '1', role: 'user', text: 'Soru' }], now)
    expect(loadConversation('fiz', now + 1000).map((m) => m.text)).toEqual(['Soru'])
    expect(loadConversation('kim', now)).toEqual([])
    expect(loadConversation('fiz', now + CONVERSATION_TTL_MS + 1)).toEqual([])
    saveConversation('fiz', [], now)
    expect(loadConversation('fiz', now)).toEqual([])
  })
})
