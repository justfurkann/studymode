import { describe, expect, it } from 'vitest'
import { syncedAiChoice } from './aiChoice'

describe('the stored AI choice follows the account', () => {
  it('turns the starting choice into Free+ for someone who has it', () => {
    expect(syncedAiChoice('shared', true)).toBe('plus')
    expect(syncedAiChoice('plus', true)).toBeNull()
  })
  it('keeps "Ücretsiz" when someone with Free+ chose it on purpose', () => {
    expect(syncedAiChoice('free', true)).toBeNull()
  })
  it('goes back to the free AI when Free+ is gone', () => {
    expect(syncedAiChoice('plus', false)).toBe('shared')
    expect(syncedAiChoice('free', false)).toBe('shared')
    expect(syncedAiChoice('shared', false)).toBeNull()
  })
  it('leaves an own API key alone', () => {
    for (const p of ['anthropic', 'openai', 'google'] as const) {
      expect(syncedAiChoice(p, true)).toBeNull()
      expect(syncedAiChoice(p, false)).toBeNull()
    }
  })
})
