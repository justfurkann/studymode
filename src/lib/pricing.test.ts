import { describe, expect, it } from 'vitest'
import { buyUrl, canBuy, formatPrice, PACKAGES } from './pricing'

describe('pricing', () => {
  it('has the two packages with the prices the seller gave', () => {
    expect(PACKAGES.map((p) => [p.id, p.days, p.price])).toEqual([
      ['aylik', 30, 50],
      ['donem', 120, 150],
    ])
    expect(formatPrice(150)).toBe('150 TL')
  })

  it('shows "Satın al" only with the package’s own https payment link', () => {
    expect(buyUrl({ payUrl: '' })).toBeNull()
    expect(buyUrl({ payUrl: 'javascript:alert(1)' })).toBeNull()
    expect(buyUrl({ payUrl: ' https://iyzi.link/AAA ' })).toBe('https://iyzi.link/AAA')
    expect(canBuy([{ payUrl: '' }, { payUrl: '' }])).toBe(false)
    expect(canBuy([{ payUrl: '' }, { payUrl: 'https://iyzi.link/BBB' }])).toBe(true)
  })
})
