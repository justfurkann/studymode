import { useSyncExternalStore } from 'react'

/*
 * The first-visit tour: shown once (remembered in localStorage), restartable from Settings and the
 * guide. While it runs, achievement toasts and the VIP welcome wait, so nothing stacks on top of it.
 *
 * Automated browsers (navigator.webdriver, e.g. the Playwright tests) do not get it on their own,
 * otherwise it would sit over every test; a test that wants it sets `studymode.tour.force`.
 */

export const TOUR_SEEN_KEY = 'studymode.tour.v1'
const FORCE_KEY = 'studymode.tour.force'

let active = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function isTourActive() {
  return active
}

export function setTourActive(next: boolean) {
  if (active === next) return
  active = next
  emit()
}

export function useTourActive(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => active,
  )
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Should the tour start by itself on this visit? */
export function shouldAutoStart(): boolean {
  if (read(TOUR_SEEN_KEY)) return false
  if (typeof navigator !== 'undefined' && navigator.webdriver && !read(FORCE_KEY)) return false
  return true
}

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, new Date().toISOString())
  } catch {
    // Without storage it may show again next visit; harmless.
  }
}

/** "Turu tekrar başlat": the Tour component listens for this. */
let restartRequests = 0
export function requestTour() {
  restartRequests += 1
  emit()
}

export function useTourRequests(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => restartRequests,
  )
}
