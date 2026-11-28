import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: null }))

import { QUESTION_QUALITY_FOR, questionQualityFor } from './config'
import { cleanNotesPreambles, countFormulas, formulaHeavyNote, stripNotesPreamble } from './questionQuality'
import { jsonModeSystem, NUMERIC_QUESTIONS_RULE, TASKS, userPrompt } from './ai/tasks'
import * as ai from './ai/index'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

describe('the ordinary study prompt is unchanged (Aşama 75)', () => {
  // Taken on main at 8304c5f, before the question-quality work. If one of these fails, the prompt
  // every normal account uses has changed: that needs a live test with a real note (CLAUDE.md), and
  // only then new hashes here.
  it('system prompt, JSON-mode system prompt and user message hash as before', () => {
    expect(sha(TASKS.study.system)).toBe('1ddf1a5e32a974891b29b9e01db4ee0b785505816eb07b03d62292f2545db82d')
    expect(sha(jsonModeSystem('study'))).toBe('0d2fb933092a62c4304778dcd161975e4709a108d95a0228064ebeb050d72809')
    expect(sha(userPrompt('study', { title: 'Hücre', text: 'Mitokondri ATP üretir.' }))).toBe('8476eb19ba590e3a23070ed2383a252e530cf39d1f97fee14832fcf273cb424e')
  })

  it('the ordinary prompt never carries the numeric rule', () => {
    expect(TASKS.study.system).not.toContain('These notes are mainly formulas')
    expect(jsonModeSystem('study')).not.toContain(NUMERIC_QUESTIONS_RULE)
  })

  it('studyNumeric is the same prompt with the rule added after it, same schema and user message', () => {
    expect(TASKS.studyNumeric.system).toBe(`${TASKS.study.system}\n\n${NUMERIC_QUESTIONS_RULE}`)
    expect(TASKS.studyNumeric.schema).toBe(TASKS.study.schema)
    const input = { title: 'Türev', text: '$f(x)=x^2$' }
    expect(userPrompt('studyNumeric', input)).toBe(userPrompt('study', input))
  })
})

describe('one switch for who gets it', () => {
  it('admins only for now', () => {
    expect(QUESTION_QUALITY_FOR).toBe('admin')
    expect(questionQualityFor('admin')).toBe(true)
    expect(questionQualityFor('vip')).toBe(false)
    expect(questionQualityFor('normal')).toBe(false)
    expect(questionQualityFor(null)).toBe(false)
    expect(questionQualityFor(undefined)).toBe(false)
  })
})

const mathNote = Array.from(
  { length: 12 },
  (_, i) => `Kural ${i + 1}: $a^{${i + 2}} \\cdot a^{2} = a^{${i + 4}}$ ve $\\sqrt{x} = x^{1/2}$ olur. Örnek: $2^{3} = 8$.`,
).join('\n\n')

const verbalNote = Array.from(
  { length: 30 },
  (_, i) => `Osmanlı Devleti'nde ${i + 1}. dönemde merkezi otorite güçlendi; divan teşkilatı yeniden düzenlendi ve taşra yönetimi sancaklara ayrıldı.`,
).join('\n\n')

describe('formulaHeavyNote', () => {
  it('a math note with many LaTeX formulas is formula-heavy', () => {
    expect(countFormulas(mathNote)).toBe(36)
    expect(formulaHeavyNote(mathNote)).toBe(true)
  })

  it('a verbal note, or one with a single formula, is not', () => {
    expect(formulaHeavyNote(verbalNote)).toBe(false)
    expect(formulaHeavyNote(`${verbalNote}\n\nEnerji: $E = mc^2$.`)).toBe(false)
  })

  it('money in dollars does not count as formulas', () => {
    const money = Array.from({ length: 20 }, (_, i) => `Fiyat $${i} ile $${i + 1} arasında değişti.`).join('\n')
    expect(countFormulas(money)).toBe(0)
    expect(formulaHeavyNote(money)).toBe(false)
  })

  it('broken equation-editor text from a PDF (as mathPages.ts finds it) is formula-heavy', () => {
    const page = 'x ∈ ¥ ve y ∈ ¢ olsun.\na = b + c\nx ≤ y\nf(x) = 3\n2\nb ≥ 0\nc = 1\nd = 2'
    // Three page-sized blocks of it, no LaTeX at all.
    const pdfPage = Array.from({ length: 25 }, () => page).join('\n')
    expect(countFormulas(pdfPage)).toBe(0)
    expect(formulaHeavyNote([pdfPage, pdfPage, pdfPage].join('\n\n'))).toBe(true)
    expect(formulaHeavyNote([pdfPage, verbalNote].join('\n\n'))).toBe(false)
  })
})

describe('stripNotesPreamble', () => {
  it.each([
    ['Notlara göre, mitokondrinin görevi nedir?', 'Mitokondrinin görevi nedir?'],
    ['Notlarda belirtildiği gibi ilk aşama hangisidir?', 'İlk aşama hangisidir?'],
    ['Ders notlarına göre: Tanzimat hangi yıl ilan edildi?', 'Tanzimat hangi yıl ilan edildi?'],
    ['Metne göre ışığın hızı nedir?', 'Işığın hızı nedir?'],
    ['Verilen notlara göre $x^2 = 9$ ise x kaçtır?', '$x^2 = 9$ ise x kaçtır?'],
  ])('%s → %s', (input, output) => {
    expect(stripNotesPreamble(input)).toBe(output)
  })

  it.each(['Mitokondrinin görevi nedir?', 'Notasyon gibi kavramlar hangi derste geçer?', 'Notlarda verilen formüle göre $x=3$ için y kaçtır?', 'Not ortalaması nasıl hesaplanır?'])(
    'leaves %s alone',
    (input) => {
      expect(stripNotesPreamble(input)).toBe(input)
    },
  )

  it('drops a question when almost nothing is left', () => {
    expect(stripNotesPreamble('Notlara göre?')).toBeNull()
    expect(stripNotesPreamble('Notlara göre, hangisi?')).toBeNull()
  })

  it('cleans test and practice questions of one answer, dropping the empty ones', () => {
    const raw = {
      summary: { overview: 'Notlara göre özet.', points: [], keyTerms: [] },
      cards: [{ front: 'Notlara göre ATP nedir?', back: 'Enerji', source: '' }],
      questions: [
        { prompt: 'Notlara göre ATP nerede üretilir?', options: ['a', 'b', 'c', 'd'], answerIndex: 0, explanation: '', source: '' },
        { prompt: 'Notlara göre?', options: ['a', 'b', 'c', 'd'], answerIndex: 1, explanation: '', source: '' },
      ],
      practice: [{ question: 'Notlarda anlatıldığı gibi hücre bölünmesini açıkla.', answer: '', hint: '' }],
    }
    const out = cleanNotesPreambles(raw)
    expect(out.questions.map((q) => q.prompt)).toEqual(['ATP nerede üretilir?'])
    expect(out.practice[0].question).toBe('Hücre bölünmesini açıkla.')
    // Only questions are touched.
    expect(out.summary).toBe(raw.summary)
    expect(out.cards).toBe(raw.cards)
  })
})

describe('generateStudySet: the step only runs when asked', () => {
  const settings = { provider: 'google', keys: { google: 'k', anthropic: '', openai: '' }, models: { google: 'm', anthropic: '', openai: '' }, theme: 'system' } as never
  const reply = {
    summary: { overview: 'Özet', points: ['Nokta'], keyTerms: [] },
    cards: [{ front: 'Soru?', back: 'Cevap', source: '' }],
    questions: [{ prompt: 'Notlara göre $2^3$ kaçtır?', options: ['6', '8', '9', '12'], answerIndex: 1, explanation: '', source: '' }],
    practice: [],
  }
  function stub() {
    const systems: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        systems.push(JSON.parse(init.body as string).systemInstruction.parts[0].text)
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }))
      }),
    )
    return systems
  }
  afterEach(() => vi.unstubAllGlobals())

  it('without the option (normal accounts): ordinary prompt, questions untouched', async () => {
    const systems = stub()
    const result = await ai.generateStudySet(mathNote, 'Üsler', settings, undefined, async () => undefined)
    expect(systems).toEqual([jsonModeSystem('study')])
    expect(result.questions[0].prompt).toBe('Notlara göre $2^3$ kaçtır?')
  })

  it('with the option and a math note: numeric prompt, "Notlara göre" removed', async () => {
    const systems = stub()
    const result = await ai.generateStudySet(mathNote, 'Üsler', settings, undefined, async () => undefined, { questionQuality: true })
    expect(systems).toEqual([jsonModeSystem('studyNumeric')])
    expect(result.questions[0].prompt).toBe('$2^3$ kaçtır?')
  })

  it('with the option and a verbal note: ordinary prompt, only the clean-up', async () => {
    const systems = stub()
    const result = await ai.generateStudySet(verbalNote, 'Tarih', settings, undefined, async () => undefined, { questionQuality: true })
    expect(systems).toEqual([jsonModeSystem('study')])
    expect(result.questions[0].prompt).toBe('$2^3$ kaçtır?')
  })
})
