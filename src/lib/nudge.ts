/*
 * When the "Premium'u dene" pop-up may show (components/PremiumNudge.tsx). The rules are strict on
 * purpose: a study app that nags loses people faster than it sells.
 *
 * - Only signed-in accounts on the normal role with Premium locked: never VIP, admin, paid Premium
 *   or someone using their own Gemini key; never guests.
 * - Not before the account has settled in: a day old, or three notes made.
 * - At most once every 3 days; after it was waved away twice, once a week; after "Satın al" was
 *   tapped, not for two weeks (they are probably buying).
 * - Never on pages where it is in the way (sign-in, buying, Premium, a code link, a mock exam,
 *   a shared course) and never over another window.
 */

export const NUDGE_GAP_MS = 3 * 24 * 60 * 60 * 1000
export const NUDGE_GAP_AFTER_NO_MS = 7 * 24 * 60 * 60 * 1000
export const NUDGE_GAP_AFTER_BUY_MS = 14 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export interface NudgeMemory {
  /** When it last showed. */
  at: number
  /** How many times it was waved away ("Şimdi değil"). */
  no: number
  /** When "Satın al" was last tapped. */
  buyAt: number
}

export const emptyMemory = (): NudgeMemory => ({ at: 0, no: 0, buyAt: 0 })

const QUIET_PATHS = [/^\/giris/, /^\/sifre-yenile/, /^\/kod/, /^\/fiyatlar/, /^\/premium/, /^\/paylas\//, /^\/ders\/[^/]+\/sinav/, /^\/yonetim/]

export function quietPage(pathname: string): boolean {
  return QUIET_PATHS.some((re) => re.test(pathname))
}

export interface NudgeInput {
  signedIn: boolean
  role: 'normal' | 'vip' | 'admin' | null
  premiumLocked: boolean
  accountCreatedAt: string | null
  notes: number
  pathname: string
  memory: NudgeMemory
  now: number
}

export function mayNudge(i: NudgeInput): boolean {
  if (!i.signedIn || i.role !== 'normal' || !i.premiumLocked) return false
  if (quietPage(i.pathname)) return false
  const age = i.accountCreatedAt ? i.now - new Date(i.accountCreatedAt).getTime() : 0
  if (age < DAY_MS && i.notes < 3) return false
  const m = i.memory
  if (m.buyAt && i.now - m.buyAt < NUDGE_GAP_AFTER_BUY_MS) return false
  const gap = m.no >= 2 ? NUDGE_GAP_AFTER_NO_MS : NUDGE_GAP_MS
  return !m.at || i.now - m.at >= gap
}

const key = (userId: string) => `studymode.nudge.${userId}`

export function readMemory(userId: string): NudgeMemory {
  try {
    const v = JSON.parse(localStorage.getItem(key(userId)) ?? 'null') as Partial<NudgeMemory> | null
    return { at: Number(v?.at) || 0, no: Number(v?.no) || 0, buyAt: Number(v?.buyAt) || 0 }
  } catch {
    return emptyMemory()
  }
}

export function writeMemory(userId: string, memory: NudgeMemory) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(memory))
  } catch {
    // Without storage it may show again next time; the gap rules still hold within a visit.
  }
}
