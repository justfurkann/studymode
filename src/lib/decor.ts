import { useSyncExternalStore } from 'react'

/*
 * "Kırtasiye seti": the student's own stationery. Paper texture behind the app, the colour of the
 * highlighter (every .hl, the logo, the main buttons in dark mode) and stationery sounds. Purely
 * cosmetic, kept in this browser only, in its own storage key so the main settings stay untouched.
 * The look is applied as data-paper / data-pen on <html>; src/styles/extras.css draws it.
 */

export type Paper = 'kareli' | 'noktali' | 'muhendis' | 'hukuk' | 'duz'
export type Pen = 'sari' | 'pembe' | 'nane' | 'lavanta' | 'turuncu'

export interface Decor {
  paper: Paper
  pen: Pen
  /** Stationery sounds: paper rustle on a card flip, a marker stroke on a right answer. */
  asmr: boolean
}

export const PAPERS: Array<{ id: Paper; label: string }> = [
  { id: 'kareli', label: 'Kareli' },
  { id: 'noktali', label: 'Noktalı' },
  { id: 'muhendis', label: 'Mühendislik' },
  { id: 'hukuk', label: 'Sarı defter' },
  { id: 'duz', label: 'Düz' },
]

/** `swatch` is only for the picker; the real colours live in extras.css. */
export const PENS: Array<{ id: Pen; label: string; swatch: string }> = [
  { id: 'sari', label: 'Sarı', swatch: '#ffe14d' },
  { id: 'pembe', label: 'Pembe', swatch: '#ff9fcf' },
  { id: 'nane', label: 'Nane', swatch: '#7ff0b8' },
  { id: 'lavanta', label: 'Lavanta', swatch: '#c9b3ff' },
  { id: 'turuncu', label: 'Turuncu', swatch: '#ffb35c' },
]

export const DECOR_KEY = 'studymode.decor.v1'
export const DEFAULT_DECOR: Decor = { paper: 'kareli', pen: 'sari', asmr: false }

export function parseDecor(raw: string | null): Decor {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<Decor>) : {}
    return {
      paper: PAPERS.some((p) => p.id === value.paper) ? (value.paper as Paper) : DEFAULT_DECOR.paper,
      pen: PENS.some((p) => p.id === value.pen) ? (value.pen as Pen) : DEFAULT_DECOR.pen,
      asmr: value.asmr === true,
    }
  } catch {
    return DEFAULT_DECOR
  }
}

function read(): Decor {
  try {
    return parseDecor(localStorage.getItem(DECOR_KEY))
  } catch {
    return DEFAULT_DECOR
  }
}

let current: Decor = typeof window === 'undefined' ? DEFAULT_DECOR : read()
const listeners = new Set<() => void>()

export function getDecor(): Decor {
  return current
}

export function updateDecor(patch: Partial<Decor>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(DECOR_KEY, JSON.stringify(current))
  } catch {
    // Blocked storage: the look lasts for this tab.
  }
  applyDecor()
  listeners.forEach((listener) => listener())
}

export function useDecor(): Decor {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}

/** Default values leave the attribute off, so the original "Fosforlu" look needs no extra CSS. */
export function applyDecor() {
  const root = document.documentElement
  if (current.paper === DEFAULT_DECOR.paper) root.removeAttribute('data-paper')
  else root.setAttribute('data-paper', current.paper)
  if (current.pen === DEFAULT_DECOR.pen) root.removeAttribute('data-pen')
  else root.setAttribute('data-pen', current.pen)
}
