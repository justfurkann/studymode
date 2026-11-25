import { useEffect, useMemo, useState } from 'react'
import { hasMath, splitMath } from '../lib/mathText'

type Katex = typeof import('katex').default

// KaTeX (and its fonts) loads only when a text with a formula is first shown.
let katexPromise: Promise<Katex> | null = null
let katexReady: Katex | null = null
function loadKatex(): Promise<Katex> {
  katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => {
    katexReady = m.default
    return m.default
  })
  return katexPromise
}

/**
 * Study text with LaTeX formulas drawn as real math ($x^2$, $$\frac{a}{b}$$). Text without a
 * formula is returned as it is, without loading anything. Until KaTeX has loaded, or if a formula
 * cannot be drawn, the formula's source is shown.
 */
export function MathText({ text }: { text: string | null | undefined }) {
  const value = text ?? ''
  const math = useMemo(() => hasMath(value), [value])
  const [katex, setKatex] = useState<Katex | null>(katexReady)
  useEffect(() => {
    if (math && !katex) void loadKatex().then(setKatex).catch(() => {})
  }, [math, katex])
  if (!math) return <>{value}</>
  return (
    <>
      {splitMath(value).map((part, i) => {
        if (part.kind === 'text') return <span key={i}>{part.value}</span>
        if (!katex) return <code key={i} className="math-src">{part.value}</code>
        // Fractions inside a sentence are drawn full size: tiny numerators are hard to read.
        const tex = !part.display && part.value.includes('\\frac') ? `\\displaystyle ${part.value}` : part.value
        const html = katex.renderToString(tex, { displayMode: part.display, throwOnError: false, strict: 'ignore', trust: false, output: 'html' })
        return <span key={i} className={part.display ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </>
  )
}
