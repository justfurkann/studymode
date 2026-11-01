import { supabase } from './supabase'

/*
 * Paid Premium through codes sold on Shopier: the student buys a code there and types it here.
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

/** CSV of freshly made codes, for a spreadsheet or Shopier. */
export function codesCsv(codes: NewCode[], days: number, label: string): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  return ['kod,gun,etiket', ...codes.map((c) => [esc(c.code), String(days), esc(label)].join(','))].join('\n')
}
