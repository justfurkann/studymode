export type Generator = 'ai' | 'local'

export type CourseExamKind = 'vize' | 'final' | 'butunleme' | 'quiz' | 'diger'

/** One exam of a course (midterm, final…). A course can have several. */
export interface CourseExam {
  id: string
  courseId: string
  kind: CourseExamKind
  /** Optional name, mostly for "diğer" (e.g. "Proje sunumu"). */
  title: string | null
  /** YYYY-MM-DD, local calendar day. */
  date: string
  /** Share of the final grade in percent, if known. */
  weight: number | null
  /** Notes the exam covers; empty means the whole course. */
  noteIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Course {
  id: string
  name: string
  color: string
  /**
   * YYYY-MM-DD of the next exam. Before multiple exams existed this was the only exam; it is still
   * kept in sync with the nearest upcoming CourseExam so older data and accounts without the
   * course_exams table keep working.
   */
  examDate: string | null
  createdAt: string
  updatedAt: string
}

export interface KeyTerm {
  term: string
  definition: string
}

export type LearningStepId = 'tanis' | 'anla' | 'pekistir' | 'sina' | 'anlat'

export interface Summary {
  origin?: 'demo'
  tags?: string[]
  sourceChanged?: boolean
  completedSteps?: LearningStepId[]
  checkedTerms?: string[]
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
  /** The student's own written answer, kept so it survives reloads and syncs across devices. */
  draft?: string
  /** Latest AI grading of `draft` (0..1 score). */
  evaluation?: { score: number; feedback: string; gradedAt: string } | null
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
  /** Option chosen for each question, in order. Missing in older attempts. */
  answers?: number[]
  createdAt: string
}

export interface ExamQuestion {
  id: string
  type: 'mcq' | 'open'
  prompt: string
  options: string[]
  answerIndex: number
  explanation: string
  modelAnswer: string
  source: string | null
  noteTitle: string | null
  /** Note the question came from, so the review can open the passage. Missing in older exams. */
  noteId?: string | null
}

/** A finished mock exam, kept so students can review it and track their scores over time. */
export interface ExamRecord {
  id: string
  courseId: string
  format: 'test' | 'classic' | 'mixed'
  difficulty: 'easy' | 'medium' | 'hard' | null
  source: 'ai' | 'local'
  noteIds: string[]
  questions: ExamQuestion[]
  answers: Array<number | string | null>
  /** 0..1 per question. */
  scores: number[]
  feedback: string[]
  /** Sum of `scores`. */
  score: number
  total: number
  /** Time spent, when the exam had a timer. */
  durationSeconds: number | null
  createdAt: string
}

/** A daily activity record synced across devices to track streaks and daily card goals. */
export interface StudyDay {
  id: string
  /** YYYY-MM-DD in the user's local timezone. */
  day: string
  /** Cards reviewed; this is what the daily card goal counts. */
  reviews: number
  /** Tests and mock exams finished. */
  quizzes: number
  /** Other study work (written answers, explanations asked for). Counts toward the streak only. Missing in older rows. */
  actions?: number
  createdAt: string
  updatedAt: string
}

export interface StudyData {
  courses: Course[]
  notes: Note[]
  cards: Card[]
  attempts: QuizAttempt[]
  exams: ExamRecord[]
  studyDays: StudyDay[]
  courseExams: CourseExam[]
}

export const emptyData = (): StudyData => ({ courses: [], notes: [], cards: [], attempts: [], exams: [], studyDays: [], courseExams: [] })

/** What a generator (AI or local rules) produces for one note. */
export interface GeneratedSet {
  summary: Summary
  cards: Array<{ front: string; back: string; source: string | null }>
  questions: Question[]
  practice: PracticeItem[]
}
