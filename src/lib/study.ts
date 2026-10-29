export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  answerIndex: number
  explanation: string
}

export interface Flashcard {
  id: string
  front: string
  back: string
}

export interface PracticeTask {
  id: string
  title: string
  prompt: string
  hint: string
  checklist: string[]
}

export interface StudySet {
  summary: string[]
  keywords: string[]
  quiz: QuizQuestion[]
  cards: Flashcard[]
  practice: PracticeTask[]
}

interface Passage {
  text: string
  order: number
}

interface Definition {
  term: string
  description: string
  source: string
}

// This is an extractive, local study aid: factual answers always come from the
// supplied notes. It does not call an AI service or invent missing information.
const MIN_CHARACTERS = 120
const MAX_CHARACTERS = 400_000
const STOP_WORDS = new Set(
  `acaba ancak artık ayrıca bazı bazen başka belki bile bir biri birbiri birkaç
  birlikte birçok bütün böyle böylece buna bundan bunlar bunları bunun burada
  çünkü daha dahi değil diğer diye dolayısıyla dolayı durum durumda eden eder
  ederek edildi edilir edilmesi eğeri eğer fazla fakat gibi göre hala hangi
  hatta hem her herkes için iken ilgili ise kadar kendi kendini kendisi kez ki
  kim kimi kısaca maddeler nasıl neden nedir neler nerede nitekim olan olarak
  olabilir olduğu oldukları olmak olması olur olmaz onun onların orada ortaya
  öyle önce önemli örnek örneğin özellikle rağmen sadece sahip sana sanki
  sonra sonuç sonuçta sürece şekilde şöyle tarafından tekrar temel tüm türlü
  üzerinden üzere veya veya ve ya yalnız yani yapılan yapmak yapılır yeni yine
  yok yoluyla zaman içinde dışında arasında hakkında karşı boyunca amacı
  kullanılır kullanılarak sağlar sağlaması süreci süreç ifade tanım ders not
  notlar notları açıklama konu bilgi bilgiler bunlara bunların şunlar şudur
  olacaktır vardır farklı ilişkili mümkün gerektiği gereklidir sayede ile
  ihtimal bulunmaktadır bulunur ilişkin açısından öğrenci öğrenciler yöntemi`
    .split(/\s+/)
    .filter(Boolean),
)

function lower(value: string): string {
  return value.toLocaleLowerCase('tr-TR')
}

function words(value: string): string[] {
  return value.match(/[\p{L}][\p{L}\p{M}'’-]*/gu) ?? []
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function cleanLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line && !/^```/.test(line))
}

function getPassages(lines: string[]): Passage[] {
  const passages: Passage[] = []
  for (const line of lines) {
    // Preserve short headings/abbreviations together with their next sentence.
    const parts = line.split(/(?<=[.!?])\s+(?=[\p{Lu}\d“"«])/u)
    for (let index = 0; index < parts.length; index += 1) {
      let text = parts[index].trim()
      while (text.length < 35 && index + 1 < parts.length) {
        text += ` ${parts[++index].trim()}`
      }
      if (text.length >= 35 && words(text).length >= 5) {
        passages.push({ text, order: passages.length })
      }
    }
  }
  return passages
}

function getDefinitions(passages: Passage[]): Definition[] {
  const seen = new Set<string>()
  const definitions: Definition[] = []
  for (const passage of passages) {
    const match = passage.text.match(/^([\p{L}][\p{L}\p{M}\d '\-’()]{1,65})\s*:\s*(.{20,})$/u)
    if (!match) continue
    const term = match[1].trim()
    const normalized = lower(term)
    if (words(term).length > 6 || seen.has(normalized)) continue
    // Section titles should not become "definitions" in a quiz.
    if (/^(özet|örnek|örnekler|not|notlar|notları|açıklama|içindekiler|kaynaklar|soru|cevap)$/u.test(normalized)) continue
    seen.add(normalized)
    definitions.push({ term, description: match[2].trim(), source: passage.text })
  }
  return definitions
}

function getVocabulary(passages: Passage[]): Array<{ term: string; score: number }> {
  const frequency = new Map<string, { term: string; count: number; passages: number }>()
  for (const passage of passages) {
    const seenInPassage = new Set<string>()
    for (const term of words(passage.text)) {
      const key = lower(term)
      if (term.length < 5 || STOP_WORDS.has(key)) continue
      const entry = frequency.get(key) ?? { term, count: 0, passages: 0 }
      entry.count += 1
      if (!seenInPassage.has(key)) entry.passages += 1
      // Sentence-initial capitalization should not produce duplicate concepts.
      if (term === key) entry.term = term
      frequency.set(key, entry)
      seenInPassage.add(key)
    }
  }
  return [...frequency.values()]
    .map(({ term, count, passages: countPassages }) => ({
      term,
      score: countPassages * 2 + Math.min(count, 5),
    }))
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term, 'tr'))
}

function summarize(passages: Passage[], vocabulary: Array<{ term: string; score: number }>): string[] {
  const scores = new Map(vocabulary.map(({ term, score }) => [lower(term), score]))
  const ranked = passages.map((passage) => {
    const tokens = unique(words(passage.text).map(lower))
    const total = tokens.reduce((sum, word) => sum + (scores.get(word) ?? 0), 0)
    const definitionBoost = passage.text.includes(':') ? 1.2 : 1
    // Prefer informative sentences, without letting long paragraphs dominate.
    const score = (total / Math.sqrt(Math.max(tokens.length, 1))) * definitionBoost
    return { ...passage, score }
  })
  const selected: typeof ranked = []
  for (const candidate of ranked.sort((a, b) => b.score - a.score || a.order - b.order)) {
    const candidateWords = new Set(words(candidate.text).map(lower))
    const redundant = selected.some((chosen) => {
      const chosenWords = new Set(words(chosen.text).map(lower))
      const shared = [...candidateWords].filter((word) => chosenWords.has(word)).length
      return shared / Math.max(1, Math.min(chosenWords.size, candidateWords.size)) > 0.82
    })
    if (!redundant) selected.push(candidate)
    if (selected.length === 5) break
  }
  return selected.sort((a, b) => a.order - b.order).map(({ text }) => text)
}

function makeOptions(answer: string, alternatives: string[], index: number): Pick<QuizQuestion, 'options' | 'answerIndex'> {
  const distractors = unique(alternatives.filter((term) => lower(term) !== lower(answer))).slice(0, 3)
  const answerIndex = index % (distractors.length + 1)
  const options = [...distractors]
  options.splice(answerIndex, 0, answer)
  return { options, answerIndex }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function blankTerm(sentence: string, term: string): string | undefined {
  // Unicode word boundaries work for Turkish characters unlike JS's \b.
  const pattern = new RegExp(`(^|[^\\p{L}\\p{M}])(${escapeRegExp(term)})(?=$|[^\\p{L}\\p{M}])`, 'gu')
  if (!pattern.test(sentence)) return undefined
  pattern.lastIndex = 0
  return sentence.replace(pattern, '$1_____')
}

function getQuiz(
  definitions: Definition[],
  summary: string[],
  vocabulary: Array<{ term: string; score: number }>,
): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  const usedAnswers = new Set<string>()
  if (definitions.length >= 3) {
    for (const definition of definitions) {
      // Do not show the answer itself inside the description.
      if (lower(definition.description).includes(lower(definition.term))) continue
      const alternatives = definitions
        .filter((other) => !lower(definition.description).includes(lower(other.term)))
        .map(({ term }) => term)
      if (alternatives.length < 3) continue
      questions.push({
        id: `quiz-${questions.length + 1}`,
        prompt: `Notlarına göre bu açıklama hangi kavrama ait?\n\n“${definition.description}”`,
        ...makeOptions(definition.term, alternatives, questions.length),
        explanation: `Notundaki açıklama: ${definition.source}`,
      })
      usedAnswers.add(lower(definition.term))
      if (questions.length === 5) return questions
    }
  }
  for (const sentence of summary) {
    const sentenceWords = words(sentence)
    const sentenceKeys = new Set(sentenceWords.map(lower))
    for (const { term } of vocabulary) {
      const answer = sentenceWords.find((word) => lower(word) === lower(term))
      if (!answer || usedAnswers.has(lower(answer))) continue
      const alternatives = vocabulary
        .map((entry) => entry.term)
        .filter((candidate) => !sentenceKeys.has(lower(candidate)))
      if (alternatives.length < 2) continue
      const cloze = blankTerm(sentence, answer)
      if (!cloze) continue
      questions.push({
        id: `quiz-${questions.length + 1}`,
        prompt: `Notundaki cümleyi hangi sözcük tamamlar?\n\n“${cloze}”`,
        ...makeOptions(answer, alternatives, questions.length),
        explanation: `Notundaki cümle: ${sentence}`,
      })
      usedAnswers.add(lower(answer))
      break
    }
    if (questions.length === 5) break
  }
  return questions
}

function getCards(definitions: Definition[], summary: string[], keywords: string[]): Flashcard[] {
  const cards: Flashcard[] = definitions.slice(0, 6).map((definition, index) => ({
    id: `card-${index + 1}`,
    front: `“${definition.term}” ne anlama gelir?`,
    back: definition.description,
  }))
  const definitionSources = new Set(definitions.map(({ source }) => source))
  for (const sentence of summary) {
    if (cards.length === 6) break
    if (definitionSources.has(sentence)) continue
    const term = keywords.find((keyword) => words(sentence).some((word) => lower(word) === lower(keyword)))
    const actualTerm = term && words(sentence).find((word) => lower(word) === lower(term))
    const cloze = actualTerm && blankTerm(sentence, actualTerm)
    cards.push({
      id: `card-${cards.length + 1}`,
      front: cloze ? `Boşluğu hatırla:\n\n${cloze}` : 'Bu bölümün ana fikrini kendi sözlerinle anlat.',
      back: sentence,
    })
  }
  return cards
}

function getPractice(definitions: Definition[], summary: string[], keywords: string[]): PracticeTask[] {
  const first = definitions[0]?.term ?? keywords[0]
  const second = definitions[1]?.term ?? keywords.find((term) => lower(term) !== lower(first ?? ''))
  const source = definitions[0]?.source ?? summary[0]
  const tasks: PracticeTask[] = [
    {
      id: 'practice-1',
      title: 'Bir arkadaşına anlat',
      prompt: first
        ? `“${first}” konusunu ilk kez duyan bir arkadaşına 3–4 cümleyle anlat. Teknik bir ifadeyi sadeleştir, ardından kendi örneğini ekle.`
        : 'Notlarındaki ana fikri konuyu ilk kez duyan bir arkadaşına 3–4 cümleyle anlat. Kendi örneğini ekle.',
      hint: `Başlangıç için notundan: ${source}`,
      checklist: [
        'Ana fikri notlarıma uygun biçimde açıkladım.',
        'Teknik bir ifadeyi kendi sözlerimle sadeleştirdim.',
        'Kendi örneğimi nottaki bilgiden ayırdım ve uygunluğunu kontrol ettim.',
      ],
    },
    {
      id: 'practice-2',
      title: 'Bilgiyi bir duruma uygula',
      prompt: `Notlarındaki ${first ? `“${first}” fikrinin` : 'bir fikrin'} kullanılabileceği bir günlük yaşam veya ders senaryosu yaz. Bu durumda ne yapacağını ve nedenini notundan bir cümleyle gerekçelendir.`,
      hint: 'Senaryoyu sen oluştur. Notlarının yanıtlamadığı bir ayrıntı varsa bunu varsayım olarak belirt.',
      checklist: [
        'Somut bir durum ve bu durumda yapılacak bir eylem yazdım.',
        'Gerekçemi notumdaki bir bilgiye bağladım.',
        'Eklediğim varsayımları açıkça belirttim.',
      ],
    },
  ]
  if (first && second) {
    tasks.push({
      id: 'practice-3',
      title: 'İki kavramı ilişkilendir',
      prompt: `“${first}” ve “${second}” için notundaki ilgili cümleleri bul. Aralarındaki benzerliği, farkı veya ilişkiyi açıkla. Notlar bir ilişki kurmaya yetmiyorsa eksik bilgiyi belirt.`,
      hint: 'Bir ilişki varsaymak zorunda değilsin. İki ayrı kaynak cümlesinden başlayıp neyi bildiğini ve neyi bilmediğini ayır.',
      checklist: [
        'Her iki kavram için notlarımdan dayanak buldum.',
        'İlişkiyi dayanaklarla açıkladım veya kanıtın yetersiz olduğunu belirttim.',
        'Yanıtımı kendi cümlelerimle yazdım.',
      ],
    })
  }
  return tasks
}

/** Produce a deterministic study set in the browser without sending notes away. */
export function generateStudySet(text: string): StudySet {
  if (text.replace(/\s/g, '').length < MIN_CHARACTERS) {
    throw new Error('Bir çalışma seti oluşturmak için en az 120 karakterlik ders notu ekle. Birkaç açıklayıcı cümle yeterli.')
  }
  if (text.length > MAX_CHARACTERS) {
    throw new Error('Bu not tek bir çalışma seti için çok uzun. Notunu 400.000 karakterden kısa bölümlere ayır.')
  }
  const passages = getPassages(cleanLines(text))
  if (passages.length === 0) {
    throw new Error('Bu nottan açıklayıcı cümleler çıkarılamadı. Yalnızca başlıklar yerine konuyu anlatan birkaç cümle ekle.')
  }
  const definitions = getDefinitions(passages)
  const vocabulary = getVocabulary(passages)
  const keywords = unique([...definitions.map(({ term }) => term), ...vocabulary.map(({ term }) => term)]
    .map((term) => lower(term)))
    .slice(0, 8)
  const summary = summarize(passages, vocabulary)
  return {
    summary,
    keywords,
    quiz: getQuiz(definitions, summary, vocabulary),
    cards: getCards(definitions, summary, keywords),
    practice: getPractice(definitions, summary, keywords),
  }
}
