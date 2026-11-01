import { describe, expect, it } from 'vitest'
import { codesCsv, daysLeft, hasPremiumUntil, parseRedeem, REDEEM_MESSAGES, tidyCode } from './premiumCodes'
import { currentQuota, parseQuota, setQuota } from './account'

describe('Premium codes', () => {
  it('reads the database answers, with a message for every error', () => {
    expect(parseRedeem({ ok: true, days: 30, premium_until: '2026-12-01T00:00:00Z' })).toEqual({ ok: true, days: 30, premiumUntil: '2026-12-01T00:00:00Z' })
    for (const error of ['not_signed_in', 'too_many', 'invalid', 'used', 'already_yours'] as const) {
      expect(parseRedeem({ ok: false, error })).toEqual({ ok: false, error })
      expect(REDEEM_MESSAGES[error].length).toBeGreaterThan(10)
    }
    expect(parseRedeem({ ok: false, error: 'something_new' })).toEqual({ ok: false, error: 'invalid' })
    expect(parseRedeem(null)).toEqual({ ok: false, error: 'invalid' })
  })

  it('tidies what is typed', () => {
    expect(tidyCode('sm-7kq2 x9pd_4m8t!')).toBe('SM-7KQ2X9PD4M8T')
  })

  it('counts days left and knows when Premium is over', () => {
    const now = new Date('2026-11-01T12:00:00Z')
    expect(daysLeft('2026-11-04T12:00:00Z', now)).toBe(3)
    expect(daysLeft('2026-11-01T18:00:00Z', now)).toBe(1)
    expect(hasPremiumUntil('2026-11-04T12:00:00Z', now)).toBe(true)
    expect(hasPremiumUntil('2026-10-31T12:00:00Z', now)).toBe(false)
    expect(hasPremiumUntil(null, now)).toBe(false)
  })

  it('makes a CSV for the codes, quoting labels', () => {
    expect(codesCsv([{ code: 'SM-AAAA-BBBB-CCCC', hint: 'CCCC' }], 30, 'Shopier "Kasım"')).toBe('kod,gun,etiket\n"SM-AAAA-BBBB-CCCC",30,"Shopier ""Kasım"""')
  })

  it('the allowance carries the Premium end date, and an answer without it does not drop it', () => {
    expect(parseQuota({ role: 'normal', used: 1, limit: 150, allowed: true, premium_until: '2026-12-01T00:00:00Z' })?.premiumUntil).toBe('2026-12-01T00:00:00Z')
    expect(parseQuota({ role: 'normal', used: 1, limit: 40, allowed: true })?.premiumUntil).toBeNull()
  })

  it('setQuota keeps the date when the server answer has no date field', () => {
    setQuota({ role: 'normal', used: 1, limit: 150, allowed: true, premium_until: '2026-12-01T00:00:00Z' })
    setQuota({ role: 'normal', used: 2, limit: 150, allowed: true })
    expect(currentQuota()).toMatchObject({ used: 2, premiumUntil: '2026-12-01T00:00:00Z' })
    // An answer that says "no Premium" (the field present, null) does close it.
    setQuota({ role: 'normal', used: 3, limit: 40, allowed: true, premium_until: null })
    expect(currentQuota()?.premiumUntil).toBeNull()
  })
})
