import { describe, expect, it, vi } from 'vitest'
import { callGeminiWithFallback } from '../src/lib/ai/gemini'
import { MAX_BATCH_BASE64_CHARS } from '../src/lib/importNote'
import { geminiModels, handleGenerate, handleStatus, MAX_BODY_CHARS } from './generate'

const studySet = {
  summary: { overview: 'Özet', points: ['Nokta'], keyTerms: [] },
  cards: [{ front: 'Soru?', back: 'Cevap', source: '' }],
  questions: [],
  practice: [],
}

function gemini(text: string, status = 200) {
  return new Response(status === 200 ? JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) : 'err', { status })
}

function fakeFetch(handlers: { user?: number; gemini?: Response[]; quota?: object; consumed?: object }) {
  const replies = [...(handlers.gemini ?? [])]
  return vi.fn(async (url: string | URL | Request) => {
    const href = String(url)
    if (href.includes('/auth/v1/user')) return new Response('{}', { status: handlers.user ?? 200 })
    // Quota functions: absent (404) unless a test gives them, like a database before the migration.
    if (href.includes('/rest/v1/rpc/ai_quota')) return handlers.quota ? new Response(JSON.stringify(handlers.quota)) : new Response('{"code":"PGRST202"}', { status: 404 })
    if (href.includes('/rest/v1/rpc/consume_ai')) return handlers.consumed ? new Response(JSON.stringify(handlers.consumed)) : new Response('{"code":"PGRST202"}', { status: 404 })
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
    expect(await handleStatus({}).json()).toEqual({ ok: true, configured: false, models: ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite'] })
    const body = await handleStatus({ GEMINI_API_KEY: 'secret', GEMINI_MODEL: 'm', GEMINI_FALLBACK_MODELS: 'a, m ,b' }).json()
    expect(body).toEqual({ ok: true, configured: true, models: ['m', 'a', 'b'] })
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
    const [, init] = (fetchImpl as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls.find(([u]) => String(u).includes('generativelanguage'))!
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('server-key')
    // The server key never goes anywhere but Google (not to Supabase's quota functions).
    const others = (fetchImpl as unknown as { mock: { calls: Array<[string, RequestInit?]> } }).mock.calls.filter(([u]) => !String(u).includes('generativelanguage'))
    expect(JSON.stringify(others)).not.toContain('server-key')
    expect(JSON.parse(init.body as string).contents[0].parts[0].text).toContain('Mitokondri')
  })

  it('transcribes uploaded page images via Gemini inlineData parts', async () => {
    const fetchImpl = fakeFetch({ gemini: [gemini(JSON.stringify({ text: 'E = mc^2\n| A | B |\n| 1 | 2 |' }))] })
    const res = await handleGenerate(
      request({
        task: 'transcribe',
        input: { images: [{ mimeType: 'image/jpeg', data: 'aGVsbG8=' }] },
      }),
      env,
      fetchImpl,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).result).toEqual({ text: 'E = mc^2\n| A | B |\n| 1 | 2 |' })
    const [, init] = (fetchImpl as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls.find(([u]) => String(u).includes('generativelanguage'))!
    const parts = JSON.parse(init.body as string).contents[0].parts
    expect(parts).toEqual([
      { text: expect.stringContaining('Transcribe the text') },
      { inlineData: { mimeType: 'image/jpeg', data: 'aGVsbG8=' } },
    ])
  })

  it('retries once when the model returns the wrong shape', async () => {
    const res = await handleGenerate(
      request({ task: 'study', input: { title: 't', text: 'x' } }),
      env,
      fakeFetch({ gemini: [gemini('{"oops":true}'), gemini(JSON.stringify(studySet))] }),
    )
    expect(res.status).toBe(200)
  })

  it('maps quota errors once every model is out of quota', async () => {
    const res = await handleGenerate(
      request({ task: 'study', input: { title: 't', text: 'x' } }),
      env,
      fakeFetch({ gemini: [gemini('', 429), gemini('', 429), gemini('', 429)] }),
      noSleep,
    )
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'quota' })
  })

  it('reports busy when every model stays overloaded', async () => {
    const res = await handleGenerate(request({ task: 'study', input: { title: 't', text: 'x' } }), { ...env, GEMINI_FALLBACK_MODELS: ' ' }, fakeFetch({ gemini: [gemini('', 503), gemini('', 503), gemini('', 503)] }), noSleep)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'busy' })
  })
})

const noSleep = async () => undefined

describe('callGeminiWithFallback', () => {
  const models = (calls: Array<[string, RequestInit]>) => calls.map(([url]) => String(url).match(/models\/([^:]+)/)![1])

  it('retries an overloaded model, then succeeds on it', async () => {
    const fetchImpl = fakeFetch({ gemini: [gemini('', 503), gemini('ok')] })
    const result = await callGeminiWithFallback({ apiKey: 'k', models: ['a', 'b'], system: 's', user: 'u', fetchImpl, sleep: noSleep })
    expect(result).toEqual({ text: 'ok', model: 'a' })
  })

  it('moves to the next model when one is unknown, out of quota, times out or keeps failing', async () => {
    const fetchImpl = fakeFetch({ gemini: [gemini('', 404), gemini('', 429), gemini('', 504), gemini('', 503), gemini('', 503), gemini('', 503), gemini('done')] })
    const result = await callGeminiWithFallback({ apiKey: 'k', models: ['a', 'b', 't', 'c', 'd'], system: 's', user: 'u', fetchImpl, sleep: noSleep })
    expect(result).toEqual({ text: 'done', model: 'd' })
    const calls = (fetchImpl as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls
    expect(models(calls)).toEqual(['a', 'b', 't', 'c', 'c', 'c', 'd'])
  })

  it('does not retry errors another attempt cannot fix', async () => {
    const fetchImpl = fakeFetch({ gemini: [gemini('', 400)] })
    await expect(callGeminiWithFallback({ apiKey: 'k', models: ['a', 'b'], system: 's', user: 'u', fetchImpl, sleep: noSleep })).rejects.toMatchObject({ status: 400 })
  })

  it('uses the configured main model first', () => {
    expect(geminiModels({ GEMINI_MODEL: 'gemini-flash-lite-latest' })).toEqual(['gemini-flash-lite-latest', 'gemini-3.1-flash-lite'])
  })
})

describe('request size limits', () => {
  it('lets a full batch of scanned pages through the shared endpoint', () => {
    // The browser batches page images up to MAX_BATCH_BASE64_CHARS; the JSON around them must still fit.
    expect(MAX_BATCH_BASE64_CHARS + 50_000).toBeLessThanOrEqual(MAX_BODY_CHARS)
  })
})

describe('daily allowance', () => {
  const body = { task: 'study', input: { title: 't', text: 'x' } }

  it('stops a person who used up today, before calling Gemini', async () => {
    const fetchImpl = fakeFetch({ quota: { role: 'normal', used: 40, limit: 40, allowed: false } })
    const res = await handleGenerate(request(body), env, fetchImpl)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'daily_limit', quota: { role: 'normal', used: 40, limit: 40, allowed: false } })
    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]))
    expect(calls.some((u) => u.includes('generativelanguage'))).toBe(false)
  })

  it('counts a successful answer and returns the new count', async () => {
    const fetchImpl = fakeFetch({ quota: { role: 'vip', used: 3, limit: 150, allowed: true }, consumed: { role: 'vip', used: 4, limit: 150, allowed: true }, gemini: [gemini(JSON.stringify(studySet))] })
    const res = await handleGenerate(request(body), env, fetchImpl)
    expect(res.status).toBe(200)
    expect((await res.json()).quota).toEqual({ role: 'vip', used: 4, limit: 150, allowed: true })
  })

  it('does not count a failed answer', async () => {
    const fetchImpl = fakeFetch({ quota: { role: 'normal', used: 1, limit: 40, allowed: true }, gemini: [gemini('', 500), gemini('', 500), gemini('', 500), gemini('', 500), gemini('', 500), gemini('', 500)] })
    await handleGenerate(request(body), env, fetchImpl, async () => undefined)
    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]))
    expect(calls.some((u) => u.includes('consume_ai'))).toBe(false)
  })

  it('keeps working when the quota functions are not installed yet', async () => {
    const res = await handleGenerate(request(body), env, fakeFetch({ gemini: [gemini(JSON.stringify(studySet))] }))
    expect(res.status).toBe(200)
    expect((await res.json()).quota).toBeUndefined()
  })
})
