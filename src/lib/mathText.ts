/**
 * Splits study text into plain parts and LaTeX math, so formulas can be drawn properly:
 * $$...$$ or \[...\] for a formula on its own line, $...$ or \(...\) inside a sentence.
 * A lone dollar ("5 $") stays text: inline math must not start or end with a space.
 */

export type MathPart = { kind: 'text'; value: string } | { kind: 'math'; value: string; display: boolean }

const PATTERN = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$/g

/**
 * A LaTeX command whose backslash was read as a JSON escape: "\\frac" sent as "\frac" arrives as a
 * form feed + "rac", "\\times" as a tab + "imes". Put the backslash back.
 */
function repairEscapes(tex: string): string {
  return tex.replace(/\f/g, '\\f').replace(/\x08/g, '\\b').replace(/\t/g, '\\t').replace(/\r/g, '\\r')
}

export function hasMath(text: string): boolean {
  PATTERN.lastIndex = 0
  const found = PATTERN.test(text)
  PATTERN.lastIndex = 0
  return found
}

export function splitMath(text: string): MathPart[] {
  const parts: MathPart[] = []
  let last = 0
  for (const m of text.matchAll(PATTERN)) {
    const at = m.index ?? 0
    if (at > last) parts.push({ kind: 'text', value: text.slice(last, at) })
    const display = m[1] !== undefined || m[2] !== undefined
    const value = repairEscapes((m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim())
    if (value) parts.push({ kind: 'math', value, display })
    last = at + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}

/** Text for places that cannot draw formulas (copying, speech, card backs as plain text). */
export function mathToPlain(text: string): string {
  return splitMath(text)
    .map((p) => (p.kind === 'text' ? p.value : p.value.replace(/\\(?:mathbb|mathrm|text)\{([^}]*)\}/g, '$1').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)').replace(/\\cdot/g, '·').replace(/\\times/g, '×').replace(/\\/g, '').replace(/[{}]/g, '')))
    .join('')
}
