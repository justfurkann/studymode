/*
 * Generated images live in this browser's localStorage, which holds only about 5 MB for the whole
 * site (and, before signing in, the student's notes too). An AI picture arrives as a PNG of 1-2 MB,
 * so a few of them used to fill the space, and the next save failed without a word: the picture was
 * gone after a reload. Pictures are now shrunk to a sensible size as JPEG (a tenth of the bytes),
 * and saving tells the caller whether it worked, dropping the oldest pictures if it must.
 */

const MAX_SIDE = 1280
const QUALITY = 0.86

/** Downscales a data-URL image and re-encodes it as JPEG. Returns the original if that is not smaller. */
export async function compressImage(dataUrl: string, maxSide = MAX_SIDE, quality = QUALITY): Promise<string> {
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
    const out = canvas.toDataURL('image/jpeg', quality)
    return out.length < dataUrl.length ? out : dataUrl
  } catch {
    return dataUrl
  }
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
