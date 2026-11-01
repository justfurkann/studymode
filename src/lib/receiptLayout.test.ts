import { describe, expect, it } from 'vitest'
import { receiptLayout } from './receiptLayout'

describe('receipt print area', () => {
  it.each([0, 1, 6, 10, 20])('keeps the barcode and footer on paper with %i rows', rows => {
    const l = receiptLayout(rows, 3)
    expect(l.barcodeTop).toBeGreaterThan(l.noteTop + 3 * 34)
    expect(l.serialY).toBeGreaterThan(l.barcodeTop + 43)
    expect(l.footerY).toBeLessThan(l.height - 50)
    expect(l.height * l.scale).toBeLessThanOrEqual(1610)
    expect(l.scale).toBeGreaterThan(0)
  })

  it('reserves space for the complete personal note instead of cropping it', () => {
    const short = receiptLayout(6, 1)
    const long = receiptLayout(6, 5)
    expect(long.barcodeTop - short.barcodeTop).toBe(4 * 34)
    expect(long.height - short.height).toBe(4 * 34)
  })
})
