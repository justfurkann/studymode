import type { User } from '@supabase/supabase-js'

export const MIN_PASSWORD = 8

/**
 * "Hide my email" with Sign in with Apple gives addresses like abc123@privaterelay.appleid.com.
 * They work for e-mail (Apple forwards them) but mean nothing to a person reading them.
 */
export const isPrivateRelayEmail = (email: string | null | undefined) => !!email && /@privaterelay\.appleid\.com$/i.test(email.trim())

/** The address to show people: Apple's hidden relay address reads as "Apple (gizli e-posta)". */
export const emailLabel = (email: string | null | undefined) => (isPrivateRelayEmail(email) ? 'Apple (gizli e-posta)' : (email ?? ''))

/** Name to show for the signed-in user; falls back to the email for accounts created without a name. */
export function displayName(user: User | null | undefined): string {
  if (!user) return ''
  const meta = (user.user_metadata ?? {}) as { full_name?: unknown; name?: unknown; first_name?: unknown; last_name?: unknown }
  // Google sign-in fills full_name and name; our sign-up form fills first_name and last_name.
  const full = typeof meta.full_name === 'string' ? meta.full_name.trim() : typeof meta.name === 'string' ? meta.name.trim() : ''
  if (full) return full
  const parts = [meta.first_name, meta.last_name].filter((p): p is string => typeof p === 'string' && !!p.trim())
  return parts.length ? parts.join(' ').trim() : emailLabel(user.email)
}

export function firstName(user: User | null | undefined): string {
  const meta = (user?.user_metadata ?? {}) as { first_name?: unknown; given_name?: unknown; full_name?: unknown; name?: unknown }
  for (const value of [meta.first_name, meta.given_name]) if (typeof value === 'string' && value.trim()) return value.trim()
  const full = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : ''
  return full.trim().split(/\s+/)[0] ?? ''
}

let settingsCheck: Promise<{ google: boolean; apple: boolean }> | null = null

/** Which sign-in providers are switched on in Supabase (Authentication → Providers). Asked once. */
export function authProviders(url: string, key: string, fetchImpl: typeof fetch = fetch): Promise<{ google: boolean; apple: boolean }> {
  settingsCheck ??= fetchImpl(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then((r) => (r.ok ? r.json() : null))
    .then((body: { external?: { google?: boolean; apple?: boolean } } | null) => ({ google: body?.external?.google === true, apple: body?.external?.apple === true }))
    .catch(() => ({ google: false, apple: false }))
  return settingsCheck
}

/**
 * Whether "Google ile devam et" is switched on in Supabase (Authentication → Providers → Google).
 * Asked once; the button stays hidden until the provider is set up, so it never leads to an error.
 */
export function isGoogleEnabled(url: string, key: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  return authProviders(url, key, fetchImpl).then(({ google }) => {
    try {
      localStorage.setItem(GOOGLE_HINT_KEY, google ? '1' : '0')
    } catch {
      // Private mode: no hint next time, nothing else changes.
    }
    return google
  })
}

const GOOGLE_HINT_KEY = 'studymode.googleEnabled'

/** What the last check said (true/false), or null if there was none on this device. */
export function googleEnabledHint(): boolean | null {
  try {
    const v = localStorage.getItem(GOOGLE_HINT_KEY)
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
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
  if (/captcha/i.test(message)) return 'Bot doğrulaması geçilemedi ya da süresi doldu. Kutunun yeniden işaretlenmesini bekleyip tekrar dene.'
  if (/fetch|network/i.test(message)) return 'Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.'
  return message || 'Bir şeyler ters gitti. Tekrar dene.'
}
