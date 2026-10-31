import { supabase } from './supabase'

/*
 * A direct line from the people using StudyMode to the maker: ideas and bug reports they type,
 * and errors their browser runs into. Both go to Supabase tables anyone may add to but nobody can
 * read through the API (the maker reads them in Supabase). Nothing here should ever break the app.
 */

export type FeedbackKind = 'fikir' | 'hata' | 'diger'

const LAST_SENT_KEY = 'studymode.feedbackSentAt'
/** A short pause between two messages, against accidental double sends. */
export const FEEDBACK_COOLDOWN_MS = 20_000

const device = () => (typeof navigator === 'undefined' ? null : `${navigator.userAgent} · ${window.innerWidth}x${window.innerHeight}`.slice(0, 300))
const page = () => (typeof location === 'undefined' ? null : `${location.pathname}${location.search}`.slice(0, 200))

export class FeedbackError extends Error {}

function lastSentAt(): number {
  try {
    return Number(localStorage.getItem(LAST_SENT_KEY)) || 0
  } catch {
    return 0
  }
}

export async function sendFeedback(input: { kind: FeedbackKind; message: string; contact?: string }) {
  const message = input.message.trim()
  if (message.length < 3) throw new FeedbackError('Biraz daha yazar mısın?')
  if (message.length > 2000) throw new FeedbackError('Mesaj çok uzun; 2000 karakteri geçmesin.')
  if (Date.now() - lastSentAt() < FEEDBACK_COOLDOWN_MS) throw new FeedbackError('Az önce gönderdin; birkaç saniye bekleyip yeniden dene.')
  if (!supabase) throw new FeedbackError('Bu sürüm sunucuya bağlı değil; mesaj gönderilemiyor.')
  const { error } = await supabase.from('feedback').insert({
    kind: input.kind,
    message,
    contact: input.contact?.trim().slice(0, 120) || null,
    page: page(),
    device: device(),
  })
  if (error) {
    if (['PGRST205', '42P01'].includes(error.code ?? '')) throw new FeedbackError('Geri bildirim henüz hazır değil; biraz sonra yeniden dene.')
    throw new FeedbackError('Gönderilemedi. İnternet bağlantını kontrol edip yeniden dene.')
  }
  try {
    localStorage.setItem(LAST_SENT_KEY, String(Date.now()))
  } catch {
    // The pause is a convenience.
  }
}

// ---------- Errors seen in the browser ----------

const MAX_REPORTS = 5
const reported = new Set<string>()

/** Local development and tests never report. */
const isLocal = () => typeof location === 'undefined' || ['localhost', '127.0.0.1', ''].includes(location.hostname)

/** Sends one error, at most once per message and five per visit. Never throws. */
export function reportError(error: unknown, extra?: string) {
  try {
    if (isLocal() || !supabase || reported.size >= MAX_REPORTS) return
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error))
    const message = `${err.name}: ${err.message}`.slice(0, 500) || 'Bilinmeyen hata'
    // Browser extensions and lost connections are not our bugs.
    if (/ResizeObserver loop|Script error\.?$|Failed to fetch|Load failed|NetworkError/i.test(message)) return
    if (reported.has(message)) return
    reported.add(message)
    void supabase
      .from('client_errors')
      .insert({ message, stack: `${err.stack ?? ''}${extra ? `\n--\n${extra}` : ''}`.slice(0, 4000) || null, page: page(), device: device(), release: (import.meta.env.VITE_RELEASE as string | undefined)?.slice(0, 40) ?? null })
      .then(
        () => undefined,
        () => undefined,
      )
  } catch {
    // Reporting must never cause a second error.
  }
}

export function installErrorReporting() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => reportError(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason))
}
