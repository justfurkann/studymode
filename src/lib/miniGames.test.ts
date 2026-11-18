import { describe, expect, it } from 'vitest'
import {
  bestLevel,
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
