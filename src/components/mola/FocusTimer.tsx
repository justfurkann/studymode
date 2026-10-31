import { Coffee, Grid2x2Check, Pause, Play, SkipForward, Square, Target, Zap } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { askNotificationPermission, clearEnded, setFocus, useFocus, useLastEnded } from '../../lib/focusStore'
import {
  addFocusMinutes,
  elapsedMinutes,
  FOCUS_PLANS,
  focusLastWeek,
  focusWeek,
  formatClock,
  isWaiting,
  LONG_BREAK_EVERY,
  nextPhase,
  pauseTimer,
  readRecords,
  remainingMs,
  resumeTimer,
  startFocus,
  type FocusPlanId,
} from '../../lib/mola'
import { useStore } from '../../lib/store'
import { Celebrate } from '../ui'
import { GameHead, useTick } from './shared'

const COURSE_KEY = 'studymode.focusCourse'
const SCOPE_KEY = 'studymode.molaScope'
const PHASE_LABEL = { focus: 'Odak', short: 'Kısa mola', long: 'Uzun mola' } as const

function readCourse(): string {
  try {
    return localStorage.getItem(COURSE_KEY) ?? ''
  } catch {
    return ''
  }
}

/** The countdown as a ring: highlighter yellow while focusing, green during a break. */
function Ring({ progress, phase, children }: { progress: number; phase: 'focus' | 'short' | 'long'; children: ReactNode }) {
  const r = 88
  const c = 2 * Math.PI * r
  return (
    <div className={`focus-ring is-${phase}`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r={r} className="ring-track" />
        <circle cx="100" cy="100" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))} transform="rotate(-90 100 100)" />
      </svg>
      <div className="focus-ring-center">{children}</div>
    </div>
  )
}

export function FocusTimer({ onExit, onPlay }: { onExit: () => void; onPlay: (game: 'eslestir' | 'hizli') => void }) {
  const store = useStore()
  const timer = useFocus()
  const ended = useLastEnded()
  const [plan, setPlan] = useState<FocusPlanId>(() => timer?.plan ?? 'klasik')
  const [courseId, setCourseId] = useState(readCourse)
  const now = useTick(!!timer && timer.endsAt !== null, 1000)
  const records = readRecords()
  const week = focusWeek(records)
  const weekMinutes = focusLastWeek(records.focus)
  const today = week[week.length - 1]
  const maxDay = Math.max(25, ...week.map((d) => d.minutes))

  const courses = store.data.courses
  const course = courses.find((c) => c.id === (timer?.courseId ?? courseId)) ?? null

  function chooseCourse(id: string) {
    setCourseId(id)
    try {
      if (id) localStorage.setItem(COURSE_KEY, id)
      else localStorage.removeItem(COURSE_KEY)
    } catch {
      // Remembering is a convenience.
    }
  }

  function start() {
    askNotificationPermission()
    clearEnded()
    setFocus(startFocus(plan, 1, courseId || null))
  }

  /** Ends the session; focus minutes that passed still count. */
  function stop() {
    if (timer?.phase === 'focus') addFocusMinutes(elapsedMinutes(timer))
    clearEnded()
    setFocus(null)
  }

  /** Skips to the next phase. Skipping a focus round credits its minutes so far, not a full round. */
  function skip() {
    if (!timer) return
    if (timer.phase === 'focus') addFocusMinutes(elapsedMinutes(timer))
    clearEnded()
    setFocus(nextPhase(timer))
  }

  function play(game: 'eslestir' | 'hizli') {
    try {
      if (timer?.courseId) localStorage.setItem(SCOPE_KEY, timer.courseId)
    } catch {
      // The games then use the last chosen course.
    }
    onPlay(game)
  }

  const total = (timer?.minutes ?? FOCUS_PLANS[plan].focus) * 60_000
  const left = timer ? remainingMs(timer, now) : total
  const phase = timer?.phase ?? 'focus'
  const waiting = !!timer && isWaiting(timer)
  const inSet = timer ? (phase === 'focus' ? (timer.round - 1) % LONG_BREAK_EVERY : ((timer.round - 1) % LONG_BREAK_EVERY) + 1) : 0
  const justFocused = ended && ended.phase === 'focus' && timer && timer.phase !== 'focus' && Date.now() - ended.at < 60 * 60_000

  return (
    <div className="page page-narrow mola">
      <GameHead onExit={onExit}>
        Son 7 gün: {weekMinutes} dk
      </GameHead>
      <h1 className="mola-title">Odak sayacı</h1>

      {justFocused ? (
        <p className="focus-note">
          Tur bitti, <Celebrate>{ended.minutes} dakika</Celebrate> odaklandın. Şimdi ekrandan uzaklaş.
        </p>
      ) : !timer ? (
        <p className="subtle">Pomodoro: odaklan, kısa bir mola ver, tekrarla. Her {LONG_BREAK_EVERY} turda bir uzun mola. Başka sayfaya geçsen de sayaç işler.</p>
      ) : null}

      {!timer && (
        <div className="focus-setup">
          <div className="segmented" role="group" aria-label="Süre">
            {(Object.keys(FOCUS_PLANS) as FocusPlanId[]).map((id) => (
              <button key={id} aria-pressed={plan === id} onClick={() => setPlan(id)}>
                {FOCUS_PLANS[id].label} dk
              </button>
            ))}
          </div>
          {courses.length > 0 && (
            <label className="field focus-course">
              <span>Neye çalışıyorsun? (isteğe bağlı)</span>
              <select className="select" value={courseId} onChange={(e) => chooseCourse(e.target.value)}>
                <option value="">Seçmeden devam et</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="focus-stage panel">
        <div className="focus-meta">
          <span className={`chip focus-phase is-${phase}`}>
            {phase === 'focus' ? <Target size={14} aria-hidden /> : <Coffee size={14} aria-hidden />} {waiting ? `${timer!.round}. tur hazır` : PHASE_LABEL[phase]}
          </span>
          {course && (
            <span className="subtle focus-course-name">
              <span className="course-swatch" style={{ background: course.color, width: 8, height: 8 }} /> {course.name}
            </span>
          )}
        </div>
        <Ring progress={1 - left / total} phase={phase}>
          <span className="focus-clock" aria-live="off">
            {formatClock(left)}
          </span>
          <span className="subtle">{timer ? (timer.endsAt === null && !waiting ? 'Duraklatıldı' : `${timer.round}. tur`) : `${FOCUS_PLANS[plan].focus} dakika odak`}</span>
        </Ring>
        <div className="focus-dots" role="img" aria-label={`Bu sette ${inSet}/${LONG_BREAK_EVERY} tur tamam`}>
          {Array.from({ length: LONG_BREAK_EVERY }, (_, i) => (
            <span key={i} className={i < inSet ? 'is-done' : ''} />
          ))}
        </div>

        <div className="btn-row focus-actions">
          {!timer && (
            <button className="btn btn-primary btn-lg" onClick={start}>
              <Play size={18} /> Başla
            </button>
          )}
          {waiting && (
            <button className="btn btn-primary btn-lg" onClick={() => { clearEnded(); setFocus(resumeTimer(timer!)) }}>
              <Play size={18} /> {timer!.round}. turu başlat
            </button>
          )}
          {timer && !waiting && timer.endsAt !== null && (
            <button className="btn btn-lg" onClick={() => setFocus(pauseTimer(timer))}>
              <Pause size={18} /> Duraklat
            </button>
          )}
          {timer && !waiting && timer.endsAt === null && (
            <button className="btn btn-primary btn-lg" onClick={() => setFocus(resumeTimer(timer))}>
              <Play size={18} /> Devam et
            </button>
          )}
          {timer && !waiting && (
            <button className="btn btn-lg" onClick={skip}>
              <SkipForward size={16} /> {phase === 'focus' ? 'Molaya geç' : 'Molayı atla'}
            </button>
          )}
          {timer && (
            <button className="btn btn-lg btn-ghost" onClick={stop}>
              <Square size={16} /> Bitir
            </button>
          )}
        </div>
      </div>

      {timer && phase !== 'focus' && !waiting && (
        <section className="panel focus-break" aria-label="Mola önerileri">
          <strong>Molada ne yapsan?</strong>
          <p className="muted">Kalk, biraz yürü, su iç, gözlerini uzağa dinlendir. Ya da 2 dakikalık bir oyunla aklında tut:</p>
          <div className="btn-row">
            <button className="btn btn-sm" onClick={() => play('eslestir')}>
              <Grid2x2Check size={15} /> Eşleştir
            </button>
            <button className="btn btn-sm" onClick={() => play('hizli')}>
              <Zap size={15} /> Hızlı tur
            </button>
          </div>
        </section>
      )}

      <section className="section" aria-label="Odak geçmişi">
        <div className="section-head">
          <h2>Son 7 gün</h2>
          <span className="subtle">
            Bugün: {today.minutes} dk · {today.rounds} tur
          </span>
        </div>
        <div className="panel focus-week">
          {week.map((d) => (
            <div key={d.day} className={`focus-bar${d.today ? ' is-today' : ''}`} title={`${d.minutes} dk`}>
              <span className="focus-bar-value">{d.minutes || ''}</span>
              <span className="focus-bar-track">
                <span style={{ height: `${(d.minutes / maxDay) * 100}%` }} />
              </span>
              <span className="focus-bar-label">{d.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
