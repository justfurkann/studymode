import { Download, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { readRecords } from '../lib/mola'
import { buildReceipt, formatLine, type Receipt, type ReceiptPeriod } from '../lib/receipt'
import { useStore } from '../lib/store'
import { Modal } from './ui'

/*
 * "Çalışma fişi": a thermal till receipt of the student's day or week, drawn on a canvas at story
 * size (1080×1920) so it can be saved as a PNG or shared straight to WhatsApp / Instagram.
 * The receipt is always paper-white with dark ink, whatever the app theme; only the highlighter
 * stroke follows the student's pen colour.
 */

const W = 1080
const H = 1920
const PAPER_W = 780
const FONT = '"Courier New", "Cousine", "Liberation Mono", ui-monospace, monospace'
const INK = '#1d1f2b'
const CHARS = 34

function seeded(seed: string) {
  let s = Number(seed) >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function penColor(): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue('--hi').trim() || '#ffe14d'
  } catch {
    return '#ffe14d'
  }
}

/** Splits text into lines of at most `max` characters, on spaces. */
function wrap(text: string, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > max) {
      if (line) out.push(line)
      line = word
    } else line = (line + ' ' + word).trim()
  }
  if (line) out.push(line)
  return out
}

/** Draws the receipt and returns the canvas. Exported for tests that want to look at it. */
export function drawReceipt(receipt: Receipt, pen = penColor()): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')
  if (!g) return canvas
  const rng = seeded(receipt.code)

  // Desk: navy grid paper, like the app.
  g.fillStyle = '#1b2250'
  g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(255,255,255,0.05)'
  g.lineWidth = 2
  for (let x = 0; x <= W; x += 44) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  for (let y = 0; y <= H; y += 44) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }

  const size = 31
  const lh = 46
  const pad = 58
  const cw = (PAPER_W - pad * 2) / CHARS

  // Work out the height first.
  const verdict = wrap(receipt.verdict, CHARS)
  const body = receipt.empty ? wrap('KASADAN HENÜZ BİR ŞEY GEÇMEDİ. BİR KART ÇEVİR, FİŞ DOLSUN.', CHARS) : receipt.lines.map((l) => formatLine(l, CHARS))
  // Same steps as the drawing below: header, rules, details, lines, total, verdict, barcode, code, footer.
  const rows = 3 + 1 + 3 + 1 + body.length + 1 + 1.4 + verdict.length + 0.3 + 1 + 1 + 1
  const paperH = 110 + 14 + 100 + 6 + 70 + rows * lh
  const top = Math.max(120, (H - paperH) / 2 - 40)
  const left = (W - PAPER_W) / 2

  g.save()
  g.translate(W / 2, top + paperH / 2)
  g.rotate(-0.025)
  g.translate(-W / 2, -(top + paperH / 2))

  // Paper with torn top and bottom edges.
  const tooth = 18
  g.beginPath()
  g.moveTo(left, top + tooth)
  for (let x = left; x < left + PAPER_W; x += tooth * 2) {
    g.lineTo(x + tooth, top + rng() * 6)
    g.lineTo(Math.min(x + tooth * 2, left + PAPER_W), top + tooth)
  }
  g.lineTo(left + PAPER_W, top + paperH - tooth)
  for (let x = left + PAPER_W; x > left; x -= tooth * 2) {
    g.lineTo(x - tooth, top + paperH - rng() * 6)
    g.lineTo(Math.max(x - tooth * 2, left), top + paperH - tooth)
  }
  g.closePath()
  g.shadowColor = 'rgba(0,0,0,0.45)'
  g.shadowBlur = 40
  g.shadowOffsetY = 18
  g.fillStyle = '#fbfaf4'
  g.fill()
  g.shadowColor = 'transparent'
  g.save()
  g.clip()

  // Crumples: soft light and dark diagonal bands.
  for (let i = 0; i < 7; i++) {
    const y = top + rng() * paperH
    const grad = g.createLinearGradient(left, y - 60, left + PAPER_W, y + 80)
    const dark = rng() < 0.5
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.5, dark ? 'rgba(60,50,30,0.035)' : 'rgba(255,255,255,0.6)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(left, y - 120, PAPER_W, 240)
  }
  // Thermal speckle.
  g.fillStyle = 'rgba(40,40,50,0.08)'
  for (let i = 0; i < 900; i++) g.fillRect(left + rng() * PAPER_W, top + rng() * paperH, 1.5, 1.5)

  g.fillStyle = INK
  g.textBaseline = 'alphabetic'
  let y = top + 110
  const center = (text: string, font = `700 ${size}px ${FONT}`) => {
    g.font = font
    g.textAlign = 'center'
    g.fillText(text, W / 2, y)
    y += lh
  }
  const row = (text: string, font = `600 ${size}px ${FONT}`) => {
    g.font = font
    g.textAlign = 'left'
    // Character by character, so every font lines up like a real receipt printer.
    for (let i = 0; i < text.length; i++) g.fillText(text[i], left + pad + i * cw, y)
    y += lh
  }
  const rule = () => row('-'.repeat(CHARS))

  center('STUDYMODE', `800 ${size * 1.9}px ${FONT}`)
  y += 14
  center('ÇALIŞMA MARKETİ A.Ş.', `600 ${size * 0.8}px ${FONT}`)
  center(receipt.title)
  rule()
  row(`TARİH: ${receipt.date}`)
  row(`SAAT : ${receipt.time}`)
  row(`KASA : ${receipt.register}`)
  rule()
  for (const line of body) row(line)
  rule()

  // The total, struck through with the highlighter.
  const totalText = formatLine(receipt.total, CHARS)
  g.save()
  g.fillStyle = pen
  g.globalAlpha = 0.9
  g.beginPath()
  const hy = y - size + 2
  g.moveTo(left + pad - 14, hy + 6)
  g.lineTo(left + PAPER_W - pad + 10, hy - 4)
  g.lineTo(left + PAPER_W - pad + 16, hy + size + 8)
  g.lineTo(left + pad - 10, hy + size + 14)
  g.closePath()
  g.fill()
  g.restore()
  row(totalText, `800 ${size}px ${FONT}`)
  y += lh * 0.4
  for (const line of verdict) center(line, `700 ${size * 0.92}px ${FONT}`)
  y += lh * 0.3

  // Barcode.
  const codeRng = seeded(receipt.code)
  let bx = left + pad + 20
  const bw = PAPER_W - pad * 2 - 40
  const barTop = y - 10
  g.fillStyle = INK
  while (bx < left + pad + 20 + bw - 6) {
    const width = 2 + Math.floor(codeRng() * 4) * 2
    if (codeRng() > 0.35) g.fillRect(bx, barTop, width, 110)
    bx += width + 2 + Math.floor(codeRng() * 3) * 2
  }
  y = barTop + 110 + lh
  center(receipt.code.split('').join(' '), `600 ${size * 0.8}px ${FONT}`)
  y += 6
  center(receipt.footer, `600 ${size * 0.72}px ${FONT}`)
  g.restore()

  // The studymode.fun stamp, pressed a little crooked over the corner.
  const sx = left + PAPER_W - 112
  const sy = top + paperH - 250
  g.save()
  g.translate(sx, sy)
  g.rotate(-0.32)
  g.globalAlpha = 0.78
  g.strokeStyle = '#2a3fa8'
  g.fillStyle = '#2a3fa8'
  g.lineWidth = 6
  g.beginPath()
  g.arc(0, 0, 112, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 3
  g.beginPath()
  g.arc(0, 0, 94, 0, Math.PI * 2)
  g.stroke()
  g.font = `800 26px ${FONT}`
  g.textAlign = 'center'
  const arc = 'STUDYMODE.FUN · STUDYMODE.FUN · '
  for (let i = 0; i < arc.length; i++) {
    g.save()
    g.rotate((i / arc.length) * Math.PI * 2)
    g.fillText(arc[i], 0, -100 + 26)
    g.restore()
  }
  g.font = `800 34px ${FONT}`
  g.fillText('ONAYLI', 0, 12)
  g.restore()
  g.restore()

  // Caption under the receipt.
  g.fillStyle = '#ffe14d'
  g.font = `800 40px ${FONT}`
  g.textAlign = 'center'
  g.fillText('studymode.fun', W / 2, H - 90)
  return canvas
}

export default function ReceiptDialog({ onClose }: { onClose: () => void }) {
  const { data } = useStore()
  const [period, setPeriod] = useState<ReceiptPeriod>('gun')
  const receipt = useMemo(() => buildReceipt(data, period, readRecords()), [data, period])
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null)

  useEffect(() => {
    let url = ''
    let cancelled = false
    drawReceipt(receipt).toBlob((blob) => {
      if (!blob || cancelled) return
      url = URL.createObjectURL(blob)
      setImage({ url, blob })
    }, 'image/png')
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [receipt])

  const fileName = `studymode-fis-${period === 'gun' ? 'gunluk' : 'haftalik'}.png`
  const file = image ? new File([image.blob], fileName, { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], text: 'Bugünkü çalışma fişim · studymode.fun' })
    } catch {
      // Closed the share sheet: nothing to do.
    }
  }

  return (
    <Modal title="Çalışma fişi" onClose={onClose}>
      <div className="segmented" role="group" aria-label="Fiş dönemi">
        <button aria-pressed={period === 'gun'} onClick={() => setPeriod('gun')}>
          Bugün
        </button>
        <button aria-pressed={period === 'hafta'} onClick={() => setPeriod('hafta')}>
          Bu hafta
        </button>
      </div>
      <div className="receipt-preview">
        {image ? <img src={image.url} alt={`${receipt.title}: ${receipt.lines.map((l) => `${l.qty} ${l.label} ${l.value}`).join(', ')}. ${receipt.verdict}`} /> : <div className="receipt-loading" />}
      </div>
      <p className="subtle" style={{ fontSize: '0.875rem' }}>
        Story boyutunda bir görsel. Not içeriklerin fişte yer almaz; yalnızca ders adları ve sayılar.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {canShare && (
          <button className="btn btn-primary" onClick={share}>
            <Share2 size={18} /> Paylaş
          </button>
        )}
        <a className={`btn ${canShare ? '' : 'btn-primary'}`} href={image?.url} download={fileName} aria-disabled={!image}>
          <Download size={18} /> PNG indir
        </a>
      </div>
    </Modal>
  )
}
