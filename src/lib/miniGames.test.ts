import { describe, expect, it } from 'vitest'
import {
  bestLevel,
  binForThrow,
  binPoints,
  binX,
  canMerge,
  drawerStuck,
  findPair,
  pairCount,
  flickLaunch,
  mergeItems,
  newDrawer,
  aimFromPull,
  powerFromPull,
  powerFromSwipe,
  project,
  randomWind,
  simulateFlick,
  spawnItem,
  trajectoryPreview,
  type Bin,
  type Drawer,
} from './miniGames'

/** Steps through a fixed list of numbers, so "random" is the same every run. */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('Kâğıt top (fiske)', () => {
  const still = (x: number, z: number): Bin => ({ x, z, sway: 0, speed: 0, phase: 0 })
  /** Searches power and aim for a throw that goes in. */
  const findHit = (bin: Bin, wind = 0) => {
    for (let p = 0; p <= 1; p += 0.01) for (let a = -1; a <= 1; a += 0.02) if (simulateFlick(p, a, bin, wind) === 'in') return { p, a }
    return null
  }

  it('every bin the game can place can be hit with some power and aim, also with wind', () => {
    for (let i = 0; i < 10; i += 1) {
      const bin = binForThrow(i, () => 0.99)
      expect(findHit(bin), `throw ${i}`).not.toBeNull()
      expect(findHit(binForThrow(i, () => 0.01), 1.4), `throw ${i} far left, wind`).not.toBeNull()
    }
  })

  it('a straight throw at a bin straight ahead needs the right power: too weak or too strong misses', () => {
    const bin = still(0, 3)
    const hit = findHit(bin)!
    expect(Math.abs(hit.a)).toBeLessThan(0.1)
    expect(simulateFlick(0, 0, bin)).toBe('out')
    expect(simulateFlick(1, 0, bin)).toBe('out')
  })

  it('aiming left sends the paper left, and wind pushes it sideways', () => {
    expect(flickLaunch(0.5, -1).vx).toBeLessThan(0)
    expect(flickLaunch(0.5, 1).vx).toBeGreaterThan(0)
    const bin = still(0, 3)
    const hit = findHit(bin)!
    expect(simulateFlick(hit.p, hit.a, bin, 1.4)).toBe('out')
  })

  it('things further away are drawn smaller and higher up the screen', () => {
    const near = project({ x: 0, y: 0, z: 2 })
    const far = project({ x: 0, y: 0, z: 5 })
    expect(far.scale).toBeLessThan(near.scale)
    expect(far.y).toBeLessThan(near.y)
  })

  it('bins start close and still, get further, and sway at the end; far and moving bins score more', () => {
    const first = binForThrow(0, () => 0.5)
    const last = binForThrow(9, () => 0.5)
    expect(first.sway).toBe(0)
    expect(first.z).toBeLessThanOrEqual(3)
    expect(last.sway).toBeGreaterThan(0)
    expect(binX(last, 0)).not.toBe(binX(last, 0.8))
    expect(binPoints(first)).toBe(1)
    expect(binPoints({ ...last, z: 4.5 })).toBe(3)
  })

  it('pulling down sets the power, sideways the aim; the first throw has no wind', () => {
    expect(powerFromPull(-40)).toBe(0)
    expect(powerFromPull(85)).toBeCloseTo(0.5)
    expect(powerFromPull(999)).toBe(1)
    expect(powerFromSwipe(-85)).toBeCloseTo(0.5)
    expect(powerFromSwipe(40)).toBe(0)
    expect(aimFromPull(-70)).toBeCloseTo(-0.5)
    expect(aimFromPull(500)).toBe(1)
    expect(randomWind(0, () => 0.99)).toBe(0)
    const arc = trajectoryPreview(0.6, 0.5, 0.8)
    expect(arc.length).toBeGreaterThan(4)
    expect(arc[0].z).toBeGreaterThan(-0.2)
    expect(arc[1].x).toBeGreaterThan(arc[0].x)
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
