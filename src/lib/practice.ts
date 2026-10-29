import type { Note, PracticeItem } from './types'

/** A written answer counts once it says something: a few words, not "bilmiyorum" or a single letter. */
export const MIN_ANSWER_CHARS = 20
export const MIN_ANSWER_WORDS = 4

export function isMeaningfulAnswer(text: string | undefined): boolean {
  const trimmed = (text ?? '').trim()
  if (trimmed.replace(/\s/g, '').length < MIN_ANSWER_CHARS) return false
  return trimmed.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length >= MIN_ANSWER_WORDS
}

/** Step 5 ("Anlat") can be completed after at least one open question has a real answer or a grading. */
export function canCompletePractice(note: Pick<Note, 'practice'>): boolean {
  return note.practice.some((item) => isMeaningfulAnswer(item.draft) || !!item.evaluation)
}

export const answeredCount = (items: PracticeItem[]) => items.filter((i) => isMeaningfulAnswer(i.draft) || !!i.evaluation).length
