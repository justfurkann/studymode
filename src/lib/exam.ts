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
  type: 'mcq' | 'open'
  prompt: string
  options: string[]
  answerIndex: number
  explanation: string
  modelAnswer: string
  source: string
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim()

/** Keeps only well-formed questions of the requested format, up to `count`. */
export function normalizeExam(raw: RawExamQuestion[], format: ExamFormat, count: number): ExamQuestion[] {
  return raw
    .map((q) => ({ ...q, prompt: q.prompt.trim(), options: q.options.map(clean) }))
    .filter((q) => {
      if (!q.prompt) return false
      if (q.type === 'mcq') {
        return format !== 'classic' && q.options.length >= 2 && q.options.length <= 6 && q.options.every(Boolean) && new Set(q.options).size === q.options.length && q.answerIndex >= 0 && q.answerIndex < q.options.length
      }
      return format !== 'test' && !!q.modelAnswer.trim()
    })
    .slice(0, count)
    .map((q) => ({
      id: crypto.randomUUID(),
      type: q.type,
      prompt: q.prompt,
      options: q.type === 'mcq' ? q.options : [],
      answerIndex: q.type === 'mcq' ? q.answerIndex : -1,
      explanation: q.explanation.trim(),
      modelAnswer: q.modelAnswer.trim(),
      source: clean(q.source) || null,
      noteTitle: null,
    }))
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
    if (q.type === 'mcq') {
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
