import { describe, expect, it } from 'vitest'
import { userPrompt } from './ai/tasks'
import { boldParts, buildAssistantContext, placeFromPath } from './assistant'
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
