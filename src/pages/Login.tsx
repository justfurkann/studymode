import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandIcon } from '../components/BrandIcon'
import { Alert, Spinner } from '../components/ui'
import { authErrorMessage, isGoogleEnabled, MIN_PASSWORD, nameMetadata, passwordProblem } from '../lib/auth'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../lib/config'
import { renderGoogleButton } from '../lib/googleSignIn'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'

type Mode = 'in' | 'up' | 'forgot'

const TITLES: Record<Mode, string> = { in: 'Giriş yap', up: 'Hesap oluştur', forgot: 'Şifremi unuttum' }

export function Login() {
  const store = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mod') === 'unuttum' ? 'forgot' : params.get('mod') === 'kayit' ? 'up' : 'in')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (!supabase) return <Navigate to="/ayarlar" replace />
  if (store.session) return <Navigate to="/" replace />

  function switchTo(next: Mode) {
    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
    setRepeat('')
  }

  // Only flag a mismatch once the second field has been filled in far enough to compare.
  const mismatch = mode === 'up' && repeat.length > 0 && repeat !== password.slice(0, repeat.length) ? 'Şifreler aynı değil.' : ''

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setInfo('')

    if (mode === 'up') {
      if (!firstName.trim() || !lastName.trim()) return setError('Adını ve soyadını yaz.')
      const problem = passwordProblem(password, repeat)
      if (problem) return setError(problem)
    }

    setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        navigate('/')
      } else if (mode === 'up') {
        const { data, error } = await supabase!.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin, data: nameMetadata(firstName, lastName) },
        })
        if (error) throw error
        if (data.session) navigate('/')
        else {
          setInfo(`Hesabın oluşturuldu. ${email.trim()} adresine gelen bağlantıya tıklayıp hesabını onayla, sonra giriş yap. E-posta birkaç dakika içinde gelmezse gereksiz klasörüne bak.`)
          setPassword('')
          setRepeat('')
        }
      } else {
        const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
        if (error) throw error
        // Same message whether or not the address has an account, so the form cannot be used to look up emails.
        setInfo('Bu e-postayla bir hesap varsa şifre yenileme bağlantısı gönderdik. Gelen kutunu (ve gereksiz klasörünü) kontrol et.')
      }
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> Ana sayfa
      </Link>
      <div className="panel form auth-card">
        <h1>{TITLES[mode]}</h1>
        <p className="muted">
          {mode === 'forgot'
            ? 'E-posta adresini yaz, sana yeni şifre belirleyebileceğin bir bağlantı gönderelim.'
            : 'Hesapla notların, kartların ve ilerlemen tüm cihazlarında senkronize olur.'}
        </p>
        {mode !== 'forgot' && <GoogleButton />}
        <form className="form" onSubmit={submit}>
          {mode === 'up' && (
            <div className="form-row">
              <label className="field">
                <span>Ad</span>
                <input className="input" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={50} required />
              </label>
              <label className="field">
                <span>Soyad</span>
                <input className="input" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={50} required />
              </label>
            </div>
          )}
          <label className="field">
            <span>E-posta</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {mode !== 'forgot' && (
            <label className="field">
              <span>Şifre</span>
              <input
                className="input"
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                minLength={mode === 'up' ? MIN_PASSWORD : undefined}
                value={password}
                onChange={(e) => (setPassword(e.target.value), setError(''))}
                aria-describedby={mode === 'up' ? 'password-hint' : undefined}
                required
              />
            </label>
          )}
          {mode === 'up' && (
            <span id="password-hint" className="subtle" style={{ marginTop: -10 }}>
              En az {MIN_PASSWORD} karakter
            </span>
          )}
          {mode === 'up' && (
            <label className="field">
              <span>Şifre (tekrar)</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => (setRepeat(e.target.value), setError(''))}
                aria-invalid={!!mismatch}
                aria-describedby={mismatch ? 'password-mismatch' : undefined}
                required
              />
            </label>
          )}
          {mismatch && (
            <span id="password-mismatch" style={{ color: 'var(--danger)', fontSize: '0.875rem', marginTop: -10 }} role="alert">
              {mismatch}
            </span>
          )}
          {mode === 'in' && (
            <div style={{ marginTop: -8 }}>
              <button type="button" className="btn btn-ghost btn-sm" style={{ paddingInline: 0 }} onClick={() => switchTo('forgot')}>
                Şifremi unuttum
              </button>
            </div>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          {info && <Alert tone="info">{info}</Alert>}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy && <Spinner />} {mode === 'forgot' ? 'Yenileme bağlantısı gönder' : TITLES[mode]}
          </button>
        </form>
        {mode !== 'forgot' && (
          <p className="subtle legal-note">
            Devam ederek <Link to="/gizlilik">gizlilik politikasını</Link> okumuş olursun.
          </p>
        )}
        <p className="subtle" style={{ textAlign: 'center' }}>
          {mode === 'up' ? 'Zaten hesabın var mı?' : mode === 'forgot' ? 'Şifreni hatırladın mı?' : 'Hesabın yok mu?'}{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => switchTo(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'Hesap oluştur' : 'Giriş yap'}
          </button>
        </p>
      </div>
    </div>
  )
}

/**
 * "Google ile devam et". Google's own button, drawn on studymode.fun, so the account chooser names
 * studymode.fun. If Google's script is blocked, falls back to the redirect flow (which names the
 * Supabase address but still works). Hidden until Google is switched on in Supabase.
 */
function GoogleButton() {
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(false)
  const [mode, setMode] = useState<'gsi' | 'redirect'>('gsi')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const slot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    if (supabase) void isGoogleEnabled(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY).then((on) => alive && setEnabled(on))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || mode !== 'gsi' || !slot.current) return
    const el = slot.current
    const dark = getComputedStyle(document.documentElement).colorScheme === 'dark'
    renderGoogleButton(el, {
      dark,
      width: el.clientWidth || 360,
      onDone: (message) => {
        if (message) setError(message)
        else navigate('/', { replace: true })
      },
    }).catch(() => setMode('redirect'))
  }, [enabled, mode, navigate])

  if (!enabled) return null
  return (
    <div className="google-auth">
      {mode === 'gsi' ? (
        <div ref={slot} className="google-slot" aria-label="Google ile devam et" />
      ) : (
        <button
          type="button"
          className="btn btn-lg google-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError('')
            const { error: e } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
            if (e) {
              setError('Google ile giriş başlatılamadı. Biraz sonra yeniden dene ya da e-postanla devam et.')
              setBusy(false)
            }
          }}
        >
          {busy ? <Spinner size={16} /> : <BrandIcon brand="google" size={18} />} Google ile devam et
        </button>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="auth-divider" role="separator">
        <span>ya da e-postayla</span>
      </div>
    </div>
  )
}
