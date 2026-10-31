import { beforeEach, describe, expect, it } from 'vitest'
import type { Card } from './types'
import {
  addFocusMinutes,
  buildMatchBoard,
  cardsInScope,
  clip,
  distinctCards,
  elapsedMinutes,
  focusLastWeek,
  formatClock,
  formatSeconds,
  isFinished,
  matchPick,
  matchTime,
  nextQuickItem,
  parseRecords,
  parseTimer,
  tileFront,
  pauseTimer,
  quickPoints,
  readRecords,
  remainingMs,
  resumeTimer,
  saveMatchTime,
  saveQuickScore,
  startTimer,
} from './mola'

function card(id: string, front: string, back: string, courseId = 'c1'): Card {
  return { id, courseId, noteId: null, front, back, source: null, due: '', interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: '', updatedAt: '' }
}

/** Deterministic random numbers for repeatable tests. */
function seeded(seed = 7) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const deck = [
  card('a', 'Mitokondri', 'Enerji üretir'),
  card('b', 'Ribozom', 'Protein sentezler'),
  card('c', 'Lizozom', 'Hücre içi sindirim'),
  card('d', 'Çekirdek', 'Kalıtsal bilgiyi taşır'),
  card('e', 'Hücre zarı', 'Seçici geçirgendir'),
  card('f', 'Golgi', 'Paketler ve salgılar'),
  card('g', 'Koful', 'Depolar', 'c2'),
]

describe('distinct cards', () => {
  it('drops cards whose front or back repeats, and empty ones', () => {
    const cards = [card('1', 'A', 'x'), card('2', 'a ', 'y'), card('3', 'B', 'X'), card('4', 'C', ''), card('5', 'D', 'z')]
    expect(distinctCards(cards).map((c) => c.id)).toEqual(['1', '5'])
  })

  it('limits to one course when asked', () => {
    expect(cardsInScope(deck, 'c2').map((c) => c.id)).toEqual(['g'])
    expect(cardsInScope(deck, null)).toHaveLength(7)
  })

  it('clips long text at a word boundary', () => {
    expect(clip('kısa')).toBe('kısa')
    const long = clip('bir iki üç dört beş altı yedi sekiz dokuz on', 20)
    expect(long.length).toBeLessThanOrEqual(20)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('match game', () => {
  it('lays out six pairs, both sides of every card', () => {
    const tiles = buildMatchBoard(deck, seeded())
    expect(tiles).toHaveLength(12)
    const ids = new Set(tiles.map((t) => t.cardId))
    expect(ids.size).toBe(6)
    for (const id of ids) expect(tiles.filter((t) => t.cardId === id).map((t) => t.side).sort()).toEqual(['back', 'front'])
  })

  it('prefers short answers that fit a tile', () => {
    const long = card('z', 'Uzun', 'x'.repeat(200))
    const tiles = buildMatchBoard([long, ...deck.slice(0, 6)], seeded())
    expect(tiles.some((t) => t.cardId === 'z')).toBe(false)
  })

  it('needs at least three pairs', () => {
    expect(buildMatchBoard(deck.slice(0, 2))).toEqual([])
    expect(buildMatchBoard(deck.slice(0, 3))).toHaveLength(6)
  })

  it('shows only the term of "X ne anlama gelir?" fronts on a tile', () => {
    expect(tileFront('“Öğrenme” ne anlama gelir?')).toBe('Öğrenme')
    expect(tileFront('Mitokondri nedir?')).toBe('Mitokondri')
    expect(tileFront('"Geri bildirim" ne demektir')).toBe('Geri bildirim')
    expect(tileFront('Hücre zarı neden seçici geçirgendir?')).toBe('Hücre zarı neden seçici geçirgendir?')
  })

  it('tells a match from a miss', () => {
    const [f, b] = [
      { id: 'a:f', cardId: 'a', side: 'front' as const, text: '' },
      { id: 'a:b', cardId: 'a', side: 'back' as const, text: '' },
    ]
    const other = { id: 'b:b', cardId: 'b', side: 'back' as const, text: '' }
    expect(matchPick(null, f)).toBe('select')
    expect(matchPick(f, f)).toBe('select')
    expect(matchPick(b, other)).toBe('select')
    expect(matchPick(f, b)).toBe('match')
    expect(matchPick(f, other)).toBe('miss')
  })

  it('adds two seconds per miss and formats the time', () => {
    expect(matchTime(30_400, 2)).toBe(34_400)
    expect(formatSeconds(34_400)).toBe('34,4 sn')
    expect(formatSeconds(65_000)).toBe('1 dk 05 sn')
  })
})

describe('quick round', () => {
  it('shows either the real answer or another card answer', () => {
    const rng = seeded(3)
    let truths = 0
    for (let i = 0; i < 200; i++) {
      const item = nextQuickItem(deck, rng)!
      const real = deck.find((c) => c.id === item.cardId)!
      expect(item.prompt).toBe(real.front)
      expect(item.answer).toBe(real.back)
      if (item.correct) {
        truths++
        expect(item.shown).toBe(real.back)
      } else {
        expect(item.shown).not.toBe(real.back)
        expect(deck.some((c) => c.back === item.shown)).toBe(true)
      }
    }
    expect(truths).toBeGreaterThan(60)
    expect(truths).toBeLessThan(140)
  })

  it('does not ask the same card twice in a row', () => {
    const rng = seeded(11)
    let prev: string | undefined
    for (let i = 0; i < 50; i++) {
      const item = nextQuickItem(deck.slice(0, 3), rng, prev)!
      expect(item.cardId).not.toBe(prev)
      prev = item.cardId
    }
  })

  it('needs two different cards', () => {
    expect(nextQuickItem(deck.slice(0, 1))).toBeNull()
  })

  it('doubles points from the third right answer in a row', () => {
    expect([0, 1, 2, 5].map(quickPoints)).toEqual([1, 1, 2, 2])
  })
})

describe('records on this device', () => {
  beforeEach(() => {
    // Unit tests run in Node; a tiny in-memory stand-in for the browser's storage.
    const data = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
      key: () => null,
      get length() { return data.size },
    } as Storage
  })

  it('keeps the fastest match and the highest score per course', () => {
    expect(saveMatchTime(null, 40_000)).toBe(true)
    expect(saveMatchTime(null, 45_000)).toBe(false)
    expect(saveMatchTime(null, 31_000)).toBe(true)
    expect(saveMatchTime('c1', 50_000)).toBe(true)
    expect(saveQuickScore(null, 0)).toBe(false)
    expect(saveQuickScore(null, 12)).toBe(true)
    expect(saveQuickScore(null, 9)).toBe(false)
    expect(readRecords()).toEqual({ match: { all: 31_000, c1: 50_000 }, quick: { all: 12 }, focus: {} })
  })

  it('ignores broken stored data', () => {
    expect(parseRecords('{oops')).toEqual({ match: {}, quick: {}, focus: {} })
    expect(parseRecords('{"match":{"all":"x","c1":-3,"c2":20},"focus":null}')).toEqual({ match: { c2: 20 }, quick: {}, focus: {} })
  })

  it('adds focus minutes per day and sums the last seven days', () => {
    const now = new Date(2026, 9, 31, 12)
    addFocusMinutes(25, now)
    addFocusMinutes(10, now)
    addFocusMinutes(50, new Date(2026, 9, 25, 9))
    addFocusMinutes(25, new Date(2026, 9, 24, 9))
    addFocusMinutes(0, now)
    const { focus } = readRecords()
    expect(focus['2026-10-31']).toBe(35)
    expect(focusLastWeek(focus, now)).toBe(85)
  })
})

describe('focus timer', () => {
  const t0 = 1_000_000

  it('counts down, pauses and resumes', () => {
    const timer = startTimer(25, t0)
    expect(remainingMs(timer, t0 + 60_000)).toBe(24 * 60_000)
    expect(elapsedMinutes(timer, t0 + 150_000)).toBe(2)
    const paused = pauseTimer(timer, t0 + 600_000)
    expect(paused.endsAt).toBeNull()
    expect(remainingMs(paused, t0 + 9_999_999)).toBe(15 * 60_000)
    const resumed = resumeTimer(paused, t0 + 2_000_000)
    expect(remainingMs(resumed, t0 + 2_000_000 + 60_000)).toBe(14 * 60_000)
    expect(isFinished(resumed, t0 + 2_000_000 + 15 * 60_000)).toBe(true)
    expect(elapsedMinutes(resumed, t0 + 99_999_999)).toBe(25)
  })

  it('formats the clock', () => {
    expect(formatClock(25 * 60_000)).toBe('25:00')
    expect(formatClock(61_500)).toBe('01:02')
    expect(formatClock(0)).toBe('00:00')
  })

  it('reads back only a valid stored timer', () => {
    expect(parseTimer(JSON.stringify(startTimer(50, t0)))).toEqual({ minutes: 50, endsAt: t0 + 50 * 60_000, remainingMs: null })
    expect(parseTimer(JSON.stringify({ minutes: 25, endsAt: null, remainingMs: 99 * 60_000 }))).toEqual({ minutes: 25, endsAt: null, remainingMs: 25 * 60_000 })
    expect(parseTimer('{"minutes":0,"endsAt":5}')).toBeNull()
    expect(parseTimer('{"minutes":25,"endsAt":null,"remainingMs":null}')).toBeNull()
    expect(parseTimer('nope')).toBeNull()
  })
})
