/**
 * Mini games for the break page (admins only while they are tried out): the logic, kept apart
 * from the screens so it can be tested.
 *
 * - Fosforla altını çiz: one short paragraph a day; highlight the words that matter.
 * - Kâğıt top: flick crumpled paper into the bin, with wind.
 * - Çekmece: put two identical items together and they become the next one, up to a diploma.
 */

// ---------- Fosforla altını çiz ----------

export interface HighlightParagraph {
  id: string
  title: string
  /** Key phrases are in [brackets]; a phrase is highlighted as one piece. */
  text: string
}

export interface HighlightToken {
  index: number
  text: string
  /** Punctuation right after the word: shown, but not part of the highlight. */
  after: string
  key: boolean
}

export const HIGHLIGHT_SECONDS = 40
export const HIGHLIGHT_HIT = 10
export const HIGHLIGHT_WRONG = 5

export const HIGHLIGHT_PARAGRAPHS: HighlightParagraph[] = [
  {
    id: 'ahtapot',
    title: 'Ahtapotun kalpleri',
    text: 'Ahtapotların tam [üç kalbi] vardır. İkisi solungaçlara, biri vücudun geri kalanına kan pompalar. Kanları kırmızı değil [mavidir], çünkü oksijeni demir yerine [bakır] içeren bir molekülle taşırlar. Yüzerken ana kalp durur; bu yüzden ahtapotlar yüzmekten çabuk yorulur.',
  },
  {
    id: 'unutma',
    title: 'Unutmanın hızı',
    text: "Ebbinghaus'un deneylerine göre yeni öğrenilen bilginin büyük kısmı [ilk birkaç gün] içinde unutulur. Bilgiyi [aralıklarla tekrar] etmek bu kaybı yavaşlatır. Her tekrardan sonra bir sonraki tekrara kadar [daha uzun] süre beklenebilir.",
  },
  {
    id: 'bal',
    title: 'Bozulmayan yiyecek',
    text: 'Bal doğru saklanırsa neredeyse [bozulmaz]. Arkeologlar Mısır mezarlarında [binlerce yıllık] bal kavanozları buldu. Balın içinde çok az [su] bulunur ve bal hafif [asidiktir]; bu ortamda bakteriler çoğalamaz.',
  },
  {
    id: 'uyku',
    title: 'Uyurken çalışan beyin',
    text: 'Uyurken beyin boş durmaz. Gün içinde öğrendiklerini [tekrar oynatır] ve önemli olanları [uzun süreli belleğe] taşır. Bu yüzden sınavdan önceki gece [uykusuz kalmak], fazladan bir saat çalışmaktan çoğu zaman daha zararlıdır.',
  },
  {
    id: 'kedi',
    title: 'Kediler ve kutular',
    text: 'Kediler kutulara girmeyi sever, çünkü dar alanlar onlara [güven] verir. Bir araştırmada kutusu olan barınak kedilerinin [daha az stresli] olduğu ve yeni ortama [daha hızlı] alıştığı görüldü.',
  },
  {
    id: 'pomodoro',
    title: 'Domatesli saat',
    text: 'Pomodoro tekniği adını, mucidinin kullandığı [domates şeklindeki] mutfak saatinden alır. Yöntem basittir: [25 dakika] odaklan, ardından [kısa bir mola] ver. Dört turdan sonra daha uzun bir mola gelir.',
  },
  {
    id: 'gunes',
    title: 'Geç gelen ışık',
    text: "Güneş'ten çıkan ışık Dünya'ya yaklaşık [8 dakikada] ulaşır. Yani gökyüzüne baktığında Güneş'i [8 dakika önceki] hâliyle görürsün. Gece gördüğün bazı yıldızların ışığı ise [binlerce yıl] önce yola çıkmıştır.",
  },
  {
    id: 'zurafa',
    title: 'Zürafanın boynu',
    text: 'Zürafaların boynu çok uzun olsa da boyunlarında insanlarla [aynı sayıda], yani [yedi] omur vardır. Aradaki fark, zürafanın her bir omurunun [çok daha uzun] olmasıdır.',
  },
  {
    id: 'tardigrad',
    title: 'Ölümsüze yakın canlı',
    text: 'Tardigradlar [yarım milimetre] boyunda minik canlılardır. Neredeyse tamamen [kuruyup] yıllarca bekleyebilir, su bulunca yeniden canlanırlar. Bazıları [uzay boşluğunda] bile hayatta kalmayı başarmıştır.',
  },
  {
    id: 'kursun',
    title: 'Kurşunsuz kalem',
    text: 'Kurşun kalemin içinde aslında [kurşun yoktur]. Ucu, kil ile karıştırılmış [grafitten] yapılır. Eskiden grafitin bir tür kurşun sanılması bu [yanlış ismin] kaynağıdır.',
  },
  {
    id: 'cizgi',
    title: 'Her şeyin altını çizmek',
    text: 'Bir metnin her satırının altını çizmek, [hiçbirini çizmemekle] neredeyse aynı işe yarar. İşe yarayan, okurken [ana fikri] seçmek ve kenara [kendi cümlelerinle] not almaktır.',
  },
  {
    id: 'turkce',
    title: 'Ek ek büyüyen kelimeler',
    text: 'Türkçe [eklemeli] bir dildir: kelimelerin sonuna ekler eklenerek yeni anlamlar kurulur. Bu yüzden Türkçedeki [tek bir kelime], başka dillerde [koca bir cümleye] karşılık gelebilir.',
  },
  {
    id: 'cilek',
    title: 'Çileğin sırrı',
    text: 'Bilimsel tanıma göre muz bir [üzümsü meyvedir], çilek ise değildir. Çileğin üzerindeki küçük noktaların her biri aslında [ayrı bir meyvedir] ve içinde birer [tohum] taşır.',
  },
  {
    id: 'sinekkusu',
    title: 'Geri geri uçan kuş',
    text: 'Sinek kuşları kanatlarını saniyede [onlarca kez] çırpar. Bu sayede havada [asılı kalabilir] ve [geri geri] uçabilirler. Bunu yapabilen başka kuş yok denecek kadar azdır.',
  },
]

/** Words and [key phrases] of a paragraph, with the punctuation that follows each. */
export function parseParagraph(text: string): HighlightToken[] {
  const tokens: HighlightToken[] = []
  const pattern = /\[([^\]]+)\]([^\s[]*)|([^\s[]+)/g
  for (const m of text.matchAll(pattern)) {
    if (m[1] !== undefined) {
      tokens.push({ index: tokens.length, text: m[1], after: m[2] ?? '', key: true })
    } else {
      const raw = m[3]
      const word = raw.match(/^(.*?)([.,;:!?)"']*)$/)!
      // A token that is only punctuation (rare) stays as plain text.
      tokens.push({ index: tokens.length, text: word[1] || raw, after: word[1] ? word[2] : '', key: false })
    }
  }
  return tokens
}

export interface HighlightScore {
  hits: number
  wrong: number
  missed: number
  keys: number
  points: number
  /** 0-3 stars: all keys and nothing extra is three. */
  stars: number
}

export function scoreHighlight(tokens: HighlightToken[], chosen: ReadonlySet<number>): HighlightScore {
  let hits = 0
  let wrong = 0
  let keys = 0
  for (const t of tokens) {
    if (t.key) keys += 1
    if (!chosen.has(t.index)) continue
    if (t.key) hits += 1
    else wrong += 1
  }
  const points = Math.max(0, hits * HIGHLIGHT_HIT - wrong * HIGHLIGHT_WRONG)
  const share = keys ? points / (keys * HIGHLIGHT_HIT) : 0
  const stars = share >= 1 ? 3 : share >= 0.66 ? 2 : share >= 0.33 ? 1 : 0
  return { hits, wrong, missed: keys - hits, keys, points, stars }
}

/** Day number in Istanbul time, so everyone in Turkey gets the same paragraph on the same day. */
export function istanbulDay(now = Date.now()): number {
  return Math.floor((now + 3 * 3600_000) / 86_400_000)
}

export function dailyParagraph(now = Date.now(), list = HIGHLIGHT_PARAGRAPHS): HighlightParagraph {
  return list[istanbulDay(now) % list.length]
}

// ---------- Kâğıt top ----------

/** The scene is drawn in these units; the SVG scales it to the screen. */
export const TOSS_W = 360
export const TOSS_H = 520
export const TOSS_THROWS = 10
export const TOSS_GRAVITY = 900
export const BALL_R = 13
export const BALL_START = { x: 64, y: 440 }
export const BIN = { left: 252, right: 312, rim: 362, bottom: 452 }
export const MAX_SPEED = 1150

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
}

export type TossEnd = 'in' | 'out'

/** Wind for one throw, in px/s² sideways: random, sometimes calm. */
export function randomWind(rand = Math.random): number {
  const w = Math.round((rand() * 2 - 1) * 160)
  return Math.abs(w) < 25 ? 0 : w
}

/** Turns a flick (screen movement in scene units over `ms`) into a launch speed. */
export function launchFromFlick(dx: number, dy: number, ms: number): { vx: number; vy: number } | null {
  if (ms <= 0 || dy > -8) return null
  let vx = (dx / ms) * 1000 * 0.55
  let vy = (dy / ms) * 1000 * 0.55
  const speed = Math.hypot(vx, vy)
  if (speed < 250) return null
  if (speed > MAX_SPEED) {
    vx = (vx / speed) * MAX_SPEED
    vy = (vy / speed) * MAX_SPEED
  }
  return { vx, vy }
}

/** One physics step. Returns the new ball and, when the throw is over, how it ended. */
export function stepBall(ball: Ball, wind: number, dt: number): { ball: Ball; end: TossEnd | null; rim: boolean } {
  let vx = ball.vx + wind * dt
  const vy = ball.vy + TOSS_GRAVITY * dt
  let x = ball.x + vx * dt
  const y = ball.y + vy * dt
  let rim = false

  // Crossing the rim line on the way down.
  if (ball.y <= BIN.rim && y > BIN.rim && vy > 0) {
    const t = (BIN.rim - ball.y) / (y - ball.y)
    const cx = ball.x + (x - ball.x) * t
    if (cx > BIN.left + BALL_R * 0.6 && cx < BIN.right - BALL_R * 0.6) return { ball: { x: cx, y: BIN.rim + 1, vx: 0, vy }, end: 'in', rim: false }
    // Clipped the edge of the rim: bounces off sideways.
    if (Math.abs(cx - BIN.left) <= BALL_R || Math.abs(cx - BIN.right) <= BALL_R) {
      rim = true
      vx = -vx * 0.45 + (cx < (BIN.left + BIN.right) / 2 ? -60 : 60)
      x = cx + Math.sign(vx) * BALL_R
    }
  }
  // Hitting the side of the bin below the rim.
  if (y > BIN.rim && y < BIN.bottom && x + BALL_R > BIN.left && x - BALL_R < BIN.right && !(ball.x + BALL_R > BIN.left && ball.x - BALL_R < BIN.right)) {
    rim = true
    vx = -vx * 0.35
    x = ball.x
  }
  const next = { x, y, vx, vy }
  if (y > TOSS_H + BALL_R || x < -60 || x > TOSS_W + 60) return { ball: next, end: 'out', rim }
  if (y >= BIN.bottom && vy > 0 && (x < BIN.left - BALL_R || x > BIN.right + BALL_R)) return { ball: { ...next, y: BIN.bottom }, end: 'out', rim }
  return { ball: next, end: null, rim }
}

/** Plays a whole throw without drawing it (for tests and for checking that a throw can go in). */
export function simulateThrow(vx: number, vy: number, wind: number, dt = 1 / 120): TossEnd {
  let ball: Ball = { ...BALL_START, vx, vy }
  for (let i = 0; i < 2000; i += 1) {
    const step = stepBall(ball, wind, dt)
    if (step.end) return step.end
    ball = step.ball
  }
  return 'out'
}

export function tossPoints(results: TossEnd[]): number {
  let points = 0
  let streak = 0
  for (const r of results) {
    if (r === 'in') {
      streak += 1
      points += streak >= 3 ? 2 : 1
    } else streak = 0
  }
  return points
}

// ---------- Çekmece (birleştirme) ----------

export const DRAWER_SIZE = 4
export const DRAWER_SECONDS = 120

export const DRAWER_ITEMS = ['Kurşun kalem', 'Tükenmez kalem', 'Fosforlu kalem', 'Defter', 'Kitap', 'Ders notu', 'Mezuniyet kepi', 'Diploma'] as const
export const DRAWER_MAX = DRAWER_ITEMS.length

/** Cells hold an item level (1-8) or null. */
export type Drawer = Array<number | null>

export function emptyCells(grid: Drawer): number[] {
  return grid.flatMap((v, i) => (v === null ? [i] : []))
}

/** Puts one new item (mostly a pencil, sometimes a pen) in a random empty cell. */
export function spawnItem(grid: Drawer, rand = Math.random): Drawer {
  const free = emptyCells(grid)
  if (!free.length) return grid
  const next = [...grid]
  next[free[Math.floor(rand() * free.length)]] = rand() < 0.12 ? 2 : 1
  return next
}

export function newDrawer(rand = Math.random): Drawer {
  let grid: Drawer = Array(DRAWER_SIZE * DRAWER_SIZE).fill(null)
  for (let i = 0; i < 4; i += 1) grid = spawnItem(grid, rand)
  return grid
}

export function canMerge(grid: Drawer, from: number, to: number): boolean {
  return from !== to && grid[from] !== null && grid[from] === grid[to] && (grid[from] as number) < DRAWER_MAX
}

/** Moves `from` onto `to`: two equal items become the next one. Returns the points earned. */
export function mergeItems(grid: Drawer, from: number, to: number): { grid: Drawer; points: number; level: number } | null {
  if (!canMerge(grid, from, to)) return null
  const level = (grid[to] as number) + 1
  const next = [...grid]
  next[from] = null
  next[to] = level
  return { grid: next, points: 2 ** level, level }
}

/** Full and nothing left to put together: the round is over. */
export function drawerStuck(grid: Drawer): boolean {
  if (emptyCells(grid).length) return false
  const seen = new Set<number>()
  for (const v of grid) {
    if (v === null || v >= DRAWER_MAX) continue
    if (seen.has(v)) return false
    seen.add(v)
  }
  return true
}

export function bestLevel(grid: Drawer): number {
  return grid.reduce<number>((m, v) => (v !== null && v > m ? v : m), 0)
}

// ---------- Records (this device) ----------

const RECORDS_KEY = 'studymode.miniGames'

export interface MiniRecords {
  highlight?: { day: number; points: number; stars: number }
  highlightBest?: number
  toss?: number
  drawer?: number
  drawerLevel?: number
}

export function readMiniRecords(): MiniRecords {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    return raw ? (JSON.parse(raw) as MiniRecords) : {}
  } catch {
    return {}
  }
}

export function saveMiniRecords(patch: Partial<MiniRecords>): MiniRecords {
  const next = { ...readMiniRecords(), ...patch }
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(next))
  } catch {
    // Blocked storage: records last for this visit only.
  }
  return next
}
