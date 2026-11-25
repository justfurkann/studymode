import { describe, expect, it } from 'vitest'
import { hasMath, mathToPlain, splitMath } from './mathText'

describe('formulas in study text', () => {
  it('finds inline and display math in a sentence', () => {
    expect(splitMath('Kesir $\\frac{a}{b}$ ve $$x^{2}+1$$ son')).toEqual([
      { kind: 'text', value: 'Kesir ' },
      { kind: 'math', value: '\\frac{a}{b}', display: false },
      { kind: 'text', value: ' ve ' },
      { kind: 'math', value: 'x^{2}+1', display: true },
      { kind: 'text', value: ' son' },
    ])
  })

  it('also understands \\( \\) and \\[ \\]', () => {
    expect(splitMath('\\(a\\) ve \\[b\\]').filter((p) => p.kind === 'math')).toEqual([
      { kind: 'math', value: 'a', display: false },
      { kind: 'math', value: 'b', display: true },
    ])
  })

  it('leaves a lone dollar sign and plain text alone', () => {
    expect(hasMath('Fiyatı 5 $ ve 10 $ arası')).toBe(false)
    expect(hasMath('Osman Bey 1299 yılında beyliğini kurdu.')).toBe(false)
    expect(splitMath('düz metin')).toEqual([{ kind: 'text', value: 'düz metin' }])
  })

  it('turns \\cline (unknown to KaTeX) into \\hline', () => {
    expect(splitMath('$$\\begin{array}{r|l} 3450 & 360 \\\\ \\cline{2-2} \\end{array}$$')[0]).toMatchObject({ value: '\\begin{array}{r|l} 3450 & 360 \\\\ \\hline \\end{array}' })
  })

  it('has a readable plain form for copying', () => {
    expect(mathToPlain('Kural: $\\frac{a}{b} \\cdot c$')).toBe('Kural: (a)/(b) · c')
    expect(mathToPlain('$a \\in \\mathbb{Z}$')).toBe('a in Z')
  })
})
