// Gemini REST call used by both the browser (own key) and the /api function (shared key).
// No imports, so the server can load it without a bundler.

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>
  promptFeedback?: { blockReason?: string }
}

const DEFAULT_ATTEMPT_TIMEOUT_MS = 22_000
const DEFAULT_DEADLINE_MS = 50_000

export type GeminiUserPart = { text: string } | { inlineData: { mimeType: string; data: string } }

/** Turns `<image index="1" mime="image/jpeg">BASE64</image>` blocks in a task prompt into Gemini inlineData parts. */
export function buildUserParts(user: string): GeminiUserPart[] {
  if (!user.includes('<image ')) return [{ text: user }]
  const parts: GeminiUserPart[] = []
  const pattern = /<image\s+index="\d+"\s+mime="(image\/(?:jpeg|png|webp))">([A-Za-z0-9+/=\s]+)<\/image>/g
  const textOnly = user
    .replace(pattern, (_match, mimeType: string, data: string) => {
      parts.push({ inlineData: { mimeType, data: data.replace(/\s+/g, '') } })
      return ''
    })
    .trim()
  if (textOnly) parts.unshift({ text: textOnly })
  return parts.length ? parts : [{ text: user }]
}

export async function callGemini(options: {
  apiKey: string
  model: string
  system: string
  user: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<string> {
  const { apiKey, model, system, user, fetchImpl = fetch, timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS } = options
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    maxOutputTokens: 32768,
  }
  // Keep thinking overhead minimal so large lecture notes finish in 4-8s instead of timing out at 60s.
  if (model.includes('3.1-flash-lite')) {
    generationConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' }
  } else if (model.includes('3.8-flash') || model.includes('4-argon')) {
    generationConfig.thinkingConfig = { thinkingLevel: 'LOW' }
  }

  let response: Response
  try {
    response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: buildUserParts(user) }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new GeminiError(`timeout: ${detail.slice(0, 200)}`, 504)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new GeminiError(detail.slice(0, 500) || response.statusText, response.status)
  }

  const data = (await response.json()) as GeminiResponse
  if (data.promptFeedback?.blockReason) throw new GeminiError(`blocked: ${data.promptFeedback.blockReason}`, 422)
  const candidate = data.candidates?.[0]
  if (candidate?.finishReason === 'MAX_TOKENS') throw new GeminiError('max_tokens', 413)
  const text = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new GeminiError(`empty response (${candidate?.finishReason ?? 'unknown'})`, 502)
  return text
}

/** Statuses where trying the same model again can help. Timeouts (504) skip straight to the next model. */
const RETRYABLE = new Set([500, 502, 503])
const NEXT_MODEL = new Set([404, 429, 500, 502, 503, 504])

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Calls the first model that answers within the time budget. Overloaded models (503) get two quick
 * retries; a model that times out (504), is out of quota (429) or is unknown (404) immediately hands
 * over to the next one in `models`.
 */
export async function callGeminiWithFallback(options: {
  apiKey: string
  models: string[]
  system: string
  user: string
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<unknown>
  timeoutMs?: number
  deadlineMs?: number
}): Promise<{ text: string; model: string }> {
  const { models, sleep = wait, timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS, deadlineMs = DEFAULT_DEADLINE_MS, ...call } = options
  const started = Date.now()
  let lastError: unknown = new GeminiError('no model configured', 500)
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const remaining = deadlineMs - (Date.now() - started)
      if (remaining <= 1500) throw lastError instanceof GeminiError ? lastError : new GeminiError('deadline exceeded', 504)
      try {
        return { text: await callGemini({ ...call, model, timeoutMs: Math.min(timeoutMs, remaining) }), model }
      } catch (error) {
        lastError = error
        if (!(error instanceof GeminiError)) throw error
        if (RETRYABLE.has(error.status) && attempt < 2) {
          await sleep(600 * (attempt + 1))
          continue
        }
        if (NEXT_MODEL.has(error.status)) break
        throw error
      }
    }
  }
  throw lastError
}
