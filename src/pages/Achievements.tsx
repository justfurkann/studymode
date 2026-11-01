import { HelpCircle, RotateCcw, ShieldCheck, Target, Trophy } from 'lucide-react'
import { LevelCard } from '../components/Level'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AchievementBadge } from '../components/Achievements'
import { ACHIEVEMENTS, isHidden, RARITIES, revoke, studyProgress, unlock, useAchievements, type Achievement, type Rarity } from '../lib/achievements'
import { useQuota } from '../lib/account'
import { readRecords } from '../lib/mola'
import { useStore } from '../lib/store'
import { localDayKey } from '../lib/streak'

/*
 * /basarimlar: the collection. Found ones in their rarity frame with the date; visible goals with a
 * progress bar; hidden ones as "???" with only a riddle.
 */

type Filter = 'hepsi' | 'acik' | 'gizli'

const RARITY_ORDER: Rarity[] = ['efsanevi', 'destansi', 'nadir', 'yaygin']

export function Achievements() {
  const { data, session } = useStore()
  const { unlocked } = useAchievements()
  // Admins can give or take back any achievement on their own account, to test and to show.
  const isAdmin = useQuota(session?.user.id ?? null)?.role === 'admin'
  const [adminMode, setAdminMode] = useState(false)
  const [filter, setFilter] = useState<Filter>('hepsi')
  const { hash } = useLocation()
  const progress = useMemo(() => studyProgress(data, readRecords().rounds[localDayKey()] ?? 0), [data])

  // Arriving from a toast: scroll to that card and make it glow.
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(`basarim-${hash.slice(1)}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [hash])

  const total = ACHIEVEMENTS.length
  const found = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length
  const goals = { ...progress, koleksiyoncu: { value: Math.min(10, found), goal: 10 } }
  const hiddenTotal = ACHIEVEMENTS.filter(isHidden).length
  const hiddenFound = ACHIEVEMENTS.filter((a) => isHidden(a) && unlocked[a.id]).length

  // The visible goal closest to done, so the summary always says what to do next.
  const next = ACHIEVEMENTS.filter((a) => !unlocked[a.id] && !isHidden(a))
    .map((a) => ({ achievement: a, ...(goals[a.id as keyof typeof goals] ?? { value: 0, goal: 0 }) }))
    .filter((g) => g.goal > 0)
    .sort((a, b) => b.value / b.goal - a.value / a.goal)[0]

  const list = ACHIEVEMENTS.filter((a) => (filter === 'acik' ? !!unlocked[a.id] : filter === 'gizli' ? isHidden(a) : true)).sort(
    (a, b) => Number(!!unlocked[b.id]) - Number(!!unlocked[a.id]) || RARITIES[b.rarity].order - RARITIES[a.rarity].order,
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="subtle">Koleksiyon</p>
          <h1>
            <span className="hl">Başarımlar</span>
          </h1>
        </div>
      </div>

      <LevelCard />

      <section className="ach-summary panel" aria-label="Koleksiyon özeti">
        <div className="ach-ring" style={{ ['--p' as string]: `${(found / total) * 100}%` }} role="img" aria-label={`${total} başarımdan ${found} tanesi açıldı`}>
          <span className="ach-ring-inner">
            <Trophy size={18} aria-hidden />
            <strong>{found}</strong>
            <small>/{total} açıldı</small>
          </span>
        </div>
        <div className="ach-summary-text">
          <strong>{found === total ? 'Hepsini buldun. Efsanesin.' : found === 0 ? 'Koleksiyon boş. Kurcalamaya başla.' : `${total - found} başarım daha seni bekliyor.`}</strong>
          <p className="subtle">
            {hiddenFound}/{hiddenTotal} gizli keşif bulundu. Gizliler yalnızca bir ipucu verir; sitenin köşelerinde, saatlerde ve beklenmedik dokunuşlarda saklanırlar.
          </p>
          {next && (
            <div className="ach-next">
              <Target size={16} aria-hidden />
              <span>
                Sıradaki: <strong>{next.achievement.name}</strong>
              </span>
              <div className="progress" aria-hidden>
                <div style={{ width: `${(next.value / next.goal) * 100}%` }} />
              </div>
              <span className="subtle">
                {next.value}/{next.goal}
              </span>
            </div>
          )}
          <div className="ach-rarity-row">
            {RARITY_ORDER.map((r) => {
              const all = ACHIEVEMENTS.filter((a) => a.rarity === r)
              return (
                <span key={r} className={`ach-rarity-chip rarity-${r}`}>
                  {RARITIES[r].label} {all.filter((a) => unlocked[a.id]).length}/{all.length}
                </span>
              )
            })}
          </div>
        </div>
      </section>

      {isAdmin && (
        <label className="check-row ach-admin-toggle">
          <input type="checkbox" checked={adminMode} onChange={(e) => setAdminMode(e.target.checked)} />
          <span>
            <ShieldCheck size={16} aria-hidden /> Yönetici modu
            <span className="subtle"> · Başarımları kendi hesabında ver ya da geri al. Başka kullanıcıları etkilemez.</span>
          </span>
        </label>
      )}

      <div className="segmented" role="group" aria-label="Başarım filtresi">
        {(
          [
            ['hepsi', 'Tümü'],
            ['acik', 'Açılanlar'],
            ['gizli', 'Gizliler'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="ach-grid">
        {list.map((a) => (
          <AchievementCard key={a.id} achievement={a} at={unlocked[a.id]} progress={goals[a.id as keyof typeof goals]} focused={hash === `#${a.id}`} admin={isAdmin && adminMode} />
        ))}
        {!list.length && <p className="subtle">Henüz açılan başarım yok. İlk kartını çevirmek iyi bir başlangıç.</p>}
      </div>
    </div>
  )
}

function AchievementCard({ achievement: a, at, progress, focused, admin }: { achievement: Achievement; at?: string; progress?: { value: number; goal: number }; focused: boolean; admin: boolean }) {
  const open = !!at
  // In admin mode the real name shows, so the admin knows what they are giving.
  const secret = isHidden(a) && !open && !admin
  return (
    <article id={`basarim-${a.id}`} className={`ach-card rarity-${a.rarity} ${open ? 'is-open' : 'is-locked'} ${focused ? 'is-focused' : ''}`}>
      <AchievementBadge achievement={a} locked={!open} size={60} />
      {admin && (
        <button
          type="button"
          className={`btn btn-sm ach-admin-btn ${open ? '' : 'btn-primary'}`}
          onClick={() => (open ? revoke(a.id) : unlock(a.id, new Date(), { admin: true }))}
          aria-label={`${a.name}: ${open ? 'geri al' : 'ver'}`}
        >
          {open ? <RotateCcw size={14} /> : <Trophy size={14} />} {open ? 'Geri al' : 'Ver'}
        </button>
      )}
      <div className="ach-card-body">
        <span className={`ach-rarity rarity-${a.rarity}`}>{RARITIES[a.rarity].label}</span>
        <h3>{secret ? '???' : a.name}</h3>
        {secret ? (
          <p className="ach-hint">
            <HelpCircle size={14} aria-hidden /> {a.hint}
          </p>
        ) : (
          <p>{a.description}</p>
        )}
        {open ? (
          <span className="subtle ach-date">{new Date(at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        ) : (
          progress &&
          progress.goal > 1 && (
            <div className="ach-progress" aria-label={`${progress.goal} hedefin ${progress.value} tanesi`}>
              <div className="progress">
                <div style={{ width: `${(progress.value / progress.goal) * 100}%` }} />
              </div>
              <span className="subtle">
                {progress.value}/{progress.goal}
              </span>
            </div>
          )
        )}
      </div>
    </article>
  )
}
