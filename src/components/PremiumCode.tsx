import { CalendarClock, Copy, Download, Gem, KeyRound, ShoppingBag, Ticket, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { refreshQuota, useQuota } from '../lib/account'
import { SHOPIER_URL } from '../lib/config'
import { downloadText } from '../lib/noteTools'
import { usePremium } from '../lib/premium'
import {
  codesCsv,
  daysLeft,
  formatUntil,
  redeemCode,
  REDEEM_MESSAGES,
  tidyCode,
  type AdminCode,
  type AdminPremiumUser,
  type NewCode,
} from '../lib/premiumCodes'
import { playSound } from '../lib/sound'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Alert, Celebrate, Spinner, useToast } from './ui'

/** "Kodum var": type the Shopier code, get Premium. */
export function RedeemCode({ compact = false }: { compact?: boolean }) {
  const { session } = useStore()
  const toast = useToast()
  const userId = session?.user.id ?? null
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ days: number; until: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setError('')
    const result = await redeemCode(code)
    setBusy(false)
    if (!result.ok) {
      setError(REDEEM_MESSAGES[result.error])
      return
    }
    setDone({ days: result.days, until: result.premiumUntil })
    setCode('')
    playSound('done')
    // On the Premium page the locked view (and this field) goes away as Premium opens: say it there too.
    toast(`Premium açıldı! ${formatUntil(result.premiumUntil)} tarihine kadar seninle.`)
    // The allowance (and with it Premium) is read again so it opens right away.
    void refreshQuota(userId)
  }

  if (!session) {
    return (
      <p className="subtle">
        Kodunu kullanmak için <Link to="/giris">giriş yap</Link>.
      </p>
    )
  }

  return (
    <div className={`redeem${compact ? ' is-compact' : ''}`}>
      {done && (
        <div className="redeem-done" role="status">
          <Gem size={18} aria-hidden />
          <span>
            <Celebrate>Premium açıldı!</Celebrate> {done.days} gün eklendi; <strong>{formatUntil(done.until)}</strong> tarihine kadar seninle.
          </span>
        </div>
      )}
      <form className="redeem-form" onSubmit={submit}>
        <label className="field grow">
          <span>Kodum var</span>
          <input
            className="input redeem-input"
            value={code}
            onChange={(e) => {
              setCode(tidyCode(e.target.value))
              setError('')
            }}
            placeholder="SM-XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? 'redeem-error' : undefined}
          />
        </label>
        <button type="submit" className="btn prem-btn" disabled={busy || !code.trim()}>
          {busy ? <Spinner size={15} /> : <Ticket size={16} aria-hidden />} Kodu kullan
        </button>
      </form>
      {error && (
        <p id="redeem-error" className="redeem-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** Settings: Premium status, end date, the code field and where to buy. */
export function PremiumAccessSection() {
  const premium = usePremium()
  return (
    <div className="panel premium-access">
      {premium.until ? (
        <p className="premium-access-line">
          <Gem size={17} aria-hidden /> Premium açık · <strong>{formatUntil(premium.until)}</strong> tarihine kadar
          <span className="subtle"> ({Math.max(0, daysLeft(premium.until))} gün kaldı)</span>
        </p>
      ) : premium.state === 'open' && !premium.viaKey ? (
        <p className="premium-access-line">
          <Gem size={17} aria-hidden /> Premium hesabında zaten açık.
        </p>
      ) : (
        <p className="subtle">Premium; iki sesli sesli not, akıllı arama ve yapay zekâ görselleri. Shopier’den aldığın kodu buraya gir; süre bitince kendiliğinden kapanır, otomatik yenilenmez.</p>
      )}
      <RedeemCode />
      <div className="btn-row">
        {SHOPIER_URL && (
          <a className="btn btn-sm" href={SHOPIER_URL} target="_blank" rel="noopener noreferrer">
            <ShoppingBag size={15} aria-hidden /> {premium.until ? 'Süreyi uzat' : 'Kod satın al'}
          </a>
        )}
        <Link to="/premium" className="btn btn-ghost btn-sm">
          Premium’da neler var?
        </Link>
      </div>
    </div>
  )
}

const REMIND_KEY = 'studymode.premiumReminder'

/** Bugün: three days or less left on paid Premium. Closable; comes back for a new end date. */
export function PremiumReminder() {
  const premium = usePremium()
  const until = premium.until
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(REMIND_KEY)
    } catch {
      return null
    }
  })
  if (!until || hidden === until) return null
  const left = daysLeft(until)
  if (left > 3 || left < 0) return null
  return (
    <div className="panel premium-reminder" role="status">
      <CalendarClock size={18} aria-hidden />
      <span className="grow">
        Premium’ın {left <= 0 ? 'bugün' : `${left} gün sonra`} bitiyor ({formatUntil(until)}).
      </span>
      {SHOPIER_URL && (
        <a className="btn btn-sm prem-btn" href={SHOPIER_URL} target="_blank" rel="noopener noreferrer">
          Yenile
        </a>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm"
        aria-label="Hatırlatmayı kapat"
        onClick={() => {
          setHidden(until)
          try {
            localStorage.setItem(REMIND_KEY, until)
          } catch {
            // Shows again next visit; harmless.
          }
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

// ---------- Yönetim: Premium kodları ----------

const DAY_CHOICES = [30, 120] as const

/**
 * Admin: make codes (shown once), list them, revoke unused ones, see who has Premium. Hidden when
 * the database functions are not there yet, like the other optional admin sections.
 */
export function PremiumCodesAdmin() {
  const { session } = useStore()
  const isAdmin = useQuota(session?.user.id ?? null)?.role === 'admin'
  const toast = useToast()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [codes, setCodes] = useState<AdminCode[]>([])
  const [users, setUsers] = useState<AdminPremiumUser[]>([])
  const [howMany, setHowMany] = useState(10)
  const [days, setDays] = useState<number>(30)
  const [custom, setCustom] = useState(false)
  const [label, setLabel] = useState('')
  const [made, setMade] = useState<{ codes: NewCode[]; days: number; label: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    const [c, p] = await Promise.all([supabase.rpc('admin_codes'), supabase.rpc('admin_premium')])
    if (c.error) {
      setAvailable(false)
      return
    }
    setAvailable(true)
    setCodes((c.data ?? []) as AdminCode[])
    setUsers(p.error ? [] : ((p.data ?? []) as AdminPremiumUser[]))
  }, [])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  if (!isAdmin || !available) return null

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const n = Math.max(1, Math.min(200, Math.round(howMany)))
    const d = Math.max(1, Math.min(400, Math.round(days)))
    const { data, error: err } = await supabase.rpc('admin_create_codes', { how_many: n, days: d, label: label.trim() || null })
    setBusy(false)
    if (err) {
      setError('Kodlar üretilemedi.')
      return
    }
    setMade({ codes: (data ?? []) as NewCode[], days: d, label: label.trim() })
    void load()
  }

  async function revoke(code: AdminCode) {
    if (!supabase) return
    const { error: err } = await supabase.rpc('admin_revoke_code', { code_id: code.id })
    if (err) {
      toast(err.message.includes('already') ? 'Bu kod kullanılmış ya da zaten iptal.' : 'İptal edilemedi.')
      return
    }
    toast(`${code.hint} iptal edildi`)
    void load()
  }

  async function copyAll() {
    if (!made) return
    try {
      await navigator.clipboard.writeText(made.codes.map((c) => c.code).join('\n'))
      toast(`${made.codes.length} kod kopyalandı`)
    } catch {
      toast('Kopyalanamadı; listeden elle seçebilirsin')
    }
  }

  const used = codes.filter((c) => c.redeemed_at).length
  const open = codes.filter((c) => !c.redeemed_at && !c.revoked_at).length

  return (
    <section className="section" aria-label="Premium kodları">
      <h2>
        <KeyRound size={18} aria-hidden /> Premium kodları{' '}
        <span className="subtle">
          ({open} bekleyen · {used} kullanılmış · {users.length} Premium kullanıcı)
        </span>
      </h2>

      <form className="panel codes-maker" onSubmit={create}>
        <div className="form-row">
          <label className="field">
            <span>Kaç kod?</span>
            <input className="input" type="number" min={1} max={200} value={howMany} onChange={(e) => setHowMany(Number(e.target.value))} />
          </label>
          <div className="field">
            <span>Süre</span>
            <div className="segmented" role="group" aria-label="Kod süresi">
              {DAY_CHOICES.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={!custom && days === d}
                  onClick={() => {
                    setCustom(false)
                    setDays(d)
                  }}
                >
                  {d} gün
                </button>
              ))}
              <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>
                Özel
              </button>
            </div>
            {custom && <input className="input" type="number" min={1} max={400} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Gün sayısı" />}
          </div>
        </div>
        <label className="field">
          <span>Etiket (isteğe bağlı)</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Örn. Shopier Kasım, çekiliş" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
          {busy ? <Spinner size={15} /> : <Ticket size={16} aria-hidden />} Kod üret
        </button>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>

      {made && (
        <div className="panel codes-made" aria-label="Üretilen kodlar">
          <Alert tone="warning">Bu kodlar yalnızca şimdi görünür; bir daha gösterilemez. Hemen kopyala ya da indir ve bir yere kaydet.</Alert>
          <ol className="codes-list">
            {made.codes.map((c) => (
              <li key={c.code}>
                <code>{c.code}</code>
              </li>
            ))}
          </ol>
          <div className="btn-row">
            <button type="button" className="btn btn-sm" onClick={copyAll}>
              <Copy size={15} /> Hepsini kopyala
            </button>
            <button type="button" className="btn btn-sm" onClick={() => downloadText(`premium-kodlari-${made.days}-gun.csv`, codesCsv(made.codes, made.days, made.label), 'text/csv;charset=utf-8')}>
              <Download size={15} /> CSV indir
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMade(null)}>
              Kaydettim, kapat
            </button>
          </div>
        </div>
      )}

      {codes.length > 0 && (
        <div className="panel panel-tight list" aria-label="Kod listesi">
          {codes.map((c) => (
            <div key={c.id} className="list-item">
              <div className="grow">
                <div className="title">
                  <code>{c.hint}</code> · {c.days} gün{c.label ? ` · ${c.label}` : ''}
                </div>
                <div className="subtle">
                  {c.revoked_at
                    ? `İptal edildi · ${formatUntil(c.revoked_at)}`
                    : c.redeemed_at
                      ? `Kullanıldı · ${c.redeemed_email ?? 'bilinmiyor'} · ${formatUntil(c.redeemed_at)}`
                      : `Bekliyor · üretildi ${formatUntil(c.created_at)}`}
                </div>
              </div>
              {!c.redeemed_at && !c.revoked_at && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void revoke(c)} aria-label={`${c.hint} kodunu iptal et`}>
                  İptal et
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {users.length > 0 && (
        <div className="panel panel-tight list" aria-label="Premium kullanıcılar">
          {users.map((u) => (
            <div key={u.id} className="list-item">
              <Gem size={16} aria-hidden />
              <div className="grow">
                <div className="title">{u.email}</div>
                <div className="subtle">
                  {formatUntil(u.until)} tarihine kadar · {Math.max(0, daysLeft(u.until))} gün kaldı
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
