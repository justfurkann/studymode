import { Check, Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buildMatchColumns, formatSeconds, MATCH_PENALTY_MS, matchPick, matchTime, readRecords, saveMatchTime, scopeKey, type MatchTile } from '../../lib/mola'
import { playSound } from '../../lib/sound'
import { useStore } from '../../lib/store'
import type { Card } from '../../lib/types'
import { GameHead, Result, useTick } from './shared'

export function MatchGame({ cards, courseId, onExit }: { cards: Card[]; courseId: string | null; onExit: () => void }) {
  const [round, setRound] = useState(0)
  return <MatchRound key={round} cards={cards} courseId={courseId} onExit={onExit} onAgain={() => setRound((n) => n + 1)} />
}

/**
 * Terms on the left, answers on the right. Pick one on each side: a right pair turns green with a
 * tick and stays in place (so nothing jumps around), a wrong pair shakes red and costs 2 seconds.
 */
function MatchRound({ cards, courseId, onExit, onAgain }: { cards: Card[]; courseId: string | null; onExit: () => void; onAgain: () => void }) {
  const store = useStore()
  // The board is fixed for the round, even if cards change meanwhile.
  const [{ fronts, backs }] = useState(() => buildMatchColumns(cards))
  const [startedAt] = useState(() => Date.now())
  const [selected, setSelected] = useState<MatchTile | null>(null)
  const [matched, setMatched] = useState<Set<string>>(() => new Set())
  const [justMatched, setJustMatched] = useState<string | null>(null)
  const [miss, setMiss] = useState<string[]>([])
  const [misses, setMisses] = useState(0)
  const [result, setResult] = useState<{ total: number; best: boolean; previous: number | undefined } | null>(null)
  const timers = useRef<number[]>([])
  const now = useTick(!result, 100)
  const pairs = fronts.length

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

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
      later(() => setMiss([]), 500)
      return
    }
    playSound('right')
    const next = new Set(matched).add(tile.cardId)
    setMatched(next)
    setJustMatched(tile.cardId)
    later(() => setJustMatched(null), 600)
    if (next.size === pairs) {
      const total = matchTime(Date.now() - startedAt, misses)
      const previous = readRecords().match[scopeKey(courseId)]
      const best = saveMatchTime(courseId, total)
      store.recordActivity()
      // Let the last pair turn green before the result appears.
      later(() => setResult({ total, best, previous }), 500)
    }
  }

  if (result) {
    return (
      <div className="page page-narrow mola">
        <GameHead onExit={onExit} />
        <Result
          title={formatSeconds(result.total)}
          badge={result.best ? 'Yeni rekor!' : 'Tamamlandı'}
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

  const tileButton = (tile: MatchTile) => {
    const done = matched.has(tile.cardId)
    const state = done ? (justMatched === tile.cardId ? ' is-matched is-pop' : ' is-matched') : miss.includes(tile.id) ? ' is-miss' : ''
    return (
      <button
        key={tile.id}
        className={`match-tile ${tile.side === 'front' ? 'is-front' : 'is-back'}${state}`}
        aria-pressed={selected?.id === tile.id}
        disabled={done}
        onClick={() => tap(tile)}
      >
        {done && <Check size={14} strokeWidth={3} className="match-check" aria-hidden="true" />}
        <span>{tile.text}</span>
      </button>
    )
  }

  return (
    <div className="page page-narrow mola">
      <GameHead onExit={onExit}>
        <Timer size={15} aria-hidden /> {formatSeconds(matchTime(now - startedAt, misses))}
        {misses > 0 && ` · ${misses} yanlış`}
      </GameHead>
      <div className="match-top">
        <h1 className="mola-title">Eşleştir</h1>
        <span className="chip" aria-live="polite">
          {matched.size}/{pairs} eşleşti
        </span>
      </div>
      <div className="progress" aria-hidden>
        <div style={{ width: `${(matched.size / pairs) * 100}%` }} />
      </div>
      <p className="subtle">{selected ? (selected.side === 'front' ? 'Şimdi sağdan cevabını seç.' : 'Şimdi soldan kavramını seç.') : 'Soldan bir kavram, sağdan onun cevabını seç.'}</p>
      <div className="match-board" role="group" aria-label="Eşleştirme kartları">
        <div className="match-col" role="group" aria-label="Kavramlar">
          <span className="match-col-head">Kavram</span>
          {fronts.map(tileButton)}
        </div>
        <div className="match-col" role="group" aria-label="Cevaplar">
          <span className="match-col-head">Cevap</span>
          {backs.map(tileButton)}
        </div>
      </div>
    </div>
  )
}
