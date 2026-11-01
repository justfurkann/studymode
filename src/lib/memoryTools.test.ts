import { describe, expect, it } from 'vitest'
import {
  buildCustomLocalMnemonic,
  buildLocalComparisonPair,
  buildLocalMemoryTools,
  comparisonToCard,
  extractNoteTerms,
  mnemonicToCard,
} from './memoryTools'
import { parseTaskOutput, userPrompt } from './ai/tasks'

const sampleNote = {
  title: 'Hücre Biyolojisi',
  content: `Mitokondri: Hücresel solunum yoluyla enerji üretir.
Ribozom: Amino asitleri birleştirerek protein sentezler.
Lizozom: Hücre içi sindirimde görev alan enzimleri içerir.
Çekirdek: Kalıtsal bilgiyi barındıran ve hücreyi yöneten yapıdır.`,
  summary: {
    overview: 'Hücre organelleri.',
    points: ['Mitokondri enerji üretir.', 'Ribozom protein sentezler.'],
    keyTerms: [
      { term: 'Mitokondri', definition: 'Hücresel solunum yoluyla enerji üretir.' },
      { term: 'Ribozom', definition: 'Amino asitleri birleştirerek protein sentezler.' },
      { term: 'Lizozom', definition: 'Hücre içi sindirimde görev alan enzimleri içerir.' },
      { term: 'Çekirdek', definition: 'Kalıtsal bilgiyi barındıran ve hücreyi yöneten yapıdır.' },
    ],
  },
}

describe('memoryTools', () => {
  it('extracts terms and builds default mnemonics and comparisons', () => {
    const terms = extractNoteTerms(sampleNote)
    expect(terms).toHaveLength(4)

    const tools = buildLocalMemoryTools(sampleNote)
    expect(tools.mnemonics).toHaveLength(3)
    expect(tools.mnemonics[0].kind).toBe('akrostis')
    expect(tools.mnemonics[0].code).toBe('M · R · L · Ç')
    expect(tools.mnemonics[1].kind).toBe('tekerleme')
    expect(tools.mnemonics[2].kind).toBe('hikaye')

    expect(tools.comparisons.length).toBeGreaterThanOrEqual(2)
    expect(tools.comparisons[0].leftTerm).toBe('Mitokondri')
    expect(tools.comparisons[0].rightTerm).toBe('Ribozom')
  })

  it('builds custom mnemonics for each encoding style and converts them to flashcards', () => {
    const rhyme = buildCustomLocalMnemonic(sampleNote, 'tekerleme', 'Organeller')
    expect(rhyme.kind).toBe('tekerleme')
    expect(rhyme.title).toContain('Organeller')
    expect(rhyme.breakdown.length).toBeGreaterThan(0)

    const card = mnemonicToCard(rhyme, 'course-1', 'note-1')
    expect(card.courseId).toBe('course-1')
    expect(card.noteId).toBe('note-1')
    expect(card.front).toContain('hafıza şifresinin açılımı nedir?')
    expect(card.back).toContain('Mitokondri')
  })

  it('builds a targeted comparison pair and converts it to a flashcard', () => {
    const pair = buildLocalComparisonPair(sampleNote, 'Lizozom', 'Çekirdek')
    expect(pair.leftTerm).toBe('Lizozom')
    expect(pair.rightTerm).toBe('Çekirdek')
    expect(pair.difference).toContain('Lizozom')
    expect(pair.examTrap).toContain('Çekirdek')

    const card = comparisonToCard(pair, 'course-1', 'note-1')
    expect(card.front).toContain('“Lizozom” ile “Çekirdek”')
    expect(card.back).toContain('Sınav tuzağı:')
  })

  it('validates AI memory task prompt and schema across providers', () => {
    const prompt = userPrompt('memory', {
      title: 'Hücre',
      text: sampleNote.content,
      mode: 'mnemonic',
      mnemonicKind: 'akrostis',
      focusTopic: 'Organeller',
    })
    expect(prompt).toContain('<mnemonic_kind>akrostis</mnemonic_kind>')
    expect(prompt).toContain('<focus_topic>Organeller</focus_topic>')

    const parsed = parseTaskOutput(
      'memory',
      JSON.stringify({
        mnemonics: [
          {
            kind: 'akrostis',
            title: 'Organel Şifresi',
            code: 'M-R-L-Ç',
            breakdown: [{ key: 'M', meaning: 'Mitokondri' }],
            tip: 'Baş harfleri hatırla.',
          },
        ],
        comparisons: [
          {
            leftTerm: 'Mitokondri',
            leftPoint: 'Enerji üretir.',
            rightTerm: 'Ribozom',
            rightPoint: 'Protein sentezler.',
            difference: 'Biri ATP, diğeri protein üretir.',
            examTrap: 'Sentez ve solunumu karıştırma.',
          },
        ],
      }),
    )
    expect(parsed).not.toBeNull()
    expect(parsed?.mnemonics).toHaveLength(1)
    expect(parsed?.comparisons).toHaveLength(1)
  })
})
