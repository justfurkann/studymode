import { describe, expect, it, vi } from 'vitest'

// Signed in, so requests go to our server (/api/generate).
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } } }))
vi.mock('../account', () => ({ setQuota: () => {} }))

import * as ai from './index'

const set = (n: number) => ({
  summary: { overview: `Parça ${n}`, points: [`Nokta ${n}`], keyTerms: [] },
  cards: [{ front: `Soru ${n}?`, back: 'Cevap', source: '' }],
  questions: [],
  practice: [],
})

describe('generateStudySet through our server', () => {
  const settings = { provider: 'shared', keys: { google: '', anthropic: '', openai: '' }, models: { google: '', anthropic: '', openai: '' }, theme: 'system' } as never
  const paragraphs = (n: number, size: number) => Array.from({ length: n }, (_, i) => `Paragraf ${i}. ${'b'.repeat(size)}`).join('\n\n')

  it('sends smaller parts than with an own key', async () => {
    const sizes: number[] = []
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      sizes.push(JSON.parse(init.body as string).input.text.length)
      return new Response(JSON.stringify({ result: set(sizes.length) }))
    }))
    const result = await ai.generateStudySet(paragraphs(10, 2_000), 'Not', settings, undefined, async () => undefined)
    expect(Math.max(...sizes)).toBeLessThanOrEqual(ai.SERVER_CHUNK_CHARS)
    expect(result.failedChunks).toBe(0)
    vi.unstubAllGlobals()
  })

  it('splits a part that runs out of time into halves and keeps going, instead of failing', async () => {
    const sizes: number[] = []
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      const text = JSON.parse(init.body as string).input.text as string
      sizes.push(text.length)
      // The whole note is too slow; each half is fine.
      if (text.length > 8_000) return new Response(JSON.stringify({ error: 'too_slow' }), { status: 504 })
      return new Response(JSON.stringify({ result: set(sizes.length) }))
    }))
    const progress: string[] = []
    const result = await ai.generateStudySet(paragraphs(5, 2_000), 'Not', settings, (d, t) => progress.push(`${d}/${t}`), async () => undefined)
    expect(sizes[0]).toBeGreaterThan(8_000)
    expect(sizes.slice(1).every((n) => n <= 8_000)).toBe(true)
    // The slow try is not repeated as it was; the halves (cut at paragraph ends) all go through.
    const pieces = sizes.length - 1
    expect(pieces).toBeGreaterThanOrEqual(2)
    expect(sizes.slice(1).reduce((a, b) => a + b, 0)).toBeGreaterThan(sizes[0] - 100)
    expect(result.failedChunks).toBe(0)
    expect(result.totalChunks).toBe(pieces)
    expect(result.cards).toHaveLength(pieces)
    expect(progress.at(-1)).toBe(`${pieces}/${pieces}`)
    vi.unstubAllGlobals()
  })

  it('splits a timed-out chunk even when it has no double-newline paragraph breaks and does not loop endlessly', async () => {
    const singleWallOfText = `Tek blok ders notu: ${'kelime '.repeat(1_600)}`
    const sizes: number[] = []
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      const text = JSON.parse(init.body as string).input.text as string
      sizes.push(text.length)
      if (text.length > 7_000) return new Response(JSON.stringify({ error: 'too_slow' }), { status: 504 })
      return new Response(JSON.stringify({ result: set(sizes.length) }))
    }))
    const result = await ai.generateStudySet(singleWallOfText, 'Not', settings, undefined, async () => undefined)
    expect(sizes).toHaveLength(3)
    expect(result.failedChunks).toBe(0)
    expect(result.totalChunks).toBe(2)
    expect(result.cards).toHaveLength(2)
    vi.unstubAllGlobals()
  })

  it('splits a 2-page scanned PDF transcribe batch into single pages when the 2-page request times out at 6/8', async () => {
    const batchCounts: number[] = []
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      const images = JSON.parse(init.body as string).input.images as unknown[]
      batchCounts.push(images.length)
      if (images.length > 1) return new Response(JSON.stringify({ error: 'too_slow' }), { status: 504 })
      return new Response(JSON.stringify({ result: { text: `Sayfa (${batchCounts.length})` } }))
    }))
    const text = await ai.transcribeImages(
      [
        { mimeType: 'image/jpeg', data: 'cGFnZTc=' },
        { mimeType: 'image/jpeg', data: 'cGFnZTg=' },
      ],
      settings,
    )
    expect(batchCounts).toEqual([2, 1, 1])
    expect(text).toBe('Sayfa (2)\n\nSayfa (3)')
    vi.unstubAllGlobals()
  })

  it('prepares three parts at a time and keeps the note’s order even when later parts finish first', async () => {
    let inFlight = 0
    let most = 0
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      const n = Number(JSON.parse(init.body as string).input.title.match(/Bölüm (\d+)\//)?.[1])
      inFlight += 1
      most = Math.max(most, inFlight)
      // Earlier parts take longer, so they finish last.
      await new Promise((r) => setTimeout(r, (10 - n) * 5))
      inFlight -= 1
      return new Response(JSON.stringify({ result: set(n) }))
    }))
    const progress: string[] = []
    const result = await ai.generateStudySet(paragraphs(30, 2_000), 'Not', settings, (d, t) => progress.push(`${d}/${t}`), async () => undefined)
    expect(most).toBe(ai.STUDY_PARALLEL_SERVER)
    const parts = result.totalChunks
    expect(parts).toBeGreaterThan(3)
    expect(result.cards.map((c) => c.front)).toEqual(Array.from({ length: parts }, (_, i) => `Soru ${i + 1}?`))
    expect(progress[0]).toBe(`0/${parts}`)
    expect(progress.at(-1)).toBe(`${parts}/${parts}`)
    vi.unstubAllGlobals()
  })
})

