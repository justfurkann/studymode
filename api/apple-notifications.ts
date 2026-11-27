// App Store Server Notifications V2 (set this URL in App Store Connect → the app → App Information).
//
// POST /api/apple-notifications   Body: { "signedPayload": "<JWS from Apple>" }
//
// Renewals (DID_RENEW, SUBSCRIBED, ONE_TIME_CHARGE) count the transaction like /api/apple-purchase;
// REFUND and REVOKE take back the time that transaction added. Everything else is acknowledged.
// A 5xx makes Apple send it again later, so only passing failures (the database) answer 5xx.
import { appleChecks, grantTransaction, json, NotConfigured, ownerOf, revokeTransaction, transactionProblem, type AppleChecks, type Env } from './appleStore.js'

const GRANT = new Set(['DID_RENEW', 'SUBSCRIBED', 'ONE_TIME_CHARGE'])
const TAKE_BACK = new Set(['REFUND', 'REVOKE'])

export async function handleAppleNotification(request: Request, env: Env, checks: AppleChecks = appleChecks(env), fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const adminKey = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!adminKey) return json(503, { error: 'not_configured' })

  let signed = ''
  try {
    const body = (await request.json()) as { signedPayload?: unknown }
    signed = typeof body?.signedPayload === 'string' ? body.signedPayload : ''
  } catch {
    // Handled below.
  }
  if (!signed || signed.length > 100_000) return json(400, { error: 'bad_request' })

  let note
  try {
    note = await checks.notification(signed)
  } catch (error) {
    if (error instanceof NotConfigured) return json(503, { error: 'not_configured' })
    console.error('apple-notifications: verification failed', error instanceof Error ? error.message.slice(0, 200) : error)
    return json(400, { error: 'invalid_notification' })
  }

  const type = String(note.notificationType ?? '')
  const signedTx = note.data?.signedTransactionInfo
  if (!signedTx || (!GRANT.has(type) && !TAKE_BACK.has(type))) return json(200, { ok: true, ignored: type })

  try {
    const tx = await checks.transaction(signedTx)
    if (TAKE_BACK.has(type)) {
      if (tx.transactionId) await revokeTransaction(tx.transactionId, adminKey, fetchImpl)
      console.info('apple-notifications: taken back', { type })
      return json(200, { ok: true })
    }
    if (transactionProblem(tx)) return json(200, { ok: true, ignored: transactionProblem(tx) })
    const owner = await ownerOf(tx, adminKey, fetchImpl)
    // A purchase we cannot tie to an account (or a deleted account): nothing to extend.
    if (!owner) return json(200, { ok: true, ignored: 'no_account' })
    await grantTransaction(tx, owner, adminKey, fetchImpl)
    console.info('apple-notifications: counted', { type, product: tx.productId })
    return json(200, { ok: true })
  } catch (error) {
    if (error instanceof NotConfigured) return json(503, { error: 'not_configured' })
    console.error('apple-notifications failed', type, error instanceof Error ? error.message.slice(0, 200) : error)
    return json(500, { error: 'failed' })
  }
}

export function GET(): Response {
  return json(405, { error: 'method_not_allowed' })
}

export async function POST(request: Request): Promise<Response> {
  return handleAppleNotification(request, process.env)
}
