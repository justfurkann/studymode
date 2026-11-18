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

// ---------- Kâğıt top (fiske) ----------
//
// First person: a hand at the bottom flicks a paper ball at a bin on the floor ahead. The world is
// in metres: x to the right, y up, z away from the player; it is drawn with a simple perspective.

export const TOSS_THROWS = 10
export const SCENE_W = 360
export const SCENE_H = 560
const GRAVITY = 9.8
/** Camera: where the eye is, and how strongly things shrink with distance. */
const CAM = { y: 1.6, z: -0.8, focal: 300, horizon: 110 }
export const PAPER_R = 0.06
export const PAPER_START = { x: 0, y: 1.0, z: -0.2 }
export const BIN_R = 0.2
export const BIN_TALL = 0.38
const ELEVATION = (40 * Math.PI) / 180
export const MAX_YAW = (22 * Math.PI) / 180

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Paper extends Vec3 {
  vx: number
  vy: number
  vz: number
}

export interface Bin {
  x: number
  z: number
  /** Sways from side to side: how far (m) and how fast (rad/s). 0 = still. */
  sway: number
  speed: number
  phase: number
}

export type TossEnd = 'in' | 'out'

/** Screen position and scale (pixels per metre) of a point in the room. */
export function project(p: Vec3): { x: number; y: number; scale: number } {
  const depth = Math.max(0.05, p.z - CAM.z)
  const scale = CAM.focal / depth
  return { x: SCENE_W / 2 + p.x * scale, y: CAM.horizon + (CAM.y - p.y) * scale, scale }
}

/** Where the bin is at time `t` (seconds since the throw began). */
export function binX(bin: Bin, t: number): number {
  return bin.sway ? bin.x + bin.sway * Math.sin(bin.phase + bin.speed * t) : bin.x
}

/**
 * The bin for each throw: close and still at first, then further and placed anywhere, and in the
 * last throws it sways from side to side.
 */
export function binForThrow(index: number, rand = Math.random): Bin {
  const stage = index < 3 ? 0 : index < 7 ? 1 : 2
  const z = stage === 0 ? 2.2 + rand() * 0.8 : 2.6 + rand() * 2.4
  const spread = stage === 0 ? 0.35 : 0.25 * z
  const x = (rand() * 2 - 1) * spread
  return stage === 2 ? { x: x * 0.4, z, sway: 0.45 + rand() * 0.3, speed: 1.3 + rand() * 0.9, phase: rand() * Math.PI * 2 } : { x, z, sway: 0, speed: 0, phase: 0 }
}

/** Points for a hit: 1, +1 when the bin is far, +1 when it moves. */
export function binPoints(bin: Bin): number {
  return 1 + (bin.z > 3.6 ? 1 : 0) + (bin.sway ? 1 : 0)
}

/** Wind for one throw, sideways in m/s². The first throw is calm. */
export function randomWind(index: number, rand = Math.random): number {
  if (index === 0) return 0
  const w = Math.round((rand() * 2 - 1) * 14) / 10
  return Math.abs(w) < 0.3 ? 0 : w
}

/** How far (scene px) the finger is pulled down for full power, and sideways for full aim. */
export const PULL_FULL = 170
export const AIM_FULL = 140

/** Pulling the finger down tightens the flick: 0 (none) to 1 (full). Pulling up does nothing. */
export function powerFromPull(dy: number): number {
  return Math.max(0, Math.min(1, dy / PULL_FULL))
}

/** Sideways drag turns the aim: −1 (left) to 1 (right). */
export function aimFromPull(dx: number): number {
  return Math.max(-1, Math.min(1, dx / AIM_FULL))
}

/** Turns aim (−1 left … 1 right) and power (0-1) into the paper's start speed. */
export function flickLaunch(power: number, aim: number): Paper {
  const v = 3 + Math.max(0, Math.min(1, power)) * 4.6
  const yaw = Math.max(-1, Math.min(1, aim)) * MAX_YAW
  const flat = v * Math.cos(ELEVATION)
  return { ...PAPER_START, vx: flat * Math.sin(yaw), vy: v * Math.sin(ELEVATION), vz: flat * Math.cos(yaw) }
}

/**
 * One step of flight. `t` is the time since the throw (for a swaying bin). Ends 'in' when the
 * paper drops through the rim, 'out' when it lands on the floor or leaves the room. Clipping the
 * rim bounces it off.
 */
export function stepPaper(paper: Paper, bin: Bin, wind: number, t: number, dt: number): { paper: Paper; end: TossEnd | null; rim: boolean } {
  let vx = paper.vx + wind * dt
  let vz = paper.vz
  const vy = paper.vy - GRAVITY * dt
  const next: Paper = { x: paper.x + vx * dt, y: paper.y + vy * dt, z: paper.z + vz * dt, vx, vy, vz }
  let rim = false
  if (paper.y >= BIN_TALL && next.y < BIN_TALL && vy < 0) {
    const k = (paper.y - BIN_TALL) / (paper.y - next.y)
    const cx = paper.x + (next.x - paper.x) * k
    const cz = paper.z + (next.z - paper.z) * k
    const bx = binX(bin, t)
    const d = Math.hypot(cx - bx, cz - bin.z)
    if (d < BIN_R - PAPER_R * 0.5) return { paper: { ...next, x: cx, z: cz, y: BIN_TALL - 0.01 }, end: 'in', rim: false }
    if (d < BIN_R + PAPER_R) {
      // Off the rim: thrown back and outwards.
      rim = true
      const nx = (cx - bx) / (d || 1)
      const nz = (cz - bin.z) / (d || 1)
      vx = nx * 1.4 + vx * 0.2
      vz = nz * 1.4 + vz * 0.2
      return { paper: { x: cx + nx * 0.03, y: BIN_TALL + 0.01, z: cz + nz * 0.03, vx, vy: Math.abs(vy) * 0.35, vz }, end: null, rim }
    }
  }
  if (next.y <= PAPER_R) return { paper: { ...next, y: PAPER_R }, end: 'out', rim }
  if (next.z > 9 || Math.abs(next.x) > 5) return { paper: next, end: 'out', rim }
  return { paper: next, end: null, rim }
}

/** A whole throw without drawing it (tests, and to check every bin can be hit). */
export function simulateFlick(power: number, aim: number, bin: Bin, wind = 0, dt = 1 / 240): TossEnd {
  let paper = flickLaunch(power, aim)
  for (let i = 0, t = 0; i < 2400; i += 1, t += dt) {
    const step = stepPaper(paper, bin, wind, t, dt)
    if (step.end) return step.end
    paper = step.paper
  }
  return 'out'
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
