/** Logical print coordinates, scaled together only when a long receipt needs it. */
export function receiptLayout(rows: number, mottoLines: number) {
  const tableTop = 680
  const tableBottom = tableTop + Math.max(1, rows) * 48
  const totalTop = tableBottom + 30
  const noteTop = totalTop + 128
  const barcodeTop = noteTop + Math.max(1, mottoLines) * 34 + 86
  const serialY = barcodeTop + 76
  const footerY = serialY + 36
  const height = footerY + 78
  const scale = Math.min(1, 1610 / height)
  return { tableTop, tableBottom, totalTop, noteTop, barcodeTop, serialY, footerY, height, scale }
}
