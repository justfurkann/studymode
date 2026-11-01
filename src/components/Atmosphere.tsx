import { CloudRain, Coffee, Flame, Headphones, Moon, Pause, Play, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CHANNELS, setVolume, toggle, useAmbience, type Channel } from '../lib/ambience'
import { isNightOwlHour } from '../lib/receipt'

/*
 * Mounted once in the app shell: the "Gece kütüphanesi" cassette player (background sounds that
 * keep playing across pages) and, after midnight, the night-owl note.
 */

const ICONS: Record<Channel, LucideIcon> = { yagmur: CloudRain, kafe: Coffee, somine: Flame, kahverengi: Headphones }

function Reel({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`cassette-reel ${spinning ? 'is-spinning' : ''}`} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" />
      <circle cx="20" cy="20" r="5" className="hub" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x="19" y="6" width="2" height="7" rx="1" transform={`rotate(${a} 20 20)`} className="hub" />
      ))}
    </svg>
  )
}

export function AmbientPlayer() {
  const { playing, volumes } = useAmbience()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="ambient" ref={ref}>
      {open && (
        <div className="cassette" role="dialog" aria-label="Gece kütüphanesi">
          <div className="cassette-head">
            <strong>Gece kütüphanesi</strong>
            <button className="btn btn-ghost btn-icon" aria-label="Kapat" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="cassette-body">
            <Reel spinning={playing} />
            <div className="cassette-label">
              <span>A</span>
              <span className="cassette-title">{playing ? 'Çalıyor' : 'Durdu'}</span>
            </div>
            <Reel spinning={playing} />
          </div>
          <button className="btn btn-primary" onClick={toggle} style={{ width: '100%' }}>
            {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? 'Durdur' : 'Çal'}
          </button>
          <div className="ambient-mixer">
            {CHANNELS.map(({ id, label, hint }) => {
              const Icon = ICONS[id]
              return (
                <label key={id} className="ambient-channel" title={hint}>
                  <Icon size={16} aria-hidden />
                  <span>{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(volumes[id] * 100)}
                    aria-label={`${label} sesi`}
                    onChange={(e) => setVolume(id, Number(e.target.value) / 100)}
                  />
                </label>
              )
            })}
          </div>
          <p className="subtle" style={{ fontSize: '0.8125rem' }}>
            Sayfalar arasında gezerken de çalmaya devam eder.
          </p>
        </div>
      )}
      <button
        className={`ambient-toggle ${playing ? 'is-playing' : ''}`}
        aria-label={playing ? 'Ortam sesi çalıyor, ayarları aç' : 'Ortam sesleri: yağmur, kafe, şömine'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {playing ? (
          <span className="eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <Headphones size={20} aria-hidden />
        )}
      </button>
    </div>
  )
}

const OWL_KEY = 'studymode.nightOwl'

/** Which night a moment belongs to: 02:30 on the 2nd is still the night of the 1st. */
function nightOf(date: Date): string {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  return d.toDateString()
}

export function NightOwl() {
  const [now, setNow] = useState(() => new Date())
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(OWL_KEY) === nightOf(new Date())
    } catch {
      return false
    }
  })

  const [shown, setShown] = useState(true)
  const night = isNightOwlHour(now)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // A greeting, not a banner: it steps aside on its own after a while (the stars stay).
  useEffect(() => {
    if (!night) return
    const id = window.setTimeout(() => setShown(false), 15_000)
    return () => window.clearTimeout(id)
  }, [night])

  if (hidden || !shown || !night) return null
  const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(OWL_KEY, nightOf(new Date()))
    } catch {
      // Shown again next visit; harmless.
    }
  }
  return (
    <div className="night-owl" role="status">
      <Moon size={16} aria-hidden />
      <span>
        <strong>Gece kuşu modu</strong> · Saat {time} ve hâlâ buradasın, helal olsun.
      </span>
      <button className="btn btn-ghost btn-icon" aria-label="Gece kuşu notunu kapat" onClick={dismiss}>
        <X size={14} />
      </button>
    </div>
  )
}

export function Atmosphere() {
  return (
    <>
      <NightOwl />
      <AmbientPlayer />
    </>
  )
}
