import { describe, expect, it } from 'vitest'
import { CHANNELS, renderChannel, seededRng } from './ambience'
import { DEFAULT_DECOR, parseDecor } from './decor'

describe('ambient sounds', () => {
  const rate = 8000
  for (const { id } of CHANNELS) {
    it(`${id}: renders a loop that is audible, never clips and joins without a jump`, () => {
      const data = renderChannel(id, rate, seededRng(7), 3)
      expect(data.length).toBe(rate * 3)
      let peak = 0
      let energy = 0
      for (const x of data) {
        expect(Number.isFinite(x)).toBe(true)
        peak = Math.max(peak, Math.abs(x))
        energy += x * x
      }
      expect(peak).toBeLessThanOrEqual(1)
      expect(Math.sqrt(energy / data.length)).toBeGreaterThan(0.005)
      // The loop point: last sample to first sample is no bigger a step than the signal's usual size.
      expect(Math.abs(data[data.length - 1] - data[0])).toBeLessThan(peak)
    })
  }

  it('is reproducible with a seed', () => {
    expect(renderChannel('yagmur', rate, seededRng(3), 1)).toEqual(renderChannel('yagmur', rate, seededRng(3), 1))
  })
})

describe('stationery settings', () => {
  it('falls back to the default look on missing or broken values', () => {
    expect(parseDecor(null)).toEqual(DEFAULT_DECOR)
    expect(parseDecor('{oops')).toEqual(DEFAULT_DECOR)
    expect(parseDecor(JSON.stringify({ paper: 'papirus', pen: 'mor', asmr: 'yes' }))).toEqual(DEFAULT_DECOR)
  })

  it('keeps valid choices', () => {
    expect(parseDecor(JSON.stringify({ paper: 'hukuk', pen: 'nane', asmr: true }))).toEqual({ paper: 'hukuk', pen: 'nane', asmr: true })
  })
})
