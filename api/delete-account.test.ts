import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { appleClientSecret, handleDeleteAccount } from './delete-account'

const ID = '11111111-2222-3333-4444-555555555555'
const env = { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' }
const NOW = Date.parse('2026-11-26T12:00:00Z')

const req = (body: unknown = { confirm: 'DELETE' }, token: string | null = 'user-token', method = 'POST') =>
  new Request('https://studymode.fun/api/delete-account', {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  })

function supabase(opts: { user?: boolean; role?: string; until?: string; failDelete?: boolean; apple?: boolean } = {}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url)
    const headers = (init?.headers ?? {}) as Record<string, string>
    if (href.endsWith('/auth/v1/user')) {
      expect(headers.authorization).toBe('Bearer user-token')
      return opts.user === false ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ id: ID, email: 'a@privaterelay.appleid.com' }))
    }
    if (href.includes('/rest/v1/user_roles')) {
      expect(headers.apikey).toBe('sb_secret_test')
      return new Response(JSON.stringify(opts.role ? [{ role: opts.role }] : []))
    }
    if (href.includes('/rest/v1/premium_access')) return new Response(JSON.stringify(opts.until ? [{ until: opts.until }] : []))
    if (href.includes('/rest/v1/feedback') || href.includes('/rest/v1/client_errors')) {
      expect(init?.method).toBe('DELETE')
      expect(href).toContain(`user_id=eq.${ID}`)
      return new Response(null, { status: 204 })
    }
    if (href.endsWith(`/auth/v1/admin/users/${ID}`)) {
      expect(init?.method).toBe('DELETE')
      expect(headers.apikey).toBe('sb_secret_test')
      return new Response('{}', { status: opts.failDelete ? 500 : 200 })
    }
    if (href === 'https://appleid.apple.com/auth/token') return new Response(JSON.stringify({ refresh_token: 'r' }), { status: opts.apple === false ? 400 : 200 })
    if (href === 'https://appleid.apple.com/auth/revoke') return new Response('', { status: 200 })
    throw new Error(`unexpected ${href}`)
  }) as unknown as typeof fetch
}
const calls = (f: typeof fetch) => (f as unknown as { mock: { calls: Array<[unknown, RequestInit]> } }).mock.calls.map((c) => String(c[0]))

async function answer(res: Response) {
  return { status: res.status, body: await res.json() }
}

describe('delete account', () => {
  it('deletes the caller: feedback and error rows first, then the auth user', async () => {
    const f = supabase()
    expect(await answer(await handleDeleteAccount(req(), env, f, NOW))).toEqual({ status: 200, body: { ok: true, apple_revoked: false } })
    const urls = calls(f)
    expect(urls.findIndex((u) => u.includes('/feedback'))).toBeLessThan(urls.findIndex((u) => u.includes('/admin/users/')))
    expect(urls.some((u) => u.includes('/client_errors'))).toBe(true)
  })

  it('needs POST, a token, a valid session and the confirm word', async () => {
    const f = supabase()
    expect((await answer(await handleDeleteAccount(req(undefined, 'user-token', 'GET'), env, f))).status).toBe(405)
    expect(await answer(await handleDeleteAccount(req(undefined, null), env, f))).toEqual({ status: 401, body: { error: 'not_signed_in' } })
    expect(await answer(await handleDeleteAccount(req({ confirm: 'delete' }), env, f))).toEqual({ status: 400, body: { error: 'confirm_required' } })
    expect(await answer(await handleDeleteAccount(req('not json'), env, f))).toEqual({ status: 400, body: { error: 'bad_request' } })
    expect(calls(f)).toEqual([])
    const g = supabase({ user: false })
    expect(await answer(await handleDeleteAccount(req(), env, g))).toEqual({ status: 401, body: { error: 'not_signed_in' } })
    expect(calls(g).some((u) => u.includes('/admin/'))).toBe(false)
  })

  it('is off without the server key', async () => {
    expect(await answer(await handleDeleteAccount(req(), {}, supabase()))).toEqual({ status: 500, body: { error: 'not_configured' } })
  })

  it('never deletes an admin account', async () => {
    const f = supabase({ role: 'admin' })
    expect(await answer(await handleDeleteAccount(req(), env, f))).toEqual({ status: 403, body: { error: 'admin_account' } })
    expect(calls(f).some((u) => u.includes('/admin/users/') || u.includes('/feedback'))).toBe(false)
  })

  it('warns about Premium time left, then goes ahead with premium_ok', async () => {
    const until = '2026-12-20T00:00:00Z'
    const f = supabase({ until })
    expect(await answer(await handleDeleteAccount(req(), env, f, NOW))).toEqual({ status: 409, body: { error: 'premium_active', premium_until: until } })
    expect(calls(f).some((u) => u.includes('/admin/users/'))).toBe(false)
    expect((await handleDeleteAccount(req({ confirm: 'DELETE', premium_ok: true }), env, supabase({ until }), NOW)).status).toBe(200)
    // Ended Premium does not ask.
    expect((await handleDeleteAccount(req(), env, supabase({ until: '2026-11-01T00:00:00Z' }), NOW)).status).toBe(200)
  })

  it('reports a failed deletion', async () => {
    expect(await answer(await handleDeleteAccount(req(), env, supabase({ failDelete: true }), NOW))).toEqual({ status: 502, body: { error: 'delete_failed' } })
  })

  it('revokes Apple tokens when the app sends a code and the Apple key is set up; deletes either way', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const appleEnv = { ...env, APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }
    const body = { confirm: 'DELETE', apple_authorization_code: 'code-1' }
    const f = supabase()
    expect(await answer(await handleDeleteAccount(req(body), appleEnv, f, NOW))).toEqual({ status: 200, body: { ok: true, apple_revoked: true } })
    expect(calls(f)).toContain('https://appleid.apple.com/auth/revoke')
    // Apple refuses the code: the account is still deleted.
    expect(await answer(await handleDeleteAccount(req(body), appleEnv, supabase({ apple: false }), NOW))).toEqual({ status: 200, body: { ok: true, apple_revoked: false } })
    // No Apple key in Vercel: Apple is not called at all.
    const g = supabase()
    expect(await answer(await handleDeleteAccount(req(body), env, g, NOW))).toEqual({ status: 200, body: { ok: true, apple_revoked: false } })
    expect(calls(g).some((u) => u.includes('appleid'))).toBe(false)
  })

  it('signs the Apple client secret with ES256', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, '\\n')
    const jwt = appleClientSecret({ APPLE_TEAM_ID: 'T', APPLE_KEY_ID: 'K', APPLE_PRIVATE_KEY: pem }, 'fun.studymode.app', NOW)!
    const [head, claims, sig] = jwt.split('.')
    expect(JSON.parse(Buffer.from(head, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'K' })
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({ iss: 'T', sub: 'fun.studymode.app', aud: 'https://appleid.apple.com' })
    expect(verify('sha256', Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'))).toBe(true)
  })
})
