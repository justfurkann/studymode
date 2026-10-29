import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'En kaliteli sonuç' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Daha hızlı ve yaklaşık yarı fiyatına' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'En ucuz, kısa notlar için yeterli' },
] as const

export type AiModel = (typeof AI_MODELS)[number]['id']

export interface Settings {
  /** Kept only in this browser. Never synced to Supabase. */
  apiKey: string
  model: AiModel
  theme: Theme
}

const KEY = 'studymode.settings.v1'
const defaults: Settings = { apiKey: '', model: 'claude-opus-5-5', theme: 'system' }

let current: Settings = read()
const listeners = new Set<() => void>()

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: AI_MODELS.some((m) => m.id === parsed.model) ? (parsed.model as AiModel) : defaults.model,
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
    }
  } catch {
    return defaults
  }
}

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Storage can be blocked (private mode). Settings then last for this tab only.
  }
  applyTheme()
  listeners.forEach((listener) => listener())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}

export function applyTheme() {
  const root = document.documentElement
  if (current.theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', current.theme)
}
