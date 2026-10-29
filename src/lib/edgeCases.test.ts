import { describe, expect, it } from 'vitest'
import { missingColumn } from './backend'
import { contextAround } from './ai/tasks'
import { computeTopicMastery } from './learningPath'
import { computeStreakSummary, recordStudyActivity } from './streak'
import { buildSmartStudyPlan } from './studyPlan'
import { emptyData, type Course, type Note, type StudyData } from './types'

const course = (examDate: string | null): Course => ({ id: 'c1', name: 'Biyoloji', color: '#000', examDate, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' })
const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  courseId: 'c1',
  title: 'Hücre',
  content: 'Mitokondri enerji üretir.',
  summary: { overview: 'Özet', points: ['Nokta'], keyTerms: [] },
  questions: [],
  practice: [],
  generator: 'ai',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('topic mastery edge cases', () => {
  it('is "not measured" without cards or tests, never a misleading 0%', () => {
    const mastery = computeTopicMastery(note(), [], [])
    expect(mastery.assessed).toBe(false)
    expect(mastery.quizPercent).toBeNull()
    expect(mastery.cardPercent).toBeNull()
  })

  it('ignores cards nobody has studied yet', () => {
    const card = { id: 'k', noteId: 'n1', courseId: 'c1', front: 'S', back: 'C', source: null, due: '', interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: '', updatedAt: '' }
    expect(computeTopicMastery(note(), [card], []).assessed).toBe(false)
  })
})

describe('smart plan edge cases', () => {
  const now = new Date('2026-05-10T10:00:00')

  it('returns no items and a neutral headline for an empty account', () => {
    const plan = buildSmartStudyPlan(emptyData(), now)
    expect(plan.items).toEqual([])
    expect(plan.headline).toBeTruthy()
  })

  it('does not count down to an exam that is already over', () => {
    const data: StudyData = { ...emptyData(), courses: [course('2026-05-01')], notes: [note()] }
    const plan = buildSmartStudyPlan(data, now)
    expect(plan.items[0].examDays).toBeNull()
    expect(plan.headline).not.toMatch(/kaldı/)
    expect(plan.items[0].reason).not.toMatch(/Sınava/)
  })

  it('suggests preparing a note that has no study set yet', () => {
    const data: StudyData = { ...emptyData(), courses: [course(null)], notes: [note({ generator: null, summary: null })] }
    expect(buildSmartStudyPlan(data, now).items[0].actionLabel).toBe('Seti hazırla')
  })
})

describe('streak counts any study work', () => {
  const now = new Date(2026, 9, 30, 12)

  it('keeps the streak with only a written answer, without moving the card goal', () => {
    const { studyDays } = recordStudyActivity([], { actions: 1 }, now)
    const summary = computeStreakSummary(studyDays, 20, now)
    expect(summary.streak).toBe(1)
    expect(summary.studiedToday).toBe(true)
    expect(summary.todayReviews).toBe(0)
  })

  it('treats rows saved before the actions column existed as zero', () => {
    const old = { id: 'x', day: '2026-10-30', reviews: 0, quizzes: 0, createdAt: '', updatedAt: '' }
    expect(computeStreakSummary([old], 20, now).studiedToday).toBe(false)
  })
})

describe('saving before a migration', () => {
  it('reads the unknown column name from a PostgREST error', () => {
    expect(missingColumn({ code: 'PGRST204', message: "Could not find the 'actions' column of 'study_days' in the schema cache" })).toBe('actions')
    expect(missingColumn({ code: '23505', message: 'duplicate' })).toBeNull()
  })
})

describe('explanation context for long notes', () => {
  it('sends the passage where the concept appears, not a fixed sample', () => {
    const filler = 'Giriş cümlesi. '.repeat(2000)
    const text = `${filler}Golgi cisimciği proteinleri paketler ve hücre dışına gönderir. ${filler}`
    const context = contextAround(text, 'Golgi cisimciği', 2000)
    expect(context.length).toBeLessThanOrEqual(2010)
    expect(context).toContain('Golgi cisimciği proteinleri paketler')
  })

  it('returns short notes unchanged', () => {
    expect(contextAround('Kısa not.', 'not', 100)).toBe('Kısa not.')
  })
})
