// Prompts and output schemas for every AI task. Shared by the browser and the /api functions,
// so this file must only import zod (relative imports would need .js extensions on the server).
import { z } from 'zod'

// ---------- Study set from one note ----------

export const StudySetSchema = z.object({
  summary: z.object({
    overview: z.string(),
    points: z.array(z.string()),
    keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })).default([]),
  }),
  cards: z.array(z.object({ front: z.string(), back: z.string(), source: z.string().default('') })).default([]),
  questions: z
    .array(
      z.object({
        prompt: z.string(),
        options: z.array(z.string()),
        answerIndex: z.number().int(),
        explanation: z.string().default(''),
        source: z.string().default(''),
      }),
    )
    .default([]),
  practice: z.array(z.object({ question: z.string(), answer: z.string().default(''), hint: z.string().default('') })).default([]),
})

export interface StudyInput {
  title: string
  text: string
}

const STUDY_PROMPT = `You turn a university student's lecture notes into a study set.

Write everything in the language of the notes (usually Turkish). Use only information that is in the notes: do not add facts, numbers, or examples from outside them. If the notes are thin, produce fewer items rather than padding.

Produce:
- summary.overview: 2-4 sentences on what the notes cover and how the parts connect.
- summary.points: 5-8 key points, each one self-contained sentence a student could revise from.
- summary.keyTerms: the important terms with a one-sentence definition taken from the notes.
- cards: 8-12 flashcards for active recall. The front is a specific question (not just a term name when a question works better); the back is a short, complete answer. Cover different parts of the notes, not only definitions.
- questions: 5-8 multiple-choice questions with exactly 4 options and one correct answer (answerIndex is 0-based). Prefer questions that test understanding and application over word recall. Distractors must be plausible and clearly wrong according to the notes. Vary the position of the correct answer. The explanation says why the answer is right and, briefly, why the most tempting distractor is wrong.
- practice: 2-3 open-ended questions that make the student explain, compare, or apply ideas, with a model answer grounded in the notes and a one-line hint.
- Every card and question has "source": a short verbatim quote (max ~120 characters) from the notes that supports it.`

// ---------- Detailed summary ("Tam özet") of one note ----------

export const DetailSchema = z.object({
  intro: z.string().default(''),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        paragraphs: z.array(z.string()).default([]),
        bullets: z.array(z.string()).default([]),
        example: z.string().default(''),
      }),
    )
    .default([]),
  takeaways: z.array(z.string()).default([]),
})

export interface DetailInput {
  title: string
  text: string
  /** "Bölüm 2/3" for a long note sent in parts. */
  part?: string
}

const DETAIL_PROMPT = `You write the detailed study summary of a university student's lecture notes: the one page they read to really understand the topic before an exam, instead of the raw notes.

Write everything in the language of the notes (usually Turkish), in clear, plain sentences a student can follow without the lecture. Use only information that is in the notes: do not add facts, numbers, dates, or examples from outside them. Keep every important detail from the notes (definitions, steps, causes and effects, formulas, lists, differences between similar ideas); leave out only repetition and filler.

Produce:
- intro: 2-3 sentences on what the notes are about and how the parts connect.
- sections: follow the structure of the notes (their headings or natural topics), in order. For each section:
  - heading: a short title.
  - paragraphs: 1-3 paragraphs that explain the ideas, why they matter and how they relate. Explain, do not just list.
  - bullets: the facts worth memorising in this section (definitions, steps, properties, formulas), each one short and self-contained. [] if none.
  - example: an example, case or application that appears in the notes, explained in 1-2 sentences; "" if the notes give none.
- takeaways: 3-6 points to watch for in the exam: easily confused ideas, frequent mistakes, the most important definitions.
If the notes are thin, write less rather than padding. If this is one part of a longer note, cover only this part and leave intro and takeaways short.`

// ---------- Mock exam from several notes ----------

export const ExamSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(['mcq', 'open', 'blank']),
      prompt: z.string(),
      options: z.array(z.string()).default([]),
      answerIndex: z.number().int().default(-1),
      explanation: z.string().default(''),
      modelAnswer: z.string().default(''),
      source: z.string().default(''),
    }),
  ),
  /** Fill-in-the-blank only: words that belong in the word bank but fit no blank. */
  distractors: z.array(z.string()).default([]),
})

export type ExamFormat = 'test' | 'classic' | 'mixed'
export type ExamDifficulty = 'easy' | 'medium' | 'hard'

export interface ExamInput {
  courseName: string
  notes: Array<{ title: string; text: string }>
  format: ExamFormat
  count: number
  difficulty: ExamDifficulty
  pastQuestions: string
  /** Exact split asked for; when set, count is their sum. */
  mcqCount?: number
  openCount?: number
  /** What the student knows about the real exam (what the teacher said). */
  examInfo?: string
  /** Fill-in-the-blank sentences, and extra bank words that fit none of them. */
  blankCount?: number
  distractorCount?: number
}

const EXAM_PROMPT = `You write a realistic practice exam for a university course from the student's lecture notes.

Write in the language of the notes (usually Turkish). Ask only about material that is in the notes. Spread the questions across all the notes given, roughly in proportion to how much each covers.

Each question has:
- type: "mcq" (multiple choice) or "open" (the student writes an answer).
- prompt: the question.
- For "mcq": exactly 4 options, answerIndex 0-based, explanation of why the answer is right; modelAnswer is "".
- For "open": options is [], answerIndex is -1; modelAnswer is a complete answer that would get full marks, written so it can be used as a grading key; explanation lists the points a grader should look for.
- For "blank" (fill in the blank): prompt is one sentence about the notes' content with exactly one key term replaced by "_____" (five underscores); modelAnswer is the missing word or short phrase (1-3 words), written exactly as it fits the sentence; options is [], answerIndex is -1; explanation says briefly why it fits. Every blank has a different answer, and the sentence must make the answer clear to someone who studied the notes.
- source: a short verbatim quote (max ~120 characters) from the notes the question is based on.

When blanks are asked for, also return "distractors": exactly the number asked of extra words or short phrases for the shared word bank. They are terms from the same notes and of the same kind as the answers, so they look plausible, but each one fits none of the blank sentences. Otherwise return "distractors": [].

Difficulty: "easy" checks recall of key facts; "medium" mixes recall with understanding; "hard" asks for application, comparison, and multi-step reasoning.
If the exam tag gives "mcq", "open" and "blank" counts, write exactly that many of each kind.
If past exam questions are provided, imitate their style, length, and the kind of thing they ask about, but write new questions; never copy them.
If the student describes the real exam (what the teacher said: topics that weigh more, topics left out, question style), follow it when choosing topics and how to ask, but still ask only about material in the notes.`

// ---------- Grading open answers ----------

export const GradeSchema = z.object({
  results: z.array(z.object({ score: z.number(), feedback: z.string() })),
})

export interface GradeInput {
  items: Array<{ question: string; modelAnswer: string; criteria: string; answer: string }>
}

const GRADE_PROMPT = `You grade a university student's written answers in a practice exam.

For each item, compare the student's answer with the model answer and the grading criteria. Return one result per item, in the same order:
- score: a number from 0 to 1 (partial credit allowed, e.g. 0.5). An empty or off-topic answer gets 0.
- feedback: 1-3 sentences in the language of the question (usually Turkish), saying what was right and what was missing or wrong. Be direct and specific; do not be harsh.
Judge the content, not spelling or style.`

// ---------- Transcribing images & scanned PDF pages ----------

export const TranscribeSchema = z.object({
  text: z.string(),
})

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface TranscribeImage {
  mimeType: ImageMimeType
  /** Base64-encoded image bytes without a data: URL prefix. */
  data: string
}

export interface TranscribeInput {
  images: TranscribeImage[]
}

export const TRANSCRIBE_USER_TEXT =
  'Transcribe the text, mathematical expressions, and tables from the attached lecture note page(s) in order.'

const TRANSCRIBE_PROMPT = `You transcribe university lecture notes, slides, and textbook pages from images into clean, accurate plain text / Markdown.

Rules:
- Keep the original language of the document (usually Turkish).
- Transcribe all visible lecture content in reading order. If multiple pages are provided, separate pages with a blank line.
- Preserve headings, bullet points, numbered lists, mathematical formulas (using clear notation or LaTeX such as $E = mc^2$), and tables (using Markdown tables).
- Do NOT summarize, explain, or invent content. Only transcribe what is written in the images.
- If an image contains no readable text at all, return {"text": ""}.`

// ---------- Interactive concept explainer ("Bu konuyu anlamadım") ----------

export const ExplainSchema = z.object({
  explanation: z.string(),
})

export type ExplainMode = 'simple' | 'example' | 'step_by_step'

export interface ExplainInput {
  title: string
  topic: string
  context: string
  mode: ExplainMode
}

const EXPLAIN_PROMPT = `You are a patient university tutor helping a student who clicked "I didn't understand this" on a concept or key point from their lecture notes.

Write in the language of the notes (usually Turkish). Ground your explanation in the provided note context, and make it genuinely easy to grasp:
- If mode is "simple": Explain it in plain, everyday words as if to a first-year student seeing it for the first time (3-5 short sentences, no jargon without immediate definition).
- If mode is "example": Give a concrete, relatable real-life or practical example/analogy that illustrates how this concept works in practice.
- If mode is "step_by_step": Break the idea down into 3-5 numbered, logical mini-steps from the most basic premise to the conclusion.`

// ---------- Memory Coding (Mnemonics) & Concept Comparisons ----------

export const MemoryToolsSchema = z.object({
  mnemonics: z
    .array(
      z.object({
        kind: z.enum(['akrostis', 'tekerleme', 'hikaye', 'ipucu']),
        title: z.string(),
        code: z.string(),
        breakdown: z.array(z.object({ key: z.string(), meaning: z.string() })).default([]),
        tip: z.string().default(''),
      }),
    )
    .default([]),
  comparisons: z
    .array(
      z.object({
        leftTerm: z.string(),
        leftPoint: z.string(),
        rightTerm: z.string(),
        rightPoint: z.string(),
        difference: z.string(),
        examTrap: z.string().default(''),
      }),
    )
    .default([]),
})

export interface MemoryInput {
  title: string
  text: string
  mode?: 'all' | 'mnemonic' | 'comparison'
  mnemonicKind?: 'akrostis' | 'tekerleme' | 'hikaye' | 'ipucu'
  focusTopic?: string
  leftTerm?: string
  rightTerm?: string
}

const MEMORY_PROMPT = `You create memorable university study aids from lecture notes:
1) Memory encodings (mnemonics) that make lists, stages, or key definitions effortless to recall in an exam.
2) Side-by-side concept comparisons and exam trap warnings for easily confused terms.

Write everything in the language of the notes (usually Turkish). Use ONLY facts from the notes.

For "mnemonics":
- kind: "akrostis" (acronym/initial letters forming a catchy Turkish word or code), "tekerleme" (a rhythmic, rhyming 4-line verse/stanza using the concepts), "hikaye" (a short vivid story chain linking the concepts in order), or "ipucu" (word-association hook).
- title: short descriptive title.
- code: the actual acronym word/code, rhyming stanza, or hook phrase that the student memorizes.
- breakdown: 3-6 items unpacking each letter, line, or step into its exact concept and meaning from the notes.
- tip: 1 sentence explaining how to recall this code on exam day.

For "comparisons":
- Pick pairs of concepts in the notes that students often confuse or that professors compare on exams (or use leftTerm and rightTerm if specified).
- leftTerm / leftPoint: first concept and its core role (1 concise sentence).
- rightTerm / rightPoint: second concept and its core role (1 concise sentence).
- difference: the single sharpest distinction between the two.
- examTrap: how a multiple-choice or classic exam question tries to trick students into confusing them.

Respect the requested mode:
- If mode is "mnemonic": return 1-2 mnemonics (using mnemonicKind and focusTopic when given) and comparisons: [].
- If mode is "comparison": return mnemonics: [] and 1-2 comparisons (comparing leftTerm and rightTerm when given).
- If mode is "all" or omitted: return 3 diverse mnemonics ("akrostis", "tekerleme", "hikaye") and 2-3 high-value comparisons.`

// ---------- Two-Speaker Study Podcast Script ----------

export const PodcastSchema = z.object({
  title: z.string(),
  summary: z.string().default(''),
  lines: z
    .array(
      z.object({
        speaker: z.enum(['Deniz', 'Mert']),
        role: z.enum(['host', 'student']).default('host'),
        text: z.string(),
        highlight: z.string().default(''),
      }),
    )
    .default([]),
})

export interface PodcastInput {
  title: string
  text: string
}

const PODCAST_PROMPT = `You write a lively, natural two-speaker university study podcast script from lecture notes.

Write in the language of the notes (usually Turkish). Use ONLY facts from the notes.
Speakers:
- "Deniz" (role: "host"): warm, clear, articulate teaching assistant who explains concepts with memorable examples and highlights exam traps.
- "Mert" (role: "student"): curious university student who asks smart questions, checks his understanding, and points out things students often confuse.

Produce 8 to 12 conversational turns ("lines") that walk through the core concepts and main points of the notes naturally.
For each line:
- speaker: "Deniz" or "Mert" (alternate naturally).
- role: "host" for Deniz, "student" for Mert.
- text: 1-3 natural spoken sentences (no markdown bullets inside speech).
- highlight: the key concept or term discussed in that turn (or "" if general).`

// ---------- Multi-Speaker Studio TTS (gemini-3.8-flash-tts / -lite-tts) ----------

export const TtsSchema = z.object({
  audioBase64: z.string(),
  mimeType: z.string().default('audio/wav'),
})

export interface TtsInput {
  lines: Array<{ speaker: 'Deniz' | 'Mert'; text: string }>
}

const TTS_PROMPT = `Convert the provided two-speaker study dialogue into natural spoken audio.`

// ---------- Educational Image & Schema Generation (gemini-3.1-flash-lite-image / nano-banana) ----------

export const ImageGenSchema = z.object({
  imageBase64: z.string(),
  mimeType: z.string().default('image/png'),
  caption: z.string().default(''),
})

export interface ImageGenInput {
  title: string
  topic: string
  context: string
  aspectRatio?: '1:1' | '16:9' | '4:3'
}

const IMAGE_GEN_PROMPT = `Create a clean, high-contrast educational illustration or schematic diagram for a university study card.`

// ---------- Semantic Embeddings (gemini-embedding-2-preview / gemini-embedding-001) ----------

export const EmbedSchema = z.object({
  embeddings: z.array(z.array(z.number())),
})

export interface EmbedInput {
  texts: string[]
}

const EMBED_PROMPT = `Generate semantic embedding vectors for the given study texts.`

// ---------- Registry ----------

export const MAX_PROMPT_NOTE_CHARS = 24_000

/** Keeps huge PDFs within free-tier token-per-minute limits and under serverless timeouts by sampling beginning, middle, and end. */
function trimNoteText(text: string, budget = MAX_PROMPT_NOTE_CHARS): string {
  if (text.length <= budget) return text
  const third = Math.floor(budget / 3)
  const midStart = Math.floor((text.length - third) / 2)
  return `${text.slice(0, third).trim()}\n\n[…]\n\n${text.slice(midStart, midStart + third).trim()}\n\n[…]\n\n${text.slice(text.length - third).trim()}`
}

/**
 * The part of a long note around where `topic` is discussed, so an explanation request sees the
 * relevant passage instead of a fixed sample of the beginning, middle and end.
 */
export function contextAround(text: string, topic: string, budget = 8_000): string {
  if (text.length <= budget) return text
  const lower = text.toLocaleLowerCase('tr-TR')
  const words = topic
    .toLocaleLowerCase('tr-TR')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4)
    .sort((a, b) => b.length - a.length)
  const phrase = topic.toLocaleLowerCase('tr-TR').trim().slice(0, 60)
  let at = phrase ? lower.indexOf(phrase) : -1
  for (const word of words) {
    if (at >= 0) break
    at = lower.indexOf(word)
  }
  if (at < 0) return trimNoteText(text, budget)
  const start = Math.max(0, Math.min(at - Math.floor(budget / 3), text.length - budget))
  return `${start > 0 ? '[…] ' : ''}${text.slice(start, start + budget).trim()}${start + budget < text.length ? ' […]' : ''}`
}

/**
 * Splits a long lecture note into meaningful chunks on paragraph/section boundaries
 * so every part of a long note is analyzed without losing middle sections.
 */
export function splitNoteIntoChunks(text: string, maxChars = 20_000): string[] {
  const cleaned = text.trim()
  if (!cleaned) return []
  if (cleaned.length <= maxChars) return [cleaned]

  const paragraphs = cleaned.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''

  const pushPart = (part: string) => {
    const trimmed = part.trim()
    if (!trimmed) return
    if (!current) {
      current = trimmed
      return
    }
    if (current.length + 2 + trimmed.length <= maxChars) {
      current = `${current}\n\n${trimmed}`
    } else {
      chunks.push(current)
      current = trimmed
    }
  }

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      pushPart(para)
    } else {
      const lines = para.split('\n')
      for (const line of lines) {
        if (line.length <= maxChars) {
          pushPart(line)
        } else {
          for (let i = 0; i < line.length; i += maxChars) {
            pushPart(line.slice(i, i + maxChars))
          }
        }
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}

export const TASKS = {
  detail: {
    schema: DetailSchema,
    system: DETAIL_PROMPT,
    user: (input: DetailInput) => `<note_title>${input.title}${input.part ? ` (${input.part})` : ''}</note_title>\n<notes>\n${trimNoteText(input.text)}\n</notes>`,
  },
  study: {
    schema: StudySetSchema,
    system: STUDY_PROMPT,
    user: (input: StudyInput) => `<note_title>${input.title}</note_title>\n<notes>\n${trimNoteText(input.text)}\n</notes>`,
  },
  exam: {
    schema: ExamSchema,
    system: EXAM_PROMPT,
    user: (input: ExamInput) => {
      const perNoteBudget = Math.max(4_000, Math.floor(MAX_PROMPT_NOTE_CHARS / Math.max(1, input.notes.length)))
      return [
        `<course>${input.courseName}</course>`,
        input.mcqCount != null && input.openCount != null
          ? `<exam mcq="${input.mcqCount}" open="${input.openCount}"${input.blankCount ? ` blank="${input.blankCount}" distractors="${input.distractorCount ?? 0}"` : ''} questions="${input.mcqCount + input.openCount + (input.blankCount ?? 0)}" difficulty="${input.difficulty}" />`
          : `<exam format="${input.format === 'test' ? 'only mcq' : input.format === 'classic' ? 'only open' : 'about half mcq, half open'}" questions="${input.count}" difficulty="${input.difficulty}" />`,
        input.examInfo?.trim() ? `<about_the_real_exam>\n${input.examInfo.trim().slice(0, 2000)}\n</about_the_real_exam>` : '',
        input.pastQuestions.trim() ? `<past_exam_questions>\n${input.pastQuestions.trim()}\n</past_exam_questions>` : '',
        ...input.notes.map((n) => `<note title="${n.title.replace(/"/g, "'")}">\n${trimNoteText(n.text, perNoteBudget)}\n</note>`),
      ]
        .filter(Boolean)
        .join('\n\n')
    },
  },
  grade: {
    schema: GradeSchema,
    system: GRADE_PROMPT,
    user: (input: GradeInput) =>
      input.items
        .map(
          (item, i) =>
            `<item index="${i}">\n<question>${item.question}</question>\n<model_answer>${item.modelAnswer}</model_answer>\n<criteria>${item.criteria}</criteria>\n<student_answer>${item.answer}</student_answer>\n</item>`,
        )
        .join('\n\n'),
  },
  transcribe: {
    schema: TranscribeSchema,
    system: TRANSCRIBE_PROMPT,
    user: (input: TranscribeInput) => {
      const images = Array.isArray(input?.images) ? input.images : []
      return [
        TRANSCRIBE_USER_TEXT,
        ...images.map((img, i) => `<image index="${i + 1}" mime="${img.mimeType}">${img.data}</image>`),
      ].join('\n')
    },
  },
  explain: {
    schema: ExplainSchema,
    system: EXPLAIN_PROMPT,
    user: (input: ExplainInput) =>
      [
        `<note_title>${input.title}</note_title>`,
        `<mode>${input.mode}</mode>`,
        `<target_concept>${input.topic}</target_concept>`,
        `<note_context>\n${contextAround(input.context, input.topic, 8_000)}\n</note_context>`,
      ].join('\n'),
  },
  memory: {
    schema: MemoryToolsSchema,
    system: MEMORY_PROMPT,
    user: (input: MemoryInput) => {
      const searchFocus = input.focusTopic || input.leftTerm || input.rightTerm || ''
      const noteSlice = searchFocus ? contextAround(input.text, searchFocus, 14_000) : trimNoteText(input.text, 16_000)
      return [
        `<note_title>${input.title}</note_title>`,
        `<mode>${input.mode ?? 'all'}</mode>`,
        input.mnemonicKind ? `<mnemonic_kind>${input.mnemonicKind}</mnemonic_kind>` : '',
        input.focusTopic?.trim() ? `<focus_topic>${input.focusTopic.trim()}</focus_topic>` : '',
        input.leftTerm?.trim() && input.rightTerm?.trim()
          ? `<compare_pair left="${input.leftTerm.trim()}" right="${input.rightTerm.trim()}" />`
          : '',
        `<notes>\n${noteSlice}\n</notes>`,
      ]
        .filter(Boolean)
        .join('\n')
    },
  },
  podcast: {
    schema: PodcastSchema,
    system: PODCAST_PROMPT,
    user: (input: PodcastInput) => `<note_title>${input.title}</note_title>\n<notes>\n${trimNoteText(input.text, 16_000)}\n</notes>`,
  },
  tts: {
    schema: TtsSchema,
    system: TTS_PROMPT,
    user: (input: TtsInput) => {
      const safeLines = (Array.isArray(input?.lines) ? input.lines : []).slice(0, 16).map((l) => ({
        speaker: l.speaker === 'Mert' ? 'Mert' : 'Deniz',
        text: String(l.text ?? '').slice(0, 600).trim(),
      }))
      return `<tts_dialogue>${JSON.stringify(safeLines)}</tts_dialogue>`
    },
  },
  image: {
    schema: ImageGenSchema,
    system: IMAGE_GEN_PROMPT,
    user: (input: ImageGenInput) => {
      const aspect = input.aspectRatio === '1:1' || input.aspectRatio === '4:3' ? input.aspectRatio : '16:9'
      const slice = contextAround(input.context || '', input.topic || input.title || '', 2_000)
      const prompt = [
        `Educational diagram / study illustration for university lecture note "${input.title}".`,
        `Concept to visualize: ${input.topic}.`,
        slice ? `Context from note: ${slice.slice(0, 600)}` : '',
        `Style: Clean, modern textbook diagram on warm cream paper (#fafaf6) with deep navy ink (#1b2250) and bright yellow highlighter accents (#ffe14d), clear Turkish labels, high legibility.`,
      ]
        .filter(Boolean)
        .join('\n')
      return `<image_prompt aspect="${aspect}">${prompt}</image_prompt>`
    },
  },
  embed: {
    schema: EmbedSchema,
    system: EMBED_PROMPT,
    user: (input: EmbedInput) => {
      const texts = (Array.isArray(input?.texts) ? input.texts : []).slice(0, 25).map((t) => String(t ?? '').slice(0, 3_500))
      return `<embed_texts>${JSON.stringify(texts)}</embed_texts>`
    },
  },
}

export type TaskName = keyof typeof TASKS
export type TaskInput<T extends TaskName> = Parameters<(typeof TASKS)[T]['user']>[0]
export type TaskOutput<T extends TaskName> = z.infer<(typeof TASKS)[T]['schema']>

export const isTaskName = (value: unknown): value is TaskName => typeof value === 'string' && value in TASKS

/** Builds the user message for a task. Input shape is checked by the caller's types, not here. */
export function userPrompt(task: TaskName, input: unknown): string {
  return (TASKS[task].user as (i: unknown) => string)(input)
}

/** For providers without native structured output: the system prompt plus the JSON shape to return. */
export function jsonModeSystem(task: TaskName): string {
  const schema = z.toJSONSchema(TASKS[task].schema)
  return `${TASKS[task].system}\n\nRespond with a single JSON object only, no prose and no code fences, matching this JSON Schema:\n${JSON.stringify(schema)}`
}

/** Parses a model's JSON reply (tolerating code fences and null string fields) and checks it against the task schema. */
export function parseTaskOutput<T extends TaskName>(task: T, text: string): TaskOutput<T> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(cleaned, (key, value) => (key && value === null ? '' : value))
    const result = TASKS[task].schema.safeParse(parsed)
    return result.success ? (result.data as TaskOutput<T>) : null
  } catch {
    return null
  }
}
