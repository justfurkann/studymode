import { ArrowLeft, Award, BookOpen, Crown, GraduationCap, Highlighter, NotebookPen, Pencil, PenLine, Play, Plus, RotateCcw, ScrollText, Star, Timer, Trash2, Trophy, Wind } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  aimFromPull,
  bestLevel,
  BIN_R,
  BIN_TALL,
  binForThrow,
  binPoints,
  binX,
  canMerge,
  dailyParagraph,
  DRAWER_ITEMS,
  DRAWER_MAX,
  DRAWER_SECONDS,
  drawerStuck,
  flickLaunch,
  HIGHLIGHT_PARAGRAPHS,
  HIGHLIGHT_SECONDS,
  istanbulDay,
  MAX_YAW,
  mergeItems,
  newDrawer,
  PAPER_R,
  PAPER_START,
  parseParagraph,
  powerFromPull,
  project,
  randomWind,
  readMiniRecords,
  saveMiniRecords,
  scoreHighlight,
  SCENE_H,
  SCENE_W,
  spawnItem,
  stepPaper,
  TOSS_THROWS,
  type Bin,
  type Drawer,
  type HighlightParagraph,
  type Paper,
  type TossEnd,
  type Vec3,
} from '../../lib/miniGames'
import { playSound } from '../../lib/sound'
import { Celebrate } from '../ui'
import { useTick } from './shared'

export type MiniGame = 'altini-ciz' | 'kagit-top' | 'cekmece'
export const MINI_GAMES: MiniGame[] = ['altini-ciz', 'kagit-top', 'cekmece']

// ---------- Shared frame ----------

/** Top bar of a game: back, name, and the score on the right; a bar under it for time or throws. */
function GameFrame({ title, onExit, score, progress, children }: { title: string; onExit: () => void; score?: ReactNode; progress?: number; children: ReactNode }) {
  return (
    <div className="page page-narrow mini-page">
      <div className="mini-bar">
        <button className="mini-back" onClick={onExit} aria-label="Oyunlara dön">
          <ArrowLeft size={20} />
        </button>
        <strong className="mini-bar-title">{title}</strong>
        <span className="mini-score">{score}</span>
      </div>
      {progress !== undefined && (
        <div className="mini-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
        </div>
      )}
      {children}
    </div>
  )
}

function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span className="mini-stars" role="img" aria-label={`${n}/3 yıldız`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} className={i < n ? 'is-on' : ''} aria-hidden="true" />
      ))}
    </span>
  )
}

/** End of a round: the big number, a line or two, play again or back to the games. */
function GameOver({ title, points, unit = 'puan', badge, stars, stats, note, onAgain, againLabel = 'Tekrar oyna', onExit }: {
  title: string
  points: number
  unit?: string
  badge?: string
  stars?: number
  stats: Array<[string, string | number]>
  note?: string
  onAgain: () => void
  againLabel?: string
  onExit: () => void
}) {
  return (
    <div className="mini-over" role="status">
      <span className="mini-over-label">{title}</span>
      <strong className="mini-over-points">
        {points} <small>{unit}</small>
      </strong>
      {stars !== undefined && <Stars n={stars} size={30} />}
      {badge && (
        <p className="mini-over-badge">
          <Celebrate>{badge}</Celebrate>
        </p>
      )}
      <dl className="mini-over-stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="subtle mini-over-note">{note}</p>}
      <div className="mini-over-actions">
        <button className="btn btn-primary" onClick={onAgain}>
          <RotateCcw size={16} /> {againLabel}
        </button>
        <button className="btn" onClick={onExit}>
          Oyunlara dön
        </button>
      </div>
    </div>
  )
}

// ---------- Hub ----------

export function MiniHub({ onOpen, onExit }: { onOpen: (game: MiniGame) => void; onExit: () => void }) {
  const records = readMiniRecords()
  const playedToday = records.highlight?.day === istanbulDay()
  return (
    <div className="page page-narrow mini-page">
      <div className="mini-hub-head">
        <button className="mini-back" onClick={onExit} aria-label="Molaya dön">
          <ArrowLeft size={20} />
        </button>
        <h1>
          Mini <span className="hl">oyunlar</span>
        </h1>
        <span className="mini-vip">
          <Crown size={14} aria-hidden="true" /> VIP
        </span>
      </div>
      <p className="muted mini-hub-sub">Kart gerekmez. Sıkıldığında bir el oyna, kafanı dağıt, derse dön.</p>

      <div className="mini-cards">
        <GameCard
          art={<HighlightArt />}
          title="Fosforla altını çiz"
          text="Günün paragrafında önemli yerleri fosforla. Fazlasını çizersen puan gider."
          chips={[playedToday ? `Bugün: ${records.highlight!.points} puan` : 'Günün paragrafı hazır', `${HIGHLIGHT_SECONDS} sn`]}
          done={playedToday}
          onOpen={() => onOpen('altini-ciz')}
        />
        <GameCard
          art={<TossArt />}
          title="Kâğıt top"
          text="Fiskeyle buruşuk kâğıdı ilerdeki çöpe at. Kova uzaklaşır, yer değiştirir, sonunda kayar."
          chips={[records.toss !== undefined ? `Rekor: ${records.toss} puan` : 'Rekor yok', `${TOSS_THROWS} atış`]}
          onOpen={() => onOpen('kagit-top')}
        />
        <GameCard
          art={<DrawerArt />}
          title="Çekmece"
          text="İki aynı eşyayı birleştir. Kurşun kalemden diplomaya kadar çıkabilir misin?"
          chips={[records.drawer !== undefined ? `Rekor: ${records.drawer} puan` : 'Rekor yok', `${DRAWER_SECONDS / 60} dakika`]}
          onOpen={() => onOpen('cekmece')}
        />
      </div>
    </div>
  )
}

function GameCard({ art, title, text, chips, done, onOpen }: { art: ReactNode; title: string; text: string; chips: string[]; done?: boolean; onOpen: () => void }) {
  return (
    <article className="mini-card">
      <div className="mini-card-art" aria-hidden="true">
        {art}
      </div>
      <div className="mini-card-body">
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        <div className="mini-chips">
          {chips.map((c) => (
            <span key={c} className="mini-chip">
              {c}
            </span>
          ))}
        </div>
        <button className="btn btn-primary mini-play" onClick={onOpen} aria-label={title}>
          <Play size={16} /> {done ? 'Antrenman' : 'Oyna'}
        </button>
      </div>
    </article>
  )
}

function HighlightArt() {
  return (
    <svg viewBox="0 0 320 120" className="art art-highlight">
      <rect x="0" y="0" width="320" height="120" className="art-paper" />
      {[30, 54, 78, 102].map((y) => (
        <line key={y} x1="0" x2="320" y1={y} y2={y} className="art-rule" />
      ))}
      <line x1="34" x2="34" y1="0" y2="120" className="art-margin" />
      <rect x="52" y="16" width="84" height="12" rx="3" className="art-ink" />
      <rect x="144" y="16" width="120" height="12" rx="3" className="art-ink" />
      <rect x="138" y="36" width="104" height="18" rx="5" className="art-mark" />
      <rect x="52" y="40" width="78" height="12" rx="3" className="art-ink" />
      <rect x="146" y="40" width="88" height="12" rx="3" className="art-ink" />
      <rect x="52" y="64" width="150" height="12" rx="3" className="art-ink" />
      <rect x="46" y="84" width="72" height="18" rx="5" className="art-mark" />
      <rect x="52" y="88" width="60" height="12" rx="3" className="art-ink" />
      <rect x="126" y="88" width="110" height="12" rx="3" className="art-ink" />
      <g transform="translate(250 64) rotate(-35)">
        <rect x="-10" y="-8" width="64" height="20" rx="6" className="art-pen" />
        <rect x="-26" y="-6" width="18" height="16" rx="3" className="art-pen-tip" />
      </g>
    </svg>
  )
}

function TossArt() {
  return (
    <svg viewBox="0 0 320 120" className="art art-toss">
      <defs>
        <linearGradient id="art-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="sky-top" />
          <stop offset="1" className="sky-bottom" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="46" className="art-wall" />
      <rect x="120" y="8" width="80" height="30" rx="5" fill="url(#art-sky)" className="art-window" />
      <path d="M0 46 L320 46 L320 120 L0 120 Z" className="art-floor" />
      {[-140, -70, 0, 70, 140].map((x) => (
        <line key={x} x1={160 + x * 0.2} y1="46" x2={160 + x * 1.6} y2="120" className="art-grid" />
      ))}
      {[58, 76, 104].map((y) => (
        <line key={y} x1="0" x2="320" y1={y} y2={y} className="art-grid" />
      ))}
      <path d="M150 100 Q190 6 226 52" className="art-arc" />
      <path d="M214 52 L238 52 L234 74 L218 74 Z" className="art-bin" />
      <ellipse cx="226" cy="52" rx="12" ry="4" className="art-rim-3d" />
      <polygon points="146,92 152,90 156,95 155,101 149,104 143,102 140,97 141,93" className="art-ball" />
      <path d="M110 120 C 120 104, 134 98, 144 96" className="art-finger-edge" />
      <path d="M110 120 C 120 104, 134 98, 144 96" className="art-finger" />
      <path d="M176 120 C 172 110, 162 104, 152 104" className="art-finger-edge" />
      <path d="M176 120 C 172 110, 162 104, 152 104" className="art-finger" />
    </svg>
  )
}

function DrawerArt() {
  const icons = [Pencil, PenLine, Highlighter, NotebookPen, BookOpen, GraduationCap]
  return (
    <svg viewBox="0 0 320 120" className="art art-drawer">
      <rect x="0" y="0" width="320" height="120" className="art-wood" />
      <rect x="138" y="8" width="44" height="8" rx="4" className="art-handle" />
      {icons.map((Icon, i) => {
        const x = 40 + (i % 3) * 84
        const y = 24 + Math.floor(i / 3) * 46
        return (
          <g key={i}>
            <rect x={x} y={y} width="72" height="40" rx="10" className="art-slot" />
            <circle cx={x + 36} cy={y + 20} r="15" className={`art-token lv-${i + 1}`} />
            <Icon x={x + 27} y={y + 11} width={18} height={18} className="art-icon" />
          </g>
        )
      })}
    </svg>
  )
}

// ---------- Fosforla altını çiz ----------

export function HighlightGame({ onExit }: { onExit: () => void }) {
  const today = istanbulDay()
  const [round, setRound] = useState<{ n: number; paragraph: HighlightParagraph; daily: boolean }>(() => {
    const played = readMiniRecords().highlight?.day === today
    return { n: 0, paragraph: played ? practiceParagraph() : dailyParagraph(), daily: !played }
  })
  return (
    <HighlightRound
      key={round.n}
      paragraph={round.paragraph}
      daily={round.daily}
      onExit={onExit}
      onAgain={() => setRound((r) => ({ n: r.n + 1, paragraph: practiceParagraph(r.paragraph.id), daily: false }))}
    />
  )
}

function practiceParagraph(except?: string): HighlightParagraph {
  const others = HIGHLIGHT_PARAGRAPHS.filter((p) => p.id !== except && p.id !== dailyParagraph().id)
  return others[Math.floor(Math.random() * others.length)]
}

function HighlightRound({ paragraph, daily, onExit, onAgain }: { paragraph: HighlightParagraph; daily: boolean; onExit: () => void; onAgain: () => void }) {
  const tokens = useMemo(() => parseParagraph(paragraph.text), [paragraph.text])
  const keyCount = tokens.filter((t) => t.key).length
  const [chosen, setChosen] = useState<Set<number>>(() => new Set())
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const now = useTick(startedAt !== null && !done, 100)
  const leftMs = startedAt === null ? HIGHLIGHT_SECONDS * 1000 : Math.max(0, HIGHLIGHT_SECONDS * 1000 - (now - startedAt))
  const left = Math.ceil(leftMs / 1000)
  const drag = useRef<{ on: boolean } | null>(null)
  const score = useMemo(() => scoreHighlight(tokens, chosen), [tokens, chosen])
  const [best, setBest] = useState(false)

  const finish = () => {
    if (done) return
    setDone(true)
    playSound('done')
    if (daily) {
      const rec = readMiniRecords()
      setBest(rec.highlightBest !== undefined && score.points > rec.highlightBest)
      saveMiniRecords({ highlight: { day: istanbulDay(), points: score.points, stars: score.stars }, highlightBest: Math.max(rec.highlightBest ?? 0, score.points) })
    }
  }
  useEffect(() => {
    if (startedAt !== null && leftMs === 0) finish()
  }, [leftMs, startedAt])

  const indexAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-i]')
    return el ? Number(el.dataset.i) : null
  }
  const paint = (i: number, on: boolean) =>
    setChosen((prev) => {
      if (prev.has(i) === on) return prev
      const next = new Set(prev)
      if (on) next.add(i)
      else next.delete(i)
      return next
    })
  const down = (e: ReactPointerEvent) => {
    if (done) return
    const i = indexAt(e.clientX, e.clientY)
    if (i === null) return
    if (startedAt === null) setStartedAt(Date.now())
    const on = !chosen.has(i)
    drag.current = { on }
    paint(i, on)
    if (on) playSound('flip')
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const move = (e: ReactPointerEvent) => {
    if (!drag.current || done) return
    const i = indexAt(e.clientX, e.clientY)
    if (i !== null) paint(i, drag.current.on)
  }
  const up = () => {
    drag.current = null
  }

  if (done)
    return (
      <GameFrame title="Fosforla altını çiz" onExit={onExit}>
        <GameOver
          title={daily ? 'Günün paragrafı' : 'Antrenman'}
          points={score.points}
          stars={score.stars}
          badge={score.stars === 3 ? 'Tam isabet!' : best ? 'Yeni rekor!' : undefined}
          stats={[
            ['Doğru', `${score.hits}/${score.keys}`],
            ['Kaçan', score.missed],
            ['Fazla', score.wrong],
          ]}
          note={daily ? 'Yarın yeni bir paragraf gelecek.' : 'Antrenman puanı sayılmaz.'}
          onAgain={onAgain}
          againLabel="Antrenman yap"
          onExit={onExit}
        />
        <div className="mini-paper is-done" aria-label="Paragrafın doğru cevapları">
          <h2 className="mini-paper-title">{paragraph.title}</h2>
          <p>
            {tokens.map((t) => {
              const on = chosen.has(t.index)
              const state = t.key ? (on ? 'is-hit' : 'is-missed') : on ? 'is-wrong' : ''
              return (
                <span key={t.index}>
                  <span className={`mini-word ${state}`}>{t.text}</span>
                  {t.after}{' '}
                </span>
              )
            })}
          </p>
          <p className="mini-legend">
            <span className="mini-word is-hit">doğru</span> <span className="mini-word is-missed">kaçan</span> <span className="mini-word is-wrong">fazla</span>
          </p>
        </div>
      </GameFrame>
    )

  return (
    <GameFrame
      title="Fosforla altını çiz"
      onExit={onExit}
      progress={leftMs / (HIGHLIGHT_SECONDS * 1000)}
      score={
        <>
          <Timer size={15} aria-hidden="true" /> {left} sn
        </>
      }
    >
      <div className="mini-tags">
        <span className="mini-chip is-strong">{daily ? 'Günün paragrafı' : 'Antrenman'}</span>
        <span className="mini-chip">{keyCount} önemli yer var</span>
        <span className="mini-chip">{chosen.size} çizildi</span>
      </div>
      <div className="mini-paper" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Paragraf: önemli kelimeleri seç">
        <h2 className="mini-paper-title">{paragraph.title}</h2>
        <p>
          {tokens.map((t) => {
            const on = chosen.has(t.index)
            return (
              <span key={t.index}>
                <span className={`mini-word${on ? ' is-on' : ''}`} data-i={t.index} role="checkbox" aria-checked={on}>
                  {t.text}
                </span>
                {t.after}{' '}
              </span>
            )
          })}
        </p>
      </div>
      <p className="subtle mini-help">
        <Highlighter size={14} aria-hidden="true" /> Parmağını kelimelerin üstünden geçir. Yanlış çizdiğine tekrar dokun. Süre ilk dokunuşta başlar.
      </p>
      <button className="btn btn-primary mini-wide" onClick={finish} disabled={startedAt === null}>
        Bitir
      </button>
    </GameFrame>
  )
}

// ---------- Kâğıt top (fiske) ----------

export function TossGame({ onExit }: { onExit: () => void }) {
  const [round, setRound] = useState(0)
  return <TossRound key={round} onExit={onExit} onAgain={() => setRound((n) => n + 1)} />
}

type Flight = { paper: Paper; landed: TossEnd | null }

function TossRound({ onExit, onAgain }: { onExit: () => void; onAgain: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [throwNo, setThrowNo] = useState(0)
  const [bin, setBin] = useState<Bin>(() => binForThrow(0))
  const [wind, setWind] = useState(() => randomWind(0))
  const binStart = useRef(performance.now())
  const [flight, setFlight] = useState<Flight | null>(null)
  const [pull, setPull] = useState<{ x0: number; y0: number; dx: number; dy: number } | null>(null)
  const [results, setResults] = useState<TossEnd[]>([])
  const [points, setPoints] = useState(0)
  const [marks, setMarks] = useState<Vec3[]>([])
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null)
  const [record, setRecord] = useState<{ points: number; best: boolean } | null>(null)
  const state = useRef({ results: [] as TossEnd[], points: 0 })
  const raf = useRef(0)
  const timer = useRef(0)
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      window.clearTimeout(timer.current)
    },
    [],
  )
  // A swaying bin keeps moving while you aim.
  const now = useTick(!!bin.sway && !flight && !record, 33)
  const binTime = ((flight ? performance.now() : now) - binStart.current) / 1000
  const bx = binX(bin, Math.max(0, binTime))

  const toScene = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * SCENE_W, y: ((e.clientY - rect.top) / rect.height) * SCENE_H }
  }

  const fly = (power: number, aim: number) => {
    let paper = flickLaunch(power, aim)
    setFlight({ paper, landed: null })
    playSound('flip')
    let last = performance.now()
    const tick = (t: number) => {
      let dt = Math.min(0.05, (t - last) / 1000)
      last = t
      let end: TossEnd | null = null
      while (dt > 0 && !end) {
        const step = Math.min(dt, 1 / 240)
        const r = stepPaper(paper, bin, wind, (t - binStart.current) / 1000, step)
        paper = r.paper
        end = r.end
        if (r.rim) playSound('flip')
        dt -= step
      }
      setFlight({ paper, landed: end })
      if (!end) {
        raf.current = requestAnimationFrame(tick)
        return
      }
      done(end, paper)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const done = (end: TossEnd, paper: Paper) => {
    const gained = end === 'in' ? binPoints(bin) : 0
    playSound(end === 'in' ? 'right' : 'wrong')
    setFlash(end === 'in' ? { text: `+${gained}`, good: true } : { text: 'Iska', good: false })
    if (end === 'out') setMarks((m) => [...m.slice(-2), { x: paper.x, y: 0, z: paper.z }])
    timer.current = window.setTimeout(() => {
      const results = [...state.current.results, end]
      const total = state.current.points + gained
      state.current = { results, points: total }
      setResults(results)
      setPoints(total)
      setFlash(null)
      setFlight(null)
      if (results.length >= TOSS_THROWS) {
        const before = readMiniRecords().toss
        saveMiniRecords({ toss: Math.max(before ?? 0, total) })
        setRecord({ points: total, best: before !== undefined && total > before })
        playSound('done')
        return
      }
      const next = results.length
      setThrowNo(next)
      setBin(binForThrow(next))
      setWind(randomWind(next))
      setMarks([])
      binStart.current = performance.now()
    }, 900)
  }

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (flight || record) return
    const p = toScene(e)
    setPull({ x0: p.x, y0: p.y, dx: 0, dy: 0 })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pull) return
    const p = toScene(e)
    setPull({ ...pull, dx: p.x - pull.x0, dy: p.y - pull.y0 })
  }
  const up = () => {
    if (!pull) return
    const power = powerFromPull(pull.dy)
    const aim = aimFromPull(pull.dx)
    setPull(null)
    if (power >= 0.04) fly(power, aim)
  }

  if (record)
    return (
      <GameFrame title="Kâğıt top" onExit={onExit}>
        <GameOver
          title="Tur bitti"
          points={record.points}
          badge={record.best ? 'Yeni rekor!' : results.every((r) => r === 'in') ? 'Hepsi içeride!' : undefined}
          stats={[
            ['İsabet', `${results.filter((r) => r === 'in').length}/${TOSS_THROWS}`],
            ['Rekor', Math.max(readMiniRecords().toss ?? 0, record.points)],
          ]}
          note="Uzak kova +1, kayan kova +1 puan."
          onAgain={onAgain}
          onExit={onExit}
        />
      </GameFrame>
    )

  const power = pull ? powerFromPull(pull.dy) : 0
  const aim = pull ? aimFromPull(pull.dx) : 0
  const paper = flight?.paper ?? null
  const behindBin = !!paper && paper.z > bin.z
  const showPaper = !flight || flight.landed !== 'in'

  return (
    <GameFrame title="Kâğıt top" onExit={onExit} score={`${points} puan`}>
      <div className="toss-hud">
        <ol className="toss-dots" aria-label={`Atış ${Math.min(throwNo + 1, TOSS_THROWS)}/${TOSS_THROWS}`}>
          {Array.from({ length: TOSS_THROWS }, (_, i) => (
            <li key={i} className={results[i] === 'in' ? 'is-in' : results[i] === 'out' ? 'is-out' : i === results.length ? 'is-now' : ''} />
          ))}
        </ol>
        <span className="mini-chip toss-wind-chip">
          <Wind size={14} aria-hidden="true" /> {wind === 0 ? 'Rüzgâr yok' : `${wind > 0 ? '→' : '←'} ${Math.ceil(Math.abs(wind) / 0.35)}`}
        </span>
      </div>
      <p className="toss-tags">
        {bin.z > 3.6 && <span className="mini-chip">Uzak +1</span>}
        {!!bin.sway && <span className="mini-chip">Kayıyor +1</span>}
      </p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        className="toss-scene"
        role="img"
        aria-label="Parmağını aşağı çekip bırak: fiske"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setPull(null)}
      >
        <TossRoom wind={wind} />
        {marks.map((m, i) => {
          const p = project(m)
          return <ellipse key={i} cx={p.x} cy={p.y} rx={PAPER_R * p.scale * 1.4} ry={PAPER_R * p.scale * 0.5} className="toss-mark" />
        })}
        {pull && power > 0 && <AimLine aim={aim} />}
        {paper && behindBin && showPaper && <PaperBall paper={paper} />}
        <BinShape x={bx} z={bin.z} />
        {paper && !behindBin && showPaper && <PaperBall paper={paper} />}
        {!flight && <PaperBall paper={PAPER_START} />}
        <Hand tension={power} flicked={!!flight} />
        {pull && (
          <g className="toss-power" aria-hidden="true">
            <rect x="18" y="300" width="16" height="200" rx="8" className="toss-power-bg" />
            <rect x="18" y={300 + 200 * (1 - power)} width="16" height={200 * power} rx="8" className="toss-power-fill" />
            <text x="26" y="290" textAnchor="middle">
              Güç
            </text>
          </g>
        )}
        {!flight && !pull && results.length === 0 && (
          <text x={SCENE_W / 2} y="320" textAnchor="middle" className="toss-hint">
            Dokun, aşağı çek, bırak
          </text>
        )}
        {flash && (
          <text x={SCENE_W / 2} y="96" textAnchor="middle" className={`toss-flash ${flash.good ? 'is-good' : 'is-bad'}`}>
            {flash.text}
          </text>
        )}
      </svg>
      <p className="subtle mini-help">
        <Trash2 size={14} aria-hidden="true" /> Ekrana dokun, parmağını aşağı çek (güç) ve sağa sola kaydır (yön), bırak. Iskaladığın yer yerde iz bırakır.
      </p>
    </GameFrame>
  )
}

/** The room: wall with a window and a wind flag, a floor with lines that meet in the distance. */
function TossRoom({ wind }: { wind: number }) {
  const floorTop = project({ x: 0, y: 0, z: 9 }).y
  const across = [1.2, 1.8, 2.6, 3.6, 5, 7]
  const lengthwise = [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4]
  const flag = Math.max(-1, Math.min(1, wind / 1.4))
  return (
    <g>
      <defs>
        <linearGradient id="toss-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="sky-top" />
          <stop offset="1" className="sky-bottom" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={SCENE_W} height={floorTop} className="toss-wall" />
      <rect x="0" y={floorTop} width={SCENE_W} height={SCENE_H - floorTop} className="toss-floor" />
      <rect x="110" y="40" width="140" height="92" rx="8" fill="url(#toss-sky)" className="toss-window" />
      <ellipse cx="150" cy="78" rx="22" ry="8" className="toss-cloud" />
      <ellipse cx="166" cy="73" rx="14" ry="8" className="toss-cloud" />
      <line x1="180" y1="40" x2="180" y2="132" className="toss-frame" />
      <g transform="translate(232 54)">
        <line x1="0" y1="0" x2="0" y2="40" className="toss-pole" />
        {wind !== 0 && <path d={`M0 2 L${flag * 28} ${6 + (1 - Math.abs(flag)) * 8} L0 14 Z`} className="toss-flag" />}
      </g>
      <line x1="0" y1={floorTop} x2={SCENE_W} y2={floorTop} className="toss-floor-line" />
      {across.map((z) => {
        const l = project({ x: -6, y: 0, z })
        const r = project({ x: 6, y: 0, z })
        return <line key={z} x1={l.x} y1={l.y} x2={r.x} y2={r.y} className="toss-grid" />
      })}
      {lengthwise.map((x) => {
        const near = project({ x, y: 0, z: 0.4 })
        const far = project({ x, y: 0, z: 9 })
        return <line key={x} x1={near.x} y1={near.y} x2={far.x} y2={far.y} className="toss-grid" />
      })}
    </g>
  )
}

function BinShape({ x, z }: { x: number; z: number }) {
  const rim = project({ x, y: BIN_TALL, z })
  const base = project({ x, y: 0, z })
  const rx = BIN_R * rim.scale
  const ry = rx * 0.32
  const bx = BIN_R * 0.78 * base.scale
  const by = bx * 0.3
  return (
    <g className="toss-bin3d">
      <ellipse cx={base.x} cy={base.y + by * 0.4} rx={bx * 1.35} ry={by * 1.3} className="toss-shadow" />
      <path d={`M${rim.x - rx} ${rim.y} L${base.x - bx} ${base.y} A${bx} ${by} 0 0 0 ${base.x + bx} ${base.y} L${rim.x + rx} ${rim.y} Z`} className="toss-bin" />
      {[-0.45, 0, 0.45].map((f) => (
        <line key={f} x1={rim.x + rx * f} y1={rim.y + ry * 0.9} x2={base.x + bx * f} y2={base.y + by * 0.8} className="toss-rib" />
      ))}
      <ellipse cx={rim.x} cy={rim.y} rx={rx} ry={ry} className="toss-hole" />
      <ellipse cx={rim.x} cy={rim.y} rx={rx} ry={ry} className="toss-rim" />
    </g>
  )
}

function PaperBall({ paper }: { paper: Vec3 }) {
  const p = project(paper)
  const r = PAPER_R * p.scale
  const shadow = project({ x: paper.x, y: 0, z: paper.z })
  const k = r / 13
  return (
    <g>
      <ellipse cx={shadow.x} cy={shadow.y} rx={r * 0.9} ry={r * 0.3} className="toss-shadow" />
      <g transform={`translate(${p.x} ${p.y}) scale(${k})`} className="toss-ball">
        <polygon points="0,-13 7,-11 12,-5 13,2 9,9 2,13 -6,11 -12,6 -13,-2 -9,-9" />
        <path d="M-9 -6 L-2 -1 L-4 7 M-2 -1 L6 -8 M-2 -1 L9 4" />
      </g>
    </g>
  )
}

/** Dots on the floor in the direction of the aim (they show direction, not distance). */
function AimLine({ aim }: { aim: number }) {
  const yaw = aim * MAX_YAW
  const dots = [0.5, 0.95, 1.4, 1.85, 2.3, 2.75, 3.2, 3.65, 4.1]
  return (
    <g aria-hidden="true">
      {dots.map((d) => {
        const p = project({ x: Math.sin(yaw) * d, y: 0, z: Math.cos(yaw) * d })
        return <circle key={d} cx={p.x} cy={p.y} r={Math.max(2, 0.03 * p.scale)} className="toss-aim" />
      })}
    </g>
  )
}

/**
 * The flicking hand, as thick cartoon fingers: the thumb holds the curled middle finger under the
 * paper; pulling bends it further, letting go snaps it straight.
 */
function Hand({ tension, flicked }: { tension: number; flicked: boolean }) {
  const t = tension * 16
  const middle = flicked ? 'M262 600 C 250 520, 214 430, 188 368' : `M262 600 C 258 540, 236 ${468 + t}, 206 ${452 + t} C 192 ${446 + t}, 180 ${438 + t}, 176 ${428 + t * 0.6}`
  const fingers = ['M300 600 C 300 540, 306 490, 318 452', 'M330 600 C 334 556, 344 520, 356 492']
  const thumb = flicked ? 'M96 600 C 120 540, 150 492, 172 468' : `M96 600 C 120 540, 150 ${486 + t * 0.4}, 176 ${450 + t * 0.6}`
  return (
    <g className={`toss-hand${flicked ? ' is-flicked' : ''}`} transform="translate(0 30)" aria-hidden="true">
      {fingers.map((d) => (
        <g key={d}>
          <path d={d} className="finger-edge" />
          <path d={d} className="finger" />
        </g>
      ))}
      <path d="M220 600 C 230 560, 300 548, 360 556 L360 600 Z" className="palm" />
      <path d={middle} className="finger-edge" />
      <path d={middle} className="finger" />
      <path d={thumb} className="finger-edge" />
      <path d={thumb} className="finger" />
      {flicked && <path d="M170 350 l-14 -10 M190 344 l0 -16 M210 350 l14 -10" className="snap" />}
    </g>
  )
}

// ---------- Çekmece ----------

const ITEM_ICONS = [Pencil, PenLine, Highlighter, NotebookPen, BookOpen, ScrollText, GraduationCap, Award]

export function DrawerGame({ onExit }: { onExit: () => void }) {
  const [round, setRound] = useState(0)
  return <DrawerRound key={round} onExit={onExit} onAgain={() => setRound((n) => n + 1)} />
}

function DrawerRound({ onExit, onAgain }: { onExit: () => void; onAgain: () => void }) {
  const [grid, setGrid] = useState<Drawer>(() => newDrawer())
  const [selected, setSelected] = useState<number | null>(null)
  const [points, setPoints] = useState(0)
  const [pop, setPop] = useState<number | null>(null)
  const [startedAt] = useState(() => Date.now())
  const [end, setEnd] = useState<{ reason: 'time' | 'full' | 'diploma'; best: boolean } | null>(null)
  const now = useTick(!end, 250)
  const leftMs = Math.max(0, DRAWER_SECONDS * 1000 - (now - startedAt))
  const left = Math.ceil(leftMs / 1000)
  const top = bestLevel(grid)

  const finish = (reason: 'time' | 'full' | 'diploma', g = grid, p = points) => {
    if (end) return
    const rec = readMiniRecords()
    saveMiniRecords({ drawer: Math.max(rec.drawer ?? 0, p), drawerLevel: Math.max(rec.drawerLevel ?? 0, bestLevel(g)) })
    setEnd({ reason, best: rec.drawer !== undefined && p > rec.drawer })
    playSound('done')
  }
  useEffect(() => {
    if (leftMs === 0) finish('time')
  }, [leftMs])

  const after = (next: Drawer, gained: number) => {
    const spawned = spawnItem(next)
    const total = points + gained
    setGrid(spawned)
    setPoints(total)
    setSelected(null)
    if (bestLevel(spawned) >= DRAWER_MAX) finish('diploma', spawned, total)
    else if (drawerStuck(spawned)) finish('full', spawned, total)
  }

  const tap = (i: number) => {
    if (end) return
    if (selected === null) {
      if (grid[i] !== null) setSelected(i)
      return
    }
    if (selected === i) return setSelected(null)
    if (canMerge(grid, selected, i)) {
      const merged = mergeItems(grid, selected, i)!
      playSound('right')
      setPop(i)
      window.setTimeout(() => setPop(null), 350)
      after(merged.grid, merged.points)
      return
    }
    if (grid[i] === null) {
      // Moving an item is allowed, but the drawer gets a new one too.
      const moved = [...grid]
      moved[i] = moved[selected]
      moved[selected] = null
      playSound('flip')
      after(moved, 0)
      return
    }
    playSound('wrong')
    setSelected(i)
  }

  if (end)
    return (
      <GameFrame title="Çekmece" onExit={onExit}>
        <GameOver
          title={end.reason === 'time' ? 'Süre doldu' : end.reason === 'full' ? 'Çekmece doldu' : 'Diploma senin!'}
          points={points}
          badge={end.reason === 'diploma' ? 'Kurşun kalemden diplomaya!' : end.best ? 'Yeni rekor!' : undefined}
          stats={[
            ['En iyi eşya', DRAWER_ITEMS[top - 1]],
            ['Rekor', Math.max(readMiniRecords().drawer ?? 0, points)],
          ]}
          onAgain={onAgain}
          onExit={onExit}
        />
      </GameFrame>
    )

  const selectedLevel = selected !== null ? grid[selected] : null
  return (
    <GameFrame
      title="Çekmece"
      onExit={onExit}
      progress={leftMs / (DRAWER_SECONDS * 1000)}
      score={
        <>
          <Timer size={15} aria-hidden="true" /> {left} sn · {points}
        </>
      }
    >
      <p className="drawer-status" aria-live="polite">
        {selectedLevel ? (
          <>
            <strong>{DRAWER_ITEMS[selectedLevel - 1]}</strong> seçili: aynısına dokun
          </>
        ) : (
          'Bir eşyaya, sonra aynısına dokun'
        )}
      </p>
      <div className="drawer-box">
        <span className="drawer-handle" aria-hidden="true" />
        <div className="drawer-grid" role="grid" aria-label="Çekmece">
          {grid.map((level, i) => {
            const Icon = level ? ITEM_ICONS[level - 1] : null
            const name = level ? DRAWER_ITEMS[level - 1] : 'Boş'
            const match = selectedLevel !== null && selected !== i && level === selectedLevel && level < DRAWER_MAX
            return (
              <button
                key={i}
                className={`drawer-slot${selected === i ? ' is-selected' : ''}${match ? ' is-match' : ''}${pop === i ? ' is-pop' : ''}`}
                onClick={() => tap(i)}
                aria-label={`${name}${selected === i ? ', seçili' : ''}`}
              >
                {Icon && level && (
                  <span className={`drawer-token lv-${level}`}>
                    <Icon size={24} aria-hidden="true" />
                    <span className="drawer-lv">{level}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <button className="btn mini-wide" onClick={() => !end && grid.includes(null) && after(grid, 0)} disabled={!grid.includes(null)}>
        <Plus size={16} /> Yeni eşya düşür
      </button>
      <ol className="drawer-path" aria-label="Eşya sırası">
        {ITEM_ICONS.map((Icon, i) => (
          <li key={i} className={top > i ? 'is-reached' : ''} title={DRAWER_ITEMS[i]}>
            <span className={`drawer-token lv-${i + 1}`}>
              <Icon size={16} aria-hidden="true" />
            </span>
          </li>
        ))}
      </ol>
      <p className="subtle drawer-path-label">
        <Trophy size={14} aria-hidden="true" /> En iyi: <strong>{top ? DRAWER_ITEMS[top - 1] : '—'}</strong> · Hedef: Diploma
      </p>
    </GameFrame>
  )
}

