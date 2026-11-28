import { afterEach, describe, expect, it, vi } from 'vitest'
import { callGemini, callGeminiWithFallback, embedBody, embedTaskType } from './gemini'
import { userPrompt } from './tasks'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
})

/** A fetch that records each request and answers like both embedding endpoints. */
function fakeFetch() {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ embedding: { values: [0.1, 0.2] }, predictions: [{ embeddings: { values: [0.1, 0.2] } }] }), { status: 200 })
  }) as unknown as typeof fetch
  return { calls, impl }
}

const vertex = { url: (m: string) => `https://vertex.example/models/${m}:generateContent`, headers: { authorization: 'Bearer t' } }

describe('embed input contract', () => {
  it('without kind the user message is exactly what old clients (iOS) produced', () => {
    expect(userPrompt('embed', { texts: ['a'] })).toBe('<embed_texts>["a"]</embed_texts>')
  })

  it('adds the kind only when it is query or document', () => {
    expect(userPrompt('embed', { texts: ['a'], kind: 'query' })).toBe('<embed_texts kind="query">["a"]</embed_texts>')
    expect(userPrompt('embed', { texts: ['a'], kind: 'document' })).toBe('<embed_texts kind="document">["a"]</embed_texts>')
    expect(userPrompt('embed', { texts: ['a'], kind: 'x" onload="1' } as never)).toBe('<embed_texts>["a"]</embed_texts>')
  })

  it('maps kinds to Gemini task types; no kind is a document', () => {
    expect(embedTaskType('query')).toBe('RETRIEVAL_QUERY')
    expect(embedTaskType('document')).toBe('RETRIEVAL_DOCUMENT')
    expect(embedTaskType(undefined)).toBe('RETRIEVAL_DOCUMENT')
  })
})

describe('both providers send the same task type', () => {
  it.each([
    [undefined, 'RETRIEVAL_DOCUMENT'],
    ['document', 'RETRIEVAL_DOCUMENT'],
    ['query', 'RETRIEVAL_QUERY'],
  ] as const)('kind %s → %s on the public API and on Vertex', async (kind, taskType) => {
    const user = userPrompt('embed', { texts: ['Mitokondri', ''], ...(kind ? { kind } : {}) })

    const pub = fakeFetch()
    const out = await callGemini({ apiKey: 'k', model: 'gemini-embedding-001', system: '', user, fetchImpl: pub.impl })
    expect(JSON.parse(out)).toEqual({ embeddings: [[0.1, 0.2], [0.1, 0.2]] })
    expect(pub.calls[0].url).toContain('gemini-embedding-001:embedContent')
    expect(pub.calls[0].body).toEqual({ content: { parts: [{ text: 'Mitokondri' }] }, taskType })
    expect(pub.calls[1].body).toEqual({ content: { parts: [{ text: ' ' }] }, taskType })

    const vx = fakeFetch()
    await callGemini({ target: vertex, model: 'gemini-embedding-001', system: '', user, fetchImpl: vx.impl })
    expect(vx.calls[0].url).toContain('gemini-embedding-001:predict')
    expect(vx.calls[0].body).toEqual({ instances: [{ content: 'Mitokondri', task_type: taskType }] })
  })

  it('the old Vertex body (no kind) is unchanged', () => {
    expect(embedBody('x', 'RETRIEVAL_DOCUMENT', true)).toEqual({ instances: [{ content: 'x', task_type: 'RETRIEVAL_DOCUMENT' }] })
  })

  it('a query sent with chat models still goes to the embedding model', async () => {
    const pub = fakeFetch()
    const { model } = await callGeminiWithFallback({ apiKey: 'k', models: ['gemini-3.8-flash'], system: '', user: userPrompt('embed', { texts: ['soru'], kind: 'query' }), fetchImpl: pub.impl })
    expect(model).toBe('gemini-embedding-001')
    expect(pub.calls[0].body.taskType).toBe('RETRIEVAL_QUERY')
  })
})

describe('stored vectors (v2)', () => {
  afterEach(() => store.clear())

  it('reads and writes under v2 and drops v1 vectors of that course', async () => {
    const { readCourseEmbeddings, saveCourseEmbeddings, EMBED_STORAGE_PREFIX } = await import('../semanticSearch')
    expect(EMBED_STORAGE_PREFIX).toBe('studymode.embeddings.v2.')
    store.set('studymode.embeddings.v1.c1', JSON.stringify({ n1: [1, 2] }))
    store.set('studymode.embeddings.v1.c2', JSON.stringify({ n2: [1, 2] }))
    expect(readCourseEmbeddings('c1')).toEqual({})
    expect(store.has('studymode.embeddings.v1.c1')).toBe(false)
    expect(store.has('studymode.embeddings.v1.c2')).toBe(true)
    saveCourseEmbeddings('c1', { n1: [0.5] })
    expect(readCourseEmbeddings('c1')).toEqual({ n1: [0.5] })
    expect(JSON.parse(store.get('studymode.embeddings.v2.c1')!)).toEqual({ n1: [0.5] })
  })
})
