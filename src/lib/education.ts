import { hasUniversity, LEVELS, type Level } from './studentType'
import { useStore } from './store'
import { supabase } from './supabase'

/*
 * Where the student studies: level (ortaokul … mezun) and, for university students, the school.
 * Asked once after signing up (EducationPrompt), editable in Settings, kept on the account
 * (user_metadata.education) so the admin page can show it (database function admin_schools).
 */

export interface Education {
  level: Level
  /** Short school name ("ODTÜ"); empty unless the level has a university. */
  school: string
  at: string
}

export const EDUCATION_KEY = 'education'

export function parseEducation(value: unknown): Education | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<Education>
  if (!LEVELS.some((l) => l.id === v.level)) return null
  const level = v.level as Level
  return { level, school: hasUniversity(level) && typeof v.school === 'string' ? v.school.slice(0, 80) : '', at: typeof v.at === 'string' ? v.at : '' }
}

export function educationLabel(e: Education): string {
  const level = LEVELS.find((l) => l.id === e.level)?.label ?? ''
  return e.school ? `${e.school} · ${level}` : level
}

/** The signed-in student's school info, or null (signed out, or not answered yet). */
export function useEducation(): Education | null {
  const { session } = useStore()
  return parseEducation((session?.user.user_metadata as Record<string, unknown> | undefined)?.[EDUCATION_KEY])
}

/** Saves it on the account (other profile fields are kept: Supabase merges top-level keys). */
export async function saveEducation(level: Level, school: string, now = new Date()): Promise<Education> {
  const education: Education = { level, school: hasUniversity(level) ? school.trim().slice(0, 80) : '', at: now.toISOString() }
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
