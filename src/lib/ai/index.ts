import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { Settings } from '../settings'
import { supabase } from '../supabase'
import type { GeneratedSet } from '../types'
import { callGemini, GeminiError } from './gemini'
import { jsonModeSystem, parseTaskOutput, TASKS, userPrompt, type ExamInput, type GradeInput, type TaskInput, type TaskName, type TaskOutput } from './tasks'

export type { ExamDifficulty, ExamFormat, ExamInput, GradeInput } from './tasks'
export type RawStudySet = TaskOutput<'study'>
export type RawExam = TaskOutput<'exam'>

export class AiError extends Error {}

const FORMAT_ERROR = 'Yapay zekâdan beklenen biçimde cevap gelmedi. Tekrar dene.'

// ---------- Providers ----------

async function viaAnthropic<T extends TaskName>(task: T, input: TaskInput<T>, apiKey: string, model: string): Promise<TaskOutput<T>> {
  // The key belongs to the student and stays in their browser; requests go straight to Anthropic.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })
  // Haiku has no server-side refusal fallback; Opus and Sonnet route a declined request to another model.
  const fallback = model.includes('haiku') ? {} : { fallbacks: 'default' as const, betas: ['server-side-fallback-2026-07-01'] }
  const spec = TASKS[task]
  let response
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system: spec.system,
      output_config: { effort: 'medium', format: betaZodOutputFormat(spec.schema) },
      messages: [{ role: 'user', content: userPrompt(task, input) }],
      ...fallback,
    })
  } catch (error) {
    throw anthropicError(error)
  }
  if (response.stop_reason === 'refusal') throw new AiError('Model bu isteği işlemeyi reddetti.')
  if (response.stop_reason === 'max_tokens') throw new AiError('İçerik çok uzun olduğu için cevap yarıda kaldı. Daha kısa bir bölümle dene.')
  if (!response.parsed_output) throw new AiError(FORMAT_ERROR)
  return response.parsed_output as TaskOutput<T>
}

function anthropicError(error: unknown): AiError {
  if (error instanceof Anthropic.AuthenticationError) return new AiError('Claude API anahtarı geçersiz. Ayarlardan kontrol et.')
  if (error instanceof Anthropic.PermissionDeniedError) return new AiError('Bu API anahtarının seçilen modele erişimi yok.')
  if (error instanceof Anthropic.NotFoundError) return new AiError('Seçilen model bulunamadı. Ayarlardan başka bir model seç.')
  if (error instanceof Anthropic.RateLimitError) return new AiError('Çok fazla istek gönderildi ya da hesabının limiti doldu. Biraz sonra tekrar dene.')
  if (error instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(error.message)) return new AiError('Anthropic hesabında yeterli kredi yok.')
    return new AiError(`İstek reddedildi: ${error.message}`)
  }
  if (error instanceof Anthropic.APIConnectionError) return new AiError('Anthropic’e bağlanılamadı. İnternet bağlantını kontrol et.')
  if (error instanceof Anthropic.APIError) return new AiError(`Claude hata verdi (${error.status ?? 'bilinmiyor'}). Biraz sonra tekrar dene.`)
  return new AiError('Beklenmeyen bir hata oluştu. Tekrar dene.')
}

function statusError(provider: string, status: number): AiError {
  if (status === 401 || status === 403) return new AiError(`${provider} API anahtarı geçersiz ya da bu modele erişimi yok.`)
  if (status === 404) return new AiError(`${provider}: seçilen model bulunamadı. Ayarlardan model adını kontrol et.`)
  if (status === 429) return new AiError(`${provider} kotası doldu ya da çok fazla istek gönderildi. Biraz sonra tekrar dene.`)
  if (status === 413) return new AiError('İçerik çok uzun olduğu için cevap yarıda kaldı. Daha kısa bir bölümle dene.')
  return new AiError(`${provider} hata verdi (${status}). Biraz sonra tekrar dene.`)
}

/** JSON-mode providers can occasionally return the wrong shape, so they get one retry. */
async function withJsonRetry<T extends TaskName>(task: T, call: () => Promise<string>): Promise<TaskOutput<T>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = parseTaskOutput(task, await call())
    if (parsed) return parsed
  }
  throw new AiError(FORMAT_ERROR)
}

async function viaOpenAi<T extends TaskName>(task: T, input: TaskInput<T>, apiKey: string, model: string): Promise<TaskOutput<T>> {
  const user = userPrompt(task, input)
  return withJsonRetry(task, async () => {
    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: jsonModeSystem(task) },
            { role: 'user', content: user },
          ],
        }),
      })
    } catch {
      throw new AiError('OpenAI’ye bağlanılamadı. İnternet bağlantını kontrol et.')
    }
    if (!response.ok) throw statusError('ChatGPT', response.status)
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> }
    const choice = data.choices?.[0]
    if (choice?.finish_reason === 'length') throw statusError('ChatGPT', 413)
    return choice?.message?.content ?? ''
  })
}

async function viaGoogle<T extends TaskName>(task: T, input: TaskInput<T>, apiKey: string, model: string): Promise<TaskOutput<T>> {
  const user = userPrompt(task, input)
  return withJsonRetry(task, async () => {
    try {
      return await callGemini({ apiKey, model, system: jsonModeSystem(task), user })
    } catch (error) {
      if (error instanceof GeminiError) throw statusError('Gemini', error.status)
      throw new AiError('Google’a bağlanılamadı. İnternet bağlantını kontrol et.')
    }
  })
}

async function viaShared<T extends TaskName>(task: T, input: TaskInput<T>): Promise<TaskOutput<T>> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) throw new AiError('Ücretsiz yapay zekâ için giriş yapman gerekiyor.')
  let response: Response
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ task, input }),
    })
  } catch {
    throw new AiError('Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.')
  }
  const body = (await response.json().catch(() => ({}))) as { result?: unknown; error?: string }
  if (!response.ok) {
    const messages: Record<string, string> = {
      not_configured: 'Ücretsiz yapay zekâ henüz kurulmadı. Ayarlardan kendi anahtarını bağlayabilir ya da basit modu kullanabilirsin.',
      unauthorized: 'Oturumun sona ermiş. Çıkış yapıp tekrar giriş yap.',
      quota: 'Ücretsiz yapay zekânın kotası şu an dolu. Biraz sonra tekrar dene ya da ayarlardan kendi anahtarını bağla.',
      too_large: 'İçerik çok uzun. Daha az not seçerek ya da notu bölerek dene.',
      bad_output: FORMAT_ERROR,
    }
    throw new AiError(messages[body.error ?? ''] ?? `Sunucu hata verdi (${response.status}). Biraz sonra tekrar dene.`)
  }
  const parsed = TASKS[task].schema.safeParse(body.result)
  if (!parsed.success) throw new AiError(FORMAT_ERROR)
  return parsed.data as TaskOutput<T>
}

export async function runTask<T extends TaskName>(task: T, input: TaskInput<T>, settings: Settings): Promise<TaskOutput<T>> {
  switch (settings.provider) {
    case 'anthropic':
      return viaAnthropic(task, input, settings.keys.anthropic, settings.models.anthropic)
    case 'openai':
      return viaOpenAi(task, input, settings.keys.openai, settings.models.openai)
    case 'google':
      return viaGoogle(task, input, settings.keys.google, settings.models.google)
    default:
      return viaShared(task, input)
  }
}

// ---------- Public helpers ----------

export async function generateStudySet(text: string, title: string, settings: Settings): Promise<GeneratedSet> {
  return normalizeStudySet(await runTask('study', { text, title }, settings))
}

export async function generateExam(input: ExamInput, settings: Settings): Promise<RawExam> {
  return runTask('exam', input, settings)
}

export async function gradeAnswers(input: GradeInput, settings: Settings) {
  const { results } = await runTask('grade', input, settings)
  if (results.length !== input.items.length) throw new AiError(FORMAT_ERROR)
  return results.map((r) => ({ score: Math.min(1, Math.max(0, r.score)), feedback: r.feedback.trim() }))
}

/** Checks a student's own key with the cheapest call each provider offers. */
export async function testApiKey(provider: Exclude<Settings['provider'], 'shared'>, apiKey: string, model: string): Promise<void> {
  if (provider === 'anthropic') {
    try {
      await new Anthropic({ apiKey, dangerouslyAllowBrowser: true }).models.retrieve(model)
    } catch (error) {
      throw anthropicError(error)
    }
    return
  }
  const [url, headers] =
    provider === 'openai'
      ? [`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { authorization: `Bearer ${apiKey}` }]
      : [`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, { 'x-goog-api-key': apiKey }]
  let response: Response
  try {
    response = await fetch(url, { headers })
  } catch {
    throw new AiError('Servise bağlanılamadı. İnternet bağlantını kontrol et.')
  }
  if (!response.ok) throw statusError(provider === 'openai' ? 'ChatGPT' : 'Gemini', response.status)
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim()
const sourceOrNull = (value: string) => clean(value) || null

/** Drops malformed items so one bad question cannot break the quiz screen. */
export function normalizeStudySet(raw: RawStudySet): GeneratedSet {
  const questions = raw.questions
    .map((q) => ({ ...q, prompt: clean(q.prompt), options: q.options.map(clean) }))
    .filter(
      (q) =>
        q.prompt &&
        q.options.length >= 2 &&
        q.options.length <= 6 &&
        q.options.every(Boolean) &&
        new Set(q.options).size === q.options.length &&
        q.answerIndex >= 0 &&
        q.answerIndex < q.options.length,
    )
    .map((q) => ({
      id: crypto.randomUUID(),
      prompt: q.prompt,
      options: q.options,
      answerIndex: q.answerIndex,
      explanation: clean(q.explanation),
      source: sourceOrNull(q.source),
    }))

  const result: GeneratedSet = {
    summary: {
      overview: clean(raw.summary.overview),
      points: raw.summary.points.map(clean).filter(Boolean),
      keyTerms: raw.summary.keyTerms
        .map((k) => ({ term: clean(k.term), definition: clean(k.definition) }))
        .filter((k) => k.term && k.definition),
    },
    cards: raw.cards
      .map((c) => ({ front: c.front.trim(), back: c.back.trim(), source: sourceOrNull(c.source) }))
      .filter((c) => c.front && c.back),
    questions,
    practice: raw.practice
      .filter((p) => clean(p.question))
      .map((p) => ({
        id: crypto.randomUUID(),
        question: clean(p.question),
        answer: p.answer.trim() || null,
        hint: clean(p.hint) || null,
      })),
  }

  if (!result.summary.points.length && !result.cards.length && !result.questions.length) {
    throw new AiError('Bu nottan çalışma seti çıkarılamadı. Notun yeterince açıklayıcı metin içerdiğinden emin ol.')
  }
  return result
}
