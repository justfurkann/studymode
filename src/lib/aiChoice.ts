import type { AiProvider } from './settings'

/*
 * The stored AI choice has to match what the student sees. Everyone starts on "shared" (our free
 * AI); for a VIP, an admin or someone with a Premium code the server already uses Free+ for it, and
 * the Settings page showed "Free+" selected, while the note pages read the same value as
 * "Ücretsiz yapay zekâ". Tapping "Ücretsiz" and back to "Free+" was the only way to make them agree.
 * So the stored value follows the account:
 * - can use Free+ and still on the starting "shared": becomes "plus";
 * - can no longer use Free+ (a Premium code ran out) but on "plus" or "free": back to "shared".
 * "free" chosen on purpose by someone with Free+ is left alone; AddNote reminds them of it.
 */
export function syncedAiChoice(provider: AiProvider, canPlus: boolean): AiProvider | null {
  if (canPlus && provider === 'shared') return 'plus'
  if (!canPlus && (provider === 'plus' || provider === 'free')) return 'shared'
  return null
}
