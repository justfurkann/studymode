import { describe, expect, it } from 'vitest'
import { looksLikeBrokenMath, mathHeavyText, pagesToReadAsPictures } from './mathPages'

// Text exactly as pdf.js gives it for pages of a real equation-editor math PDF (Modul 1 Mathematics).
const SETS = `SAYILAR
1.SAYI KÜMELERİ
¥ ={0,1,2,3,...} kümesinin her bir elemanına bir doğal sayı denir.
¢={-3,-2,-1,0,1,2,3,...} kümesinin her bir elemanına bir tamsayı denir. Bunlardan
¤= {a
b |a , b ∈ ¢ , b ≠0 } kümesinin her bir elemanına bir rasyonel sayı denir.
¡=¤∪¤ı kümesinin her bir elemanına bir reel (gerçel) sayı denir.`

const FRACTIONS = `3. RASYONEL SAYILARDA DÖRT İŞLEM
1) a
b ± c
d = a . d ± b . c
b . d
2) a
b . c
d = a . c
b . d
Örnek :
2
5 + 7
5 − 4
5 =?`

const EXPONENTS = `5) x 3 – y 3 = (x – y) 3 + 3xy (x – y)
6) x 3 + y 3 = (x + y) 3 – 3xy (x + y)
7) x 2 + y 2 + z 2 = (x + y + z) 2 – 2 (xy + xz + yz)
ÇARPANLARA AYIRMA`

const HISTORY = `Osmanlı Devleti'nin Kuruluşu
Osman Bey 1299 yılında Söğüt ve Domaniç çevresinde beyliğini kurdu.
Orhan Bey döneminde Bursa alındı ve başkent yapıldı.
I. Murat döneminde Edirne fethedildi; Rumeli'ye geçiş hızlandı.
Bu dönemde tımar sistemi gelişti ve devlet teşkilatı güçlendi.`

const PSYCH = `Bellek Modelleri
Duyusal bellek, uyaranları çok kısa bir süre tutar.
Kısa süreli bellek yaklaşık 7 ± 2 birim bilgi tutar.
Uzun süreli bellek ise sınırsız kabul edilir.
Tekrar, bilginin uzun süreli belleğe geçmesini sağlar.`

describe('pages whose text breaks the math', () => {
  it('finds equation-editor pages: symbol-font sets, stacked fractions, fallen exponents', () => {
    expect(looksLikeBrokenMath(SETS)).toBe(true)
    expect(looksLikeBrokenMath(FRACTIONS)).toBe(true)
    expect(looksLikeBrokenMath(EXPONENTS)).toBe(true)
  })

  it('leaves ordinary prose alone, even with a number or a ± in it', () => {
    expect(looksLikeBrokenMath(HISTORY)).toBe(false)
    expect(looksLikeBrokenMath(PSYCH)).toBe(false)
    expect(looksLikeBrokenMath('')).toBe(false)
  })
})

describe('which PDF pages to read as pictures', () => {
  it('a math-heavy PDF: broken-math pages, scanned pages, and pages with figures beyond the logo', () => {
    const texts = [SETS, FRACTIONS, HISTORY, '', EXPONENTS, PSYCH]
    const figures = [1, 1, 3, 1, 1, 1] // one logo on every page; page 3 has two drawings
    expect(mathHeavyText(texts)).toBe(true)
    expect(pagesToReadAsPictures(texts, figures)).toEqual([1, 2, 3, 4, 5])
  })

  it('an ordinary slide deck with pictures on every page stays text, except a scanned page', () => {
    const texts = [HISTORY, PSYCH, HISTORY, '', PSYCH]
    const figures = [2, 4, 3, 1, 5]
    expect(mathHeavyText(texts)).toBe(false)
    expect(pagesToReadAsPictures(texts, figures)).toEqual([4])
  })

  it('one formula in a long prose document does not make every figure page a picture', () => {
    const texts = [HISTORY, PSYCH, HISTORY, PSYCH, HISTORY, PSYCH, FRACTIONS]
    const figures = [1, 3, 1, 3, 1, 3, 1]
    expect(pagesToReadAsPictures(texts, figures)).toEqual([7])
  })
})
