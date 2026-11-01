/*
 * Generated images live in this browser's localStorage, which holds only about 5 MB for the whole
 * site (and, before signing in, the student's notes too). An AI picture arrives as a PNG of 1-2 MB,
 * so a few of them used to fill the space, and the next save failed without a word: the picture was
 * gone after a reload. Pictures are now shrunk to a sensible size as JPEG (a tenth of the bytes),
 * and saving tells the caller whether it worked, dropping the oldest pictures if it must.
 */

const MAX_SIDE = 1280
const QUALITY = 0.86

/**
 * The "studymode.fun" label on generated pictures: a small dark, half-transparent pill in the
 * bottom-right corner with the brand mark and the address in white. Drawn after the picture arrives
 * (models print text badly), sized to the picture so it stays readable and small.
 */
export function drawWatermark(g: CanvasRenderingContext2D, width: number, height: number) {
  const font = Math.max(13, Math.round(Math.min(width, height) * 0.028))
  const pad = Math.round(font * 0.55)
  const mark = Math.round(font * 1.25)
  g.save()
  g.font = `700 ${font}px "Figtree Variable", system-ui, -apple-system, sans-serif`
  const text = 'studymode.fun'
  const textW = g.measureText(text).width
  const w = pad + mark + pad * 0.8 + textW + pad
  const h = mark + pad * 1.2
  const x = width - w - Math.round(font * 0.7)
  const y = height - h - Math.round(font * 0.7)
  g.fillStyle = 'rgba(17, 20, 42, 0.72)'
  g.beginPath()
  g.roundRect(x, y, w, h, h / 2)
  g.fill()
  // The brand mark: navy tile, yellow highlighter stroke.
  const mx = x + pad
  const my = y + (h - mark) / 2
  const u = mark / 32
  g.fillStyle = '#1b2250'
  g.beginPath()
  g.roundRect(mx, my, mark, mark, 8 * u)
  g.fill()
  g.fillStyle = '#ffe14d'
  g.beginPath()
  g.moveTo(mx + 7 * u, my + 22 * u)
  g.lineTo(mx + 22 * u, my + 7 * u)
  g.lineTo(mx + 25 * u, my + 10 * u)
  g.lineTo(mx + 10 * u, my + 25 * u)
  g.lineTo(mx + 7 * u, my + 25 * u)
  g.closePath()
  g.fill()
  g.strokeStyle = '#ffe14d'
  g.lineWidth = 2.6 * u
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(mx + 7 * u, my + 25.4 * u)
  g.lineTo(mx + 25 * u, my + 25.4 * u)
  g.stroke()
  g.fillStyle = '#ffffff'
  g.textBaseline = 'middle'
  g.fillText(text, mx + mark + pad * 0.8, y + h / 2 + 1)
  g.restore()
}

/**
 * Downscales a data-URL image and re-encodes it as JPEG. Returns the original if that is not
 * smaller, unless `watermark` is set: then the studymode.fun label is added and the result always used.
 */
export async function compressImage(dataUrl: string, maxSide = MAX_SIDE, quality = QUALITY, watermark = false): Promise<string> {
  if (!dataUrl.startsWith('data:image/') || typeof document === 'undefined') return dataUrl
  try {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const g = canvas.getContext('2d')
    if (!g) return dataUrl
    // JPEG has no transparency: put transparent pixels on white, as on paper.
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    if (watermark) drawWatermark(g, canvas.width, canvas.height)
    const out = canvas.toDataURL('image/jpeg', quality)
    return watermark || out.length < dataUrl.length ? out : dataUrl
  } catch {
    return dataUrl
  }
}

/** An AI picture as it is kept and shown: shrunk, JPEG, with the studymode.fun label. */
export const finishAiImage = (dataUrl: string) => compressImage(dataUrl, MAX_SIDE, QUALITY, true)

/** File extension that matches the picture's real format (posters are SVG, AI pictures JPEG). */
export function imageExtension(dataUrl: string): 'svg' | 'jpg' | 'png' | 'webp' {
  if (dataUrl.startsWith('data:image/svg')) return 'svg'
  if (dataUrl.startsWith('data:image/jpeg')) return 'jpg'
  if (dataUrl.startsWith('data:image/webp')) return 'webp'
  return 'png'
}

export type SaveResult = 'saved' | 'trimmed' | 'failed'

/**
 * Saves a list (newest first) as JSON. If storage is full, drops the oldest entries until it fits.
 * "trimmed" means some old entries had to go; "failed" means not even the newest one fits.
 */
export function saveList<T>(key: string, items: T[], storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage): SaveResult {
  for (let count = items.length; count >= 0; count--) {
    try {
      if (count === 0) {
        storage.removeItem(key)
        return items.length ? 'failed' : 'saved'
      }
      storage.setItem(key, JSON.stringify(items.slice(0, count)))
      return count === items.length ? 'saved' : 'trimmed'
    } catch {
      // Too big: try with one fewer.
    }
  }
  return 'failed'
}

/** Short Turkish message for a save that did not fully work, or '' when it did. */
export function saveMessage(result: SaveResult): string {
  if (result === 'trimmed') return 'Yer açmak için en eski görseller bu cihazdan silindi. Saklamak istediklerini indir.'
  if (result === 'failed') return 'Görsel bu cihaza kaydedilemedi (tarayıcı alanı dolu). Kaybolmaması için şimdi indir.'
  return ''
}
