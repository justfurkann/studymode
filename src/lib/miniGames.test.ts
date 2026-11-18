import { describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
})
import {
  bestLevel,
  chapterOpen,
  CHAPTERS,
  chapterStars,
  readDrawerProgress,
  saveChapterResult,
  canMerge,
  drawerStuck,
  findPair,
  pairCount,
  mergeItems,
  newDrawer,
  spawnItem,
  type Drawer,
} from './miniGames'

/** Steps through a fixed list of numbers, so "random" is the same every run. */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

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

  it('finds a pair to hint at and counts the pairs on the board', () => {
    const grid: Drawer = [1, 2, null, 1, 2, 2, 8, 8, ...Array(8).fill(null)]
    expect(findPair(grid)).toEqual([0, 3])
    // Two 1s make one pair, three 2s make one pair, diplomas do not merge.
    expect(pairCount(grid)).toBe(2)
    expect(findPair([1, 2, 3, 8, 8, ...Array(11).fill(null)])).toBeNull()
  })

  it('a new item lands in an empty cell', () => {
    const grid: Drawer = [1, 1, 1, null, ...Array(12).fill(1)]
    expect(spawnItem(grid, seq(0.5, 0.9))[3]).toBe(1)
  })
})

describe('Çekmece bölümleri', () => {
  /** Steps through a fixed seed, so "random" is the same every run. */
  const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  /** A plain player: put the lowest pair together, otherwise drop a new item. Moves to the target, or -1. */
  const bot = (target: number, seed: number) => {
    const rand = rng(seed)
    let grid = newDrawer(rand)
    for (let moves = 1; moves <= 1000; moves += 1) {
      let pair: [number, number] | null = null
      for (let lv = 1; lv < 8 && !pair; lv += 1) {
        const at = grid.flatMap((v, i) => (v === lv ? [i] : []))
        if (at.length >= 2) pair = [at[0], at[1]]
      }
      if (pair) grid = mergeItems(grid, pair[0], pair[1])!.grid
      grid = spawnItem(grid, rand)
      if (bestLevel(grid) >= target) return moves
      if (drawerStuck(grid)) return -1
    }
    return -1
  }

  it('every chapter can be finished in time at about 1.5 s a move, and gets harder', () => {
    for (const [i, ch] of CHAPTERS.entries()) {
      const runs = Array.from({ length: 60 }, (_, s) => bot(ch.target, s + 1))
      expect(runs.every((m) => m > 0), `chapter ${i + 1}`).toBe(true)
      const median = [...runs].sort((a, b) => a - b)[30]
      expect(median * 1.5, `chapter ${i + 1}`).toBeLessThan(ch.seconds)
    }
    for (let i = 1; i < CHAPTERS.length; i += 1) {
      const a = CHAPTERS[i - 1]
      const b = CHAPTERS[i]
      expect(b.target > a.target || (b.target === a.target && b.seconds < a.seconds), `chapter ${i + 1}`).toBe(true)
    }
    expect(CHAPTERS.at(-1)!.target).toBe(8)
  })

  it('stars come from the time left', () => {
    expect(chapterStars(30_000, 60_000)).toBe(3)
    expect(chapterStars(20_000, 60_000)).toBe(2)
    expect(chapterStars(1_000, 60_000)).toBe(1)
  })

  it('finishing a chapter opens the next one and keeps the best stars', () => {
    memory.clear()
    expect(chapterOpen(readDrawerProgress(), 0)).toBe(true)
    expect(chapterOpen(readDrawerProgress(), 1)).toBe(false)
    saveChapterResult(0, 2)
    expect(chapterOpen(readDrawerProgress(), 1)).toBe(true)
    saveChapterResult(0, 1)
    expect(readDrawerProgress().stars[0]).toBe(2)
    saveChapterResult(0, 3)
    expect(readDrawerProgress().stars[0]).toBe(3)
  })
})
