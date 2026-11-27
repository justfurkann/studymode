// Premium bought in the iOS app with App Store In-App Purchase.
//
// POST /api/apple-purchase
//   Authorization: Bearer <the user's own Supabase access token>
//   Body: { "transaction": "<StoreKit 2 signed transaction (JWS)>" }
//
// The JWS is checked against Apple's certificate chain (Apple Root CA - G3), our bundle id and products,
// and the purchase must carry the caller's user id as appAccountToken. Each transaction counts once.
// Subscriptions run Premium until their end date; the two-week pass adds 14 days.
//
// Answers (JSON): 200 { ok: true, premium_until }; 400 bad_request / invalid_transaction / wrong_app /
// unknown_product; 401 not_signed_in; 403 wrong_account; 405; 409 revoked;
// 503 not_configured (the app keeps the transaction and tries again later); 502 grant_failed.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/lib/config.js'
import { appleChecks, grantTransaction, json, NotConfigured, transactionProblem, type AppleChecks, type Env } from './appleStore.js'

export async function handleApplePurchase(request: Request, env: Env, checks: AppleChecks = appleChecks(env), fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const adminKey = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!adminKey) return json(503, { error: 'not_configured' })
  const auth = request.headers.get('authorization') ?? ''
  if (!/^Bearer \S+$/.test(auth)) return json(401, { error: 'not_signed_in' })

  let jws = ''
  try {
    const body = (await request.json()) as { transaction?: unknown }
    jws = typeof body?.transaction === 'string' ? body.transaction.trim() : ''
  } catch {
    // Handled below.
  }
  if (!jws || jws.length > 20_000) return json(400, { error: 'bad_request' })

  try {
    const me = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: auth }, signal: AbortSignal.timeout(8_000) })
    if (!me.ok) return json(401, { error: 'not_signed_in' })
    const userId = String(((await me.json()) as { id?: string }).id ?? '').toLowerCase()
    if (!/^[0-9a-f-]{36}$/.test(userId)) return json(401, { error: 'not_signed_in' })

    let tx
    try {
      tx = await checks.transaction(jws)
    } catch (error) {
      if (error instanceof NotConfigured) return json(503, { error: 'not_configured' })
      console.error('apple-purchase: verification failed', error instanceof Error ? error.message.slice(0, 200) : error)
      return json(400, { error: 'invalid_transaction' })
    }
    const problem = transactionProblem(tx)
    if (problem) return json(problem === 'revoked' ? 409 : 400, { error: problem })
    // Only the account that bought it: the app puts the user id into the purchase.
    if ((tx.appAccountToken ?? '').toLowerCase() !== userId) return json(403, { error: 'wrong_account' })

    const until = await grantTransaction(tx, userId, adminKey, fetchImpl)
    console.info('apple-purchase: counted', { product: tx.productId, environment: tx.environment })
    return json(200, { ok: true, premium_until: until })
  } catch (error) {
    console.error('apple-purchase failed', error instanceof Error ? error.message.slice(0, 200) : error)
    return json(502, { error: 'grant_failed' })
  }
}

export function GET(): Response {
  return json(405, { error: 'method_not_allowed' })
}

export async function POST(request: Request): Promise<Response> {
  return handleApplePurchase(request, process.env)
}
