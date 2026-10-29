// Shared free AI for signed-in users. Runs as a Vercel Function; the Gemini key lives only in
// the GEMINI_API_KEY environment variable and never reaches the browser.
// Prompts are fixed per task here, so this endpoint cannot be used as a general-purpose proxy.
import { DEFAULT_GEMINI_MODEL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/lib/config.js'
import { callGemini, GeminiError } from '../src/lib/ai/gemini.js'
import { isTaskName, jsonModeSystem, parseTaskOutput, userPrompt } from '../src/lib/ai/tasks.js'

const MAX_BODY_CHARS = 1_500_000

type Env = Record<string, string | undefined>

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Confirms the bearer token belongs to a real, signed-in Supabase user. */
async function isSignedIn(request: Request, fetchImpl: typeof fetch): Promise<boolean> {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const response = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: auth },
  })
  return response.ok
}

export async function handleGenerate(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) return json(503, { error: 'not_configured' })

  if (!(await isSignedIn(request, fetchImpl).catch(() => false))) return json(401, { error: 'unauthorized' })

  const raw = await request.text()
  if (raw.length > MAX_BODY_CHARS) return json(413, { error: 'too_large' })
  let body: { task?: unknown; input?: unknown }
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
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL

  try {
    // One retry if the model returns JSON in the wrong shape.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const text = await callGemini({ apiKey, model, system: jsonModeSystem(task), user, fetchImpl })
      const result = parseTaskOutput(task, text)
      if (result) return json(200, { result })
    }
    return json(502, { error: 'bad_output' })
  } catch (error) {
    if (error instanceof GeminiError) {
      if (error.status === 429) return json(429, { error: 'quota' })
      if (error.status === 413) return json(413, { error: 'too_large' })
      console.error('Gemini error', error.status, error.message)
      return json(502, { error: 'upstream', status: error.status })
    }
    console.error('generate failed', error)
    return json(500, { error: 'internal' })
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleGenerate(request, process.env)
}
