/*
 * Generated images live in this browser's localStorage, which holds only about 5 MB for the whole
 * site (and, before signing in, the student's notes too). An AI picture arrives as a PNG of 1-2 MB,
 * so a few of them used to fill the space, and the next save failed without a word: the picture was
 * gone after a reload. Pictures are now shrunk to a sensible size as JPEG (a tenth of the bytes),
 * and saving tells the caller whether it worked, dropping the oldest pictures if it must.
 */

const MAX_SIDE = 1280
const QUALITY = 0.86

/** The yellow brand "S" (no tile), drawn on the dark label. Loaded once; null if it cannot load. */
const MARK_SRC = '/brand/svg/symbol-yellow.svg'
/** symbol-yellow.svg is 176 × 221. */
const MARK_RATIO = 176 / 221
let markLoad: Promise<HTMLImageElement | null> | null = null
export function loadWatermarkMark(): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null)
  markLoad ??= new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      markLoad = null
      resolve(null)
    }
    img.src = MARK_SRC
  })
  return markLoad
}

/**
 * The "studymode.fun" label on generated pictures: a small dark, half-transparent pill in the
 * bottom-right corner with the yellow "S" and the address in white. Drawn after the picture arrives
 * (models print text badly), sized to the picture so it stays readable and small. Without the mark
 * (it failed to load) the label is the address alone.
 */
export function drawWatermark(g: CanvasRenderingContext2D, width: number, height: number, mark: HTMLImageElement | null = null) {
  const font = Math.max(13, Math.round(Math.min(width, height) * 0.028))
  const pad = Math.round(font * 0.55)
  const markH = Math.round(font * 1.3)
  const markW = mark ? Math.round(markH * MARK_RATIO) : 0
  g.save()
  g.font = `700 ${font}px "Figtree Variable", system-ui, -apple-system, sans-serif`
  const text = 'studymode.fun'
  const textW = g.measureText(text).width
  const gap = mark ? pad * 0.7 : 0
  const w = pad + markW + gap + textW + pad
  const h = markH + pad * 1.1
  const x = width - w - Math.round(font * 0.7)
  const y = height - h - Math.round(font * 0.7)
  g.fillStyle = 'rgba(17, 20, 42, 0.74)'
  g.beginPath()
  g.roundRect(x, y, w, h, h / 2)
  g.fill()
  if (mark) g.drawImage(mark, x + pad, y + (h - markH) / 2, markW, markH)
  g.fillStyle = '#ffffff'
  g.textBaseline = 'middle'
  g.fillText(text, x + pad + markW + gap, y + h / 2 + 1)
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
    if (watermark) drawWatermark(g, canvas.width, canvas.height, await loadWatermarkMark())
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
