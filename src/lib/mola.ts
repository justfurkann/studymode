import type { Card } from './types'
import { localDayKey, shiftLocalDay } from './streak'

/*
 * "Mola": short games built from the student's own cards, plus a focus timer.
 * Games never touch the spaced-repetition schedule or the daily card goal (matching six tiles in a
 * minute is not the same as recalling a card), they only keep the streak alive. Records and focus
 * minutes live on this device.
 */

export type Rng = () => number

export const MATCH_PAIRS = 6
export const MATCH_MIN_PAIRS = 3
export const MATCH_PENALTY_MS = 2000
export const QUICK_SECONDS = 60
export const QUICK_MIN_CARDS = 4
/** Wrong answers allowed in a quick round; the third one ends it. */
export const QUICK_LIVES = 3
export const TILE_MAX = 80
export const FOCUS_CHOICES = [25, 50] as const
/** One notebook page is one full 25-minute session. */
export const PAGE_MINUTES = 25

const normalize = (text: string) => text.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()

export function shuffled<T>(items: T[], rng: Rng = Math.random): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function clip(text: string, max = TILE_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/**
 * Cards that can be told apart: the same front or the same back twice would make a pair ambiguous,
 * so only the first of each is kept. Empty cards are skipped.
 */
export function distinctCards(cards: Card[]): Card[] {
  const fronts = new Set<string>()
  const backs = new Set<string>()
  const out: Card[] = []
  for (const card of cards) {
    const f = normalize(card.front)
    const b = normalize(card.back)
    if (!f || !b || f === b || fronts.has(f) || backs.has(b)) continue
    fronts.add(f)
    backs.add(b)
    out.push(card)
  }
  return out
}

export function cardsInScope(cards: Card[], courseId: string | null): Card[] {
  return distinctCards(courseId ? cards.filter((c) => c.courseId === courseId) : cards)
}

const QUESTION_SHELL = /^(?:[“"‘'](.+?)[”"’']|(.+?))\s+(?:ne anlama gelir|nedir|ne demektir|neyi ifade eder)\s*\??$/i

/** "“Öğrenme” ne anlama gelir?" becomes "Öğrenme" on a tile: shorter, and the game stays about the term. */
export function tileFront(front: string): string {
  const clean = front.replace(/\s+/g, ' ').trim()
  const m = clean.match(QUESTION_SHELL)
  const term = (m?.[1] ?? m?.[2] ?? '').trim()
  return term && term.length <= 60 ? term : clean
}

export interface MatchTile {
  id: string
  cardId: string
  side: 'front' | 'back'
  text: string
}

/** Picks up to six cards (short answers first, they fit a tile) and lays out both sides shuffled. */
export function buildMatchBoard(cards: Card[], rng: Rng = Math.random, pairs = MATCH_PAIRS): MatchTile[] {
  const pool = shuffled(distinctCards(cards), rng)
  const short = pool.filter((c) => c.back.trim().length <= TILE_MAX && c.front.trim().length <= TILE_MAX * 1.5)
  const long = pool.filter((c) => !short.includes(c))
  const picked = [...short, ...long].slice(0, pairs)
  if (picked.length < MATCH_MIN_PAIRS) return []
  const tiles = picked.flatMap((card): MatchTile[] => [
    { id: `${card.id}:f`, cardId: card.id, side: 'front', text: clip(tileFront(card.front), TILE_MAX * 1.5) },
    { id: `${card.id}:b`, cardId: card.id, side: 'back', text: clip(card.back) },
  ])
  return shuffled(tiles, rng)
}

/**
 * The same cards as `buildMatchBoard`, laid out as two columns: terms on the left, answers on the
 * right, each shuffled on its own. Easier to read than one mixed grid.
 */
export function buildMatchColumns(cards: Card[], rng: Rng = Math.random, pairs = MATCH_PAIRS): { fronts: MatchTile[]; backs: MatchTile[] } {
  const tiles = buildMatchBoard(cards, rng, pairs)
  return { fronts: shuffled(tiles.filter((t) => t.side === 'front'), rng), backs: shuffled(tiles.filter((t) => t.side === 'back'), rng) }
}

export type MatchPick = 'select' | 'match' | 'miss'

/** What tapping `next` does when `selected` is already chosen. */
export function matchPick(selected: MatchTile | null, next: MatchTile): MatchPick {
  if (!selected || selected.id === next.id || selected.side === next.side) return 'select'
  return selected.cardId === next.cardId ? 'match' : 'miss'
}

export function matchTime(elapsedMs: number, misses: number): number {
  return Math.max(0, Math.round(elapsedMs)) + misses * MATCH_PENALTY_MS
}

/** "38,4 sn" or "1 dk 05 sn". */
export function formatSeconds(ms: number): string {
  const total = Math.max(0, ms) / 1000
  if (total < 60) return `${total.toFixed(1).replace('.', ',')} sn`
  const minutes = Math.floor(total / 60)
  const seconds = Math.floor(total % 60)
  return `${minutes} dk ${String(seconds).padStart(2, '0')} sn`
}

export interface QuickItem {
  cardId: string
  prompt: string
  shown: string
  answer: string
  /** Whether `shown` is this card's real answer. */
  correct: boolean
}

/**
 * One "Doğru mu?" statement. About half of the time the shown answer belongs to another card.
 * `previous` avoids asking the same card twice in a row.
 */
export function nextQuickItem(cards: Card[], rng: Rng = Math.random, previous?: string): QuickItem | null {
  const pool = distinctCards(cards)
  if (pool.length < 2) return null
  const candidates = pool.length > 2 && previous ? pool.filter((c) => c.id !== previous) : pool
  const card = candidates[Math.floor(rng() * candidates.length)]
  const others = pool.filter((c) => c.id !== card.id)
  const correct = rng() < 0.5
  const shown = correct ? card.back : others[Math.floor(rng() * others.length)].back
  return { cardId: card.id, prompt: card.front, shown: clip(shown, 160), answer: clip(card.back, 160), correct }
}

/** Points for a right answer: 1, or 2 once three in a row were right. */
export function quickPoints(streakBefore: number): number {
  return streakBefore >= 2 ? 2 : 1
}

// ---------- Records and focus minutes (this device) ----------

const RECORDS_KEY = 'studymode.mola.v1'

export interface MolaRecords {
  /** Best match time in ms, per scope ("all" or a course id). Lower is better. */
  match: Record<string, number>
  /** Best quick-round score, per scope. Higher is better. */
  quick: Record<string, number>
  /** Focus minutes per local day (YYYY-MM-DD). */
  focus: Record<string, number>
  /** Finished focus rounds (pomodoros) per local day. */
  rounds: Record<string, number>
}

const emptyRecords = (): MolaRecords => ({ match: {}, quick: {}, focus: {}, rounds: {} })

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [key, num] of Object.entries(value as Record<string, unknown>)) {
    if (typeof num === 'number' && Number.isFinite(num) && num >= 0) out[key] = num
  }
  return out
}

export function parseRecords(raw: string | null): MolaRecords {
  if (!raw) return emptyRecords()
  try {
    const parsed = JSON.parse(raw) as Partial<MolaRecords>
    return { match: numberMap(parsed.match), quick: numberMap(parsed.quick), focus: numberMap(parsed.focus), rounds: numberMap(parsed.rounds) }
  } catch {
    return emptyRecords()
  }
}

export function readRecords(): MolaRecords {
  try {
    return parseRecords(localStorage.getItem(RECORDS_KEY))
  } catch {
    return emptyRecords()
  }
}

function writeRecords(records: MolaRecords) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  } catch {
    // Blocked storage: records then last for this tab only.
  }
}

export const scopeKey = (courseId: string | null) => courseId ?? 'all'

/** Saves a match time; returns whether it beat the previous best. */
export function saveMatchTime(courseId: string | null, ms: number): boolean {
  const records = readRecords()
  const key = scopeKey(courseId)
  const best = records.match[key]
  const isBest = best === undefined || ms < best
  if (isBest) writeRecords({ ...records, match: { ...records.match, [key]: ms } })
  return isBest
}

/** Saves a quick-round score; returns whether it beat the previous best. A zero never counts. */
export function saveQuickScore(courseId: string | null, score: number): boolean {
  const records = readRecords()
  const key = scopeKey(courseId)
  const best = records.quick[key] ?? 0
  const isBest = score > best
  if (isBest) writeRecords({ ...records, quick: { ...records.quick, [key]: score } })
  return isBest
}

export function addFocusMinutes(minutes: number, now = new Date()) {
  if (minutes <= 0) return
  const records = readRecords()
  const day = localDayKey(now)
  writeRecords({ ...records, focus: { ...records.focus, [day]: (records.focus[day] ?? 0) + minutes } })
}

export function addFocusRound(now = new Date()) {
  const records = readRecords()
  const day = localDayKey(now)
  writeRecords({ ...records, rounds: { ...records.rounds, [day]: (records.rounds[day] ?? 0) + 1 } })
}

/** The last seven days, oldest first, for the small chart. */
export function focusWeek(records: Pick<MolaRecords, 'focus' | 'rounds'>, now = new Date()): Array<{ day: string; label: string; minutes: number; rounds: number; today: boolean }> {
  const today = localDayKey(now)
  return Array.from({ length: 7 }, (_, i) => {
    const day = shiftLocalDay(today, i - 6)
    const label = new Date(`${day}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' })
    return { day, label, minutes: records.focus[day] ?? 0, rounds: records.rounds[day] ?? 0, today: i === 6 }
  })
}

/** Focus minutes of the last seven days, today included. */
export function focusLastWeek(focus: Record<string, number>, now = new Date()): number {
  const today = localDayKey(now)
  let total = 0
  for (let i = 0; i < 7; i++) total += focus[shiftLocalDay(today, -i)] ?? 0
  return total
}

// ---------- Focus timer ----------

const TIMER_KEY = 'studymode.focus.v1'

export type FocusPlanId = 'klasik' | 'uzun'
export type FocusPhase = 'focus' | 'short' | 'long'

export const FOCUS_PLANS: Record<FocusPlanId, { label: string; focus: number; short: number; long: number }> = {
  klasik: { label: '25 + 5', focus: 25, short: 5, long: 15 },
  uzun: { label: '50 + 10', focus: 50, short: 10, long: 20 },
}
/** Every fourth focus round is followed by a long break. */
export const LONG_BREAK_EVERY = 4

/** Kept on the device so the timer keeps running while the student is on another page. */
export interface FocusTimer {
  /** Length of the current phase. */
  minutes: number
  /** While running: when the phase ends (epoch ms). */
  endsAt: number | null
  /** While paused (or ready to start): what is left (ms). */
  remainingMs: number | null
  plan: FocusPlanId
  phase: FocusPhase
  /** 1-based focus round; a break belongs to the round before it. */
  round: number
  /** What the student is studying, if they picked a course. */
  courseId: string | null
}

/** A running focus round. */
export function startFocus(plan: FocusPlanId, round = 1, courseId: string | null = null, now = Date.now()): FocusTimer {
  const minutes = FOCUS_PLANS[plan].focus
  return { minutes, endsAt: now + minutes * 60_000, remainingMs: null, plan, phase: 'focus', round, courseId }
}

/** Older code and tests: a plain focus round of any length. */
export function startTimer(minutes: number, now = Date.now()): FocusTimer {
  return { minutes, endsAt: now + minutes * 60_000, remainingMs: null, plan: 'klasik', phase: 'focus', round: 1, courseId: null }
}

/**
 * What comes after the current phase: a focus round is followed by a break that starts right away
 * (a long one every fourth round); a break is followed by the next focus round, ready but waiting
 * for the student to press start.
 */
export function nextPhase(timer: FocusTimer, now = Date.now()): FocusTimer {
  const plan = FOCUS_PLANS[timer.plan]
  if (timer.phase === 'focus') {
    const phase: FocusPhase = timer.round % LONG_BREAK_EVERY === 0 ? 'long' : 'short'
    const minutes = plan[phase]
    return { ...timer, phase, minutes, endsAt: now + minutes * 60_000, remainingMs: null }
  }
  return { ...timer, phase: 'focus', round: timer.round + 1, minutes: plan.focus, endsAt: null, remainingMs: plan.focus * 60_000 }
}

/** A phase that has not started yet (the next focus round after a break). */
export const isWaiting = (timer: FocusTimer) => timer.endsAt === null && timer.remainingMs === timer.minutes * 60_000

export function remainingMs(timer: FocusTimer, now = Date.now()): number {
  if (timer.endsAt !== null) return Math.max(0, timer.endsAt - now)
  return Math.max(0, timer.remainingMs ?? timer.minutes * 60_000)
}

export function pauseTimer(timer: FocusTimer, now = Date.now()): FocusTimer {
  if (timer.endsAt === null) return timer
  return { ...timer, endsAt: null, remainingMs: remainingMs(timer, now) }
}

export function resumeTimer(timer: FocusTimer, now = Date.now()): FocusTimer {
  if (timer.endsAt !== null) return timer
  return { ...timer, endsAt: now + remainingMs(timer, now), remainingMs: null }
}

/** Whole minutes already focused. */
export function elapsedMinutes(timer: FocusTimer, now = Date.now()): number {
  return Math.min(timer.minutes, Math.floor((timer.minutes * 60_000 - remainingMs(timer, now)) / 60_000))
}

export function isFinished(timer: FocusTimer, now = Date.now()): boolean {
  return remainingMs(timer, now) === 0
}

/** "24:05" */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function parseTimer(raw: string | null): FocusTimer | null {
  if (!raw) return null
  try {
    const t = JSON.parse(raw) as Partial<FocusTimer>
    const minutes = Number(t.minutes)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return null
    const endsAt = typeof t.endsAt === 'number' && Number.isFinite(t.endsAt) ? t.endsAt : null
    const left = typeof t.remainingMs === 'number' && Number.isFinite(t.remainingMs) ? Math.min(t.remainingMs, minutes * 60_000) : null
    if (endsAt === null && left === null) return null
    const plan: FocusPlanId = t.plan === 'uzun' ? 'uzun' : 'klasik'
    const phase: FocusPhase = t.phase === 'short' || t.phase === 'long' ? t.phase : 'focus'
    const round = Number.isInteger(t.round) && (t.round as number) >= 1 && (t.round as number) < 1000 ? (t.round as number) : 1
    const courseId = typeof t.courseId === 'string' && t.courseId ? t.courseId : null
    return { minutes, endsAt, remainingMs: endsAt === null ? left : null, plan, phase, round, courseId }
  } catch {
    return null
  }
}

export function readTimer(): FocusTimer | null {
  try {
    return parseTimer(localStorage.getItem(TIMER_KEY))
  } catch {
    return null
  }
}

export function writeTimer(timer: FocusTimer | null) {
  try {
    if (timer) localStorage.setItem(TIMER_KEY, JSON.stringify(timer))
    else localStorage.removeItem(TIMER_KEY)
  } catch {
    // Blocked storage: the timer then lives only while the page is open.
  }
}
