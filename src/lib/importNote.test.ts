import { strToU8, zipSync } from 'fflate'
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
  const render = vi.fn(() => ({ promise: Promise.resolve() }))
  const getViewport = vi.fn(({ scale }: { scale: number }) => ({ width: 800 * scale, height: 1100 * scale }))
  const getPage = vi.fn(async (pageNumber: number) => ({
    getTextContent: async () => ({
      items: [{ str: options.pages?.[pageNumber - 1] ?? '', hasEOL: true }],
    }),
    getViewport,
    render,
    cleanup,
  }))
  const destroy = vi.fn(async () => undefined)
  pdfMocks.getDocument.mockImplementation(() => ({
    promise: options.failure
      ? Promise.reject(options.failure)
      : Promise.resolve({ numPages: options.numPages ?? 1, getPage }),
    destroy,
  }))
  return { destroy, cleanup, getPage, render }
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
    await expect(extractNoteText(new File(['text'], 'notlar.odt'))).rejects.toThrow('Word (.docx), PowerPoint (.pptx)')
    expect(pdfMocks.getDocument).not.toHaveBeenCalled()
  })

  it('asks for the newer format for old Word and PowerPoint files', async () => {
    await expect(extractNoteText(new File(['x'], 'notlar.doc'))).rejects.toThrow('.docx ya da PDF')
    await expect(extractNoteText(new File(['x'], 'sunum.PPT'))).rejects.toThrow('.pptx ya da PDF')
  })

  it('reads Word and PowerPoint files', async () => {
    const docx = zipSync({ 'word/document.xml': strToU8('<w:document><w:p><w:r><w:t>Hücre zarı</w:t></w:r></w:p></w:document>') })
    await expect(extractNoteText(new File([docx], 'hafta1.docx'))).resolves.toBe('Hücre zarı')
    const pptx = zipSync({ 'ppt/slides/slide1.xml': strToU8('<p:sld><a:p><a:r><a:t>Mitokondri</a:t></a:r></a:p></p:sld>') })
    await expect(extractNoteText(new File([pptx], 'sunum.pptx'))).resolves.toBe('Slayt 1\nMitokondri')
  })

  it('explains slides that only contain pictures', async () => {
    const pptx = zipSync({ 'ppt/slides/slide1.xml': strToU8('<p:sld><p:pic/></p:sld>') })
    await expect(extractNoteText(new File([pptx], 'resimli.pptx'))).rejects.toThrow('resim olarak')
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

  it('explains that scanned PDFs need AI or a selectable text source when no transcriber is given', async () => {
    const { destroy } = fakePdf()
    await expect(extractNoteText(new File(['image pdf'], 'tarama.pdf'))).rejects.toThrow('Taranmış sayfalar')
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('transcribes scanned PDF pages via AI and reports page progress', async () => {
    const { destroy, render } = fakePdf({ numPages: 3, pages: ['', 'İkinci sayfa metinli.', ''] })
    const progress: Array<[number, number]> = []
    const transcribe = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('Taranmış birinci sayfa: $F = m \\cdot a$')
      .mockResolvedValueOnce('Taranmış üçüncü sayfa: | Hız | Zaman |')

    const text = await extractNoteText(new File(['scanned pdf'], 'fizik.pdf'), {
      transcribe,
      onProgress: (done, total) => progress.push([done, total]),
    })

    expect(text).toBe('Taranmış birinci sayfa: $F = m \\cdot a$\n\nİkinci sayfa metinli.\n\nTaranmış üçüncü sayfa: | Hız | Zaman |')
    expect(transcribe).toHaveBeenCalledTimes(2)
    expect(render).toHaveBeenCalledTimes(2)
    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ])
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('transcribes uploaded image files (.jpg, .png, .webp) and requires AI when signed out', async () => {
    await expect(extractNoteText(new File(['img'], 'defter.jpg'))).rejects.toThrow('Fotoğraftan metin çıkarmak için')

    const progress: Array<[number, number]> = []
    const transcribe = vi.fn(async () => 'Defter notu: Mitokondri hücrenin enerji santralidir.')
    const text = await extractNoteText(new File(['img-bytes'], 'defter.png'), {
      transcribe,
      onProgress: (done, total) => progress.push([done, total]),
    })
    expect(text).toBe('Defter notu: Mitokondri hücrenin enerji santralidir.')
    expect(transcribe).toHaveBeenCalledOnce()
    expect(progress).toEqual([
      [0, 1],
      [1, 1],
    ])
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

