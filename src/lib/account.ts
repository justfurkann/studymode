import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'

/*
 * The signed-in person's role and today's free-AI allowance, as the database sees them
 * (functions ai_quota / consume_ai; roles can only be given by an admin). Normal: 40 requests a
 * day, VIP: 150, admin: no limit. Null while unknown, signed out, or before the SQL exists.
 */

export type Role = 'normal' | 'vip' | 'admin'
export interface Quota {
  role: Role
  used: number
  limit: number | null
  allowed: boolean
}

let quota: Quota | null = null
let loadedFor: string | null = null
/** The account whose quota has finished loading (or failed to), so "unknown" can stop waiting. */
let settledFor: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function parseQuota(value: unknown): Quota | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<Quota>
  if (typeof v.used !== 'number' || typeof v.allowed !== 'boolean') return null
  return { role: v.role === 'vip' || v.role === 'admin' ? v.role : 'normal', used: v.used, limit: typeof v.limit === 'number' ? v.limit : null, allowed: v.allowed }
}

/** The server sends the new count with every free-AI answer. */
export function setQuota(next: unknown) {
  const parsed = parseQuota(next)
  if (!parsed) return
  quota = parsed
  emit()
}

export async function refreshQuota(userId: string | null) {
  if (!supabase || !userId) {
    quota = null
    loadedFor = null
    emit()
    return
  }
  loadedFor = userId
  const { data, error } = await supabase.rpc('ai_quota')
  if (loadedFor !== userId) return
  quota = error ? null : parseQuota(data)
  settledFor = userId
  emit()
}

/** Today's allowance for the signed-in user; loads once per account. */
export function useQuota(userId: string | null): Quota | null {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => quota,
  )
  useEffect(() => {
    if (loadedFor !== userId) void refreshQuota(userId)
  }, [userId])
  return userId ? value : null
}

/** True once the quota request for this account has answered, even with an error. */
export function useQuotaSettled(userId: string | null): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => !!userId && settledFor === userId,
  )
}

/** VIP and admin get the Premium tab. */
export const isPremiumRole = (role: Role | undefined | null) => role === 'vip' || role === 'admin'

export const ROLE_LABEL: Record<Role, string> = { normal: 'Normal', vip: 'VIP', admin: 'Yönetici' }

export function quotaText(q: Quota): string {
  return q.limit === null ? `Bugün ${q.used} istek · sınırsız` : `Bugün ${q.used}/${q.limit} istek`
}
