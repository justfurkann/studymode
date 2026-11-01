import { describe, expect, it } from 'vitest'
import { isTaskName, parseTaskOutput, splitNoteIntoChunks, userPrompt } from './tasks'

describe('detailed summary task', () => {
  it('is a task the server accepts, and fills missing parts with empty values', () => {
    expect(isTaskName('detail')).toBe(true)
    const out = parseTaskOutput('detail', JSON.stringify({ sections: [{ heading: 'Kalp' }] }))
    expect(out).toEqual({ intro: '', sections: [{ heading: 'Kalp', paragraphs: [], bullets: [], example: '' }], takeaways: [] })
  })

  it('names the part of a long note in the prompt', () => {
    expect(userPrompt('detail', { title: 'Dolaşım', text: 'Kalp', part: 'Bölüm 2/3' })).toContain('<note_title>Dolaşım (Bölüm 2/3)</note_title>')
    expect(userPrompt('detail', { title: 'Dolaşım', text: 'Kalp' })).toContain('<note_title>Dolaşım</note_title>')
  })

  it('a long note is cut into parts of at most 12 000 characters', () => {
    const text = Array.from({ length: 60 }, () => 'a'.repeat(500)).join('\n\n')
    const parts = splitNoteIntoChunks(text, 12_000)
    expect(parts.length).toBeGreaterThan(2)
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(12_000)
  })
})
