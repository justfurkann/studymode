import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { DEFAULT_GEMINI_FALLBACKS, DEFAULT_GEMINI_MODEL } from '../config'
import type { KeyProvider, Settings } from '../settings'
import { supabase } from '../supabase'
import type { ConceptComparison, DetailedSummary, GeneratedSet, MnemonicItem } from '../types'
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
  type ImageGenInput,
  type MemoryInput,
  type PodcastInput,
  type TaskInput,
  type TaskName,
  type TaskOutput,
  type TtsInput,
  type TranscribeImage,
  type TranscribeInput,
  type EmbedInput,
} from './tasks'
import { setQuota } from '../account'
import { concatenateWavBase64, splitScriptForTts, type PodcastLine, type PodcastScript } from '../podcastTools'
import { compactVector } from '../semanticSearch'

export { contextAround, MAX_PROMPT_NOTE_CHARS, splitNoteIntoChunks } from './tasks'
export type {
  DetailInput,
  EmbedInput,
  ExamDifficulty,
  ExamFormat,
  ExamInput,
  ExplainInput,
  ExplainMode,
  GradeInput,
  ImageGenInput,
  ImageMimeType,
  MemoryInput,
  PodcastInput,
  TtsInput,
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

async function viaShared<T extends TaskName>(task: T, input: TaskInput<T>, engine?: 'plus'): Promise<TaskOutput<T>> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) throw new AiError('Ücretsiz yapay zekâ için giriş yapman gerekiyor.')
  let response: Response
  const started = Date.now()
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(engine ? { task, input, engine } : { task, input }),
      // Longer than the function's 60 s limit: the server always answers (or fails) first, so the
      // student gets a real answer or a clear message, never "Fetch is aborted".
      signal: AbortSignal.timeout(65_000),
    })
  } catch (error) {
    // The detail and timing help tell a dropped connection from a server timeout.
    const seconds = Math.round((Date.now() - started) / 1000)
    const detail = error instanceof Error ? error.message : String(error)
    throw new AiError(
      `Sunucuya bağlanılamadı (${seconds} sn sonra: ${detail}). İşlem sürerken sayfadan ayrılma veya ekranı kapatma; bağlantını kontrol edip tekrar dene.`,
    )
  }
  const body = (await response.json().catch(() => ({}))) as { result?: unknown; error?: string; quota?: unknown }
  if (body.quota) setQuota(body.quota)
  if (!response.ok) {
    if (body.error === 'daily_limit') {
      const q = body.quota as { used?: number; limit?: number } | undefined
      throw new AiError(
        `Bugünkü ücretsiz yapay zekâ hakkın doldu${q?.limit ? ` (${q.used}/${q.limit})` : ''}. Gece yarısı yenilenir. Acelen varsa Ayarlar'dan kendi anahtarını bağlayabilirsin.`,
      )
    }
    const messages: Record<string, string> = {
      not_configured: 'Ücretsiz yapay zekâ henüz kurulmadı. Ayarlardan kendi anahtarını bağlayabilir ya da basit modu kullanabilirsin.',
      unauthorized: 'Oturumun sona ermiş. Çıkış yapıp tekrar giriş yap.',
      quota: 'Ücretsiz yapay zekânın kotası şu an dolu. Biraz sonra tekrar dene ya da ayarlardan kendi anahtarını bağla.',
      busy: 'Google’ın ücretsiz modelleri şu an çok yoğun. Birkaç dakika sonra tekrar dene ya da ayarlardan kendi anahtarını bağla.',
      too_slow: 'Yapay zekâ bu notu zamanında bitiremedi. Bir kez daha dene; yine olursa notu ikiye bölüp ayrı ayrı yükle.',
      too_large: 'İçerik çok uzun. Daha az not seçerek ya da notu bölerek dene.',
      premium_only: 'Bu özellik Premium (VIP) üyelere özel.',
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
  // Gemini-native media/vector tasks (TTS, Image generation, Embeddings) run via Google key or Shared/Vertex Free+ server
  // Premium (VIP/admin) features: podcast script and audio, images, semantic search. They always go
  // through Free+ on our server (or the student's own Gemini key); the server refuses non-VIPs.
  if (task === 'tts' || task === 'image' || task === 'embed' || task === 'podcast') {
    if (settings.provider === 'google' && settings.keys.google) {
      return viaGoogle(task, input, settings.keys.google, settings.models.google)
    }
    return viaShared(task, input, 'plus')
  }
  switch (settings.provider) {
    case 'anthropic':
      return viaAnthropic(task, input, settings.keys.anthropic, settings.models.anthropic)
    case 'openai':
      return viaOpenAi(task, input, settings.keys.openai, settings.models.openai)
    case 'google':
      return viaGoogle(task, input, settings.keys.google, settings.models.google)
    case 'plus':
      return viaShared(task, input, 'plus')
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
    let raw: RawStudySet | null = null
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 2 && !raw; attempt += 1) {
      try {
        raw = await runTask('study', { text, title }, settings)
      } catch (error) {
        lastErr = error
        if (attempt === 0) await sleep(CHUNK_RETRY_DELAY_MS)
      }
    }
    if (!raw) throw lastErr instanceof Error ? lastErr : new AiError('Çalışma seti oluşturulamadı.')
    const result = normalizeStudySet(raw)
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

/** Characters per request for the detailed summary: its answer is long, so parts are smaller than for a study set. */
export const DETAIL_CHUNK_CHARS = 12_000

/**
 * The detailed "Tam özet" of a note. A long note is written part by part (each part its own request,
 * retried once); the sections are joined in order. Parts that still fail are counted, not fatal.
 */
export async function generateDetailedSummary(
  text: string,
  title: string,
  settings: Settings,
  onProgress?: (done: number, total: number) => void,
): Promise<DetailedSummary> {
  const chunks = splitNoteIntoChunks(text, DETAIL_CHUNK_CHARS)
  const parts: Array<TaskOutput<'detail'>> = []
  let failedParts = 0
  let lastError: unknown = null
  for (let i = 0; i < chunks.length; i += 1) {
    onProgress?.(i, chunks.length)
    const input = { title, text: chunks[i], part: chunks.length > 1 ? `Bölüm ${i + 1}/${chunks.length}` : undefined }
    try {
      parts.push(await runTask('detail', input, settings).catch(() => runTask('detail', input, settings)))
    } catch (error) {
      failedParts += 1
      lastError = error
    }
  }
  onProgress?.(chunks.length, chunks.length)
  if (!parts.length) throw lastError instanceof Error ? lastError : new AiError('Ayrıntılı özet hazırlanamadı.')
  const clean = (list: string[]) => list.map((x) => x.trim()).filter(Boolean)
  const takeaways = [...new Set(parts.flatMap((p) => clean(p.takeaways)))].slice(0, 8)
  return {
    intro: parts[0].intro.trim(),
    sections: parts
      .flatMap((p) => p.sections)
      .map((s) => ({ heading: s.heading.trim(), paragraphs: clean(s.paragraphs), bullets: clean(s.bullets), example: s.example.trim() }))
      .filter((s) => s.heading && (s.paragraphs.length || s.bullets.length)),
    takeaways,
    createdAt: new Date().toISOString(),
    ...(failedParts ? { failedParts } : {}),
  }
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

/** Max questions requested in a single LLM call so 20–30+ question exams never hit serverless timeouts. */
export const EXAM_BATCH_SIZE = 10

function sliceNoteForExamBatch(text: string, batchIndex: number, batchCount: number): string {
  if (batchCount <= 1 || text.length <= 4_500) return text
  const segment = Math.ceil(text.length / batchCount)
  const overlap = Math.min(800, Math.floor(segment * 0.15))
  const start = Math.max(0, batchIndex * segment - (batchIndex > 0 ? overlap : 0))
  const end = Math.min(text.length, (batchIndex + 1) * segment + (batchIndex < batchCount - 1 ? overlap : 0))
  return text.slice(start, end).trim()
}

/**
 * Splits a large exam request (> 10 questions) into smaller balanced batches so each batch finishes
 * in ~6-10 seconds and covers a distinct portion of the lecture notes without timing out.
 */
export function splitExamIntoBatches(input: ExamInput, maxPerBatch = EXAM_BATCH_SIZE): ExamInput[] {
  const hasExplicitSplit = input.mcqCount != null && input.openCount != null
  const mcqTotal = hasExplicitSplit ? input.mcqCount! : 0
  const openTotal = hasExplicitSplit ? input.openCount! : 0
  const blankTotal = hasExplicitSplit ? (input.blankCount ?? 0) : 0
  const totalQuestions = hasExplicitSplit ? mcqTotal + openTotal + blankTotal : input.count

  if (totalQuestions <= maxPerBatch) return [input]

  const batchCount = Math.ceil(totalQuestions / maxPerBatch)
  const shareOf = (total: number, index: number) => Math.floor(total / batchCount) + (index < total % batchCount ? 1 : 0)

  const batches: ExamInput[] = []
  for (let i = 0; i < batchCount; i += 1) {
    const mcq = hasExplicitSplit ? shareOf(mcqTotal, i) : undefined
    const open = hasExplicitSplit ? shareOf(openTotal, i) : undefined
    const blank = hasExplicitSplit ? shareOf(blankTotal, i) : undefined
    const count = hasExplicitSplit ? (mcq ?? 0) + (open ?? 0) + (blank ?? 0) : shareOf(input.count, i)
    if (count <= 0) continue

    const distractors =
      hasExplicitSplit && (blank ?? 0) > 0 && (input.distractorCount ?? 0) > 0
        ? Math.max(1, shareOf(input.distractorCount!, i))
        : 0

    const focusPart =
      batchCount > 1
        ? `[Sınav Bölümü ${i + 1}/${batchCount}: Notların özellikle ${i === 0 ? 'başlangıç ve ilk' : i === batchCount - 1 ? 'son ve kapanış' : `${i + 1}.`} kısmındaki konu ve kavramlardan özgün sorular hazırla.]`
        : ''
    const combinedInfo = [input.examInfo?.trim(), focusPart].filter(Boolean).join('\n')

    const notesForBatch =
      input.notes.length >= batchCount * 2
        ? input.notes.filter((_, idx) => idx % batchCount === i)
        : input.notes.map((n) => ({
            title: n.title,
            text: sliceNoteForExamBatch(n.text, i, batchCount),
          }))

    batches.push({
      ...input,
      notes: notesForBatch,
      count,
      ...(hasExplicitSplit
        ? {
            mcqCount: mcq,
            openCount: open,
            blankCount: blank,
            distractorCount: distractors,
          }
        : {}),
      examInfo: combinedInfo,
    })
  }
  return batches.length ? batches : [input]
}

export async function generateExam(
  input: ExamInput,
  settings: Settings,
  onProgress?: (done: number, total: number) => void,
): Promise<RawExam> {
  const batches = splitExamIntoBatches(input)
  if (batches.length === 1) {
    onProgress?.(0, 1)
    const out = await runTask('exam', batches[0], settings).catch(() => runTask('exam', batches[0], settings))
    onProgress?.(1, 1)
    return out
  }

  let completed = 0
  onProgress?.(0, batches.length)

  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      const result = await runTask('exam', batch, settings).catch(() => runTask('exam', batch, settings))
      completed += 1
      onProgress?.(completed, batches.length)
      return result
    }),
  )

  const fulfilled = settled.filter((s): s is PromiseFulfilledResult<RawExam> => s.status === 'fulfilled').map((s) => s.value)
  if (!fulfilled.length) {
    const firstRejected = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected')
    throw firstRejected?.reason instanceof Error ? firstRejected.reason : new AiError('Sınav hazırlanamadı.')
  }

  const seenPrompts = new Set<string>()
  const questions: RawExam['questions'] = []
  for (const part of fulfilled) {
    for (const q of part.questions) {
      const key = `${q.type}:${q.prompt.trim().toLocaleLowerCase('tr-TR')}`
      if (!seenPrompts.has(key)) {
        seenPrompts.add(key)
        questions.push(q)
      }
    }
  }

  const seenDistractors = new Set<string>()
  const distractors: string[] = []
  for (const part of fulfilled) {
    for (const d of part.distractors ?? []) {
      const key = d.trim().toLocaleLowerCase('tr-TR')
      if (key && !seenDistractors.has(key)) {
        seenDistractors.add(key)
        distractors.push(d.trim())
      }
    }
  }

  return { questions, distractors }
}

const GRADE_BATCH_SIZE = 4

export async function gradeAnswers(input: GradeInput, settings: Settings) {
  if (!input.items.length) return []
  if (input.items.length <= GRADE_BATCH_SIZE) {
    const { results } = await runTask('grade', input, settings).catch(() => runTask('grade', input, settings))
    if (results.length !== input.items.length) throw new AiError(FORMAT_ERROR)
    return results.map((r) => ({ score: Math.min(1, Math.max(0, r.score)), feedback: r.feedback.trim() }))
  }

  const chunks: GradeInput['items'][] = []
  for (let i = 0; i < input.items.length; i += GRADE_BATCH_SIZE) {
    chunks.push(input.items.slice(i, i + GRADE_BATCH_SIZE))
  }
  const chunkResults = await Promise.all(
    chunks.map(async (items) => {
      const { results } = await runTask('grade', { items }, settings).catch(() => runTask('grade', { items }, settings))
      if (results.length !== items.length) throw new AiError(FORMAT_ERROR)
      return results.map((r) => ({ score: Math.min(1, Math.max(0, r.score)), feedback: r.feedback.trim() }))
    }),
  )
  return chunkResults.flat()
}

export async function transcribeImages(images: TranscribeImage[], settings: Settings): Promise<string> {
  if (!images.length) return ''
  const { text } = await runTask('transcribe', { images }, settings).catch(() => runTask('transcribe', { images }, settings))
  return text.trim()
}

export async function explainConcept(input: ExplainInput, settings: Settings): Promise<string> {
  const { explanation } = await runTask('explain', input, settings).catch(() => runTask('explain', input, settings))
  return explanation.trim()
}

export async function generateMemoryTools(
  input: MemoryInput,
  settings: Settings,
): Promise<{ mnemonics: MnemonicItem[]; comparisons: ConceptComparison[] }> {
  const raw = await runTask('memory', input, settings).catch(() => runTask('memory', input, settings))
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

export async function generatePodcastScript(input: PodcastInput, settings: Settings): Promise<PodcastScript> {
  const raw = await runTask('podcast', input, settings).catch(() => runTask('podcast', input, settings))
  const lines: PodcastLine[] = raw.lines
    .filter((l) => l.text.trim())
    .map((l, idx) => ({
      id: `ai-line-${idx + 1}`,
      speaker: l.speaker === 'Mert' ? 'Mert' : 'Deniz',
      role: l.speaker === 'Mert' ? 'student' : 'host',
      text: l.text.trim(),
      highlight: l.highlight.trim(),
    }))
  if (!lines.length) throw new AiError(FORMAT_ERROR)
  const totalWords = lines.reduce((sum, l) => sum + l.text.split(/\s+/).length, 0)
  return {
    title: raw.title.trim() || `${input.title} · Sesli Özeti`,
    summary: raw.summary.trim(),
    lines,
    durationEstimateSec: Math.max(30, Math.round((totalWords / 135) * 60)),
    source: 'ai',
  }
}

/**
 * Generates studio-quality multi-speaker WAV audio via `gemini-3.8-flash-tts` / `gemini-3.8-flash-lite-tts`.
 * Splits longer scripts into chunks to stay well under Vercel's 4.5 MB payload limit and concatenates the WAVs.
 */
export async function synthesizePodcastTts(
  lines: PodcastLine[],
  settings: Settings,
  onProgress?: (done: number, total: number) => void,
  /** Each part as soon as it is ready (a playable WAV), so playback can start before the rest arrive. */
  onPart?: (audioDataUrl: string, index: number, total: number) => void,
): Promise<{ audioDataUrl: string; mimeType: string }> {
  // ~600 characters ≈ 40 s of speech ≈ 2 MB of WAV, safely under the 4.5 MB response limit.
  const chunks = splitScriptForTts(lines, 600)
  if (!chunks.length) throw new AiError('Seslendirilecek metin bulunamadı.')
  const wavChunks: string[] = []
  let mimeType = 'audio/wav'
  onProgress?.(0, chunks.length)
  for (let i = 0; i < chunks.length; i += 1) {
    const res = await runTask(
      'tts',
      { lines: chunks[i].map((l) => ({ speaker: l.speaker, text: l.text })) },
      settings,
    )
    if (res.audioBase64) {
      wavChunks.push(res.audioBase64)
      if (res.mimeType) mimeType = res.mimeType
      onPart?.(`data:${mimeType};base64,${res.audioBase64}`, i, chunks.length)
    }
    onProgress?.(i + 1, chunks.length)
  }
  if (!wavChunks.length) throw new AiError('Ses dosyası üretilemedi.')
  const combinedBase64 = concatenateWavBase64(wavChunks)
  return {
    audioDataUrl: `data:${mimeType};base64,${combinedBase64}`,
    mimeType,
  }
}

/** Generates an educational diagram or concept illustration via `gemini-3.1-flash-lite-image` / `gemini-nano-banana-2.1`. */
export async function generateConceptImage(
  input: ImageGenInput,
  settings: Settings,
): Promise<{ imageUrl: string; caption: string }> {
  const res = await runTask('image', input, settings)
  if (!res.imageBase64) throw new AiError('Görsel üretilemedi.')
  return {
    imageUrl: `data:${res.mimeType || 'image/png'};base64,${res.imageBase64}`,
    caption: res.caption.trim() || `${input.topic} görsel şeması`,
  }
}

/** Embedding vectors (gemini-embedding-001), shortened to 768 numbers for storage. */
export async function embedTexts(texts: string[], settings: Settings): Promise<number[][]> {
  if (!texts.length) return []
  const out: number[][] = []
  // The server takes 25 texts a request.
  for (let i = 0; i < texts.length; i += 25) {
    const res = await runTask('embed', { texts: texts.slice(i, i + 25) }, settings)
    out.push(...res.embeddings.map(compactVector))
  }
  return out
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
export async function testApiKey(provider: KeyProvider, apiKey: string, model: string): Promise<void> {
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
