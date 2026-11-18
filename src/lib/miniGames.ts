/**
 * Mini games for the break page (admins only while they are tried out): the logic, kept apart
 * from the screens so it can be tested.
 *
 * - Günün Kavramı (its own file, wordGame.ts): a daily study-term puzzle.
 * - Kâğıt top: flick crumpled paper into the bin, with wind.
 * - Çekmece: put two identical items together and they become the next one, up to a diploma.
 */

/** Day number in Istanbul time, so everyone in Turkey gets the same daily puzzle on the same day. */
export function istanbulDay(now = Date.now()): number {
  return Math.floor((now + 3 * 3600_000) / 86_400_000)
}

// ---------- Çekmece (birleştirme) ----------

export const DRAWER_SIZE = 4
export const DRAWER_SECONDS = 120

/** An academic career, from a pencil to a professorship. */
export const DRAWER_ITEMS = ['Kurşun kalem', 'Tükenmez kalem', 'Fosforlu kalem', 'Defter', 'Kitap', 'Ders notu', 'Mezuniyet kepi', 'Diploma', 'Yüksek lisans', 'Doktora', 'Profesörlük'] as const
export const DRAWER_MAX = DRAWER_ITEMS.length

/** Cells hold an item level (1-11) or null. */
export type Drawer = Array<number | null>

export function emptyCells(grid: Drawer): number[] {
  return grid.flatMap((v, i) => (v === null ? [i] : []))
}

/**
 * Puts one new item in a random empty cell: mostly the `base` item (a pencil at first), sometimes
 * the one after it. Later chapters drop better items, so a professorship is reachable in minutes.
 */
export function spawnItem(grid: Drawer, rand = Math.random, base = 1): Drawer {
  const free = emptyCells(grid)
  if (!free.length) return grid
  const next = [...grid]
  next[free[Math.floor(rand() * free.length)]] = rand() < 0.12 ? base + 1 : base
  return next
}

export function newDrawer(rand = Math.random, base = 1): Drawer {
  let grid: Drawer = Array(DRAWER_SIZE * DRAWER_SIZE).fill(null)
  for (let i = 0; i < 4; i += 1) grid = spawnItem(grid, rand, base)
  return grid
}

export function canMerge(grid: Drawer, from: number, to: number): boolean {
  return from !== to && grid[from] !== null && grid[from] === grid[to] && (grid[from] as number) < DRAWER_MAX
}

/** Moves `from` onto `to`: two equal items become the next one. Returns the points earned. */
export function mergeItems(grid: Drawer, from: number, to: number): { grid: Drawer; points: number; level: number } | null {
  if (!canMerge(grid, from, to)) return null
  const level = (grid[to] as number) + 1
  const next = [...grid]
  next[from] = null
  next[to] = level
  return { grid: next, points: 2 ** level, level }
}

/** Full and nothing left to put together: the round is over. */
export function drawerStuck(grid: Drawer): boolean {
  if (emptyCells(grid).length) return false
  const seen = new Set<number>()
  for (const v of grid) {
    if (v === null || v >= DRAWER_MAX) continue
    if (seen.has(v)) return false
    seen.add(v)
  }
  return true
}

/** One pair that can be put together right now (for a hint), or null. */
export function findPair(grid: Drawer): [number, number] | null {
  const first = new Map<number, number>()
  for (let i = 0; i < grid.length; i += 1) {
    const v = grid[i]
    if (v === null || v >= DRAWER_MAX) continue
    const j = first.get(v)
    if (j !== undefined) return [j, i]
    first.set(v, i)
  }
  return null
}

/** How many pairs could be made now (each item counted once). */
export function pairCount(grid: Drawer): number {
  const counts = new Map<number, number>()
  for (const v of grid) if (v !== null && v < DRAWER_MAX) counts.set(v, (counts.get(v) ?? 0) + 1)
  let n = 0
  for (const c of counts.values()) n += Math.floor(c / 2)
  return n
}

export function bestLevel(grid: Drawer): number {
  return grid.reduce<number>((m, v) => (v !== null && v > m ? v : m), 0)
}

// ---------- Çekmece bölümleri (chapters) ----------
//
// Ten chapters, one per target item, from Tükenmez kalem to Profesörlük, each with a time limit.
// From chapter 7 the drawer drops better items (`base`), so the last chapters stay a few minutes
// long. Times were sized with a simple bot (see miniGames.test.ts): chapters 6-10 take about 81
// moves each; a person needs roughly 1.5 s a move, and the limits get shorter towards the end.

export interface Chapter {
  /** Item level to reach (2 = Tükenmez kalem … 11 = Profesörlük). */
  target: number
  seconds: number
  /** The item that drops into the drawer (1 = Kurşun kalem). */
  base: number
}

export const CHAPTERS: Chapter[] = [
  { target: 2, seconds: 20, base: 1 },
  { target: 3, seconds: 30, base: 1 },
  { target: 4, seconds: 40, base: 1 },
  { target: 5, seconds: 60, base: 1 },
  { target: 6, seconds: 100, base: 1 },
  { target: 7, seconds: 200, base: 1 },
  { target: 8, seconds: 190, base: 2 },
  { target: 9, seconds: 180, base: 3 },
  { target: 10, seconds: 170, base: 4 },
  { target: 11, seconds: 160, base: 5 },
]

/** 3 stars with at least 40% of the time left, 2 with 20%, otherwise 1. */
export function chapterStars(leftMs: number, totalMs: number): number {
  const share = totalMs > 0 ? leftMs / totalMs : 0
  return share >= 0.4 ? 3 : share >= 0.2 ? 2 : 1
}

const CHAPTERS_KEY = 'studymode.cekmece.v1'

export interface DrawerProgress {
  /** Best stars per chapter (0 = not finished yet). The first chapter with 0 is the open one. */
  stars: number[]
}

export function readDrawerProgress(): DrawerProgress {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAPTERS_KEY) ?? '{}') as Partial<DrawerProgress>
    const stars = CHAPTERS.map((_, i) => Math.max(0, Math.min(3, Number(raw.stars?.[i]) || 0)))
    return { stars }
  } catch {
    return { stars: CHAPTERS.map(() => 0) }
  }
}

/** Chapters up to and including the first unfinished one can be played. */
export function chapterOpen(progress: DrawerProgress, index: number): boolean {
  return index === 0 || progress.stars[index - 1] > 0
}

/** Keeps the best stars for a chapter. */
export function saveChapterResult(index: number, stars: number): DrawerProgress {
  const progress = readDrawerProgress()
  progress.stars[index] = Math.max(progress.stars[index], stars)
  try {
    localStorage.setItem(CHAPTERS_KEY, JSON.stringify(progress))
  } catch {
    // Blocked storage: progress lasts for this visit only.
  }
  return progress
}

// ---------- Records (this device) ----------

const RECORDS_KEY = 'studymode.miniGames'

export interface MiniRecords {
  drawer?: number
  drawerLevel?: number
}

export function readMiniRecords(): MiniRecords {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    return raw ? (JSON.parse(raw) as MiniRecords) : {}
  } catch {
    return {}
  }
}

export function saveMiniRecords(patch: Partial<MiniRecords>): MiniRecords {
  const next = { ...readMiniRecords(), ...patch }
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(next))
  } catch {
    // Blocked storage: records last for this visit only.
  }
  return next
}
