import { describe, expect, it } from 'vitest'
import {
  BIN,
  bestLevel,
  canMerge,
  dailyParagraph,
  drawerStuck,
  HIGHLIGHT_PARAGRAPHS,
  launchFromFlick,
  mergeItems,
  newDrawer,
  parseParagraph,
  scoreHighlight,
  simulateThrow,
  spawnItem,
  tossPoints,
  type Drawer,
} from './miniGames'

/** Steps through a fixed list of numbers, so "random" is the same every run. */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('Fosforla altını çiz', () => {
  it('splits a paragraph into words and key phrases, punctuation kept apart', () => {
    const tokens = parseParagraph('Ahtapotların tam [üç kalbi] vardır. Kanları [mavidir], çünkü.')
    expect(tokens.map((t) => [t.text, t.after, t.key])).toEqual([
      ['Ahtapotların', '', false],
      ['tam', '', false],
      ['üç kalbi', '', true],
      ['vardır', '.', false],
      ['Kanları', '', false],
      ['mavidir', ',', true],
      ['çünkü', '.', false],
    ])
  })

  it('every paragraph has a few key phrases and reads back as written', () => {
    for (const p of HIGHLIGHT_PARAGRAPHS) {
      const tokens = parseParagraph(p.text)
      const keys = tokens.filter((t) => t.key).length
      expect(keys, p.id).toBeGreaterThanOrEqual(3)
      expect(tokens.map((t) => t.text + t.after).join(' '), p.id).toBe(p.text.replace(/[[\]]/g, ''))
    }
    expect(new Set(HIGHLIGHT_PARAGRAPHS.map((p) => p.id)).size).toBe(HIGHLIGHT_PARAGRAPHS.length)
  })

  it('scores hits, takes points for extra words, never below zero', () => {
    const tokens = parseParagraph('a [b] c [d] e [f]')
    const keys = tokens.filter((t) => t.key).map((t) => t.index)
    expect(scoreHighlight(tokens, new Set(keys))).toMatchObject({ hits: 3, wrong: 0, missed: 0, points: 30, stars: 3 })
    expect(scoreHighlight(tokens, new Set([keys[0], 0]))).toMatchObject({ hits: 1, wrong: 1, missed: 2, points: 5, stars: 0 })
    expect(scoreHighlight(tokens, new Set(tokens.map((t) => t.index)))).toMatchObject({ points: 15, stars: 1 })
    expect(scoreHighlight(tokens, new Set([0, 2, 4]))).toMatchObject({ points: 0 })
  })

  it('gives everyone the same paragraph for the whole Istanbul day, and a new one the next day', () => {
    const morning = Date.UTC(2026, 10, 18, 5, 0) // 08:00 in Istanbul
    const lateNight = Date.UTC(2026, 10, 18, 20, 30) // 23:30
    const nextDay = Date.UTC(2026, 10, 18, 21, 30) // 00:30 the next day
    expect(dailyParagraph(morning).id).toBe(dailyParagraph(lateNight).id)
    expect(dailyParagraph(nextDay).id).not.toBe(dailyParagraph(lateNight).id)
  })
})

describe('Kâğıt top', () => {
  it('a good throw goes in when there is no wind, and the same throw misses in a strong wind', () => {
    let good: { vx: number; vy: number } | null = null
    for (let vy = -500; vy >= -1000 && !good; vy -= 10) {
      for (let vx = 60; vx <= 400 && !good; vx += 5) if (simulateThrow(vx, vy, 0) === 'in') good = { vx, vy }
    }
    expect(good).not.toBeNull()
    expect(simulateThrow(good!.vx, good!.vy, -160)).toBe('out')
  })

  it('a throw that is far too short or too long misses', () => {
    expect(simulateThrow(40, -500, 0)).toBe('out')
    expect(simulateThrow(800, -900, 0)).toBe('out')
  })

  it('a quick upward flick launches; a slow drag or a downward one does not', () => {
    expect(launchFromFlick(60, -160, 100)).not.toBeNull()
    expect(launchFromFlick(10, -20, 400)).toBeNull()
    expect(launchFromFlick(60, 50, 80)).toBeNull()
    const capped = launchFromFlick(500, -2000, 50)!
    expect(Math.hypot(capped.vx, capped.vy)).toBeCloseTo(1150, 0)
  })

  it('the bin sits inside the scene', () => {
    expect(BIN.left).toBeLessThan(BIN.right)
    expect(BIN.rim).toBeLessThan(BIN.bottom)
  })

  it('three in a row and more count double', () => {
    expect(tossPoints(['in', 'in', 'in', 'in', 'out', 'in'])).toBe(1 + 1 + 2 + 2 + 1)
  })
})

describe('Çekmece', () => {
  it('starts with four pencils or pens on a 4x4 board', () => {
    const grid = newDrawer(seq(0.1, 0.5, 0.3, 0.9, 0.7, 0.2, 0.05, 0.6))
    expect(grid).toHaveLength(16)
    expect(grid.filter((v) => v !== null)).toHaveLength(4)
    expect(grid.every((v) => v === null || v === 1 || v === 2)).toBe(true)
  })

  it('two equal items become the next one and free a cell', () => {
    const grid: Drawer = [1, 1, 2, null, ...Array(12).fill(null)]
    expect(canMerge(grid, 0, 2)).toBe(false)
    const merged = mergeItems(grid, 0, 1)!
    expect(merged.grid.slice(0, 3)).toEqual([null, 2, 2])
    expect(merged.points).toBe(4)
    expect(mergeItems(merged.grid, 1, 2)!.level).toBe(3)
  })

  it('a diploma does not merge any further', () => {
    const grid: Drawer = [8, 8, ...Array(14).fill(null)]
    expect(canMerge(grid, 0, 1)).toBe(false)
    expect(bestLevel(grid)).toBe(8)
  })

  it('is stuck only when full with no equal pair', () => {
    const full: Drawer = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8]
    expect(drawerStuck(full)).toBe(false)
    const noPairs: Drawer = [1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8]
    expect(drawerStuck(noPairs)).toBe(true)
    expect(drawerStuck([null, ...noPairs.slice(1)])).toBe(false)
  })

  it('a new item lands in an empty cell', () => {
    const grid: Drawer = [1, 1, 1, null, ...Array(12).fill(1)]
    expect(spawnItem(grid, seq(0.5, 0.9))[3]).toBe(1)
  })
})
