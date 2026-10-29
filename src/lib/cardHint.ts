/**
 * A nudge shown before the card is turned, built from the answer so every card has one: a short
 * answer shows its first letter and length ("M_________"), a longer one its first few words.
 */
export function cardHint(back: string): string {
  const first = back.trim().split(/(?<=[.!?])\s|\n/u)[0]?.trim() ?? ''
  const words = first.split(/\s+/u).filter(Boolean)
  if (!words.length) return ''
  if (words.length <= 2) {
    const word = words[0].replace(/[.,;:!?]+$/u, '')
    const letters = [...word]
    if (letters.length <= 1) return word
    return letters[0] + '_'.repeat(letters.length - 1) + (words.length > 1 ? ' …' : '')
  }
  const shown = Math.min(4, Math.max(1, Math.floor(words.length / 3)))
  return `${words.slice(0, shown).join(' ')} …`
}
