import type { JWSTransactionDecodedPayload, ResponseBodyV2DecodedPayload } from '@apple/app-store-server-library'
import { describe, expect, it, vi } from 'vitest'
import { handleAppleNotification } from './apple-notifications'
import { handleApplePurchase } from './apple-purchase'
import { appleChecks, claimedEnvironment, NotConfigured, type AppleChecks } from './appleStore'

const ID = '11111111-2222-3333-4444-555555555555'
const env = { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' }
const UNTIL = '2026-12-27T10:00:00.000Z'

const tx = (extra: Partial<JWSTransactionDecodedPayload> = {}): JWSTransactionDecodedPayload =>
  ({
    transactionId: '2000000111',
    originalTransactionId: '2000000100',
    bundleId: 'fun.studymode.app',
    productId: 'fun.studymode.app.premium.monthly',
    purchaseDate: Date.parse('2026-11-27T10:00:00Z'),
    expiresDate: Date.parse('2026-12-27T10:00:00Z'),
    appAccountToken: ID.toUpperCase(),
    environment: 'Sandbox',
    ...extra,
  }) as JWSTransactionDecodedPayload

const checks = (t: JWSTransactionDecodedPayload | Error, note?: Partial<ResponseBodyV2DecodedPayload> | Error): AppleChecks => ({
  transaction: async () => {
    if (t instanceof Error) throw t
    return t
  },
  notification: async () => {
    if (note instanceof Error) throw note
    return (note ?? {}) as ResponseBodyV2DecodedPayload
  },
})

function supabase(opts: { user?: boolean; grant?: number; owner?: string | null } = {}) {
  const calls: Array<{ url: string; body: unknown }> = []
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url)
    const headers = (init?.headers ?? {}) as Record<string, string>
    calls.push({ url: href, body: init?.body ? JSON.parse(String(init.body)) : null })
    if (href.endsWith('/auth/v1/user')) return opts.user === false ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ id: ID }))
    expect(headers.apikey).toBe('sb_secret_test')
    if (href.endsWith('/rpc/apple_grant')) return new Response(JSON.stringify(UNTIL), { status: opts.grant ?? 200 })
    if (href.endsWith('/rpc/apple_revoke')) return new Response(JSON.stringify(null))
    if (href.includes('/rest/v1/apple_transactions')) return new Response(JSON.stringify(opts.owner ? [{ user_id: opts.owner }] : []))
    throw new Error(`unexpected ${href}`)
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

const buy = (body: unknown = { transaction: 'h.p.s' }, token: string | null = 'user-token', method = 'POST') =>
  new Request('https://studymode.fun/api/apple-purchase', {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })

describe('POST /api/apple-purchase', () => {
  it('counts a verified purchase of the caller and answers with the Premium end', async () => {
    const { fetchImpl, calls } = supabase()
    const res = await handleApplePurchase(buy(), env, checks(tx()), fetchImpl)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, premium_until: UNTIL })
    expect(calls.find((c) => c.url.endsWith('/rpc/apple_grant'))?.body).toEqual({
      p_transaction_id: '2000000111',
      p_original_transaction_id: '2000000100',
      p_user: ID,
      p_product: 'fun.studymode.app.premium.monthly',
      p_environment: 'Sandbox',
      p_purchase: '2026-11-27T10:00:00.000Z',
      p_expires: '2026-12-27T10:00:00.000Z',
    })
  })

  it('the two-week pass has no end date; the database adds 14 days', async () => {
    const { fetchImpl, calls } = supabase()
    const res = await handleApplePurchase(buy(), env, checks(tx({ productId: 'fun.studymode.app.premium.twoweeks', expiresDate: undefined })), fetchImpl)
    expect(res.status).toBe(200)
    expect(calls.find((c) => c.url.endsWith('/rpc/apple_grant'))?.body).toMatchObject({ p_product: 'fun.studymode.app.premium.twoweeks', p_expires: null })
  })

  it('refuses for good (the app finishes the transaction): bad signature, other app, other product, refunded, other account', async () => {
    const cases: Array<[JWSTransactionDecodedPayload | Error, number, string]> = [
      [new Error('chain'), 400, 'invalid_transaction'],
      [tx({ bundleId: 'com.other.app' }), 400, 'wrong_app'],
      [tx({ productId: 'fun.studymode.app.coins' }), 400, 'unknown_product'],
      [tx({ revocationDate: Date.now() }), 409, 'revoked'],
      [tx({ appAccountToken: '99999999-2222-3333-4444-555555555555' }), 403, 'wrong_account'],
      [tx({ appAccountToken: undefined }), 403, 'wrong_account'],
    ]
    for (const [t, status, error] of cases) {
      const { fetchImpl, calls } = supabase()
      const res = await handleApplePurchase(buy(), env, checks(t), fetchImpl)
      expect([res.status, (await res.json()).error]).toEqual([status, error])
      expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false)
    }
  })

  it('asks the app to try again later (401 / 5xx) when the session, the setup or the database is not right', async () => {
    expect((await handleApplePurchase(buy(), env, checks(tx()), supabase({ user: false }).fetchImpl)).status).toBe(401)
    expect((await handleApplePurchase(buy({ transaction: 'x' }, null), env, checks(tx()), supabase().fetchImpl)).status).toBe(401)
    expect((await handleApplePurchase(buy(), {}, checks(tx()), supabase().fetchImpl)).status).toBe(503)
    expect((await handleApplePurchase(buy(), env, checks(new NotConfigured('no app id')), supabase().fetchImpl)).status).toBe(503)
    expect((await handleApplePurchase(buy(), env, checks(tx()), supabase({ grant: 500 }).fetchImpl)).status).toBe(502)
  })

  it('rejects requests without a transaction, and other methods', async () => {
    expect((await handleApplePurchase(buy({}), env, checks(tx()), supabase().fetchImpl)).status).toBe(400)
    expect((await handleApplePurchase(buy(undefined, 'user-token', 'GET'), env, checks(tx()), supabase().fetchImpl)).status).toBe(405)
  })
})

const notify = (body: unknown = { signedPayload: 'h.p.s' }) =>
  new Request('https://studymode.fun/api/apple-notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('POST /api/apple-notifications', () => {
  const note = (type: string) => ({ notificationType: type, data: { signedTransactionInfo: 't.t.t' } }) as unknown as Partial<ResponseBodyV2DecodedPayload>

  it('a renewal extends Premium for the account in appAccountToken', async () => {
    const { fetchImpl, calls } = supabase()
    const res = await handleAppleNotification(notify(), env, checks(tx({ transactionId: '2000000222' }), note('DID_RENEW')), fetchImpl)
    expect(res.status).toBe(200)
    expect(calls.find((c) => c.url.endsWith('/rpc/apple_grant'))?.body).toMatchObject({ p_transaction_id: '2000000222', p_user: ID })
  })

  it('without appAccountToken the renewal follows the first purchase; with no account it is acknowledged and skipped', async () => {
    const owner = supabase({ owner: ID })
    await handleAppleNotification(notify(), env, checks(tx({ appAccountToken: undefined }), note('DID_RENEW')), owner.fetchImpl)
    expect(owner.calls.find((c) => c.url.endsWith('/rpc/apple_grant'))?.body).toMatchObject({ p_user: ID })

    const nobody = supabase({ owner: null })
    const res = await handleAppleNotification(notify(), env, checks(tx({ appAccountToken: undefined }), note('DID_RENEW')), nobody.fetchImpl)
    expect(await res.json()).toEqual({ ok: true, ignored: 'no_account' })
    expect(nobody.calls.some((c) => c.url.endsWith('/rpc/apple_grant'))).toBe(false)
  })

  it('a refund or revoke takes back that transaction', async () => {
    for (const type of ['REFUND', 'REVOKE']) {
      const { fetchImpl, calls } = supabase()
      const res = await handleAppleNotification(notify(), env, checks(tx({ revocationDate: Date.now() }), note(type)), fetchImpl)
      expect(res.status).toBe(200)
      expect(calls.find((c) => c.url.endsWith('/rpc/apple_revoke'))?.body).toEqual({ p_transaction_id: '2000000111' })
    }
  })

  it('other notifications are acknowledged; a forged one is refused; a database failure asks Apple to retry', async () => {
    const quiet = supabase()
    const res = await handleAppleNotification(notify(), env, checks(tx(), { notificationType: 'TEST' } as Partial<ResponseBodyV2DecodedPayload>), quiet.fetchImpl)
    expect(await res.json()).toEqual({ ok: true, ignored: 'TEST' })
    expect(quiet.calls).toEqual([])
    expect((await handleAppleNotification(notify(), env, checks(tx(), new Error('chain')), supabase().fetchImpl)).status).toBe(400)
    expect((await handleAppleNotification(notify({}), env, checks(tx(), note('DID_RENEW')), supabase().fetchImpl)).status).toBe(400)
    expect((await handleAppleNotification(notify(), env, checks(tx(), note('DID_RENEW')), supabase({ grant: 500 }).fetchImpl)).status).toBe(500)
  })
})

describe('the real verifier', () => {
  const jws = (payload: object) => `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c2ln`

  it('reads the claimed environment of a transaction or a notification', () => {
    expect(claimedEnvironment(jws({ environment: 'Sandbox' }))).toBe('Sandbox')
    expect(claimedEnvironment(jws({ data: { environment: 'Production' } }))).toBe('Production')
    expect(claimedEnvironment('nonsense')).toBeNull()
  })

  it('production needs the app’s Apple ID before anything is trusted; a self-made JWS never passes', async () => {
    await expect(appleChecks({}).transaction(jws({ environment: 'Production' }))).rejects.toBeInstanceOf(NotConfigured)
    await expect(appleChecks({}).transaction(jws({ environment: 'Xcode' }))).rejects.toThrow()
    await expect(appleChecks({}).transaction(jws({ environment: 'Sandbox', bundleId: 'fun.studymode.app' }))).rejects.not.toBeInstanceOf(NotConfigured)
  })
})
