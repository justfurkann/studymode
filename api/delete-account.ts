// Account deletion for the website and the iOS app (Apple requires in-app deletion).
//
// POST /api/delete-account
//   Authorization: Bearer <the user's own Supabase access token>
//   Body: { "confirm": "DELETE", "premium_ok"?: boolean, "apple_authorization_code"?: string }
//
// The user is identified only by their own token; the server key (SUPABASE_SERVICE_ROLE_KEY) never
// leaves the server. Deleting the auth user removes every table row tied to it (courses, notes,
// cards, attempts, exams, study days, shares, role, AI usage, Premium time, redeem failures: all
// `on delete cascade`). Feedback and error reports would only lose their user link, so they are
// deleted first. Used Premium codes keep their audit row (redeemed_by becomes empty).
//
// Answers (JSON): 200 { ok: true, apple_revoked }; 400 confirm_required / bad_request;
// 401 not_signed_in; 403 admin_account; 405 method_not_allowed; 409 premium_active
// (with premium_until; send again with premium_ok: true); 500 not_configured; 502 delete_failed.
import { createPrivateKey, sign } from 'node:crypto'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/lib/config.js'

type Env = Record<string, string | undefined>

export const CONFIRM_WORD = 'DELETE'
export const APPLE_BUNDLE_ID = 'fun.studymode.app'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/** Supabase's admin key: the new `sb_secret_…` key goes in `apikey`; an old service_role JWT also as a bearer token. */
function adminHeaders(key: string): Record<string, string> {
  return { apikey: key, ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}), 'content-type': 'application/json' }
}

interface Body {
  confirm?: unknown
  premium_ok?: unknown
  apple_authorization_code?: unknown
}

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url')

/** The short-lived client secret Apple wants: an ES256 JWT signed with the Sign in with Apple key (.p8). */
export function appleClientSecret(env: Env, clientId: string, now = Date.now()): string | null {
  const teamId = env.APPLE_TEAM_ID?.trim()
  const keyId = env.APPLE_KEY_ID?.trim()
  const pem = env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  if (!teamId || !keyId || !pem) return null
  const iat = Math.floor(now / 1000)
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const claims = b64url(JSON.stringify({ iss: teamId, iat, exp: iat + 300, aud: 'https://appleid.apple.com', sub: clientId }))
  const signature = sign('sha256', Buffer.from(`${head}.${claims}`), { key: createPrivateKey(pem), dsaEncoding: 'ieee-p1363' })
  return `${head}.${claims}.${b64url(signature)}`
}

/**
 * Apple asks apps to revoke Sign in with Apple tokens when an account is deleted. The app sends a
 * fresh authorization code; we swap it for a refresh token and revoke that. Best effort: the account
 * is deleted either way. Off (returns false) until the APPLE_* variables are set in Vercel.
 */
async function revokeApple(code: string, env: Env, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const clientId = env.APPLE_CLIENT_ID?.trim() || APPLE_BUNDLE_ID
    const secret = appleClientSecret(env, clientId)
    if (!secret) return false
    const form = (fields: Record<string, string>) => ({
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
      signal: AbortSignal.timeout(8_000),
    })
    const token = await fetchImpl('https://appleid.apple.com/auth/token', form({ client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code' }))
    if (!token.ok) {
      console.error('delete-account: apple token', token.status)
      return false
    }
    const { refresh_token: refresh, access_token: access } = (await token.json()) as { refresh_token?: string; access_token?: string }
    const value = refresh ?? access
    if (!value) return false
    const revoke = await fetchImpl(
      'https://appleid.apple.com/auth/revoke',
      form({ client_id: clientId, client_secret: secret, token: value, token_type_hint: refresh ? 'refresh_token' : 'access_token' }),
    )
    if (!revoke.ok) console.error('delete-account: apple revoke', revoke.status)
    return revoke.ok
  } catch (error) {
    console.error('delete-account: apple revoke failed', error instanceof Error ? error.message.slice(0, 200) : error)
    return false
  }
}

export async function handleDeleteAccount(request: Request, env: Env, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const adminKey = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!adminKey) return json(500, { error: 'not_configured' })

  const auth = request.headers.get('authorization') ?? ''
  if (!/^Bearer \S+$/.test(auth)) return json(401, { error: 'not_signed_in' })

  let body: Body
  try {
    body = (await request.json()) as Body
    if (!body || typeof body !== 'object') throw new Error('not an object')
  } catch {
    return json(400, { error: 'bad_request' })
  }
  if (body.confirm !== CONFIRM_WORD) return json(400, { error: 'confirm_required' })

  try {
    // Who is asking: only their own valid token says so.
    const me = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: auth },
      signal: AbortSignal.timeout(8_000),
    })
    if (!me.ok) return json(401, { error: 'not_signed_in' })
    const user = (await me.json()) as { id?: string }
    const id = user.id ?? ''
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(401, { error: 'not_signed_in' })
    const rest = `${SUPABASE_URL}/rest/v1`

    // The founder's admin account is not deleted by accident from a settings page.
    const roles = await fetchImpl(`${rest}/user_roles?user_id=eq.${id}&select=role`, { headers: adminHeaders(adminKey), signal: AbortSignal.timeout(8_000) })
    if (!roles.ok) return json(502, { error: 'delete_failed' })
    if (((await roles.json()) as Array<{ role?: string }>).some((r) => r.role === 'admin')) return json(403, { error: 'admin_account' })

    // Paid time left: say so once; the person sends again with premium_ok to go ahead.
    const premium = await fetchImpl(`${rest}/premium_access?user_id=eq.${id}&select=until`, { headers: adminHeaders(adminKey), signal: AbortSignal.timeout(8_000) })
    if (!premium.ok) return json(502, { error: 'delete_failed' })
    const until = ((await premium.json()) as Array<{ until?: string }>)[0]?.until
    if (until && Date.parse(until) > now && body.premium_ok !== true) return json(409, { error: 'premium_active', premium_until: until })

    const code = typeof body.apple_authorization_code === 'string' ? body.apple_authorization_code.trim() : ''
    const appleRevoked = code ? await revokeApple(code, env, fetchImpl) : false

    // Rows that would otherwise outlive the account with only their user link removed.
    for (const table of ['feedback', 'client_errors']) {
      const gone = await fetchImpl(`${rest}/${table}?user_id=eq.${id}`, { method: 'DELETE', headers: adminHeaders(adminKey), signal: AbortSignal.timeout(8_000) })
      if (!gone.ok) {
        console.error('delete-account: clearing', table, gone.status)
        return json(502, { error: 'delete_failed' })
      }
    }

    // Everything else goes with the auth user (on delete cascade).
    const removed = await fetchImpl(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: adminHeaders(adminKey),
      body: JSON.stringify({ should_soft_delete: false }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!removed.ok) {
      console.error('delete-account: auth delete', removed.status)
      return json(502, { error: 'delete_failed' })
    }
    console.info('delete-account: an account was deleted', { appleRevoked })
    return json(200, { ok: true, apple_revoked: appleRevoked })
  } catch (error) {
    console.error('delete-account failed', error instanceof Error ? error.message.slice(0, 200) : error)
    return json(502, { error: 'delete_failed' })
  }
}

export function GET(): Response {
  return json(405, { error: 'method_not_allowed' })
}

export async function POST(request: Request): Promise<Response> {
  return handleDeleteAccount(request, process.env)
}
