import { ArrowLeft, Award, BookOpen, Crown, GraduationCap, Highlighter, NotebookPen, Pencil, PenLine, Play, Plus, RotateCcw, ScrollText, Sparkles, Star, Timer, Trash2, Trophy, Wind } from 'lucide-react'
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

// ---------- Shared 3D Arcade Frame ----------

/** Top bar of a game: 3D keycap back button, title, and extruded score badge; 3D tube bar under it. */
function GameFrame({ title, subtitle, onExit, score, progress, children }: { title: string; subtitle?: string; onExit: () => void; score?: ReactNode; progress?: number; children: ReactNode }) {
  return (
    <div className="page page-narrow mini-page">
      <div className="mini-bar">
        <button className="mini-back" onClick={onExit} aria-label="Oyunlara dön">
          <ArrowLeft size={20} />
        </button>
        <div className="mini-bar-titles">
          <strong className="mini-bar-title">{title}</strong>
          {subtitle && <span className="mini-bar-sub">{subtitle}</span>}
        </div>
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

/** End of a round: 3D trophy plaque, big extruded score, stat tiles, play again or return. */
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
      <div className="mini-over-medal" aria-hidden="true">
        <Trophy size={26} />
      </div>
      <span className="mini-over-label">{title}</span>
      <strong className="mini-over-points">
        {points} <small>{unit}</small>
      </strong>
      {stars !== undefined && <Stars n={stars} size={32} />}
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
        <button className="btn btn-primary mini-btn-3d" onClick={onAgain}>
          <RotateCcw size={16} /> {againLabel}
        </button>
        <button className="btn mini-btn-3d-sec" onClick={onExit}>
          Oyunlara dön
        </button>
      </div>
    </div>
  )
}

// ---------- Hub (3D Study Desk Arcade) ----------

export function MiniHub({ onOpen, onExit }: { onOpen: (game: MiniGame) => void; onExit: () => void }) {
  const records = readMiniRecords()
  const playedToday = records.highlight?.day === istanbulDay()
  return (
    <div className="page page-narrow mini-page">
      <div className="mini-hub-banner">
        <div className="mini-hub-head">
          <button className="mini-back" onClick={onExit} aria-label="Molaya dön">
            <ArrowLeft size={20} />
          </button>
          <div className="mini-hub-title-wrap">
            <h1>
              Masaüstü <span className="hl">mini oyunlar</span>
            </h1>
            <p className="muted mini-hub-sub">Kart gerekmez. İki dakikalık 3B masa oyunlarıyla kafanı dağıt, derse taze dön.</p>
          </div>
          <span className="mini-vip">
            <Crown size={14} aria-hidden="true" /> VIP
          </span>
        </div>
      </div>

      <div className="mini-cards">
        <GameCard
          tag="GÜNLÜK ODAK"
          art={<HighlightArt />}
          title="Fosforla altını çiz"
          text="3B telli defterde günün paragrafındaki anahtar yerleri fosforlu kalemle yakala. Fazlasını çizersen puan düşer."
          chips={[playedToday ? `Bugün: ${records.highlight!.points} puan` : 'Günün paragrafı hazır', `${HIGHLIGHT_SECONDS} sn`]}
          done={playedToday}
          onOpen={() => onOpen('altini-ciz')}
        />
        <GameCard
          tag="3B FİZİK & NİŞAN"
          art={<TossArt />}
          title="Kâğıt top"
          text="Buruşuk kâğıdı çalışma masasından karşıdaki tel kovaya fiskele. Rüzgârı hesapla, uzak ve kayan kovaları vur."
          chips={[records.toss !== undefined ? `Rekor: ${records.toss} puan` : 'Rekor yok', `${TOSS_THROWS} atış`]}
          onOpen={() => onOpen('kagit-top')}
        />
        <GameCard
          tag="3B BİRLEŞTİRME"
          art={<DrawerArt />}
          title="Çekmece"
          text="Ahşap çalışma çekmecesindeki eşyaları eşleştirip seviye atlat. Kurşun kalemden diplomaya kadar çık!"
          chips={[records.drawer !== undefined ? `Rekor: ${records.drawer} puan` : 'Rekor yok', `${DRAWER_SECONDS / 60} dakika`]}
          onOpen={() => onOpen('cekmece')}
        />
      </div>
    </div>
  )
}

function GameCard({ tag, art, title, text, chips, done, onOpen }: { tag: string; art: ReactNode; title: string; text: string; chips: string[]; done?: boolean; onOpen: () => void }) {
  return (
    <article className="mini-card" onClick={onOpen}>
      <div className="mini-card-art" aria-hidden="true">
        <span className="mini-card-tag">{tag}</span>
        {art}
      </div>
      <div className="mini-card-body">
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        <div className="mini-card-foot">
          <div className="mini-chips">
            {chips.map((c) => (
              <span key={c} className="mini-chip">
                {c}
              </span>
            ))}
          </div>
          <button
            className="btn btn-primary mini-play"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            aria-label={title}
          >
            <Play size={16} /> {done ? 'Antrenman' : 'Oyna'}
          </button>
        </div>
      </div>
    </article>
  )
}

/** 3D Isometric Spiral Notebook & Floating Chisel Highlighter Diorama */
function HighlightArt() {
  return (
    <svg viewBox="0 0 360 150" className="art art-highlight">
      <defs>
        <linearGradient id="hl-desk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--surface-2)" />
          <stop offset="1" stopColor="var(--border)" />
        </linearGradient>
        <linearGradient id="hl-pen-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff380" />
          <stop offset="0.5" stopColor="var(--hi)" />
          <stop offset="1" stopColor="#e0b800" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="360" height="150" fill="url(#hl-desk)" />
      {/* Isometric 3D desk grid */}
      <g className="art-grid" opacity="0.55">
        {[40, 90, 140, 190, 240, 290, 340].map((x) => (
          <line key={x} x1={x} y1="0" x2={x - 30} y2="150" />
        ))}
        {[35, 75, 115].map((y) => (
          <line key={y} x1="0" y1={y} x2="360" y2={y} />
        ))}
      </g>
      {/* 3D Stacked Notebook Pages with perspective drop */}
      <g transform="translate(36 16) rotate(-3)">
        <rect x="6" y="10" width="236" height="114" rx="12" className="art-page-shadow" />
        <rect x="3" y="5" width="236" height="114" rx="12" className="art-page-stack" />
        <rect x="0" y="0" width="236" height="114" rx="12" className="art-paper" />
        {/* 3D Spiral Rings */}
        {[24, 52, 80, 108, 136, 164, 192, 214].map((x) => (
          <g key={x} transform={`translate(${x} -5)`}>
            <circle cx="0" cy="11" r="3.2" className="art-hole" />
            <rect x="-2.5" y="0" width="5" height="13" rx="2.5" className="art-ring" />
          </g>
        ))}
        {/* Red margin & ruled lines */}
        <line x1="28" y1="14" x2="28" y2="110" className="art-margin" />
        {[34, 56, 78, 100].map((y) => (
          <line key={y} x1="12" y1={y} x2="224" y2={y} className="art-rule" />
        ))}
        {/* 3D Glowing Highlighter Bands & Words */}
        <rect x="38" y="21" width="66" height="10" rx="3" className="art-ink" />
        <rect x="110" y="18" width="94" height="15" rx="4" className="art-mark-3d" />
        <rect x="114" y="21" width="86" height="10" rx="3" className="art-ink-dark" />

        <rect x="38" y="43" width="112" height="10" rx="3" className="art-ink" />
        <rect x="156" y="43" width="52" height="10" rx="3" className="art-ink" />

        <rect x="36" y="62" width="88" height="15" rx="4" className="art-mark-3d" />
        <rect x="40" y="65" width="80" height="10" rx="3" className="art-ink-dark" />
        <rect x="130" y="65" width="76" height="10" rx="3" className="art-ink" />

        <rect x="38" y="87" width="144" height="10" rx="3" className="art-ink" />
      </g>
      {/* Floating 3D Chisel Highlighter Pen */}
      <g transform="translate(262 76) rotate(-32)">
        <ellipse cx="10" cy="42" rx="44" ry="8" className="art-shadow-soft" />
        {/* Chisel nib */}
        <polygon points="-38,2 -22,-6 -22,10 -36,10" className="art-pen-nib" />
        {/* Collar */}
        <rect x="-24" y="-8" width="16" height="20" rx="3" className="art-pen-tip" />
        {/* 3D Barrel */}
        <rect x="-10" y="-13" width="78" height="30" rx="8" fill="url(#hl-pen-body)" className="art-pen-barrel" />
        <rect x="-4" y="-9" width="66" height="6" rx="3" fill="#ffffff" opacity="0.65" />
        {/* End cap */}
        <rect x="64" y="-13" width="14" height="30" rx="5" className="art-pen-tip" />
      </g>
      {/* Floating +10 score badge */}
      <g transform="translate(292 26)">
        <rect x="-24" y="-12" width="48" height="24" rx="8" className="art-score-pill" />
        <text x="0" y="5" textAnchor="middle" className="art-score-text">
          +10
        </text>
      </g>
    </svg>
  )
}

/** 3D Perspective Study Room & Cylindrical Mesh Bin Diorama */
function TossArt() {
  return (
    <svg viewBox="0 0 360 150" className="art art-toss">
      <defs>
        <linearGradient id="art-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="sky-top" />
          <stop offset="1" className="sky-bottom" />
        </linearGradient>
        <linearGradient id="art-sunbeam" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#ffe14d" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffe14d" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Back wall & side wall corner */}
      <rect x="0" y="0" width="360" height="64" className="art-wall" />
      <polygon points="0,0 44,0 44,64 0,94" className="art-wall-side" />
      {/* 3D Perspective Floor */}
      <polygon points="0,64 360,64 360,150 0,150" className="art-floor" />
      {[-160, -100, -45, 0, 45, 100, 160].map((x) => (
        <line key={x} x1={180 + x * 0.25} y1="64" x2={180 + x * 1.65} y2="150" className="art-grid" />
      ))}
      {[78, 98, 124].map((y) => (
        <line key={y} x1="0" y1={y} x2="360" y2={y} className="art-grid" />
      ))}
      {/* Window + Sunbeam */}
      <polygon points="96,46 168,46 210,150 64,150" fill="url(#art-sunbeam)" />
      <rect x="96" y="8" width="74" height="40" rx="6" fill="url(#art-sky)" className="art-window" />
      <line x1="133" y1="8" x2="133" y2="48" className="art-window" />
      {/* 3D Cylindrical Bin */}
      <ellipse cx="256" cy="108" rx="28" ry="8" className="art-shadow-soft" />
      <path d="M232 56 L280 56 L273 106 A20 6 0 0 1 239 106 Z" className="art-bin" />
      <ellipse cx="256" cy="56" rx="24" ry="7" className="art-rim-3d" />
      <line x1="244" y1="62" x2="246" y2="103" className="art-grid" />
      <line x1="256" y1="63" x2="256" y2="105" className="art-grid" />
      <line x1="268" y1="62" x2="266" y2="103" className="art-grid" />
      {/* Parabolic 3D Arc */}
      <path d="M114 124 Q178 4 254 54" className="art-arc" />
      {/* 3D Polyhedral Paper Ball */}
      <g transform="translate(114 118)">
        <polygon points="-14,-4 -4,-14 10,-10 15,2 6,13 -8,12" className="art-ball" />
        <polygon points="-4,-14 10,-10 2,-1 -8,-2" fill="#ffffff" opacity="0.8" />
        <path d="M-10 4 L2 -1 L10 -10 M2 -1 L6 12" fill="none" stroke="var(--ink-line)" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

/** 3D Isometric Wooden/Navy Organizer Drawer with Extruded Keycap Blocks */
function DrawerArt() {
  const icons = [Pencil, Highlighter, BookOpen, GraduationCap, Award]
  return (
    <svg viewBox="0 0 360 150" className="art art-drawer">
      {/* Outer 3D Drawer Box */}
      <rect x="0" y="0" width="360" height="150" className="art-wood" />
      <rect x="20" y="16" width="320" height="122" rx="16" className="art-drawer-tray" />
      <path d="M22 30 L338 30" stroke="var(--ink-line)" strokeWidth="2" opacity="0.25" />
      {/* 3D Handle */}
      <rect x="146" y="5" width="68" height="10" rx="5" className="art-handle" />
      {/* 3D Keycap Blocks inside compartments */}
      {icons.map((Icon, i) => {
        const x = 34 + i * 58
        const y = 38
        const lv = i + 3
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            {/* Recessed slot */}
            <rect x="0" y="0" width="50" height="78" rx="12" className="art-slot" />
            {/* 3D Block shadow/extrusion */}
            <rect x="5" y="14" width="40" height="54" rx="10" fill="var(--ink-line)" />
            {/* 3D Block top face */}
            <rect x="5" y="8" width="40" height="54" rx="10" className={`art-token lv-${lv}`} />
            <rect x="9" y="11" width="32" height="5" rx="2.5" fill="#ffffff" opacity="0.45" />
            <Icon x={15} y={22} width={20} height={20} className="art-icon" />
            <text x="25" y="54" textAnchor="middle" className="art-lv-num">
              Lv.{lv}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---------- Fosforla altını çiz (3D Spiral Notebook) ----------

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
      <GameFrame title="Fosforla altını çiz" subtitle={daily ? 'Günün paragrafı' : 'Antrenman modu'} onExit={onExit}>
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
        <div className="mini-notebook-stack">
          <div className="mini-paper is-done" aria-label="Paragrafın doğru cevapları">
            <div className="mini-spiral" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="mini-spiral-ring" />
              ))}
            </div>
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
              <span className="mini-word is-hit">doğru (+10)</span> <span className="mini-word is-missed">kaçan</span> <span className="mini-word is-wrong">fazla (−5)</span>
            </p>
          </div>
        </div>
      </GameFrame>
    )

  return (
    <GameFrame
      title="Fosforla altını çiz"
      subtitle={daily ? 'Günün paragrafı · +10 doğru, −5 fazla' : 'Antrenman · +10 doğru, −5 fazla'}
      onExit={onExit}
      progress={leftMs / (HIGHLIGHT_SECONDS * 1000)}
      score={
        <>
          <Timer size={15} aria-hidden="true" /> {left} sn
        </>
      }
    >
      <div className="mini-tags">
        <span className="mini-chip is-strong">
          <Highlighter size={13} aria-hidden="true" /> {daily ? 'Günün paragrafı' : 'Antrenman'}
        </span>
        <span className="mini-chip">Hedef: {keyCount} anahtar ifade</span>
        <span className={`mini-chip${chosen.size > keyCount ? ' is-warn' : ''}`}>Seçilen: {chosen.size}/{keyCount}</span>
      </div>

      <div className="mini-notebook-stack">
        <div className="mini-paper" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Paragraf: önemli kelimeleri seç">
          <div className="mini-spiral" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="mini-spiral-ring" />
            ))}
          </div>
          <div className="mini-paper-head">
            <h2 className="mini-paper-title">{paragraph.title}</h2>
            <span className="mini-paper-corner">DERS NOTU</span>
          </div>
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
      </div>

      <p className="subtle mini-help">
        <Highlighter size={14} aria-hidden="true" /> Parmağını veya fareyi önemli kavramların üstünden geçir. İptal etmek için tekrar dokun. Süre ilk dokunuşta başlar.
      </p>
      <button className="btn btn-primary mini-wide mini-btn-3d" onClick={finish} disabled={startedAt === null}>
        Bitir ve Kontrol Et ({chosen.size} seçili)
      </button>
    </GameFrame>
  )
}

// ---------- Kâğıt top (3D Perspective Paper Toss) ----------

export function TossGame({ onExit }: { onExit: () => void }) {
  const [round, setRound] = useState(0)
  return <TossRound key={round} onExit={onExit} onAgain={() => setRound((n) => n + 1)} />
}

type Flight = { paper: Paper; landed: TossEnd | null; spin: number; trail: Vec3[] }

/** 3D trajectory arc preview while aiming: shows upward parabola + wind drift in 3D space. */
function previewArc(power: number, aim: number, wind: number): Vec3[] {
  const start = flickLaunch(power, aim)
  const pts: Vec3[] = []
  for (let i = 1; i <= 11; i += 1) {
    const t = i * 0.044
    const x = start.x + start.vx * t + 0.5 * wind * 0.35 * t * t
    const y = start.y + start.vy * t - 0.5 * 9.8 * t * t
    const z = start.z + start.vz * t
    if (y < PAPER_R) break
    pts.push({ x, y, z })
  }
  return pts
}

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
  const [flash, setFlash] = useState<{ text: string; sub?: string; good: boolean } | null>(null)
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
  // Keep animating room wind particles & swaying bin when idle/aiming
  const now = useTick(!flight && !record, 33)
  const binTime = ((flight ? performance.now() : now) - binStart.current) / 1000
  const bx = binX(bin, Math.max(0, binTime))

  const toScene = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * SCENE_W, y: ((e.clientY - rect.top) / rect.height) * SCENE_H }
  }

  const fly = (power: number, aim: number) => {
    let paper = flickLaunch(power, aim)
    let spin = 0
    const trail: Vec3[] = [{ x: paper.x, y: paper.y, z: paper.z }]
    setFlight({ paper, landed: null, spin: 0, trail })
    playSound('flip')
    let last = performance.now()
    let trailAcc = 0
    const tick = (t: number) => {
      const frameDt = Math.min(0.05, (t - last) / 1000)
      let dt = frameDt
      last = t
      spin += frameDt * 540
      trailAcc += frameDt
      let end: TossEnd | null = null
      while (dt > 0 && !end) {
        const step = Math.min(dt, 1 / 240)
        const r = stepPaper(paper, bin, wind, (t - binStart.current) / 1000, step)
        paper = r.paper
        end = r.end
        if (r.rim) playSound('flip')
        dt -= step
      }
      if (trailAcc >= 0.025) {
        trailAcc = 0
        trail.push({ x: paper.x, y: paper.y, z: paper.z })
        if (trail.length > 10) trail.shift()
      }
      setFlight({ paper, landed: end, spin, trail: [...trail] })
      if (!end) {
        raf.current = requestAnimationFrame(tick)
        return
      }
      done(end, paper, spin, trail)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const done = (end: TossEnd, paper: Paper, spin: number, trail: Vec3[]) => {
    const gained = end === 'in' ? binPoints(bin) : 0
    playSound(end === 'in' ? 'right' : 'wrong')
    setFlash(
      end === 'in'
        ? { text: `+${gained} PUAN!`, sub: gained >= 3 ? 'Uzak + Hareketli Kova!' : gained === 2 ? 'Bonus İsabet!' : 'Tam İsabet!', good: true }
        : { text: 'ISKA!', sub: paper.z < bin.z ? 'Kısa düştü' : 'Uzun / Yana kaçtı', good: false },
    )
    if (end === 'out') setMarks((m) => [...m.slice(-3), { x: paper.x, y: PAPER_R, z: paper.z }])
    else setFlight({ paper: { ...paper, y: BIN_TALL * 0.45 }, landed: 'in', spin, trail })

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
    }, 920)
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
      <GameFrame title="Kâğıt top" subtitle="10 atışlık tur tamamlandı" onExit={onExit}>
        <GameOver
          title="Tur bitti"
          points={record.points}
          badge={record.best ? 'Yeni rekor!' : results.every((r) => r === 'in') ? '10/10 Kusursuz!' : undefined}
          stats={[
            ['İsabet', `${results.filter((r) => r === 'in').length}/${TOSS_THROWS}`],
            ['Rekor', Math.max(readMiniRecords().toss ?? 0, record.points)],
          ]}
          note="Uzak kova +1, kayan kova +1 ek puan verir."
          onAgain={onAgain}
          onExit={onExit}
        />
      </GameFrame>
    )

  const power = pull ? powerFromPull(pull.dy) : 0
  const aim = pull ? aimFromPull(pull.dx) : 0
  const paper = flight?.paper ?? null
  const distM = bin.z.toFixed(1)
  const windLevel = Math.ceil(Math.abs(wind) / 0.35)

  // Depth sorting in 3D space:
  // 1. Far behind the bin: paper.z > bin.z + BIN_R * 0.5
  // 2. Inside / crossing the bin mouth: between BinBack and BinFront
  // 3. In front of the bin: paper.z < bin.z - BIN_R * 0.5
  const paperLayer = !paper
    ? 'none'
    : flight?.landed === 'in'
      ? 'inside'
      : paper.z > bin.z + BIN_R * 0.4
        ? 'behind'
        : paper.z >= bin.z - BIN_R * 0.5
          ? 'inside'
          : 'front'

  return (
    <GameFrame title="Kâğıt top" subtitle={`Atış ${Math.min(throwNo + 1, TOSS_THROWS)}/${TOSS_THROWS} · Mesafe ${distM}m`} onExit={onExit} score={`${points} puan`}>
      <div className="toss-hud">
        <ol className="toss-dots" aria-label={`Atış ${Math.min(throwNo + 1, TOSS_THROWS)}/${TOSS_THROWS}`}>
          {Array.from({ length: TOSS_THROWS }, (_, i) => (
            <li key={i} className={results[i] === 'in' ? 'is-in' : results[i] === 'out' ? 'is-out' : i === results.length ? 'is-now' : ''} />
          ))}
        </ol>
        <div className="toss-hud-badges">
          {bin.z > 3.6 && <span className="mini-chip is-bonus">Uzak +1</span>}
          {!!bin.sway && <span className="mini-chip is-bonus">Kayan kova +1</span>}
          <span className={`mini-chip toss-wind-chip${wind !== 0 ? ' has-wind' : ''}`}>
            <Wind size={14} aria-hidden="true" /> {wind === 0 ? 'Rüzgâr yok' : `${wind > 0 ? 'Sağa →' : '← Sola'} ${windLevel}`}
          </span>
        </div>
      </div>

      <div className="toss-stage-wrap">
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
          <TossRoom wind={wind} time={binTime} distM={distM} />

          {/* Missed crumpled paper balls left on the floor */}
          {marks.map((m, i) => (
            <PaperBall key={i} paper={m} spin={i * 75 + 25} faded />
          ))}

          {/* 3D Trajectory Arc + Floor Shadow Dots when pulling */}
          {pull && power > 0.03 && <AimArc power={power} aim={aim} wind={wind} />}

          {/* Flight Trail */}
          {flight && flight.trail.length > 1 && <FlightTrail points={flight.trail} />}

          {/* Paper behind the bin */}
          {paper && paperLayer === 'behind' && <PaperBall paper={paper} spin={flight!.spin} />}

          {/* Back half of the 3D cylindrical wastebasket */}
          <BinBack x={bx} z={bin.z} hit={flight?.landed === 'in'} />

          {/* Paper inside the bin mouth / dropping into the basket */}
          {paper && paperLayer === 'inside' && <PaperBall paper={paper} spin={flight!.spin} />}

          {/* Front half of the 3D cylindrical wastebasket (wire mesh + front lip) */}
          <BinFront x={bx} z={bin.z} points={binPoints(bin)} hit={flight?.landed === 'in'} />

          {/* Paper in front of the bin */}
          {paper && paperLayer === 'front' && <PaperBall paper={paper} spin={flight!.spin} />}

          {/* Foreground 3D Desk Edge & Launch Pad */}
          <DeskLaunchPad power={power} aim={aim} pulling={!!pull} />

          {/* Ready paper ball sitting on the launch pad */}
          {!flight && (
            <PaperBall
              paper={{
                x: PAPER_START.x + aim * 0.08,
                y: PAPER_START.y - power * 0.08,
                z: PAPER_START.z - power * 0.06,
              }}
              spin={aim * 35}
            />
          )}

          {/* Sculpted 3D Flicking Hand */}
          <Hand tension={power} aim={aim} flicked={!!flight} />

          {/* 3D Curved Power & Angle HUD Gauge while pulling */}
          {pull && (
            <g className="toss-power" aria-hidden="true">
              <rect x="14" y="276" width="26" height="206" rx="13" className="toss-power-bg" />
              <rect x="18" y={280 + 198 * (1 - power)} width="18" height={198 * power} rx="9" className="toss-power-fill" />
              {[0.25, 0.5, 0.75].map((tick) => (
                <line key={tick} x1="16" x2="38" y1={280 + 198 * tick} y2={280 + 198 * tick} className="toss-power-tick" />
              ))}
              <rect x="8" y="246" width="42" height="24" rx="7" className="toss-power-pill" />
              <text x="29" y="262" textAnchor="middle" className="toss-power-pct">
                %{Math.round(power * 100)}
              </text>
            </g>
          )}

          {!flight && !pull && results.length === 0 && (
            <g className="toss-hint-box" aria-hidden="true">
              <rect x="68" y="294" width="224" height="38" rx="12" className="toss-hint-bg" />
              <text x={SCENE_W / 2} y="318" textAnchor="middle" className="toss-hint">
                👇 Kâğıdı aşağı çek, nişan al ve bırak
              </text>
            </g>
          )}

          {flash && (
            <g className="toss-flash-group" aria-hidden="true">
              <text x={SCENE_W / 2} y="92" textAnchor="middle" className={`toss-flash ${flash.good ? 'is-good' : 'is-bad'}`}>
                {flash.text}
              </text>
              {flash.sub && (
                <text x={SCENE_W / 2} y="118" textAnchor="middle" className="toss-flash-sub">
                  {flash.sub}
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      <p className="subtle mini-help">
        <Trash2 size={14} aria-hidden="true" /> Parmağını aşağı çekerek fiske gücünü ayarla, sağa-sola kaydırarak rüzgâra karşı nişan al ve bırak.
      </p>
    </GameFrame>
  )
}

/** 3D Room with perspective corner walls, wooden floor planks, sunlit window, spinning fan, and wind ribbons. */
function TossRoom({ wind, time, distM }: { wind: number; time: number; distM: string }) {
  const floorTop = project({ x: 0, y: 0, z: 9 }).y
  const leftCornerFar = project({ x: -2.8, y: 0, z: 9 })
  const rightCornerFar = project({ x: 2.8, y: 0, z: 9 })
  const leftCornerNear = project({ x: -2.8, y: 0, z: 0.5 })
  const rightCornerNear = project({ x: 2.8, y: 0, z: 0.5 })
  const across = [1.0, 1.5, 2.2, 3.1, 4.3, 6.0, 8.2]
  const lengthwise = [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4]
  const flag = Math.max(-1, Math.min(1, wind / 1.4))

  return (
    <g>
      <defs>
        <linearGradient id="toss-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="sky-top" />
          <stop offset="1" className="sky-bottom" />
        </linearGradient>
        <linearGradient id="toss-wall-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--surface-2)" />
          <stop offset="1" stopColor="var(--border)" />
        </linearGradient>
        <linearGradient id="toss-floor-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--border)" />
          <stop offset="0.35" stopColor="var(--surface-2)" />
          <stop offset="1" stopColor="var(--surface)" />
        </linearGradient>
        <linearGradient id="toss-sunbeam" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#ffe14d" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffe14d" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="toss-bin-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--border-strong)" />
          <stop offset="0.45" stopColor="var(--surface)" />
          <stop offset="1" stopColor="var(--border-strong)" />
        </linearGradient>
      </defs>

      {/* Back wall */}
      <rect x="0" y="0" width={SCENE_W} height={floorTop} fill="url(#toss-wall-grad)" />
      {/* Left & Right 3D angled side walls */}
      <polygon points={`0,0 ${leftCornerFar.x},0 ${leftCornerFar.x},${floorTop} 0,${leftCornerNear.y}`} className="toss-side-wall" />
      <polygon points={`${SCENE_W},0 ${rightCornerFar.x},0 ${rightCornerFar.x},${floorTop} ${SCENE_W},${rightCornerNear.y}`} className="toss-side-wall" />

      {/* 3D Perspective Floor */}
      <rect x="0" y={floorTop} width={SCENE_W} height={SCENE_H - floorTop} fill="url(#toss-floor-grad)" />

      {/* Baseboard (süpürgelik) along back & side walls */}
      <rect x={leftCornerFar.x} y={floorTop - 6} width={rightCornerFar.x - leftCornerFar.x} height="6" className="toss-baseboard" />
      <line x1={leftCornerFar.x} y1="0" x2={leftCornerFar.x} y2={floorTop} className="toss-corner-line" />
      <line x1={rightCornerFar.x} y1="0" x2={rightCornerFar.x} y2={floorTop} className="toss-corner-line" />

      {/* Perspective floor planks & distance lines */}
      {across.map((z) => {
        const l = project({ x: -3.2, y: 0, z })
        const r = project({ x: 3.2, y: 0, z })
        return <line key={z} x1={l.x} y1={l.y} x2={r.x} y2={r.y} className="toss-grid" />
      })}
      {lengthwise.map((x) => {
        const near = project({ x, y: 0, z: 0.35 })
        const far = project({ x, y: 0, z: 9 })
        return <line key={x} x1={near.x} y1={near.y} x2={far.x} y2={far.y} className="toss-grid" />
      })}

      {/* 3D Recessed Window with Sill & Volumetric Sunbeam */}
      <polygon points="104,124 256,124 316,380 44,380" fill="url(#toss-sunbeam)" />
      <rect x="100" y="24" width="160" height="100" rx="10" className="toss-window-recess" />
      <rect x="105" y="28" width="150" height="90" rx="7" fill="url(#toss-sky)" className="toss-window" />
      <ellipse cx="148" cy="64" rx="24" ry="8" className="toss-cloud" />
      <ellipse cx="166" cy="59" rx="15" ry="8" className="toss-cloud" />
      <ellipse cx="218" cy="82" rx="19" ry="6" className="toss-cloud" />
      {/* Window panes & 3D sill */}
      <line x1="180" y1="28" x2="180" y2="118" className="toss-frame" />
      <line x1="105" y1="74" x2="255" y2="74" className="toss-frame" />
      <rect x="94" y="118" width="172" height="8" rx="4" className="toss-sill" />

      {/* Wall Poster ("SINAV HAFTASI") on Left Back Wall */}
      <g transform="translate(56 44) rotate(-2)">
        <rect x="0" y="0" width="32" height="42" rx="3" className="toss-poster" />
        <rect x="5" y="6" width="22" height="6" rx="1.5" fill="var(--hi)" />
        <line x1="5" y1="18" x2="25" y2="18" stroke="var(--ink-line)" strokeWidth="2" />
        <line x1="5" y1="24" x2="22" y2="24" stroke="var(--ink-line)" strokeWidth="2" />
        <line x1="5" y1="30" x2="26" y2="30" stroke="var(--ink-line)" strokeWidth="2" />
      </g>

      {/* Wind Vane / Ribbon on Window Sill */}
      <g transform="translate(248 68)">
        <line x1="0" y1="0" x2="0" y2="50" className="toss-pole" />
        <circle cx="0" cy="0" r="3.5" fill="var(--ink-line)" />
        {wind !== 0 ? (
          <path
            d={`M0 2 Q${flag * 18} ${4 + Math.sin(time * 8) * 3} ${flag * 34} ${8 + (1 - Math.abs(flag)) * 8} L${flag * 28} ${15 + (1 - Math.abs(flag)) * 6} L0 16 Z`}
            className="toss-flag"
          />
        ) : (
          <path d="M0 2 L4 22 L0 20 Z" className="toss-flag" opacity="0.6" />
        )}
      </g>

      {/* Distance floor marker tag */}
      <g transform={`translate(${ SCENE_W - 44 } ${ floorTop + 18 })`}>
        <rect x="-26" y="-10" width="52" height="18" rx="6" className="toss-dist-pill" />
        <text x="0" y="3" textAnchor="middle" className="toss-dist-text">
          {distM}m
        </text>
      </g>

      {/* Live 3D Wind Stream Particles across the room */}
      {wind !== 0 &&
        [0, 1, 2, 3].map((i) => {
          const dir = wind > 0 ? 1 : -1
          const speed = 45 + Math.abs(wind) * 55
          const rawX = ((time * speed + i * 95) % 320)
          const x = dir > 0 ? 20 + rawX : 340 - rawX
          const y = 175 + i * 52 + Math.sin(time * 3 + i) * 6
          const len = 22 + Math.abs(wind) * 16
          return (
            <g key={i} opacity={0.45}>
              <line x1={x} y1={y} x2={x - dir * len} y2={y} className="toss-wind-line" />
              <circle cx={x} cy={y} r="2" fill="var(--hi)" />
            </g>
          )
        })}
    </g>
  )
}

/** Back half of the 3D cylindrical wastebasket (interior shadow + back mesh + back rim arc). */
function BinBack({ x, z, hit }: { x: number; z: number; hit: boolean }) {
  const rim = project({ x, y: BIN_TALL, z })
  const base = project({ x, y: 0, z })
  const rx = BIN_R * rim.scale
  const ry = rx * 0.34
  const bx = BIN_R * 0.76 * base.scale
  const by = bx * 0.32
  return (
    <g className={`toss-bin-back${hit ? ' is-hit' : ''}`}>
      {/* Soft ambient occlusion floor shadow */}
      <ellipse cx={base.x} cy={base.y + by * 0.45} rx={bx * 1.45} ry={by * 1.45} className="toss-shadow" />
      <ellipse cx={base.x} cy={base.y + by * 0.2} rx={bx * 1.1} ry={by * 1.05} className="toss-shadow-deep" />
      {/* Interior dark cavity of the bin */}
      <path
        d={`M${rim.x - rx} ${rim.y} L${base.x - bx} ${base.y} A${bx} ${by} 0 0 0 ${base.x + bx} ${base.y} L${rim.x + rx} ${rim.y} Z`}
        className="toss-bin-inside"
      />
      {/* Back upper rim opening */}
      <ellipse cx={rim.x} cy={rim.y} rx={rx} ry={ry} className="toss-hole" />
      {/* Back interior mesh ribs */}
      {[-0.5, 0, 0.5].map((f) => (
        <line key={f} x1={rim.x + rx * f} y1={rim.y - ry * 0.3} x2={base.x + bx * f} y2={base.y - by * 0.2} className="toss-rib-back" />
      ))}
    </g>
  )
}

/** Front half of the 3D cylindrical wastebasket (shaded cylinder wall, wire mesh ribs, front rim lip). */
function BinFront({ x, z, points, hit }: { x: number; z: number; points: number; hit: boolean }) {
  const rim = project({ x, y: BIN_TALL, z })
  const base = project({ x, y: 0, z })
  const rx = BIN_R * rim.scale
  const ry = rx * 0.34
  const bx = BIN_R * 0.76 * base.scale
  const by = bx * 0.32
  const midY = (rim.y + base.y) / 2
  const midRx = (rx + bx) / 2
  const midRy = (ry + by) / 2

  return (
    <g className={`toss-bin-front${hit ? ' is-hit' : ''}`}>
      {/* Front cylindrical body (semi-translucent so ball inside is subtly visible through mesh) */}
      <path
        d={`M${rim.x - rx} ${rim.y} A${rx} ${ry} 0 0 0 ${rim.x + rx} ${rim.y} L${base.x + bx} ${base.y} A${bx} ${by} 0 0 1 ${base.x - bx} ${base.y} Z`}
        fill="url(#toss-bin-metal)"
        fillOpacity="0.88"
        className="toss-bin-wall"
      />
      {/* Horizontal 3D wire mesh rings */}
      <path d={`M${rim.x - midRx} ${midY} A${midRx} ${midRy} 0 0 0 ${rim.x + midRx} ${midY}`} className="toss-rib" fill="none" />
      <path d={`M${base.x - bx} ${base.y} A${bx} ${by} 0 0 0 ${base.x + bx} ${base.y}`} className="toss-bin-base-ring" fill="none" />
      {/* Vertical 3D ribs along the front curve */}
      {[-0.68, -0.34, 0, 0.34, 0.68].map((f) => {
        const drop = Math.sqrt(Math.max(0, 1 - f * f))
        return (
          <line
            key={f}
            x1={rim.x + rx * f}
            y1={rim.y + ry * drop}
            x2={base.x + bx * f}
            y2={base.y + by * drop}
            className="toss-rib"
          />
        )
      })}
      {/* Front 3D thick rim arc with highlight */}
      <path d={`M${rim.x - rx} ${rim.y} A${rx} ${ry} 0 0 0 ${rim.x + rx} ${rim.y}`} className="toss-rim-front" />
      <path d={`M${rim.x - rx * 0.75} ${rim.y + ry * 0.65} A${rx} ${ry} 0 0 0 ${rim.x + rx * 0.75} ${rim.y + ry * 0.65}`} className="toss-rim-shine" />

      {/* Point value badge on the front of the bin when > 1 pt */}
      {points > 1 && (
        <g transform={`translate(${rim.x} ${midY + 4})`}>
          <rect x="-14" y="-9" width="28" height="18" rx="6" className="toss-bin-badge" />
          <text x="0" y="4" textAnchor="middle" className="toss-bin-badge-text">
            +{points}
          </text>
        </g>
      )}
    </g>
  )
}

/** Multi-faceted 3D Origami Crumpled Paper Ball with height-adaptive ground shadow and 3D spin. */
function PaperBall({ paper, spin = 0, faded = false }: { paper: Vec3; spin?: number; faded?: boolean }) {
  const p = project(paper)
  const r = PAPER_R * p.scale
  const shadow = project({ x: paper.x, y: 0, z: paper.z })
  const heightFactor = Math.max(0.25, 1 - paper.y * 0.38)
  const k = Math.max(0.25, r / 14)
  return (
    <g className={faded ? 'toss-ball-faded' : ''}>
      {/* Ground shadow shrinks and softens as the ball rises in 3D y */}
      <ellipse
        cx={shadow.x}
        cy={shadow.y}
        rx={r * 0.95 * heightFactor}
        ry={r * 0.34 * heightFactor}
        className="toss-shadow"
        opacity={faded ? 0.35 : 0.65 * heightFactor}
      />
      <g transform={`translate(${p.x} ${p.y}) scale(${k}) rotate(${spin})`} className="toss-ball">
        {/* Outer silhouette */}
        <polygon points="0,-14 9,-11 14,-3 12,7 4,14 -6,13 -13,6 -14,-4 -8,-12" className="paper-base" />
        {/* Lit top-left 3D facets */}
        <polygon points="0,-14 9,-11 2,-2 -8,-12" className="paper-lit" />
        <polygon points="-14,-4 -8,-12 2,-2 -5,3" className="paper-lit-2" />
        {/* Midtone right facets */}
        <polygon points="9,-11 14,-3 4,4 2,-2" className="paper-mid" />
        {/* Shaded bottom facets */}
        <polygon points="-5,3 2,-2 4,4 -6,13 -13,6" className="paper-shade" />
        <polygon points="4,4 14,-3 12,7 4,14 -6,13" className="paper-deep" />
        {/* Sharp origami crease lines */}
        <path d="M-8,-12 L2,-2 L9,-11 M-14,-4 L-5,3 L2,-2 L4,4 L14,-3 M-5,3 L-6,13 M4,4 L4,14" className="paper-crease" />
      </g>
    </g>
  )
}

/** 3D Flight Trail behind the flying paper ball */
function FlightTrail({ points }: { points: Vec3[] }) {
  if (points.length < 2) return null
  const projected = points.map((pt) => project(pt))
  const d = projected.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return (
    <g aria-hidden="true">
      <path d={d} className="toss-trail-line" />
      {projected.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={Math.max(1.5, (i / projected.length) * 4.5)} className="toss-trail-dot" opacity={(i + 1) / projected.length} />
      ))}
    </g>
  )
}

/** 3D Parabolic Trajectory Arc in space + Floor Shadow Projection Dots */
function AimArc({ power, aim, wind }: { power: number; aim: number; wind: number }) {
  const pts = previewArc(power, aim, wind)
  const air = pts.map((pt) => project(pt))
  const floor = pts.map((pt) => project({ x: pt.x, y: 0, z: pt.z }))
  const airPath = air.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return (
    <g aria-hidden="true">
      {/* Floor shadow dots showing horizontal direction + wind curve */}
      {floor.map((p, i) => (
        <circle key={`f-${i}`} cx={p.x} cy={p.y} r={Math.max(1.8, 0.018 * p.scale)} className="toss-aim-shadow" />
      ))}
      {/* 3D rising parabolic curve */}
      {air.length > 1 && <path d={airPath} className="toss-aim-curve" />}
      {air.map((p, i) => (
        <circle
          key={`a-${i}`}
          cx={p.x}
          cy={p.y}
          r={Math.max(2.5, (1 - i * 0.06) * 6)}
          className="toss-aim-node"
          opacity={Math.max(0.25, 1 - i * 0.075)}
        />
      ))}
    </g>
  )
}

/** Foreground 3D Study Desk Edge and Tactile 3D Slingshot / Flick Rig */
function DeskLaunchPad({ power, aim, pulling }: { power: number; aim: number; pulling: boolean }) {
  const startP = project(PAPER_START)
  const cradleX = startP.x + aim * 28
  const cradleY = startP.y + 8 + power * 30
  return (
    <g aria-hidden="true">
      {/* 3D Desk Surface at the bottom of the screen */}
      <polygon points={`0,494 ${SCENE_W},494 ${SCENE_W},542 0,542`} className="toss-desk-top" />
      <polygon points={`0,542 ${SCENE_W},542 ${SCENE_W},${SCENE_H} 0,${SCENE_H}`} className="toss-desk-edge" />
      <line x1="0" y1="494" x2={SCENE_W} y2="494" className="toss-desk-line" />
      {/* 3D Perspective Launch Mat on the desk */}
      <ellipse cx={startP.x} cy={startP.y + 22} rx="64" ry="18" className="toss-pad-outer" />
      <ellipse cx={startP.x} cy={startP.y + 20} rx="48" ry="13" className="toss-pad-inner" />
      {/* Left & Right 3D Anchor Pegs on the Desk Mat */}
      <g transform={`translate(${startP.x - 42} ${startP.y + 12})`}>
        <ellipse cx="0" cy="8" rx="7" ry="3.5" className="toss-shadow-deep" />
        <rect x="-4.5" y="-10" width="9" height="18" rx="4.5" className="toss-peg" />
        <circle cx="0" cy="-8" r="3" fill="var(--hi)" />
      </g>
      <g transform={`translate(${startP.x + 42} ${startP.y + 12})`}>
        <ellipse cx="0" cy="8" rx="7" ry="3.5" className="toss-shadow-deep" />
        <rect x="-4.5" y="-10" width="9" height="18" rx="4.5" className="toss-peg" />
        <circle cx="0" cy="-8" r="3" fill="var(--hi)" />
      </g>
      {/* Elastic tension bands connecting pegs to the paper ball cradle */}
      <line x1={startP.x - 42} y1={startP.y + 6} x2={cradleX - 10} y2={cradleY} className="toss-elastic" />
      <line x1={startP.x + 42} y1={startP.y + 6} x2={cradleX + 10} y2={cradleY} className="toss-elastic" />
      {pulling && power > 0.02 && (
        <ellipse cx={cradleX} cy={cradleY + 2} rx="16" ry="6" className="toss-cradle" />
      )}
    </g>
  )
}

/**
 * Compact 3D Sculpted Pinch Hand & Cuff at the front of the desk.
 */
function Hand({ tension, aim, flicked }: { tension: number; aim: number; flicked: boolean }) {
  const shiftX = aim * 28
  const pullY = tension * 30
  const releaseY = flicked ? -18 : pullY
  return (
    <g className={`toss-hand${flicked ? ' is-flicked' : ''}`} transform={`translate(${shiftX} ${releaseY})`} aria-hidden="true">
      {/* Soft shadow on the desk */}
      <ellipse cx="180" cy="540" rx="46" ry="11" className="toss-shadow-deep" />
      {/* Left Thumb & Right Index pinching/flicking behind the paper ball */}
      <path d="M144 556 C 146 520, 158 486, 171 468 C 176 462, 182 466, 179 475 C 172 496, 166 526, 166 556 Z" className="palm" />
      <path d="M216 556 C 214 520, 202 486, 189 468 C 184 462, 178 466, 181 475 C 188 496, 194 526, 194 556 Z" className="palm" />
      {/* Fingernail highlights */}
      <ellipse cx="173" cy="471" rx="4.5" ry="3.5" transform="rotate(-25 173 471)" className="fingernail" />
      <ellipse cx="187" cy="471" rx="4.5" ry="3.5" transform="rotate(25 187 471)" className="fingernail" />
      {/* 3D Sculpted Hand Base & Varsity Sleeve Cuff */}
      <rect x="138" y="534" width="84" height="28" rx="14" className="palm" />
      <rect x="132" y="548" width="96" height="24" rx="10" className="hand-cuff" />
      <line x1="142" y1="556" x2="218" y2="556" className="hand-cuff-stripe" />
      {/* Snap shockwave burst when flicked */}
      {flicked && (
        <g className="snap-burst">
          <path d="M158 446 l-14 -12 M180 438 l0 -18 M202 446 l14 -12" className="snap" />
          <circle cx="180" cy="456" r="14" className="snap-ring" />
        </g>
      )}
    </g>
  )
}

// ---------- Çekmece (3D Tactile Desk Organizer Merge) ----------

const ITEM_ICONS = [Pencil, PenLine, Highlighter, NotebookPen, BookOpen, ScrollText, GraduationCap, Award]
const SHORT_NAMES = ['Kurşun', 'Tükenmez', 'Fosforlu', 'Defter', 'Kitap', 'Ders Notu', 'Kep', 'Diploma']

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
      window.setTimeout(() => setPop(null), 380)
      after(merged.grid, merged.points)
      return
    }
    if (grid[i] === null) {
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
      <GameFrame title="Çekmece" subtitle="Çalışma masası birleştirme oyunu" onExit={onExit}>
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
  const nextLevelName = selectedLevel && selectedLevel < DRAWER_MAX ? DRAWER_ITEMS[selectedLevel] : null

  return (
    <GameFrame
      title="Çekmece"
      subtitle={`En yüksek: ${top ? DRAWER_ITEMS[top - 1] : '—'} · Hedef: Diploma`}
      onExit={onExit}
      progress={leftMs / (DRAWER_SECONDS * 1000)}
      score={
        <>
          <Timer size={15} aria-hidden="true" /> {left} sn · {points}
        </>
      }
    >
      <div className="drawer-status-bar" aria-live="polite">
        {selectedLevel ? (
          <span className="drawer-status-active">
            <Sparkles size={15} aria-hidden="true" />
            <strong>{DRAWER_ITEMS[selectedLevel - 1]}</strong> seçili — başka bir <strong>{DRAWER_ITEMS[selectedLevel - 1]}</strong> ile birleştir
            {nextLevelName ? ` → ${nextLevelName}!` : ''}
          </span>
        ) : (
          <span className="drawer-status-idle">İki aynı eşyaya sırayla dokunarak bir üst seviyeye birleştir</span>
        )}
      </div>

      {/* 3D Wooden/Navy Recessed Desk Drawer */}
      <div className="drawer-cabinet">
        <div className="drawer-handle-wrap" aria-hidden="true">
          <span className="drawer-handle-plate">
            <span className="drawer-screw" />
            <span className="drawer-handle-grip" />
            <span className="drawer-screw" />
          </span>
        </div>
        <div className="drawer-box">
          <div className="drawer-grid" role="grid" aria-label="Çekmece">
            {grid.map((level, i) => {
              const Icon = level ? ITEM_ICONS[level - 1] : null
              const name = level ? DRAWER_ITEMS[level - 1] : 'Boş'
              const shortName = level ? SHORT_NAMES[level - 1] : ''
              const match = selectedLevel !== null && selected !== i && level === selectedLevel && level < DRAWER_MAX
              return (
                <button
                  key={i}
                  className={`drawer-slot${selected === i ? ' is-selected' : ''}${match ? ' is-match' : ''}${pop === i ? ' is-pop' : ''}`}
                  onClick={() => tap(i)}
                  aria-label={`${name}${selected === i ? ', seçili' : ''}`}
                >
                  {Icon && level ? (
                    <span className={`drawer-token lv-${level}`}>
                      <span className="drawer-token-shine" aria-hidden="true" />
                      <span className="drawer-lv">{level}</span>
                      <Icon size={24} aria-hidden="true" className="drawer-token-icon" />
                      <span className="drawer-token-name">{shortName}</span>
                    </span>
                  ) : (
                    <span className="drawer-slot-dot" aria-hidden="true" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <button className="btn mini-wide mini-btn-3d-sec" onClick={() => !end && grid.includes(null) && after(grid, 0)} disabled={!grid.includes(null)}>
        <Plus size={16} /> Çekmeceye yeni eşya bırak
      </button>

      {/* 3D Evolution Rack */}
      <div className="drawer-rack">
        <div className="drawer-rack-head">
          <span className="subtle">
            <Trophy size={14} aria-hidden="true" /> Evrim Sırası (1 → 8)
          </span>
          <span className="subtle">
            En iyi: <strong>{top ? DRAWER_ITEMS[top - 1] : '—'}</strong>
          </span>
        </div>
        <ol className="drawer-path" aria-label="Eşya sırası">
          {ITEM_ICONS.map((Icon, i) => (
            <li key={i} className={`${top > i ? 'is-reached' : ''}${top === i + 1 ? ' is-current' : ''}`} title={`${i + 1}. ${DRAWER_ITEMS[i]}`}>
              <span className={`drawer-mini-tile lv-${i + 1}`}>
                <Icon size={15} aria-hidden="true" />
                <small>{i + 1}</small>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </GameFrame>
  )
}
