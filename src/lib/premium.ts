import { isPremiumRole, useQuota, useQuotaSettled, type Role } from './account'
import { useSettings } from './settings'
import { useStore } from './store'
import { hasPremiumUntil } from './premiumCodes'

/*
 * Premium = podcast with real voices, AI images and meaning-based search. The server lets VIP and
 * admin accounts use them on Google Cloud (Free+). Someone who added their own Gemini key can use
 * them with that key (when Gemini is the chosen provider), whatever their role.
 */
export type PremiumState = 'loading' | 'open' | 'locked'

export interface Premium {
  state: PremiumState
  /** True when this is the user's own Gemini key, not Free+. */
  viaKey: boolean
  role: Role | null
  /** Paid Premium from a code: until when (ISO), while it lasts. */
  until: string | null
}

export function usePremium(): Premium {
  const { session } = useStore()
  const settings = useSettings()
  const userId = session?.user.id ?? null
  const quota = useQuota(userId)
  const settled = useQuotaSettled(userId)
  // Premium tasks use the own key only when Gemini is the chosen provider (see runTask).
  const ownKey = settings.provider === 'google' && !!settings.keys.google?.trim()
  const role = quota?.role ?? null
  const until = hasPremiumUntil(quota?.premiumUntil) ? quota!.premiumUntil : null
  if (isPremiumRole(role)) return { state: 'open', viaKey: false, role, until }
  if (until) return { state: 'open', viaKey: false, role, until }
  if (ownKey) return { state: 'open', viaKey: true, role, until }
  if (userId && !quota && !settled) return { state: 'loading', viaKey: false, role, until }
  return { state: 'locked', viaKey: false, role, until }
}
