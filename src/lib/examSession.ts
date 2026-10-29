import type { ExamDifficulty, ExamFormat } from './ai/tasks'
import type { ExamQuestion } from './types'

export type ExamAnswer = number | string | null

/** A mock exam in progress, kept in sessionStorage so a reload does not lose it. */
export interface ActiveExamDraft {
  questions: ExamQuestion[]
  answers: ExamAnswer[]
  endsAt: number | null
  minutes: number
  startedAt: number
  examSource: 'ai' | 'local'
  format: ExamFormat
  difficulty: ExamDifficulty
  useAi: boolean
  noteIds: string[]
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

export const examStorageKey = (courseId: string) => `studymode.exam.active.${courseId}`

function isDraft(value: unknown): value is ActiveExamDraft {
  if (!value || typeof value !== 'object') return false
  const d = value as Partial<ActiveExamDraft>
  return (
    Array.isArray(d.questions) &&
    d.questions.length > 0 &&
    d.questions.every((q) => q && typeof q === 'object' && typeof q.prompt === 'string' && (q.type === 'mcq' || q.type === 'open')) &&
    Array.isArray(d.answers) &&
    d.answers.length === d.questions.length &&
    (d.endsAt === null || typeof d.endsAt === 'number') &&
    typeof d.minutes === 'number' &&
    Array.isArray(d.noteIds)
  )
}

/**
 * The saved exam for a course, if any. A broken entry is removed so it is not retried on every visit.
 * An exam whose time ran out while the page was closed is still returned: the page submits it with the
 * answers given so far, as a real exam would, instead of throwing those answers away.
 */
export function loadActiveExam(storage: Storage | undefined, courseId: string | undefined): ActiveExamDraft | null {
  if (!storage || !courseId) return null
  let raw: string | null = null
  try {
    raw = storage.getItem(examStorageKey(courseId))
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isDraft(parsed)) return parsed
  } catch {
    // Falls through to removal.
  }
  clearActiveExam(storage, courseId)
  return null
}

export function saveActiveExam(storage: Storage | undefined, courseId: string, draft: ActiveExamDraft) {
  try {
    storage?.setItem(examStorageKey(courseId), JSON.stringify(draft))
  } catch {
    // Storage full or blocked: the exam still works, it just won't survive a reload.
  }
}

export function clearActiveExam(storage: Storage | undefined, courseId: string | undefined) {
  if (!storage || !courseId) return
  try {
    storage.removeItem(examStorageKey(courseId))
  } catch {
    // Nothing to clean up if storage is blocked.
  }
}

/** Whole seconds left on a timed exam (0 when time is up); null for an untimed exam. */
export const secondsRemaining = (endsAt: number | null, now = Date.now()) => (endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null)
