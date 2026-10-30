import type { ExamFormat } from './ai/tasks'
import { findSourceMatch } from './noteTools'
import type { ExamQuestion, Note } from './types'

export type { ExamQuestion }

export interface ExamResult {
  /** 0..1 for each question. */
  scores: number[]
  feedback: string[]
  total: number
}

interface RawExamQuestion {
  type: 'mcq' | 'open' | 'blank'
  prompt: string
  options: string[]
  answerIndex: number
  explanation: string
  modelAnswer: string
  source: string
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim()

const BLANK = /_{3,}/g
const MAX_BANK_WORD = 40
const TYPE_ORDER = { mcq: 0, blank: 1, open: 2 } as const

export interface ExamSplit {
  mcq: number
  open: number
  blank?: number
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Keeps well-formed questions of the requested format, up to `count`.
 * With a split, at most that many of each type, ordered like a real exam: test, fill-in-the-blank, written.
 * Blank questions share one shuffled word bank: their answers plus up to `distractorCount` words that fit nowhere.
 */
export function normalizeExam(
  raw: RawExamQuestion[],
  format: ExamFormat,
  count: number,
  split?: ExamSplit,
  bank: { distractors?: string[]; distractorCount?: number; random?: () => number } = {},
): ExamQuestion[] {
  const left = split ? { mcq: split.mcq, open: split.open, blank: split.blank ?? 0 } : null
  const blankAnswers = new Set<string>()
  const key = (word: string) => word.toLocaleLowerCase('tr-TR')
  const kept = raw
    .map((q) => ({ ...q, prompt: q.prompt.trim(), options: q.options.map(clean) }))
    .filter((q) => {
      if (!q.prompt) return false
      if (q.type === 'mcq') {
        return format !== 'classic' && q.options.length >= 2 && q.options.length <= 6 && q.options.every(Boolean) && new Set(q.options).size === q.options.length && q.answerIndex >= 0 && q.answerIndex < q.options.length
      }
      if (q.type === 'blank') {
        const answer = clean(q.modelAnswer)
        // One blank per sentence, a short answer, and no two blanks with the same word.
        if (!left?.blank || (q.prompt.match(BLANK) ?? []).length !== 1 || !answer || answer.length > MAX_BANK_WORD || blankAnswers.has(key(answer))) return false
        blankAnswers.add(key(answer))
        return true
      }
      return format !== 'test' && !!q.modelAnswer.trim()
    })
    .filter((q) => {
      if (!left) return true
      if (left[q.type] <= 0) return false
      left[q.type] -= 1
      return true
    })
    .slice(0, count)
  const ordered = split ? [...kept].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]) : kept

  const answers = ordered.filter((q) => q.type === 'blank').map((q) => clean(q.modelAnswer))
  const taken = new Set(answers.map(key))
  const extras: string[] = []
  for (const word of (bank.distractors ?? []).map(clean)) {
    if (extras.length >= (bank.distractorCount ?? 0)) break
    if (!word || word.length > MAX_BANK_WORD || taken.has(key(word))) continue
    taken.add(key(word))
    extras.push(word)
  }
  const words = answers.length ? shuffle([...answers, ...extras], bank.random ?? Math.random) : []

  return ordered.map((q) => {
    const blank = q.type === 'blank'
    const answer = clean(q.modelAnswer)
    return {
      id: crypto.randomUUID(),
      type: q.type,
      prompt: blank ? q.prompt.replace(BLANK, '_____') : q.prompt,
      options: q.type === 'mcq' ? q.options : blank ? words : [],
      answerIndex: q.type === 'mcq' ? q.answerIndex : blank ? words.indexOf(answer) : -1,
      explanation: q.explanation.trim(),
      modelAnswer: blank ? answer : q.modelAnswer.trim(),
      source: clean(q.source) || null,
      noteTitle: null,
    }
  })
}

/** Without AI: a mixed multiple-choice test from the questions already prepared for each note. */
export function examFromNotes(notes: Note[], count: number, random = Math.random): ExamQuestion[] {
  const pool = notes.flatMap((note) =>
    note.questions.map((q) => ({
      id: crypto.randomUUID(),
      type: 'mcq' as const,
      prompt: q.prompt,
      options: q.options,
      answerIndex: q.answerIndex,
      explanation: q.explanation,
      modelAnswer: '',
      source: q.source,
      noteTitle: note.title,
      noteId: note.id,
    })),
  )
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

/** The note that contains a quoted passage, so an AI question can link back to its source. */
export function noteForSource(notes: Note[], source: string | null): Note | null {
  if (!source?.trim()) return null
  return notes.find((n) => findSourceMatch(n.content, source)) ?? null
}

/** Multiple-choice is scored here; open answers need `openScores` from the AI grader (blank answers score 0). */
export function scoreExam(questions: ExamQuestion[], answers: Array<number | string | null>, openScores: Map<number, { score: number; feedback: string }>): ExamResult {
  const scores: number[] = []
  const feedback: string[] = []
  questions.forEach((q, i) => {
    if (q.type !== 'open') {
      scores.push(answers[i] === q.answerIndex ? 1 : 0)
      feedback.push('')
    } else {
      const graded = openScores.get(i)
      scores.push(graded ? graded.score : 0)
      feedback.push(graded ? graded.feedback : 'Cevap verilmedi.')
    }
  })
  return { scores, feedback, total: scores.reduce((a, b) => a + b, 0) }
}

/** The format an exam actually has, from its questions. */
export function formatOfQuestions(questions: Pick<ExamQuestion, 'type'>[]): ExamFormat {
  if (questions.every((q) => q.type === 'mcq')) return 'test'
  if (questions.every((q) => q.type === 'open')) return 'classic'
  return 'mixed'
}

/** Splits a fill-in-the-blank sentence around its gap. */
export function blankParts(prompt: string): [string, string] {
  const at = prompt.indexOf('_____')
  return at < 0 ? [prompt, ''] : [prompt.slice(0, at), prompt.slice(at + 5)]
}
