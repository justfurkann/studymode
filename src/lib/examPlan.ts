import type { ExamDifficulty, ExamFormat } from './ai/tasks'

/** How the student says the real exam will look; remembered per course and exam on this device. */
export interface ExamPlan {
  mcqCount: number
  openCount: number
  minutes: number
  difficulty: ExamDifficulty
  /** What the teacher said about the exam: weighted topics, excluded weeks, question style. */
  info: string
  pastQuestions: string
}

export const MCQ_COUNTS = [0, 5, 10, 15, 20, 25, 30]
export const OPEN_COUNTS = [0, 1, 2, 3, 4, 5, 6, 8, 10]
export const EXAM_INFO_MAX = 2000

export const DEFAULT_PLAN: ExamPlan = { mcqCount: 10, openCount: 0, minutes: 30, difficulty: 'medium', info: '', pastQuestions: '' }

const KEY = 'studymode.examPlan.v1'

const planKey = (courseId: string, examId: string) => `${courseId}:${examId || '-'}`

export function planFormat(plan: Pick<ExamPlan, 'mcqCount' | 'openCount'>): ExamFormat {
  if (!plan.openCount) return 'test'
  if (!plan.mcqCount) return 'classic'
  return 'mixed'
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** Cleans a stored plan: anything unexpected falls back to the default for that field. */
export function sanitizePlan(raw: unknown): ExamPlan {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const plan: ExamPlan = {
    mcqCount: pick(r.mcqCount, MCQ_COUNTS, DEFAULT_PLAN.mcqCount),
    openCount: pick(r.openCount, OPEN_COUNTS, DEFAULT_PLAN.openCount),
    minutes: typeof r.minutes === 'number' && r.minutes >= 0 && r.minutes <= 240 ? Math.round(r.minutes) : DEFAULT_PLAN.minutes,
    difficulty: pick(r.difficulty, ['easy', 'medium', 'hard'] as const, DEFAULT_PLAN.difficulty),
    info: typeof r.info === 'string' ? r.info.slice(0, EXAM_INFO_MAX) : '',
    pastQuestions: typeof r.pastQuestions === 'string' ? r.pastQuestions : '',
  }
  if (!plan.mcqCount && !plan.openCount) plan.mcqCount = DEFAULT_PLAN.mcqCount
  return plan
}

function readAll(storage: Storage | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function loadExamPlan(storage: Storage | undefined, courseId: string, examId: string): ExamPlan {
  const all = readAll(storage)
  // Fall back to the course's last plan when this exam has none yet.
  return sanitizePlan(all[planKey(courseId, examId)] ?? all[planKey(courseId, '')])
}

export function saveExamPlan(storage: Storage | undefined, courseId: string, examId: string, plan: ExamPlan) {
  try {
    const all = readAll(storage)
    all[planKey(courseId, examId)] = plan
    all[planKey(courseId, '')] = plan
    storage?.setItem(KEY, JSON.stringify(all))
  } catch {
    // Blocked storage only means the plan isn't remembered.
  }
}
