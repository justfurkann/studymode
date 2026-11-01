// Free+ : Gemini on Vertex AI (Google Cloud), paid from the trial credit, for VIPs and admins.
// No key is stored anywhere: Vercel signs a short-lived OIDC token for this function, Google's
// Security Token Service swaps it for a federated token, and that token impersonates a service
// account that may only call Vertex AI. See docs/HANDOFF.md (Aşama 12) for the Google Cloud setup.
import type { GeminiTarget } from '../src/lib/ai/gemini.js'

type Env = Record<string, string | undefined>

const SCOPE = 'https://www.googleapis.com/auth/cloud-platform'
/**
 * Long inputs (a whole lecture note, page photos, several notes for a mock exam) need speed to
 * finish inside the function's time limit: the strongest Flash, which also answers quick
 * explanations fast. Tasks where careful thinking pays off (grading a written answer, memory aids) get the flagship
 * reasoning model, with the Pro model and Flash behind it. Override with VERTEX_MODELS /
 * VERTEX_SMART_MODELS (comma separated).
 */
export const DEFAULT_VERTEX_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash']
export const DEFAULT_VERTEX_SMART_MODELS = ['gemini-4-argon', 'gemini-3.1-pro-preview', 'gemini-3.8-flash']
// Measured 1 Nov 2026: the flagship took ~19 s for a short explanation vs ~2 s on the free model;
// worth it where accuracy matters (grading, memory aids), not for a quick "Bu konuyu anlamadım".
const SMART_TASKS = new Set(['grade', 'memory'])

export function vertexConfigured(env: Env): boolean {
  return !!(env.GCP_PROJECT_ID && env.GCP_PROJECT_NUMBER && env.GCP_SERVICE_ACCOUNT_EMAIL && env.GCP_WORKLOAD_IDENTITY_POOL_ID && env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID)
}

export function vertexModels(env: Env, task?: string): string[] {
  if (task === 'tts') return ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']
  if (task === 'image') return ['gemini-3.1-flash-lite-image', 'gemini-nano-banana-2.1']
  // One embedding model only: vectors from two models cannot be compared.
  if (task === 'embed') return ['gemini-embedding-001']
  const smart = !!task && SMART_TASKS.has(task)
  const configured = smart ? env.VERTEX_SMART_MODELS : env.VERTEX_MODELS
  const list = configured ? configured.split(',') : smart ? DEFAULT_VERTEX_SMART_MODELS : DEFAULT_VERTEX_MODELS
  return [...new Set(list.map((m) => m.trim()).filter(Boolean))]
}

let cached: { token: string; expires: number } | null = null

/** For tests: forget the cached access token. */
export function resetVertexToken() {
  cached = null
}

/** A one-hour Google access token for the service account, from Vercel's OIDC token. */
export async function vertexAccessToken(env: Env, oidcToken: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token
  const audience = `//iam.googleapis.com/projects/${env.GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${env.GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`
  const sts = await fetchImpl('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience,
      scope: SCOPE,
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      subject_token: oidcToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    }).toString(),
    signal: AbortSignal.timeout(8_000),
  })
  if (!sts.ok) throw new Error(`sts ${sts.status}: ${(await sts.text().catch(() => '')).slice(0, 200)}`)
  const federated = ((await sts.json()) as { access_token?: string }).access_token
  if (!federated) throw new Error('sts: no token')
  const iam = await fetchImpl(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(env.GCP_SERVICE_ACCOUNT_EMAIL!)}:generateAccessToken`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${federated}` },
    body: JSON.stringify({ scope: [SCOPE], lifetime: '3600s' }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!iam.ok) throw new Error(`iamcredentials ${iam.status}: ${(await iam.text().catch(() => '')).slice(0, 200)}`)
  const body = (await iam.json()) as { accessToken?: string; expireTime?: string }
  if (!body.accessToken) throw new Error('iamcredentials: no token')
  cached = { token: body.accessToken, expires: body.expireTime ? Date.parse(body.expireTime) : Date.now() + 3_000_000 }
  return body.accessToken
}

/** Where Free+ requests go: the global Vertex endpoint of the trial project. */
export function vertexTarget(env: Env, accessToken: string): GeminiTarget {
  const location = env.VERTEX_LOCATION || 'global'
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`
  return {
    url: (model) => `https://${host}/v1/projects/${env.GCP_PROJECT_ID}/locations/${location}/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
    headers: { authorization: `Bearer ${accessToken}` },
  }
}
