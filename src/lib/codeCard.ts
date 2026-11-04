import qrcode from 'qrcode-generator'
import { codeLink } from './premiumCodes'

/*
 * A Premium code as a picture to send (WhatsApp, Instagram, e-mail): the QR code of its link, the
 * code itself and how many days it gives. Always light, whatever the theme, so phones scan it.
 * The colours are the brand's light-theme ink and paper (global.css), written out because a
 * canvas cannot read CSS variables in a saved image.
 */
const PAPER = '#fafaf6'
const INK = '#1b2250'
const HIGHLIGHT = '#ffe14d'
const MUTED = '#5a6080'

/** Which squares of the QR code are dark, row by row. */
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}

/** Draws the card and gives it back as a PNG. */
export async function codeCardPng(code: string, days: number, origin?: string): Promise<Blob> {
  const W = 720
  const H = 980
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!
  g.fillStyle = PAPER
  g.fillRect(0, 0, W, H)
  g.strokeStyle = INK
  g.lineWidth = 6
  g.beginPath()
  g.roundRect(18, 18, W - 36, H - 36, 36)
  g.stroke()

  const font = (weight: number, size: number, mono = false) =>
    `${weight} ${size}px ${mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : '"Bricolage Grotesque", Figtree, system-ui, sans-serif'}`
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'

  // "StudyMode Premium" with the second word highlighted, like the app's headings.
  g.font = font(800, 54)
  const first = 'StudyMode '
  const second = 'Premium'
  const total = g.measureText(first + second).width
  const left = (W - total) / 2
  const w1 = g.measureText(first).width
  const w2 = g.measureText(second).width
  g.fillStyle = HIGHLIGHT
  g.fillRect(left + w1 - 6, 86, w2 + 12, 34)
  g.fillStyle = INK
  g.textAlign = 'left'
  g.fillText(first, left, 118)
  g.fillText(second, left + w1, 118)
  g.textAlign = 'center'
  g.font = font(600, 30)
  g.fillStyle = MUTED
  g.fillText(`${days} gün Premium kodu`, W / 2, 168)

  // The QR code of the redeem link, on white with a quiet margin.
  const modules = qrModules(codeLink(code, origin))
  const n = modules.length
  const box = 520
  const cell = Math.floor(box / (n + 8))
  const size = cell * (n + 8)
  const x0 = (W - size) / 2
  const y0 = 205
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.roundRect(x0, y0, size, size, 20)
  g.fill()
  g.fillStyle = INK
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (modules[r][c]) g.fillRect(x0 + (c + 4) * cell, y0 + (r + 4) * cell, cell, cell)

  const below = y0 + size + 62
  g.font = font(700, 30)
  g.fillStyle = INK
  g.fillText('Telefonla okut, Premium hesabında açılsın', W / 2, below)
  g.font = font(600, 24)
  g.fillStyle = MUTED
  g.fillText('ya da studymode.fun’da “Kodum var” alanına yaz:', W / 2, below + 44)
  g.font = font(700, 40, true)
  g.fillStyle = INK
  g.fillText(code, W / 2, below + 104)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'))
}
