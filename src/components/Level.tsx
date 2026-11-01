import { ArrowUpCircle, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useAchievements } from '../lib/achievements'
import { useStore } from '../lib/store'
import { useTourActive } from '../lib/tour'
import { computeXp, levelOf, nextTitle, type LevelInfo, type XpSummary } from '../lib/xp'
import { playSound } from '../lib/sound'

/** The student's XP and level, from their study data and achievements. */
export function useLevel(): { xp: XpSummary; level: LevelInfo } {
  const { data } = useStore()
  const { unlocked } = useAchievements()
  return useMemo(() => {
    const xp = computeXp(data, unlocked)
    return { xp, level: levelOf(xp.total) }
  }, [data, unlocked])
}

/** Small "Sv 4" pill with a progress line; leads to the level card. */
export function LevelBadge() {
  const { level } = useLevel()
  return (
    <Link to="/basarimlar#seviye" className="btn btn-sm level-badge" aria-label={`Seviye ${level.level}, ${level.title}. Sonraki seviyeye ${level.toNext} XP`}>
      <span className="level-badge-n">Sv {level.level}</span>
      <span className="level-badge-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(level.progress * 100)}%` }} />
      </span>
    </Link>
  )
}

/** Top of the collection page: level ring, title, XP to go, and where the XP came from. */
export function LevelCard() {
  const { xp, level } = useLevel()
  const ahead = nextTitle(level.level)
  return (
    <section id="seviye" className="panel level-card" aria-label="Seviye">
      <div className="level-ring" style={{ ['--p' as string]: `${level.progress * 100}%` }}>
        <span>
          <small>Seviye</small>
          <strong>{level.level}</strong>
        </span>
      </div>
      <div className="level-text">
        <strong className="level-title">{level.title}</strong>
        <p className="subtle">
          {xp.total.toLocaleString('tr-TR')} XP · sonraki seviyeye {level.toNext.toLocaleString('tr-TR')} XP
          {ahead ? ` · Sv ${ahead.level}’de “${ahead.title}” olursun` : ''}
        </p>
        <div className="progress level-progress" role="progressbar" aria-label="Seviye ilerlemesi" aria-valuenow={level.into} aria-valuemin={0} aria-valuemax={level.span}>
          <div style={{ width: `${level.progress * 100}%` }} />
        </div>
        <details className="level-parts">
          <summary>XP nereden geldi?</summary>
          <ul>
            {xp.parts
              .filter((p) => p.count > 0)
              .map((p) => (
                <li key={p.key}>
                  <span>
                    {p.label} <span className="subtle">× {p.count}</span>
                  </span>
                  <strong>+{p.xp.toLocaleString('tr-TR')}</strong>
                </li>
              ))}
            {!xp.total && <li className="subtle">Henüz XP yok. Bir kart çevir, bir test çöz: hepsi sayılır.</li>}
          </ul>
          <p className="subtle">Kart 2 · test ya da sınav 15 · hatasız test +10 · sınav provası +25 · hazırlanan not 20 · çalışılan gün 10 · başarım 20-250 XP.</p>
        </details>
      </div>
    </section>
  )
}

const LEVEL_KEY = 'studymode.level.v1'

/**
 * Mounted once: when the level goes up, a short celebration (after the tour and achievement toasts).
 * The first time it only remembers the level, so nobody gets "Seviye 6!" for the past.
 */
export function LevelUpWatcher() {
  const { status, session } = useStore()
  const { level } = useLevel()
  const { pending } = useAchievements()
  const touring = useTourActive()
  const [shown, setShown] = useState<LevelInfo | null>(null)
  const navigate = useNavigate()
  const key = `${LEVEL_KEY}.${session?.user.id ?? 'misafir'}`

  useEffect(() => {
    if (status !== 'ready' || touring || pending > 0 || document.querySelector('.ach-toast')) return
    let saved: number | null = null
    try {
      saved = Number(localStorage.getItem(key)) || null
      localStorage.setItem(key, String(level.level))
    } catch {
      return
    }
    if (saved !== null && level.level > saved) {
      setShown(level)
      playSound('done')
    }
  }, [status, level, key, touring, pending])

  useEffect(() => {
    if (!shown) return
    const timer = window.setTimeout(() => setShown(null), 5200)
    return () => window.clearTimeout(timer)
  }, [shown])

  if (!shown) return null
  return createPortal(
    <div className="ach-toast level-toast" role="status">
      <button
        className="ach-toast-body"
        onClick={() => {
          setShown(null)
          navigate('/basarimlar#seviye')
        }}
      >
        <span className="level-toast-icon" aria-hidden="true">
          <ArrowUpCircle size={26} />
        </span>
        <span className="ach-toast-text">
          <span className="ach-toast-kicker">
            <Sparkles size={12} aria-hidden /> Seviye atladın
          </span>
          <strong>
            Seviye {shown.level} · {shown.title}
          </strong>
          <span>Sonraki seviyeye {shown.toNext.toLocaleString('tr-TR')} XP.</span>
        </span>
      </button>
      <button className="btn btn-ghost btn-icon ach-toast-close" aria-label="Kapat" onClick={() => setShown(null)}>
        <X size={16} />
      </button>
    </div>,
    document.body,
  )
}
