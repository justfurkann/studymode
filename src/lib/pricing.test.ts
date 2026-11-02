import { describe, expect, it } from 'vitest'
import { buyUrl, formatPrice, PACKAGES } from './pricing'

describe('pricing', () => {
  it('has the two packages with the prices the seller gave', () => {
    expect(PACKAGES.map((p) => [p.id, p.days, p.price])).toEqual([
      ['aylik', 30, 50],
      ['donem', 120, 150],
    ])
    expect(formatPrice(150)).toBe('150 TL')
  })

  it('shows "Satın al" only with a Shopier link: the package’s own, else the general one', () => {
    expect(buyUrl({ shopierUrl: '' }, '')).toBeNull()
    expect(buyUrl({ shopierUrl: '' }, 'https://www.shopier.com/genel')).toBe('https://www.shopier.com/genel')
    expect(buyUrl({ shopierUrl: 'https://www.shopier.com/aylik' }, 'https://www.shopier.com/genel')).toBe('https://www.shopier.com/aylik')
  })
})
