import { describe, expect, it, vi } from 'vitest'
import { handleGenerate } from './generate'

// The admin gate for "studyNumeric" (question quality, config.ts → QUESTION_QUALITY_FOR).

const studySet = {
  summary: { overview: 'Özet', points: ['Nokta'], keyTerms: [] },
  cards: [{ front: 'Soru?', back: 'Cevap', source: '' }],
  questions: [],
  practice: [],
}

function fakeFetch(quota?: object) {
  return vi.fn(async (url: string | URL | Request) => {
    const href = String(url)
    if (href.includes('/auth/v1/user')) return new Response('{}')
    if (href.includes('/rest/v1/rpc/ai_quota') || href.includes('/rest/v1/rpc/consume_ai')) {
      return quota ? new Response(JSON.stringify(quota)) : new Response('{"code":"PGRST202"}', { status: 404 })
    }
    if (href.includes('generativelanguage.googleapis.com')) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(studySet) }] }, finishReason: 'STOP' }] }))
    }
    throw new Error(`unexpected fetch ${href}`)
  }) as unknown as typeof fetch
}

const request = (body: unknown) =>
  new Request('https://studymode.fun/api/generate', {
    method: 'POST',
    headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const env = { GEMINI_API_KEY: 'server-key' }
const body = { task: 'studyNumeric', input: { title: 'Üsler', text: '$2^3 = 8$' } }
const geminiCalls = (f: typeof fetch) => vi.mocked(f).mock.calls.filter(([url]) => String(url).includes('generativelanguage'))

describe('studyNumeric on /api/generate', () => {
  it.each([
    ['normal', { role: 'normal', used: 0, limit: 40, allowed: true }],
    ['VIP', { role: 'vip', used: 0, limit: null, allowed: true }],
    ['unreadable role', undefined],
  ])('refuses a %s account before any Gemini call', async (_label, quota) => {
    const fetchImpl = fakeFetch(quota)
    const res = await handleGenerate(request(body), env, fetchImpl)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'admin_only' })
    expect(geminiCalls(fetchImpl)).toHaveLength(0)
  })

  it('runs for an admin, with the numeric rule in the system prompt', async () => {
    const fetchImpl = fakeFetch({ role: 'admin', used: 0, limit: null, allowed: true })
    const res = await handleGenerate(request(body), env, fetchImpl)
    expect(res.status).toBe(200)
    const [, init] = geminiCalls(fetchImpl)[0]
    const system = JSON.parse(String((init as RequestInit).body)).systemInstruction.parts[0].text as string
    expect(system).toContain('These notes are mainly formulas and calculations.')
  })

  it('the ordinary study task still works for a normal account', async () => {
    const fetchImpl = fakeFetch({ role: 'normal', used: 0, limit: 40, allowed: true })
    const res = await handleGenerate(request({ ...body, task: 'study' }), env, fetchImpl)
    expect(res.status).toBe(200)
    const [, init] = geminiCalls(fetchImpl)[0]
    expect(JSON.parse(String((init as RequestInit).body)).systemInstruction.parts[0].text).not.toContain('mainly formulas')
  })
})
