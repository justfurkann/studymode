// Does the signed-in account have a running App Store subscription? The site uses it to say
// "manage it in iPhone Settings → Subscriptions" and not to sell Premium twice.
//
// GET /api/apple-status   Authorization: Bearer <the user's own Supabase access token>
// 200 { subscription: false } | { subscription: true, product, expires }; 401 not_signed_in; 503 not_configured; 502 failed.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/lib/config.js'
import { adminHeaders, json, type Env } from './appleStore.js'

const SUBSCRIPTIONS = ['fun.studymode.app.premium.monthly', 'fun.studymode.app.premium.sixmonths']

export async function handleAppleStatus(request: Request, env: Env, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' })
  const adminKey = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!adminKey) return json(503, { error: 'not_configured' })
  const auth = request.headers.get('authorization') ?? ''
  if (!/^Bearer \S+$/.test(auth)) return json(401, { error: 'not_signed_in' })
  try {
    const me = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: auth }, signal: AbortSignal.timeout(8_000) })
    if (!me.ok) return json(401, { error: 'not_signed_in' })
    const id = String(((await me.json()) as { id?: string }).id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(401, { error: 'not_signed_in' })
    const query = new URLSearchParams({
      user_id: `eq.${id}`,
      revoked_at: 'is.null',
      product_id: `in.(${SUBSCRIPTIONS.join(',')})`,
      expires_date: `gt.${new Date(now).toISOString()}`,
      select: 'product_id,expires_date',
      order: 'expires_date.desc',
      limit: '1',
    })
    const response = await fetchImpl(`${SUPABASE_URL}/rest/v1/apple_transactions?${query}`, { headers: adminHeaders(adminKey), signal: AbortSignal.timeout(8_000) })
    if (!response.ok) return json(502, { error: 'failed' })
    const row = ((await response.json()) as Array<{ product_id?: string; expires_date?: string }>)[0]
    return json(200, row ? { subscription: true, product: row.product_id, expires: row.expires_date } : { subscription: false })
  } catch (error) {
    console.error('apple-status failed', error instanceof Error ? error.message.slice(0, 200) : error)
    return json(502, { error: 'failed' })
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleAppleStatus(request, process.env)
}
