import { daysUntil, isDue } from './srs'
import type { Card, Course, StudyData } from './types'

export function examLabel(examDate: string | null, now = new Date()): { text: string; tone: 'danger' | 'warning' | 'neutral' } | null {
  const days = daysUntil(examDate, now)
  if (days === null || days < 0) return null
  if (days === 0) return { text: 'Sınav bugün', tone: 'danger' }
  if (days === 1) return { text: 'Sınav yarın', tone: 'danger' }
  if (days <= 7) return { text: `Sınava ${days} gün`, tone: 'warning' }
  return { text: `Sınava ${days} gün`, tone: 'neutral' }
}

export function relativeDate(iso: string, now = new Date()): string {
  const diff = now.getTime() - Date.parse(iso)
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'az önce'
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} saat önce`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

export function dueCards(cards: Card[], now = new Date()): Card[] {
  return cards.filter((card) => isDue(card, now)).sort((a, b) => Date.parse(a.due) - Date.parse(b.due))
}

export function courseStats(data: StudyData, course: Course, now = new Date()) {
  const cards = data.cards.filter((c) => c.courseId === course.id)
  return {
    notes: data.notes.filter((n) => n.courseId === course.id).length,
    cards: cards.length,
    due: cards.filter((c) => isDue(c, now)).length,
  }
}

export const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length
export const readingMinutes = (text: string) => Math.max(1, Math.ceil(wordCount(text) / 180))


/** Cards reviewed into an interval of three weeks or more count as mastered. */
export const MASTERED_DAYS = 21

export function cardMastery(cards: Card[]) {
  let fresh = 0
  let learning = 0
  let mastered = 0
  for (const card of cards) {
    if (card.reps === 0 && card.lapses === 0) fresh += 1
    else if (card.interval >= MASTERED_DAYS) mastered += 1
    else learning += 1
  }
  const total = cards.length
  return { fresh, learning, mastered, total, percent: total ? Math.round((mastered / total) * 100) : 0 }
}
