import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { DEFAULT_GEMINI_FALLBACKS, DEFAULT_GEMINI_MODEL } from '../config'
import type { Settings } from '../settings'
import { supabase } from '../supabase'
import type { ConceptComparison, GeneratedSet, MnemonicItem } from '../types'
import { callGeminiWithFallback, GeminiError } from './gemini'
import {
  jsonModeSystem,
  MAX_PROMPT_NOTE_CHARS,
  parseTaskOutput,
  splitNoteIntoChunks,
  TASKS,
  TRANSCRIBE_USER_TEXT,
  userPrompt,
  type ExplainInput,
  type ExplainMode,
  type ExamInput,
  type GradeInput,
  type MemoryInput,
  type TaskInput,
  type TaskName,
  type TaskOutput,
  type TranscribeImage,
  type TranscribeInput,
} from './tasks'

export { contextAround, MAX_PROMPT_NOTE_CHARS, splitNoteIntoChunks } from './tasks'
export type {
  ExamDifficulty,
  ExamFormat,
  ExamInput,
  ExplainInput,
  ExplainMode,
  GradeInput,
  ImageMimeType,
  MemoryInput,
  TranscribeImage,
  TranscribeInput,
} from './tasks'
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
  const content =
    task === 'transcribe'
      ? [
          ...(input as TranscribeInput).images.map((img) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mimeType, data: img.data },
          })),
          { type: 'text' as const, text: TRANSCRIBE_USER_TEXT },
        ]
      : userPrompt(task, input)
  let response
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system: spec.system,
      output_config: { effort: 'medium', format: betaZodOutputFormat(spec.schema) },
      messages: [{ role: 'user', content }],
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
  if (status === 503 || status === 504) return new AiError(`${provider} modelleri şu an yoğun. Birkaç saniye sonra tekrar dene.`)
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
  const userContent =
    task === 'transcribe'
      ? [
          { type: 'text', text: TRANSCRIBE_USER_TEXT },
          ...(input as TranscribeInput).images.map((img) => ({
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          })),
        ]
      : userPrompt(task, input)
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
            { role: 'user', content: userContent },
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
  const models = [...new Set([model, DEFAULT_GEMINI_MODEL, ...DEFAULT_GEMINI_FALLBACKS].filter(Boolean))]
  return withJsonRetry(task, async () => {
    try {
      return (await callGeminiWithFallback({ apiKey, models, system: jsonModeSystem(task), user })).text
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
  const started = Date.now()
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ task, input }),
      signal: AbortSignal.timeout(55_000),
    })
  } catch (error) {
    // The detail and timing help tell a dropped connection from a server timeout.
    const seconds = Math.round((Date.now() - started) / 1000)
    const detail = error instanceof Error ? error.message : String(error)
    throw new AiError(
      `Sunucuya bağlanılamadı (${seconds} sn sonra: ${detail}). İşlem sürerken sayfadan ayrılma veya ekranı kapatma; bağlantını kontrol edip tekrar dene.`,
    )
  }
  const body = (await response.json().catch(() => ({}))) as { result?: unknown; error?: string }
  if (!response.ok) {
    const messages: Record<string, string> = {
      not_configured: 'Ücretsiz yapay zekâ henüz kurulmadı. Ayarlardan kendi anahtarını bağlayabilir ya da basit modu kullanabilirsin.',
      unauthorized: 'Oturumun sona ermiş. Çıkış yapıp tekrar giriş yap.',
      quota: 'Ücretsiz yapay zekânın kotası şu an dolu. Biraz sonra tekrar dene ya da ayarlardan kendi anahtarını bağla.',
      busy: 'Google’ın ücretsiz modelleri şu an çok yoğun. Birkaç dakika sonra tekrar dene ya da ayarlardan kendi anahtarını bağla.',
      too_large: 'İçerik çok uzun. Daha az not seçerek ya da notu bölerek dene.',
      bad_output: FORMAT_ERROR,
    }
    const extra = body as { status?: number; detail?: string }
    const upstream = body.error === 'upstream' ? ` Gemini kodu: ${extra.status}${extra.detail ? ` (${extra.detail})` : ''}.` : ''
    throw new AiError(messages[body.error ?? ''] ?? `Sunucu hata verdi (${response.status}${body.error ? `, ${body.error}` : ''}).${upstream} Biraz sonra tekrar dene.`)
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

/** A study set built from a long note where some chunks could not be processed. */
export type ChunkedStudySet = GeneratedSet & { failedChunks: number; totalChunks: number }

const CHUNK_RETRY_DELAY_MS = 1500

/**
 * Long notes are split into chunks, each sent as its own request so none hits the server's time or
 * size limits. A chunk that fails is retried once; if it still fails the others are kept, and the
 * caller learns how many were skipped instead of losing minutes of finished work to one error.
 */
export async function generateStudySet(
  text: string,
  title: string,
  settings: Settings,
  onProgress?: (done: number, total: number) => void,
  sleep: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<ChunkedStudySet> {
  const chunks = splitNoteIntoChunks(text)
  if (chunks.length <= 1) {
    onProgress?.(0, 1)
    const result = normalizeStudySet(await runTask('study', { text, title }, settings))
    onProgress?.(1, 1)
    return { ...result, failedChunks: 0, totalChunks: 1 }
  }

  const sets: GeneratedSet[] = []
  let failedChunks = 0
  let lastError: unknown = null
  for (let i = 0; i < chunks.length; i += 1) {
    onProgress?.(i, chunks.length)
    const input = { text: chunks[i], title: `${title} (Bölüm ${i + 1}/${chunks.length})` }
    let raw: RawStudySet | null = null
    for (let attempt = 0; attempt < 2 && !raw; attempt += 1) {
      try {
        raw = await runTask('study', input, settings)
      } catch (error) {
        lastError = error
        if (attempt === 0) await sleep(CHUNK_RETRY_DELAY_MS)
      }
    }
    if (!raw) {
      failedChunks += 1
      continue
    }
    try {
      sets.push(normalizeStudySet(raw))
    } catch {
      // A chunk with only headings or figures yields nothing useful; the rest still count.
    }
  }
  onProgress?.(chunks.length, chunks.length)
  if (!sets.length) {
    if (lastError instanceof Error) throw lastError
    throw new AiError('Bu nottan çalışma seti çıkarılamadı. Notun yeterince açıklayıcı metin içerdiğinden emin ol.')
  }
  return { ...mergeStudySets(sets), failedChunks, totalChunks: chunks.length }
}

/** Short Turkish note for a partly processed long note, or '' when every chunk worked. */
export function partialChunkMessage(set: { failedChunks: number; totalChunks: number }): string {
  if (!set.failedChunks) return ''
  return `Uzun notun ${set.totalChunks} bölümünden ${set.failedChunks} tanesi işlenemedi; çalışma seti kalan bölümlerden hazırlandı. Eksik kısımlar için daha sonra “Yeniden hazırla”yı deneyebilirsin.`
}

export function mergeStudySets(sets: GeneratedSet[]): GeneratedSet {
  if (sets.length === 1) return sets[0]

  const overviews = sets.map((s) => s.summary.overview.trim()).filter(Boolean)
  const overview = overviews.join(' ')

  const seenPoints = new Set<string>()
  const points: string[] = []
  for (const s of sets) {
    for (const p of s.summary.points) {
      const key = p.toLocaleLowerCase('tr-TR')
      if (!seenPoints.has(key)) {
        seenPoints.add(key)
        points.push(p)
      }
    }
  }

  const seenTerms = new Set<string>()
  const keyTerms: GeneratedSet['summary']['keyTerms'] = []
  for (const s of sets) {
    for (const t of s.summary.keyTerms) {
      const key = t.term.toLocaleLowerCase('tr-TR')
      if (!seenTerms.has(key)) {
        seenTerms.add(key)
        keyTerms.push(t)
      }
    }
  }

  const seenCards = new Set<string>()
  const cards: GeneratedSet['cards'] = []
  for (const s of sets) {
    for (const c of s.cards) {
      const key = c.front.toLocaleLowerCase('tr-TR')
      if (!seenCards.has(key)) {
        seenCards.add(key)
        cards.push(c)
      }
    }
  }

  const seenQuestions = new Set<string>()
  const questions: GeneratedSet['questions'] = []
  for (const s of sets) {
    for (const q of s.questions) {
      const key = q.prompt.toLocaleLowerCase('tr-TR')
      if (!seenQuestions.has(key)) {
        seenQuestions.add(key)
        questions.push(q)
      }
    }
  }

  const seenPractice = new Set<string>()
  const practice: GeneratedSet['practice'] = []
  for (const s of sets) {
    for (const p of s.practice) {
      const key = p.question.toLocaleLowerCase('tr-TR')
      if (!seenPractice.has(key)) {
        seenPractice.add(key)
        practice.push(p)
      }
    }
  }

  return {
    summary: { overview, points, keyTerms },
    cards,
    questions,
    practice,
  }
}

export async function generateExam(input: ExamInput, settings: Settings): Promise<RawExam> {
  return runTask('exam', input, settings)
}

export async function gradeAnswers(input: GradeInput, settings: Settings) {
  const { results } = await runTask('grade', input, settings)
  if (results.length !== input.items.length) throw new AiError(FORMAT_ERROR)
  return results.map((r) => ({ score: Math.min(1, Math.max(0, r.score)), feedback: r.feedback.trim() }))
}

export async function transcribeImages(images: TranscribeImage[], settings: Settings): Promise<string> {
  if (!images.length) return ''
  const { text } = await runTask('transcribe', { images }, settings)
  return text.trim()
}

export async function explainConcept(input: ExplainInput, settings: Settings): Promise<string> {
  const { explanation } = await runTask('explain', input, settings)
  return explanation.trim()
}

export async function generateMemoryTools(
  input: MemoryInput,
  settings: Settings,
): Promise<{ mnemonics: MnemonicItem[]; comparisons: ConceptComparison[] }> {
  const raw = await runTask('memory', input, settings)
  const mnemonics: MnemonicItem[] = raw.mnemonics
    .filter((m) => m.title.trim() && m.code.trim())
    .map((m) => ({
      id: crypto.randomUUID(),
      kind: m.kind,
      title: m.title.trim(),
      code: m.code.trim(),
      breakdown: m.breakdown
        .filter((b) => b.key.trim() && b.meaning.trim())
        .map((b) => ({ key: b.key.trim(), meaning: b.meaning.trim() })),
      tip: m.tip.trim(),
    }))
  const comparisons: ConceptComparison[] = raw.comparisons
    .filter((c) => c.leftTerm.trim() && c.rightTerm.trim() && c.difference.trim())
    .map((c) => ({
      id: crypto.randomUUID(),
      leftTerm: c.leftTerm.trim(),
      leftPoint: c.leftPoint.trim(),
      rightTerm: c.rightTerm.trim(),
      rightPoint: c.rightPoint.trim(),
      difference: c.difference.trim(),
      examTrap: c.examTrap.trim(),
    }))
  return { mnemonics, comparisons }
}

/** Local fallback explanation when AI is not configured or unavailable. */
export function localExplainConcept(input: ExplainInput): string {
  const cleanTopic = input.topic.replace(/\s+/g, ' ').trim()
  const sentences = input.context
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)

  const topicWords = cleanTopic
    .toLocaleLowerCase('tr-TR')
    .split(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]+/)
    .filter((w) => w.length >= 4)

  const related = sentences
    .filter((s) => {
      const lower = s.toLocaleLowerCase('tr-TR')
      return topicWords.some((w) => lower.includes(w))
    })
    .slice(0, 3)

  const supporting = related.length ? related.join(' ') : sentences.slice(0, 2).join(' ')

  if (input.mode === 'simple') {
    return `Kısaca ifade etmek gerekirse: ${cleanTopic}\n\nNotundaki karşılığı: ${supporting || cleanTopic}`
  }
  if (input.mode === 'example') {
    return `Bu kavramı somutlaştırmak için notundaki şu bağlama dikkat et: ${supporting || cleanTopic}\n\nSınavda karşına çıktığında bu maddenin temel amacını ve hangi sorunu çözdüğünü düşünerek örnekleyebilirsin.`
  }
  const steps = (related.length ? related : [cleanTopic, ...sentences.slice(0, 2)]).slice(0, 3)
  return steps.map((s, idx) => `${idx + 1}. Adım: ${s}`).join('\n')
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
