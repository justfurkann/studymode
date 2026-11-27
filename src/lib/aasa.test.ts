import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const aasa = JSON.parse(readFileSync('public/.well-known/apple-app-site-association', 'utf8'))
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  rewrites: Array<{ source: string }>
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
}

describe('apple-app-site-association', () => {
  it('opens only shared course links (/paylas/*) in the app and keeps password autofill', () => {
    expect(aasa.applinks.details).toEqual([{ appIDs: ['Q2VWX7322K.fun.studymode.app'], components: [expect.objectContaining({ '/': '/paylas/*' })] }])
    expect(aasa.webcredentials.apps).toEqual(['Q2VWX7322K.fun.studymode.app'])
  })

  it('is served as the file itself, as JSON: the app page rewrite does not catch it', () => {
    const path = '/.well-known/apple-app-site-association'
    for (const { source } of vercel.rewrites) expect(new RegExp(`^${source}$`).test(path)).toBe(false)
    const rule = vercel.headers.find((h) => h.source === path)
    expect(rule?.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' })
    // Shared links themselves still go to the site for browsers.
    expect(vercel.rewrites.some(({ source }) => new RegExp(`^${source}$`).test('/paylas/abc123'))).toBe(true)
  })
})
