import { describe, expect, it } from 'vitest'
import { deleteMessage, deleteWordOk } from './deleteAccount'

describe('delete account confirmation', () => {
  it('accepts SİL in any case, also without the dotted İ', () => {
    for (const w of ['SİL', 'sil', ' Sil ', 'SIL']) expect(deleteWordOk(w)).toBe(true)
    for (const w of ['', 'si', 'delete', 'SİLL']) expect(deleteWordOk(w)).toBe(false)
  })
  it('has a Turkish message for every server answer, and a fallback', () => {
    expect(deleteMessage('premium_active')).toMatch(/Premium/)
    expect(deleteMessage('whatever')).toBe(deleteMessage('delete_failed'))
  })
})
