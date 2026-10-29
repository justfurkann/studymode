import { describe, expect, it } from 'vitest'
import { cardHint } from './cardHint'

describe('cardHint', () => {
  it('shows the first letter and length of a short answer', () => {
    expect(cardHint('Mitokondride.')).toBe('M' + '_'.repeat(11))
    expect(cardHint('Çekirdek zarı')).toBe('Ç_______ …')
  })

  it('shows the first words of a longer answer without giving it away', () => {
    expect(cardHint('Öğrenilen bilgiyi kaynağa bakmadan zihinden geri getirme çabasıdır.')).toBe('Öğrenilen bilgiyi …')
    expect(cardHint('Hücre içi sindirim yapar. Enzim içerir.')).toBe('Hücre …')
  })

  it('handles empty answers', () => {
    expect(cardHint('  ')).toBe('')
  })
})
