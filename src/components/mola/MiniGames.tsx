import { ArrowLeft, Award, BookOpen, Crown, GraduationCap, Highlighter, NotebookPen, Pencil, PenLine, Play, Plus, RotateCcw, ScrollText, Star, Timer, Trash2, Trophy, Wind } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  aimDots,
  BALL_R,
  BALL_START,
  BIN,
  bestLevel,
  canMerge,
  dailyParagraph,
  DRAWER_ITEMS,
  DRAWER_MAX,
  DRAWER_SECONDS,
  drawerStuck,
  HIGHLIGHT_PARAGRAPHS,
  HIGHLIGHT_SECONDS,
  istanbulDay,
  launchFromPull,
  MAX_PULL,
  mergeItems,
  newDrawer,
  parseParagraph,
  randomWind,
  readMiniRecords,
  saveMiniRecords,
  scoreHighlight,
  spawnItem,
  stepBall,
  TOSS_H,
  TOSS_THROWS,
  TOSS_W,
  tossPoints,
  type Ball,
  type Drawer,
  type HighlightParagraph,
  type TossEnd,
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
          text="Kâğıdı geri çek, bırak, çöpe at. Rüzgâr her atışta değişir."
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
      <rect x="0" y="0" width="320" height="120" fill="url(#art-sky)" />
      <ellipse cx="70" cy="30" rx="26" ry="10" className="art-cloud" />
      <ellipse cx="90" cy="26" rx="18" ry="10" className="art-cloud" />
      <rect x="0" y="100" width="320" height="20" className="art-floor" />
      <path d="M48 92 Q140 -6 236 58" className="art-arc" />
      <polygon points="48,82 55,80 59,86 58,93 52,97 45,95 41,89 43,84" className="art-ball" />
      <path d="M222 58 L262 58 L256 102 L228 102 Z" className="art-bin" />
      <line x1="218" x2="266" y1="58" y2="58" className="art-rim" />
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

// ---------- Kâğıt top ----------

export function TossGame({ onExit }: { onExit: () => void }) {
  const [round, setRound] = useState(0)
  return <TossRound key={round} onExit={onExit} onAgain={() => setRound((n) => n + 1)} />
}

function TossRound({ onExit, onAgain }: { onExit: () => void; onAgain: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [ball, setBall] = useState<Ball>({ ...BALL_START, vx: 0, vy: 0 })
  const [flying, setFlying] = useState(false)
  const [pull, setPull] = useState<{ dx: number; dy: number } | null>(null)
  const [wind, setWind] = useState(() => randomWind())
  const [results, setResults] = useState<TossEnd[]>([])
  const resultsRef = useRef<TossEnd[]>([])
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null)
  const [record, setRecord] = useState<{ points: number; best: boolean } | null>(null)
  const windRef = useRef(wind)
  windRef.current = wind
  const raf = useRef(0)
  const flashTimer = useRef(0)
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      window.clearTimeout(flashTimer.current)
    },
    [],
  )

  const points = tossPoints(results)
  const hits = results.filter((r) => r === 'in').length

  const toScene = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * TOSS_W, y: ((e.clientY - rect.top) / rect.height) * TOSS_H }
  }

  const throwBall = (vx: number, vy: number) => {
    setFlying(true)
    let current: Ball = { ...BALL_START, vx, vy }
    let last = performance.now()
    const tick = (t: number) => {
      let dt = Math.min(0.05, (t - last) / 1000)
      last = t
      let end: TossEnd | null = null
      let rim = false
      // Small fixed steps, so a fast ball cannot pass through the rim between two frames.
      while (dt > 0 && !end) {
        const step = Math.min(dt, 1 / 240)
        const r = stepBall(current, windRef.current, step)
        current = r.ball
        end = r.end
        rim = rim || r.rim
        dt -= step
      }
      setBall(current)
      if (rim) playSound('flip')
      if (!end) {
        raf.current = requestAnimationFrame(tick)
        return
      }
      landed(end)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const landed = (end: TossEnd) => {
    playSound(end === 'in' ? 'right' : 'wrong')
    setFlash(end === 'in' ? { text: 'Girdi!', good: true } : { text: 'Iska', good: false })
    flashTimer.current = window.setTimeout(() => {
      const next = [...resultsRef.current, end]
      resultsRef.current = next
      setResults(next)
      if (next.length >= TOSS_THROWS) {
        const total = tossPoints(next)
        const before = readMiniRecords().toss
        saveMiniRecords({ toss: Math.max(before ?? 0, total) })
        setRecord({ points: total, best: before !== undefined && total > before })
        playSound('done')
      }
      setFlash(null)
      setFlying(false)
      setBall({ ...BALL_START, vx: 0, vy: 0 })
      setWind(randomWind())
    }, 800)
  }

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (flying || record) return
    const p = toScene(e)
    if (Math.hypot(p.x - BALL_START.x, p.y - BALL_START.y) > 80) return
    setPull({ dx: 0, dy: 0 })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pull) return
    const p = toScene(e)
    setPull({ dx: p.x - BALL_START.x, dy: p.y - BALL_START.y })
  }
  const up = () => {
    if (!pull) return
    const launch = launchFromPull(pull.dx, pull.dy)
    setPull(null)
    if (launch) throwBall(launch.vx, launch.vy)
  }

  if (record)
    return (
      <GameFrame title="Kâğıt top" onExit={onExit}>
        <GameOver
          title="Tur bitti"
          points={record.points}
          badge={record.best ? 'Yeni rekor!' : hits === TOSS_THROWS ? 'Hepsi içeride!' : undefined}
          stats={[
            ['İsabet', `${hits}/${TOSS_THROWS}`],
            ['Rekor', Math.max(readMiniRecords().toss ?? 0, record.points)],
          ]}
          note="Üst üste üç ve fazlası iki puan sayılır."
          onAgain={onAgain}
          onExit={onExit}
        />
      </GameFrame>
    )

  // While pulling: the ball follows the finger (up to the limit) and dots show the start of the flight.
  const pullLen = pull ? Math.hypot(pull.dx, pull.dy) : 0
  const shown = pull && pullLen > 0 ? { x: BALL_START.x + (pull.dx / pullLen) * Math.min(pullLen, MAX_PULL) * 0.35, y: BALL_START.y + (pull.dy / pullLen) * Math.min(pullLen, MAX_PULL) * 0.35 } : ball
  const aim = pull ? launchFromPull(pull.dx, pull.dy) : null
  const windSteps = Math.ceil(Math.abs(wind) / 40)
  const flagSkew = Math.max(-1, Math.min(1, wind / 160))

  return (
    <GameFrame
      title="Kâğıt top"
      onExit={onExit}
      score={`${points} puan`}
    >
      <div className="toss-hud">
        <ol className="toss-dots" aria-label={`Atış ${Math.min(results.length + 1, TOSS_THROWS)}/${TOSS_THROWS}`}>
          {Array.from({ length: TOSS_THROWS }, (_, i) => (
            <li key={i} className={results[i] === 'in' ? 'is-in' : results[i] === 'out' ? 'is-out' : i === results.length ? 'is-now' : ''} />
          ))}
        </ol>
        <span className="mini-chip toss-wind-chip">
          <Wind size={14} aria-hidden="true" /> {wind === 0 ? 'Rüzgâr yok' : `${wind > 0 ? '→' : '←'} ${windSteps}`}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        Atış {Math.min(results.length + 1, TOSS_THROWS)}/{TOSS_THROWS} · {points} puan
      </p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${TOSS_W} ${TOSS_H}`}
        className="toss-scene"
        role="img"
        aria-label="Kâğıdı geri çekip bırak"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setPull(null)}
      >
        <defs>
          <linearGradient id="toss-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="sky-top" />
            <stop offset="1" className="sky-bottom" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={TOSS_W} height={TOSS_H} className="toss-wall" />
        {/* Window with the sky, and a flag that shows the wind. */}
        <rect x="40" y="40" width="280" height="170" rx="10" fill="url(#toss-sky)" className="toss-window" />
        <ellipse cx="110" cy="92" rx="34" ry="12" className="toss-cloud" />
        <ellipse cx="134" cy="86" rx="22" ry="12" className="toss-cloud" />
        <ellipse cx="250" cy="140" rx="28" ry="10" className="toss-cloud" />
        <line x1="180" y1="40" x2="180" y2="210" className="toss-frame" />
        <line x1="40" y1="125" x2="320" y2="125" className="toss-frame" />
        <g transform="translate(286 70)">
          <line x1="0" y1="0" x2="0" y2="52" className="toss-pole" />
          {wind !== 0 && <path d={`M0 2 L${flagSkew * 34} ${8 + (1 - Math.abs(flagSkew)) * 10} L0 18 Z`} className="toss-flag" />}
        </g>
        <rect x="0" y={BIN.bottom} width={TOSS_W} height={TOSS_H - BIN.bottom} className="toss-floor" />
        <line x1="0" y1={BIN.bottom} x2={TOSS_W} y2={BIN.bottom} className="toss-floor-line" />
        <ellipse cx={(BIN.left + BIN.right) / 2} cy={BIN.bottom + 4} rx="40" ry="6" className="toss-shadow" />
        <path d={`M${BIN.left - 4} ${BIN.rim} L${BIN.right + 4} ${BIN.rim} L${BIN.right - 3} ${BIN.bottom} L${BIN.left + 3} ${BIN.bottom} Z`} className="toss-bin" />
        {[0.3, 0.5, 0.7].map((f) => (
          <line key={f} x1={BIN.left + (BIN.right - BIN.left) * f} y1={BIN.rim + 10} x2={BIN.left + (BIN.right - BIN.left) * f} y2={BIN.bottom - 8} className="toss-rib" />
        ))}
        <line x1={BIN.left - 7} y1={BIN.rim} x2={BIN.right + 7} y2={BIN.rim} className="toss-rim" />
        {aim && aimDots(aim.vx, aim.vy).map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={4 - i * 0.3} className="toss-aim" />)}
        {pull && pullLen > 0 && <line x1={BALL_START.x} y1={BALL_START.y} x2={shown.x} y2={shown.y} className="toss-band" />}
        {!flying && <ellipse cx={BALL_START.x} cy={BIN.bottom + 3} rx="14" ry="4" className="toss-shadow" />}
        <g transform={`translate(${shown.x} ${shown.y})`} className="toss-ball">
          <polygon points="0,-13 7,-11 12,-5 13,2 9,9 2,13 -6,11 -12,6 -13,-2 -9,-9" />
          <path d="M-9 -6 L-2 -1 L-4 7 M-2 -1 L6 -8 M-2 -1 L9 4" />
        </g>
        {!flying && !pull && results.length === 0 && (
          <g className="toss-hint">
            <circle cx={BALL_START.x} cy={BALL_START.y} r="26" className="toss-hint-ring" />
            <text x={BALL_START.x + 34} y={BALL_START.y - 44}>
              Geri çek, bırak
            </text>
          </g>
        )}
        {flash && (
          <text x={TOSS_W / 2} y="290" textAnchor="middle" className={`toss-flash ${flash.good ? 'is-good' : 'is-bad'}`}>
            {flash.text}
          </text>
        )}
      </svg>
      <p className="subtle mini-help">
        <Trash2 size={14} aria-hidden="true" /> Kâğıda dokun, sapan gibi geri ve aşağı çek, bırak. Noktalar yönü gösterir; rüzgârı sen hesapla.
      </p>
    </GameFrame>
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

