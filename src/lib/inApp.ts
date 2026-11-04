/*
 * Apps that open links inside themselves (Instagram, Facebook, TikTok...) show the site in a cut-down
 * browser: file pickers, Google sign-in and staying signed in all work worse there. On Android we
 * can hand the page to Chrome with an intent link; on iPhone only the app's own menu can, so we say
 * where it is. Meta changes this behaviour now and then, so it is a best effort, never a wall.
 */

export type InAppPlatform = 'android' | 'ios' | 'other'

export interface InApp {
  /** The app's name for the message, or '' for an unnamed Android web view. */
  app: string
  platform: InAppPlatform
}

const APPS: Array<[RegExp, string]> = [
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, 'Facebook'],
  [/musical_ly|TikTok|BytedanceWebview|trill/i, 'TikTok'],
  [/Snapchat/i, 'Snapchat'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/Twitter/i, 'X'],
  [/\bLine\//i, 'LINE'],
]

/** The in-app browser a user agent belongs to, or null in a normal browser. */
export function detectInApp(ua: string): InApp | null {
  const platform: InAppPlatform = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'other'
  const named = APPS.find(([re]) => re.test(ua))?.[1]
  if (named) return { app: named, platform }
  // Any other Android app's built-in web view ("; wv)"), but not Chrome's own custom tabs.
  if (platform === 'android' && /; wv\)/.test(ua)) return { app: '', platform }
  return null
}

/** An Android link that opens `url` in Chrome (or stays put if Chrome is missing). */
export function chromeIntent(url: string): string {
  const u = new URL(url)
  return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
}
