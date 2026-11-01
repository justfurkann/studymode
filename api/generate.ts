// Shared free AI for signed-in users. Runs as a Vercel Function; the Gemini key lives only in
// the GEMINI_API_KEY environment variable and never reaches the browser.
// Prompts are fixed per task here, so this endpoint cannot be used as a general-purpose proxy.
import { DEFAULT_GEMINI_FALLBACKS, DEFAULT_GEMINI_MODEL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/lib/config.js'
import { callGeminiWithFallback, GeminiError } from '../src/lib/ai/gemini.js'
import { isTaskName, jsonModeSystem, parseTaskOutput, userPrompt } from '../src/lib/ai/tasks.js'
import { vertexAccessToken, vertexConfigured, vertexModels, vertexTarget } from './vertex.js'

export const MAX_BODY_CHARS = 1_500_000

/** Gives Vercel Hobby functions the full 60s ceiling while our internal deadline finishes well before it. */
export const maxDuration = 60

type Env = Record<string, string | undefined>

/** Main model first, then fallbacks, without duplicates. */
export function geminiModels(env: Env): string[] {
  const fallbacks = env.GEMINI_FALLBACK_MODELS ? env.GEMINI_FALLBACK_MODELS.split(',') : DEFAULT_GEMINI_FALLBACKS
  return [...new Set([env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, ...fallbacks].map((m) => m.trim()).filter(Boolean))]
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Confirms the bearer token belongs to a real, signed-in Supabase user. */
async function isSignedIn(request: Request, fetchImpl: typeof fetch): Promise<boolean> {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const response = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: auth },
    signal: AbortSignal.timeout(5_000),
  })
  return response.ok
}

export interface Quota {
  role: 'normal' | 'vip' | 'admin'
  used: number
  limit: number | null
  allowed: boolean
}

/**
 * Calls one of the quota functions in Supabase as the signed-in user (their own token), so the
 * database decides the role and the count. Fails open (null) when the functions are not there yet
 * or Supabase hiccups: a quota problem should never take the free AI down for everyone.
 */
async function quotaCall(name: 'ai_quota' | 'consume_ai', auth: string, fetchImpl: typeof fetch): Promise<Quota | null> {
  try {
    const response = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: auth, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return null
    const body = (await response.json()) as Partial<Quota> | null
    if (!body || typeof body.allowed !== 'boolean' || typeof body.used !== 'number') return null
    return { role: body.role === 'vip' || body.role === 'admin' ? body.role : 'normal', used: body.used, limit: typeof body.limit === 'number' ? body.limit : null, allowed: body.allowed }
  } catch {
    return null
  }
}

export interface PlusQuota {
  eligible: boolean
  allowed: boolean
  used: number
  limit: number
  site_used: number
  site_limit: number
}

/** Free+ caps from Supabase, as the signed-in user. Null (= no Free+) on any problem. */
async function plusCall(name: 'plus_quota' | 'consume_plus', auth: string, fetchImpl: typeof fetch): Promise<PlusQuota | null> {
  try {
    const response = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: auth, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return null
    const body = (await response.json()) as Partial<PlusQuota> | null
    if (!body || typeof body.eligible !== 'boolean' || typeof body.allowed !== 'boolean') return null
    return { eligible: body.eligible, allowed: body.allowed, used: Number(body.used) || 0, limit: Number(body.limit) || 0, site_used: Number(body.site_used) || 0, site_limit: Number(body.site_limit) || 0 }
  } catch {
    return null
  }
}

export async function handleGenerate(
  request: Request,
  env: Env,
  fetchImpl: typeof fetch = fetch,
  sleep?: (ms: number) => Promise<unknown>,
): Promise<Response> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) return json(503, { error: 'not_configured' })

  if (!(await isSignedIn(request, fetchImpl).catch(() => false))) return json(401, { error: 'unauthorized' })

  const raw = await request.text()
  if (raw.length > MAX_BODY_CHARS) return json(413, { error: 'too_large' })
  let body: { task?: unknown; input?: unknown; engine?: unknown }
  try {
    body = JSON.parse(raw)
  } catch {
    return json(400, { error: 'bad_request' })
  }
  const { task, input } = body
  if (!isTaskName(task) || !input || typeof input !== 'object') return json(400, { error: 'bad_request' })

  let user: string
  try {
    user = userPrompt(task, input)
  } catch {
    return json(400, { error: 'bad_request' })
  }
  const models = geminiModels(env)
  const auth = request.headers.get('authorization')!

  // Free+ (VIP/admin): Gemini on Vertex AI, within its own daily caps. Any problem (not set up, cap
  // reached, Google error) falls through to the normal free AI below, so nobody is left without an answer.
  if (body.engine === 'plus' && vertexConfigured(env)) {
    const plus = await plusCall('plus_quota', auth, fetchImpl)
    const oidc = request.headers.get('x-vercel-oidc-token') ?? env.VERCEL_OIDC_TOKEN
    if (plus?.eligible && plus.allowed && oidc) {
      try {
        const target = vertexTarget(env, await vertexAccessToken(env, oidc, fetchImpl))
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const { text, model } = await callGeminiWithFallback({ target, models: vertexModels(env), system: jsonModeSystem(task), user, fetchImpl, sleep })
          const result = parseTaskOutput(task, text)
          if (result) return json(200, { result, engine: 'plus', model, plus: (await plusCall('consume_plus', auth, fetchImpl)) ?? undefined })
        }
      } catch (error) {
        console.error('Free+ failed, using the free AI', error instanceof Error ? error.message.slice(0, 300) : error)
      }
    }
  }

  // Daily allowance per person (normal 40, VIP 150, admin unlimited), checked before calling Gemini.
  const before = await quotaCall('ai_quota', auth, fetchImpl)
  if (before && !before.allowed) return json(429, { error: 'daily_limit', quota: before })

  try {
    // One retry if the model returns JSON in the wrong shape.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { text } = await callGeminiWithFallback({ apiKey, models, system: jsonModeSystem(task), user, fetchImpl, sleep })
      const result = parseTaskOutput(task, text)
      // Only a successful answer is counted.
      if (result) return json(200, { result, quota: (await quotaCall('consume_ai', auth, fetchImpl)) ?? undefined })
    }
    return json(502, { error: 'bad_output' })
  } catch (error) {
    if (error instanceof GeminiError) {
      if (error.status === 429) return json(429, { error: 'quota' })
      if (error.status === 503 || error.status === 504) return json(503, { error: 'busy' })
      if (error.status === 413) return json(413, { error: 'too_large' })
      console.error('Gemini error', error.status, error.message)
      return json(502, { error: 'upstream', status: error.status, detail: error.message.slice(0, 200) })
    }
    console.error('generate failed', error)
    return json(500, { error: 'internal' })
  }
}

/** Health check: open /api/generate in a browser to see whether the shared AI is set up. */
export function handleStatus(env: Env): Response {
  return json(200, { ok: true, configured: !!env.GEMINI_API_KEY, models: geminiModels(env), plus: vertexConfigured(env) ? vertexModels(env) : null })
}

export function GET(): Response {
  return handleStatus(process.env)
}

export async function POST(request: Request): Promise<Response> {
  return handleGenerate(request, process.env)
}
