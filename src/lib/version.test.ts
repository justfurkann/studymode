import { describe, expect, it } from 'vitest'
import { entryFromHtml, freshImport, isChunkError, StaleVersionError } from './version'

describe('stale version after a deploy', () => {
  it('recognizes the ways browsers report a missing lazy file', () => {
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://studymode.fun/assets/index-Dt-CgZaq.js'))).toBe(true)
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkError(new TypeError('error loading dynamically imported module: https://x/assets/a.js'))).toBe(true)
    expect(isChunkError(new Error('Gemini error 503'))).toBe(false)
    expect(isChunkError(undefined)).toBe(false)
  })

  it('turns a missing file into a clear message and leaves other errors alone', async () => {
    await expect(freshImport(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')))).rejects.toBeInstanceOf(StaleVersionError)
    await expect(freshImport(() => Promise.reject(new Error('başka bir hata')))).rejects.toThrow('başka bir hata')
    await expect(freshImport(() => Promise.resolve(42))).resolves.toBe(42)
  })

  it('finds the main script of a built page', () => {
    const html = '<head><script type="module" crossorigin src="/assets/index-B9x_k2Lq.js"></script><link rel="stylesheet" href="/assets/index-C1.css"></head>'
    expect(entryFromHtml(html)).toBe('/assets/index-B9x_k2Lq.js')
    expect(entryFromHtml('<script type="module" src="/src/main.tsx"></script>')).toBeNull()
  })
})
