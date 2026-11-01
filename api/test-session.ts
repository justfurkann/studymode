// Test door: opens a session for the one test account, so automated checks of the live site can sign
// in even though sign-in asks for a bot check (Cloudflare Turnstile) that automated browsers cannot pass.
//
// Locked three ways: it answers only when all three environment variables are set; the request must
// carry the long TEST_SESSION_SECRET; and it can only ever open TEST_ACCOUNT_EMAIL (the address comes
// from the environment, never from the request). Anything else gets a plain 404, as if it did not exist.
// To close the door, delete TEST_SESSION_SECRET in Vercel.
import { timingSafeEqual } from 'node:crypto'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/lib/config.js'

type Env = Record<string, string | undefined>

const MIN_SECRET = 32
const notFound = () => new Response('Not found', { status: 404 })
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Supabase's admin key: the new `sb_secret_…` key goes in `apikey`; an old service_role JWT also as a bearer token. */
function adminHeaders(key: string): Record<string, string> {
  return { apikey: key, ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}), 'content-type': 'application/json' }
}

export async function handleTestSession(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const secret = env.TEST_SESSION_SECRET ?? ''
  const adminKey = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const email = (env.TEST_ACCOUNT_EMAIL ?? '').trim().toLowerCase()
  if (request.method !== 'POST' || secret.length < MIN_SECRET || !adminKey || !email) return notFound()
  if (!sameSecret(request.headers.get('x-test-secret') ?? '', secret)) return notFound()

  try {
    // A one-time sign-in link for the test account (nothing is emailed), then that link becomes a session.
    const link = await fetchImpl(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: adminHeaders(adminKey),
      body: JSON.stringify({ type: 'magiclink', email }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!link.ok) {
      console.error('test-session: generate_link', link.status)
      return json(502, { error: 'link_failed' })
    }
    const linkBody = (await link.json()) as { hashed_token?: string; properties?: { hashed_token?: string }; email?: string }
    const tokenHash = linkBody.properties?.hashed_token ?? linkBody.hashed_token
    if (!tokenHash) return json(502, { error: 'link_failed' })

    const verify = await fetchImpl(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!verify.ok) {
      console.error('test-session: verify', verify.status)
      return json(502, { error: 'verify_failed' })
    }
    const session = (await verify.json()) as { access_token?: string; user?: { email?: string } }
    // Belt and braces: never hand out a session for anyone but the test account.
    if (!session.access_token || session.user?.email?.toLowerCase() !== email) return json(502, { error: 'verify_failed' })
    console.info('test-session: opened a session for the test account')
    return json(200, session)
  } catch (error) {
    console.error('test-session failed', error instanceof Error ? error.message.slice(0, 200) : error)
    return json(500, { error: 'internal' })
  }
}

export function GET(): Response {
  return notFound()
}

export async function POST(request: Request): Promise<Response> {
  return handleTestSession(request, process.env)
}
