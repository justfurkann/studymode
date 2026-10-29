import { describe, expect, it, vi } from 'vitest'
import { handleGenerate, handleStatus } from './generate'

const studySet = {
  summary: { overview: 'Özet', points: ['Nokta'], keyTerms: [] },
  cards: [{ front: 'Soru?', back: 'Cevap', source: '' }],
  questions: [],
  practice: [],
}

function gemini(text: string, status = 200) {
  return new Response(status === 200 ? JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) : 'err', { status })
}

function fakeFetch(handlers: { user?: number; gemini?: Response[] }) {
  const replies = [...(handlers.gemini ?? [])]
  return vi.fn(async (url: string | URL | Request) => {
    const href = String(url)
    if (href.includes('/auth/v1/user')) return new Response('{}', { status: handlers.user ?? 200 })
    if (href.includes('generativelanguage.googleapis.com')) return replies.shift() ?? gemini('', 500)
    throw new Error(`unexpected fetch ${href}`)
  }) as unknown as typeof fetch
}

const request = (body: unknown, token = 'user-token') =>
  new Request('https://studymode.fun/api/generate', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const env = { GEMINI_API_KEY: 'server-key' }

describe('handleStatus', () => {
  it('says whether a key is set without revealing it', async () => {
    expect(await handleStatus({}).json()).toEqual({ ok: true, configured: false, model: 'gemini-3.8-flash' })
    const body = await handleStatus({ GEMINI_API_KEY: 'secret', GEMINI_MODEL: 'm' }).json()
    expect(body).toEqual({ ok: true, configured: true, model: 'm' })
    expect(JSON.stringify(body)).not.toContain('secret')
  })
})

describe('handleGenerate', () => {
  it('reports when the shared AI is not set up', async () => {
    const res = await handleGenerate(request({ task: 'study', input: { title: 't', text: 'x' } }), {}, fakeFetch({}))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not_configured' })
  })

  it('rejects requests without a valid session', async () => {
    const res = await handleGenerate(request({ task: 'study', input: { title: 't', text: 'x' } }), env, fakeFetch({ user: 401 }))
    expect(res.status).toBe(401)
  })

  it('rejects unknown tasks so the endpoint is not a general proxy', async () => {
    const res = await handleGenerate(request({ task: 'chat', input: { prompt: 'hi' } }), env, fakeFetch({}))
    expect(res.status).toBe(400)
  })

  it('returns a validated study set and sends the key only to Google', async () => {
    const fetchImpl = fakeFetch({ gemini: [gemini('```json\n' + JSON.stringify(studySet) + '\n```')] })
    const res = await handleGenerate(request({ task: 'study', input: { title: 'Hücre', text: 'Mitokondri enerji üretir.' } }), env, fetchImpl)
    expect(res.status).toBe(200)
    expect((await res.json()).result.summary.overview).toBe('Özet')
    const [, init] = (fetchImpl as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[1]
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('server-key')
    expect(JSON.parse(init.body as string).contents[0].parts[0].text).toContain('Mitokondri')
  })

  it('retries once when the model returns the wrong shape', async () => {
    const res = await handleGenerate(
      request({ task: 'study', input: { title: 't', text: 'x' } }),
      env,
      fakeFetch({ gemini: [gemini('{"oops":true}'), gemini(JSON.stringify(studySet))] }),
    )
    expect(res.status).toBe(200)
  })

  it('maps quota errors', async () => {
    const res = await handleGenerate(request({ task: 'study', input: { title: 't', text: 'x' } }), env, fakeFetch({ gemini: [gemini('', 429)] }))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'quota' })
  })
})
