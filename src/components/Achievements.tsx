import {
  AudioLines,
  Camera,
  Clock12,
  Flame,
  FlameKindling,
  Footprints,
  Highlighter,
  Layers,
  Lock,
  Map as MapIcon,
  Moon,
  Receipt,
  Search,
  Shapes,
  Sparkles,
  SunMoon,
  Sunrise,
  Target,
  Timer,
  Trophy,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ACHIEVEMENT_BY_ID,
  clockAchievements,
  isFirstVisit,
  currentUnlocked,
  mergeRemote,
  parseUnlocked,
  applyRemoteHeld,
  currentHeld,
  parseHeld,
  reachedGoals,
  RARITIES,
  recordPen,
  studyProgress,
  takeAnnouncement,
  unlock,
  useAchievements,
  type Achievement,
  type AchievementIcon,
  type AchievementId,
} from '../lib/achievements'
import { useAmbience } from '../lib/ambience'
import { PENS, useDecor } from '../lib/decor'
import { readRecords } from '../lib/mola'
import { useSettings } from '../lib/settings'
import { playSound } from '../lib/sound'
import { useStore } from '../lib/store'
import { useTourActive } from '../lib/tour'
import { pushIfNewer, useSyncStudentResult } from '../lib/studentProfile'
import { supabase } from '../lib/supabase'
import { localDayKey } from '../lib/streak'

const ICONS: Record<AchievementIcon, LucideIcon> = {
  footprints: Footprints,
  flame: Flame,
  'flame-kindling': FlameKindling,
  layers: Layers,
  target: Target,
  timer: Timer,
  sparkles: Sparkles,
  receipt: Receipt,
  shapes: Shapes,
  moon: Moon,
  sunrise: Sunrise,
  clock: Clock12,
  search: Search,
  zap: Zap,
  camera: Camera,
  map: MapIcon,
  'sun-moon': SunMoon,
  highlighter: Highlighter,
  audio: AudioLines,
  trophy: Trophy,
}

/** The medal: the icon in a frame that shows the rarity (plain, blue, violet glow, moving gold). */
export function AchievementBadge({ achievement, locked = false, size = 56 }: { achievement: Achievement; locked?: boolean; size?: number }) {
  const Icon = locked ? Lock : ICONS[achievement.icon]
  return (
    <span className={`ach-badge rarity-${achievement.rarity} ${locked ? 'is-locked' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="ach-badge-inner">
        <Icon size={Math.round(size * 0.44)} strokeWidth={2.2} />
      </span>
    </span>
  )
}

/** A short glitch over the whole page, for Glitch Hunter. */
export function triggerGlitch() {
  const root = document.documentElement
  root.classList.remove('is-glitching')
  // Restart the animation even if it was running.
  void root.offsetWidth
  root.classList.add('is-glitching')
  window.setTimeout(() => root.classList.remove('is-glitching'), 1300)
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

/**
 * Mounted once at the root. Watches the clock, study data, theme, pen, sounds and the keyboard for
 * achievements, and announces each new one with a toast that leads to the collection.
 */
export function AchievementWatcher() {
  const { data, status } = useStore()
  const { session, mine, remote } = useSyncStudentResult()
  const { unlocked } = useAchievements()
  const settings = useSettings()
  const decor = useDecor()
  const ambience = useAmbience()
  const { pending } = useAchievements()

  // Clock: on arrival and every 20 seconds (midnight lasts a minute).
  useEffect(() => {
    const check = () => clockAchievements(new Date()).forEach((id) => unlock(id))
    check()
    const timer = window.setInterval(check, 20_000)
    return () => window.clearInterval(timer)
  }, [])

  // Study goals: whenever the data changes, and each minute for focus rounds. Goals already reached
  // before this browser knew about achievements are added quietly (no burst of toasts on day one).
  const settled = useRef(false)
  useEffect(() => {
    if (status !== 'ready') return
    const check = () => {
      const rounds = readRecords().rounds[localDayKey()] ?? 0
      const silent = !settled.current && isFirstVisit()
      reachedGoals(studyProgress(data, rounds)).forEach((id) => unlock(id, new Date(), { silent }))
      settled.current = true
    }
    check()
    const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [data, status])

  // Theme flipped 10 times within a minute.
  const flips = useRef<number[]>([])
  const firstTheme = useRef(true)
  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false
      return
    }
    const now = Date.now()
    flips.current = [...flips.current.filter((t) => now - t < 60_000), now]
    if (flips.current.length >= 10) unlock('tema-dj')
  }, [settings.theme])

  useEffect(() => {
    recordPen(decor.pen, PENS.length)
  }, [decor.pen])

  useEffect(() => {
    if (ambience.playing && Object.values(ambience.volumes).every((v) => v > 0)) unlock('ses-muhendisi')
  }, [ambience])

  // The quiz result follows the account: one taken before signing in is copied up.
  useEffect(() => {
    pushIfNewer(!!session, mine, remote)
  }, [session, mine, remote])

  // Achievements follow the account too (user_metadata, no table needed): what the account has comes
  // here quietly, what only this browser has goes up. Ones an admin took back are kept in a dated
  // "held" list next to them, so neither this device nor another brings them back; when the account
  // still lists a taken-back one, the account's list is overwritten with the current one.
  const pushed = useRef('')
  const meta = session?.user.user_metadata as Record<string, unknown> | undefined
  const remoteAchievements = meta?.achievements
  const remoteHeld = meta?.achievements_held
  useEffect(() => {
    if (!session || !supabase) return
    const accountHeld = parseHeld(remoteHeld)
    applyRemoteHeld(accountHeld)
    const fromAccount = parseUnlocked(JSON.stringify(remoteAchievements ?? {}))
    const onlyHere = mergeRemote(fromAccount)
    const local = currentUnlocked()
    const held = currentHeld()
    const takenBackHere = Object.keys(fromAccount).some((id) => !local[id as keyof typeof local])
    const heldNewer = held.at > (accountHeld?.at ?? '')
    if (!onlyHere.length && !takenBackHere && !heldNewer) return
    const payload = JSON.stringify({ local, held })
    if (payload === pushed.current) return
    pushed.current = payload
    void supabase.auth.updateUser({ data: { achievements: local, achievements_held: held } }).catch(() => undefined)
  }, [session, remoteAchievements, remoteHeld, unlocked])

  // The old cheat code.
  useEffect(() => {
    let position = 0
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      position = key === KONAMI[position] ? position + 1 : key === KONAMI[0] ? 1 : 0
      if (position === KONAMI.length) {
        position = 0
        triggerGlitch()
        unlock('glitch')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return <AchievementToasts pending={pending} />
}

function AchievementToasts({ pending }: { pending: number }) {
  const [current, setCurrent] = useState<AchievementId | null>(null)
  const navigate = useNavigate()

  const touring = useTourActive()
  useEffect(() => {
    if (current || !pending || touring) return
    const next = takeAnnouncement()
    if (!next) return
    setCurrent(next)
    playSound('done')
  }, [pending, current, touring])

  useEffect(() => {
    if (!current) return
    const timer = window.setTimeout(() => setCurrent(null), 5200)
    return () => window.clearTimeout(timer)
  }, [current])

  if (!current) return null
  const a = ACHIEVEMENT_BY_ID[current]
  return createPortal(
    <div className={`ach-toast rarity-${a.rarity}`} role="status" key={current}>
      <button
        className="ach-toast-body"
        onClick={() => {
          setCurrent(null)
          navigate(`/basarimlar#${a.id}`)
        }}
      >
        <AchievementBadge achievement={a} size={52} />
        <span className="ach-toast-text">
          <span className="ach-toast-kicker">
            {a.hint ? 'Gizli başarım bulundu' : 'Başarım açıldı'} · <b>{RARITIES[a.rarity].label}</b>
          </span>
          <strong>{a.name}</strong>
          <span>{a.description}</span>
        </span>
      </button>
      <button className="btn btn-ghost btn-icon ach-toast-close" aria-label="Kapat" onClick={() => setCurrent(null)}>
        <X size={16} />
      </button>
    </div>,
    document.body,
  )
}
