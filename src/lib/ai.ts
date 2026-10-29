import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { AiModel } from './settings'
import type { GeneratedSet } from './types'

const StudySetSchema = z.object({
  summary: z.object({
    overview: z.string(),
    points: z.array(z.string()),
    keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })),
  }),
  cards: z.array(z.object({ front: z.string(), back: z.string(), source: z.string() })),
  questions: z.array(
    z.object({
      prompt: z.string(),
      options: z.array(z.string()),
      answerIndex: z.number().int(),
      explanation: z.string(),
      source: z.string(),
    }),
  ),
  practice: z.array(z.object({ question: z.string(), answer: z.string(), hint: z.string() })),
})

export type RawStudySet = z.infer<typeof StudySetSchema>

const SYSTEM_PROMPT = `You turn a university student's lecture notes into a study set.

Write everything in the language of the notes (usually Turkish). Use only information that is in the notes: do not add facts, numbers, or examples from outside them. If the notes are thin, produce fewer items rather than padding.

Produce:
- summary.overview: 2-4 sentences on what the notes cover and how the parts connect.
- summary.points: 5-10 key points, each one self-contained sentence a student could revise from.
- summary.keyTerms: the important terms with a one-sentence definition taken from the notes.
- cards: 8-20 flashcards for active recall. The front is a specific question (not just a term name when a question works better); the back is a short, complete answer. Cover different parts of the notes, not only definitions.
- questions: 6-12 multiple-choice questions with exactly 4 options and one correct answer (answerIndex is 0-based). Prefer questions that test understanding and application over word recall. Distractors must be plausible and clearly wrong according to the notes. Vary the position of the correct answer. The explanation says why the answer is right and, briefly, why the most tempting distractor is wrong.
- practice: 2-4 open-ended questions that make the student explain, compare, or apply ideas, with a model answer grounded in the notes and a one-line hint.
- Every card and question has "source": a short verbatim quote (max ~200 characters) from the notes that supports it.`

export class AiError extends Error {}

function client(apiKey: string) {
  // The key belongs to the student and stays in their browser; requests go straight to Anthropic.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })
}

/** Checks that the key works without spending tokens. */
export async function testApiKey(apiKey: string, model: AiModel): Promise<void> {
  try {
    await client(apiKey).models.retrieve(model)
  } catch (error) {
    throw toAiError(error)
  }
}

export async function generateWithAi(text: string, title: string, apiKey: string, model: AiModel): Promise<GeneratedSet> {
  // Haiku has no server-side refusal fallback; Opus and Sonnet route a declined request to another model.
  const fallback = model === 'claude-haiku-5-5' ? {} : { fallbacks: 'default' as const, betas: ['server-side-fallback-2026-07-01'] }

  let response
  try {
    response = await client(apiKey).beta.messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'medium', format: betaZodOutputFormat(StudySetSchema) },
      messages: [
        {
          role: 'user',
          content: `<note_title>${title}</note_title>\n<notes>\n${text}\n</notes>`,
        },
      ],
      ...fallback,
    })
  } catch (error) {
    throw toAiError(error)
  }

  if (response.stop_reason === 'refusal') {
    throw new AiError('Model bu notu işlemeyi reddetti. Basit mod ile deneyebilirsin.')
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AiError('Not çok uzun olduğu için cevap yarıda kaldı. Notu bölümlere ayırıp tekrar dene.')
  }
  if (!response.parsed_output) {
    throw new AiError('Yapay zekâdan beklenen biçimde cevap gelmedi. Tekrar dene.')
  }
  return normalizeStudySet(response.parsed_output)
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

function toAiError(error: unknown): AiError {
  if (error instanceof Anthropic.AuthenticationError) return new AiError('API anahtarı geçersiz. Ayarlar sayfasından kontrol et.')
  if (error instanceof Anthropic.PermissionDeniedError) return new AiError('Bu API anahtarının seçilen modele erişimi yok.')
  if (error instanceof Anthropic.NotFoundError) return new AiError('Seçilen model bulunamadı. Ayarlardan başka bir model seç.')
  if (error instanceof Anthropic.RateLimitError) return new AiError('Çok fazla istek gönderildi ya da hesabının limiti doldu. Biraz sonra tekrar dene.')
  if (error instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(error.message)) return new AiError('Anthropic hesabında yeterli kredi yok.')
    return new AiError(`İstek reddedildi: ${error.message}`)
  }
  if (error instanceof Anthropic.APIConnectionError) return new AiError('Anthropic’e bağlanılamadı. İnternet bağlantını kontrol et.')
  if (error instanceof Anthropic.APIError) return new AiError(`Yapay zekâ servisi hata verdi (${error.status ?? 'bilinmiyor'}). Biraz sonra tekrar dene.`)
  return new AiError('Beklenmeyen bir hata oluştu. Tekrar dene.')
}
