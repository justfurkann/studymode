import { describe, expect, it } from 'vitest'
import { buildSmartStudyPlan } from './studyPlan'
import type { StudyData } from './types'

describe('buildSmartStudyPlan', () => {
  it('prioritizes notes for upcoming exams and low mastery topics', () => {
    const now = new Date('2026-05-10T10:00:00Z')
    const data: StudyData = {
      courses: [
        { id: 'c1', name: 'Biyoloji', examDate: '2026-05-18', color: '#5b5bd6', createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
        { id: 'c2', name: 'Tarih', examDate: null, color: '#2ea043', createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
      ],
      notes: [
        {
          id: 'n1',
          courseId: 'c1',
          title: 'Hücre Bölünmesi',
          content: 'Mitoz ve mayoz...',
          summary: { overview: 'Özet', points: ['Madde 1'], keyTerms: [], completedSteps: ['tanis', 'anla', 'pekistir', 'sina', 'anlat'] },
          questions: [],
          practice: [],
          generator: 'ai',
          createdAt: '2026-05-02T00:00:00Z',
          updatedAt: '2026-05-02T00:00:00Z',
        },
        {
          id: 'n2',
          courseId: 'c1',
          title: 'Solunum Sistemi',
          content: 'Oksijenli solunum...',
          summary: { overview: 'Özet', points: ['Madde 1'], keyTerms: [] },
          questions: [],
          practice: [],
          generator: 'ai',
          createdAt: '2026-05-03T00:00:00Z',
          updatedAt: '2026-05-03T00:00:00Z',
        },
      ],
      cards: [],
      attempts: [
        {
          id: 'a1',
          courseId: 'c1',
          noteId: 'n1',
          score: 2,
          total: 5,
          wrongIds: ['q1', 'q2', 'q3'],
          createdAt: '2026-05-05T00:00:00Z',
        },
      ],
      exams: [],
      studyDays: [],
    }

    const plan = buildSmartStudyPlan(data, now, 2)
    expect(plan.headline).toContain('Biyoloji sınavına 8 gün kaldı — bugün şu 2 konuyu çalış')
    expect(plan.items).toHaveLength(2)
    expect(plan.items[0].note.id).toBe('n1')
    expect(plan.items[0].reason).toContain('Konu hâkimiyeti düşük (%40)')
    expect(plan.items[1].note.id).toBe('n2')
    expect(plan.items[1].reason).toContain('Henüz çalışmaya başlanmadı')
  })
})
