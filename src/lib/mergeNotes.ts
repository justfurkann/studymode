/*
 * Several notes (or files) as one: each part keeps its own heading (the file name or note title),
 * one after another. Used by "Tek not olarak birleştir" when adding files and "Birleştir" on a
 * course page. Pure and tested.
 */

/** The database refuses a note longer than this (supabase/schema.sql: notes.content <= 400000). */
export const NOTE_MAX_CHARS = 400_000
/** One AI request prepares about this much of a note (splitNoteIntoChunks in ai/tasks.ts). */
export const STUDY_CHUNK_CHARS = 20_000

export interface MergePart {
  title: string
  content: string
}

export function mergeContents(parts: MergePart[]): string {
  return parts
    .map((p) => ({ title: p.title.trim() || 'Adsız', content: p.content.trim() }))
    .filter((p) => p.content)
    .map((p) => `# ${p.title}\n\n${p.content}`)
    .join('\n\n')
}

/** "Hücre zarı + 2 not" style default title. */
export function mergedTitle(titles: string[]): string {
  const clean = titles.map((t) => t.trim()).filter(Boolean)
  if (!clean.length) return 'Birleşik not'
  const title = clean.length === 1 ? clean[0] : `${clean[0]} + ${clean.length - 1} not daha`
  return title.slice(0, 200)
}

export interface MergeCheck {
  chars: number
  /** About how many AI requests preparing it takes. */
  parts: number
  tooLong: boolean
}

export function checkMerged(text: string): MergeCheck {
  const chars = text.length
  return { chars, parts: Math.max(1, Math.ceil(chars / STUDY_CHUNK_CHARS)), tooLong: chars > NOTE_MAX_CHARS }
}

/** Plain Turkish line for the size of a merged note, or the reason it cannot be saved. */
export function mergeMessage(check: MergeCheck, ai: boolean): string {
  const size = `${check.chars.toLocaleString('tr-TR')} karakter`
  if (check.tooLong) return `Birleşik not çok uzun (${size}; en fazla ${NOTE_MAX_CHARS.toLocaleString('tr-TR')}). Birkaç dosyayı çıkar ya da ayrı not olarak ekle.`
  if (!ai || check.parts === 1) return `Toplam ${size}.`
  return `Toplam ${size}. Uzun olduğu için yapay zekâ yaklaşık ${check.parts} bölümde hazırlar (${check.parts} hak); metin kesilmez; yazılamayan bölüm olursa söyleriz.`
}
