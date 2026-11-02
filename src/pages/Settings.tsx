import { Cloud, Download, Eye, EyeOff, KeyRound, LogOut, Monitor, Moon, Sun, LifeBuoy, PlayCircle, Trash2, Trophy, Upload } from 'lucide-react'
import { PremiumAccessSection } from '../components/PremiumCode'
import { requestTour } from '../lib/tour'
import { StudentTypeSection } from '../components/StudentTypeCard'
import { EducationForm } from '../components/EducationForm'
import { educationLabel, needsEducation, useEducation } from '../lib/education'
import { FeedbackLink } from '../components/Feedback'
import { MakerCard } from '../components/MadeBy'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Spinner, useToast, useConfirm } from '../components/ui'
import { authErrorMessage, MIN_PASSWORD, nameMetadata, passwordProblem } from '../lib/auth'
import { hasLocalData, parseData } from '../lib/backend'
import { PROVIDERS, updateSettings, useSettings, type AiProvider, type KeyProvider, type Theme } from '../lib/settings'
import { migrateLocalToCloud, useStore } from '../lib/store'
import { isPremiumRole, quotaText, ROLE_LABEL, useQuota } from '../lib/account'
import { hasPremiumUntil } from '../lib/premiumCodes'
import { clampDailyGoal } from '../lib/streak'
import { supabase } from '../lib/supabase'
import { emptyData } from '../lib/types'
import { freshImport } from '../lib/version'
import { DecorSettings } from '../components/DecorSettings'
import { localDayKey } from '../lib/streak'

function AccountSection() {
  const store = useStore()
  const toast = useToast()
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState('')
  const localLeft = store.mode === 'cloud' && hasLocalData()

  if (!supabase) {
    return (
      <Alert>
        Bu kurulumda hesap sistemi kapalı; notların yalnızca bu tarayıcıda saklanır. Tarayıcı verilerini temizlersen kaybolurlar, ara sıra aşağıdan yedek almanı öneririz.
      </Alert>
    )
  }

  if (!store.session) {
    return (
      <div className="form">
        <p className="muted">Şu an notların yalnızca bu tarayıcıda. Giriş yaparsan telefonundan ve bilgisayarından aynı notlara ulaşırsın.</p>
        <div>
          <Link to="/giris" className="btn btn-primary">
            <Cloud size={17} /> Giriş yap veya hesap oluştur
          </Link>
        </div>
      </div>
    )
  }

  async function move() {
    setMoving(true)
    setError('')
    try {
      await migrateLocalToCloud(store)
      toast('Bu cihazdaki notlar hesabına taşındı')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Taşıma başarısız oldu.')
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="form">
      <p>
        <span className="muted">Giriş yapıldı:</span> <strong>{store.session.user.email}</strong>
      </p>
      <ProfileForm />
      {localLeft && (
        <Alert
          tone="info"
          action={
            <button className="btn btn-sm" onClick={move} disabled={moving}>
              {moving ? <Spinner size={15} /> : null} Hesabıma taşı
            </button>
          }
        >
          Giriş yapmadan önce bu tarayıcıda oluşturduğun dersler var.
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <button className="btn" onClick={() => supabase!.auth.signOut()}>
          <LogOut size={17} /> Çıkış yap
        </button>
      </div>
    </div>
  )
}

function ProfileForm() {
  const store = useStore()
  const toast = useToast()
  const user = store.session!.user
  const meta = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string }
  const [first, setFirst] = useState(meta.first_name ?? '')
  const [last, setLast] = useState(meta.last_name ?? '')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState<'name' | 'password' | null>(null)
  const [error, setError] = useState('')
  const nameChanged = first.trim() !== (meta.first_name ?? '') || last.trim() !== (meta.last_name ?? '')

  async function saveName(event: FormEvent) {
    event.preventDefault()
    if (!first.trim() || !last.trim()) return setError('Adını ve soyadını yaz.')
    setBusy('name')
    setError('')
    try {
      const { error } = await supabase!.auth.updateUser({ data: nameMetadata(first, last) })
      if (error) throw error
      toast('Adın kaydedildi')
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    const problem = passwordProblem(password, repeat)
    if (problem) return setError(problem)
    setBusy('password')
    setError('')
    try {
      const { error } = await supabase!.auth.updateUser({ password })
      if (error) throw error
      setPassword('')
      setRepeat('')
      toast('Şifren güncellendi')
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <form className="form" onSubmit={saveName}>
        {!meta.first_name && <Alert tone="info">Hesabında adın kayıtlı değil. Ekleyince menüde e-posta yerine adın görünür.</Alert>}
        <div className="form-row">
          <label className="field">
            <span>Ad</span>
            <input className="input" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} maxLength={50} />
          </label>
          <label className="field">
            <span>Soyad</span>
            <input className="input" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} maxLength={50} />
          </label>
        </div>
        <div>
          <button className="btn" disabled={!nameChanged || busy !== null}>
            {busy === 'name' && <Spinner size={15} />} Adı kaydet
          </button>
        </div>
      </form>
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 550 }}>Şifreyi değiştir</summary>
        <form className="form" onSubmit={savePassword} style={{ marginTop: 12 }}>
          <div className="form-row">
            <label className="field">
              <span>Yeni şifre</span>
              <input className="input" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="field">
              <span>Yeni şifre (tekrar)</span>
              <input className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </label>
          </div>
          <div>
            <button className="btn" disabled={!password || busy !== null}>
              {busy === 'password' && <Spinner size={15} />} Şifreyi güncelle
            </button>
          </div>
        </form>
      </details>
      {error && <Alert tone="danger">{error}</Alert>}
    </>
  )
}

function AiSection() {
  const settings = useSettings()
  const store = useStore()
  const [visible, setVisible] = useState(false)
  const [drafts, setDrafts] = useState(settings.keys)
  const [state, setState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>({ kind: 'idle' })
  const provider = settings.provider

  function choose(next: AiProvider) {
    updateSettings({ provider: next })
    setState({ kind: 'idle' })
  }

  async function save(target: KeyProvider) {
    const trimmed = drafts[target].trim()
    if (!trimmed) {
      updateSettings({ keys: { ...settings.keys, [target]: '' } })
      setState({ kind: 'idle' })
      return
    }
    setState({ kind: 'testing' })
    try {
      await (await freshImport(() => import('../lib/ai'))).testApiKey(target, trimmed, settings.models[target])
      updateSettings({ keys: { ...settings.keys, [target]: trimmed } })
      setState({ kind: 'ok', message: 'Anahtar çalışıyor ve kaydedildi.' })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Anahtar doğrulanamadı.' })
    }
  }

  const quota = useQuota(store.session?.user.id ?? null)
  // VIPs, admins and anyone with a Premium code (their role stays 'normal') get Free+.
  const canPlus = isPremiumRole(quota?.role) || hasPremiumUntil(quota?.premiumUntil)
  // They always get Free+ from the server, so for them the free option is Free+ itself.
  const options: Array<{ id: AiProvider; label: string }> = [
    ...(canPlus ? [{ id: 'plus' as const, label: 'Free+' }] : [{ id: 'shared' as const, label: 'Ücretsiz' }]),
    ...(!canPlus && provider === 'plus' ? [{ id: 'plus' as const, label: 'Free+' }] : []),
    { id: 'anthropic', label: 'Claude' },
    { id: 'openai', label: 'ChatGPT' },
    { id: 'google', label: 'Gemini' },
  ]

  return (
    <div className="form">
      <p className="muted">Yapay zekâ notlarından özet, kart, test ve sınav provası hazırlar. Hangi servisin kullanılacağını seç:</p>
      <div className="segmented" role="group" aria-label="Yapay zekâ servisi">
        {options.map((o) => (
          <button key={o.id} aria-pressed={provider === o.id || (canPlus && o.id === 'plus' && provider === 'shared')} onClick={() => choose(o.id)}>
            {o.label}
          </button>
        ))}
      </div>

      {provider === 'plus' || (canPlus && provider === 'shared') ? (
        <>
          <PlusPanel eligible={canPlus} />
          {/* When Free+ runs out for the day, requests continue on this allowance. */}
          <QuotaLine />
        </>
      ) : provider === 'shared' ? (
        <>
          <p>
            <strong>Ücretsiz yapay zekâ</strong> <span className="muted">— hiçbir şey ayarlamana gerek yok, sadece giriş yapman yeterli.</span>
          </p>
          {!store.session && (
            <Alert tone="info" action={<Link to="/giris" className="btn btn-sm">Giriş yap</Link>}>
              Ücretsiz yapay zekâ yalnızca giriş yapmış kullanıcılara açık.
            </Alert>
          )}
          <QuotaLine />
          <p className="subtle">
            Google Gemini’nin ücretsiz katmanını kullanır. Google ücretsiz kullanımdaki içerikleri ürünlerini geliştirmek için kullanabilir; kişisel ya da gizli bilgi içeren notları
            yükleme. Çok kullanıldığı saatlerde kota dolabilir; o zaman biraz bekle ya da kendi anahtarını bağla.
          </p>
        </>
      ) : (
        (() => {
          const info = PROVIDERS[provider]
          const saved = settings.keys[provider]
          const draft = drafts[provider]
          return (
            <>
              <label className="field">
                <span>{info.label} API anahtarı</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    type={visible ? 'text' : 'password'}
                    value={draft}
                    onChange={(e) => setDrafts({ ...drafts, [provider]: e.target.value })}
                    placeholder={info.keyHint}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="button" className="btn btn-icon" style={{ minHeight: 42, width: 42 }} aria-label={visible ? 'Anahtarı gizle' : 'Anahtarı göster'} onClick={() => setVisible(!visible)}>
                    {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <ModelPicker
                models={info.models}
                value={settings.models[provider]}
                onChange={(model) => updateSettings({ models: { ...settings.models, [provider]: model } })}
              />
              <div className="btn-row">
                <button className="btn btn-primary" onClick={() => save(provider)} disabled={state.kind === 'testing' || draft.trim() === saved}>
                  {state.kind === 'testing' ? <Spinner size={16} /> : <KeyRound size={17} />} {!draft.trim() && saved ? 'Anahtarı kaldır' : 'Doğrula ve kaydet'}
                </button>
                {saved && <span className="chip chip-success">{info.label} bağlı</span>}
              </div>
              <p className="subtle">
                Anahtarı{' '}
                <a href={info.keyUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>
                  buradan
                </a>{' '}
                alabilirsin; ücreti doğrudan senin hesabından düşer. Anahtar yalnızca bu tarayıcıda saklanır, hesabına senkronize edilmez; notun işlenirken doğrudan servise
                gönderilir. Ortak kullanılan bir bilgisayarda anahtar kaydetme.
              </p>
            </>
          )
        })()
      )}
      {state.kind === 'ok' && <Alert tone="info">{state.message}</Alert>}
      {state.kind === 'error' && <Alert tone="danger">{state.message}</Alert>}
    </div>
  )
}

function DataSection() {
  const [confirm, confirmation] = useConfirm()
  const store = useStore()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'studymode', version: 2, ...store.data }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `studymode-yedek-${localDayKey()}.json`
    link.click()
    // Revoking right away cancels the download in Safari and Firefox.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function importData(file: File) {
    setError('')
    try {
      const data = parseData(JSON.parse(await file.text()))
      if (!await confirm(`Yedekte ${data.courses.length} ders ve ${data.notes.length} not var. Mevcut verilerin bunlarla değiştirilsin mi?`)) return
      await store.replaceAll(data)
      toast('Yedek geri yüklendi')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yedek okunamadı.')
    }
  }

  async function wipe() {
    if (!await confirm('Tüm dersler, notlar ve kartlar silinsin mi? Bu geri alınamaz.')) return
    try {
      await store.replaceAll(emptyData())
      toast('Tüm veriler silindi')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi.')
    }
  }

  return (
    <div className="form">{confirmation}
      <p className="muted">
        {store.data.courses.length} ders · {store.data.notes.length} not · {store.data.cards.length} kart
      </p>
      <div className="btn-row">
        <button className="btn" onClick={exportData}>
          <Download size={17} /> Yedek indir
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          <Upload size={17} /> Yedekten geri yükle
        </button>
        <button className="btn btn-danger" onClick={wipe}>
          <Trash2 size={17} /> Her şeyi sil
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importData(file)
            e.target.value = ''
          }}
        />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  )
}

const THEMES: Array<{ id: Theme; label: string; icon: typeof Sun }> = [
  { id: 'system', label: 'Sistem', icon: Monitor },
  { id: 'light', label: 'Açık', icon: Sun },
  { id: 'dark', label: 'Koyu', icon: Moon },
]

export function Settings() {
  const settings = useSettings()
  const store = useStore()

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <h1>Ayarlar</h1>
        </div>
        <AdminLink />
      </div>

      <section className="section">
        <h2>Hesap ve senkronizasyon</h2>
        <div className="panel">
          <AccountSection />
        </div>
      </section>

      <section className="section">
        <h2>Yapay zekâ</h2>
        <div className="panel">
          <AiSection />
        </div>
      </section>

      <section className="section">
        <h2>Çalışma hedefi</h2>
        <div className="panel form">
          <label className="field" style={{ maxWidth: 240 }}>
            <span>Günlük kart hedefi</span>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={settings.dailyGoal}
              onChange={(e) => updateSettings({ dailyGoal: clampDailyGoal(e.target.value, settings.dailyGoal) })}
            />
          </label>
          <p className="subtle">
            Bugün sayfasındaki günlük tekrar ilerlemesi bu hedefe göre gösterilir. En az 1 kart tekrarı veya 1 test tamamlamak günlük serini korur.
          </p>
        </div>
      </section>

      {store.session && (
        <section className="section">
          <h2>Okulun</h2>
          <EducationSection />
        </section>
      )}

      <section className="section">
        <h2>Premium</h2>
        <PremiumAccessSection />
      </section>

      <section className="section">
        <h2>Öğrenci tipin</h2>
        <StudentTypeSection />
      </section>

      <section className="section">
        <h2>Görünüm ve ses</h2>
        <div className="btn-row">
          <Link to="/basarimlar" className="btn btn-sm trophy-link">
            <Trophy size={16} /> Başarımlarım
          </Link>
          <Link to="/rehber" className="btn btn-sm">
            <LifeBuoy size={16} /> Rehber
          </Link>
          <button type="button" className="btn btn-sm" onClick={() => requestTour()}>
            <PlayCircle size={16} /> Turu tekrar başlat
          </button>
        </div>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
          <div className="segmented" role="group" aria-label="Tema">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button key={id} aria-pressed={settings.theme === id} onClick={() => updateSettings({ theme: id })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          <label className="check-row">
            <input type="checkbox" checked={settings.sounds} onChange={(e) => updateSettings({ sounds: e.target.checked })} />
            <span>
              Küçük sesler
              <span className="subtle"> · Doğru, yanlış ve bitiş anlarında kısa bir ses. Kütüphanede kapalı tutmak isteyebilirsin.</span>
            </span>
          </label>
          <DecorSettings />
        </div>
      </section>

      <section className="section">
        <h2>Verilerin</h2>
        <div className="panel">
          <DataSection />
        </div>
      </section>

      <section className="section" aria-label="Geri bildirim">
        <h2>Fikrin mi var, hata mı buldun?</h2>
        <div className="panel feedback-panel">
          <p className="muted">Yaz, doğrudan uygulamayı yapan kişiye gitsin. Her mesaj okunuyor; çoğu fikir uygulamaya böyle girdi.</p>
          <FeedbackLink className="btn" label="Geri bildirim gönder" />
        </div>
      </section>

      <section className="section" id="hakkinda" aria-label="Hakkında">
        <h2>Hakkında</h2>
        <MakerCard />
      </section>
    </div>
  )
}

const CUSTOM = '__custom__'

/**
 * A real list of models (the old suggestion box only showed the one already typed, so it looked
 * like there was a single choice), plus "Başka bir model" for typing any other model name.
 */
function ModelPicker({ models, value, onChange }: { models: Array<{ id: string; label: string }>; value: string; onChange: (model: string) => void }) {
  const known = models.some((m) => m.id === value)
  const [custom, setCustom] = useState(!known)
  return (
    <div className="field">
      <label className="field">
        <span>Model</span>
        <select
          className="select"
          value={custom ? CUSTOM : value}
          onChange={(e) => {
            if (e.target.value === CUSTOM) setCustom(true)
            else {
              setCustom(false)
              onChange(e.target.value)
            }
          }}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value={CUSTOM}>Başka bir model (adını yaz)</option>
        </select>
      </label>
      {custom && (
        <label className="field">
          <span>Model adı</span>
          <input className="input" value={value} onChange={(e) => onChange(e.target.value.trim())} spellCheck={false} placeholder="ör. model-adi-1.0" />
        </label>
      )}
    </div>
  )
}

/** "Bugün 12/40 istek" with the role, for the free AI. */
function QuotaLine() {
  const store = useStore()
  const quota = useQuota(store.session?.user.id ?? null)
  if (!quota) return null
  const percent = quota.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 0
  return (
    <div className="quota" aria-label="Günlük ücretsiz yapay zekâ hakkı">
      <div className="quota-head">
        <span className={`chip role-chip is-${quota.role}`}>{ROLE_LABEL[quota.role]}</span>
        <strong>{quotaText(quota)}</strong>
      </div>
      {quota.limit !== null && (
        <div className="progress" role="progressbar" aria-valuenow={quota.used} aria-valuemin={0} aria-valuemax={quota.limit}>
          <div style={{ width: `${percent}%`, background: quota.allowed ? undefined : 'var(--danger)' }} />
        </div>
      )}
      <p className="subtle">Her başarılı yapay zekâ işlemi (not hazırlama, test, puanlama, açıklama) bir istek sayılır. Hak her gece yarısı (Türkiye saati) yenilenir.</p>
    </div>
  )
}

/** Shown only to the admin. */
function AdminLink() {
  const store = useStore()
  const quota = useQuota(store.session?.user.id ?? null)
  if (quota?.role !== 'admin') return null
  return (
    <Link to="/yonetim" className="btn btn-sm">
      Yönetim paneli
    </Link>
  )
}

interface PlusStatus {
  eligible: boolean
  used: number
  limit: number
  site_used: number
  site_limit: number
}

/** Free+ for Premium (a code), VIPs and admins: what it is, today's use, and what happens at the limit. */
function PlusPanel({ eligible }: { eligible: boolean }) {
  const [status, setStatus] = useState<PlusStatus | null>(null)
  useEffect(() => {
    let alive = true
    if (eligible && supabase) {
      void supabase.rpc('plus_quota').then(({ data }) => {
        if (alive && data && typeof data === 'object') setStatus(data as PlusStatus)
      })
    }
    return () => {
      alive = false
    }
  }, [eligible])

  if (!eligible) {
    return <Alert tone="info">Free+ Premium'a özel. Senin isteklerin ücretsiz yapay zekâyla hazırlanır; Premium kodun varsa aşağıdaki Premium bölümünden girebilirsin.</Alert>
  }
  return (
    <div className="plus-panel">
      <p>
        <strong>Free+</strong> <span className="muted">— Google'ın daha güçlü Gemini modeli, Premium'a özel. Hesabında otomatik açık; bir şey seçmene gerek yok.</span>
      </p>
      <ul className="plus-perks">
        <li>Notlarını Gemini 3.8 Flash ile hazırlar (ücretside hafif "Flash-Lite" model çalışır); yazılı cevap puanlamada ve hafıza tekniklerinde Google'ın en güçlü modeli Gemini 4 kullanılır.</li>
        <li>Google, Free+ ile gönderilen içerikleri kendi ürünlerini geliştirmek için kullanmaz.</li>
        <li>Günlük Free+ hakkın dolarsa ya da servis o an cevap vermezse, istek kendiliğinden normal ücretsiz yapay zekâyla hazırlanır; sen bir şey yapmazsın.</li>
      </ul>
      {status && (
        <div className="quota" aria-label="Günlük Free+ hakkı">
          <div className="quota-head">
            <span className="chip role-chip is-vip">Free+</span>
            <strong>
              Bugün {status.used}/{status.limit} istek
            </strong>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={status.used} aria-valuemin={0} aria-valuemax={status.limit}>
            <div style={{ width: `${Math.min(100, (status.used / Math.max(1, status.limit)) * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Where the student studies, from the profile; asked once after sign-up, changeable here. */
function EducationSection() {
  const education = useEducation()
  const [editing, setEditing] = useState(false)
  const toast = useToast()
  if (!education || editing || needsEducation(education)) {
    return (
      <div className="panel">
        {!education && <p className="muted" style={{ marginTop: 0 }}>Nerede okuduğunu ekle; profilinde görünür.</p>}
        <EducationForm
          initial={education}
          startAt={editing ? 'level' : undefined}
          onSaved={() => {
            setEditing(false)
            toast('Okul bilgin kaydedildi')
          }}
        />
        {editing && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
            Vazgeç
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="panel edu-current">
      <strong>{educationLabel(education)}</strong>
      <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
        Değiştir
      </button>
    </div>
  )
}
