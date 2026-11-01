import { ACHIEVEMENT_BY_ID, type AchievementId, type Rarity, type Unlocked } from './achievements'
import { isDayStudied, mergeStudyDays } from './streak'
import type { StudyData } from './types'

/*
 * XP and levels. XP is not a counter of its own: it is worked out from what the student has done
 * (cards reviewed, tests and mock exams finished, notes prepared, days studied, achievements). So it
 * is the same on every device, cannot be counted twice, and needs no new table.
 */

export const XP = {
  review: 2,
  quiz: 15,
  action: 3,
  perfect: 10,
  exam: 25,
  note: 20,
  day: 10,
} as const

export const ACHIEVEMENT_XP: Record<Rarity, number> = { yaygin: 20, nadir: 50, destansi: 100, efsanevi: 250 }

export interface XpPart {
  key: string
  label: string
  count: number
  xp: number
}

export interface XpSummary {
  total: number
  parts: XpPart[]
}

export function computeXp(data: Pick<StudyData, 'studyDays' | 'attempts' | 'exams' | 'notes'>, unlocked: Unlocked): XpSummary {
  const days = mergeStudyDays(data.studyDays)
  const reviews = days.reduce((s, d) => s + d.reviews, 0)
  const quizzes = days.reduce((s, d) => s + d.quizzes, 0)
  const actions = days.reduce((s, d) => s + (d.actions ?? 0), 0)
  const studied = days.filter(isDayStudied).length
  const perfect = data.attempts.filter((a) => a.total > 0 && a.score === a.total).length
  const exams = data.exams.length
  const notes = data.notes.filter((n) => n.generator !== null).length
  const achievementXp = (Object.keys(unlocked) as AchievementId[]).reduce((s, id) => s + (ACHIEVEMENT_BY_ID[id] ? ACHIEVEMENT_XP[ACHIEVEMENT_BY_ID[id].rarity] : 0), 0)
  const parts: XpPart[] = [
    { key: 'review', label: 'Çevrilen kart', count: reviews, xp: reviews * XP.review },
    { key: 'quiz', label: 'Bitirilen test ve sınav', count: quizzes, xp: quizzes * XP.quiz },
    { key: 'perfect', label: 'Hatasız test bonusu', count: perfect, xp: perfect * XP.perfect },
    { key: 'exam', label: 'Sınav provası bonusu', count: exams, xp: exams * XP.exam },
    { key: 'note', label: 'Hazırlanan not', count: notes, xp: notes * XP.note },
    { key: 'action', label: 'Yazılı cevap ve açıklama', count: actions, xp: actions * XP.action },
    { key: 'day', label: 'Çalışılan gün', count: studied, xp: studied * XP.day },
    { key: 'achievement', label: 'Başarım', count: Object.keys(unlocked).length, xp: achievementXp },
  ]
  return { total: parts.reduce((s, p) => s + p.xp, 0), parts }
}

/** Total XP needed to reach `level` (level 1 at 0): 100, 300, 600, 1000, … */
export const xpForLevel = (level: number) => 50 * (level - 1) * level

const TITLES: Array<[number, string]> = [
  [1, 'Çaylak'],
  [3, 'Not Avcısı'],
  [5, 'Kart Ustası'],
  [8, 'Fosforlu Kalem'],
  [12, 'Kütüphane Müdavimi'],
  [16, 'Vize Savaşçısı'],
  [20, 'Final Bükücü'],
  [25, 'Bölüm Birincisi'],
  [30, 'Profesör'],
  [40, 'Efsane'],
]

export function levelTitle(level: number): string {
  let title = TITLES[0][1]
  for (const [from, name] of TITLES) if (level >= from) title = name
  return title
}

export interface LevelInfo {
  level: number
  title: string
  /** XP gathered inside this level, and how much the level takes. */
  into: number
  span: number
  toNext: number
  /** 0..1 */
  progress: number
}

export function levelOf(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp))
  let level = 1
  while (xpForLevel(level + 1) <= xp) level += 1
  const start = xpForLevel(level)
  const span = xpForLevel(level + 1) - start
  const into = xp - start
  return { level, title: levelTitle(level), into, span, toNext: span - into, progress: span ? into / span : 0 }
}

/** The next title ahead, for "Sv 8'de Fosforlu Kalem olursun". */
export function nextTitle(level: number): { level: number; title: string } | null {
  const next = TITLES.find(([from]) => from > level)
  return next ? { level: next[0], title: next[1] } : null
}
