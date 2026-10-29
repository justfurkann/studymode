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

export async function callGemini(options: { apiKey: string; model: string; system: string; user: string; fetchImpl?: typeof fetch }): Promise<string> {
  const { apiKey, model, system, user, fetchImpl = fetch } = options
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 32768 },
    }),
  })

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

/** Statuses where trying again (or another model) can help. */
const RETRYABLE = new Set([500, 502, 503, 504])
const NEXT_MODEL = new Set([404, 429, 500, 502, 503, 504])

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Calls the first model that answers. Overloaded models (503) get two quick retries; a model that is
 * still overloaded, out of quota (429) or unknown (404) hands over to the next one in `models`.
 */
export async function callGeminiWithFallback(options: {
  apiKey: string
  models: string[]
  system: string
  user: string
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<unknown>
}): Promise<{ text: string; model: string }> {
  const { models, sleep = wait, ...call } = options
  let lastError: unknown = new GeminiError('no model configured', 500)
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return { text: await callGemini({ ...call, model }), model }
      } catch (error) {
        lastError = error
        if (!(error instanceof GeminiError)) throw error
        if (RETRYABLE.has(error.status) && attempt < 2) {
          await sleep(1500 * (attempt + 1))
          continue
        }
        if (NEXT_MODEL.has(error.status)) break
        throw error
      }
    }
  }
  throw lastError
}
