import { ArrowLeft, Lock, Award, BookOpen, Crown, GraduationCap, Highlighter, NotebookPen, Pencil, PenLine, Play, Plus, RotateCcw, ScrollText, Sparkles, Star, Timer, Trash2, Trophy, Wind } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  bestLevel,
  canMerge,
  DRAWER_ITEMS,
  DRAWER_MAX,
  DRAWER_SECONDS,
  drawerStuck,
  CHAPTERS,
  chapterOpen,
  chapterStars,
  readDrawerProgress,
  saveChapterResult,
  findPair,
  pairCount,
  mergeItems,
  newDrawer,
  readMiniRecords,
  saveMiniRecords,
  spawnItem,
  type Drawer,
} from '../../lib/miniGames'
import { playSound } from '../../lib/sound'
import { Celebrate } from '../ui'
import { useTick } from './shared'
import { dailyTerm, MAX_GUESSES, readWordSave } from '../../lib/wordGame'

export type MiniGame = 'kavram' | 'cekmece'
export const MINI_GAMES: MiniGame[] = ['kavram', 'cekmece']

// ---------- Shared 3D Arcade Frame ----------

/** Top bar of a game: 3D keycap back button, title, and extruded score badge; 3D tube bar under it. */
export function GameFrame({ title, subtitle, onExit, score, progress, children }: { title: string; subtitle?: string; onExit: () => void; score?: ReactNode; progress?: number; children: ReactNode }) {
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
function GameOver({ title, points, unit = 'puan', badge, stars, stats, note, onAgain, againLabel = 'Tekrar oyna', onExit, exitLabel = 'Oyunlara dön' }: {
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
  exitLabel?: string
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
          {exitLabel}
        </button>
      </div>
    </div>
  )
}

// ---------- Hub (3D Study Desk Arcade) ----------

export function MiniHub({ onOpen, onExit }: { onOpen: (game: MiniGame) => void; onExit: () => void }) {
  const word = readWordSave()
  const drawer = readDrawerProgress()
  const drawerStars = drawer.stars.reduce((a, b) => a + b, 0)
  const drawerNext = drawer.stars.findIndex((n) => n === 0)
  const drawerChip = drawerNext === -1 ? 'Bütün bölümler bitti' : `Sıradaki: ${drawerNext + 1}. bölüm`
  return (
    <div className="page page-narrow mini-page">
      <div className="mini-hub-banner">
        <div className="mini-hub-head">
          <button className="mini-back" onClick={onExit} aria-label="Molaya dön">
            <ArrowLeft size={20} />
          </button>
          <div className="mini-hub-title-wrap">
            <h1>
              Mini <span className="hl">oyunlar</span>
            </h1>
            <p className="muted mini-hub-sub">Kart gerekmez. Birkaç dakikalık oyunlarla kafanı dağıt, derse taze dön.</p>
          </div>
          <span className="mini-vip">
            <Crown size={14} aria-hidden="true" /> VIP
          </span>
        </div>
      </div>

      <div className="mini-cards">
        <GameCard
          tag="GÜNLÜK"
          art={<WordArt />}
          title="Günün Kavramı"
          text="Her gün herkese aynı ders kavramı. Harf harf tahmin et; ders konusu baştan belli, takılırsan tanımı açılır."
          chips={[word.guesses.includes(dailyTerm().word) || word.guesses.length >= MAX_GUESSES ? 'Bugün çözüldü' : 'Bugünün kavramı hazır', `Seri: ${word.streak}`]}
          done={false}
          onOpen={() => onOpen('kavram')}
        />
        <GameCard
          tag="BİRLEŞTİRME"
          art={<DrawerArt />}
          title="Çekmece"
          text="Aynı eşyaları birleştir, bölüm bölüm ilerle. Kurşun kalemden başla, diplomaya ulaş."
          chips={[drawerChip, `${drawerStars}/${CHAPTERS.length * 3} yıldız`]}
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

/** A small letter board: today's term half found. */
function WordArt() {
  const cells = [
    ['M', 'hit'],
    ['A', 'miss'],
    ['Y', 'miss'],
    ['O', 'hit'],
    ['Z', 'hit'],
  ]
  const second = [
    ['M', 'hit'],
    ['İ', 'hit'],
    ['T', 'hit'],
    ['O', 'hit'],
    ['Z', 'hit'],
  ]
  return (
    <svg viewBox="0 0 360 150" className="art art-word">
      <rect x="0" y="0" width="360" height="150" className="kv-art-bg" />
      {[cells, second].map((row, r) =>
        row.map(([c, m], i) => (
          <g key={`${r}-${i}`} transform={`translate(${62 + i * 48} ${24 + r * 56})`}>
            <rect width="42" height="46" rx="9" className={`kv-art-tile is-${m}`} />
            <text x="21" y="31" textAnchor="middle" className={`kv-art-letter is-${m}`}>
              {c}
            </text>
          </g>
        )),
      )}
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

// ---------- Çekmece (3D Tactile Desk Organizer Merge) ----------

const ITEM_ICONS = [Pencil, PenLine, Highlighter, NotebookPen, BookOpen, ScrollText, GraduationCap, Award]
const SHORT_NAMES = ['Kurşun', 'Tükenmez', 'Fosforlu', 'Defter', 'Kitap', 'Ders Notu', 'Kep', 'Diploma']

export function DrawerGame({ onExit }: { onExit: () => void }) {
  // null = the chapter map; a number = that chapter; 'free' = endless play.
  const [play, setPlay] = useState<{ chapter: number | 'free'; n: number } | null>(null)
  if (!play) return <ChapterMap onExit={onExit} onPlay={(chapter) => setPlay({ chapter, n: Date.now() })} />
  const chapter = play.chapter === 'free' ? null : play.chapter
  const next = chapter !== null && chapter + 1 < CHAPTERS.length ? chapter + 1 : null
  return (
    <DrawerRound
      key={play.n}
      chapter={chapter}
      onExit={() => setPlay(null)}
      onAgain={() => setPlay({ chapter: play.chapter, n: Date.now() })}
      onNext={next !== null ? () => setPlay({ chapter: next, n: Date.now() }) : undefined}
    />
  )
}

/** Ten chapters with a target item each; finished ones show their stars, the next one is open. */
function ChapterMap({ onExit, onPlay }: { onExit: () => void; onPlay: (chapter: number | 'free') => void }) {
  const progress = readDrawerProgress()
  const total = progress.stars.reduce((a, b) => a + b, 0)
  const current = progress.stars.findIndex((s) => s === 0)
  const records = readMiniRecords()
  return (
    <GameFrame
      title="Çekmece"
      subtitle="Bölümleri geç, yıldız topla"
      onExit={onExit}
      score={
        <>
          <Star size={15} aria-hidden="true" /> {total}/{CHAPTERS.length * 3}
        </>
      }
    >
      <ol className="chapter-map" aria-label="Bölümler">
        {CHAPTERS.map((ch, i) => {
          const open = chapterOpen(progress, i)
          const Icon = ITEM_ICONS[ch.target - 1]
          return (
            <li key={i}>
              <button
                className={`chapter-tile${open ? '' : ' is-locked'}${i === current ? ' is-current' : ''}`}
                onClick={() => open && onPlay(i)}
                disabled={!open}
                aria-label={`${i + 1}. bölüm: ${DRAWER_ITEMS[ch.target - 1]}, ${ch.seconds} saniye${open ? '' : ', kilitli'}${progress.stars[i] ? `, ${progress.stars[i]} yıldız` : ''}`}
              >
                <span className="chapter-no">{i + 1}</span>
                <span className={`drawer-mini-tile lv-${ch.target}`}>{open ? <Icon size={20} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}</span>
                <span className="chapter-goal">{SHORT_NAMES[ch.target - 1]}</span>
                <span className="chapter-time">{ch.seconds} sn</span>
                <Stars n={progress.stars[i]} size={13} />
              </button>
            </li>
          )
        })}
      </ol>
      <button className="chapter-free" onClick={() => onPlay('free')}>
        <span>
          <strong>Serbest oyun</strong>
          <span className="muted">{DRAWER_SECONDS / 60} dakika, hedef yok: en yüksek puan</span>
        </span>
        <span className="mini-chip">{records.drawer !== undefined ? `Rekor: ${records.drawer}` : 'Rekor yok'}</span>
      </button>
    </GameFrame>
  )
}

function DrawerRound({ chapter, onExit, onAgain, onNext }: { chapter: number | null; onExit: () => void; onAgain: () => void; onNext?: () => void }) {
  const goal = chapter !== null ? CHAPTERS[chapter] : null
  const seconds = goal ? goal.seconds : DRAWER_SECONDS
  const target = goal ? goal.target : DRAWER_MAX
  const [grid, setGrid] = useState<Drawer>(() => newDrawer())
  const [selected, setSelected] = useState<number | null>(null)
  const [points, setPoints] = useState(0)
  const [pop, setPop] = useState<number | null>(null)
  const [startedAt] = useState(() => Date.now())
  const [end, setEnd] = useState<{ reason: 'time' | 'full' | 'diploma' | 'goal'; best: boolean; stars: number } | null>(null)
  const now = useTick(!end, 250)
  // Stuck for a few seconds with nothing picked: show one pair.
  const [lastMove, setLastMove] = useState(() => Date.now())
  const hint = !end && selected === null && now - lastMove > 4000 ? findPair(grid) : null
  const pairs = pairCount(grid)
  const leftMs = Math.max(0, seconds * 1000 - (now - startedAt))
  const left = Math.ceil(leftMs / 1000)
  const top = bestLevel(grid)

  const finish = (reason: 'time' | 'full' | 'diploma' | 'goal', g = grid, p = points) => {
    if (end) return
    if (goal) {
      const stars = reason === 'goal' ? chapterStars(seconds * 1000 - (Date.now() - startedAt), seconds * 1000) : 0
      if (stars) saveChapterResult(chapter!, stars)
      setEnd({ reason, best: false, stars })
      playSound(stars ? 'done' : 'wrong')
      return
    }
    const rec = readMiniRecords()
    saveMiniRecords({ drawer: Math.max(rec.drawer ?? 0, p), drawerLevel: Math.max(rec.drawerLevel ?? 0, bestLevel(g)) })
    setEnd({ reason, best: rec.drawer !== undefined && p > rec.drawer, stars: 0 })
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
    if (goal && bestLevel(spawned) >= target) finish('goal', spawned, total)
    else if (bestLevel(spawned) >= DRAWER_MAX) finish('diploma', spawned, total)
    else if (drawerStuck(spawned)) finish('full', spawned, total)
  }

  const tap = (i: number) => {
    if (end) return
    setLastMove(Date.now())
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

  if (end && goal) {
    const won = end.reason === 'goal'
    return (
      <GameFrame title="Çekmece" subtitle={`Bölüm ${chapter! + 1}`} onExit={onExit}>
        <GameOver
          title={won ? `${chapter! + 1}. bölüm tamam` : end.reason === 'time' ? 'Süre doldu' : 'Çekmece doldu'}
          points={points}
          stars={won ? end.stars : undefined}
          badge={won ? (end.stars === 3 ? 'Üç yıldız!' : 'Bölüm geçildi!') : undefined}
          stats={[
            ['Hedef', DRAWER_ITEMS[target - 1]],
            ['Ulaştığın', top ? DRAWER_ITEMS[top - 1] : '—'],
          ]}
          note={won ? (onNext ? 'Sonraki bölüm açıldı.' : 'Bütün bölümleri bitirdin! Serbest oyunda rekor kırabilirsin.') : 'Tekrar dene: önce küçük eşyaları birleştir, yer açılsın.'}
          onAgain={won && onNext ? onNext : onAgain}
          againLabel={won && onNext ? 'Sonraki bölüm' : 'Tekrar dene'}
          onExit={onExit}
          exitLabel="Bölümlere dön"
        />
      </GameFrame>
    )
  }

  if (end)
    return (
      <GameFrame title="Çekmece" subtitle="Serbest oyun" onExit={onExit}>
        <GameOver
          title={end.reason === 'time' ? 'Süre doldu' : end.reason === 'full' ? 'Çekmece doldu' : 'Diploma senin!'}
          points={points}
          badge={end.reason === 'diploma' ? 'Kurşun kalemden diplomaya!' : end.best ? 'Yeni rekor!' : undefined}
          stats={[
            ['En iyi eşya', top ? DRAWER_ITEMS[top - 1] : '—'],
            ['Rekor', Math.max(readMiniRecords().drawer ?? 0, points)],
          ]}
          onAgain={onAgain}
          onExit={onExit}
          exitLabel="Bölümlere dön"
        />
      </GameFrame>
    )

  const selectedLevel = selected !== null ? grid[selected] : null
  const nextLevelName = selectedLevel && selectedLevel < DRAWER_MAX ? DRAWER_ITEMS[selectedLevel] : null

  return (
    <GameFrame
      title="Çekmece"
      subtitle={goal ? `Bölüm ${chapter! + 1} · Hedef: ${DRAWER_ITEMS[target - 1]}` : `Serbest oyun · En yüksek: ${top ? DRAWER_ITEMS[top - 1] : '—'}`}
      onExit={onExit}
      progress={leftMs / (seconds * 1000)}
      score={
        <>
          <Timer size={15} aria-hidden="true" /> {left} sn · {points}
        </>
      }
    >
      {goal && (
        <div className="drawer-goal">
          <span className={`drawer-mini-tile lv-${target}`}>{(() => {
            const GoalIcon = ITEM_ICONS[target - 1]
            return <GoalIcon size={20} aria-hidden="true" />
          })()}</span>
          <span>
            Hedef: <strong>{DRAWER_ITEMS[target - 1]}</strong>
            <small>
              {' '}
              · şu an en iyi: {top ? DRAWER_ITEMS[top - 1] : '—'}
            </small>
          </span>
        </div>
      )}
      <div className="drawer-status-bar" aria-live="polite">
        {selectedLevel ? (
          <span className="drawer-status-active">
            <Sparkles size={15} aria-hidden="true" />
            <strong>{DRAWER_ITEMS[selectedLevel - 1]}</strong> seçili — başka bir <strong>{DRAWER_ITEMS[selectedLevel - 1]}</strong> ile birleştir
            {nextLevelName ? ` → ${nextLevelName}!` : ''}
          </span>
        ) : (
          <span className="drawer-status-idle">
            {pairs ? (
              <>
                <strong>{pairs} çift</strong> birleşebilir: aynı renkteki iki eşyaya dokun
              </>
            ) : (
              'Birleşecek çift yok: aşağıdan yeni eşya bırak'
            )}
          </span>
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
              const hinted = !!hint && (hint[0] === i || hint[1] === i)
              return (
                <button
                  key={i}
                  className={`drawer-slot${selected === i ? ' is-selected' : ''}${match ? ' is-match' : ''}${hinted ? ' is-hint' : ''}${pop === i ? ' is-pop' : ''}`}
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

      <button
        className="btn mini-wide mini-btn-3d-sec"
        onClick={() => {
          if (end || !grid.includes(null)) return
          setLastMove(Date.now())
          after(grid, 0)
        }}
        disabled={!grid.includes(null)}
      >
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
