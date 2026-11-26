import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDailyQueue, courseReadiness, dailyReview, isNewCard, moreAvailable, readExtra, saveExtra, todayCounts, wasFailed } from './dailyReview'
import { schedule } from './srs'
import { recordStudyActivity } from './streak'
import { emptyData, type Card, type Course, type CourseExam, type Note, type StudyData } from './types'

const now = new Date(2026, 10, 26, 10)
const T = '2026-10-01T00:00:00Z'
const past = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()

const course = (id: string, name = id): Course => ({ id, name, color: '#000', examDate: null, createdAt: T, updatedAt: T })
const exam = (id: string, courseId: string, date: string, noteIds: string[] = []): CourseExam => ({ id, courseId, kind: 'vize', title: null, date, weight: null, noteIds, createdAt: T, updatedAt: T })
const note = (id: string, courseId: string, steps: Array<'tanis' | 'anla' | 'pekistir'> = ['tanis']): Note => ({
  id,
  courseId,
  title: id,
  content: 'metin',
  summary: { overview: 'Özet', points: ['a'], keyTerms: [], completedSteps: steps },
  questions: [],
  practice: [],
  generator: 'ai',
  createdAt: T,
  updatedAt: T,
})
const card = (id: string, courseId: string, noteId: string | null, extra: Partial<Card> = {}): Card => ({
  id,
  courseId,
  noteId,
  front: id,
  back: id,
  source: null,
  due: past(1),
  interval: 3,
  ease: 2.5,
  reps: 2,
  lapses: 0,
  createdAt: T,
  updatedAt: T,
  ...extra,
})
const fresh = (id: string, courseId: string, noteId: string | null, extra: Partial<Card> = {}) => card(id, courseId, noteId, { reps: 0, interval: 0, due: past(0.5), ...extra })
const data = (patch: Partial<StudyData>): StudyData => ({ ...emptyData(), ...patch })
const ids = (cards: Card[]) => cards.map((c) => c.id)

describe('new and failed cards', () => {
  it('a new card has no reps, no lapses and the starting ease; "Bilemedim" on it makes it a failed card', () => {
    const c = fresh('x', 'c', null)
    expect(isNewCard(c)).toBe(true)
    const after = { ...c, ...schedule(c, 'again', now) }
    expect(isNewCard(after)).toBe(false)
    expect(wasFailed(after)).toBe(true)
    expect(wasFailed(card('y', 'c', null, { lapses: 1 }))).toBe(true)
    expect(wasFailed(card('z', 'c', null))).toBe(false)
  })
})

describe('who enters the queue', () => {
  it('new cards only from notes that were read or tested (or without a note); answered cards always come back', () => {
    const d = data({
      courses: [course('c')],
      notes: [note('read', 'c', ['tanis']), note('anla', 'c', ['anla']), note('unread', 'c', []), note('tested', 'c', ['pekistir'])],
      attempts: [{ id: 'a', courseId: 'c', noteId: 'tested', score: 3, total: 5, wrongIds: [], createdAt: T }],
      cards: [fresh('r', 'c', 'read'), fresh('a', 'c', 'anla'), fresh('u', 'c', 'unread'), fresh('t', 'c', 'tested'), fresh('h', 'c', null), fresh('gone', 'c', 'deleted-note'), card('seen', 'c', 'unread')],
    })
    expect(ids(buildDailyQueue(d, 15, 9, now)).sort()).toEqual(['a', 'gone', 'h', 'r', 'seen', 't'])
  })

  it('skips cards that are not due yet', () => {
    const d = data({ courses: [course('c')], cards: [card('later', 'c', null, { due: new Date(now.getTime() + 86_400_000).toISOString() }), card('now', 'c', null)] })
    expect(ids(buildDailyQueue(d, 15, 5, now))).toEqual(['now'])
  })
})

describe('order and limits', () => {
  it('nearest exam first, courses without an exam last; failed before overdue; new cards last', () => {
    const d = data({
      courses: [course('far'), course('near'), course('none')],
      courseExams: [exam('e1', 'far', '2026-12-20'), exam('e2', 'near', '2026-11-30')],
      cards: [
        card('none-old', 'none', null, { due: past(30) }),
        card('far-1', 'far', null),
        card('near-old', 'near', null, { due: past(10) }),
        card('near-failed', 'near', null, { lapses: 2, due: past(0.1) }),
        fresh('near-new', 'near', null),
      ],
    })
    expect(ids(buildDailyQueue(d, 15, 5, now))).toEqual(['near-failed', 'near-old', 'far-1', 'none-old', 'near-new'])
  })

  it('stops at the slots left and lets at most `newLeft` new cards in', () => {
    const cards = [...Array.from({ length: 8 }, (_, i) => fresh(`n${i}`, 'c', null)), card('old', 'c', null)]
    const d = data({ courses: [course('c')], cards })
    const queue = buildDailyQueue(d, 15, 5, now)
    expect(queue).toHaveLength(6)
    expect(queue[0].id).toBe('old')
    expect(buildDailyQueue(d, 15, 2, now)).toHaveLength(3)
    expect(buildDailyQueue(d, 3, 5, now)).toHaveLength(3)
    expect(buildDailyQueue(d, 0, 5, now)).toHaveLength(0)
  })
})

describe('today: goal, new cards, "Biraz daha"', () => {
  it('counts reviews and new cards of today over every device', () => {
    const today = '2026-11-26'
    const studyDays = [
      { id: '1', day: today, reviews: 4, quizzes: 0, newCards: 2, createdAt: T, updatedAt: T },
      { id: '2', day: today, reviews: 3, quizzes: 1, newCards: 1, createdAt: T, updatedAt: T },
      { id: '3', day: '2026-11-25', reviews: 30, quizzes: 0, newCards: 5, createdAt: T, updatedAt: T },
    ]
    expect(todayCounts(studyDays, now)).toEqual({ reviews: 7, newCards: 3 })
    expect(todayCounts([{ id: 'old', day: today, reviews: 2, quizzes: 0, createdAt: T, updatedAt: T }], now)).toEqual({ reviews: 2, newCards: 0 })
  })

  it('the goal left and the new cards left shrink as the day goes on; done means nothing left', () => {
    const cards = [...Array.from({ length: 20 }, (_, i) => card(`o${i}`, 'c', null)), ...Array.from({ length: 6 }, (_, i) => fresh(`n${i}`, 'c', null))]
    const base = data({ courses: [course('c')], cards })
    expect(dailyReview(base, 15, 0, now)).toMatchObject({ goal: 15, done: 0, left: 15, newLeft: 5 })
    const studyDays = [{ id: 's', day: '2026-11-26', reviews: 12, quizzes: 0, newCards: 4, createdAt: T, updatedAt: T }]
    expect(dailyReview({ ...base, studyDays }, 15, 0, now)).toMatchObject({ done: 12, left: 3, newLeft: 1 })
    const done = [{ ...studyDays[0], reviews: 15 }]
    expect(dailyReview({ ...base, studyDays: done }, 15, 0, now).left).toBe(0)
    expect(moreAvailable({ ...base, studyDays: done }, now)).toBe(true)
    expect(dailyReview({ ...base, studyDays: done }, 15, 10, now)).toMatchObject({ goal: 25, left: 10 })
  })

  it('recordStudyActivity keeps new_cards and never lets it go below zero', () => {
    const first = recordStudyActivity([], { reviews: 1, newCards: 1 }, now, () => 'id')
    expect(first.updated).toMatchObject({ reviews: 1, newCards: 1 })
    const undone = recordStudyActivity(first.studyDays, { reviews: -1, newCards: -1 }, now)
    expect(undone.updated).toMatchObject({ reviews: 0, newCards: 0 })
    expect(recordStudyActivity(undone.studyDays, { newCards: -1 }, now).updated.newCards).toBe(0)
  })

  afterEach(() => vi.unstubAllGlobals())
  it('"Biraz daha" lasts for today only', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) })
    expect(readExtra(now)).toBe(0)
    saveExtra(10, now)
    expect(readExtra(now)).toBe(10)
    expect(readExtra(new Date(2026, 10, 27, 9))).toBe(0)
  })
})

describe('per course readiness', () => {
  it('uses the nearest exam when there is one, every note otherwise; courses with an exam first', () => {
    const d = data({
      courses: [course('b', 'Biyoloji'), course('a', 'Anatomi'), course('empty', 'Boş')],
      courseExams: [exam('e', 'b', '2026-12-01', ['n1'])],
      notes: [note('n1', 'b'), note('n2', 'b'), note('n3', 'a')],
      cards: [card('1', 'b', 'n1'), card('2', 'a', 'n3')],
    })
    const rows = courseReadiness(d, now)
    expect(rows.map((r) => r.course.id)).toEqual(['b', 'a'])
    expect(rows[0].examDate).toBe('2026-12-01')
    expect(rows[1].examDate).toBeNull()
  })
})
