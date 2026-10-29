import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

/** "shared" is the free AI the app provides to signed-in users; the others use the student's own key. */
export type AiProvider = 'shared' | 'anthropic' | 'openai' | 'google'
export type KeyProvider = Exclude<AiProvider, 'shared'>

export const PROVIDERS: Record<KeyProvider, { label: string; keyHint: string; keyUrl: string; models: Array<{ id: string; label: string }> }> = {
  anthropic: {
    label: 'Claude (Anthropic)',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — en kaliteli' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — dengeli' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — en ucuz' },
    ],
  },
  openai: {
    label: 'ChatGPT (OpenAI)',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-5-mini', label: 'GPT-5 mini' },
      { id: 'gpt-5', label: 'GPT-5' },
    ],
  },
  google: {
    label: 'Gemini (Google)',
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [{ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' }],
  },
}

export interface Settings {
  provider: AiProvider
  /** Kept only in this browser. Never synced to Supabase. */
  keys: Record<KeyProvider, string>
  models: Record<KeyProvider, string>
  theme: Theme
}

const KEY = 'studymode.settings.v1'
const defaults: Settings = {
  provider: 'shared',
  keys: { anthropic: '', openai: '', google: '' },
  models: { anthropic: 'claude-opus-5-5', openai: 'gpt-5-mini', google: 'gemini-3.8-flash' },
  theme: 'system',
}

const str = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value : fallback)

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Settings> & { apiKey?: string; model?: string }
    const keys = { ...defaults.keys, ...(parsed.keys ?? {}) }
    const models = { ...defaults.models, ...(parsed.models ?? {}) }
    // Earlier versions stored a single Anthropic key and model.
    if (parsed.apiKey) keys.anthropic = parsed.apiKey
    if (parsed.model) models.anthropic = parsed.model
    const provider: AiProvider = ['shared', 'anthropic', 'openai', 'google'].includes(parsed.provider as string)
      ? (parsed.provider as AiProvider)
      : parsed.apiKey
        ? 'anthropic'
        : 'shared'
    return {
      provider,
      keys: { anthropic: str(keys.anthropic, ''), openai: str(keys.openai, ''), google: str(keys.google, '') },
      models: { anthropic: str(models.anthropic, defaults.models.anthropic), openai: str(models.openai, defaults.models.openai), google: str(models.google, defaults.models.google) },
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
    }
  } catch {
    return defaults
  }
}

let current: Settings = read()
const listeners = new Set<() => void>()

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

/** Whether AI can be used right now, and how to describe it in the UI. */
export function aiAvailability(settings: Settings, signedIn: boolean): { ok: boolean; label: string; reason: string } {
  if (settings.provider === 'shared') {
    return signedIn
      ? { ok: true, label: 'Ücretsiz yapay zekâ', reason: '' }
      : { ok: false, label: 'Ücretsiz yapay zekâ', reason: 'Ücretsiz yapay zekâ için giriş yapman gerekiyor.' }
  }
  const info = PROVIDERS[settings.provider]
  return settings.keys[settings.provider]
    ? { ok: true, label: info.label, reason: '' }
    : { ok: false, label: info.label, reason: `${info.label} için ayarlardan API anahtarı eklemen gerekiyor.` }
}
