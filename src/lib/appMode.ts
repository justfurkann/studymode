import type { ReactNode } from 'react'

/*
 * App mode: the iPhone (and later the Android) app opens a few site pages in a browser view (Kullanım
 * koşulları, Gizlilik, /ogrenci-tipi, /rehber, /hesap-sil) with `?app=ios` or `?app=android` in the
 * address. Store rules (Apple 3.1.1, Google Play payments) do not allow a way from the app to an outside
 * payment, so in this mode the site shows no Premium/Fiyatlar links, no Premium pop-up, no buy buttons
 * and no Shopier links. Without the parameter nothing changes.
 *
 * The parameter is only on the first address; the site's own links drop it. So it is kept in
 * sessionStorage for the rest of that browser tab. Storage that cannot be used is skipped quietly
 * (the mode then lasts only for the first page, which is the page the app opened).
 */

export type AppPlatform = 'ios' | 'android'

export const APP_MODE_KEY = 'studymode.appMode'

const PLATFORMS: readonly AppPlatform[] = ['ios', 'android']

const isPlatform = (value: unknown): value is AppPlatform => PLATFORMS.includes(value as AppPlatform)

/** `?app=ios` → 'ios'. Anything else (no parameter, `app=web`, `app=IOS ` is accepted loosely) → null. */
export function parseAppParam(search: string): AppPlatform | null {
  const value = new URLSearchParams(search).get('app')?.trim().toLowerCase()
  return isPlatform(value) ? value : null
}

/** The few storage calls the mode needs, so tests can pass a fake or a throwing one. */
export interface ModeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * The platform for this visit: from the address (and then remembered), else what this tab remembered.
 * Never throws: a missing or blocked storage only means nothing is remembered.
 */
export function resolveAppMode(search: string, storage: ModeStorage | null): AppPlatform | null {
  const fromUrl = parseAppParam(search)
  if (fromUrl) {
    try {
      storage?.setItem(APP_MODE_KEY, fromUrl)
    } catch {
      // Private mode or blocked storage: the mode still holds for this page.
    }
    return fromUrl
  }
  try {
    const kept = storage?.getItem(APP_MODE_KEY)
    return isPlatform(kept) ? kept : null
  } catch {
    return null
  }
}

function sessionStore(): ModeStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

let current: AppPlatform | null | undefined

/** Reads the address once at start (main.tsx calls it before the first draw). */
export function initAppMode(): AppPlatform | null {
  current = typeof window === 'undefined' ? null : resolveAppMode(window.location.search, sessionStore())
  return current
}

/** 'ios' / 'android' when the site is open inside the app, otherwise null. */
export function appPlatform(): AppPlatform | null {
  if (current === undefined) initAppMode()
  return current ?? null
}

/** Whether buy links, Premium/Fiyatlar links and the Premium pop-up must stay hidden. */
export function isAppMode(): boolean {
  return appPlatform() !== null
}

/** For components. The mode is fixed for the whole visit, so this is a plain read (no state). */
export const useAppMode = isAppMode

/** Draws its children only on the normal site, never inside the app. */
export function NotInApp({ children }: { children: ReactNode }): ReactNode {
  return isAppMode() ? null : children
}

/** The short line shown instead of sales on /fiyatlar and /premium inside the app. */
export const APP_PREMIUM_NOTE: Record<AppPlatform, string> = {
  // The iPhone app sells Premium through the App Store.
  ios: 'Premium’u uygulamadan alabilirsin.',
  // The Android app does not sell it (yet): say nothing about where to buy.
  android: 'Premium bu uygulamada satılmıyor.',
}

/** The note for this platform; null on the normal site. */
export function appPremiumNote(platform: AppPlatform | null = appPlatform()): string | null {
  return platform ? APP_PREMIUM_NOTE[platform] : null
}

/** Only for tests: forget what was read so the next call reads again. */
export function resetAppModeForTests(): void {
  current = undefined
}
