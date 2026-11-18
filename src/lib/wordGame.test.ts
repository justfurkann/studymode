import { afterEach, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
})
import { addGuess, checkGuess, cleanGuess, dailyTerm, letterMarks, markGuess, MAX_GUESSES, readWordSave, shareText, TERMS, TR_LETTERS, type WordSave } from './wordGame'

describe('Günün Kavramı', () => {
  it('every term is 5-8 Turkish capital letters, with a subject and a clue, and none repeats', () => {
    for (const t of TERMS) {
      expect([...t.word].length, t.word).toBeGreaterThanOrEqual(5)
      expect([...t.word].length, t.word).toBeLessThanOrEqual(8)
      expect([...t.word].every((c) => TR_LETTERS.includes(c)), t.word).toBe(true)
      expect(t.subject.length && t.clue.length).toBeTruthy()
      // The clue must not give the word away.
      expect(t.clue.toLocaleUpperCase('tr-TR')).not.toContain(t.word)
    }
    expect(new Set(TERMS.map((t) => t.word)).size).toBe(TERMS.length)
  })

  it('gives the same term for the whole Istanbul day and a different one the next day', () => {
    const morning = Date.UTC(2026, 10, 18, 5)
    const night = Date.UTC(2026, 10, 18, 20, 30)
    const next = Date.UTC(2026, 10, 18, 21, 30)
    expect(dailyTerm(morning).word).toBe(dailyTerm(night).word)
    expect(dailyTerm(next).word).not.toBe(dailyTerm(night).word)
  })

  it('every term comes up once before any comes back', () => {
    const start = Date.UTC(2026, 0, 1, 9)
    const seen = new Set(Array.from({ length: TERMS.length }, (_, i) => dailyTerm(start + i * 86_400_000).word))
    expect(seen.size).toBe(TERMS.length)
  })

  it('uppercases the Turkish way and drops anything that is not a letter', () => {
    expect(cleanGuess('mitoz')).toBe('MİTOZ')
    expect(cleanGuess('ışık 1!')).toBe('IŞIK')
  })

  it('marks letters in place, elsewhere, or missing', () => {
    expect(markGuess('MOTİZ', 'MİTOZ')).toEqual(['hit', 'near', 'hit', 'near', 'hit'])
    expect(markGuess('ABCDE', 'MİTOZ')).toEqual(['miss', 'miss', 'miss', 'miss', 'miss'])
  })

  it('counts a repeated letter only as often as the word has it', () => {
    // KATOT has two Ts; a guess with three Ts gets at most two marks for T.
    expect(markGuess('TTTAA', 'KATOT')).toEqual(['near', 'miss', 'hit', 'near', 'miss'])
    // A letter in the right place is counted first.
    expect(markGuess('OOOOO', 'MİTOZ')).toEqual(['miss', 'miss', 'miss', 'hit', 'miss'])
  })

  it('keeps the best mark per letter for the keyboard', () => {
    const marks = letterMarks(['MOTİZ', 'MİTOZ'], 'MİTOZ')
    expect(marks.O).toBe('hit')
    expect(letterMarks(['ABCDE'], 'MİTOZ').A).toBe('miss')
  })

  it('asks for the right length and no repeats', () => {
    expect(checkGuess('MİT', 'MİTOZ', [])).toBe('short')
    expect(checkGuess('MAYOZ', 'MİTOZ', ['MAYOZ'])).toBe('repeat')
    expect(checkGuess('MAYOZ', 'MİTOZ', [])).toBeNull()
  })

  it('shares the pattern without the letters', () => {
    const text = shareText(20775, ['MAYOZ', 'MİTOZ'], 'MİTOZ', true, false)
    expect(text).toContain('2/6')
    expect(text).toContain('■··■■')
    expect(text).not.toContain('MİTOZ')
  })

  describe('streaks', () => {
    const fresh = (day: number, extra: Partial<WordSave> = {}): WordSave => ({ day, guesses: [], streak: 0, lastWin: null, played: 0, wins: 0, ...extra })

    it('a win on the day after a win adds to the streak; a loss ends it', () => {
      const won = addGuess(fresh(101, { streak: 3, lastWin: 100 }), 'MİTOZ', 'MİTOZ')
      expect(won).toMatchObject({ streak: 4, lastWin: 101, played: 1, wins: 1 })
      let lost = fresh(102, { streak: 4, lastWin: 101 })
      for (let i = 0; i < MAX_GUESSES; i += 1) lost = addGuess(lost, `AAAA${'BCDEFG'[i]}`, 'MİTOZ')
      expect(lost).toMatchObject({ streak: 0, played: 1, wins: 0 })
    })

    afterEach(() => localStorage.clear())

    it('a missed day starts the streak over; today’s guesses come back after a reload', () => {
      localStorage.setItem('studymode.kavram', JSON.stringify({ day: 200, guesses: ['MAYOZ'], streak: 5, lastWin: 199, played: 9, wins: 8 }))
      expect(readWordSave(200)).toMatchObject({ guesses: ['MAYOZ'], streak: 5 })
      expect(readWordSave(202)).toMatchObject({ guesses: [], streak: 0, played: 9 })
    })
  })
})
