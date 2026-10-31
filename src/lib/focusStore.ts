import { useSyncExternalStore } from 'react'
import { readTimer, writeTimer, type FocusPhase, type FocusTimer } from './mola'

/*
 * One shared focus timer for the whole app: the Odak page, the small pill on other pages and the
 * engine that moves from focus to break all read and write it here. It lives in localStorage, so
 * it survives reloads and stays in step across tabs.
 */

let current: FocusTimer | null = readTimer()
/** The phase that ended most recently, so the page can celebrate it. */
let lastEnded: { phase: FocusPhase; round: number; minutes: number; at: number } | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function getFocus(): FocusTimer | null {
  return current
}

export function setFocus(next: FocusTimer | null) {
  writeTimer(next)
  current = next
  emit()
}

/** Re-reads storage (another tab may have moved on). */
export function refreshFocus() {
  current = readTimer()
  emit()
}

export function markEnded(info: NonNullable<typeof lastEnded>) {
  lastEnded = info
  emit()
}

export function clearEnded() {
  lastEnded = null
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'studymode.focus.v1') refreshFocus()
  })
}

export function useFocus(): FocusTimer | null {
  return useSyncExternalStore(subscribe, () => current)
}

export function useLastEnded() {
  return useSyncExternalStore(subscribe, () => lastEnded)
}

/** Asks once, when the student starts a timer (a click), so the browser allows the prompt. */
export function askNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  } catch {
    // Some browsers (iOS outside an installed app) have no notifications; the sound still plays.
  }
}

/** Shows a system notification only when the app is in the background. */
export function notify(title: string, body: string) {
  try {
    if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return
    new Notification(title, { body, icon: '/icon-192.png', tag: 'studymode-focus' })
  } catch {
    // Notifications are a nicety.
  }
}
