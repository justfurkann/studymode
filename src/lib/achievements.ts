import { useSyncExternalStore } from 'react'
import { computeStreakSummary, localDayKey, mergeStudyDays } from './streak'
import type { StudyData } from './types'

/*
 * Başarımlar: visible goals (with progress) and hidden discoveries spread across the site. Hidden
 * ones show only "???" and a riddle until found, so people poke around. Kept in this browser
 * (localStorage); nothing is sent anywhere.
 */

export type Rarity = 'yaygin' | 'nadir' | 'destansi' | 'efsanevi'

export const RARITIES: Record<Rarity, { label: string; order: number }> = {
  yaygin: { label: 'Yaygın', order: 0 },
  nadir: { label: 'Nadir', order: 1 },
  destansi: { label: 'Destansı', order: 2 },
  efsanevi: { label: 'Efsanevi', order: 3 },
}

export type AchievementId =
  | 'ilk-adim'
  | 'seri-3'
  | 'seri-7'
  | 'yuz-tekrar'
  | 'kusursuz'
  | 'odak-ustasi'
  | 'kendini-tani'
  | 'fis'
  | 'cok-yuzlu'
  | 'gece-kusu'
  | 'erkenci'
  | 'gece-yarisi'
  | 'dedektif'
  | 'glitch'
  | 'kurcalamaci'
  | 'kayip-sayfa'
  | 'tema-dj'
  | 'kalem-koleksiyonu'
  | 'ses-muhendisi'
  | 'koleksiyoncu'

/** Icon names map to lucide icons in the UI (AchievementBadge). */
export type AchievementIcon =
  | 'footprints'
  | 'flame'
  | 'flame-kindling'
  | 'layers'
  | 'target'
  | 'timer'
  | 'sparkles'
  | 'receipt'
  | 'shapes'
  | 'moon'
  | 'sunrise'
  | 'clock'
  | 'search'
  | 'zap'
  | 'camera'
  | 'map'
  | 'sun-moon'
  | 'highlighter'
  | 'audio'
  | 'trophy'

export interface Achievement {
  id: AchievementId
  name: string
  /** Shown once unlocked (and for visible ones, before). */
  description: string
  rarity: Rarity
  icon: AchievementIcon
  /** Hidden: shows "???" and only this riddle until found. */
  hint?: string
  /** Visible goals with a counter: target number. */
  goal?: number
}

export const ACHIEVEMENTS: Achievement[] = [
  // Study goals (visible)
  { id: 'ilk-adim', name: 'İlk Adım', description: 'İlk kartını tekrar ettin.', rarity: 'yaygin', icon: 'footprints', goal: 1 },
  { id: 'seri-3', name: 'Isınma Turu', description: '3 gün üst üste çalıştın.', rarity: 'yaygin', icon: 'flame-kindling', goal: 3 },
  { id: 'seri-7', name: 'Bir Haftalık Ateş', description: '7 gün üst üste çalıştın.', rarity: 'nadir', icon: 'flame', goal: 7 },
  { id: 'yuz-tekrar', name: 'Yüz Kart', description: 'Toplam 100 kart tekrar ettin.', rarity: 'destansi', icon: 'layers', goal: 100 },
  { id: 'kusursuz', name: 'Kusursuz', description: 'Bir testi hiç yanlışsız bitirdin.', rarity: 'nadir', icon: 'target' },
  { id: 'odak-ustasi', name: 'Odak Ustası', description: 'Bir günde 4 odak turu tamamladın.', rarity: 'destansi', icon: 'timer', goal: 4 },
  { id: 'kendini-tani', name: 'Kendini Tanı', description: '"Hangi öğrenci tipisin?" testini çözdün.', rarity: 'yaygin', icon: 'sparkles' },
  { id: 'fis', name: 'Kasadan Geçti', description: 'İlk çalışma fişini kestin.', rarity: 'yaygin', icon: 'receipt' },
  // Hidden discoveries
  { id: 'cok-yuzlu', name: 'Çok Yüzlü', description: 'Testte 3 farklı öğrenci tipi çıkardın.', rarity: 'destansi', icon: 'shapes', hint: 'Bir kez çözmek yetmez; insan değişir.' },
  { id: 'gece-kusu', name: 'Gece Kuşu', description: "Gece 03.00'te buradaydın. Uyu artık.", rarity: 'destansi', icon: 'moon', hint: 'Herkes uyurken, saat üçü gösterirken.' },
  { id: 'erkenci', name: 'Erkenci Kuş', description: 'Sabah 06.00 olmadan çalışmaya geldin.', rarity: 'nadir', icon: 'sunrise', hint: 'Güneş doğmadan önce.' },
  { id: 'gece-yarisi', name: 'Gün Dönümü', description: 'Gün tam değişirken, 00.00’da buradaydın.', rarity: 'efsanevi', icon: 'clock', hint: 'Takvim yaprağı koparken burada ol.' },
  { id: 'dedektif', name: 'Dedektif', description: 'Gizlilik politikasının sonundaki gizli düğmeyi buldun. Kimse oraya kadar okumaz.', rarity: 'destansi', icon: 'search', hint: 'Kimsenin sonuna kadar okumadığı o sayfa.' },
  { id: 'glitch', name: 'Glitch Hunter', description: 'Sistemi bozan kombinasyonu buldun.', rarity: 'efsanevi', icon: 'zap', hint: 'Bazı logolar dokunulmayı sever. Çok. Klavyesi olanlar eski bir şifreyi de dener.' },
  { id: 'kurcalamaci', name: 'Kurcalamacı', description: 'Yapımcının fotoğrafına beş kez dokundun.', rarity: 'nadir', icon: 'camera', hint: 'Yapımcının fotoğrafı bir şey saklıyor.' },
  { id: 'kayip-sayfa', name: 'Kayıp Sayfa', description: 'Var olmayan bir adrese gittin.', rarity: 'yaygin', icon: 'map', hint: 'Haritada olmayan bir yere git.' },
  { id: 'tema-dj', name: 'Işık DJ’i', description: 'Temayı arka arkaya 10 kez değiştirdin.', rarity: 'nadir', icon: 'sun-moon', hint: 'Aç, kapa, aç, kapa…' },
  { id: 'kalem-koleksiyonu', name: 'Kalem Kutusu', description: 'Bütün fosforlu kalem renklerini denedin.', rarity: 'nadir', icon: 'highlighter', hint: 'Sarı tek renk değil.' },
  { id: 'ses-muhendisi', name: 'Ses Mühendisi', description: 'Yağmur, kafe, şömine ve odak seslerini aynı anda açtın.', rarity: 'nadir', icon: 'audio', hint: 'Bütün sesler bir arada.' },
  { id: 'koleksiyoncu', name: 'Koleksiyoncu', description: '10 başarım topladın.', rarity: 'efsanevi', icon: 'trophy', goal: 10 },
]

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<AchievementId, Achievement>
export const isHidden = (a: Achievement) => !!a.hint

// ---------- Storage ----------

const KEY = 'studymode.achievements.v1'
const EXTRA_KEY = 'studymode.achievementData.v1'

export type Unlocked = Partial<Record<AchievementId, string>>

/** Small extra memory some achievements need: quiz types seen, pen colours tried. */
export interface AchievementData {
  quizTypes: string[]
  pens: string[]
}

export function parseUnlocked(raw: string | null): Unlocked {
  try {
    const value = JSON.parse(raw ?? '{}') as Record<string, unknown>
    const out: Unlocked = {}
    for (const a of ACHIEVEMENTS) if (typeof value[a.id] === 'string') out[a.id] = value[a.id] as string
    return out
  } catch {
    return {}
  }
}

function readUnlocked(): Unlocked {
  try {
    return parseUnlocked(localStorage.getItem(KEY))
  } catch {
    return {}
  }
}

function readExtra(): AchievementData {
  try {
    const v = JSON.parse(localStorage.getItem(EXTRA_KEY) ?? '{}') as Partial<AchievementData>
    return { quizTypes: Array.isArray(v.quizTypes) ? v.quizTypes : [], pens: Array.isArray(v.pens) ? v.pens : [] }
  } catch {
    return { quizTypes: [], pens: [] }
  }
}

/** No achievements saved yet: this browser meets the feature for the first time. */
let firstVisit = (() => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(KEY) === null
  } catch {
    return false
  }
})()
export const isFirstVisit = () => firstVisit

let unlocked: Unlocked = typeof window === 'undefined' ? {} : readUnlocked()
let extra: AchievementData = typeof window === 'undefined' ? { quizTypes: [], pens: [] } : readExtra()
/** Unlocked in this visit and not yet announced. */
let queue: AchievementId[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(unlocked))
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extra))
  } catch {
    // Blocked storage: achievements last for this visit.
  }
}

/**
 * Unlocks one achievement (once). Returns true when it is new. `silent` skips the toast: used for
 * goals someone had already reached before achievements existed, so they do not get a burst of five.
 */
export function unlock(id: AchievementId, now = new Date(), options: { silent?: boolean } = {}): boolean {
  if (unlocked[id]) return false
  unlocked = { ...unlocked, [id]: now.toISOString() }
  if (!options.silent) queue = [...queue, id]
  const count = Object.keys(unlocked).length
  if (count >= (ACHIEVEMENT_BY_ID.koleksiyoncu.goal ?? 10) && !unlocked.koleksiyoncu) {
    unlocked = { ...unlocked, koleksiyoncu: now.toISOString() }
    if (!options.silent) queue = [...queue, 'koleksiyoncu']
  }
  save()
  emit()
  return true
}

/** Takes the next achievement to announce. */
export function takeAnnouncement(): AchievementId | null {
  const [next, ...rest] = queue
  if (!next) return null
  queue = rest
  emit()
  return next
}

export function useAchievements(): { unlocked: Unlocked; pending: number } {
  return useSyncExternalStore(subscribe, snapshot)
}

let lastSnapshot = { unlocked, pending: queue.length }
function snapshot() {
  if (lastSnapshot.unlocked !== unlocked || lastSnapshot.pending !== queue.length) lastSnapshot = { unlocked, pending: queue.length }
  return lastSnapshot
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Remembers a quiz result; three different types unlock "Çok Yüzlü". */
export function recordQuizType(type: string) {
  unlock('kendini-tani')
  if (!extra.quizTypes.includes(type)) {
    extra = { ...extra, quizTypes: [...extra.quizTypes, type] }
    save()
  }
  if (extra.quizTypes.length >= 3) unlock('cok-yuzlu')
}

/** Remembers a highlighter colour; all five unlock "Kalem Kutusu". */
export function recordPen(pen: string, all: number) {
  if (!extra.pens.includes(pen)) {
    extra = { ...extra, pens: [...extra.pens, pen] }
    save()
  }
  if (extra.pens.length >= all) unlock('kalem-koleksiyonu')
}

// ---------- Rules that read the clock or the study data ----------

/** Time-of-day discoveries. */
export function clockAchievements(now: Date): AchievementId[] {
  const h = now.getHours()
  const m = now.getMinutes()
  const out: AchievementId[] = []
  if (h === 3) out.push('gece-kusu')
  if (h >= 4 && h < 6) out.push('erkenci')
  if (h === 0 && m === 0) out.push('gece-yarisi')
  return out
}

export interface Progress {
  value: number
  goal: number
}

/** Progress toward the visible goals, from study data and focus rounds. */
export function studyProgress(data: StudyData, focusRoundsToday: number, now = new Date()): Partial<Record<AchievementId, Progress>> {
  const days = mergeStudyDays(data.studyDays)
  const reviews = days.reduce((s, d) => s + d.reviews, 0)
  const streak = computeStreakSummary(data.studyDays, 20, now).streak
  const perfect = data.attempts.some((a) => a.total > 0 && a.score === a.total) || data.exams.some((e) => e.total > 0 && e.score >= e.total)
  return {
    'ilk-adim': { value: Math.min(1, reviews), goal: 1 },
    'seri-3': { value: Math.min(3, streak), goal: 3 },
    'seri-7': { value: Math.min(7, streak), goal: 7 },
    'yuz-tekrar': { value: Math.min(100, reviews), goal: 100 },
    kusursuz: { value: perfect ? 1 : 0, goal: 1 },
    'odak-ustasi': { value: Math.min(4, focusRoundsToday), goal: 4 },
  }
}

export function reachedGoals(progress: Partial<Record<AchievementId, Progress>>): AchievementId[] {
  return (Object.entries(progress) as Array<[AchievementId, Progress]>).filter(([, p]) => p.value >= p.goal).map(([id]) => id)
}

export const todayKey = () => localDayKey()

/** For tests: start from a clean slate. */
export function resetAchievementsForTests() {
  firstVisit = false
  unlocked = {}
  extra = { quizTypes: [], pens: [] }
  queue = []
  emit()
}
