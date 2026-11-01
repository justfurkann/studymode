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
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
        thought?: boolean
        inlineData?: { mimeType?: string; data?: string }
      }>
    }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
  embedding?: { values?: number[] }
  embeddings?: Array<{ values?: number[] }>
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

/** Where to send a request instead of the public Gemini API (e.g. Vertex AI with a bearer token). */
export interface GeminiTarget {
  url(model: string): string
  headers: Record<string, string>
}

export async function callGemini(options: {
  apiKey?: string
  target?: GeminiTarget
  model: string
  system: string
  user: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<string> {
  const { apiKey, target, model, system, user, fetchImpl = fetch, timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS } = options
  const baseUrl = target ? target.url(model) : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const headers: Record<string, string> = target ? { 'content-type': 'application/json', ...target.headers } : { 'content-type': 'application/json', 'x-goog-api-key': apiKey ?? '' }

  // 1. Semantic Embeddings (:embedContent)
  if (user.startsWith('<embed_texts>')) {
    const rawJson = user.replace(/^<embed_texts>/, '').replace(/<\/embed_texts>$/, '').trim()
    const texts = JSON.parse(rawJson) as string[]
    const embedUrl = baseUrl.replace(':generateContent', ':embedContent')
    const vectors: number[][] = []
    for (const itemText of texts) {
      let response: Response
      try {
        response = await fetchImpl(embedUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: { parts: [{ text: itemText || ' ' }] },
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
      const values = data.embedding?.values ?? data.embeddings?.[0]?.values
      if (!values || !values.length) throw new GeminiError('empty embedding', 502)
      vectors.push(values)
    }
    return JSON.stringify({ embeddings: vectors })
  }

  // 2. Multi-Speaker Studio TTS (gemini-3.8-flash-tts / gemini-3.8-flash-lite-tts)
  if (user.startsWith('<tts_dialogue>')) {
    const rawJson = user.replace(/^<tts_dialogue>/, '').replace(/<\/tts_dialogue>$/, '').trim()
    const turns = JSON.parse(rawJson) as Array<{ speaker: 'Deniz' | 'Mert'; text: string }>
    const useMultiSpeaker = !model.includes('lite-tts') && turns.length > 1
    const body = useMultiSpeaker
      ? {
          contents: [
            {
              role: 'user',
              parts: turns.map((t) => ({
                text: `${t.speaker}: ${t.text}`,
                speechMetadata: {
                  speaker: t.speaker,
                  style: t.speaker === 'Deniz' ? 'Warm, articulate university tutor' : 'Curious, engaged university student',
                },
              })),
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  { speaker: 'Deniz', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                  { speaker: 'Mert', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                ],
              },
            },
          },
        }
      : {
          contents: [
            {
              role: 'user',
              parts: [{ text: turns.map((t) => `${t.speaker}: ${t.text}`).join('\n') }],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
          },
        }

    let response: Response
    try {
      response = await fetchImpl(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const audioPart = parts.find((p) => p.inlineData?.data)
    if (!audioPart?.inlineData?.data) throw new GeminiError('empty audio response', 502)
    return JSON.stringify({
      audioBase64: audioPart.inlineData.data,
      mimeType: audioPart.inlineData.mimeType || 'audio/wav',
    })
  }

  // 3. Image Generation (gemini-3.1-flash-lite-image / gemini-nano-banana-2.1)
  if (user.startsWith('<image_prompt')) {
    const aspectMatch = user.match(/^<image_prompt\s+aspect="([^"]+)">/)
    const aspectRatio = aspectMatch?.[1] || '16:9'
    const promptText = user.replace(/^<image_prompt[^>]*>/, '').replace(/<\/image_prompt>$/, '').trim()
    let response: Response
    try {
      response = await fetchImpl(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            imageConfig: { aspectRatio },
          },
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
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const imgPart = parts.find((p) => p.inlineData?.data)
    const caption = parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text ?? '')
      .join(' ')
      .trim()
    if (!imgPart?.inlineData?.data) throw new GeminiError('empty image response', 502)
    return JSON.stringify({
      imageBase64: imgPart.inlineData.data,
      mimeType: imgPart.inlineData.mimeType || 'image/png',
      caption,
    })
  }

  // 4. Standard Structured JSON / Text Generation
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    maxOutputTokens: 32768,
  }
  // Keep thinking overhead minimal so large lecture notes finish in 4-8s instead of timing out at 60s.
  if (model.includes('3.1-flash-lite')) {
    generationConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' }
  } else if (model.includes('3.8-flash') || model.includes('4-argon') || model.includes('-pro')) {
    // Pro and the flagship think a lot by default; LOW keeps answers well inside the time limit.
    generationConfig.thinkingConfig = { thinkingLevel: 'LOW' }
  }

  let response: Response
  try {
    response = await fetchImpl(baseUrl, {
      method: 'POST',
      headers,
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
  apiKey?: string
  target?: GeminiTarget
  models: string[]
  system: string
  user: string
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<unknown>
  timeoutMs?: number
  deadlineMs?: number
}): Promise<{ text: string; model: string }> {
  const { models: inputModels, sleep = wait, timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS, deadlineMs = DEFAULT_DEADLINE_MS, ...call } = options
  let models = inputModels
  if (call.user.startsWith('<tts_dialogue>') && !models.some((m) => m.includes('tts'))) {
    models = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']
  } else if (call.user.startsWith('<image_prompt') && !models.some((m) => m.includes('image') || m.includes('banana'))) {
    models = ['gemini-3.1-flash-lite-image', 'gemini-nano-banana-2.1']
  } else if (call.user.startsWith('<embed_texts>') && !models.some((m) => m.includes('embedding'))) {
    models = ['gemini-embedding-2-preview', 'gemini-embedding-001']
  }

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
