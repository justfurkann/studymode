import { supabase } from './supabase'

/*
 * Paid Premium through codes sold on the payment provider's page (lib/config PAYMENT_PROVIDER): the student buys a code there and types it here.
 * The database does the work (redeem_code, admin_* functions; see HANDOFF "Aşama 31"); this file
 * only calls it and turns the answers into plain Turkish.
 */

export type RedeemError = 'not_signed_in' | 'too_many' | 'invalid' | 'used' | 'already_yours' | 'network'

export type RedeemResult = { ok: true; days: number; premiumUntil: string } | { ok: false; error: RedeemError }

export const REDEEM_MESSAGES: Record<RedeemError, string> = {
  not_signed_in: 'Kod kullanmak için giriş yap.',
  too_many: 'Çok fazla yanlış deneme. Bir saat sonra yeniden dene.',
  invalid: 'Bu kod geçerli değil.',
  used: 'Bu kod daha önce kullanılmış.',
  already_yours: 'Bu kodu zaten kullandın.',
  network: 'Şu an bağlanılamadı. Biraz sonra yeniden dene.',
}

/** What the student types, cleaned for display (the database is forgiving anyway). */
export function tidyCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z-]/g, '').slice(0, 20)
}

export function parseRedeem(value: unknown): RedeemResult {
  const v = (value ?? {}) as { ok?: unknown; days?: unknown; premium_until?: unknown; error?: unknown }
  if (v.ok === true && typeof v.premium_until === 'string') return { ok: true, days: Number(v.days) || 0, premiumUntil: v.premium_until }
  const error = typeof v.error === 'string' && v.error in REDEEM_MESSAGES ? (v.error as RedeemError) : 'invalid'
  return { ok: false, error }
}

export async function redeemCode(code: string): Promise<RedeemResult> {
  if (!supabase) return { ok: false, error: 'not_signed_in' }
  const { data, error } = await supabase.rpc('redeem_code', { code })
  if (error) return { ok: false, error: 'network' }
  return parseRedeem(data)
}

/** "12 Aralık 2026" */
export const formatUntil = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Whole days left until `iso` (0 on the last day, negative once over). */
export function daysLeft(iso: string, now = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000)
}

export const hasPremiumUntil = (iso: string | null | undefined, now = new Date()) => !!iso && new Date(iso).getTime() > now.getTime()

// ---------- Admin ----------

export interface AdminCode {
  id: string
  hint: string
  days: number
  label: string | null
  created_at: string
  redeemed_at: string | null
  redeemed_email: string | null
  revoked_at: string | null
}

export interface AdminPremiumUser {
  id: string
  email: string
  until: string
}

export interface NewCode {
  code: string
  hint: string
}

/** CSV of freshly made codes, for a spreadsheet: each with the link that opens Premium in one tap. */
export function codesCsv(codes: NewCode[], days: number, label: string, origin = 'https://studymode.fun'): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  return ['kod,link,gun,etiket', ...codes.map((c) => [esc(c.code), esc(codeLink(c.code, origin)), String(days), esc(label)].join(','))].join('\n')
}

// ---------- Codes as links (and QR codes) ----------

/** A whole code: SM- and three groups of four from the code alphabet (no 0, 1, I, O). */
export const CODE_PATTERN = /^SM-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/

/**
 * The link that redeems a code: studymode.fun/kod#SM-…. The code rides in the part after #, which
 * browsers never send to a server, so it stays out of request logs and page-view analytics.
 */
export function codeLink(code: string, origin = typeof window === 'undefined' ? 'https://studymode.fun' : window.location.origin): string {
  return `${origin}/kod#${code}`
}

/** The code in a /kod link's #part, or null when there is no whole code. */
export function codeFromHash(hash: string): string | null {
  let raw = hash.replace(/^#/, '')
  try {
    raw = decodeURIComponent(raw)
  } catch {
    // Keep it as it is.
  }
  const code = tidyCode(raw)
  return CODE_PATTERN.test(code) ? code : null
}

/** "SM-…-K7Q2": enough to recognise a code on screen without showing all of it. */
export const maskCode = (code: string) => `SM-…-${code.slice(-4)}`

/**
 * A code from a link opened while signed out waits on this device until the student has an
 * account: signing in or confirming the new account brings them back to /kod, which uses it.
 */
const PENDING_KEY = 'studymode.pendingCode'
export const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function savePendingCode(code: string, now = Date.now()) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ code, at: now }))
  } catch {
    // Blocked storage: the student can still type the code by hand.
  }
}

export function loadPendingCode(now = Date.now()): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as { code?: unknown; at?: unknown } | null
    if (!v || typeof v.code !== 'string' || typeof v.at !== 'number' || now - v.at > PENDING_TTL_MS || !CODE_PATTERN.test(v.code)) return null
    return v.code
  } catch {
    return null
  }
}

export function clearPendingCode() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // Nothing to clear.
  }
}
