import { describe, expect, it, vi } from 'vitest'
import { handleTestSession } from './test-session'

const SECRET = 'x'.repeat(40)
const env = { TEST_SESSION_SECRET: SECRET, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', TEST_ACCOUNT_EMAIL: 'Test@Example.com' }
const req = (secret?: string, body: unknown = {}, method = 'POST') =>
  new Request('https://studymode.fun/api/test-session', {
    method,
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-test-secret': secret } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })

function supabase(userEmail = 'test@example.com') {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url)
    if (href.endsWith('/auth/v1/admin/generate_link')) {
      expect((init?.headers as Record<string, string>).apikey).toBe('sb_secret_test')
      return new Response(JSON.stringify({ email: JSON.parse(String(init?.body)).email, properties: { hashed_token: 'hash-1' } }))
    }
    if (href.endsWith('/auth/v1/verify')) {
      expect(JSON.parse(String(init?.body))).toEqual({ type: 'magiclink', token_hash: 'hash-1' })
      return new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { email: userEmail } }))
    }
    throw new Error(`unexpected ${href}`)
  }) as unknown as typeof fetch
}
const bodies = (f: typeof fetch) => (f as unknown as { mock: { calls: Array<[unknown, RequestInit]> } }).mock.calls.map((c) => String(c[1]?.body))

describe('test door for automated live checks', () => {
  it('is invisible without the right secret, without setup, or on GET', async () => {
    const f = supabase()
    for (const res of [
      await handleTestSession(req(), env, f),
      await handleTestSession(req('y'.repeat(40)), env, f),
      await handleTestSession(req(SECRET.slice(0, 39)), env, f),
      await handleTestSession(req(SECRET), { ...env, TEST_SESSION_SECRET: 'short' }, f),
      await handleTestSession(req(SECRET), { ...env, SUPABASE_SERVICE_ROLE_KEY: '' }, f),
      await handleTestSession(req(SECRET), { ...env, TEST_ACCOUNT_EMAIL: '' }, f),
      await handleTestSession(req(SECRET, {}, 'GET'), env, f),
    ]) {
      expect(res.status).toBe(404)
    }
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0)
  })

  it('opens a session only for the test account, whatever address the request asks for', async () => {
    const f = supabase()
    const res = await handleTestSession(req(SECRET, { email: 'someone-else@example.com' }), env, f)
    expect(res.status).toBe(200)
    expect((await res.json()).access_token).toBe('access')
    expect(bodies(f)[0]).toBe(JSON.stringify({ type: 'magiclink', email: 'test@example.com' }))
  })

  it('refuses to hand out a session that belongs to anyone else', async () => {
    const res = await handleTestSession(req(SECRET), env, supabase('intruder@example.com'))
    expect(res.status).toBe(502)
  })
})
