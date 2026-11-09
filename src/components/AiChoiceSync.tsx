import { useEffect } from 'react'
import { useCanPlus } from '../lib/account'
import { syncedAiChoice } from '../lib/aiChoice'
import { updateSettings, useSettings } from '../lib/settings'
import { useStore } from '../lib/store'

/** Keeps the stored AI choice in step with the account (see lib/aiChoice.ts). Mounted once in the app shell. */
export function AiChoiceSync() {
  const { session } = useStore()
  const settings = useSettings()
  const canPlus = useCanPlus(session?.user.id ?? null)
  useEffect(() => {
    if (canPlus === null) return
    const next = syncedAiChoice(settings.provider, canPlus)
    if (next) updateSettings({ provider: next })
  }, [canPlus, settings.provider])
  return null
}
