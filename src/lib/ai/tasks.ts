// Prompts and output schemas for every AI task. Shared by the browser and the /api functions,
// so this file must only import zod (relative imports would need .js extensions on the server).
import { z } from 'zod'

// ---------- Study set from one note ----------

export const StudySetSchema = z.object({
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

export interface StudyInput {
  title: string
  text: string
}

const STUDY_PROMPT = `You turn a university student's lecture notes into a study set.

Write everything in the language of the notes (usually Turkish). Use only information that is in the notes: do not add facts, numbers, or examples from outside them. If the notes are thin, produce fewer items rather than padding.

Produce:
- summary.overview: 2-4 sentences on what the notes cover and how the parts connect.
- summary.points: 5-10 key points, each one self-contained sentence a student could revise from.
- summary.keyTerms: the important terms with a one-sentence definition taken from the notes.
- cards: 8-20 flashcards for active recall. The front is a specific question (not just a term name when a question works better); the back is a short, complete answer. Cover different parts of the notes, not only definitions.
- questions: 6-12 multiple-choice questions with exactly 4 options and one correct answer (answerIndex is 0-based). Prefer questions that test understanding and application over word recall. Distractors must be plausible and clearly wrong according to the notes. Vary the position of the correct answer. The explanation says why the answer is right and, briefly, why the most tempting distractor is wrong.
- practice: 2-4 open-ended questions that make the student explain, compare, or apply ideas, with a model answer grounded in the notes and a one-line hint.
- Every card and question has "source": a short verbatim quote (max ~200 characters) from the notes that supports it.`

// ---------- Mock exam from several notes ----------

export const ExamSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(['mcq', 'open']),
      prompt: z.string(),
      options: z.array(z.string()),
      answerIndex: z.number().int(),
      explanation: z.string(),
      modelAnswer: z.string(),
      source: z.string(),
    }),
  ),
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
}

const EXAM_PROMPT = `You write a realistic practice exam for a university course from the student's lecture notes.

Write in the language of the notes (usually Turkish). Ask only about material that is in the notes. Spread the questions across all the notes given, roughly in proportion to how much each covers.

Each question has:
- type: "mcq" (multiple choice) or "open" (the student writes an answer).
- prompt: the question.
- For "mcq": exactly 4 options, answerIndex 0-based, explanation of why the answer is right; modelAnswer is "".
- For "open": options is [], answerIndex is -1; modelAnswer is a complete answer that would get full marks, written so it can be used as a grading key; explanation lists the points a grader should look for.
- source: a short verbatim quote (max ~200 characters) from the notes the question is based on.

Difficulty: "easy" checks recall of key facts; "medium" mixes recall with understanding; "hard" asks for application, comparison, and multi-step reasoning.
If past exam questions are provided, imitate their style, length, and the kind of thing they ask about, but write new questions; never copy them.`

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

// ---------- Registry ----------

export const TASKS = {
  study: {
    schema: StudySetSchema,
    system: STUDY_PROMPT,
    user: (input: StudyInput) => `<note_title>${input.title}</note_title>\n<notes>\n${input.text}\n</notes>`,
  },
  exam: {
    schema: ExamSchema,
    system: EXAM_PROMPT,
    user: (input: ExamInput) =>
      [
        `<course>${input.courseName}</course>`,
        `<exam format="${input.format === 'test' ? 'only mcq' : input.format === 'classic' ? 'only open' : 'about half mcq, half open'}" questions="${input.count}" difficulty="${input.difficulty}" />`,
        input.pastQuestions.trim() ? `<past_exam_questions>\n${input.pastQuestions.trim()}\n</past_exam_questions>` : '',
        ...input.notes.map((n) => `<note title="${n.title.replace(/"/g, "'")}">\n${n.text}\n</note>`),
      ]
        .filter(Boolean)
        .join('\n\n'),
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

/** Parses a model's JSON reply (tolerating code fences) and checks it against the task schema. */
export function parseTaskOutput<T extends TaskName>(task: T, text: string): TaskOutput<T> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const result = TASKS[task].schema.safeParse(JSON.parse(cleaned))
    return result.success ? (result.data as TaskOutput<T>) : null
  } catch {
    return null
  }
}
