import { unzipSync } from 'fflate'

/** Office files are zip archives; refuse ones that would unpack to something unreasonably large. */
const MAX_UNPACKED_BYTES = 60 * 1024 * 1024

export class OfficeImportError extends Error {}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&')
}

/** Text of each paragraph (`<w:p>` / `<a:p>`), keeping tabs and line breaks inside it. */
function paragraphs(xml: string, ns: 'w' | 'a'): string[] {
  const textTag = new RegExp(`<${ns}:t(?:\\s[^>]*)?>([^<]*)</${ns}:t>|<${ns}:tab/>|<${ns}:br(?:\\s[^>]*)?/>`, 'g')
  return xml
    .split(new RegExp(`</${ns}:p>`))
    .map((chunk) => {
      let line = ''
      for (const match of chunk.matchAll(textTag)) {
        if (match[1] !== undefined) line += decodeXml(match[1])
        else line += match[0].includes(':tab') ? '\t' : '\n'
      }
      return line.trim()
    })
    .filter(Boolean)
}

function unzip(data: Uint8Array, wanted: (name: string) => boolean): Record<string, Uint8Array> {
  let unpacked = 0
  try {
    return unzipSync(data, {
      filter: (file) => {
        if (!wanted(file.name)) return false
        unpacked += file.originalSize
        if (unpacked > MAX_UNPACKED_BYTES) throw new OfficeImportError('Dosyanın içeriği çok büyük. Daha küçük bir bölümünü yükle.')
        return true
      },
    })
  } catch (error) {
    if (error instanceof OfficeImportError) throw error
    throw new OfficeImportError('Dosya açılamadı. Bozuk olmadığını kontrol et ya da PDF olarak kaydedip yükle.')
  }
}

const utf8 = new TextDecoder('utf-8')

/** Plain text of a .docx file, one paragraph per line. */
export function docxText(data: Uint8Array): string {
  const files = unzip(data, (name) => name === 'word/document.xml')
  const xml = files['word/document.xml']
  if (!xml) throw new OfficeImportError('Bu bir Word (.docx) belgesine benzemiyor. Dosyayı Word’de açıp .docx ya da PDF olarak yeniden kaydet.')
  return paragraphs(utf8.decode(xml), 'w').join('\n')
}

const slideNumber = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0)

/** Plain text of a .pptx file: each slide's text in order, followed by its speaker notes. */
export function pptxText(data: Uint8Array): string {
  const files = unzip(data, (name) => /^ppt\/(slides|notesSlides)\/(_rels\/)?\w+\d+\.xml(\.rels)?$/.test(name))
  const slides = Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b))
  if (!slides.length) throw new OfficeImportError('Bu bir PowerPoint (.pptx) sunumuna benzemiyor. Dosyayı .pptx ya da PDF olarak yeniden kaydet.')

  return slides
    .map((name, index) => {
      const lines = paragraphs(utf8.decode(files[name]), 'a')
      // Notes are linked from the slide's relationship file, not by number.
      const rels = files[name.replace('slides/', 'slides/_rels/') + '.rels']
      const notesTarget = rels && utf8.decode(rels).match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/)?.[1]
      const notesXml = notesTarget && files[`ppt/notesSlides/${notesTarget}`]
      // Notes pages repeat the slide number as a placeholder; drop bare numbers.
      const notes = notesXml ? paragraphs(utf8.decode(notesXml), 'a').filter((line) => !/^\d+$/.test(line)) : []
      const parts = [`Slayt ${index + 1}`, ...lines]
      if (notes.length) parts.push(`Konuşmacı notları: ${notes.join(' ')}`)
      return parts.length > 1 ? parts.join('\n') : ''
    })
    .filter(Boolean)
    .join('\n\n')
}
