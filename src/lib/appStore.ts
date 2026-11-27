import { useEffect, useState } from 'react'
import { useStore } from './store'
import { supabase } from './supabase'

/*
 * Premium bought in the iPhone app is an App Store subscription: it renews through Apple and is managed
 * (and cancelled) in iPhone Settings, not here. The site asks the server once per account per visit.
 */

export type AppStoreSubscription = { state: 'none' } | { state: 'active'; expires: string | null } | { state: 'unknown' }

export const MANAGE_HINT = 'iPhone’da Ayarlar → Apple hesabın (adın) → Abonelikler'

const cache = new Map<string, Promise<AppStoreSubscription>>()

async function fetchStatus(fetchImpl: typeof fetch): Promise<AppStoreSubscription> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) return { state: 'none' }
  try {
    const response = await fetchImpl('/api/apple-status', { headers: { authorization: `Bearer ${token}` } })
    if (!response.ok) return { state: 'unknown' }
    const body = (await response.json()) as { subscription?: boolean; expires?: string }
    return body.subscription ? { state: 'active', expires: body.expires ?? null } : { state: 'none' }
  } catch {
    return { state: 'unknown' }
  }
}

export function appStoreSubscription(userId: string, fetchImpl: typeof fetch = fetch): Promise<AppStoreSubscription> {
  let pending = cache.get(userId)
  if (!pending) {
    pending = fetchStatus(fetchImpl)
    // A failed check is asked again next time instead of being remembered.
    void pending.then((s) => s.state === 'unknown' && cache.delete(userId))
    cache.set(userId, pending)
  }
  return pending
}

/** 'none' for guests; 'unknown' while asking or when the server could not say. */
export function useAppStoreSubscription(): AppStoreSubscription {
  const { session } = useStore()
  const userId = session?.user.id ?? null
  const [status, setStatus] = useState<AppStoreSubscription>({ state: userId ? 'unknown' : 'none' })
  useEffect(() => {
    if (!userId) {
      setStatus({ state: 'none' })
      return
    }
    let alive = true
    setStatus({ state: 'unknown' })
    void appStoreSubscription(userId).then((s) => alive && setStatus(s))
    return () => {
      alive = false
    }
  }, [userId])
  return status
}
