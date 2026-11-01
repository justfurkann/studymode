import { ArrowLeft, Bug, Lightbulb, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Empty, Spinner, useToast } from '../components/ui'
import { ROLE_LABEL, useQuota, type Role } from '../lib/account'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'

interface AdminUser {
  id: string
  email: string
  name: string
  created_at: string
  last_sign_in_at: string | null
  role: Role
  ai_today: number
  notes: number
  last_study: string | null
}
interface AdminFeedback {
  kind: string
  message: string
  contact: string | null
  page: string | null
  email: string | null
  created_at: string
}
interface AdminError {
  message: string
  page: string | null
  times: number
  last_at: string
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
const KIND = { fikir: 'Fikir', hata: 'Hata', diger: 'Diğer' } as Record<string, string>

/** /yonetim: only for the admin role (checked again by every database function). */
export function Admin() {
  const store = useStore()
  const quota = useQuota(store.session?.user.id ?? null)
  const toast = useToast()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [feedback, setFeedback] = useState<AdminFeedback[]>([])
  const [errors, setErrors] = useState<AdminError[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const isAdmin = quota?.role === 'admin'

  const load = useCallback(async () => {
    if (!supabase) return
    setError('')
    const [u, f, e] = await Promise.all([supabase.rpc('admin_users'), supabase.rpc('admin_feedback'), supabase.rpc('admin_errors')])
    if (u.error) {
      setError('Hesaplar yüklenemedi.')
      return
    }
    setUsers((u.data ?? []) as AdminUser[])
    setFeedback((f.data ?? []) as AdminFeedback[])
    setErrors((e.data ?? []) as AdminError[])
  }, [])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  async function setRole(user: AdminUser, role: Role) {
    if (!supabase) return
    setBusy(user.id)
    const { error: e } = await supabase.rpc('admin_set_role', { target: user.id, new_role: role })
    setBusy(null)
    if (e) {
      toast(e.message.includes('demote') ? 'Kendi yöneticiliğini kaldıramazsın.' : 'Rol değiştirilemedi.')
      return
    }
    toast(`${user.name || user.email}: ${ROLE_LABEL[role]}`)
    void load()
  }

  if (!store.session) {
    return (
      <div className="page page-narrow">
        <Alert tone="info" action={<Link to="/giris" className="btn btn-sm">Giriş yap</Link>}>
          Yönetim sayfası için giriş yapman gerekiyor.
        </Alert>
      </div>
    )
  }
  if (!quota) {
    return (
      <div className="page page-narrow">
        <div className="share-loading">
          <Spinner /> Yükleniyor…
        </div>
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <div className="page page-narrow">
        <div className="panel">
          <Empty icon={<ShieldCheck size={32} />} title="Bu sayfa yalnızca yönetici için">
            <Link to="/" className="btn">
              Ana sayfaya dön
            </Link>
          </Empty>
        </div>
      </div>
    )
  }

  const today = users ?? []
  const activeToday = today.filter((u) => u.ai_today > 0).length
  const requestsToday = today.reduce((n, u) => n + u.ai_today, 0)
  const vips = today.filter((u) => u.role === 'vip').length

  return (
    <div className="page admin">
      <div className="page-header">
        <div>
          <Link to="/ayarlar" className="back-link">
            <ArrowLeft size={16} /> Ayarlar
          </Link>
          <h1>Yönetim</h1>
          <p className="muted">Hesaplar, roller, geri bildirimler ve hatalar. Notların içeriği burada görünmez.</p>
        </div>
        <button className="btn btn-sm" onClick={() => void load()}>
          <RefreshCw size={15} /> Yenile
        </button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="admin-stats">
        <div className="panel">
          <strong>{today.length}</strong>
          <span className="subtle">hesap</span>
        </div>
        <div className="panel">
          <strong>{activeToday}</strong>
          <span className="subtle">bugün yapay zekâ kullanan</span>
        </div>
        <div className="panel">
          <strong>{requestsToday}</strong>
          <span className="subtle">bugünkü istek</span>
        </div>
        <div className="panel">
          <strong>{vips}</strong>
          <span className="subtle">VIP</span>
        </div>
      </div>

      <section className="section" aria-label="Hesaplar">
        <h2>
          <Users size={18} aria-hidden /> Hesaplar
        </h2>
        {!users ? (
          <div className="share-loading">
            <Spinner /> Yükleniyor…
          </div>
        ) : (
          <div className="panel panel-tight list admin-users">
            {users.map((u) => (
              <div key={u.id} className="list-item admin-user">
                <div className="grow">
                  <div className="title">
                    {u.name || u.email} {u.role !== 'normal' && <span className={`chip role-chip is-${u.role}`}>{ROLE_LABEL[u.role]}</span>}
                  </div>
                  <div className="subtle">
                    {u.name ? `${u.email} · ` : ''}Katıldı: {date(u.created_at)} · Son giriş: {date(u.last_sign_in_at)}
                  </div>
                  <div className="subtle">
                    {u.notes} not · Bugün {u.ai_today} istek{u.last_study ? ` · Son çalışma: ${u.last_study}` : ''}
                  </div>
                </div>
                <label className="admin-role">
                  <span className="sr-only">{u.name || u.email} rolü</span>
                  <select className="select" value={u.role} disabled={busy === u.id || u.id === store.session!.user.id} onChange={(e) => void setRole(u, e.target.value as Role)}>
                    <option value="normal">Normal (40/gün)</option>
                    <option value="vip">VIP (150/gün)</option>
                    <option value="admin">Yönetici (sınırsız)</option>
                  </select>
                </label>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section" aria-label="Geri bildirimler">
        <h2>
          <Lightbulb size={18} aria-hidden /> Geri bildirimler
        </h2>
        {feedback.length ? (
          <div className="panel panel-tight list">
            {feedback.map((f, i) => (
              <div key={i} className="list-item">
                <span className={`chip ${f.kind === 'hata' ? 'chip-danger' : 'chip-accent'}`}>{KIND[f.kind] ?? f.kind}</span>
                <div className="grow">
                  <div className="admin-message">{f.message}</div>
                  <div className="subtle">
                    {f.email ?? f.contact ?? 'Misafir'}
                    {f.page ? ` · ${f.page}` : ''} · {date(f.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtle">Henüz geri bildirim yok.</p>
        )}
      </section>

      <section className="section" aria-label="Hatalar">
        <h2>
          <Bug size={18} aria-hidden /> Telefonlarda yakalanan hatalar (30 gün)
        </h2>
        {errors.length ? (
          <div className="panel panel-tight list">
            {errors.map((e, i) => (
              <div key={i} className="list-item">
                <div className="grow">
                  <div className="admin-message">{e.message}</div>
                  <div className="subtle">
                    {e.page ?? '—'} · {e.times} kez · son: {date(e.last_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtle">Hata yakalanmadı.</p>
        )}
      </section>
    </div>
  )
}
