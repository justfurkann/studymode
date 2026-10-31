import { ArrowLeft, Check, Grid2x2Check, NotebookPen, Pause, Play, RotateCcw, Square, Timer, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Celebrate } from '../components/ui'
import {
  addFocusMinutes,
  buildMatchBoard,
  cardsInScope,
  elapsedMinutes,
  FOCUS_CHOICES,
  focusLastWeek,
  formatClock,
  formatSeconds,
  isFinished,
  MATCH_MIN_PAIRS,
  MATCH_PENALTY_MS,
  matchPick,
  matchTime,
  nextQuickItem,
  PAGE_MINUTES,
  pauseTimer,
  QUICK_MIN_CARDS,
  QUICK_SECONDS,
  quickPoints,
  readRecords,
  readTimer,
  remainingMs,
  resumeTimer,
  saveMatchTime,
  saveQuickScore,
  scopeKey,
  startTimer,
  writeTimer,
  type FocusTimer,
  type MatchTile,
  type QuickItem,
} from '../lib/mola'
import { playSound } from '../lib/sound'
import { useStore } from '../lib/store'
import type { Card } from '../lib/types'
import { useLoadDemo } from '../lib/useDemo'

type Game = 'eslestir' | 'hizli' | 'odak'
const GAMES: Game[] = ['eslestir', 'hizli', 'odak']
const SCOPE_KEY = 'studymode.molaScope'

/** "Tekrar | Mola" switch at the top of the Tekrar tab. */
export function ReviewSwitch({ active }: { active: 'tekrar' | 'mola' }) {
  const navigate = useNavigate()
  return (
    <div className="segmented review-switch" role="tablist" aria-label="Tekrar bölümü">
      <button role="tab" aria-selected={active === 'tekrar'} onClick={() => navigate('/tekrar')}>
        Tekrar
      </button>
      <button role="tab" aria-selected={active === 'mola'} onClick={() => navigate('/tekrar?bolum=mola')}>
        Mola
      </button>
    </div>
  )
}

function useTick(active: boolean, ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [active, ms])
  return now
}

function readScope(): string | null {
  try {
    return localStorage.getItem(SCOPE_KEY) || null
  } catch {
    return null
  }
}

export function Mola() {
  const store = useStore()
  const loadDemo = useLoadDemo()
  const [params, setParams] = useSearchParams()
  const game = GAMES.find((g) => g === params.get('oyun')) ?? null
  const [scope, setScopeState] = useState<string | null>(readScope)

  const courses = useMemo(
    () =>
      store.data.courses
        .map((course) => ({ course, count: cardsInScope(store.data.cards, course.id).length }))
        .filter((c) => c.count > 0),
    [store.data.courses, store.data.cards],
  )
  // A remembered course that has no cards any more falls back to all courses.
  const courseId = scope && courses.some((c) => c.course.id === scope) ? scope : null
  const cards = useMemo(() => cardsInScope(store.data.cards, courseId), [store.data.cards, courseId])

  function setScope(value: string | null) {
    setScopeState(value)
    try {
      if (value) localStorage.setItem(SCOPE_KEY, value)
      else localStorage.removeItem(SCOPE_KEY)
    } catch {
      // Blocked storage: the choice lasts for this visit.
    }
  }
  const open = (next: Game | null) => {
    const p = new URLSearchParams(params)
    if (next) p.set('oyun', next)
    else p.delete('oyun')
    setParams(p)
  }
  const exit = () => open(null)

  if (game === 'eslestir' && cards.length >= MATCH_MIN_PAIRS) return <MatchGame cards={cards} courseId={courseId} onExit={exit} />
  if (game === 'hizli' && cards.length >= QUICK_MIN_CARDS) return <QuickGame cards={cards} courseId={courseId} onExit={exit} />
  if (game === 'odak') return <FocusNotebook onExit={exit} />

  const records = readRecords()
  const key = scopeKey(courseId)
  const timer = readTimer()
  const scopeName = courseId ? courses.find((c) => c.course.id === courseId)?.course.name : null

  return (
    <div className="page page-narrow mola">
      <ReviewSwitch active="mola" />
      <div className="page-header">
        <div>
          <h1>
            Kısa bir <span className="hl">mola</span>
          </h1>
          <p className="muted">Kendi kartlarınla iki dakikalık oyunlar ve bir odak sayacı. Oyunlar tekrar planını değiştirmez, ama serini korur.</p>
        </div>
      </div>

      {courses.length > 1 && (
        <label className="field mola-scope">
          <span>Hangi dersin kartları?</span>
          <select className="select" value={courseId ?? ''} onChange={(e) => setScope(e.target.value || null)}>
            <option value="">Tüm dersler ({cardsInScope(store.data.cards, null).length} kart)</option>
            {courses.map(({ course, count }) => (
              <option key={course.id} value={course.id}>
                {course.name} ({count} kart)
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mola-grid">
        <MolaTile
          icon={<Grid2x2Check size={22} />}
          title="Eşleştir"
          text="Kavramları cevaplarıyla eşleştir, süreye karşı. Yanlış eşleşme +2 saniye."
          meta={records.match[key] !== undefined ? `Rekor: ${formatSeconds(records.match[key])}` : 'Henüz rekor yok'}
          locked={cards.length < MATCH_MIN_PAIRS ? `En az ${MATCH_MIN_PAIRS} kart gerekiyor` : null}
          onOpen={() => open('eslestir')}
        />
        <MolaTile
          icon={<Zap size={22} />}
          title="Hızlı tur"
          text={`${QUICK_SECONDS} saniye: gösterilen cevap doğru mu, yanlış mı? Üst üste doğrular çift puan.`}
          meta={records.quick[key] ? `Rekor: ${records.quick[key]} puan` : 'Henüz rekor yok'}
          locked={cards.length < QUICK_MIN_CARDS ? `En az ${QUICK_MIN_CARDS} kart gerekiyor` : null}
          onOpen={() => open('hizli')}
        />
        <MolaTile
          icon={<NotebookPen size={22} />}
          title="Odak defteri"
          text="25 ya da 50 dakika çalış; geçen her dakika defterde bir kareyi boyar."
          meta={
            timer
              ? isFinished(timer)
                ? 'Sayfa doldu, görmek için aç'
                : `Sayaç ${timer.endsAt === null ? 'duraklatıldı' : 'çalışıyor'}: ${formatClock(remainingMs(timer))}`
              : `Son 7 gün: ${focusLastWeek(records.focus)} dk`
          }
          locked={null}
          onOpen={() => open('odak')}
        />
      </div>

      {cards.length < QUICK_MIN_CARDS && (
        <div className="panel mola-empty">
          <p className="muted">
            {store.data.cards.length
              ? 'Oyunlar için birbirinden farklı birkaç kart gerekiyor. Notlarından biraz daha kart oluştur.'
              : 'Oyunlar senin kartlarınla oynanır. Bir not ekle; kartlar ondan oluşsun.'}
          </p>
          <div className="btn-row">
            <Link to="/not-ekle" className="btn btn-sm">
              Not ekle
            </Link>
            {!store.data.courses.length && (
              <button className="btn btn-sm" onClick={loadDemo}>
                Örnek notla dene
              </button>
            )}
          </div>
        </div>
      )}
      {scopeName && <p className="subtle">Oyunlar yalnızca {scopeName} kartlarından gelir. Rekorlar ders başına ayrı tutulur.</p>}
    </div>
  )
}

function MolaTile({ icon, title, text, meta, locked, onOpen }: { icon: ReactNode; title: string; text: string; meta: string; locked: string | null; onOpen: () => void }) {
  return (
    <button className="mola-tile" onClick={onOpen} disabled={!!locked} aria-label={title}>
      <span className="mola-tile-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mola-tile-body">
        <strong>{title}</strong>
        <span className="muted">{text}</span>
        <span className="subtle">{locked ?? meta}</span>
      </span>
    </button>
  )
}

function GameHead({ onExit, children }: { onExit: () => void; children?: ReactNode }) {
  return (
    <div className="section-head mola-head">
      <button className="back-link" onClick={onExit}>
        <ArrowLeft size={16} /> Molaya dön
      </button>
      <span className="subtle mola-stats">{children}</span>
    </div>
  )
}

function Result({ title, best, lines, onAgain, onExit, children }: { title: string; best: boolean; lines: string[]; onAgain: () => void; onExit: () => void; children?: ReactNode }) {
  return (
    <div className="panel study-done mola-result" role="status">
      <div className="study-done-mark" aria-hidden="true">
        <Check size={32} strokeWidth={3} />
      </div>
      <strong className="mola-result-title">{title}</strong>
      <p>{best ? <Celebrate>Yeni rekor!</Celebrate> : <Celebrate>Tamamlandı</Celebrate>}</p>
      {lines.map((line) => (
        <p key={line} className="muted">
          {line}
        </p>
      ))}
      {children}
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onAgain}>
          <RotateCcw size={16} /> Tekrar oyna
        </button>
        <button className="btn" onClick={onExit}>
          Molaya dön
        </button>
      </div>
    </div>
  )
}

// ---------- Eşleştir ----------

function MatchGame({ cards, courseId, onExit }: { cards: Card[]; courseId: string | null; onExit: () => void }) {
  const [round, setRound] = useState(0)
  return <MatchRound key={round} cards={cards} courseId={courseId} onExit={onExit} onAgain={() => setRound((n) => n + 1)} />
}

function MatchRound({ cards, courseId, onExit, onAgain }: { cards: Card[]; courseId: string | null; onExit: () => void; onAgain: () => void }) {
  const store = useStore()
  // The board is fixed for the round, even if cards change meanwhile.
  const [tiles] = useState<MatchTile[]>(() => buildMatchBoard(cards))
  const [startedAt] = useState(() => Date.now())
  const [selected, setSelected] = useState<MatchTile | null>(null)
  const [matched, setMatched] = useState<Set<string>>(() => new Set())
  const [miss, setMiss] = useState<string[]>([])
  const [misses, setMisses] = useState(0)
  const [result, setResult] = useState<{ total: number; best: boolean; previous: number | undefined } | null>(null)
  const missTimer = useRef<number | undefined>(undefined)
  const now = useTick(!result, 100)
  const pairs = tiles.length / 2

  useEffect(() => () => window.clearTimeout(missTimer.current), [])

  function tap(tile: MatchTile) {
    if (result || matched.has(tile.cardId)) return
    const pick = matchPick(selected, tile)
    if (pick === 'select') {
      setSelected(selected?.id === tile.id ? null : tile)
      return
    }
    setSelected(null)
    if (pick === 'miss') {
      playSound('wrong')
      setMisses((n) => n + 1)
      setMiss([selected!.id, tile.id])
      window.clearTimeout(missTimer.current)
      missTimer.current = window.setTimeout(() => setMiss([]), 450)
      return
    }
    playSound('right')
    const next = new Set(matched).add(tile.cardId)
    setMatched(next)
    if (next.size === pairs) {
      const total = matchTime(Date.now() - startedAt, misses)
      const previous = readRecords().match[scopeKey(courseId)]
      const best = saveMatchTime(courseId, total)
      store.recordActivity()
      setResult({ total, best, previous })
    }
  }

  if (result) {
    return (
      <div className="page page-narrow mola">
        <GameHead onExit={onExit} />
        <Result
          title={formatSeconds(result.total)}
          best={result.best}
          lines={[
            misses ? `${misses} yanlış eşleşme (+${(misses * MATCH_PENALTY_MS) / 1000} sn)` : 'Hiç yanlış eşleşme yok.',
            result.best && result.previous !== undefined ? `Önceki rekorun: ${formatSeconds(result.previous)}` : result.best ? 'İlk rekorun bu.' : `Rekorun: ${formatSeconds(result.previous ?? result.total)}`,
          ]}
          onAgain={onAgain}
          onExit={onExit}
        />
      </div>
    )
  }

  return (
    <div className="page page-narrow mola">
      <GameHead onExit={onExit}>
        <Timer size={15} aria-hidden /> {formatSeconds(matchTime(now - startedAt, misses))}
        {misses > 0 && ` · ${misses} yanlış`}
        {` · ${matched.size}/${pairs}`}
      </GameHead>
      <h1 className="mola-title">Eşleştir</h1>
      <p className="subtle">Bir kavrama, sonra onun cevabına dokun.</p>
      <div className="match-board" role="group" aria-label="Eşleştirme kartları">
        {tiles.map((tile) => {
          const done = matched.has(tile.cardId)
          return (
            <button
              key={tile.id}
              className={`match-tile ${tile.side === 'front' ? 'is-front' : 'is-back'}${done ? ' is-matched' : ''}${miss.includes(tile.id) ? ' is-miss' : ''}`}
              aria-pressed={selected?.id === tile.id}
              disabled={done}
              onClick={() => tap(tile)}
            >
              {tile.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Hızlı tur ----------

function QuickGame({ cards, courseId, onExit }: { cards: Card[]; courseId: string | null; onExit: () => void }) {
  const [round, setRound] = useState(0)
  return <QuickRound key={round} cards={cards} courseId={courseId} onExit={onExit} onAgain={() => setRound((n) => n + 1)} />
}

function QuickRound({ cards, courseId, onExit, onAgain }: { cards: Card[]; courseId: string | null; onExit: () => void; onAgain: () => void }) {
  const store = useStore()
  const [deck] = useState(cards)
  const [endsAt] = useState(() => Date.now() + QUICK_SECONDS * 1000)
  const [item, setItem] = useState<QuickItem | null>(() => nextQuickItem(deck))
  const [count, setCount] = useState(0)
  const [score, setScore] = useState(0)
  const [right, setRight] = useState(0)
  const [streak, setStreak] = useState(0)
  const [missed, setMissed] = useState<QuickItem[]>([])
  const [last, setLast] = useState<{ ok: boolean; item: QuickItem } | null>(null)
  const [result, setResult] = useState<{ best: boolean; previous: number } | null>(null)
  const now = useTick(!result, 200)
  const left = Math.max(0, endsAt - now)

  useEffect(() => {
    if (result || left > 0) return
    const previous = readRecords().quick[scopeKey(courseId)] ?? 0
    const best = saveQuickScore(courseId, score)
    if (count > 0) store.recordActivity()
    setResult({ best, previous })
  }, [left, result, courseId, score, count, store])

  function answer(sayTrue: boolean) {
    if (!item || result || Date.now() >= endsAt) return
    const ok = sayTrue === item.correct
    playSound(ok ? 'right' : 'wrong')
    if (ok) {
      setScore((s) => s + quickPoints(streak))
      setRight((n) => n + 1)
      setStreak((n) => n + 1)
    } else {
      setStreak(0)
      setMissed((list) => (list.some((m) => m.cardId === item.cardId) ? list : [...list, item]))
    }
    setLast({ ok, item })
    setCount((n) => n + 1)
    setItem(nextQuickItem(deck, Math.random, item.cardId))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select')) return
      if (event.key === 'ArrowRight') answer(true)
      if (event.key === 'ArrowLeft') answer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (result) {
    return (
      <div className="page page-narrow mola">
        <GameHead onExit={onExit} />
        <Result
          title={`${score} puan`}
          best={result.best}
          lines={[
            count ? `${count} sorudan ${right} tanesini bildin.` : 'Bu turda hiç cevap vermedin.',
            result.best ? (result.previous ? `Önceki rekorun: ${result.previous} puan` : 'İlk rekorun bu.') : `Rekorun: ${result.previous} puan`,
          ]}
          onAgain={onAgain}
          onExit={onExit}
        >
          {missed.length > 0 && (
            <div className="quick-missed">
              <strong>Kaçırdıkların</strong>
              <ul>
                {missed.map((m) => (
                  <li key={m.cardId}>
                    <span>{m.prompt}</span>
                    <span className="muted">{m.answer}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Result>
      </div>
    )
  }

  return (
    <div className="page page-narrow mola">
      <GameHead onExit={onExit}>
        <Timer size={15} aria-hidden /> {Math.ceil(left / 1000)} sn · {score} puan
      </GameHead>
      <div className="progress" aria-hidden>
        <div style={{ width: `${(left / (QUICK_SECONDS * 1000)) * 100}%` }} />
      </div>
      {item && (
        <article key={count} className="flashcard quick-card" aria-live="polite">
          <span className="subtle">Bu cevap bu soruya mı ait?</span>
          <p className="front">{item.prompt}</p>
          <p className="back">{item.shown}</p>
        </article>
      )}
      <div className="quick-answers">
        <button className="btn btn-lg quick-no" onClick={() => answer(false)}>
          <X size={18} /> Yanlış
        </button>
        <button className="btn btn-lg quick-yes" onClick={() => answer(true)}>
          <Check size={18} /> Doğru
        </button>
      </div>
      <p className="subtle quick-feedback" role="status">
        {streak >= 2 && <span className="chip quick-combo">Seri: {streak} · sıradaki doğru 2 puan</span>}{' '}
        {last ? (last.ok ? 'Az önceki: bildin.' : `Az önceki: ${last.item.prompt} → ${last.item.answer}`) : 'Klavyede: ← yanlış, → doğru.'}
      </p>
    </div>
  )
}

// ---------- Odak defteri ----------

function FocusNotebook({ onExit }: { onExit: () => void }) {
  const store = useStore()
  const [timer, setTimerState] = useState<FocusTimer | null>(readTimer)
  const [choice, setChoice] = useState<number>(() => readTimer()?.minutes ?? FOCUS_CHOICES[0])
  const [finished, setFinished] = useState<number | null>(null)
  const [records, setRecords] = useState(readRecords)
  const now = useTick(!!timer && timer.endsAt !== null, 1000)

  function setTimer(next: FocusTimer | null) {
    writeTimer(next)
    setTimerState(next)
  }

  // A session that ended (even while the student was on another page) is credited once.
  useEffect(() => {
    if (!timer || !isFinished(timer, now)) return
    // The stored timer is the single source of truth, so a session is never credited twice
    // (another tab, or React running the effect again, may have handled it already).
    const stored = readTimer()
    if (!stored || !isFinished(stored, now)) {
      setTimerState(stored)
      return
    }
    writeTimer(null)
    setTimerState(null)
    addFocusMinutes(stored.minutes)
    store.recordActivity()
    setRecords(readRecords())
    setFinished(stored.minutes)
  }, [timer, now, store])

  useEffect(() => {
    if (!timer) return
    const before = document.title
    document.title = `${formatClock(remainingMs(timer, now))} · Odak · StudyMode`
    return () => {
      document.title = before
    }
  }, [timer, now])

  function stop() {
    const current = readTimer()
    if (!current) return setTimerState(null)
    const minutes = elapsedMinutes(current)
    addFocusMinutes(minutes)
    setRecords(readRecords())
    setTimer(null)
  }

  const week = focusLastWeek(records.focus)
  const minutes = timer?.minutes ?? choice
  const filled = timer ? elapsedMinutes(timer, now) : finished === minutes ? minutes : 0

  return (
    <div className="page page-narrow mola">
      <GameHead onExit={onExit}>
        Son 7 gün: {week} dk · {Math.floor(week / PAGE_MINUTES)} dolu sayfa
      </GameHead>
      <h1 className="mola-title">Odak defteri</h1>

      {finished !== null && !timer ? (
        <p>
          Sayfa <Celebrate>doldu!</Celebrate> {finished} dakika odaklandın. Kısa bir ara ver, su iç.
        </p>
      ) : (
        <p className="subtle">Telefonu kenara koy. Geçen her dakika bir kareyi fosforlu kalemle boyar; başka sayfaya geçsen de sayaç işler.</p>
      )}

      {!timer && (
        <div className="segmented" role="group" aria-label="Süre">
          {FOCUS_CHOICES.map((m) => (
            <button
              key={m}
              aria-pressed={choice === m}
              onClick={() => {
                setChoice(m)
                setFinished(null)
              }}
            >
              {m} dakika
            </button>
          ))}
        </div>
      )}

      <div className="focus-page panel">
        <div className="focus-clock" aria-live="off">
          {formatClock(timer ? remainingMs(timer, now) : minutes * 60_000)}
        </div>
        <div className={`focus-grid cols-${minutes > PAGE_MINUTES ? 10 : 5}`} role="img" aria-label={`${minutes} karenin ${filled} tanesi boyandı`}>
          {Array.from({ length: minutes }, (_, i) => (
            <span key={i} className={i < filled ? 'is-filled' : i === filled && timer?.endsAt ? 'is-now' : ''} />
          ))}
        </div>
      </div>

      <div className="btn-row focus-actions">
        {!timer && (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              setFinished(null)
              setTimer(startTimer(choice))
            }}
          >
            <Play size={18} /> {finished !== null ? 'Bir sayfa daha' : 'Başla'}
          </button>
        )}
        {timer?.endsAt !== null && timer && (
          <button className="btn btn-lg" onClick={() => setTimer(pauseTimer(timer))}>
            <Pause size={18} /> Duraklat
          </button>
        )}
        {timer && timer.endsAt === null && (
          <button className="btn btn-primary btn-lg" onClick={() => setTimer(resumeTimer(timer))}>
            <Play size={18} /> Devam et
          </button>
        )}
        {timer && (
          <button className="btn btn-lg" onClick={stop}>
            <Square size={16} /> Bitir
          </button>
        )}
      </div>
      {timer && <p className="subtle">Erken bitirirsen geçen dakikalar yine haftalık toplamına eklenir.</p>}
    </div>
  )
}
