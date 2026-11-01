import { BookOpen, Brain, ChevronDown, ClipboardList, Gem, House, Info, LifeBuoy, MoreHorizontal, Plus, Settings, Trophy } from 'lucide-react'
import { Tour } from './Tour'
import { StudentTypeLink } from './StudentTypeCard'
import { triggerGlitch } from './Achievements'
import { ACHIEVEMENTS, unlock, useAchievements } from '../lib/achievements'
import { RoleBadge, VipWelcome } from './RoleBadge'
import { FeedbackLink } from './Feedback'
import { FocusEngine } from './mola/FocusEngine'
import { AmbientPlayer, Atmosphere } from './Atmosphere'
import { MadeBy } from './MadeBy'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { authErrorMessage, displayName } from '../lib/auth'
import { dueCards } from '../lib/format'
import { useStore } from '../lib/store'
import { authLinkError, openedFromConfirmationEmail, openedFromRecoveryEmail, supabase } from '../lib/supabase'
import { Landing } from '../pages/Landing'
import { Brand } from './Brand'
import { Alert } from './ui'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)).toLocaleUpperCase('tr-TR')
}

const MORE_KEY = 'studymode.navMore'
const MORE_ROUTES = ['/basarimlar', '/ogrenci-tipi', '/rehber']

// The reset link should open the new-password screen once, not on every later visit to the layout.
let recoveryHandled = false

export function Layout() {
  const { data, mode, session, saveError, clearSaveError } = useStore()
  const due = dueCards(data.cards).length
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [confirmed, setConfirmed] = useState(openedFromConfirmationEmail)
  const { unlocked } = useAchievements()
  const found = Object.keys(unlocked).length
  // Glitch Hunter: seven quick taps on the logo.
  const logoTaps = useRef<number[]>([])
  const tapLogo = () => {
    const now = Date.now()
    logoTaps.current = [...logoTaps.current.filter((t) => now - t < 2500), now]
    if (logoTaps.current.length >= 7) {
      logoTaps.current = []
      triggerGlitch()
      unlock('glitch')
    }
  }
  const [linkError, setLinkError] = useState(authLinkError)
  const name = displayName(session?.user)
  const [moreOpen, setMoreOpen] = useState(() => {
    try {
      return localStorage.getItem(MORE_KEY) === '1'
    } catch {
      return false
    }
  })

  // A password reset link signs the user in; send them straight to the new-password form.
  useEffect(() => {
    if (openedFromRecoveryEmail && !recoveryHandled) {
      recoveryHandled = true
      navigate('/sifre-yenile', { replace: true })
    }
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/sifre-yenile', { replace: true })
    })
    return () => data.subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (!confirmed) return
    const timer = window.setTimeout(() => setConfirmed(false), 8000)
    return () => window.clearTimeout(timer)
  }, [confirmed])

  // A course's mock exam lives under /ders/…, but it belongs to the "Sınavlar" tab.
  const inExam = /^\/ders\/[^/]+\/sinav/.test(pathname)
  const navClass = (base: string, to: string) => ({ isActive }: { isActive: boolean }) =>
    `${base} ${isActive || (to === '/sinav' && inExam) ? 'active' : ''}`.trim()

  // Logged-out first visitors get the marketing page instead of an empty app. A link error still needs the app shell to explain itself.
  if (pathname === '/' && !session && !data.courses.length && !linkError) return <Landing />

  // "Daha fazla": the extras fold away so the menu stays short; it opens by itself on its own pages.
  const inMore = MORE_ROUTES.some((r) => pathname.startsWith(r))
  const showMore = moreOpen || inMore
  function toggleMore() {
    const next = !showMore
    setMoreOpen(next)
    try {
      localStorage.setItem(MORE_KEY, next ? '1' : '0')
    } catch {
      // Remembering is a convenience only.
    }
  }

  const links = [
    { to: '/', label: 'Bugün', icon: House, end: true, tour: 'bugun' },
    { to: '/dersler', label: 'Dersler', icon: BookOpen },
    { to: '/tekrar', label: 'Tekrar', icon: Brain, badge: due, tour: 'tekrar' },
    { to: '/sinav', label: 'Sınavlar', icon: ClipboardList, tour: 'sinavlar' },
  ]

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Ana menü">
        <div className="brand-row">
          <Link to="/" className="brand-link" onClick={tapLogo}>
            <Brand />
          </Link>
          <RoleBadge />
        </div>
        <NavLink to="/not-ekle" className="btn btn-primary" style={{ marginBottom: 16 }} data-tour="ekle">
          <Plus size={18} /> Not ekle
        </NavLink>
        {links.map(({ to, label, icon: Icon, end, badge, tour }) => (
          <NavLink key={to} to={to} end={end} className={navClass('nav-link', to)} data-tour={tour}>
            <Icon size={18} />
            {label}
            {!!badge && <span className="nav-badge">{badge}</span>}
          </NavLink>
        ))}
        <NavLink to="/premium" className={({ isActive }) => `nav-link prem-nav${isActive ? ' active' : ''}`} data-tour="premium">
          <Gem size={18} />
          Premium
          <span className="prem-nav-shine" aria-hidden />
        </NavLink>
        <button
          type="button"
          className={`nav-link nav-more${showMore ? ' is-open' : ''}`}
          aria-expanded={showMore}
          aria-controls="nav-more"
          onClick={toggleMore}
          data-tour="daha"
        >
          <MoreHorizontal size={18} />
          Daha fazla
          <ChevronDown size={16} className="nav-more-chev" aria-hidden />
        </button>
        {showMore && (
          <div id="nav-more" className="nav-more-group">
            <NavLink to="/basarimlar" className={navClass('nav-link', '/basarimlar')}>
              <Trophy size={18} />
              Başarımlar
              <span className="nav-count">
                {found}/{ACHIEVEMENTS.length}
              </span>
            </NavLink>
            <StudentTypeLink className="side-quiz is-compact" />
            <NavLink to="/rehber" className={navClass('nav-link', '/rehber')}>
              <LifeBuoy size={18} />
              Rehber
            </NavLink>
            <NavLink to="/hakkinda" className="nav-link">
              <Info size={18} />
              Hakkında
            </NavLink>
          </div>
        )}
        {/* Settings belong with the account at the bottom, not between the study pages. */}
        <NavLink to="/ayarlar" className={navClass('nav-link sidebar-settings', '/ayarlar')}>
          <Settings size={18} />
          Ayarlar
        </NavLink>
        <div className="sidebar-footer">
          <span className={`status-dot ${mode === 'cloud' ? 'cloud' : ''}`} />
          <span title={session?.user.email} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mode === 'cloud' ? name : 'Bu cihazda kayıtlı'}
          </span>
        </div>
        <FeedbackLink className="sidebar-feedback" />
        <MadeBy className="sidebar-made-by" />
      </aside>

      <main className="main">
        <header className="mobile-top">
          <div className="brand-row">
            <Link to="/" className="brand-link" onClick={tapLogo}>
              <Brand size={26} />
            </Link>
            <RoleBadge />
          </div>
          <div className="mobile-top-actions">
          <AmbientPlayer inHeader />
          {/* Signed-out phones already carry settings and "Giriş yap" here; Premium needs an account anyway. */}
          {session && (
            <NavLink to="/premium" className="prem-top" aria-label="Premium" data-tour="premium">
              <Gem size={18} aria-hidden />
            </NavLink>
          )}
          {!session && (
            <NavLink to="/ayarlar" className="btn btn-ghost btn-icon" aria-label="Ayarlar" data-tour="daha">
              <Settings size={20} />
            </NavLink>
          )}
          {session ? (
            <Link to="/ayarlar" className="mobile-avatar" aria-label="Ayarlar ve hesap" title={session.user.email} data-tour="daha">
              {initials(name)}
              {/* The gear says "settings": the initials alone did not (a friend could not find Ayarlar). */}
              <span className="mobile-avatar-gear" aria-hidden="true">
                <Settings size={12} strokeWidth={2.4} />
              </span>
            </Link>
          ) : pathname === '/giris' ? null : (
            <Link to="/giris" className="btn btn-sm">
              Giriş yap
            </Link>
          )}
          </div>
        </header>
        {confirmed && mode === 'cloud' && (
          <div className="page" style={{ marginBottom: 20 }}>
            <Alert tone="info">E-postan doğrulandı ve giriş yaptın. Notların artık tüm cihazlarında senkronize olacak.</Alert>
          </div>
        )}
        {linkError && (
          <div className="page" style={{ marginBottom: 20 }}>
            <Alert
              tone="warning"
              action={
                <button className="btn btn-sm" onClick={() => setLinkError(null)}>
                  Tamam
                </button>
              }
            >
              {authErrorMessage(linkError)}{' '}
              {!session && (
                <Link to="/giris" style={{ fontWeight: 600, textDecoration: 'underline' }} onClick={() => setLinkError(null)}>
                  Giriş sayfasına git
                </Link>
              )}
            </Alert>
          </div>
        )}
        {saveError && (
          <div className="page" style={{ marginBottom: 20 }}>
            <Alert
              tone="danger"
              action={
                <button className="btn btn-sm" onClick={clearSaveError}>
                  Tamam
                </button>
              }
            >
              {saveError}
            </Alert>
          </div>
        )}
        <Outlet />
        <div className="mobile-foot">
          <FeedbackLink />
          <MadeBy />
          <Link to="/gizlilik" className="made-by">
            Gizlilik
          </Link>
        </div>
      </main>
      <FocusEngine />
      <Atmosphere />
      <VipWelcome />
      <Tour />

      <nav className="mobile-bar" aria-label="Alt menü">
        <NavLink to="/" end data-tour="bugun">
          <House size={20} />
          <span>Bugün</span>
        </NavLink>
        <NavLink to="/dersler">
          <BookOpen size={20} />
          <span>Dersler</span>
        </NavLink>
        <NavLink to="/not-ekle" className="add" aria-label="Not ekle" data-tour="ekle">
          <span>
            <Plus size={20} />
          </span>
          <span>Ekle</span>
        </NavLink>
        <NavLink to="/tekrar" data-tour="tekrar">
          <Brain size={20} />
          <span>Tekrar</span>
          {!!due && <span className="dot">{due > 99 ? '99+' : due}</span>}
        </NavLink>
        <NavLink to="/sinav" className={navClass('', '/sinav')} data-tour="sinavlar">
          <ClipboardList size={20} />
          <span>Sınavlar</span>
        </NavLink>
      </nav>
    </div>
  )
}
