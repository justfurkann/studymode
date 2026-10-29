import { beforeEach, describe, expect, it, vi } from 'vitest'
import { extractNoteText, MAX_FILE_BYTES, MAX_TEXT_CHARACTERS } from './importNote'

const pdfMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  workerOptions: { workerSrc: '' },
}))

vi.mock('pdfjs-dist', () => ({
  getDocument: pdfMocks.getDocument,
  GlobalWorkerOptions: pdfMocks.workerOptions,
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: '/assets/pdf.worker.test.mjs',
}))

function fakePdf(options: { numPages?: number; pages?: string[]; failure?: Error } = {}) {
  const cleanup = vi.fn()
  const getPage = vi.fn(async (pageNumber: number) => ({
    getTextContent: async () => ({
      items: [{ str: options.pages?.[pageNumber - 1] ?? '', hasEOL: true }],
    }),
    cleanup,
  }))
  const destroy = vi.fn(async () => undefined)
  pdfMocks.getDocument.mockImplementation(() => ({
    promise: options.failure
      ? Promise.reject(options.failure)
      : Promise.resolve({ numPages: options.numPages ?? 1, getPage }),
    destroy,
  }))
  return { destroy, cleanup, getPage }
}

describe('extractNoteText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads UTF-8 Turkish text and normalizes line endings', async () => {
    const file = new File(['\uFEFFÖğrenme: kalıcı davranış değişikliğidir.\r\n\r\nBellek.\r'], 'notlar.TXT')
    await expect(extractNoteText(file)).resolves.toBe('Öğrenme: kalıcı davranış değişikliğidir.\n\nBellek.')
    expect(pdfMocks.getDocument).not.toHaveBeenCalled()
  })

  it('preserves Markdown note content', async () => {
    const file = new File(['# Hücre\n\n- Çekirdek\n- Mitokondri'], 'biyoloji.md')
    await expect(extractNoteText(file)).resolves.toBe('# Hücre\n\n- Çekirdek\n- Mitokondri')
  })

  it('rejects unsupported formats before attempting extraction', async () => {
    await expect(extractNoteText(new File(['text'], 'notlar.docx'))).rejects.toThrow('PDF, TXT veya Markdown')
    expect(pdfMocks.getDocument).not.toHaveBeenCalled()
  })

  it('rejects oversized files before reading their contents', async () => {
    const file = new File(['small'], 'notlar.txt')
    Object.defineProperty(file, 'size', { value: MAX_FILE_BYTES + 1 })
    const read = vi.spyOn(file, 'text')
    await expect(extractNoteText(file)).rejects.toThrow('10 MB')
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects empty and whitespace-only notes', async () => {
    await expect(extractNoteText(new File([], 'bos.txt'))).rejects.toThrow('boş')
    await expect(extractNoteText(new File(['  \n\t'], 'bos.md'))).rejects.toThrow('okunabilir metin yok')
  })

  it('rejects huge extracted text instead of silently truncating notes', async () => {
    await expect(extractNoteText(new File(['a'.repeat(MAX_TEXT_CHARACTERS + 1)], 'notlar.txt'))).rejects.toThrow('400.000')
  })

  it('extracts PDF pages in order and disposes the document and pages', async () => {
    const { destroy, cleanup, getPage } = fakePdf({ numPages: 2, pages: ['Birinci sayfa.', 'İkinci sayfa.'] })
    await expect(extractNoteText(new File(['pdf bytes'], 'notlar.pdf'))).resolves.toBe('Birinci sayfa.\n\nİkinci sayfa.')
    expect(pdfMocks.workerOptions.workerSrc).toBe('/assets/pdf.worker.test.mjs')
    expect(getPage.mock.calls).toEqual([[1], [2]])
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('explains that scanned PDFs need a selectable text source', async () => {
    const { destroy } = fakePdf()
    await expect(extractNoteText(new File(['image pdf'], 'tarama.pdf'))).rejects.toThrow('Taranmış sayfalar')
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('rejects PDFs over the page limit before extracting any pages', async () => {
    const { destroy, getPage } = fakePdf({ numPages: 151 })
    await expect(extractNoteText(new File(['long pdf'], 'kitap.pdf'))).rejects.toThrow('150 sayfa')
    expect(getPage).not.toHaveBeenCalled()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('reports protected PDFs without waiting for an interactive password', async () => {
    const error = new Error('Password missing')
    error.name = 'PasswordException'
    const { destroy } = fakePdf({ failure: error })
    await expect(extractNoteText(new File(['locked pdf'], 'kilitli.pdf'))).rejects.toThrow('şifre korumalı')
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('cleans up after corrupt PDFs and offers a useful recovery path', async () => {
    const { destroy } = fakePdf({ failure: new Error('Invalid PDF') })
    await expect(extractNoteText(new File(['invalid'], 'bozuk.pdf'))).rejects.toThrow('TXT olarak yükle')
    expect(destroy).toHaveBeenCalledOnce()
  })
})
