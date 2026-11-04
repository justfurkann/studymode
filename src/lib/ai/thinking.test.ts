import { describe, expect, it, vi } from 'vitest'
import { callGemini } from './gemini'

const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }))
const sentThinking = (f: typeof fetch) =>
  (f as unknown as { mock: { calls: Array<[unknown, RequestInit]> } }).mock.calls.map((c) => JSON.parse(String(c[1].body)).generationConfig.thinkingConfig?.thinkingLevel ?? null)

describe('thinking level per model', () => {
  it('MINIMAL only on Flash-Lite; the full Flash (Free+) and Pro get LOW', async () => {
    for (const [model, level] of [
      ['gemini-3.5-flash-lite', 'MINIMAL'],
      ['gemini-3.8-flash', 'LOW'],
      ['gemini-3.6-flash', 'LOW'],
      ['gemini-4-argon', 'LOW'],
      ['gemini-3.1-pro-preview', 'LOW'],
    ] as const) {
      const f = vi.fn(async () => ok('{"a":1}')) as unknown as typeof fetch
      await callGemini({ apiKey: 'k', model, system: 's', user: 'u', fetchImpl: f })
      expect(sentThinking(f), model).toEqual([level])
    }
  })

  it('a model that rejects the thinking setting is asked again without it, instead of failing', async () => {
    let n = 0
    const f = vi.fn(async () =>
      ++n === 1
        ? new Response(JSON.stringify({ error: { code: 400, message: 'Thinking level is unsupported: THINKING_LEVEL_LOW', status: 'INVALID_ARGUMENT' } }), { status: 400 })
        : ok('{"a":1}'),
    ) as unknown as typeof fetch
    expect(await callGemini({ apiKey: 'k', model: 'gemini-3.8-flash', system: 's', user: 'u', fetchImpl: f })).toBe('{"a":1}')
    expect(sentThinking(f)).toEqual(['LOW', null])
  })

  it('other 400 errors are not retried', async () => {
    const f = vi.fn(async () => new Response('{"error":{"message":"bad request"}}', { status: 400 })) as unknown as typeof fetch
    await expect(callGemini({ apiKey: 'k', model: 'gemini-3.8-flash', system: 's', user: 'u', fetchImpl: f })).rejects.toThrow()
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1)
  })
})
