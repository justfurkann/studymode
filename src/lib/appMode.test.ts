import { afterEach, describe, expect, it } from 'vitest'
import { APP_MODE_KEY, appPlatform, isAppMode, parseAppParam, resetAppModeForTests, resolveAppMode, type ModeStorage } from './appMode'

function memory(initial: Record<string, string> = {}): ModeStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

const broken: ModeStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('parseAppParam', () => {
  it('knows ios and android', () => {
    expect(parseAppParam('?app=ios')).toBe('ios')
    expect(parseAppParam('?app=android')).toBe('android')
    expect(parseAppParam('?x=1&app=ios')).toBe('ios')
  })

  it('is loose about case and spaces', () => {
    expect(parseAppParam('?app=IOS')).toBe('ios')
    expect(parseAppParam('?app=%20android%20')).toBe('android')
  })

  it('ignores anything else', () => {
    expect(parseAppParam('')).toBeNull()
    expect(parseAppParam('?app=')).toBeNull()
    expect(parseAppParam('?app=web')).toBeNull()
    expect(parseAppParam('?application=ios')).toBeNull()
  })
})

describe('resolveAppMode', () => {
  it('takes the address and remembers it', () => {
    const s = memory()
    expect(resolveAppMode('?app=ios', s)).toBe('ios')
    expect(s.data[APP_MODE_KEY]).toBe('ios')
  })

  it('keeps the mode on later pages without the parameter', () => {
    const s = memory()
    resolveAppMode('?app=android', s)
    expect(resolveAppMode('', s)).toBe('android')
    expect(resolveAppMode('?arac=ses', s)).toBe('android')
  })

  it('a new parameter wins over the remembered one', () => {
    const s = memory({ [APP_MODE_KEY]: 'android' })
    expect(resolveAppMode('?app=ios', s)).toBe('ios')
    expect(s.data[APP_MODE_KEY]).toBe('ios')
  })

  it('is off on the normal site', () => {
    expect(resolveAppMode('', memory())).toBeNull()
    expect(resolveAppMode('?app=web', memory())).toBeNull()
  })

  it('ignores a strange remembered value', () => {
    expect(resolveAppMode('', memory({ [APP_MODE_KEY]: 'windows' }))).toBeNull()
  })

  it('never throws when storage is blocked or missing', () => {
    expect(resolveAppMode('?app=ios', broken)).toBe('ios')
    expect(resolveAppMode('', broken)).toBeNull()
    expect(resolveAppMode('?app=ios', null)).toBe('ios')
    expect(resolveAppMode('', null)).toBeNull()
  })
})

describe('appPlatform outside a browser', () => {
  afterEach(() => resetAppModeForTests())

  it('is off (no window in the test runner)', () => {
    expect(appPlatform()).toBeNull()
    expect(isAppMode()).toBe(false)
  })
})
