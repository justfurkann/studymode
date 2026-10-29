export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_PDF_PAGES = 150
export const MAX_TEXT_CHARACTERS = 400_000
export const ACCEPTED_NOTE_EXTENSIONS = '.pdf,.txt,.md'

const supportedExtensions = new Set(['pdf', 'txt', 'md'])

/** Extracts notes locally. File contents are never sent to a server. */
export async function extractNoteText(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (!supportedExtensions.has(extension)) {
    throw new Error('PDF, TXT veya Markdown (.md) dosyası seçebilirsin.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Dosya en fazla 10 MB olabilir. Daha küçük bir dosya seç.')
  }
  if (file.size === 0) {
    throw new Error('Bu dosya boş görünüyor. İçinde ders notları olan bir dosya seç.')
  }

  const rawText = extension === 'pdf' ? await extractPdfText(file) : await file.text()
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
        ? 'Bu PDF’den metin okunamadı. Taranmış sayfalar ve görseller henüz desteklenmiyor; metni seçilebilen bir PDF veya TXT dosyası kullan.'
        : 'Bu dosyada okunabilir metin yok. İçinde ders notları olan bir dosya seç.',
    )
  }
  if (text.length > MAX_TEXT_CHARACTERS) {
    throw new Error('Not çok uzun. Tek seferde en fazla 400.000 karakter yükleyebilirsin; notunu bölümlere ayır.')
  }

  return text
}

async function extractPdfText(file: File): Promise<string> {
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
      } finally {
        page.cleanup()
      }
    }
    return pages.join('\n\n')
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

class NoteImportError extends Error {}
