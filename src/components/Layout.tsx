import { BookOpen, Brain, ClipboardList, House, Plus, Settings } from 'lucide-react'
import { FocusEngine } from './mola/FocusEngine'
import { MadeBy } from './MadeBy'
import { useEffect, useState } from 'react'
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

// The reset link should open the new-password screen once, not on every later visit to the layout.
let recoveryHandled = false

export function Layout() {
  const { data, mode, session, saveError, clearSaveError } = useStore()
  const due = dueCards(data.cards).length
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [confirmed, setConfirmed] = useState(openedFromConfirmationEmail)
  const [linkError, setLinkError] = useState(authLinkError)
  const name = displayName(session?.user)

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

  const links = [
    { to: '/', label: 'Bugün', icon: House, end: true },
    { to: '/dersler', label: 'Dersler', icon: BookOpen },
    { to: '/tekrar', label: 'Tekrar', icon: Brain, badge: due },
    { to: '/sinav', label: 'Sınavlar', icon: ClipboardList },
    { to: '/ayarlar', label: 'Ayarlar', icon: Settings },
  ]

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Ana menü">
        <Link to="/" className="brand-link">
          <Brand />
        </Link>
        <NavLink to="/not-ekle" className="btn btn-primary" style={{ marginBottom: 16 }}>
          <Plus size={18} /> Not ekle
        </NavLink>
        {links.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className={navClass('nav-link', to)}>
            <Icon size={18} />
            {label}
            {!!badge && <span className="nav-badge">{badge}</span>}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <span className={`status-dot ${mode === 'cloud' ? 'cloud' : ''}`} />
          <span title={session?.user.email} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mode === 'cloud' ? name : 'Bu cihazda kayıtlı'}
          </span>
        </div>
        <MadeBy className="sidebar-made-by" />
      </aside>

      <main className="main">
        <header className="mobile-top">
          <Link to="/" className="brand-link">
            <Brand size={26} />
          </Link>
          <div className="mobile-top-actions">
          {!session && (
            <NavLink to="/ayarlar" className="btn btn-ghost btn-icon" aria-label="Ayarlar">
              <Settings size={20} />
            </NavLink>
          )}
          {session ? (
            <Link to="/ayarlar" className="mobile-avatar" aria-label={`Hesap: ${name}`} title={session.user.email}>
              {initials(name)}
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
        <MadeBy className="mobile-made-by" />
      </main>
      <FocusEngine />

      <nav className="mobile-bar" aria-label="Alt menü">
        <NavLink to="/" end>
          <House size={20} />
          <span>Bugün</span>
        </NavLink>
        <NavLink to="/dersler">
          <BookOpen size={20} />
          <span>Dersler</span>
        </NavLink>
        <NavLink to="/not-ekle" className="add" aria-label="Not ekle">
          <span>
            <Plus size={20} />
          </span>
          <span>Ekle</span>
        </NavLink>
        <NavLink to="/tekrar">
          <Brain size={20} />
          <span>Tekrar</span>
          {!!due && <span className="dot">{due > 99 ? '99+' : due}</span>}
        </NavLink>
        <NavLink to="/sinav" className={navClass('', '/sinav')}>
          <ClipboardList size={20} />
          <span>Sınavlar</span>
        </NavLink>
      </nav>
    </div>
  )
}
