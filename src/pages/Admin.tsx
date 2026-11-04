import { ArrowLeft, Bug, GraduationCap, KeyRound, LayoutDashboard, Lightbulb, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react'
import { PremiumCodesAdmin } from '../components/PremiumCode'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useShowMore } from '../components/ShowMore'
import { Alert, Empty, Spinner, useToast } from '../components/ui'
import { ROLE_LABEL, useQuota, type Role } from '../lib/account'
import { LEVELS } from '../lib/studentType'
import { ageGroup, GENDERS } from '../lib/education'
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
  /** From admin_schools (profile.education); missing until that database function exists. */
  level?: string | null
  school?: string | null
  department?: string | null
  class_year?: string | null
  birth_year?: number | null
  gender?: string | null
  heard_from?: string | null
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

const GENDER_LABEL = Object.fromEntries(GENDERS.map((g) => [g.id, g.label])) as Record<string, string>

/** Most common first; empty answers left out. */
function tally(values: string[]): Array<[string, number]> {
  const m = new Map<string, number>()
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}

const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.id, l.label])) as Record<string, string>

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
/** "4 Kas": the join date needs no time of day. */
const day = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
const KIND = { fikir: 'Fikir', hata: 'Hata', diger: 'Diğer' } as Record<string, string>

/** The page's parts, one at a time, so no list makes it endless (?bolum= keeps the choice in the address). */
const TABS = [
  { id: 'ozet', label: 'Özet', icon: LayoutDashboard },
  { id: 'premium', label: 'Premium', icon: KeyRound },
  { id: 'hesaplar', label: 'Hesaplar', icon: Users },
  { id: 'geri-bildirim', label: 'Geri bildirim', icon: Lightbulb },
  { id: 'hatalar', label: 'Hatalar', icon: Bug },
] as const
type TabId = (typeof TABS)[number]['id']

type RoleFilter = 'all' | Role
type UserSort = 'new' | 'active' | 'seen'
const SORTS: Record<UserSort, string> = {
  new: 'Yeni katılan',
  seen: 'Son giriş',
  active: 'Bugün en aktif',
}

/** Lowercase without Turkish dotted/dotless differences, for search. */
const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

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
  const [params, setParams] = useSearchParams()
  const tab: TabId = TABS.some((t) => t.id === params.get('bolum')) ? (params.get('bolum') as TabId) : 'ozet'
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [sort, setSort] = useState<UserSort>('new')
  const [kind, setKind] = useState('all')

  const shownUsers = useMemo(() => {
    const q = fold(query.trim())
    const list = (users ?? []).filter(
      (u) => (roleFilter === 'all' || u.role === roleFilter) && (!q || fold([u.name, u.email, u.school, u.department].filter(Boolean).join(' ')).includes(q)),
    )
    const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)
    return [...list].sort((a, b) =>
      sort === 'active' ? b.ai_today - a.ai_today : sort === 'seen' ? time(b.last_sign_in_at) - time(a.last_sign_in_at) : time(b.created_at) - time(a.created_at),
    )
  }, [users, query, roleFilter, sort])
  const userList = useShowMore(shownUsers, 10, `${query}|${roleFilter}|${sort}`)
  const shownFeedback = kind === 'all' ? feedback : feedback.filter((f) => f.kind === kind)
  const feedbackList = useShowMore(shownFeedback, 8, kind)
  const errorList = useShowMore(errors, 8)

  function openTab(id: TabId) {
    const next = new URLSearchParams(params)
    if (id === 'ozet') next.delete('bolum')
    else next.set('bolum', id)
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    if (!supabase) return
    setError('')
    const [u, f, e, sc] = await Promise.all([supabase.rpc('admin_users'), supabase.rpc('admin_feedback'), supabase.rpc('admin_errors'), supabase.rpc('admin_schools')])
    if (u.error) {
      setError('Hesaplar yüklenemedi.')
      return
    }
    // Schools are optional: without the admin_schools function the list simply has no school column.
    type SchoolRow = Pick<AdminUser, 'id' | 'level' | 'school' | 'department' | 'class_year' | 'birth_year' | 'gender' | 'heard_from'>
    const schools = new Map<string, SchoolRow>((((sc.error ? [] : sc.data) as SchoolRow[] | null) ?? []).map((r) => [r.id, r]))
    setUsers(
      ((u.data ?? []) as AdminUser[]).map((x) => ({
        ...x,
        ...(schools.get(x.id) ?? {}),
        id: x.id,
      })),
    )
    setFeedback((f.data ?? []) as AdminFeedback[])
    setErrors((e.data ?? []) as AdminError[])
  }, [])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  async function setRole(user: AdminUser, role: Role) {
    if (!supabase) return
    setBusy(user.id)
    const { error: e } = await supabase.rpc('admin_set_role', {
      target: user.id,
      new_role: role,
    })
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
        <Alert
          tone="info"
          action={
            <Link to="/giris" className="btn btn-sm">
              Giriş yap
            </Link>
          }
        >
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
  // Where people study: universities by name, other levels by level.
  const schoolCounts = tally(today.map((u) => u.school || (u.level ? (LEVEL_LABEL[u.level] ?? u.level) : '')))
  // Only counts, never one person's age or gender.
  const summaries: Array<{ title: string; items: Array<[string, number]> }> = [
    { title: 'Bölümler', items: tally(today.map((u) => u.department ?? '')) },
    {
      title: 'Nereden duydular',
      items: tally(today.map((u) => u.heard_from ?? '')),
    },
    {
      title: 'Cinsiyet',
      items: tally(today.map((u) => (u.gender ? (GENDER_LABEL[u.gender] ?? '') : ''))),
    },
    {
      title: 'Yaş',
      items: tally(today.map((u) => ageGroup(u.birth_year ?? null) ?? '')),
    },
  ].filter((x) => x.items.length > 0)
  const answered = today.filter((u) => u.level).length

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

      <div className="admin-tabs" role="tablist" aria-label="Yönetim bölümleri">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = id === 'hesaplar' ? today.length : id === 'geri-bildirim' ? feedback.length : id === 'hatalar' ? errors.length : null
          return (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className="admin-tab" onClick={() => openTab(id)}>
              <Icon size={15} aria-hidden /> {label}
              {count !== null && count > 0 && <span className="tab-count">{count}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'ozet' && (
        <>
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

          {schoolCounts.length > 0 && (
            <section className="section" aria-label="Okullar">
              <h2>
                <GraduationCap size={18} aria-hidden /> Okullar{' '}
                <span className="subtle">
                  ({answered}/{today.length} kişi söyledi)
                </span>
              </h2>
              <div className="admin-schools">
                {schoolCounts.slice(0, 12).map(([name, n]) => (
                  <span key={name} className="chip">
                    {name} · {n}
                  </span>
                ))}
              </div>
              {summaries.map(({ title, items }) => (
                <div key={title} className="admin-summary">
                  <strong>{title}</strong>
                  <div className="admin-schools">
                    {items.slice(0, 10).map(([name, n]) => (
                      <span key={name} className="chip">
                        {name} · {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {tab === 'premium' && <PremiumCodesAdmin />}

      {tab === 'hesaplar' && (
        <section className="section" aria-label="Hesaplar">
          <h2>
            <Users size={18} aria-hidden /> Hesaplar{' '}
            <span className="subtle">
              ({shownUsers.length}/{today.length})
            </span>
          </h2>
          <div className="admin-tools">
            <label className="admin-search">
              <Search size={15} aria-hidden />
              <span className="sr-only">Hesap ara</span>
              <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="İsim, e-posta ya da okul ara" />
            </label>
            <label className="admin-sort">
              <span className="sr-only">Sırala</span>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as UserSort)}>
                {(Object.keys(SORTS) as UserSort[]).map((k) => (
                  <option key={k} value={k}>
                    {SORTS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="segmented admin-filter" role="group" aria-label="Role göre süz">
            {(['all', 'normal', 'vip', 'admin'] as RoleFilter[]).map((r) => (
              <button key={r} type="button" aria-pressed={roleFilter === r} onClick={() => setRoleFilter(r)}>
                {r === 'all' ? 'Hepsi' : ROLE_LABEL[r]} ({r === 'all' ? today.length : today.filter((u) => u.role === r).length})
              </button>
            ))}
          </div>
          {!users ? (
            <div className="share-loading">
              <Spinner /> Yükleniyor…
            </div>
          ) : (
            <div className="panel panel-tight list admin-users admin-compact">
              {shownUsers.length === 0 && <p className="subtle admin-empty">Bu aramaya uyan hesap yok.</p>}
              {userList.visible.map((u) => (
                <div key={u.id} className="list-item admin-user">
                  <div className="grow">
                    <div className="title">
                      {u.name || u.email} {u.role !== 'normal' && <span className={`chip role-chip is-${u.role}`}>{ROLE_LABEL[u.role]}</span>}
                    </div>
                    <div className="subtle">
                      {u.name ? `${u.email} · ` : ''}Katıldı {day(u.created_at)} · Son giriş {date(u.last_sign_in_at)}
                    </div>
                    {(u.school || u.level) && (
                      <div className="subtle admin-school">
                        <GraduationCap size={13} aria-hidden />{' '}
                        {(u.school ? [u.school, u.department, u.class_year] : [u.level ? LEVEL_LABEL[u.level] : '']).filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <div className="subtle">
                      {u.notes} not · Bugün {u.ai_today} istek
                      {u.last_study ? ` · Son çalışma ${u.last_study}` : ''}
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
              {userList.more}
            </div>
          )}
        </section>
      )}

      {tab === 'geri-bildirim' && (
        <section className="section" aria-label="Geri bildirimler">
          <h2>
            <Lightbulb size={18} aria-hidden /> Geri bildirimler
          </h2>
          {feedback.length > 0 && (
            <div className="segmented admin-filter" role="group" aria-label="Türe göre süz">
              {['all', ...Object.keys(KIND)].map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k === 'all' ? 'Hepsi' : KIND[k]} ({k === 'all' ? feedback.length : feedback.filter((f) => f.kind === k).length})
                </button>
              ))}
            </div>
          )}
          {feedback.length ? (
            <div className="panel panel-tight list admin-compact">
              {shownFeedback.length === 0 && <p className="subtle admin-empty">Bu türde geri bildirim yok.</p>}
              {feedbackList.visible.map((f, i) => (
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
              {feedbackList.more}
            </div>
          ) : (
            <p className="subtle">Henüz geri bildirim yok.</p>
          )}
        </section>
      )}

      {tab === 'hatalar' && (
        <section className="section" aria-label="Hatalar">
          <h2>
            <Bug size={18} aria-hidden /> Telefonlarda yakalanan hatalar (30 gün)
          </h2>
          {errors.length ? (
            <div className="panel panel-tight list admin-compact">
              {errorList.visible.map((e, i) => (
                <div key={i} className="list-item">
                  <div className="grow">
                    <div className="admin-message">{e.message}</div>
                    <div className="subtle">
                      {e.page ?? '—'} · {e.times} kez · son: {date(e.last_at)}
                    </div>
                  </div>
                </div>
              ))}
              {errorList.more}
            </div>
          ) : (
            <p className="subtle">Hata yakalanmadı.</p>
          )}
        </section>
      )}
    </div>
  )
}
