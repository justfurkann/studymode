import type { ExamQuestion, Note, Question } from './types'

export interface SemanticNoteMatch {
  note: Note
  score: number
  matchType: 'all' | 'exact' | 'semantic'
  matchedTerm: string | null
  snippet: string | null
}

export interface QuestionNoteMatch {
  note: Note
  score: number
  matchedTerm: string | null
  snippet: string
}

/**
 * Curated Turkish university concept equivalence clusters so semantic queries like
 * "enerji üreten organel" or "kısa süreli tutan sistem" match the right note even before
 * server embeddings are fetched, and boost hybrid ranking alongside Gemini embeddings.
 */
const CONCEPT_CLUSTERS: ReadonlyArray<readonly string[]> = [
  ['mitokondri', 'enerji', 'atp', 'solunum', 'hücresel solunum', 'oksijenli', 'santral'],
  ['ribozom', 'protein', 'amino asit', 'sentez', 'rna', 'translasyon', 'peptit'],
  ['çekirdek', 'nükleus', 'kalıtsal', 'genetik', 'dna', 'kromozom', 'kalıtım', 'yönetim'],
  ['lizozom', 'sindirim', 'enzim', 'parçalanma', 'atık', 'otofaji', 'fagositoz'],
  ['hücre zarı', 'seçici geçirgen', 'madde alışverişi', 'fosfolipit', 'zar', 'difüzyon', 'ozmoz'],
  ['kloroplast', 'fotosentez', 'klorofil', 'ışık', 'besin üretimi', 'glikoz', 'bitki'],
  ['endoplazmik retikulum', 'taşıma', 'kanal', 'granüllü', 'granülsüz', 'lipit'],
  ['golgi', 'paketleme', 'salgı', 'kesecik', 'modifikasyon'],
  ['çalışma belleği', 'kısa süreli bellek', 'anlık', 'kapasite', 'tutma', 'işleme', 'bilişsel yük'],
  ['uzun süreli bellek', 'kalıcı', 'depolama', 'şema', 'kodlama', 'hatırlama', 'konsolidasyon'],
  ['aktif hatırlama', 'kendini sınama', 'geri çağırma', 'test etkisi', 'pratik', 'soru çözme'],
  ['aralıklı tekrar', 'unutma eğrisi', 'zamana yayma', 'tekrar planı', 'ebbinghaus', 'pekiştirme'],
  ['hukuk', 'yaptırım', 'norm', 'anayasa', 'kanun', 'mevzuat', 'borçlar', 'kusursuz sorumluluk'],
  ['ekonomi', 'enflasyon', 'arz', 'talep', 'faiz', 'denge fiyat', 'maliyet', 'gayrisafi'],
]

const STOP_WORDS = new Set([
  've',
  'ile',
  'için',
  'bir',
  'bu',
  'şu',
  'o',
  'da',
  'de',
  'ki',
  'mi',
  'mı',
  'mu',
  'mü',
  'gibi',
  'kadar',
  'daha',
  'en',
  'çok',
  'az',
  'olan',
  'olarak',
  'nedir',
  'nasıl',
  'hangi',
  'neye',
  'nerede',
  'ne',
  'ise',
  'veya',
  'ya',
  'ama',
  'fakat',
  'çünkü',
  'üreten',
  'yapan',
  'sağlayan',
  'görev',
  'alan',
])

const SUFFIXES = [
  'lerinden',
  'larından',
  'lerinde',
  'larında',
  'lerinin',
  'larının',
  'leriyle',
  'larıyla',
  'lerden',
  'lardan',
  'lerde',
  'larda',
  'lerin',
  'ların',
  'masıyla',
  'mesiyle',
  'ğından',
  'ğinden',
  'ğında',
  'ğinde',
  'den',
  'dan',
  'ten',
  'tan',
  'nde',
  'nda',
  'nin',
  'nın',
  'nun',
  'nün',
  'ler',
  'lar',
  'lik',
  'lık',
  'luk',
  'lük',
  'siz',
  'sız',
  'suz',
  'süz',
  'sel',
  'sal',
  'de',
  'da',
  'te',
  'ta',
  'in',
  'ın',
  'un',
  'ün',
  'yi',
  'yı',
  'yu',
  'yü',
  'si',
  'sı',
  'su',
  'sü',
  'li',
  'lı',
  'lu',
  'lü',
  'le',
  'la',
  'i',
  'ı',
  'u',
  'ü',
  'e',
  'a',
]

/** Strips common Turkish inflectional suffixes to get a stable root token. */
export function normalizeTurkishStem(raw: string): string {
  let word = raw.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, '').trim()
  if (word.length <= 4) return word
  for (const suffix of SUFFIXES) {
    if (word.length - suffix.length >= 4 && word.endsWith(suffix)) {
      word = word.slice(0, word.length - suffix.length)
      break
    }
  }
  // Softened consonants at stem end: "belleğ" -> "bellek", "renğ" -> "renk", "kitab" -> "kitap"
  if (word.endsWith('ğ')) word = `${word.slice(0, -1)}k`
  return word
}

/** Extracts normalized stems from a piece of text. */
export function tokenizeSemantic(text: string): string[] {
  return text
    .toLocaleLowerCase('tr-TR')
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    .map(normalizeTurkishStem)
    .filter((w) => w.length >= 3)
}

/** Expands query tokens with concept cluster equivalents so conceptual queries match target terms. */
export function expandWithClusters(text: string): Set<string> {
  const lower = text.toLocaleLowerCase('tr-TR')
  const stems = new Set(tokenizeSemantic(text))
  const expanded = new Set(stems)

  for (const cluster of CONCEPT_CLUSTERS) {
    const clusterMatched = cluster.some((phrase) => {
      const pLower = phrase.toLocaleLowerCase('tr-TR')
      if (lower.includes(pLower)) return true
      const pStems = tokenizeSemantic(pLower)
      return pStems.length > 0 && pStems.every((s) => stems.has(s))
    })
    if (clusterMatched) {
      for (const phrase of cluster) {
        for (const s of tokenizeSemantic(phrase)) {
          expanded.add(s)
        }
      }
    }
  }
  return expanded
}

/** Standard cosine similarity between two numeric vectors (e.g. from gemini-embedding-2-preview). */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (!a.length || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA <= 0 || normB <= 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/** Splits note text into clean candidate sentences/lines for snippet extraction. */
function splitSentences(note: Note): Array<{ text: string; term: string | null }> {
  const candidates: Array<{ text: string; term: string | null }> = []
  for (const kt of note.summary?.keyTerms ?? []) {
    candidates.push({ text: `${kt.term}: ${kt.definition}`, term: kt.term })
  }
  for (const pt of note.summary?.points ?? []) {
    candidates.push({ text: pt, term: null })
  }
  const rawLines = note.content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 18)
  for (const line of rawLines) {
    const colonIdx = line.indexOf(':')
    const maybeTerm = colonIdx > 1 && colonIdx < 35 ? line.slice(0, colonIdx).trim() : null
    candidates.push({ text: line, term: maybeTerm })
  }
  return candidates
}

/** Finds the best matching sentence and concept inside a note for a given query. */
export function findBestNoteSnippet(note: Note, query: string): { snippet: string | null; matchedTerm: string | null; localScore: number } {
  const expandedQuery = expandWithClusters(query)
  const rawQueryStems = new Set(tokenizeSemantic(query))
  if (!expandedQuery.size) return { snippet: null, matchedTerm: null, localScore: 0 }

  const candidates = splitSentences(note)
  let bestSnippet: string | null = null
  let bestTerm: string | null = null
  let bestScore = 0

  for (const cand of candidates) {
    const candStems = tokenizeSemantic(cand.text)
    if (!candStems.length) continue
    let directHits = 0
    let expandedHits = 0
    for (const s of candStems) {
      if (rawQueryStems.has(s)) directHits += 1
      else if (expandedQuery.has(s)) expandedHits += 1
    }
    // Check prefix/substring overlap for long stems
    for (const qStem of expandedQuery) {
      if (qStem.length >= 5 && candStems.some((cs) => cs.startsWith(qStem) || qStem.startsWith(cs))) {
        expandedHits += 0.6
      }
    }
    const totalScore = (directHits * 1.4 + expandedHits * 0.9) / Math.max(2, Math.sqrt(candStems.length))
    if (totalScore > bestScore) {
      bestScore = totalScore
      bestSnippet = cand.text.length > 160 ? `${cand.text.slice(0, 157).trim()}…` : cand.text
      bestTerm = cand.term
    }
  }

  // If no term was explicitly attached to the best sentence, check if any keyTerm is mentioned in it
  if (bestSnippet && !bestTerm && note.summary?.keyTerms?.length) {
    const lowerSnippet = bestSnippet.toLocaleLowerCase('tr-TR')
    const foundKt = note.summary.keyTerms.find((kt) => lowerSnippet.includes(kt.term.toLocaleLowerCase('tr-TR')))
    if (foundKt) bestTerm = foundKt.term
  }

  return {
    snippet: bestSnippet,
    matchedTerm: bestTerm,
    localScore: Math.min(1, bestScore / 2.2),
  }
}

export interface EmbeddingMap {
  /** noteId -> float vector */
  notes: Record<string, number[]>
  /** query string -> float vector */
  queries?: Record<string, number[]>
}

const EMBED_STORAGE_PREFIX = 'studymode.embeddings.v1.'

/**
 * Vectors are kept at 768 numbers (the model ranks by the first ones, so shortening keeps the
 * ordering) and 5 decimals: about 6 KB a note instead of 60 KB, so a whole term fits in storage.
 */
export const EMBED_DIMS = 768
export function compactVector(v: readonly number[]): number[] {
  return v.slice(0, EMBED_DIMS).map((x) => Math.round(x * 1e5) / 1e5)
}

/**
 * Turns a cosine similarity into a 0..1 match score. Measured on gemini-embedding-001 with Turkish
 * notes: a related note scores about 0.76-0.83 against a short question, an unrelated one 0.64-0.72.
 * Below 0.74 counts as no match.
 */
export const VECTOR_MATCH_AT = 0.74
export function vectorMatchScore(sim: number): number {
  return sim < VECTOR_MATCH_AT ? 0 : Math.min(1, 0.45 + ((sim - VECTOR_MATCH_AT) / 0.1) * 0.55)
}

export function readCourseEmbeddings(courseId: string): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(`${EMBED_STORAGE_PREFIX}${courseId}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCourseEmbeddings(courseId: string, map: Record<string, number[]>): void {
  try {
    localStorage.setItem(`${EMBED_STORAGE_PREFIX}${courseId}`, JSON.stringify(map))
  } catch {
    // Ignore storage quota errors
  }
}

/** Builds a compact text representation of a note for the embedding model. */
export function buildNoteEmbeddingText(note: Note): string {
  const parts = [
    note.title,
    note.summary?.overview ?? '',
    ...(note.summary?.keyTerms.map((t) => `${t.term}: ${t.definition}`) ?? []),
    ...(note.summary?.points ?? []),
    note.content.slice(0, 3000),
  ]
  return parts.filter(Boolean).join('\n').slice(0, 4000)
}

/**
 * Searches notes by exact substring AND semantic meaning (hybrid concept expansion + optional Gemini embedding vectors).
 */
export function searchNotesSemantic(
  notes: Note[],
  query: string,
  tag = '',
  embeddings?: { noteVectors?: Record<string, number[]>; queryVector?: number[] },
): SemanticNoteMatch[] {
  const cleanTag = tag.trim()
  const tagFiltered = cleanTag ? notes.filter((n) => n.summary?.tags?.includes(cleanTag)) : notes
  const search = query.trim().toLocaleLowerCase('tr-TR')
  if (!search) {
    return tagFiltered.map((note) => ({
      note,
      score: 1,
      matchType: 'all',
      matchedTerm: null,
      snippet: null,
    }))
  }

  const results: SemanticNoteMatch[] = []

  for (const note of tagFiltered) {
    const haystack = [
      note.title,
      note.content,
      note.summary?.overview ?? '',
      ...(note.summary?.points ?? []),
      ...(note.summary?.keyTerms.map((k) => `${k.term} ${k.definition}`) ?? []),
      ...(note.summary?.tags ?? []),
    ]
      .join(' ')
      .toLocaleLowerCase('tr-TR')

    const isExact = haystack.includes(search)
    const { snippet, matchedTerm, localScore } = findBestNoteSnippet(note, search)

    let vectorScore = 0
    const noteVec = embeddings?.noteVectors?.[note.id]
    const queryVec = embeddings?.queryVector
    if (noteVec && queryVec && noteVec.length === queryVec.length) {
      vectorScore = vectorMatchScore(cosineSimilarity(noteVec, queryVec))
    }

    const combinedSemantic = Math.max(localScore, vectorScore)

    if (isExact) {
      results.push({
        note,
        score: Math.max(0.85, combinedSemantic),
        matchType: 'exact',
        matchedTerm,
        snippet,
      })
    } else if (combinedSemantic >= 0.22) {
      results.push({
        note,
        score: combinedSemantic,
        matchType: 'semantic',
        matchedTerm,
        snippet,
      })
    }
  }

  return results.sort((a, b) => {
    if (a.matchType !== b.matchType) return a.matchType === 'exact' ? -1 : 1
    return b.score - a.score
  })
}

/**
 * Matches a quiz or exam question to the most relevant note and passage in the course
 * ("Bu soruya hangi notun cevap veriyor?").
 */
export function matchQuestionToNote(
  question: Pick<ExamQuestion, 'prompt' | 'explanation' | 'modelAnswer' | 'source' | 'options'> | Pick<Question, 'prompt' | 'explanation' | 'source' | 'options'>,
  notes: Note[],
  noteVectors?: Record<string, number[]>,
  questionVector?: number[],
): QuestionNoteMatch | null {
  if (!notes.length) return null

  const correctAnswer =
    'answerIndex' in question && typeof question.answerIndex === 'number' && question.answerIndex >= 0
      ? question.options[question.answerIndex] ?? ''
      : ''
  const modelAns = 'modelAnswer' in question ? question.modelAnswer : ''
  const compositeQuery = [question.source ?? '', question.prompt, correctAnswer, modelAns, question.explanation].filter(Boolean).join(' ')

  let best: QuestionNoteMatch | null = null

  for (const note of notes) {
    const { snippet, matchedTerm, localScore } = findBestNoteSnippet(note, compositeQuery)
    let vectorScore = 0
    const noteVec = noteVectors?.[note.id]
    if (noteVec && questionVector && noteVec.length === questionVector.length) {
      vectorScore = vectorMatchScore(cosineSimilarity(noteVec, questionVector))
    }
    const score = Math.max(localScore, vectorScore)
    if (score >= 0.2 && snippet && (!best || score > best.score)) {
      best = {
        note,
        score,
        matchedTerm,
        snippet,
      }
    }
  }

  return best
}

/** How many notes one search shows. */
const MAX_HITS = 8
/** Notes within this much of the best match are shown with it. */
const NEAR_BEST = 0.06

/**
 * Notes that contain the words come first; then notes close in meaning, but only those near the best
 * match and above the "related" line, so an unrelated search shows nothing instead of everything.
 */
export function rankNotesByMeaning(notes: Note[], vectors: Record<string, number[]>, query: string, queryVector: number[] | null) {
  const q = query.toLocaleLowerCase('tr-TR')
  const scored = notes.map((note) => {
    const text = [note.title, note.content, note.summary?.overview ?? ''].join(' ').toLocaleLowerCase('tr-TR')
    const v = vectors[note.id]
    const sim = queryVector && v?.length === queryVector.length ? cosineSimilarity(v, queryVector) : 0
    return { note, exact: text.includes(q), sim }
  })
  const best = Math.max(0, ...scored.map((s) => s.sim))
  return scored
    .filter((s) => s.exact || (s.sim >= VECTOR_MATCH_AT && s.sim >= best - NEAR_BEST))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.sim - a.sim)
    .slice(0, MAX_HITS)
    .map((s) => ({ ...s, snippet: findBestNoteSnippet(s.note, query).snippet }))
}
