import { isGoogleEnabled } from './auth'
import { captchaSiteKey, loadTurnstile } from './captcha'
import { GOOGLE_CLIENT_ID, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import { loadGoogle } from './googleSignIn'

/*
 * The sign-in page waits on three outside things: Supabase's "is Google on?", Google's script (then
 * its button) and Cloudflare's bot check. Fetched only when the page opened, one after another,
 * Google's button showed up 2-3 s late. They now start as soon as someone heads for sign-in (hover,
 * touch or focus on a link to /giris), so the page usually opens with them ready. Nobody's visit
 * reaches Google or Cloudflare before they show that intent.
 */

let warmed = false

export function warmUpSignIn() {
  if (warmed || typeof window === 'undefined') return
  warmed = true
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) void isGoogleEnabled(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  if (GOOGLE_CLIENT_ID) void loadGoogle().catch(() => {})
  if (captchaSiteKey()) void loadTurnstile().catch(() => {})
}

/** Warms up when a pointer or keyboard reaches any link to the sign-in page. */
export function installSignInWarmup() {
  if (typeof document === 'undefined') return
  const onIntent = (event: Event) => {
    const target = event.target as Element | null
    if (target?.closest?.('a[href^="/giris"]')) warmUpSignIn()
  }
  for (const type of ['pointerover', 'pointerdown', 'touchstart', 'focusin']) {
    document.addEventListener(type, onIntent, { passive: true, capture: true })
  }
}
