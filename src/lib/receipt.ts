import { upcomingExams } from './courseExams'
import { computeStreakSummary, localDayKey, mergeStudyDays, shiftLocalDay } from './streak'
import type { StudyData } from './types'

/*
 * "Çalışma fişi": the student's study session printed like a till receipt, to share as a story.
 * This file only decides what the receipt says (pure, tested); ReceiptCard draws it.
 */

export type ReceiptPeriod = 'gun' | 'hafta'

export interface ReceiptLine {
  qty: string
  label: string
  value: string
}

export interface Receipt {
  title: string
  date: string
  time: string
  register: string
  lines: ReceiptLine[]
  total: ReceiptLine
  verdict: string
  footer: string
  /** Nothing studied in the period: the card says so instead of a sad empty receipt. */
  empty: boolean
  /** Seed for the barcode, so the same receipt always gets the same bars. */
  code: string
}

export interface FocusLog {
  /** Focus minutes per local day (YYYY-MM-DD). */
  focus: Record<string, number>
  /** Finished focus rounds per local day. */
  rounds: Record<string, number>
}

/** Turkish upper case, monospace friendly ("i" → "İ"). */
const up = (text: string) => text.toLocaleUpperCase('tr-TR')

/** Hours 0-4 count as "the night shift". */
export const isNightOwlHour = (date: Date) => date.getHours() < 5

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function dayKeys(period: ReceiptPeriod, now: Date): string[] {
  const today = localDayKey(now)
  return period === 'gun' ? [today] : Array.from({ length: 7 }, (_, i) => shiftLocalDay(today, -i))
}

function hash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString().padStart(10, '0')
}

function register(data: StudyData, now: Date): string {
  const next = upcomingExams(data, now)[0]
  if (next && next.days <= 14) {
    const kind = next.exam.kind === 'final' ? 'FİNAL' : next.exam.kind === 'butunleme' ? 'BÜTÜNLEME' : next.exam.kind === 'quiz' ? 'QUIZ' : 'VİZE'
    return next.days <= 3 ? `#${kind}-ACISI` : `#${kind}-HAFTASI`
  }
  return isNightOwlHour(now) ? '#GECE-VARDİYASI' : '#ÇALIŞMA'
}

function verdict(effort: number, avg: number | null, now: Date): string {
  if (effort === 0) return 'MENTAL HASAR: HENÜZ YOK. BAŞLA DA OLSUN.'
  if (isNightOwlHour(now)) return 'MENTAL HASAR: YÜKSEK AMA GEÇECEK'
  if (avg !== null && avg >= 0.85) return 'DURUM: KONUYU YEDİN BİTİRDİN'
  if (effort >= 120) return 'MENTAL HASAR: YÜKSEK AMA GEÇECEK'
  if (effort >= 40) return 'DURUM: ISINDIN, DEVAM'
  return 'DURUM: AZ AMA ÖZ'
}

export function buildReceipt(data: StudyData, period: ReceiptPeriod, focusLog: FocusLog, now: Date = new Date()): Receipt {
  const keys = new Set(dayKeys(period, now))
  const inPeriod = (iso: string) => keys.has(localDayKey(new Date(iso)))

  const days = mergeStudyDays(data.studyDays).filter((d) => keys.has(d.day))
  const reviews = days.reduce((sum, d) => sum + d.reviews, 0)
  const focusMinutes = [...keys].reduce((sum, k) => sum + (focusLog.focus[k] ?? 0), 0)
  const rounds = [...keys].reduce((sum, k) => sum + (focusLog.rounds[k] ?? 0), 0)
  const attempts = data.attempts.filter((a) => inPeriod(a.createdAt) && a.total > 0)
  const exams = data.exams.filter((e) => inPeriod(e.createdAt) && e.total > 0)

  // Cards touched in the period, per course: the closest thing to "which course did I study".
  const perCourse = new Map<string, number>()
  for (const card of data.cards) {
    if (card.reps > 0 && inPeriod(card.updatedAt)) perCourse.set(card.courseId, (perCourse.get(card.courseId) ?? 0) + 1)
  }
  for (const a of attempts) if (!perCourse.has(a.courseId)) perCourse.set(a.courseId, 0)
  for (const e of exams) if (!perCourse.has(e.courseId)) perCourse.set(e.courseId, 0)
  const courseName = (id: string) => data.courses.find((c) => c.id === id)?.name ?? 'Ders'

  const lines: ReceiptLine[] = []
  const courses = [...perCourse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  for (const [id, count] of courses) lines.push({ qty: '1x', label: up(clip(courseName(id), 18)), value: count ? `${count} KART` : 'ÇALIŞILDI' })
  if (perCourse.size > courses.length) lines.push({ qty: `${perCourse.size - courses.length}x`, label: 'DİĞER DERS', value: 'ÇALIŞILDI' })

  if (reviews) lines.push({ qty: `${reviews}x`, label: 'ÇEVRİLEN KART', value: `${reviews} TEKRAR` })
  const scored = [...attempts.map((a) => a.score / a.total), ...exams.map((e) => e.score / e.total)]
  const avg = scored.length ? scored.reduce((s, x) => s + x, 0) / scored.length : null
  if (attempts.length) {
    const p = Math.round((attempts.reduce((s, a) => s + a.score / a.total, 0) / attempts.length) * 100)
    lines.push({ qty: `${attempts.length}x`, label: 'TEST', value: `%${p}` })
  }
  if (exams.length) {
    const p = Math.round((exams.reduce((s, e) => s + e.score / e.total, 0) / exams.length) * 100)
    lines.push({ qty: `${exams.length}x`, label: 'SINAV PROVASI', value: `%${p}` })
  }
  if (focusMinutes) lines.push({ qty: '1x', label: 'ODAK SÜRESİ', value: `${focusMinutes} DK` })
  if (rounds) lines.push({ qty: `${rounds}x`, label: 'KAHVE MOLASI', value: '0,00 TL' })

  const streak = computeStreakSummary(data.studyDays, 20, now).streak
  if (streak > 1) lines.push({ qty: '', label: 'SERİ', value: `${streak} GÜN` })

  // A rough "effort" so the verdict scales: a card is a unit, a test ten, a focus minute one.
  const effort = reviews + (attempts.length + exams.length) * 10 + focusMinutes
  const empty = effort === 0 && perCourse.size === 0

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const date = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return {
    title: period === 'gun' ? 'GÜNLÜK ÇALIŞMA FİŞİ' : 'HAFTALIK ÇALIŞMA FİŞİ',
    date,
    time: isNightOwlHour(now) ? `GECE ${hh}:${mm}` : `${hh}:${mm}`,
    register: register(data, now),
    lines,
    total: { qty: '', label: 'TOPLAM EMEK', value: `${effort} PUAN` },
    verdict: verdict(effort, avg, now),
    footer: 'FİŞİ SAKLAYINIZ, SINAVDA LAZIM OLUR',
    empty,
    code: hash(`${date}|${hh}${mm}|${effort}|${lines.map((l) => l.label + l.value).join()}`),
  }
}

/** "1x HÜCRE BİYOLOJİSİ ....... 45 DK" padded to `width` characters. */
export function formatLine(line: ReceiptLine, width = 34): string {
  const left = `${line.qty ? `${line.qty} ` : ''}${line.label}`
  const dots = Math.max(2, width - left.length - line.value.length - 2)
  return `${left} ${'.'.repeat(dots)} ${line.value}`
}
