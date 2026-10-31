import { Check, Timer, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { nextQuickItem, QUICK_LIVES, QUICK_SECONDS, quickPoints, readRecords, saveQuickScore, scopeKey, type QuickItem } from '../../lib/mola'
import { playSound } from '../../lib/sound'
import { useStore } from '../../lib/store'
import type { Card } from '../../lib/types'
import { GameHead, Result, useTick } from './shared'

/** How far (px) a card has to travel before letting go counts as an answer. */
const SWIPE_AT = 90

export function QuickGame({ cards, courseId, onExit }: { cards: Card[]; courseId: string | null; onExit: () => void }) {
  const [round, setRound] = useState(0)
  return <QuickRound key={round} cards={cards} courseId={courseId} onExit={onExit} onAgain={() => setRound((n) => n + 1)} />
}

/** Three boxes; each wrong answer stamps the next one with a cross. */
function Lives({ wrong }: { wrong: number }) {
  return (
    <div className="lives" role="img" aria-label={`Kalan hak: ${QUICK_LIVES - wrong}/${QUICK_LIVES}`}>
      {Array.from({ length: QUICK_LIVES }, (_, i) => (
        <span key={i} className={`life ${i < wrong ? 'is-lost' : ''}`}>
          {i < wrong && <X size={18} strokeWidth={3.5} />}
        </span>
      ))}
    </div>
  )
}

/**
 * Swipe right for "doğru", left for "yanlış" (or tap the buttons, or use the arrow keys).
 * The screen flashes green or red after each answer. Three wrong answers or 60 seconds end it.
 */
function QuickRound({ cards, courseId, onExit, onAgain }: { cards: Card[]; courseId: string | null; onExit: () => void; onAgain: () => void }) {
  const store = useStore()
  const [deck] = useState(cards)
  const [endsAt] = useState(() => Date.now() + QUICK_SECONDS * 1000)
  const [item, setItem] = useState<QuickItem | null>(() => nextQuickItem(deck))
  const [count, setCount] = useState(0)
  const [score, setScore] = useState(0)
  const [right, setRight] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [streak, setStreak] = useState(0)
  const [missed, setMissed] = useState<QuickItem[]>([])
  const [last, setLast] = useState<{ ok: boolean; item: QuickItem } | null>(null)
  const [flash, setFlash] = useState<{ ok: boolean; n: number } | null>(null)
  const [drag, setDrag] = useState(0)
  /** Changes only when a new card comes in, so the leaving card keeps its own element. */
  const [cardKey, setCardKey] = useState(0)
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null)
  const [result, setResult] = useState<{ best: boolean; previous: number; why: 'time' | 'lives' } | null>(null)
  const start = useRef<{ x: number; id: number } | null>(null)
  const pending = useRef<number[]>([])
  const now = useTick(!result, 200)
  const left = Math.max(0, endsAt - now)

  useEffect(() => () => pending.current.forEach((t) => window.clearTimeout(t)), [])

  function finish(why: 'time' | 'lives', finalScore: number, answered: number) {
    const previous = readRecords().quick[scopeKey(courseId)] ?? 0
    const best = saveQuickScore(courseId, finalScore)
    if (answered > 0) store.recordActivity()
    setResult({ best, previous, why })
  }

  useEffect(() => {
    if (result || left > 0) return
    finish('time', score, count)
  }, [left, result])

  function answer(sayTrue: boolean) {
    if (!item || result || leaving || Date.now() >= endsAt) return
    const ok = sayTrue === item.correct
    playSound(ok ? 'right' : 'wrong')
    const nextScore = ok ? score + quickPoints(streak) : score
    const nextWrong = ok ? wrong : wrong + 1
    if (ok) {
      setScore(nextScore)
      setRight((n) => n + 1)
      setStreak((n) => n + 1)
    } else {
      setWrong(nextWrong)
      setStreak(0)
      setMissed((list) => (list.some((m) => m.cardId === item.cardId) ? list : [...list, item]))
    }
    setLast({ ok, item })
    setFlash({ ok, n: count })
    setCount((n) => n + 1)
    // The card flies off in the direction it was sent, then the next one comes in.
    setLeaving(sayTrue ? 'right' : 'left')
    pending.current.push(
      window.setTimeout(() => {
        setLeaving(null)
        setDrag(0)
        if (nextWrong >= QUICK_LIVES) finish('lives', nextScore, count + 1)
        else {
          setItem(nextQuickItem(deck, Math.random, item.cardId))
          setCardKey((k) => k + 1)
        }
      }, 220),
    )
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

  function onDown(event: PointerEvent<HTMLElement>) {
    if (leaving) return
    start.current = { x: event.clientX, id: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onMove(event: PointerEvent<HTMLElement>) {
    if (start.current?.id === event.pointerId) setDrag(event.clientX - start.current.x)
  }
  function onUp(event: PointerEvent<HTMLElement>) {
    if (start.current?.id !== event.pointerId) return
    const dx = event.clientX - start.current.x
    start.current = null
    if (Math.abs(dx) >= SWIPE_AT) answer(dx > 0)
    else setDrag(0)
  }

  if (result) {
    return (
      <div className="page page-narrow mola">
        <GameHead onExit={onExit} />
        <Result
          title={`${score} puan`}
          badge={result.best ? 'Yeni rekor!' : result.why === 'lives' ? 'Haklar bitti' : 'Süre bitti'}
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

  const lean = Math.max(-1, Math.min(1, drag / SWIPE_AT))
  const style = leaving ? undefined : { transform: `translateX(${drag}px) rotate(${drag / 18}deg)`, transition: start.current ? 'none' : undefined }

  return (
    <div className="page page-narrow mola quick">
      {flash && <div key={flash.n} className={`quick-flash ${flash.ok ? 'is-ok' : 'is-bad'}`} aria-hidden="true" />}
      <GameHead onExit={onExit}>
        <Timer size={15} aria-hidden /> {Math.ceil(left / 1000)} sn · {score} puan
      </GameHead>
      <div className="quick-top">
        <Lives wrong={wrong} />
        {streak >= 2 && <span className="chip quick-combo">Seri: {streak} · sıradaki 2 puan</span>}
      </div>
      <div className="progress" aria-hidden>
        <div style={{ width: `${(left / (QUICK_SECONDS * 1000)) * 100}%` }} />
      </div>
      {item && (
        <article
          key={cardKey}
          className={`flashcard quick-card${leaving ? ` is-leaving-${leaving}` : ''}`}
          style={style}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-live="polite"
        >
          <span className="quick-stamp is-yes" style={{ opacity: Math.max(0, lean) }} aria-hidden="true">
            Doğru
          </span>
          <span className="quick-stamp is-no" style={{ opacity: Math.max(0, -lean) }} aria-hidden="true">
            Yanlış
          </span>
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
      <p className={`quick-feedback ${last ? (last.ok ? 'is-ok' : 'is-bad') : 'subtle'}`} role="status">
        {last ? (last.ok ? 'Doğru bildin!' : `Yanlış. ${last.item.prompt} → ${last.item.answer}`) : 'Kartı sağa kaydır: doğru. Sola kaydır: yanlış.'}
      </p>
    </div>
  )
}
