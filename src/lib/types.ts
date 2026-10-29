export type Generator = 'ai' | 'local'

export interface Course {
  id: string
  name: string
  color: string
  /** YYYY-MM-DD, local calendar day of the next exam. */
  examDate: string | null
  createdAt: string
  updatedAt: string
}

export interface KeyTerm {
  term: string
  definition: string
}

export interface Summary {
  origin?: 'demo'
  tags?: string[]
  sourceChanged?: boolean
  overview: string
  points: string[]
  keyTerms: KeyTerm[]
}

export interface Question {
  id: string
  prompt: string
  options: string[]
  answerIndex: number
  explanation: string
  /** Passage from the note that supports the answer, when known. */
  source: string | null
}

export interface PracticeItem {
  id: string
  question: string
  /** Model answer. Local mode cannot write one, so it may be null. */
  answer: string | null
  hint: string | null
}

export interface Note {
  id: string
  courseId: string
  title: string
  content: string
  summary: Summary | null
  questions: Question[]
  practice: PracticeItem[]
  generator: Generator | null
  createdAt: string
  updatedAt: string
}

export interface Card {
  id: string
  courseId: string
  noteId: string | null
  front: string
  back: string
  source: string | null
  /** ISO timestamp when the card should be reviewed next. */
  due: string
  /** Current interval in days (0 while still being learned). */
  interval: number
  ease: number
  reps: number
  lapses: number
  createdAt: string
  updatedAt: string
}

export interface QuizAttempt {
  id: string
  courseId: string
  noteId: string
  score: number
  total: number
  wrongIds: string[]
  createdAt: string
}

export interface StudyData {
  courses: Course[]
  notes: Note[]
  cards: Card[]
  attempts: QuizAttempt[]
}

export const emptyData = (): StudyData => ({ courses: [], notes: [], cards: [], attempts: [] })

/** What a generator (AI or local rules) produces for one note. */
export interface GeneratedSet {
  summary: Summary
  cards: Array<{ front: string; back: string; source: string | null }>
  questions: Question[]
  practice: PracticeItem[]
}
