import { hasUniversity, LEVELS, type Level } from './studentType'
import { useStore } from './store'
import { supabase } from './supabase'

/*
 * Who the student is, in a few words: level (ortaokul … mezun); for university students the school,
 * department and year; optionally birth year, gender and how they heard of StudyMode. Asked once
 * after signing up (EducationPrompt), editable in Settings, kept on the account
 * (user_metadata.education) so the admin page can show it (database function admin_schools).
 * Version 2 added department, year and the "about you" step; older answers are asked to complete it.
 */

export const EDUCATION_VERSION = 2

export type Gender = 'kadin' | 'erkek' | 'belirtmek-istemiyorum'
export const GENDERS: Array<{ id: Gender; label: string }> = [
  { id: 'kadin', label: 'Kadın' },
  { id: 'erkek', label: 'Erkek' },
  { id: 'belirtmek-istemiyorum', label: 'Belirtmek istemiyorum' },
]

export const HEARD_FROM = ['Arkadaşım önerdi', 'Instagram', 'TikTok', 'Okul / sınıf grubu', 'Google', 'Diğer'] as const

export const UNI_YEARS = ['Hazırlık', '1. sınıf', '2. sınıf', '3. sınıf', '4. sınıf', '5. sınıf', '6. sınıf', 'Uzatma'] as const
export const GRAD_YEARS = ['Yüksek lisans 1. yıl', 'Yüksek lisans 2. yıl / tez', 'Doktora (ders)', 'Doktora (tez)'] as const

/** Common departments, offered as suggestions; anything else can be typed. */
export const DEPARTMENTS = [
  'Bilgisayar Mühendisliği', 'Yazılım Mühendisliği', 'Elektrik-Elektronik Mühendisliği', 'Makine Mühendisliği', 'Endüstri Mühendisliği', 'İnşaat Mühendisliği',
  'Kimya Mühendisliği', 'Mimarlık', 'İç Mimarlık', 'Tıp', 'Diş Hekimliği', 'Eczacılık', 'Hemşirelik', 'Fizyoterapi', 'Beslenme ve Diyetetik', 'Veterinerlik',
  'Hukuk', 'İşletme', 'İktisat', 'Uluslararası İlişkiler', 'Siyaset Bilimi ve Kamu Yönetimi', 'Psikoloji', 'Sosyoloji', 'Tarih', 'Türk Dili ve Edebiyatı',
  'İngiliz Dili ve Edebiyatı', 'Mütercim-Tercümanlık', 'Matematik', 'Fizik', 'Kimya', 'Moleküler Biyoloji ve Genetik', 'Biyoloji', 'İletişim', 'Gazetecilik',
  'Grafik Tasarım', 'Sınıf Öğretmenliği', 'İngilizce Öğretmenliği', 'Matematik Öğretmenliği', 'Rehberlik ve Psikolojik Danışmanlık', 'Turizm', 'Bankacılık ve Finans',
]

export interface Education {
  level: Level
  /** Short school name ("ODTÜ"); empty unless the level has a university. */
  school: string
  department: string
  classYear: string
  birthYear: number | null
  gender: Gender | null
  heardFrom: string | null
  v: number
  at: string
}

export const EDUCATION_KEY = 'education'

const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function parseEducation(value: unknown): Education | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (!LEVELS.some((l) => l.id === v.level)) return null
  const level = v.level as Level
  const uni = hasUniversity(level)
  const year = Number(v.birthYear)
  return {
    level,
    school: uni ? str(v.school) : '',
    department: uni ? str(v.department) : '',
    classYear: uni ? str(v.classYear, 40) : '',
    birthYear: Number.isInteger(year) && year > 1900 && year < 2100 ? year : null,
    gender: GENDERS.some((g) => g.id === v.gender) ? (v.gender as Gender) : null,
    heardFrom: str(v.heardFrom, 40) || null,
    v: typeof v.v === 'number' ? v.v : 1,
    at: typeof v.at === 'string' ? v.at : '',
  }
}

/** Something is still missing: never answered, an older version, or a university student without department/year. */
export function needsEducation(e: Education | null): boolean {
  if (!e) return true
  if (e.v < EDUCATION_VERSION) return true
  return hasUniversity(e.level) && (!e.school || !e.department || !e.classYear)
}

export function educationLabel(e: Education): string {
  const level = LEVELS.find((l) => l.id === e.level)?.label ?? ''
  return hasUniversity(e.level) ? [e.school, e.department, e.classYear].filter(Boolean).join(' · ') || level : level
}

/** The signed-in student's answers, or null (signed out, or not answered yet). */
export function useEducation(): Education | null {
  const { session } = useStore()
  return parseEducation((session?.user.user_metadata as Record<string, unknown> | undefined)?.[EDUCATION_KEY])
}

export type EducationInput = Omit<Education, 'v' | 'at'>

/** Saves it on the account (other profile fields are kept: Supabase merges top-level keys). */
export async function saveEducation(input: EducationInput, now = new Date()): Promise<Education> {
  const uni = hasUniversity(input.level)
  const education: Education = {
    level: input.level,
    school: uni ? input.school.trim().slice(0, 80) : '',
    department: uni ? input.department.trim().slice(0, 80) : '',
    classYear: uni ? input.classYear : '',
    birthYear: input.birthYear,
    gender: input.gender,
    heardFrom: input.heardFrom,
    v: EDUCATION_VERSION,
    at: now.toISOString(),
  }
  if (!supabase) throw new Error('Bu sürüm sunucuya bağlı değil.')
  const { error } = await supabase.auth.updateUser({ data: { [EDUCATION_KEY]: education } })
  if (error) throw error
  return education
}

// "Şimdi değil": asked again after a few days, per account and device.
const LATER_DAYS = 3
const laterKey = (userId: string) => `studymode.education.later.${userId}`

export function askLater(userId: string, now = Date.now()) {
  try {
    localStorage.setItem(laterKey(userId), String(now))
  } catch {
    // Without storage it simply asks again next time.
  }
}

export function askedRecently(userId: string, now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(laterKey(userId)))
    return !!at && now - at < LATER_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

/** Age groups for the admin summary (only counts are shown, never one person's age). */
export function ageGroup(birthYear: number | null, now = new Date()): string | null {
  if (!birthYear) return null
  const age = now.getFullYear() - birthYear
  if (age < 15) return '15 altı'
  if (age <= 18) return '15-18'
  if (age <= 22) return '19-22'
  if (age <= 26) return '23-26'
  return '27+'
}
