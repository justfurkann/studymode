import { looksLikeBrokenMath, mathHeavyText } from './mathPages'
import type { TaskOutput } from './ai/tasks'

/*
 * Question quality, step 1 (HANDOFF Aşama 67 and 75). Only for accounts that config.ts →
 * questionQualityFor() lets in (admins for now); everyone else gets the study set exactly as before.
 *  - Notes heavy with formulas go to the "studyNumeric" task (the unchanged study prompt plus
 *    NUMERIC_QUESTIONS_RULE): calculation questions with new numbers, worked solutions.
 *  - Every note: a question that starts with "Notlara göre…" is rewritten without it (or dropped),
 *    here after the answer, so the ordinary study prompt stays as it is.
 */

/** A formula the way the notes write it (LaTeX between $ or $$, the split fixSymbolFont uses). */
const LATEX_SPAN = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g
/** Real math inside the dollars, so "$5 ile $10" (money) does not count. */
const MATHY = /[\\^_=+*/<>]|\d\s*[-–]\s*\d/

export const MIN_FORMULAS = 6
/** Formulas per 1000 characters of note. A biology note with one equation stays far below. */
export const FORMULAS_PER_1000 = 1.5

/** Count of LaTeX formulas in a note's text. */
export function countFormulas(text: string): number {
  return (text.match(LATEX_SPAN) ?? []).filter((f) => MATHY.test(f)).length
}

/** Splits a note into page-sized blocks for the PDF-page test of mathPages.ts. */
function blocks(text: string, size = 1500): string[] {
  const out: string[] = []
  let current = ''
  for (const para of text.split(/\n{2,}/)) {
    if (current && current.length + para.length > size) {
      out.push(current)
      current = ''
    }
    current = current ? `${current}\n\n${para}` : para
  }
  if (current.trim()) out.push(current)
  return out
}

/**
 * Whether a note is mainly formulas and calculations. Two signs, either is enough:
 * - many LaTeX formulas for its length (a math PDF read by the AI, or a note typed with $…$);
 * - its plain text looks like the broken equation-editor math mathPages.ts finds in PDFs (the same
 *   30% rule as mathHeavyText, applied to page-sized blocks).
 */
export function formulaHeavyNote(text: string): boolean {
  const formulas = countFormulas(text)
  if (formulas >= MIN_FORMULAS && (formulas * 1000) / Math.max(1, text.length) >= FORMULAS_PER_1000) return true
  const parts = blocks(text)
  return parts.length > 0 && parts.some(looksLikeBrokenMath) && mathHeavyText(parts)
}

/**
 * "Notlara göre," "Notlarda belirtildiği gibi," "Ders notlarına göre," "Metne göre" at the start of
 * a question. Only these fixed openings, so "Notasyon gibi…" or "Notlarda verilen formüle göre…"
 * (where the words after carry meaning) are left alone.
 */
const NOTES_PREAMBLE =
  /^\s*(?:(?:verilen|bu|yukarıdaki)\s+)?(?:ders\s+)?(?:notlar(?:a|da|ın|ına|ında)?|nota|notta|notun(?:a|da)?|metne|metinde|metnin(?:e|de)?|kaynağa|kaynakta)\s+(?:(?:belirtildiği|anlatıldığı|verildiği|açıklandığı|ifade\s+edildiği|geçtiği|yazdığı)\s+)?(?:göre|gibi|üzere)\s*[,:;]?\s*/iu

/** Shortest question left after taking the opening off; anything shorter is dropped. */
const MIN_QUESTION_CHARS = 12

/**
 * The question without a "Notlara göre" opening, first letter capitalised; the same text when it
 * has none; null when nothing sensible is left (the question is then dropped).
 */
export function stripNotesPreamble(prompt: string): string | null {
  const match = NOTES_PREAMBLE.exec(prompt)
  if (!match) return prompt
  const rest = prompt.slice(match[0].length).trim()
  if (rest.length < MIN_QUESTION_CHARS || !/\p{L}/u.test(rest)) return null
  // $x$ or a number first: leave as it is.
  return rest.charAt(0).toLocaleUpperCase('tr-TR') + rest.slice(1)
}

type RawSet = TaskOutput<'study'>

/** Applies stripNotesPreamble to the test questions and the practice questions of one answer. */
export function cleanNotesPreambles(raw: RawSet): RawSet {
  const questions = raw.questions.flatMap((q) => {
    const prompt = stripNotesPreamble(q.prompt)
    return prompt === null ? [] : [{ ...q, prompt }]
  })
  const practice = raw.practice.flatMap((p) => {
    const question = stripNotesPreamble(p.question)
    return question === null ? [] : [{ ...p, question }]
  })
  return { ...raw, questions, practice }
}
