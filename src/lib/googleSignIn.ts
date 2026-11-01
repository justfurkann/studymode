import { GOOGLE_CLIENT_ID } from './config'
import { supabase } from './supabase'

/*
 * "Sign in with Google" drawn by Google itself on studymode.fun (Google Identity Services).
 * The account chooser then says "studymode.fun'a devam et" instead of naming the Supabase
 * project address, which looked like a scam. Google hands us a signed ID token; Supabase checks
 * it (signInWithIdToken) and opens the session. A random nonce ties the token to this attempt.
 */

interface GsiCredential {
  credential: string
}

interface GoogleAccountsId {
  initialize(options: Record<string, unknown>): void
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void
  cancel(): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleAccountsId> | null = null

/** Loads Google's script once; rejects if it is blocked (ad blockers, some networks). */
export function loadGoogle(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('gsi missing')))
    script.onerror = () => reject(new Error('gsi blocked'))
    document.head.appendChild(script)
    window.setTimeout(() => reject(new Error('gsi timeout')), 10_000)
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
 * Draws Google's button into `parent`. `onDone` gets null on success (the session is open),
 * or a Turkish error message.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  options: { dark: boolean; width: number; onDone: (error: string | null) => void; captcha?: { token: () => string; used: () => void } },
) {
  const gsi = await loadGoogle()
  const nonce = randomNonce()
  gsi.initialize({
    client_id: GOOGLE_CLIENT_ID,
    // Google puts the hashed nonce into the token; Supabase checks it against the raw one.
    nonce: await sha256Hex(nonce),
    ux_mode: 'popup',
    use_fedcm_for_button: true,
    callback: async ({ credential }: GsiCredential) => {
      if (!supabase) return options.onDone('Bu sürüm sunucuya bağlı değil.')
      // With the bot check on, Supabase wants its token here too; it works once, so reset after.
      const captchaToken = options.captcha?.token()
      if (options.captcha && !captchaToken) return options.onDone('Önce aşağıdaki bot doğrulamasının işaretlenmesini bekle, sonra Google ile yeniden dene.')
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce, ...(captchaToken ? { options: { captchaToken } } : {}) })
      options.captcha?.used()
      options.onDone(error ? 'Google ile giriş tamamlanamadı. Biraz sonra yeniden dene ya da e-postanla devam et.' : null)
    },
  })
  parent.replaceChildren()
  gsi.renderButton(parent, {
    type: 'standard',
    theme: options.dark ? 'filled_black' : 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    locale: 'tr',
    width: Math.max(200, Math.min(400, Math.round(options.width))),
  })
}
