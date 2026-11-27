// Shared by /api/apple-purchase and /api/apple-notifications: checks that an App Store transaction or
// notification is really signed by Apple (Apple's official library, chain up to Apple Root CA - G3),
// and counts it on the account through the database functions apple_grant / apple_revoke.
import { Environment, SignedDataVerifier, type JWSTransactionDecodedPayload, type ResponseBodyV2DecodedPayload } from '@apple/app-store-server-library'
import { SUPABASE_URL } from '../src/lib/config.js'

export type Env = Record<string, string | undefined>

export const BUNDLE_ID = 'fun.studymode.app'
export const PRODUCTS = new Set(['fun.studymode.app.premium.monthly', 'fun.studymode.app.premium.sixmonths', 'fun.studymode.app.premium.twoweeks'])

/**
 * Apple Root CA - G3, from https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 * SHA-256 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79 (valid until 2039).
 */
const APPLE_ROOT_CA_G3 = 'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA=='

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/** The environment a JWS says it is from, read before checking it, to pick the right verifier. */
export function claimedEnvironment(jws: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jws.split('.')[1] ?? '', 'base64url').toString('utf8')) as { environment?: string; data?: { environment?: string } }
    return payload.environment ?? payload.data?.environment ?? null
  } catch {
    return null
  }
}

/** Thrown when we cannot check this environment yet (production needs the app's Apple ID). */
export class NotConfigured extends Error {}

const verifiers = new Map<string, SignedDataVerifier>()

function verifierFor(jws: string, env: Env): SignedDataVerifier {
  const environment = claimedEnvironment(jws)
  if (environment !== Environment.SANDBOX && environment !== Environment.PRODUCTION) throw new Error(`unsupported environment ${environment}`)
  const appAppleId = Number(env.APPLE_APP_APPLE_ID ?? '') || undefined
  if (environment === Environment.PRODUCTION && !appAppleId) throw new NotConfigured('APPLE_APP_APPLE_ID is not set')
  const key = `${environment}|${appAppleId ?? ''}`
  let verifier = verifiers.get(key)
  if (!verifier) {
    verifier = new SignedDataVerifier([Buffer.from(APPLE_ROOT_CA_G3, 'base64')], true, environment as Environment, BUNDLE_ID, appAppleId)
    verifiers.set(key, verifier)
  }
  return verifier
}

export interface AppleChecks {
  transaction(jws: string): Promise<JWSTransactionDecodedPayload>
  notification(jws: string): Promise<ResponseBodyV2DecodedPayload>
}

export const appleChecks = (env: Env): AppleChecks => ({
  transaction: (jws) => verifierFor(jws, env).verifyAndDecodeTransaction(jws),
  notification: (jws) => verifierFor(jws, env).verifyAndDecodeNotification(jws),
})

export function adminHeaders(key: string): Record<string, string> {
  return { apikey: key, ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}), 'content-type': 'application/json' }
}

const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

/** Counts a verified transaction for `userId` (once per transaction id). Returns the Premium end. */
export async function grantTransaction(tx: JWSTransactionDecodedPayload, userId: string, adminKey: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/apple_grant`, {
    method: 'POST',
    headers: adminHeaders(adminKey),
    body: JSON.stringify({
      p_transaction_id: tx.transactionId,
      p_original_transaction_id: tx.originalTransactionId ?? tx.transactionId,
      p_user: userId,
      p_product: tx.productId,
      p_environment: tx.environment,
      p_purchase: new Date(tx.purchaseDate ?? Date.now()).toISOString(),
      p_expires: tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null,
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`apple_grant ${response.status}`)
  return (await response.json()) as string
}

export async function revokeTransaction(transactionId: string, adminKey: string, fetchImpl: typeof fetch): Promise<void> {
  const response = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/apple_revoke`, {
    method: 'POST',
    headers: adminHeaders(adminKey),
    body: JSON.stringify({ p_transaction_id: transactionId }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`apple_revoke ${response.status}`)
}

/** Whose purchase: the app sets appAccountToken to the user id; renewals also follow the first purchase. */
export async function ownerOf(tx: JWSTransactionDecodedPayload, adminKey: string, fetchImpl: typeof fetch): Promise<string | null> {
  if (isUuid(tx.appAccountToken)) return tx.appAccountToken.toLowerCase()
  if (!tx.originalTransactionId) return null
  const response = await fetchImpl(
    `${SUPABASE_URL}/rest/v1/apple_transactions?original_transaction_id=eq.${encodeURIComponent(tx.originalTransactionId)}&select=user_id&limit=1`,
    { headers: adminHeaders(adminKey), signal: AbortSignal.timeout(8_000) },
  )
  if (!response.ok) throw new Error(`apple_transactions ${response.status}`)
  const rows = (await response.json()) as Array<{ user_id?: string }>
  return isUuid(rows[0]?.user_id) ? rows[0].user_id : null
}

/** What a transaction may be counted for: our app, one of our products, and not refunded. */
export function transactionProblem(tx: JWSTransactionDecodedPayload): string | null {
  if (tx.bundleId !== BUNDLE_ID) return 'wrong_app'
  if (!tx.transactionId || !tx.productId || !PRODUCTS.has(tx.productId)) return 'unknown_product'
  if (tx.revocationDate) return 'revoked'
  return null
}
