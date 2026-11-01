import type { ConceptComparison, KeyTerm, MnemonicItem, MnemonicKind, Note, Summary } from './types'

export const MNEMONIC_KINDS: ReadonlyArray<{
  kind: MnemonicKind
  label: string
  shortLabel: string
  description: string
}> = [
  {
    kind: 'akrostis',
    label: 'Akrostiş şifre',
    shortLabel: 'Akrostiş',
    description: 'Kavramların baş harflerinden akılda kalıcı bir şifre kurar.',
  },
  {
    kind: 'tekerleme',
    label: 'Kafiyeli tekerleme',
    shortLabel: 'Tekerleme',
    description: 'Kavramları ritmik ve kafiyeli dörtlüklerle ezberletir.',
  },
  {
    kind: 'hikaye',
    label: 'Hikâye zinciri',
    shortLabel: 'Hikâye',
    description: 'Maddeleri birbirine bağlayan kısa bir olay örgüsü kurar.',
  },
  {
    kind: 'ipucu',
    label: 'Sınav çağrışımı',
    shortLabel: 'Çağrışım',
    description: 'Kavramın içindeki kelimeden tanımına anında köprü kurar.',
  },
]

export function mnemonicKindLabel(kind: MnemonicKind): string {
  return MNEMONIC_KINDS.find((k) => k.kind === kind)?.shortLabel ?? 'Şifre'
}

/** Extracts clean term-definition pairs from summary keyTerms or falls back to parsing note lines. */
export function extractNoteTerms(note: Pick<Note, 'title' | 'content' | 'summary'>): KeyTerm[] {
  const fromSummary = note.summary?.keyTerms?.filter((t) => t.term.trim() && t.definition.trim()) ?? []
  if (fromSummary.length >= 2) return fromSummary

  const parsed: KeyTerm[] = [...fromSummary]
  const seen = new Set(parsed.map((t) => t.term.toLocaleLowerCase('tr-TR')))

  for (const rawLine of note.content.split('\n')) {
    const line = rawLine.trim()
    const colon = line.indexOf(':')
    if (colon > 1 && colon <= 45) {
      const term = line.slice(0, colon).replace(/^[-*•\d.)\s]+/, '').trim()
      const definition = line.slice(colon + 1).trim()
      const key = term.toLocaleLowerCase('tr-TR')
      if (term.length >= 2 && definition.length >= 8 && !seen.has(key)) {
        seen.add(key)
        parsed.push({ term, definition })
      }
    }
  }

  if (parsed.length >= 2) return parsed

  const points = note.summary?.points ?? []
  for (const point of points) {
    const words = point.trim().split(/\s+/)
    if (words.length >= 4) {
      const term = words.slice(0, 2).join(' ').replace(/[.,;:!?]+$/, '')
      const key = term.toLocaleLowerCase('tr-TR')
      if (!seen.has(key)) {
        seen.add(key)
        parsed.push({ term, definition: point.trim() })
      }
    }
  }

  return parsed
}

function firstSentence(text: string, maxLen = 110): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  const sentence = clean.split(/(?<=[.!?])\s+/)[0] ?? clean
  if (sentence.length <= maxLen) return sentence
  return `${sentence.slice(0, maxLen - 1).trim()}…`
}

function initialLetter(term: string): string {
  const cleaned = term.trim().replace(/^[^a-zA-ZÇĞİÖŞÜçğıöşü0-9]+/u, '')
  const ch = cleaned[0] ?? term[0] ?? 'K'
  return ch.toLocaleUpperCase('tr-TR')
}

export function buildCustomLocalMnemonic(
  note: Pick<Note, 'title' | 'content' | 'summary'>,
  kind: MnemonicKind,
  focusTopic = '',
): MnemonicItem {
  const allTerms = extractNoteTerms(note)
  const cleanFocus = focusTopic.trim().toLocaleLowerCase('tr-TR')

  const matchedTerms = cleanFocus
    ? allTerms.filter(
        (t) =>
          t.term.toLocaleLowerCase('tr-TR').includes(cleanFocus) ||
          t.definition.toLocaleLowerCase('tr-TR').includes(cleanFocus),
      )
    : []

  const selected = (matchedTerms.length >= 2 ? matchedTerms : allTerms).slice(0, 6)
  const topicLabel = focusTopic.trim() || note.title

  if (selected.length === 0) {
    const fallbackPoint = firstSentence(note.summary?.points?.[0] ?? note.content, 100) || note.title
    return {
      id: crypto.randomUUID(),
      kind,
      title: `${topicLabel} — Hızlı Şifre`,
      code: initialLetter(topicLabel),
      breakdown: [{ key: topicLabel, meaning: fallbackPoint }],
      tip: 'Sınavda başlığı gördüğünde ilk cümleyi anahtar kelimesiyle hatırla.',
    }
  }

  if (kind === 'akrostis') {
    const letters = selected.map((t) => initialLetter(t.term))
    const code = letters.join(' · ')
    return {
      id: crypto.randomUUID(),
      kind: 'akrostis',
      title: `${topicLabel} — Baş Harf Şifresi`,
      code,
      breakdown: selected.map((t) => ({
        key: `${initialLetter(t.term)} → ${t.term}`,
        meaning: firstSentence(t.definition, 95),
      })),
      tip: `Sınav kağıdının kenarına "${letters.join('')}" harflerini yukarıdan aşağıya yazıp her harfin kavramını aç.`,
    }
  }

  if (kind === 'tekerleme') {
    const lines = selected.slice(0, 4).map((t, idx) => {
      const shortDef = firstSentence(t.definition, 65).replace(/\.$/, '')
      const endings = ['unutma sakın', 'aklınla bakın', 'sınavda yakın', 'hedefe akın']
      return `${t.term}: ${shortDef} — ${endings[idx % endings.length]}!`
    })
    return {
      id: crypto.randomUUID(),
      kind: 'tekerleme',
      title: `${topicLabel} — Ritmik Dörtlük`,
      code: lines.join('\n'),
      breakdown: selected.slice(0, 4).map((t, i) => ({
        key: `${i + 1}. Dize · ${t.term}`,
        meaning: firstSentence(t.definition, 95),
      })),
      tip: 'Bu dizeleri iki kez sesli ve ritimli okuduğunda kavram-tanım eşleşmesi kulak hafızana yerleşir.',
    }
  }

  if (kind === 'hikaye') {
    const chain = selected.map((t) => t.term).join(' → ')
    return {
      id: crypto.randomUUID(),
      kind: 'hikaye',
      title: `${topicLabel} — Adım Adım Hikâye Zinciri`,
      code: chain,
      breakdown: selected.map((t, i) => ({
        key: `${i + 1}. Durak: ${t.term}`,
        meaning: `${i === 0 ? 'Başlangıçta' : 'Ardından'} ${t.term.toLocaleLowerCase('tr-TR')} devreye girer: ${firstSentence(t.definition, 90)}`,
      })),
      tip: 'Kavramları tek tek ezberlemek yerine birbirini tetikleyen bir film sahnesi gibi sırayla hayal et.',
    }
  }

  // kind === 'ipucu'
  const lead = selected[0]
  return {
    id: crypto.randomUUID(),
    kind: 'ipucu',
    title: `${topicLabel} — Kelime Köprüsü`,
    code: selected.map((t) => `${t.term} = ${t.definition.trim().split(/\s+/).slice(0, 3).join(' ')}…`).join(' | '),
    breakdown: selected.map((t) => ({
      key: t.term,
      meaning: firstSentence(t.definition, 100),
    })),
    tip: `Özellikle "${lead.term}" kavramını gördüğünde tanımındaki ilk anahtar kelimeyi doğrudan eşleştir.`,
  }
}

export function buildLocalComparisonPair(
  note: Pick<Note, 'title' | 'content' | 'summary'>,
  leftTermInput: string,
  rightTermInput: string,
): ConceptComparison {
  const terms = extractNoteTerms(note)
  const findDef = (name: string): string => {
    const clean = name.trim().toLocaleLowerCase('tr-TR')
    const hit = terms.find((t) => t.term.toLocaleLowerCase('tr-TR') === clean)
      ?? terms.find((t) => t.term.toLocaleLowerCase('tr-TR').includes(clean))
    if (hit) return firstSentence(hit.definition, 110)

    const sentences = note.content
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const sentenceHit = sentences.find((s) => s.toLocaleLowerCase('tr-TR').includes(clean))
    return sentenceHit ? firstSentence(sentenceHit, 110) : `${name.trim()} kavramının nottaki işlevi ve kapsamı.`
  }

  const leftTerm = leftTermInput.trim() || terms[0]?.term || '1. Kavram'
  const rightTerm = rightTermInput.trim() || terms[1]?.term || '2. Kavram'
  const leftPoint = findDef(leftTerm)
  const rightPoint = findDef(rightTerm)

  return {
    id: crypto.randomUUID(),
    leftTerm,
    leftPoint,
    rightTerm,
    rightPoint,
    difference: `${leftTerm} doğrudan kendi işlevine (${firstSentence(leftPoint, 55).replace(/\.$/, '')}) odaklanırken, ${rightTerm} farklı bir aşamayı (${firstSentence(rightPoint, 55).replace(/\.$/, '')}) karşılar.`,
    examTrap: `Şıklarda "${leftTerm}" tanımı verilip "${rightTerm}" sorulabilir; iki kavramın anahtar fiillerini karıştırma.`,
  }
}

export function buildLocalMemoryTools(note: Pick<Note, 'title' | 'content' | 'summary'>): {
  mnemonics: MnemonicItem[]
  comparisons: ConceptComparison[]
} {
  const terms = extractNoteTerms(note)
  const mnemonics: MnemonicItem[] = [
    buildCustomLocalMnemonic(note, 'akrostis'),
    buildCustomLocalMnemonic(note, 'tekerleme'),
    buildCustomLocalMnemonic(note, 'hikaye'),
  ]

  const comparisons: ConceptComparison[] = []
  for (let i = 0; i + 1 < Math.min(terms.length, 6); i += 2) {
    comparisons.push(buildLocalComparisonPair(note, terms[i].term, terms[i + 1].term))
  }
  if (comparisons.length === 0 && terms.length >= 2) {
    comparisons.push(buildLocalComparisonPair(note, terms[0].term, terms[1].term))
  }

  return { mnemonics, comparisons }
}

export function mnemonicToCard(item: MnemonicItem, courseId: string, noteId: string) {
  const unpacked = item.breakdown.map((b) => `• ${b.key}: ${b.meaning}`).join('\n')
  return {
    courseId,
    noteId,
    front: `${item.title} — "${item.code.split('\n')[0]}" hafıza şifresinin açılımı nedir?`,
    back: `${unpacked}\n\nİpucu: ${item.tip}`,
    source: item.code,
  }
}

export function comparisonToCard(item: ConceptComparison, courseId: string, noteId: string) {
  return {
    courseId,
    noteId,
    front: `“${item.leftTerm}” ile “${item.rightTerm}” arasındaki temel fark ve sınav tuzağı nedir?`,
    back: `• ${item.leftTerm}: ${item.leftPoint}\n• ${item.rightTerm}: ${item.rightPoint}\n\nFark: ${item.difference}\nSınav tuzağı: ${item.examTrap}`,
    source: `${item.leftTerm} / ${item.rightTerm}`,
  }
}
