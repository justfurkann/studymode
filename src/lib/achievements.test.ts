import { beforeEach, describe, expect, it, vi } from 'vitest'

// The module keeps its state in memory; this stands in for localStorage.
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

const A = await import('./achievements')
const { emptyData } = await import('./types')

beforeEach(() => {
  store.clear()
  A.resetAchievementsForTests()
})

describe('achievements', () => {
  it('every achievement has a unique id, a rarity and an icon; hidden ones have a riddle', () => {
    const ids = A.ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const a of A.ACHIEVEMENTS) {
      expect(A.RARITIES[a.rarity]).toBeDefined()
      expect(a.icon).toBeTruthy()
      if (A.isHidden(a)) expect(a.hint!.length).toBeGreaterThan(5)
    }
    // Every rarity has something in it, and there are real secrets to find.
    for (const r of Object.keys(A.RARITIES)) expect(A.ACHIEVEMENTS.some((a) => a.rarity === r)).toBe(true)
    expect(A.ACHIEVEMENTS.filter(A.isHidden).length).toBeGreaterThanOrEqual(8)
  })

  it('unlocks once, saves, and announces in order', () => {
    expect(A.unlock('dedektif')).toBe(true)
    expect(A.unlock('dedektif')).toBe(false)
    A.unlock('glitch')
    expect(A.parseUnlocked(store.get('studymode.achievements.v1')!)).toHaveProperty('dedektif')
    expect(A.takeAnnouncement()).toBe('dedektif')
    expect(A.takeAnnouncement()).toBe('glitch')
    expect(A.takeAnnouncement()).toBe(null)
  })

  it('ten achievements unlock Koleksiyoncu too', () => {
    const ids = A.ACHIEVEMENTS.map((a) => a.id).filter((id) => id !== 'koleksiyoncu').slice(0, 10)
    ids.slice(0, 9).forEach((id) => A.unlock(id))
    expect(A.parseUnlocked(store.get('studymode.achievements.v1')!)).not.toHaveProperty('koleksiyoncu')
    A.unlock(ids[9])
    expect(A.parseUnlocked(store.get('studymode.achievements.v1')!)).toHaveProperty('koleksiyoncu')
  })

  it('the clock: 03.xx is Gece Kuşu, before 06.00 Erkenci, exactly 00.00 Gün Dönümü', () => {
    expect(A.clockAchievements(new Date(2026, 10, 1, 3, 20))).toEqual(['gece-kusu'])
    expect(A.clockAchievements(new Date(2026, 10, 1, 5, 10))).toEqual(['erkenci'])
    expect(A.clockAchievements(new Date(2026, 10, 1, 0, 0))).toEqual(['gece-yarisi'])
    expect(A.clockAchievements(new Date(2026, 10, 1, 0, 1))).toEqual([])
    expect(A.clockAchievements(new Date(2026, 10, 1, 14, 0))).toEqual([])
  })

  it('three different quiz types make Çok Yüzlü; the first one Kendini Tanı', () => {
    A.recordQuizType('gecekusu')
    A.recordQuizType('gecekusu')
    A.recordQuizType('kasif')
    let u = A.parseUnlocked(store.get('studymode.achievements.v1')!)
    expect(u).toHaveProperty('kendini-tani')
    expect(u).not.toHaveProperty('cok-yuzlu')
    A.recordQuizType('avci')
    u = A.parseUnlocked(store.get('studymode.achievements.v1')!)
    expect(u).toHaveProperty('cok-yuzlu')
  })

  it('all pen colours make Kalem Kutusu', () => {
    for (const pen of ['sari', 'pembe', 'nane', 'lavanta']) A.recordPen(pen, 5)
    expect(A.parseUnlocked(store.get('studymode.achievements.v1') ?? '{}')).not.toHaveProperty('kalem-koleksiyonu')
    A.recordPen('turuncu', 5)
    expect(A.parseUnlocked(store.get('studymode.achievements.v1')!)).toHaveProperty('kalem-koleksiyonu')
  })

  it('study goals come from the data: reviews, streak, a perfect test, focus rounds', () => {
    const now = new Date(2026, 10, 3, 12)
    const data = emptyData()
    expect(A.reachedGoals(A.studyProgress(data, 0, now))).toEqual([])
    data.studyDays = ['2026-11-01', '2026-11-02', '2026-11-03'].map((day, i) => ({ id: `d${i}`, day, reviews: 40, quizzes: 0, createdAt: '', updatedAt: '' }))
    data.attempts = [{ id: 'a', courseId: 'c', noteId: 'n', score: 5, total: 5, wrongIds: [], createdAt: '' }]
    const progress = A.studyProgress(data, 4, now)
    expect(progress['seri-7']).toEqual({ value: 3, goal: 7 })
    expect(A.reachedGoals(progress).sort()).toEqual(['ilk-adim', 'kusursuz', 'odak-ustasi', 'seri-3', 'yuz-tekrar'])
  })

  it('ignores unknown or broken saved data', () => {
    expect(A.parseUnlocked('{"yok":"2026","glitch":5,"dedektif":"2026-11-01"}')).toEqual({ dedektif: '2026-11-01' })
    expect(A.parseUnlocked('bozuk')).toEqual({})
  })
})

describe('quiet unlocks', () => {
  beforeEach(() => {
    store.clear()
    A.resetAchievementsForTests()
  })
  it('a silent unlock is saved but not announced', () => {
    expect(A.unlock('ilk-adim', new Date(), { silent: true })).toBe(true)
    expect(A.takeAnnouncement()).toBe(null)
    expect(A.parseUnlocked(store.get('studymode.achievements.v1')!)).toHaveProperty('ilk-adim')
  })
})

describe('achievements across devices', () => {
  beforeEach(() => {
    store.clear()
    A.resetAchievementsForTests()
  })
  it('brings in what the account has quietly, and reports what only this browser has', () => {
    A.unlock('dedektif')
    A.takeAnnouncement()
    const onlyHere = A.mergeRemote({ glitch: '2026-10-30T00:00:00Z' })
    expect(onlyHere).toEqual(['dedektif'])
    expect(A.currentUnlocked()).toHaveProperty('glitch', '2026-10-30T00:00:00Z')
    expect(A.takeAnnouncement()).toBe(null)
    expect(A.mergeRemote({ glitch: '2026-10-30T00:00:00Z', dedektif: '2026-11-01T00:00:00Z' })).toEqual([])
  })
})

describe('admin give and take back', () => {
  beforeEach(() => {
    store.clear()
    A.resetAchievementsForTests()
  })

  it('takes back: leaves the collection and the toast queue; rules cannot bring it back, an admin can', () => {
    A.unlock('gece-kusu')
    expect(A.revoke('gece-kusu')).toBe(true)
    expect(A.currentUnlocked()).not.toHaveProperty('gece-kusu')
    expect(A.takeAnnouncement()).toBe(null)
    // The clock rule fires again: stays locked.
    expect(A.unlock('gece-kusu')).toBe(false)
    expect(A.currentUnlocked()).not.toHaveProperty('gece-kusu')
    // The admin gives it: back, and announced.
    expect(A.unlock('gece-kusu', new Date(), { admin: true })).toBe(true)
    expect(A.takeAnnouncement()).toBe('gece-kusu')
    expect(A.currentHeld().ids).toEqual([])
  })

  it('Koleksiyoncu goes when fewer than 10 others remain, and comes back at 10', () => {
    const others = A.ACHIEVEMENTS.map((a) => a.id).filter((id) => id !== 'koleksiyoncu').slice(0, 10)
    others.forEach((id) => A.unlock(id))
    expect(A.currentUnlocked()).toHaveProperty('koleksiyoncu')
    A.revoke(others[0])
    expect(A.currentUnlocked()).not.toHaveProperty('koleksiyoncu')
    A.unlock(others[0], new Date(), { admin: true })
    expect(A.currentUnlocked()).toHaveProperty('koleksiyoncu')
  })

  it('the account’s copy does not bring a taken-back one back; a newer held list from another device takes it away here', () => {
    A.unlock('dedektif')
    A.revoke('dedektif', new Date('2026-11-01T12:00:00Z'))
    expect(A.mergeRemote({ dedektif: '2026-10-30T00:00:00Z' })).toEqual([])
    expect(A.currentUnlocked()).not.toHaveProperty('dedektif')

    A.resetAchievementsForTests()
    A.unlock('glitch')
    A.takeAnnouncement()
    expect(A.applyRemoteHeld({ ids: ['glitch'], at: '2026-11-01T12:00:00Z' })).toBe(true)
    expect(A.currentUnlocked()).not.toHaveProperty('glitch')
    // An older list is ignored.
    expect(A.applyRemoteHeld({ ids: [], at: '2026-10-01T00:00:00Z' })).toBe(false)
    expect(A.currentHeld().ids).toEqual(['glitch'])
    expect(A.parseHeld({ ids: ['glitch', 'yok'], at: 'x' })).toEqual({ ids: ['glitch'], at: 'x' })
    expect(A.parseHeld('bozuk')).toBe(null)
  })
})
