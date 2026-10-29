import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { docxText, OfficeImportError, pptxText } from './officeText'

const wordDoc = (body: string) =>
  zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`),
  })

const para = (...runs: string[]) => `<w:p>${runs.map((r) => `<w:r><w:t xml:space="preserve">${r}</w:t></w:r>`).join('')}</w:p>`

describe('docxText', () => {
  it('reads paragraphs in order, joining runs and decoding entities', () => {
    const doc = wordDoc(para('Hücre ', 'zarı') + '<w:p/>' + para('Seçici &amp; geçirgen &lt;yapı&gt;') + `<w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t></w:r></w:p>`)
    expect(docxText(doc)).toBe('Hücre zarı\nSeçici & geçirgen <yapı>\na\tb')
  })

  it('explains files that are not Word documents', () => {
    expect(() => docxText(zipSync({ 'a.txt': strToU8('x') }))).toThrow(OfficeImportError)
    expect(() => docxText(strToU8('not a zip'))).toThrow(/açılamadı/)
  })
})

const slide = (...texts: string[]) => strToU8(`<p:sld xmlns:a="a"><p:txBody>${texts.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sld>`)

describe('pptxText', () => {
  it('orders slides numerically and attaches speaker notes', () => {
    const pptx = zipSync({
      'ppt/slides/slide10.xml': slide('Son slayt'),
      'ppt/slides/slide2.xml': slide('Mitokondri', 'Enerji üretir'),
      'ppt/slides/slide1.xml': slide('Hücre Biyolojisi'),
      'ppt/slides/_rels/slide2.xml.rels': strToU8('<Relationships><Relationship Target="../notesSlides/notesSlide7.xml"/></Relationships>'),
      'ppt/notesSlides/notesSlide7.xml': slide('Sınavda çıkar', '2'),
      'ppt/media/image1.png': new Uint8Array(10),
    })
    expect(pptxText(pptx)).toBe('Slayt 1\nHücre Biyolojisi\n\nSlayt 2\nMitokondri\nEnerji üretir\nKonuşmacı notları: Sınavda çıkar\n\nSlayt 3\nSon slayt')
  })

  it('skips slides without text and rejects non-presentations', () => {
    const pptx = zipSync({ 'ppt/slides/slide1.xml': slide(), 'ppt/slides/slide2.xml': slide('Metin') })
    expect(pptxText(pptx)).toBe('Slayt 2\nMetin')
    expect(() => pptxText(zipSync({ 'word/document.xml': strToU8('<w/>') }))).toThrow(/PowerPoint/)
  })
})
