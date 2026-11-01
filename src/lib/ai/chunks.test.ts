import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: null }))

import * as ai from './index'

const set = (n: number) => ({
  summary: { overview: `Bölüm ${n}`, points: [`Nokta ${n}`], keyTerms: [] },
  cards: [{ front: `Soru ${n}?`, back: 'Cevap', source: '' }],
  questions: [],
  practice: [],
})

describe('generateStudySet with long notes', () => {
  const long = Array.from({ length: 3 }, (_, i) => `Bölüm ${i}\n\n${'a'.repeat(15_000)}`).join('\n\n')
  const settings = { provider: 'google', keys: { google: 'k', anthropic: '', openai: '' }, models: { google: 'm', anthropic: '', openai: '' }, theme: 'system' } as never

  it('retries a failed chunk once and keeps the others when it still fails', async () => {
    const calls: number[] = []
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const text = JSON.parse(init.body as string).contents[0].parts[0].text as string
      const chunk = Number(text.match(/Bölüm (\d)\/3/)?.[1])
      calls.push(chunk)
      if (chunk === 2) return new Response('busy', { status: 400 })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(set(chunk)) }] } }] }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const progress: string[] = []
    const result = await ai.generateStudySet(long, 'Not', settings, (d, t) => progress.push(`${d}/${t}`), async () => undefined)
    expect(calls.filter((c) => c === 2)).toHaveLength(2) // first try + one retry
    expect(result.failedChunks).toBe(1)
    expect(result.totalChunks).toBe(3)
    expect(result.cards.map((c) => c.front)).toEqual(['Soru 1?', 'Soru 3?'])
    expect(progress).toEqual(['0/3', '1/3', '2/3', '3/3'])
    expect(ai.partialChunkMessage(result)).toMatch(/3 bölümünden 1 tanesi işlenemedi/)
    vi.unstubAllGlobals()
  })

  it('reports the real error when every chunk fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })))
    await expect(ai.generateStudySet(long, 'Not', settings, undefined, async () => undefined)).rejects.toThrow(/anahtar/)
    vi.unstubAllGlobals()
  })

  it('splits a 30-question exam into 3 parallel batches of 10 questions and merges them without timeout', async () => {
    const examInput: ai.ExamInput = {
      courseName: 'Hücre Biyolojisi',
      notes: [{ title: 'Organeller', text: 'Mitokondri enerji üretir.\n\n'.repeat(400) }],
      format: 'test',
      count: 30,
      difficulty: 'medium',
      pastQuestions: '',
      mcqCount: 30,
      openCount: 0,
      blankCount: 0,
      distractorCount: 0,
      examInfo: '',
    }

    const batches = ai.splitExamIntoBatches(examInput)
    expect(batches).toHaveLength(3)
    expect(batches.map((b) => b.mcqCount)).toEqual([10, 10, 10])
    expect(batches.map((b) => b.count)).toEqual([10, 10, 10])

    let callIdx = 0
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      callIdx += 1
      const text = JSON.parse(init.body as string).contents[0].parts[0].text as string
      const partNum = Number(text.match(/Sınav Bölümü (\d)\/3/)?.[1] ?? callIdx)
      const questions = Array.from({ length: 10 }, (_, qIdx) => ({
        type: 'mcq',
        prompt: `Bölüm ${partNum} Soru ${qIdx + 1}?`,
        options: ['A', 'B', 'C', 'D'],
        answerIndex: 0,
        explanation: 'Açıklama',
        modelAnswer: '',
        source: 'Mitokondri',
      }))
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ questions, distractors: [] }) }] } }] }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const progress: string[] = []
    const raw = await ai.generateExam(examInput, settings, (d, t) => progress.push(`${d}/${t}`))
    expect(raw.questions).toHaveLength(30)
    expect(progress[0]).toBe('0/3')
    expect(progress[progress.length - 1]).toBe('3/3')
    vi.unstubAllGlobals()
  })
})

