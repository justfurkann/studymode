import { useSyncExternalStore } from 'react'
import { isTypeId, LEVELS, type Level, type QuizResult, type TypeId } from './studentType'
import { useStore } from './store'
import { supabase } from './supabase'

/*
 * The student's quiz result ("Hangi öğrenci tipisin?") kept as part of their profile.
 *
 * Signed in: in the account's own user_metadata (`student_type`), next to the name the app already
 * keeps there, so it follows the student to every device and needs no new table. Not signed in: in
 * this browser; it moves to the account when they sign in. The newest result wins.
 */

export interface SavedResult {
  type: TypeId
  /** Fit to the type, 0-100. */
  percent: number
  /** plan, depth, social, night as −100..100. */
  axes: [number, number, number, number]
  level: Level | null
  school: string
  runnerUp: TypeId | null
  /** ISO time. */
  at: string
}

const KEY = 'studymode.studentType.v1'
export const METADATA_KEY = 'student_type'

export function parseSaved(value: unknown): SavedResult | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (!isTypeId(v.type) || typeof v.at !== 'string') return null
  const axes = Array.isArray(v.axes) ? v.axes.slice(0, 4).map((n) => Math.max(-100, Math.min(100, Math.round(Number(n) || 0)))) : [0, 0, 0, 0]
  while (axes.length < 4) axes.push(0)
  return {
    type: v.type,
    percent: Math.max(0, Math.min(100, Math.round(Number(v.percent) || 0))),
    axes: axes as SavedResult['axes'],
    level: LEVELS.some((l) => l.id === v.level) ? (v.level as Level) : null,
    school: typeof v.school === 'string' ? v.school.slice(0, 60) : '',
    runnerUp: isTypeId(v.runnerUp) ? v.runnerUp : null,
    at: v.at,
  }
}

export function fromQuiz(result: QuizResult, level: Level | null, school: string, now = new Date()): SavedResult {
  const p = result.profile
  return {
    type: result.type.id,
    percent: result.matches[0].percent,
    axes: [p.plan, p.depth, p.social, p.night].map((n) => Math.round(n * 100)) as SavedResult['axes'],
    level,
    school: school.slice(0, 60),
    runnerUp: result.runnerUp.id,
    at: now.toISOString(),
  }
}

/** The address of the result card, which shows the same card to anyone who opens it. */
export function resultPath(saved: SavedResult): string {
  const p = new URLSearchParams({ tip: saved.type, p: saved.axes.join(','), y: String(saved.percent) })
  if (saved.level) p.set('s', saved.level)
  if (saved.school) p.set('okul', saved.school)
  if (saved.runnerUp) p.set('iki', saved.runnerUp)
  return `/ogrenci-tipi?${p.toString()}`
}

/** The newer of two results. */
export const newer = (a: SavedResult | null, b: SavedResult | null) => (!a ? b : !b ? a : a.at >= b.at ? a : b)

// ---------- This browser ----------

function readLocal(): SavedResult | null {
  try {
    return parseSaved(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return null
  }
}

let local: SavedResult | null = typeof window === 'undefined' ? null : readLocal()
const listeners = new Set<() => void>()

function setLocal(next: SavedResult) {
  local = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Blocked storage: kept for this visit.
  }
  listeners.forEach((l) => l())
}

function useLocal() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => local,
  )
}

// ---------- The account ----------

/** Saves a new result here and, when signed in, on the account. Never throws. */
export async function saveStudentResult(saved: SavedResult): Promise<void> {
  setLocal(saved)
  if (!supabase) return
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) await supabase.auth.updateUser({ data: { [METADATA_KEY]: saved } })
  } catch {
    // Offline or refused: the result stays in this browser and is sent at the next sign-in.
  }
}

/** The student's result: the newest of the account's and this browser's. */
export function useStudentResult(): SavedResult | null {
  const { session } = useStore()
  const mine = useLocal()
  const remote = parseSaved((session?.user.user_metadata as Record<string, unknown> | undefined)?.[METADATA_KEY])
  return newer(remote, mine)
}

/** After signing in: a result taken before (or on another device) that the account lacks is copied up. */
export function useSyncStudentResult() {
  const { session } = useStore()
  const mine = useLocal()
  const remote = parseSaved((session?.user.user_metadata as Record<string, unknown> | undefined)?.[METADATA_KEY])
  return { session, mine, remote }
}

let lastPushed = ''
/** Sends the local result to the account if it is newer than what the account has (once per value). */
export function pushIfNewer(signedIn: boolean, mine: SavedResult | null, remote: SavedResult | null) {
  if (!signedIn || !supabase || !mine) return
  if (remote && remote.at >= mine.at) return
  const payload = JSON.stringify(mine)
  if (payload === lastPushed) return
  lastPushed = payload
  void supabase.auth.updateUser({ data: { [METADATA_KEY]: mine } }).catch(() => undefined)
}
