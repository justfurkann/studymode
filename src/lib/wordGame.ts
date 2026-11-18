/**
 * Günün Kavramı: a daily word puzzle with study terms. Everyone in Turkey gets the same term on
 * the same day. Each guess marks its letters: in the right place, in the word but elsewhere, or
 * not in the word. The subject is shown from the start; a definition opens after three tries.
 */

import { istanbulDay } from './miniGames'

export interface DailyTerm {
  word: string
  subject: string
  clue: string
}

export const MAX_GUESSES = 6
/** The definition opens after this many wrong guesses. */
export const CLUE_AFTER = 3

export const TERMS: DailyTerm[] = [
  { word: 'MİTOZ', subject: 'Biyoloji', clue: 'Bir hücrenin, kromozom sayısı aynı iki hücreye bölünmesi.' },
  { word: 'PROTON', subject: 'Kimya', clue: 'Atom çekirdeğindeki artı yüklü parçacık.' },
  { word: 'FERMAN', subject: 'Tarih', clue: 'Padişahın yazılı buyruğu.' },
  { word: 'TÜREV', subject: 'Matematik', clue: 'Bir fonksiyonun anlık değişim hızı.' },
  { word: 'DELTA', subject: 'Coğrafya', clue: 'Akarsuyun denize döküldüğü yerde biriktirdiği üçgenimsi düzlük.' },
  { word: 'KAFİYE', subject: 'Edebiyat', clue: 'Dize sonlarındaki ses benzerliği.' },
  { word: 'FOTON', subject: 'Fizik', clue: 'Işığın enerji paketi; ışık parçacığı.' },
  { word: 'ENZİM', subject: 'Biyoloji', clue: 'Tepkimeleri hızlandıran, çoğu protein yapılı biyolojik katalizör.' },
  { word: 'ANAYASA', subject: 'Hukuk', clue: 'Devletin temel düzenini ve temel hakları belirleyen en üst yasa.' },
  { word: 'MUSON', subject: 'Coğrafya', clue: 'Mevsime göre yön değiştiren, yağış getiren rüzgâr.' },
  { word: 'VEKTÖR', subject: 'Matematik', clue: 'Hem büyüklüğü hem yönü olan nicelik.' },
  { word: 'LONCA', subject: 'Tarih', clue: 'Aynı meslekten esnafın oluşturduğu örgüt.' },
  { word: 'NÖRON', subject: 'Biyoloji', clue: 'Sinir sistemini oluşturan hücre.' },
  { word: 'MOLEKÜL', subject: 'Kimya', clue: 'İki ya da daha çok atomun bağlanmasıyla oluşan yapı.' },
  { word: 'DESTAN', subject: 'Edebiyat', clue: 'Bir topluluğun kahramanlıklarını anlatan uzun, manzum anlatı.' },
  { word: 'KUVVET', subject: 'Fizik', clue: 'Bir cismin hareketini ya da şeklini değiştirebilen etki.' },
  { word: 'TALEP', subject: 'Ekonomi', clue: 'Belli bir fiyattan alınmak istenen mal miktarı.' },
  { word: 'MAYOZ', subject: 'Biyoloji', clue: 'Üreme hücrelerini oluşturan, kromozom sayısını yarıya indiren bölünme.' },
  { word: 'DİVAN', subject: 'Tarih', clue: "Osmanlı'da devlet işlerinin görüşüldüğü kurul." },
  { word: 'LİMİT', subject: 'Matematik', clue: 'Bir fonksiyonun, bir noktaya yaklaşırken yaklaştığı değer.' },
  { word: 'MAGMA', subject: 'Coğrafya', clue: 'Yerin derinliklerindeki erimiş kaya.' },
  { word: 'EMPATİ', subject: 'Psikoloji', clue: 'Kendini başkasının yerine koyup onun duygularını anlama.' },
  { word: 'NÖTRON', subject: 'Kimya', clue: 'Atom çekirdeğindeki yüksüz parçacık.' },
  { word: 'MERCEK', subject: 'Fizik', clue: 'Işığı kırarak toplayan ya da dağıtan saydam cisim.' },
  { word: 'HORMON', subject: 'Biyoloji', clue: 'Kanla taşınıp başka organları etkileyen kimyasal ileti.' },
  { word: 'BERAT', subject: 'Tarih', clue: 'Padişahın bir göreve atama ya da ayrıcalık için verdiği belge.' },
  { word: 'MATRİS', subject: 'Matematik', clue: 'Satır ve sütunlara dizilmiş sayı tablosu.' },
  { word: 'KANYON', subject: 'Coğrafya', clue: 'Akarsuyun aşındırarak oluşturduğu derin, dik yamaçlı vadi.' },
  { word: 'ROMAN', subject: 'Edebiyat', clue: 'Uzun, kurgusal düzyazı anlatı.' },
  { word: 'GENOM', subject: 'Biyoloji', clue: 'Bir canlının bütün genetik bilgisi.' },
  { word: 'KATOT', subject: 'Kimya', clue: 'Pilde ya da elektrolizde indirgenmenin olduğu elektrot.' },
  { word: 'ENERJİ', subject: 'Fizik', clue: 'İş yapabilme yeteneği.' },
  { word: 'TIMAR', subject: 'Tarih', clue: 'Hizmet karşılığında geliri sipahiye bırakılan toprak.' },
  { word: 'İKLİM', subject: 'Coğrafya', clue: 'Bir yerde uzun yıllar boyunca görülen ortalama hava koşulları.' },
  { word: 'OSMOZ', subject: 'Biyoloji', clue: 'Suyun yarı geçirgen bir zardan, çözünen maddenin daha yoğun olduğu tarafa geçmesi.' },
  { word: 'EKONOMİ', subject: 'Ekonomi', clue: 'Kıt kaynakların sınırsız ihtiyaçlar için nasıl kullanıldığını inceleyen bilim.' },
  { word: 'DALGA', subject: 'Fizik', clue: 'Enerjiyi, maddeyi taşımadan ileten titreşim.' },
  { word: 'MECLİS', subject: 'Vatandaşlık', clue: 'Yasaları yapan, seçilmiş temsilcilerden oluşan kurul.' },
  { word: 'REFLEKS', subject: 'Biyoloji', clue: 'Bir uyarana karşı istem dışı, hızlı tepki.' },
  { word: 'METAFOR', subject: 'Edebiyat', clue: 'Bir şeyi benzetme edatı kullanmadan başka bir şeyle anlatma; eğretileme.' },
  { word: 'İNTEGRAL', subject: 'Matematik', clue: 'Eğri altındaki alanı da veren, türevin tersi olan işlem.' },
  { word: 'PLAZMA', subject: 'Biyoloji', clue: 'Kanın sıvı kısmı.' },
  { word: 'ELEKTRON', subject: 'Kimya', clue: 'Çekirdeğin çevresinde bulunan eksi yüklü parçacık.' },
]

export const TR_LETTERS = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'

/** The day's term: the same for everyone on the same Istanbul day, never the same two days running. */
export function dailyTerm(now = Date.now(), list = TERMS): DailyTerm {
  return list[(istanbulDay(now) * 17 + 5) % list.length]
}

/** Uppercase in Turkish (i → İ, ı → I) and keep only Turkish letters. */
export function cleanGuess(text: string): string {
  return [...text.toLocaleUpperCase('tr-TR')].filter((c) => TR_LETTERS.includes(c)).join('')
}

export type Mark = 'hit' | 'near' | 'miss'

/**
 * Marks each letter of a guess. A letter that appears more often in the guess than in the word
 * is marked only as many times as the word has it (right places first).
 */
export function markGuess(guess: string, answer: string): Mark[] {
  const g = [...guess]
  const a = [...answer]
  const marks: Mark[] = g.map(() => 'miss')
  const left = new Map<string, number>()
  a.forEach((c, i) => {
    if (g[i] === c) marks[i] = 'hit'
    else left.set(c, (left.get(c) ?? 0) + 1)
  })
  g.forEach((c, i) => {
    if (marks[i] === 'hit') return
    const n = left.get(c) ?? 0
    if (n > 0) {
      marks[i] = 'near'
      left.set(c, n - 1)
    }
  })
  return marks
}

/** The best mark each letter has had so far, for colouring the keyboard. */
export function letterMarks(guesses: string[], answer: string): Record<string, Mark> {
  const rank: Record<Mark, number> = { miss: 0, near: 1, hit: 2 }
  const out: Record<string, Mark> = {}
  for (const g of guesses) {
    markGuess(g, answer).forEach((m, i) => {
      const c = [...g][i]
      if (!out[c] || rank[m] > rank[out[c]]) out[c] = m
    })
  }
  return out
}

export type GuessProblem = 'short' | 'repeat' | null

export function checkGuess(guess: string, answer: string, earlier: string[]): GuessProblem {
  if ([...guess].length !== [...answer].length) return 'short'
  if (earlier.includes(guess)) return 'repeat'
  return null
}

/** A text to paste in a chat: the pattern of marks, without the letters. */
export function shareText(day: number, guesses: string[], answer: string, won: boolean, clueOpened: boolean): string {
  const date = new Date(day * 86_400_000)
  const label = `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  const symbol: Record<Mark, string> = { hit: '■', near: '□', miss: '·' }
  const rows = guesses.map((g) => markGuess(g, answer).map((m) => symbol[m]).join(''))
  return [`StudyMode · Günün Kavramı ${label}`, `${won ? guesses.length : 'X'}/${MAX_GUESSES}${clueOpened ? ' (ipucuyla)' : ''}`, ...rows, 'studymode.fun'].join('\n')
}

// ---------- Saved progress (this device) ----------

const KEY = 'studymode.kavram'

export interface WordSave {
  day: number
  guesses: string[]
  /** Days won in a row, and the last day that counted. */
  streak: number
  lastWin: number | null
  played: number
  wins: number
}

export function readWordSave(today = istanbulDay()): WordSave {
  let saved: Partial<WordSave> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<WordSave>
  } catch {
    saved = {}
  }
  const base: WordSave = { day: today, guesses: [], streak: saved.streak ?? 0, lastWin: saved.lastWin ?? null, played: saved.played ?? 0, wins: saved.wins ?? 0 }
  // A missed day breaks the streak.
  if (base.lastWin !== null && today - base.lastWin > 1) base.streak = 0
  return saved.day === today ? { ...base, guesses: saved.guesses ?? [] } : base
}

export function writeWordSave(save: WordSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save))
  } catch {
    // Blocked storage: progress lasts for this visit only.
  }
}

/** Adds a guess and, when the puzzle ends, the win or loss to the totals. */
export function addGuess(save: WordSave, guess: string, answer: string): WordSave {
  const guesses = [...save.guesses, guess]
  const won = guess === answer
  const over = won || guesses.length >= MAX_GUESSES
  if (!over) return { ...save, guesses }
  return {
    ...save,
    guesses,
    played: save.played + 1,
    wins: save.wins + (won ? 1 : 0),
    streak: won ? (save.lastWin === save.day - 1 ? save.streak + 1 : 1) : 0,
    lastWin: won ? save.day : save.lastWin,
  }
}
