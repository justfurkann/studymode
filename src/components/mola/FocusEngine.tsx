import { Coffee, Pause, Target } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getFocus, markEnded, notify, setFocus, useFocus } from '../../lib/focusStore'
import { addFocusMinutes, addFocusRound, FOCUS_PLANS, formatClock, isFinished, isWaiting, nextPhase, readTimer, remainingMs } from '../../lib/mola'
import { playSound } from '../../lib/sound'
import { useStore } from '../../lib/store'
import { useTick } from './shared'

export const FOCUS_URL = '/tekrar?bolum=mola&oyun=odak'

/**
 * Mounted once in the app shell. Moves the shared focus timer along wherever the student is:
 * a finished focus round is credited (minutes, round, streak) and its break starts; a finished
 * break leaves the next round waiting. Also shows a small pill with the time on other pages.
 */
export function FocusEngine() {
  const store = useStore()
  const timer = useFocus()
  const location = useLocation()
  const running = !!timer && timer.endsAt !== null
  const now = useTick(running, 1000)

  useEffect(() => {
    const current = getFocus()
    if (!current || current.endsAt === null || !isFinished(current, now)) return
    // Storage is the single source of truth: another tab, or React running this twice, may have moved on.
    const stored = readTimer()
    if (!stored || stored.endsAt !== current.endsAt || stored.phase !== current.phase) {
      setFocus(stored)
      return
    }
    // The next phase starts when this one ended, even if the app was closed meanwhile.
    const next = nextPhase(stored, stored.endsAt ?? Date.now())
    if (stored.phase === 'focus') {
      addFocusMinutes(stored.minutes)
      addFocusRound()
      store.recordActivity()
      const plan = FOCUS_PLANS[stored.plan]
      notify('Odak turu bitti', next.phase === 'long' ? `Harika! ${plan.long} dakika uzun mola.` : `${plan.short} dakika mola. Kalk, biraz su iç.`)
    } else {
      notify('Mola bitti', `${next.round}. tur hazır. Başlamak için dokun.`)
    }
    playSound('done')
    markEnded({ phase: stored.phase, round: stored.round, minutes: stored.minutes, at: Date.now() })
    setFocus(next)
  }, [now, store])

  // Tab title shows the countdown while a phase runs.
  useEffect(() => {
    if (!timer || timer.endsAt === null) return
    const before = document.title
    document.title = `${formatClock(remainingMs(timer, now))} · ${timer.phase === 'focus' ? 'Odak' : 'Mola'} · StudyMode`
    return () => {
      document.title = before
    }
  }, [timer, now])

  const onFocusPage = location.pathname === '/tekrar' && new URLSearchParams(location.search).get('oyun') === 'odak'
  if (!timer || onFocusPage) return null
  const waiting = isWaiting(timer)
  const Icon = timer.phase === 'focus' ? (timer.endsAt === null ? Pause : Target) : Coffee
  const label = waiting ? `${timer.round}. tur hazır` : timer.phase === 'focus' ? (timer.endsAt === null ? 'Duraklatıldı' : 'Odak') : 'Mola'
  return (
    <Link to={FOCUS_URL} className={`focus-pill is-${timer.phase}${timer.endsAt === null ? ' is-paused' : ''}`} aria-label={`Odak sayacı: ${label}${waiting ? '' : `, ${formatClock(remainingMs(timer, now))} kaldı`}`}>
      <Icon size={15} aria-hidden />
      <span>{label}</span>
      {!waiting && <strong>{formatClock(remainingMs(timer, now))}</strong>}
    </Link>
  )
}
