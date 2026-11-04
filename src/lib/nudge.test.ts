import { describe, expect, it } from 'vitest'
import { emptyMemory, mayNudge, NUDGE_GAP_AFTER_BUY_MS, NUDGE_GAP_AFTER_NO_MS, NUDGE_GAP_MS, quietPage, type NudgeInput } from './nudge'

const now = Date.UTC(2026, 10, 10, 12)
const base: NudgeInput = { signedIn: true, role: 'normal', premiumLocked: true, accountCreatedAt: '2026-11-01T00:00:00Z', notes: 1, pathname: '/', memory: emptyMemory(), now }

describe('Premium pop-up rules', () => {
  it('shows only to signed-in normal accounts with Premium locked', () => {
    expect(mayNudge(base)).toBe(true)
    expect(mayNudge({ ...base, signedIn: false })).toBe(false)
    expect(mayNudge({ ...base, role: 'vip' })).toBe(false)
    expect(mayNudge({ ...base, role: 'admin' })).toBe(false)
    expect(mayNudge({ ...base, role: null })).toBe(false)
    // Paid Premium or an own Gemini key: Premium is open, so nothing to sell.
    expect(mayNudge({ ...base, premiumLocked: false })).toBe(false)
  })

  it('waits until a new account has settled in: a day, or three notes', () => {
    const fresh = { ...base, accountCreatedAt: new Date(now - 60 * 60 * 1000).toISOString() }
    expect(mayNudge({ ...fresh, notes: 0 })).toBe(false)
    expect(mayNudge({ ...fresh, notes: 3 })).toBe(true)
  })

  it('keeps quiet on sign-in, buying, Premium, code links, mock exams and shared courses', () => {
    for (const p of ['/giris', '/fiyatlar', '/premium', '/kod', '/ders/abc/sinav', '/paylas/x', '/yonetim', '/sifre-yenile']) expect(quietPage(p)).toBe(true)
    for (const p of ['/', '/dersler', '/not/1', '/tekrar', '/ders/abc']) expect(quietPage(p)).toBe(false)
  })

  it('is spaced out: 3 days, a week after two "not now"s, two weeks after a buy tap', () => {
    const at = now - NUDGE_GAP_MS + 1000
    expect(mayNudge({ ...base, memory: { at, no: 0, buyAt: 0 } })).toBe(false)
    expect(mayNudge({ ...base, memory: { at: now - NUDGE_GAP_MS, no: 1, buyAt: 0 } })).toBe(true)
    expect(mayNudge({ ...base, memory: { at: now - NUDGE_GAP_MS, no: 2, buyAt: 0 } })).toBe(false)
    expect(mayNudge({ ...base, memory: { at: now - NUDGE_GAP_AFTER_NO_MS, no: 2, buyAt: 0 } })).toBe(true)
    expect(mayNudge({ ...base, memory: { at: now - NUDGE_GAP_AFTER_NO_MS, no: 0, buyAt: now - NUDGE_GAP_AFTER_BUY_MS + 1000 } })).toBe(false)
  })
})
