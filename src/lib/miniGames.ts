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

// ---------- Kâğıt top (fiske) ----------
//
// First person: a hand at the bottom flicks a paper ball at a bin on the floor ahead. The world is
// in metres: x to the right, y up, z away from the player; it is drawn with a simple perspective.

export const TOSS_THROWS = 10
export const SCENE_W = 360
export const SCENE_H = 560
const GRAVITY = 9.8
/** Camera: where the eye is, and how strongly things shrink with distance. */
const CAM = { y: 1.6, z: -0.8, focal: 300, horizon: 110 }
export const PAPER_R = 0.06
export const PAPER_START = { x: 0, y: 1.0, z: -0.2 }
export const BIN_R = 0.2
export const BIN_TALL = 0.38
const ELEVATION = (40 * Math.PI) / 180
export const MAX_YAW = (22 * Math.PI) / 180

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Paper extends Vec3 {
  vx: number
  vy: number
  vz: number
}

export interface Bin {
  x: number
  z: number
  /** Sways from side to side: how far (m) and how fast (rad/s). 0 = still. */
  sway: number
  speed: number
  phase: number
}

export type TossEnd = 'in' | 'out'

/** Screen position and scale (pixels per metre) of a point in the room. */
export function project(p: Vec3): { x: number; y: number; scale: number } {
  const depth = Math.max(0.05, p.z - CAM.z)
  const scale = CAM.focal / depth
  return { x: SCENE_W / 2 + p.x * scale, y: CAM.horizon + (CAM.y - p.y) * scale, scale }
}

/** Where the bin is at time `t` (seconds since the throw began). */
export function binX(bin: Bin, t: number): number {
  return bin.sway ? bin.x + bin.sway * Math.sin(bin.phase + bin.speed * t) : bin.x
}

/**
 * The bin for each throw: close and still at first, then further and placed anywhere, and in the
 * last throws it sways from side to side.
 */
export function binForThrow(index: number, rand = Math.random): Bin {
  const stage = index < 3 ? 0 : index < 7 ? 1 : 2
  const z = stage === 0 ? 2.2 + rand() * 0.8 : 2.6 + rand() * 2.4
  const spread = stage === 0 ? 0.35 : 0.25 * z
  const x = (rand() * 2 - 1) * spread
  return stage === 2 ? { x: x * 0.4, z, sway: 0.45 + rand() * 0.3, speed: 1.3 + rand() * 0.9, phase: rand() * Math.PI * 2 } : { x, z, sway: 0, speed: 0, phase: 0 }
}

/** Points for a hit: 1, +1 when the bin is far, +1 when it moves. */
export function binPoints(bin: Bin): number {
  return 1 + (bin.z > 3.6 ? 1 : 0) + (bin.sway ? 1 : 0)
}

/** Wind for one throw, sideways in m/s². The first throw is calm. */
export function randomWind(index: number, rand = Math.random): number {
  if (index === 0) return 0
  const w = Math.round((rand() * 2 - 1) * 14) / 10
  return Math.abs(w) < 0.3 ? 0 : w
}

/** How far (scene px) the finger is pulled down for full power, and sideways for full aim. */
export const PULL_FULL = 170
export const AIM_FULL = 140

/** Pulling the finger down tightens the flick: 0 (none) to 1 (full). Pulling up does nothing. */
export function powerFromPull(dy: number): number {
  return Math.max(0, Math.min(1, dy / PULL_FULL))
}

/** Swiping up from the paper towards the bin: the longer the swipe, the harder the flick. */
export function powerFromSwipe(dy: number): number {
  return powerFromPull(-dy)
}

/** Sideways drag turns the aim: −1 (left) to 1 (right). */
export function aimFromPull(dx: number): number {
  return Math.max(-1, Math.min(1, dx / AIM_FULL))
}

/** Turns aim (−1 left … 1 right) and power (0-1) into the paper's start speed. */
export function flickLaunch(power: number, aim: number): Paper {
  const v = 3 + Math.max(0, Math.min(1, power)) * 4.6
  const yaw = Math.max(-1, Math.min(1, aim)) * MAX_YAW
  const flat = v * Math.cos(ELEVATION)
  return { ...PAPER_START, vx: flat * Math.sin(yaw), vy: v * Math.sin(ELEVATION), vz: flat * Math.cos(yaw) }
}

/**
 * 3D points along the early part of the flight arc so the player sees both the upward launch
 * curve and sideways aim in perspective while pulling back.
 */
export function trajectoryPreview(power: number, aim: number, wind = 0, count = 10): Vec3[] {
  const start = flickLaunch(power, aim)
  const pts: Vec3[] = []
  const step = 0.045
  for (let i = 1; i <= count; i += 1) {
    const t = i * step
    const x = start.x + start.vx * t + 0.5 * wind * 0.35 * t * t
    const y = start.y + start.vy * t - 0.5 * GRAVITY * t * t
    const z = start.z + start.vz * t
    if (y < PAPER_R) break
    pts.push({ x, y, z })
  }
  return pts
}

/**
 * One step of flight. `t` is the time since the throw (for a swaying bin). Ends 'in' when the
 * paper drops through the rim, 'out' when it lands on the floor or leaves the room. Clipping the
 * rim bounces it off.
 */
export function stepPaper(paper: Paper, bin: Bin, wind: number, t: number, dt: number): { paper: Paper; end: TossEnd | null; rim: boolean } {
  let vx = paper.vx + wind * dt
  let vz = paper.vz
  const vy = paper.vy - GRAVITY * dt
  const next: Paper = { x: paper.x + vx * dt, y: paper.y + vy * dt, z: paper.z + vz * dt, vx, vy, vz }
  let rim = false
  if (paper.y >= BIN_TALL && next.y < BIN_TALL && vy < 0) {
    const k = (paper.y - BIN_TALL) / (paper.y - next.y)
    const cx = paper.x + (next.x - paper.x) * k
    const cz = paper.z + (next.z - paper.z) * k
    const bx = binX(bin, t)
    const d = Math.hypot(cx - bx, cz - bin.z)
    if (d < BIN_R - PAPER_R * 0.5) return { paper: { ...next, x: cx, z: cz, y: BIN_TALL - 0.01 }, end: 'in', rim: false }
    if (d < BIN_R + PAPER_R) {
      // Off the rim: thrown back and outwards.
      rim = true
      const nx = (cx - bx) / (d || 1)
      const nz = (cz - bin.z) / (d || 1)
      vx = nx * 1.4 + vx * 0.2
      vz = nz * 1.4 + vz * 0.2
      return { paper: { x: cx + nx * 0.03, y: BIN_TALL + 0.01, z: cz + nz * 0.03, vx, vy: Math.abs(vy) * 0.35, vz }, end: null, rim }
    }
  }
  if (next.y <= PAPER_R) return { paper: { ...next, y: PAPER_R }, end: 'out', rim }
  if (next.z > 9 || Math.abs(next.x) > 5) return { paper: next, end: 'out', rim }
  return { paper: next, end: null, rim }
}

/** A whole throw without drawing it (tests, and to check every bin can be hit). */
export function simulateFlick(power: number, aim: number, bin: Bin, wind = 0, dt = 1 / 240): TossEnd {
  let paper = flickLaunch(power, aim)
  for (let i = 0, t = 0; i < 2400; i += 1, t += dt) {
    const step = stepPaper(paper, bin, wind, t, dt)
    if (step.end) return step.end
    paper = step.paper
  }
  return 'out'
}

// ---------- Çekmece (birleştirme) ----------

export const DRAWER_SIZE = 4
export const DRAWER_SECONDS = 120

export const DRAWER_ITEMS = ['Kurşun kalem', 'Tükenmez kalem', 'Fosforlu kalem', 'Defter', 'Kitap', 'Ders notu', 'Mezuniyet kepi', 'Diploma'] as const
export const DRAWER_MAX = DRAWER_ITEMS.length

/** Cells hold an item level (1-8) or null. */
export type Drawer = Array<number | null>

export function emptyCells(grid: Drawer): number[] {
  return grid.flatMap((v, i) => (v === null ? [i] : []))
}

/** Puts one new item (mostly a pencil, sometimes a pen) in a random empty cell. */
export function spawnItem(grid: Drawer, rand = Math.random): Drawer {
  const free = emptyCells(grid)
  if (!free.length) return grid
  const next = [...grid]
  next[free[Math.floor(rand() * free.length)]] = rand() < 0.12 ? 2 : 1
  return next
}

export function newDrawer(rand = Math.random): Drawer {
  let grid: Drawer = Array(DRAWER_SIZE * DRAWER_SIZE).fill(null)
  for (let i = 0; i < 4; i += 1) grid = spawnItem(grid, rand)
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

// ---------- Records (this device) ----------

const RECORDS_KEY = 'studymode.miniGames'

export interface MiniRecords {
  toss?: number
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
