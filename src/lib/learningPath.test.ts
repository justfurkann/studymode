import { describe, expect, it } from 'vitest'
import { computeNoteProgress, computeTopicMastery, toggleCheckedTerm, toggleCompletedStep } from './learningPath'
import type { Card, Note, QuizAttempt, Summary } from './types'

function makeSummary(overrides: Partial<Summary> = {}): Summary {
  return {
    overview: 'Bu konu hücrenin temel yapı taşlarını anlatır.',
    points: ['Mitokondri enerji üretir.', 'Ribozom protein sentezler.', 'Çekirdek yönetimi sağlar.'],
    keyTerms: [
      { term: 'Mitokondri', definition: 'Enerji santrali.' },
      { term: 'Ribozom', definition: 'Protein fabrikası.' },
    ],
    ...overrides,
  }
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    courseId: 'c1',
    title: 'Hücre Biyolojisi',
    content: 'Not içeriği',
    summary: makeSummary(),
    questions: [
      {
        id: 'q1',
        prompt: 'Enerji nerede üretilir?',
        options: ['Mitokondri', 'Ribozom', 'Lizozom', 'Zar'],
        answerIndex: 0,
        explanation: 'Mitokondri hücresel solunum yapar.',
        source: null,
      },
    ],
    practice: [
      {
        id: 'p1',
        question: 'Mitokondriyi hiç bilmeyen birine anlat.',
        answer: 'Hücrenin enerji santralidir.',
        hint: 'Enerji',
      },
    ],
    generator: 'ai',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('learningPath', () => {
  it('starts at step 1 (tanis) with 0% for a brand-new note', () => {
    const note = makeNote()
    const progress = computeNoteProgress(note, [], [])
    expect(progress.completedCount).toBe(0)
    expect(progress.percent).toBe(0)
    expect(progress.currentStep.id).toBe('tanis')
    expect(progress.currentStep.stepNumber).toBe(1)
    expect(progress.isCompleted).toBe(false)
    expect(progress.nextActionLabel).toBe('1. Adım: Konuyla Tanış & Kavramlar')
  })

  it('auto-completes step 1 when all keyTerms are checked', () => {
    let summary = makeSummary()
    summary = toggleCheckedTerm(summary, 'Mitokondri')
    expect(summary.completedSteps ?? []).not.toContain('tanis')

    summary = toggleCheckedTerm(summary, 'Ribozom')
    expect(summary.completedSteps).toContain('tanis')

    const progress = computeNoteProgress(makeNote({ summary }), [], [])
    expect(progress.steps[0].done).toBe(true)
    expect(progress.currentStep.id).toBe('anla')
    expect(progress.percent).toBe(20)
  })

  it('auto-completes step 3 (pekistir) when at least half of the note cards are studied, and step 4 (sina) when quiz score >= 70%', () => {
    const summary = toggleCompletedStep(toggleCompletedStep(makeSummary(), 'tanis', true), 'anla', true)
    const note = makeNote({ summary })
    const cards: Card[] = [
      {
        id: 'card1',
        courseId: 'c1',
        noteId: 'n1',
        front: 'Soru 1',
        back: 'Cevap 1',
        source: null,
        due: '2026-01-02T00:00:00Z',
        interval: 1,
        ease: 2.5,
        reps: 1,
        lapses: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'card2',
        courseId: 'c1',
        noteId: 'n1',
        front: 'Soru 2',
        back: 'Cevap 2',
        source: null,
        due: '2026-01-01T00:00:00Z',
        interval: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]
    const attempts: QuizAttempt[] = [
      {
        id: 'a1',
        courseId: 'c1',
        noteId: 'n1',
        score: 4,
        total: 5,
        wrongIds: ['q2'],
        createdAt: '2026-01-01T01:00:00Z',
      },
    ]

    const progress = computeNoteProgress(note, cards, attempts)
    expect(progress.steps[0].done).toBe(true) // tanis
    expect(progress.steps[1].done).toBe(true) // anla
    expect(progress.steps[2].done).toBe(true) // pekistir (1/2 studied)
    expect(progress.steps[3].done).toBe(true) // sina (4/5 = 80%)
    expect(progress.steps[4].done).toBe(false) // anlat
    expect(progress.currentStep.id).toBe('anlat')
    expect(progress.percent).toBe(80)
  })

  it('marks the whole note as 100% completed when all 5 steps are done', () => {
    const summary = makeSummary({
      completedSteps: ['tanis', 'anla', 'pekistir', 'sina', 'anlat'],
    })
    const progress = computeNoteProgress(makeNote({ summary }), [], [])
    expect(progress.isCompleted).toBe(true)
    expect(progress.percent).toBe(100)
    expect(progress.completedCount).toBe(5)
  })

  it('computes topic mastery from quiz and card performance independently of step completion', () => {
    const summary = makeSummary({
      completedSteps: ['tanis', 'anla', 'pekistir', 'sina', 'anlat'],
    })
    const note = makeNote({ summary })

    // Even if all 5 steps were clicked through, mastery is unassessed until a quiz or card review happens
    const unassessed = computeTopicMastery(note, [], [])
    expect(unassessed.assessed).toBe(false)
    expect(unassessed.percent).toBe(0)

    const cards: Card[] = [
      {
        id: 'card1',
        courseId: 'c1',
        noteId: 'n1',
        front: 'Soru 1',
        back: 'Cevap 1',
        source: null,
        due: '2026-01-10T00:00:00Z',
        interval: 8,
        ease: 2.5,
        reps: 3,
        lapses: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'card2',
        courseId: 'c1',
        noteId: 'n1',
        front: 'Soru 2',
        back: 'Cevap 2',
        source: null,
        due: '2026-01-01T00:00:00Z',
        interval: 0,
        ease: 2.5,
        reps: 0,
        lapses: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]
    const attempts: QuizAttempt[] = [
      {
        id: 'a1',
        courseId: 'c1',
        noteId: 'n1',
        score: 3,
        total: 5,
        wrongIds: ['q1', 'q2'],
        createdAt: '2026-01-01T01:00:00Z',
      },
    ]

    const mastery = computeTopicMastery(note, cards, attempts)
    expect(mastery.assessed).toBe(true)
    expect(mastery.quizPercent).toBe(60)
    expect(mastery.cardPercent).toBe(60)
    expect(mastery.percent).toBe(60)
  })
})

