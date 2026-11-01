import { TURNSTILE_SITE_KEY } from './config'

/*
 * Cloudflare Turnstile, the bot check Supabase verifies on sign-in, sign-up and password reset.
 * Off until a site key is set in config.ts. The key only works on the domains it was made for, so
 * on localhost (development, the tests) it stays off unless a test asks for it with
 * `studymode.captcha.force` and provides its own stand-in for the script.
 */

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const FORCE_KEY = 'studymode.captcha.force'

export interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

function forced(): string | null {
  try {
    return localStorage.getItem(FORCE_KEY)
  } catch {
    return null
  }
}

/** The site key in use, or '' when the bot check is off here. */
export function captchaSiteKey(): string {
  const force = forced()
  if (force) return force
  if (!TURNSTILE_SITE_KEY) return ''
  const host = typeof location === 'undefined' ? '' : location.hostname
  return host === 'localhost' || host === '127.0.0.1' ? '' : TURNSTILE_SITE_KEY
}

let loading: Promise<Turnstile> | null = null

export function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    script.onerror = () => reject(new Error('turnstile blocked'))
    document.head.appendChild(script)
    window.setTimeout(() => reject(new Error('turnstile timeout')), 15_000)
  }).catch((error) => {
    loading = null
    throw error
  })
  return loading
}
