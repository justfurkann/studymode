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
