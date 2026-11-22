/**
 * The national exam a school student works towards, with its official date, for a countdown on
 * Bugün: YKS for lise, LGS for ortaokul. Dates from the official 2027 calendars:
 * - YKS (ÖSYM): TYT 19 June 2027, AYT and YDT 20 June 2027.
 * - LGS (MEB, 2027 sınav uygulama takvimi): merkezî sınav 13 June 2027.
 * Update these each autumn when the new calendars come out.
 */

export interface BigExam {
  id: 'yks' | 'lgs'
  name: string
  /** "YKS'ye" */
  dative: string
  /** First day, YYYY-MM-DD. */
  date: string
  detail: string
}

export const BIG_EXAMS: Record<BigExam['id'], BigExam> = {
  yks: { id: 'yks', name: 'YKS', dative: 'YKS’ye', date: '2027-06-19', detail: 'TYT 19 Haziran, AYT ve YDT 20 Haziran 2027' },
  lgs: { id: 'lgs', name: 'LGS', dative: 'LGS’ye', date: '2027-06-13', detail: 'Merkezî sınav 13 Haziran 2027' },
}

export function bigExamFor(level: string | null | undefined): BigExam | null {
  if (level === 'lise') return BIG_EXAMS.yks
  if (level === 'ortaokul') return BIG_EXAMS.lgs
  return null
}

/** Whole days from today (local) to the exam day; null once the exam day has passed. */
export function daysToBigExam(exam: BigExam, now = new Date()): number | null {
  const [y, m, d] = exam.date.split('-').map(Number)
  const examDay = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((examDay.getTime() - today.getTime()) / 86_400_000)
  return days < 0 ? null : days
}

/** "YKS’ye 209 gün", "YKS yarın", "YKS bugün"; null after the exam. */
export function bigExamCountdown(exam: BigExam, now = new Date()): string | null {
  const days = daysToBigExam(exam, now)
  if (days === null) return null
  if (days === 0) return `${exam.name} bugün`
  if (days === 1) return `${exam.name} yarın`
  return `${exam.dative} ${days} gün`
}

// "Benim sınavım değil" (a 9th grader, say): hidden on this device until the next exam year.
const HIDE_KEY = 'studymode.bigExam.hidden'

export function bigExamHidden(exam: BigExam): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === `${exam.id}:${exam.date}`
  } catch {
    return false
  }
}

export function hideBigExam(exam: BigExam) {
  try {
    localStorage.setItem(HIDE_KEY, `${exam.id}:${exam.date}`)
  } catch {
    // Blocked storage: hidden for this visit only.
  }
}
