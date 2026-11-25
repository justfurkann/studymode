/**
 * PDF pages written with an equation editor (Word, MathType…) have a text layer that breaks the
 * math: ℕ ℤ ℚ ℝ come out as ¥ ¢ ¤ ¡, a fraction a/b comes out as "a" and "b" on separate lines,
 * superscripts are lost (10² becomes "102"). A summary made from that text gets the formulas wrong.
 * Such pages are better read as pictures by the AI, which writes the math properly (LaTeX).
 */

/** Symbol-font letters that stand for ℕ ℤ ℚ ℝ ∈ in these PDFs. */
const GARBLED = /[¥¢¤¡¿]/g
const MATH_SYMBOLS = /[∈∉≠≤≥±√∑∫∏∪∩⇔⇒→←∞π×÷∀∃⊂⊆∅∆∂αβγθλμσφω]/g

export interface MathPageSignals {
  garbled: number
  symbols: number
  lines: number
  /** Lines with almost nothing on them: a numerator, a denominator, a lone exponent. */
  shortLines: number
  /** Lines with =, < or >. */
  relationLines: number
  /** Exponents that fell off their base: "x 3 – y 3", "sin 2 a". */
  lostExponents: number
}

export function mathSignals(text: string): MathPageSignals {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return {
    garbled: (text.match(GARBLED) ?? []).length,
    symbols: (text.match(MATH_SYMBOLS) ?? []).length,
    lines: lines.length,
    shortLines: lines.filter((l) => {
      const compact = l.replace(/\s/g, '')
      return compact.length > 0 && compact.length <= 5 && /[0-9a-zA-Z]/.test(compact)
    }).length,
    relationLines: lines.filter((l) => /[=<>≤≥]/.test(l)).length,
    lostExponents: (text.match(/(?:\b[a-zA-Z]|\))\s[2-9](?=\s*[-–+=)]|\s+[a-z]\b)/g) ?? []).length,
  }
}

/** True when the page's own text would lose its math, so the page should be read as a picture. */
export function looksLikeBrokenMath(text: string): boolean {
  const s = mathSignals(text)
  if (s.lines < 3) return false
  if (s.garbled >= 2) return true
  // Stacked fractions leave many very short lines next to equations.
  if (s.relationLines >= 3 && s.shortLines >= 3 && s.shortLines / s.lines >= 0.12) return true
  if (s.lostExponents >= 2 && s.relationLines >= 1) return true
  // Dense formulas: many math symbols and equations on one page.
  return s.symbols >= 10 && s.relationLines >= 4
}

/**
 * Which pages of a PDF to read as pictures (1-based):
 * - pages with no text at all (scanned), as before;
 * - pages whose text breaks the math;
 * - in a math-heavy document (at least 30% of its text pages break the math), also pages with
 *   figures (more pictures than the page's logo), so diagrams of triangles, graphs and the like
 *   are described instead of lost. Ordinary slides with pictures are left alone.
 * `figures[i]` is how many pictures page i+1 draws; null when it was not counted.
 */
export function pagesToReadAsPictures(texts: string[], figures: Array<number | null> = []): number[] {
  const textPages = texts.map((t, i) => ({ t, n: i + 1 })).filter(({ t }) => t.trim())
  const math = new Set(textPages.filter(({ t }) => looksLikeBrokenMath(t)).map(({ n }) => n))
  const mathHeavy = math.size >= 2 && math.size >= textPages.length * 0.3
  // The fewest pictures on any page is the page furniture (a logo on every page).
  const counted = figures.filter((f): f is number => f !== null)
  const furniture = counted.length ? Math.min(...counted) : 0
  return texts
    .map((t, i) => i + 1)
    .filter((n) => {
      const text = texts[n - 1]
      if (!text.trim()) return true
      if (math.has(n)) return true
      const f = figures[n - 1]
      return mathHeavy && f !== null && f !== undefined && f > furniture
    })
}

/** True when it is worth counting pictures: the text alone already says the document is math-heavy. */
export function mathHeavyText(texts: string[]): boolean {
  const textPages = texts.filter((t) => t.trim())
  const math = textPages.filter((t) => looksLikeBrokenMath(t)).length
  return math >= 2 && math >= textPages.length * 0.3
}
