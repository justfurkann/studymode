import { describe, expect, it } from 'vitest'
import { saveList, saveMessage } from './imageStore'

/** A storage that holds at most `limit` characters, like a full localStorage. */
function tinyStorage(limit: number) {
  const data = new Map<string, string>()
  return {
    data,
    setItem(key: string, value: string) {
      if (value.length > limit) throw new DOMException('full', 'QuotaExceededError')
      data.set(key, value)
    },
    removeItem(key: string) {
      data.delete(key)
    },
  }
}

describe('saving generated pictures', () => {
  it('saves everything when there is room', () => {
    const s = tinyStorage(1000)
    expect(saveList('k', ['a', 'b'], s)).toBe('saved')
    expect(JSON.parse(s.data.get('k')!)).toEqual(['a', 'b'])
  })

  it('drops the oldest (last) pictures until the list fits, and says so', () => {
    const s = tinyStorage(30)
    const result = saveList('k', ['x'.repeat(10), 'y'.repeat(10), 'z'.repeat(10)], s)
    expect(result).toBe('trimmed')
    expect(JSON.parse(s.data.get('k')!)).toEqual(['x'.repeat(10), 'y'.repeat(10)])
    expect(saveMessage(result)).toMatch(/en eski görseller/)
  })

  it('reports a failure when not even the newest picture fits', () => {
    const s = tinyStorage(5)
    s.data.set('k', '["old"]')
    const result = saveList('k', ['x'.repeat(50)], s)
    expect(result).toBe('failed')
    expect(saveMessage(result)).toMatch(/indir/)
  })

  it('an empty list just clears the key', () => {
    const s = tinyStorage(5)
    s.data.set('k', '["old"]')
    expect(saveList('k', [], s)).toBe('saved')
    expect(s.data.has('k')).toBe(false)
    expect(saveMessage('saved')).toBe('')
  })
})
