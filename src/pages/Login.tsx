import { ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Alert, Spinner } from '../components/ui'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'

export function Login() {
  const store = useStore()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (!supabase) return <Navigate to="/ayarlar" replace />
  if (store.session) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'in') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
      } else {
        const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setInfo('Hesabın oluşturuldu. E-postana gelen bağlantıya tıklayıp hesabını onayla, sonra giriş yap.')
        else navigate('/')
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      setError(
        /invalid login credentials/i.test(message)
          ? 'E-posta veya şifre hatalı.'
          : /email not confirmed/i.test(message)
            ? 'E-postanı henüz onaylamadın. Gelen kutunu kontrol et.'
            : /already registered/i.test(message)
              ? 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.'
              : message || 'Bir şeyler ters gitti.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <Link to="/ayarlar" className="back-link">
        <ArrowLeft size={16} /> Ayarlar
      </Link>
      <div className="panel form">
        <h1>{mode === 'in' ? 'Giriş yap' : 'Hesap oluştur'}</h1>
        <p className="muted">Hesapla notların, kartların ve ilerlemen tüm cihazlarında senkronize olur.</p>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>E-posta</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Şifre</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <Alert tone="danger">{error}</Alert>}
          {info && <Alert tone="info">{info}</Alert>}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy && <Spinner />} {mode === 'in' ? 'Giriş yap' : 'Hesap oluştur'}
          </button>
        </form>
        <p className="subtle" style={{ textAlign: 'center' }}>
          {mode === 'in' ? 'Hesabın yok mu?' : 'Zaten hesabın var mı?'}{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => (setMode(mode === 'in' ? 'up' : 'in'), setError(''), setInfo(''))}>
            {mode === 'in' ? 'Hesap oluştur' : 'Giriş yap'}
          </button>
        </p>
      </div>
    </div>
  )
}
