import { useSyncExternalStore } from 'react'

/*
 * Every deploy renames the app's files and removes the old ones. A tab opened before a deploy
 * still points at the old names, so the first part it loads lazily (the AI code, the PDF reader)
 * fails with "Failed to fetch dynamically imported module". Here we notice that a newer version is
 * out, explain it in plain Turkish, and reload at a safe moment (when the student changes page),
 * never in the middle of something they typed.
 */

const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk [\w-]+ failed/i

export function isChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return CHUNK_ERROR.test(message)
}

export class StaleVersionError extends Error {
  constructor() {
    super('Uygulamanın yeni bir sürümü yayınlandı. Sayfayı yenileyip tekrar dene (yazdıkların kaybolmasın diye kendiliğinden yenilemiyoruz).')
    this.name = 'StaleVersionError'
  }
}

let updateAvailable = false
const listeners = new Set<() => void>()

export function markUpdateAvailable() {
  if (updateAvailable) return
  updateAvailable = true
  listeners.forEach((l) => l())
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => updateAvailable,
  )
}

/** Loads a lazily split part of the app; a part missing after a deploy becomes a clear message. */
export async function freshImport<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (isChunkError(error)) {
      markUpdateAvailable()
      throw new StaleVersionError()
    }
    throw error
  }
}

/** The main script of a built page, e.g. "/assets/index-AbC123.js"; null in development. */
export function entryFromHtml(html: string): string | null {
  return html.match(/<script[^>]+type="module"[^>]+src="(\/assets\/index-[\w-]+\.js)"/)?.[1] ?? html.match(/src="(\/assets\/index-[\w-]+\.js)"[^>]*type="module"/)?.[1] ?? null
}

function currentEntry(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')
  return script ? new URL(script.src).pathname : null
}

async function checkForUpdate() {
  try {
    const mine = currentEntry()
    if (!mine || updateAvailable) return
    const response = await fetch('/', { cache: 'no-store' })
    if (!response.ok) return
    const latest = entryFromHtml(await response.text())
    if (latest && latest !== mine) markUpdateAvailable()
  } catch {
    // Offline or blocked: try again later.
  }
}

/** Marks a reload that must not come from the browser's cache. */
const FRESH_PARAM = 'surum'

/**
 * Reloads the newest version. A plain reload could hand back the old page from the cache (seen on
 * an iPhone: "Yenile" kept showing the old version, which could not read files any more), so the
 * address gets a one-off mark the cache has never seen; it is removed again on start.
 */
export function reloadFresh() {
  const url = new URL(window.location.href)
  url.searchParams.set(FRESH_PARAM, Date.now().toString(36))
  window.location.replace(url.toString())
}

/** Looks for a newer version when the tab comes back into view and every 10 minutes. */
export function startUpdateChecks() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (url.searchParams.has(FRESH_PARAM)) {
    url.searchParams.delete(FRESH_PARAM)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }
  if (['localhost', '127.0.0.1'].includes(location.hostname)) return
  window.addEventListener('vite:preloadError', () => markUpdateAvailable())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
  window.setInterval(() => void checkForUpdate(), 10 * 60_000)
}
