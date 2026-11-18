import { Award, BookOpen, FlaskConical, GraduationCap, Highlighter, Notebook, NotebookPen, Package, Pencil, PenLine, ScrollText, Star, Trash2, Wind } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
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
  launchFromFlick,
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
import { GameHead, Result, useTick } from './shared'

export type MiniGame = 'altini-ciz' | 'kagit-top' | 'cekmece'
export const MINI_GAMES: MiniGame[] = ['altini-ciz', 'kagit-top', 'cekmece']

/** The list of mini games, with a note that only admins see them for now. */
export function MiniHub({ onOpen, onExit }: { onOpen: (game: MiniGame) => void; onExit: () => void }) {
  const records = readMiniRecords()
  const today = istanbulDay()
  const playedToday = records.highlight?.day === today
  return (
    <div className="page page-narrow mola">
      <GameHead onExit={onExit} />
      <div className="page-header">
        <div>
          <h1>
            Mini <span className="hl">oyunlar</span>
          </h1>
          <p className="muted">Kart gerekmez; sıkıldığında aç, bir el oyna, derse dön.</p>
        </div>
      </div>
      <p className="mini-trial">
        <FlaskConical size={16} aria-hidden="true" /> Deneme: şimdilik yalnızca yöneticiler görüyor.
      </p>
      <div className="mola-grid">
        <MiniTile
          icon={<Highlighter size={22} />}
          title="Fosforla altını çiz"
          text="Günün paragrafında önemli kelimelerin üstünden parmağınla geç. Fazlasını çizersen puan gider."
          meta={playedToday ? `Bugün oynandı: ${records.highlight!.points} puan · yarın yeni paragraf` : `Bugünün paragrafı hazır · ${HIGHLIGHT_SECONDS} saniye`}
          onOpen={() => onOpen('altini-ciz')}
        />
        <MiniTile
          icon={<Trash2 size={22} />}
          title="Kâğıt top"
          text="Buruşturduğun kâğıdı yukarı fırlat, çöpe at. Rüzgâra dikkat."
          meta={records.toss !== undefined ? `Rekor: ${records.toss} puan` : `${TOSS_THROWS} atış`}
          onOpen={() => onOpen('kagit-top')}
        />
        <MiniTile
          icon={<Package size={22} />}
          title="Çekmece"
          text="İki aynı eşyayı birleştir: kalem deftere, defter kitaba… Diplomaya ulaşabilir misin?"
          meta={records.drawer !== undefined ? `Rekor: ${records.drawer} puan · en iyi: ${DRAWER_ITEMS[(records.drawerLevel ?? 1) - 1]}` : `${DRAWER_SECONDS / 60} dakika`}
          onOpen={() => onOpen('cekmece')}
        />
      </div>
    </div>
  )
}

function MiniTile({ icon, title, text, meta, onOpen }: { icon: ReactNode; title: string; text: string; meta: string; onOpen: () => void }) {
  return (
    <button className="mola-tile" onClick={onOpen} aria-label={title}>
      <span className="mola-tile-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mola-tile-body">
        <strong>{title}</strong>
        <span className="muted">{text}</span>
        <span className="subtle">{meta}</span>
      </span>
    </button>
  )
}

// ---------- Fosforla altını çiz ----------

export function HighlightGame({ onExit }: { onExit: () => void }) {
  const today = istanbulDay()
  const [round, setRound] = useState<{ n: number; paragraph: HighlightParagraph; daily: boolean } | null>(() => {
    const played = readMiniRecords().highlight?.day === today
    return played ? null : { n: 0, paragraph: dailyParagraph(), daily: true }
  })

  if (!round) {
    const rec = readMiniRecords().highlight
    return (
      <div className="page page-narrow mola">
        <GameHead onExit={onExit} />
        <div className="panel mini-done">
          <strong>Bugünün paragrafını çizdin</strong>
          <p className="muted">
            Puanın: {rec?.points ?? 0} · <Stars n={rec?.stars ?? 0} /> Yarın yeni bir paragraf gelecek.
          </p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => setRound({ n: 1, paragraph: practiceParagraph(), daily: false })}>
              Antrenman yap (puan sayılmaz)
            </button>
            <button className="btn" onClick={onExit}>
              Geri dön
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <HighlightRound
      key={round.n}
      paragraph={round.paragraph}
      daily={round.daily}
      onExit={onExit}
      onAgain={() => setRound((r) => ({ n: (r?.n ?? 0) + 1, paragraph: practiceParagraph(r?.paragraph.id), daily: false }))}
    />
  )
}

function practiceParagraph(except?: string): HighlightParagraph {
  const others = HIGHLIGHT_PARAGRAPHS.filter((p) => p.id !== except && p.id !== dailyParagraph().id)
  return others[Math.floor(Math.random() * others.length)]
}

function Stars({ n }: { n: number }) {
  return (
    <span className="mini-stars" role="img" aria-label={`${n}/3 yıldız`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={16} className={i < n ? 'is-on' : ''} aria-hidden="true" />
      ))}
    </span>
  )
}

function HighlightRound({ paragraph, daily, onExit, onAgain }: { paragraph: HighlightParagraph; daily: boolean; onExit: () => void; onAgain: () => void }) {
  const tokens = useMemo(() => parseParagraph(paragraph.text), [paragraph.text])
  const [chosen, setChosen] = useState<Set<number>>(() => new Set())
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const now = useTick(startedAt !== null && !done, 200)
  const left = startedAt === null ? HIGHLIGHT_SECONDS : Math.max(0, HIGHLIGHT_SECONDS - Math.floor((now - startedAt) / 1000))
  const drag = useRef<{ on: boolean } | null>(null)
  const score = useMemo(() => scoreHighlight(tokens, chosen), [tokens, chosen])
  const [best, setBest] = useState(false)

  const finish = () => {
    if (done) return
    setDone(true)
    playSound('done')
    if (daily) {
      const rec = readMiniRecords()
      setBest(score.points > (rec.highlightBest ?? -1))
      saveMiniRecords({ highlight: { day: istanbulDay(), points: score.points, stars: score.stars }, highlightBest: Math.max(rec.highlightBest ?? 0, score.points) })
    }
  }
  useEffect(() => {
    if (startedAt !== null && left === 0) finish()
  }, [left, startedAt])

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

  return (
    <div className="page page-narrow mola">
      <GameHead onExit={onExit}>
        {done ? (daily ? 'Günün paragrafı' : 'Antrenman') : `${left} sn · ${chosen.size} kelime`}
      </GameHead>
      <div className="mini-highlight-head">
        <Highlighter size={20} aria-hidden="true" />
        <strong>{paragraph.title}</strong>
      </div>
      {/* Same text before and after the first touch: a shorter line would move the paragraph under the finger. */}
      {!done && <p className="muted mini-hint">Önemli kelimelerin üstünden parmağınla geç; süre ilk dokunuşta başlar. Yanlış çizdiğine tekrar dokun.</p>}
      <div className={`mini-paragraph${done ? ' is-done' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Paragraf: önemli kelimeleri seç">
        {tokens.map((t) => {
          const on = chosen.has(t.index)
          const state = done ? (t.key ? (on ? 'is-hit' : 'is-missed') : on ? 'is-wrong' : '') : on ? 'is-on' : ''
          return (
            <span key={t.index}>
              <span className={`mini-word ${state}`} data-i={t.index} role="checkbox" aria-checked={on}>
                {t.text}
              </span>
              {t.after}{' '}
            </span>
          )
        })}
      </div>
      {!done ? (
        <div className="btn-row">
          <button className="btn btn-primary" onClick={finish} disabled={startedAt === null}>
            Bitir
          </button>
        </div>
      ) : (
        <Result
          title={`${score.points} puan`}
          badge={score.stars === 3 ? 'Tam isabet!' : best ? 'Yeni rekor!' : `${score.hits}/${score.keys} önemli kelime`}
          lines={[
            `Doğru: ${score.hits} · Kaçan: ${score.missed} · Fazla çizilen: ${score.wrong}`,
            daily ? 'Yarın yeni bir paragraf gelecek.' : 'Antrenman: puan sayılmadı.',
          ]}
          onAgain={onAgain}
          onExit={onExit}
        >
          <p>
            <Stars n={score.stars} />
          </p>
          <p className="subtle">Yeşil: doğru çizdiklerin · kesik çizgi: kaçırdıkların · kırmızı: gereksiz çizdiklerin.</p>
        </Result>
      )}
    </div>
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
  const [wind, setWind] = useState(() => randomWind())
  const [results, setResults] = useState<TossEnd[]>([])
  const resultsRef = useRef<TossEnd[]>([])
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null)
  const [record, setRecord] = useState<{ points: number; best: boolean } | null>(null)
  const samples = useRef<Array<{ x: number; y: number; t: number }>>([])
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

  const over = results.length >= TOSS_THROWS
  const points = tossPoints(results)

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
        setRecord({ points: total, best: before === undefined || total > before })
        playSound('done')
      }
      setFlash(null)
      setFlying(false)
      setBall({ ...BALL_START, vx: 0, vy: 0 })
      setWind(randomWind())
    }, 700)
  }

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (flying || over) return
    const p = toScene(e)
    if (Math.hypot(p.x - BALL_START.x, p.y - BALL_START.y) > 90) return
    samples.current = [{ ...p, t: performance.now() }]
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!samples.current.length) return
    samples.current.push({ ...toScene(e), t: performance.now() })
    if (samples.current.length > 12) samples.current.shift()
  }
  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!samples.current.length) return
    const end = { ...toScene(e), t: performance.now() }
    const recent = samples.current.filter((s) => end.t - s.t <= 120)
    const from = recent[0] ?? samples.current[0]
    samples.current = []
    const launch = launchFromFlick(end.x - from.x, end.y - from.y, Math.max(16, end.t - from.t))
    if (launch) throwBall(launch.vx, launch.vy)
  }

  if (over && record)
    return (
      <div className="page page-narrow mola">
        <GameHead onExit={onExit} />
        <Result
          title={`${record.points} puan`}
          badge={record.best ? 'Yeni rekor!' : `${results.filter((r) => r === 'in').length}/${TOSS_THROWS} isabet`}
          lines={['Üst üste üç ve fazlası iki puan sayılır.']}
          onAgain={onAgain}
          onExit={onExit}
        />
      </div>
    )

  const windLabel = wind === 0 ? 'Rüzgâr yok' : `Rüzgâr ${wind > 0 ? '→' : '←'} ${Math.ceil(Math.abs(wind) / 40)}`
  return (
    <div className="page page-narrow mola">
      <GameHead onExit={onExit}>
        Atış {Math.min(results.length + 1, TOSS_THROWS)}/{TOSS_THROWS} · {points} puan
      </GameHead>
      <div className="mini-toss">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${TOSS_W} ${TOSS_H}`}
          className="mini-toss-scene"
          role="img"
          aria-label="Kâğıt topu yukarı doğru fırlat"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => (samples.current = [])}
        >
          <line x1="0" y1={BIN.bottom} x2={TOSS_W} y2={BIN.bottom} className="toss-floor" />
          <g className="toss-wind" aria-hidden="true">
            <text x={TOSS_W / 2} y="40" textAnchor="middle">
              {windLabel}
            </text>
          </g>
          <path d={`M${BIN.left - 4} ${BIN.rim} L${BIN.right + 4} ${BIN.rim} L${BIN.right - 4} ${BIN.bottom} L${BIN.left + 4} ${BIN.bottom} Z`} className="toss-bin" />
          <line x1={BIN.left - 6} y1={BIN.rim} x2={BIN.right + 6} y2={BIN.rim} className="toss-rim" />
          <g transform={`translate(${ball.x} ${ball.y})`} className="toss-ball">
            <polygon points="0,-13 7,-11 12,-5 13,2 9,9 2,13 -6,11 -12,6 -13,-2 -9,-9" />
            <path d="M-9 -6 L-2 -1 L-4 7 M-2 -1 L6 -8 M-2 -1 L9 4" />
          </g>
          {!flying && results.length === 0 && (
            <text x={BALL_START.x + 30} y={BALL_START.y - 40} className="toss-hint">
              Yukarı fırlat ↗
            </text>
          )}
          {flash && (
            <text x={TOSS_W / 2} y="200" textAnchor="middle" className={`toss-flash ${flash.good ? 'is-good' : 'is-bad'}`}>
              {flash.text}
            </text>
          )}
        </svg>
        <p className="subtle mini-hint">
          <Wind size={14} aria-hidden="true" /> Topa dokun, parmağını hızlıca yukarı doğru kaydırıp bırak.
        </p>
      </div>
    </div>
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
  const left = Math.max(0, DRAWER_SECONDS - Math.floor((now - startedAt) / 1000))

  const finish = (reason: 'time' | 'full' | 'diploma', g = grid, p = points) => {
    if (end) return
    const rec = readMiniRecords()
    const level = bestLevel(g)
    saveMiniRecords({ drawer: Math.max(rec.drawer ?? 0, p), drawerLevel: Math.max(rec.drawerLevel ?? 0, level) })
    setEnd({ reason, best: rec.drawer === undefined || p > rec.drawer })
    playSound('done')
  }
  useEffect(() => {
    if (left === 0) finish('time')
  }, [left])

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
      window.setTimeout(() => setPop(null), 300)
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

  const addItem = () => {
    if (end) return
    if (!grid.includes(null)) return
    after(grid, 0)
  }

  if (end)
    return (
      <div className="page page-narrow mola">
        <GameHead onExit={onExit} />
        <Result
          title={`${points} puan`}
          badge={end.reason === 'diploma' ? 'Diploma senin!' : end.best ? 'Yeni rekor!' : `En iyi eşya: ${DRAWER_ITEMS[bestLevel(grid) - 1]}`}
          lines={[end.reason === 'time' ? 'Süre doldu.' : end.reason === 'full' ? 'Çekmece doldu, birleştirecek eşya kalmadı.' : 'Kurşun kalemden diplomaya kadar geldin.']}
          onAgain={onAgain}
          onExit={onExit}
        />
      </div>
    )

  return (
    <div className="page page-narrow mola">
      <GameHead onExit={onExit}>
        {left} sn · {points} puan
      </GameHead>
      <p className="muted mini-hint">Bir eşyaya, sonra aynısına dokun: birleşip bir üst eşya olur. Her hamlede çekmeceye yeni bir eşya düşer.</p>
      <div className="mini-drawer" role="grid" aria-label="Çekmece">
        {grid.map((level, i) => {
          const Icon = level ? ITEM_ICONS[level - 1] : null
          const name = level ? DRAWER_ITEMS[level - 1] : 'Boş'
          return (
            <button
              key={i}
              className={`drawer-cell${level ? ` lv-${Math.min(level, 8)}` : ' is-empty'}${selected === i ? ' is-selected' : ''}${pop === i ? ' is-pop' : ''}`}
              onClick={() => tap(i)}
              aria-label={`${name}${selected === i ? ', seçili' : ''}`}
            >
              {Icon && <Icon size={26} aria-hidden="true" />}
              {level ? <span className="drawer-name">{name}</span> : null}
            </button>
          )
        })}
      </div>
      <div className="btn-row">
        <button className="btn" onClick={addItem} disabled={!grid.includes(null)}>
          <Notebook size={16} /> Yeni eşya düşür
        </button>
      </div>
      <ol className="drawer-ladder" aria-label="Eşya sırası">
        {DRAWER_ITEMS.map((name, i) => (
          <li key={name} className={bestLevel(grid) > i ? 'is-reached' : ''}>
            {name}
          </li>
        ))}
      </ol>
    </div>
  )
}
