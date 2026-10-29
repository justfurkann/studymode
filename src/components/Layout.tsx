import { BookOpen, Brain, House, Plus, Settings, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { dueCards } from '../lib/format'
import { useStore } from '../lib/store'
import { openedFromConfirmationEmail } from '../lib/supabase'
import { Alert } from './ui'

export function Layout() {
  const { data, mode, session, saveError, clearSaveError } = useStore()
  const due = dueCards(data.cards).length
  const [confirmed, setConfirmed] = useState(openedFromConfirmationEmail)

  useEffect(() => {
    if (!confirmed) return
    const timer = window.setTimeout(() => setConfirmed(false), 8000)
    return () => window.clearTimeout(timer)
  }, [confirmed])

  const links = [
    { to: '/', label: 'Bugün', icon: House, end: true },
    { to: '/dersler', label: 'Dersler', icon: BookOpen },
    { to: '/tekrar', label: 'Tekrar', icon: Brain, badge: due },
    { to: '/ayarlar', label: 'Ayarlar', icon: Settings },
  ]

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Ana menü">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={17} />
          </span>
          studymode
        </div>
        <NavLink to="/not-ekle" className="btn btn-primary" style={{ marginBottom: 16 }}>
          <Plus size={18} /> Not ekle
        </NavLink>
        {links.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className="nav-link">
            <Icon size={18} />
            {label}
            {!!badge && <span className="nav-badge">{badge}</span>}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <span className={`status-dot ${mode === 'cloud' ? 'cloud' : ''}`} />
          {mode === 'cloud' ? session?.user.email : 'Bu cihazda kayıtlı'}
        </div>
      </aside>

      <main className="main">
        <div className="mobile-account"><NavLink to={session ? '/ayarlar' : '/giris'}><span className={`status-dot ${mode === 'cloud' ? 'cloud' : ''}`} />{session?.user.email ?? 'Misafir · Bu cihazda kayıtlı'}</NavLink><span>{saveError ? 'Kayıt hatası' : mode === 'cloud' ? 'Bulut hesabı' : 'Giriş yap'}</span></div>
        {confirmed && mode === 'cloud' && (
          <div className="page" style={{ marginBottom: 20 }}>
            <Alert tone="info">E-postan doğrulandı ve giriş yaptın. Notların artık tüm cihazlarında senkronize olacak.</Alert>
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
      </main>

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
        <NavLink to="/ayarlar">
          <Settings size={20} />
          <span>Ayarlar</span>
        </NavLink>
      </nav>
    </div>
  )
}
