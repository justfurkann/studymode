import type { ImageMimeType, TranscribeImage } from './ai/tasks'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_PDF_PAGES = 150
export const MAX_TEXT_CHARACTERS = 400_000
export const MAX_IMAGE_EDGE = 1600
export const JPEG_QUALITY = 0.8
/** Keep each request well below Vercel's ~4.5 MB body limit. */
export const MAX_BATCH_BASE64_CHARS = 2_400_000

export const ACCEPTED_NOTE_EXTENSIONS = '.pdf,.docx,.pptx,.txt,.md,.jpg,.jpeg,.png,.webp'

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp'])
const supportedExtensions = new Set(['pdf', 'docx', 'pptx', 'txt', 'md', 'jpg', 'jpeg', 'png', 'webp'])
const legacyOffice: Record<string, string> = { doc: 'Word', ppt: 'PowerPoint' }

export interface NoteImportOptions {
  /** Called when an image file or scanned PDF page needs OCR via AI. */
  transcribe?: (images: TranscribeImage[]) => Promise<string>
  /** Reports page reading progress (e.g. done=3, total=8 -> "3/8 sayfa okundu"). */
  onProgress?: (done: number, total: number) => void
}

export function isImageFile(file: File | string): boolean {
  const name = typeof file === 'string' ? file : file.name
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  return imageExtensions.has(extension)
}

/** Extracts notes locally when selectable text exists, or via AI vision for photos and scanned PDFs. */
export async function extractNoteText(file: File, options?: NoteImportOptions): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (legacyOffice[extension]) {
    throw new Error(`Eski ${legacyOffice[extension]} biçimi (.${extension}) desteklenmiyor. Dosyayı ${legacyOffice[extension]}’da açıp .${extension}x ya da PDF olarak kaydet.`)
  }
  if (!supportedExtensions.has(extension)) {
    throw new Error('PDF, Word (.docx), PowerPoint (.pptx), görsel (.jpg, .png, .webp), TXT veya Markdown (.md) dosyası seçebilirsin.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Dosya en fazla 10 MB olabilir. Daha küçük bir dosya seç.')
  }
  if (file.size === 0) {
    throw new Error('Bu dosya boş görünüyor. İçinde ders notları olan bir dosya seç.')
  }

  let rawText: string
  if (imageExtensions.has(extension)) {
    rawText = await extractImageText(file, extension, options)
  } else if (extension === 'pdf') {
    rawText = await extractPdfText(file, options)
  } else if (extension === 'docx' || extension === 'pptx') {
    rawText = await extractOfficeText(file, extension)
  } else {
    rawText = await file.text()
  }

  const text = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!text) {
    throw new Error(
      extension === 'pdf'
        ? options?.transcribe
          ? 'Bu PDF’deki taranmış sayfalardan okunabilir metin çıkarılamadı. Yazıların net olduğu bir dosya seç.'
          : 'Bu PDF’den metin okunamadı. Taranmış sayfalar için ücretsiz yapay zekâya giriş yapman veya ayarlardan kendi API anahtarını bağlaman gerekiyor.'
        : imageExtensions.has(extension)
          ? 'Bu görselde okunabilir ders notu bulunamadı. Yazıların net göründüğü bir fotoğraf seç.'
          : extension === 'pptx' || extension === 'docx'
            ? 'Bu dosyada metin bulunamadı. İçerik resim olarak eklenmiş olabilir; görsellerden metin okuma için dosyayı PDF veya fotoğraf olarak yükle.'
            : 'Bu dosyada okunabilir metin yok. İçinde ders notları olan bir dosya seç.',
    )
  }
  if (text.length > MAX_TEXT_CHARACTERS) {
    throw new Error('Not çok uzun. Tek seferde en fazla 400.000 karakter yükleyebilirsin; notunu bölümlere ayır.')
  }

  return text
}

async function extractImageText(file: File, extension: string, options?: NoteImportOptions): Promise<string> {
  if (!options?.transcribe) {
    throw new Error('Fotoğraftan metin çıkarmak için ücretsiz yapay zekâya giriş yapman veya ayarlardan kendi API anahtarını bağlaman gerekiyor.')
  }
  options.onProgress?.(0, 1)
  const image = await compressImageFile(file, extension)
  const text = await options.transcribe([image])
  options.onProgress?.(1, 1)
  return text
}

async function extractOfficeText(file: File, extension: 'docx' | 'pptx'): Promise<string> {
  // Loaded on demand so the unzip code is only downloaded by people who upload Office files.
  const { docxText, pptxText } = await import('./officeText')
  const data = new Uint8Array(await file.arrayBuffer())
  return extension === 'docx' ? docxText(data) : pptxText(data)
}

async function extractPdfText(file: File, options?: NoteImportOptions): Promise<string> {
  let loadingTask: import('pdfjs-dist').PDFDocumentLoadingTask | undefined

  try {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      enableXfa: false,
      useSystemFonts: true,
    })
    const document = await loadingTask.promise

    if (document.numPages > MAX_PDF_PAGES) {
      throw new NoteImportError('PDF en fazla 150 sayfa olabilir. Çalışacağın bölümü ayrı bir dosya olarak yükle.')
    }

    const pages: string[] = []
    const scannedPageNumbers: number[] = []
    let totalCharacters = 0
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        const pageText = content.items
          .map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : ''))
          .join('')
          .trim()
        totalCharacters += pageText.length
        if (totalCharacters > MAX_TEXT_CHARACTERS) {
          throw new NoteImportError('Not çok uzun. Tek seferde en fazla 400.000 karakter yükleyebilirsin; notunu bölümlere ayır.')
        }
        pages.push(pageText)
        if (!pageText) scannedPageNumbers.push(pageNumber)
      } finally {
        page.cleanup()
      }
    }

    // If the PDF has scanned (textless) pages and an AI transcriber is available, OCR those pages.
    if (scannedPageNumbers.length > 0 && options?.transcribe) {
      const totalScanned = scannedPageNumbers.length
      options.onProgress?.(0, totalScanned)
      const maxPerBatch = totalScanned <= 4 ? 1 : 2
      let doneCount = 0
      let index = 0

      while (index < totalScanned) {
        const batchNums: number[] = []
        const batchImages: TranscribeImage[] = []
        let batchChars = 0

        while (index < totalScanned && batchNums.length < maxPerBatch) {
          const pageNum = scannedPageNumbers[index]
          const img = await renderPdfPageToImage(document, pageNum)
          if (batchImages.length > 0 && batchChars + img.data.length > MAX_BATCH_BASE64_CHARS) {
            break
          }
          batchNums.push(pageNum)
          batchImages.push(img)
          batchChars += img.data.length
          index += 1
        }

        let transcribed: string
        try {
          transcribed = await options.transcribe(batchImages)
        } catch (err) {
          throw new NoteImportError(err instanceof Error ? err.message : 'Taranmış PDF sayfaları okunamadı.')
        }

        pages[batchNums[0] - 1] = transcribed.trim()
        for (let k = 1; k < batchNums.length; k += 1) {
          pages[batchNums[k] - 1] = ''
        }
        totalCharacters += transcribed.length
        if (totalCharacters > MAX_TEXT_CHARACTERS) {
          throw new NoteImportError('Not çok uzun. Tek seferde en fazla 400.000 karakter yükleyebilirsin; notunu bölümlere ayır.')
        }

        doneCount += batchNums.length
        options.onProgress?.(doneCount, totalScanned)
      }
    }

    return pages.filter(Boolean).join('\n\n')
  } catch (error) {
    if (error instanceof NoteImportError) throw error
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new Error('Bu PDF şifre korumalı. Şifresiz bir kopyasını yükle.')
    }
    throw new Error('PDF okunamadı. Dosyanın açılabildiğini kontrol et veya notunu TXT olarak yükle.')
  } finally {
    // Destroy the loading task even after invalid, encrypted, or oversized PDFs.
    await loadingTask?.destroy().catch(() => undefined)
  }
}

async function renderPdfPageToImage(
  document: import('pdfjs-dist').PDFDocumentProxy,
  pageNumber: number,
): Promise<TranscribeImage> {
  const page = await document.getPage(pageNumber)
  try {
    const baseViewport = typeof page.getViewport === 'function' ? page.getViewport({ scale: 1 }) : { width: 800, height: 1100 }
    const longest = Math.max(baseViewport.width || 800, baseViewport.height || 1100, 1)
    const scale = Math.min(2, MAX_IMAGE_EDGE / longest)
    const viewport = typeof page.getViewport === 'function' ? page.getViewport({ scale }) : baseViewport

    if (typeof globalThis.document !== 'undefined') {
      const canvas = globalThis.document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width || 800))
      canvas.height = Math.max(1, Math.round(viewport.height || 1100))
      const context = canvas.getContext('2d')
      if (context && typeof page.render === 'function') {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: context, viewport, canvas } as unknown as Parameters<typeof page.render>[0]).promise
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        const base64 = stripDataUrlPrefix(dataUrl)
        if (base64) return { mimeType: 'image/jpeg', data: base64 }
      }
    }

    if (typeof page.render === 'function') {
      await page.render({ canvasContext: {} as CanvasRenderingContext2D, viewport } as unknown as Parameters<typeof page.render>[0]).promise
    }
    return { mimeType: 'image/jpeg', data: bytesToBase64(new TextEncoder().encode(`pdf-page-${pageNumber}`)) }
  } finally {
    page.cleanup()
  }
}

/** Downscales an image in the browser to max 1600px on its longest edge and compresses as JPEG ~0.8. */
export async function compressImageFile(file: File, extension?: string): Promise<TranscribeImage> {
  const ext = (extension ?? file.name.split('.').pop()?.toLowerCase() ?? 'jpg').toLowerCase()
  const fallbackMime: ImageMimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

  if (typeof globalThis.document !== 'undefined' && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      try {
        const longest = Math.max(bitmap.width, bitmap.height, 1)
        const scale = longest > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longest : 1
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = globalThis.document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(bitmap, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
          const base64 = stripDataUrlPrefix(dataUrl)
          if (base64) return { mimeType: 'image/jpeg', data: base64 }
        }
      } finally {
        bitmap.close?.()
      }
    } catch {
      // Fall through to raw bytes if the environment cannot decode the bitmap (e.g. unit tests).
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  return { mimeType: fallbackMime, data: bytesToBase64(bytes) }
}

function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1).trim() : ''
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

class NoteImportError extends Error {}
