import { nameMetadata } from './auth'
import { APPLE_REDIRECT_URI, APPLE_SERVICES_ID } from './config'
import { supabase } from './supabase'

/*
 * "Apple ile devam et" on the website. Apple's own sign-in script opens Apple's window (popup), and
 * hands back a signed ID token; Supabase checks it (signInWithIdToken), just like Google's button and
 * the iOS app. So Supabase needs no Apple secret key, and nothing expires every six months.
 * Apple tells us the person's name only on their very first sign-in, so we save it right away.
 */

interface AppleSignInResponse {
  authorization?: { id_token?: string; code?: string }
  user?: { name?: { firstName?: string; lastName?: string }; email?: string }
}

interface AppleIdAuth {
  init(options: Record<string, unknown>): void
  signIn(): Promise<AppleSignInResponse>
}

declare global {
  interface Window {
    AppleID?: { auth?: AppleIdAuth }
  }
}

const SCRIPT = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/tr_TR/appleid.auth.js'
let loading: Promise<AppleIdAuth> | null = null

/** Apple only signs in from the address registered on the Services ID (and tests force it on). */
export function appleWebAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (localStorage.getItem('studymode.apple.force') === '1') return true
  } catch {
    // Private mode: fall through.
  }
  return !!APPLE_SERVICES_ID && window.location.origin === new URL(APPLE_REDIRECT_URI).origin
}

export function loadApple(): Promise<AppleIdAuth> {
  if (window.AppleID?.auth) return Promise.resolve(window.AppleID.auth)
  loading ??= new Promise<AppleIdAuth>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.AppleID?.auth ? resolve(window.AppleID.auth) : reject(new Error('apple missing')))
    script.onerror = () => reject(new Error('apple blocked'))
    document.head.appendChild(script)
    window.setTimeout(() => reject(new Error('apple timeout')), 10_000)
  }).catch((error) => {
    loading = null
    throw error
  })
  return loading
}

function randomNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Gets Apple ready for the next tap. Apple's window must open straight from the tap (or Safari
 * blocks it), so the script and a fresh nonce are prepared before, not on click.
 * Returns the raw nonce Supabase will check the token against.
 */
export async function prepareApple(): Promise<{ auth: AppleIdAuth; nonce: string }> {
  const auth = await loadApple()
  const nonce = randomNonce()
  auth.init({
    clientId: APPLE_SERVICES_ID || 'fun.studymode.web',
    scope: 'name email',
    redirectURI: APPLE_REDIRECT_URI,
    // Apple puts the hashed nonce into the token; Supabase checks it against the raw one.
    nonce: await sha256Hex(nonce),
    usePopup: true,
  })
  return { auth, nonce }
}

const CANCELLED = /popup_closed_by_user|user_cancelled_authorize|user_trigger_new_signin_flow/

/**
 * Runs the sign-in. Resolves null when the session is open (or the person closed Apple's window:
 * `cancelled`), otherwise a Turkish error message.
 */
export async function signInWithApple(
  prepared: { auth: AppleIdAuth; nonce: string },
  captcha?: { token: () => string; used: () => void },
): Promise<{ error: string | null; cancelled?: boolean }> {
  if (!supabase) return { error: 'Bu sürüm sunucuya bağlı değil.' }
  const captchaToken = captcha?.token()
  if (captcha && !captchaToken) return { error: 'Önce aşağıdaki bot doğrulamasının işaretlenmesini bekle, sonra Apple ile yeniden dene.' }
  let response: AppleSignInResponse
  try {
    response = await prepared.auth.signIn()
  } catch (e) {
    const code = (e as { error?: string })?.error ?? (e instanceof Error ? e.message : '')
    if (CANCELLED.test(code)) return { error: null, cancelled: true }
    return { error: 'Apple ile giriş başlatılamadı. Biraz sonra yeniden dene ya da e-postanla devam et.' }
  }
  const token = response.authorization?.id_token
  if (!token) return { error: 'Apple ile giriş tamamlanamadı. Yeniden dene.' }
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce: prepared.nonce, ...(captchaToken ? { options: { captchaToken } } : {}) })
  captcha?.used()
  if (error) return { error: 'Apple ile giriş tamamlanamadı. Biraz sonra yeniden dene ya da e-postanla devam et.' }
  // First sign-in only: Apple sends the name once. Keep a name someone already set.
  const first = response.user?.name?.firstName?.trim() ?? ''
  const last = response.user?.name?.lastName?.trim() ?? ''
  const meta = (data.user?.user_metadata ?? {}) as { full_name?: string; first_name?: string }
  if ((first || last) && !meta.full_name?.trim() && !meta.first_name?.trim()) {
    await supabase.auth.updateUser({ data: nameMetadata(first, last) }).catch(() => undefined)
  }
  return { error: null }
}
