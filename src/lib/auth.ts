import type { User } from '@supabase/supabase-js'

export const MIN_PASSWORD = 8

/** Name to show for the signed-in user; falls back to the email for accounts created without a name. */
export function displayName(user: User | null | undefined): string {
  if (!user) return ''
  const meta = (user.user_metadata ?? {}) as { full_name?: unknown; first_name?: unknown; last_name?: unknown }
  const full = typeof meta.full_name === 'string' ? meta.full_name.trim() : ''
  if (full) return full
  const parts = [meta.first_name, meta.last_name].filter((p): p is string => typeof p === 'string' && !!p.trim())
  return parts.length ? parts.join(' ').trim() : (user.email ?? '')
}

export function firstName(user: User | null | undefined): string {
  const meta = (user?.user_metadata ?? {}) as { first_name?: unknown }
  return typeof meta.first_name === 'string' ? meta.first_name.trim() : ''
}

export function nameMetadata(first: string, last: string) {
  const firstName = first.trim()
  const lastName = last.trim()
  return { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim() }
}

/** Returns a message for the first problem with a new password, or '' if it is fine. */
export function passwordProblem(password: string, repeat: string): string {
  if (password.length < MIN_PASSWORD) return `Şifre en az ${MIN_PASSWORD} karakter olmalı.`
  if (password !== repeat) return 'Şifreler aynı değil.'
  return ''
}

/** Turns Supabase auth errors into Turkish messages a student can act on. */
export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/invalid login credentials/i.test(message)) return 'E-posta veya şifre hatalı.'
  if (/email not confirmed/i.test(message)) return 'E-postanı henüz onaylamadın. Gelen kutunu (ve gereksiz klasörünü) kontrol et.'
  if (/already registered|already been registered/i.test(message)) return 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.'
  if (/rate limit|too many|after \d+ seconds/i.test(message)) return 'Çok fazla deneme yapıldı. Birkaç dakika bekleyip tekrar dene.'
  if (/should be different|same as the old/i.test(message)) return 'Yeni şifre eskisiyle aynı olamaz.'
  if (/password/i.test(message) && /(weak|short|characters)/i.test(message)) return `Şifre çok zayıf. En az ${MIN_PASSWORD} karakter kullan.`
  if (/expired|invalid.*(link|token)|otp/i.test(message)) return 'Bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeni bir bağlantı iste.'
  if (/fetch|network/i.test(message)) return 'Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.'
  return message || 'Bir şeyler ters gitti. Tekrar dene.'
}
