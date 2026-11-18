import { Check, Copy, CornerDownLeft, Delete, Flame, Lightbulb, Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { istanbulDay } from '../../lib/miniGames'
import { playSound } from '../../lib/sound'
import { addGuess, checkGuess, CLUE_AFTER, cleanGuess, dailyTerm, letterMarks, markGuess, MAX_GUESSES, readWordSave, shareText, writeWordSave, type Mark } from '../../lib/wordGame'
import { GameFrame } from './MiniGames'

const KEY_ROWS = [
  ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
  ['Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç'],
]

const MARK_LABEL: Record<Mark, string> = { hit: 'doğru yerde', near: 'kelimede var, yeri başka', miss: 'kelimede yok' }

/**
 * Günün Kavramı: guess the day's study term. Letters in the right place get the highlighter,
 * letters in the word but elsewhere get a dashed frame, the rest fade.
 */
export function WordGame({ onExit }: { onExit: () => void }) {
  const today = istanbulDay()
  const term = useMemo(() => dailyTerm(), [])
  const answer = term.word
  const length = [...answer].length
  const [save, setSave] = useState(() => readWordSave(today))
  const [typed, setTyped] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [copied, setCopied] = useState(false)

  const won = save.guesses.includes(answer)
  const over = won || save.guesses.length >= MAX_GUESSES
  const wrong = save.guesses.filter((g) => g !== answer).length
  const clueOpen = over || wrong >= CLUE_AFTER
  const keys = letterMarks(save.guesses, answer)

  const say = (text: string) => {
    setNotice(text)
    setShake(true)
    window.setTimeout(() => setShake(false), 400)
  }

  const press = (key: string) => {
    if (over) return
    setNotice(null)
    if (key === 'SIL') return setTyped((t) => [...t].slice(0, -1).join(''))
    if (key === 'GİR') {
      const problem = checkGuess(typed, answer, save.guesses)
      if (problem === 'short') return say(`Kavram ${length} harfli`)
      if (problem === 'repeat') return say('Bunu zaten denedin')
      const next = addGuess(save, typed, answer)
      writeWordSave(next)
      setSave(next)
      setTyped('')
      const done = typed === answer || next.guesses.length >= MAX_GUESSES
      playSound(typed === answer ? 'done' : done ? 'wrong' : 'flip')
      if (!done && next.guesses.filter((g) => g !== answer).length === CLUE_AFTER) setNotice('İpucu açıldı')
      return
    }
    setTyped((t) => ([...t].length >= length ? t : t + key))
  }

  // A real keyboard works too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typeof e.key !== 'string') return
      if (e.key === 'Enter') return press('GİR')
      if (e.key === 'Backspace') return press('SIL')
      const letter = cleanGuess(e.key)
      if ([...letter].length === 1) press(letter)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText(today, save.guesses, answer, won, wrong >= CLUE_AFTER))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setNotice('Kopyalanamadı')
    }
  }

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => {
    const guess = save.guesses[r]
    if (guess) return { letters: [...guess], marks: markGuess(guess, answer) as Array<Mark | null>, current: false }
    const isCurrent = r === save.guesses.length && !over
    const letters = isCurrent ? [...typed] : []
    return { letters, marks: [] as Array<Mark | null>, current: isCurrent }
  })

  return (
    <GameFrame
      title="Günün Kavramı"
      subtitle={`${term.subject} · ${length} harf · ${MAX_GUESSES} hak`}
      onExit={onExit}
      score={
        <>
          <Flame size={15} aria-hidden="true" /> {save.streak}
        </>
      }
    >
      <div className={`kv-clue${clueOpen ? ' is-open' : ''}`}>
        <span className="kv-subject">{term.subject}</span>
        {clueOpen ? (
          <p>
            <Lightbulb size={16} aria-hidden="true" /> {term.clue}
          </p>
        ) : (
          <p className="muted">
            <Lock size={15} aria-hidden="true" /> Tanım ipucu {CLUE_AFTER - wrong} yanlıştan sonra açılır
          </p>
        )}
      </div>

      <div className="kv-board" style={{ ['--kv-len' as string]: length }} aria-label="Tahminler">
        {rows.map((row, r) => (
          <div key={r} className={`kv-row${row.current && shake ? ' is-shake' : ''}`} role="group" aria-label={`${r + 1}. tahmin`}>
            {Array.from({ length }, (_, i) => {
              const letter = row.letters[i] ?? ''
              const mark = row.marks[i] ?? null
              // The box the next letter goes in: a blinking line, so it is clear where typing starts.
              const next = row.current && i === row.letters.length
              return (
                <span key={i} className={`kv-tile${mark ? ` is-${mark}` : ''}${letter && !mark ? ' is-typed' : ''}${row.current ? ' is-current' : ''}${next ? ' is-next' : ''}`} aria-label={letter ? `${letter}${mark ? `, ${MARK_LABEL[mark]}` : ''}` : 'boş'}>
                  {letter}
                </span>
              )
            })}
          </div>
        ))}
      </div>

      <p className="kv-notice" role="status">
        {notice ?? ''}
      </p>

      {over ? (
        <div className={`kv-result${won ? ' is-won' : ''}`} role="status">
          <strong>{won ? `Buldun! ${save.guesses.length}/${MAX_GUESSES}` : 'Bu sefer olmadı'}</strong>
          <p>
            Kavram: <span className="kv-answer">{answer}</span>
          </p>
          <p className="muted">{term.clue}</p>
          <dl className="kv-stats">
            <div>
              <dt>Seri</dt>
              <dd>{save.streak}</dd>
            </div>
            <div>
              <dt>Oynanan</dt>
              <dd>{save.played}</dd>
            </div>
            <div>
              <dt>Kazanılan</dt>
              <dd>{save.played ? Math.round((save.wins / save.played) * 100) : 0}%</dd>
            </div>
          </dl>
          <button className="btn btn-primary" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Kopyalandı' : 'Sonucu kopyala'}
          </button>
          <p className="subtle">Yarın yeni bir kavram gelecek.</p>
        </div>
      ) : (
        <div className="kv-keys" aria-label="Klavye">
          {KEY_ROWS.map((row, r) => (
            <div key={r} className="kv-keyrow">
              {r === 2 && (
                <button className="kv-key is-wide" onClick={() => press('GİR')} aria-label="Tahmin et">
                  <CornerDownLeft size={18} />
                </button>
              )}
              {row.map((k) => (
                <button key={k} className={`kv-key${keys[k] ? ` is-${keys[k]}` : ''}`} onClick={() => press(k)} aria-label={`${k}${keys[k] ? `, ${MARK_LABEL[keys[k]]}` : ''}`}>
                  {k}
                </button>
              ))}
              {r === 2 && (
                <button className="kv-key is-wide" onClick={() => press('SIL')} aria-label="Sil">
                  <Delete size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ul className="kv-legend" aria-label="İşaretler">
        <li>
          <span className="kv-tile is-hit">A</span> doğru yerde
        </li>
        <li>
          <span className="kv-tile is-near">A</span> var, yeri başka
        </li>
        <li>
          <span className="kv-tile is-miss">A</span> yok
        </li>
      </ul>
    </GameFrame>
  )
}
