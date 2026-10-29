import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Spinner, useToast } from '../components/ui'
import { authErrorMessage, MIN_PASSWORD, passwordProblem } from '../lib/auth'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'

/** Reached from the password reset email; the link signs the user in for this one step. */
export function ResetPassword() {
  const store = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!supabase || !store.session) {
    return (
      <div className="page" style={{ maxWidth: 440 }}>
        <div className="panel form">
          <h1>Yeni şifre belirle</h1>
          <Alert tone="warning">Bu bağlantı geçersiz ya da süresi dolmuş. Yeni bir şifre yenileme bağlantısı iste.</Alert>
          <Link to="/giris?mod=unuttum" className="btn btn-primary">
            Yeni bağlantı iste
          </Link>
        </div>
      </div>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = passwordProblem(password, repeat)
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase!.auth.updateUser({ password })
      if (error) throw error
      toast('Şifren güncellendi')
      navigate('/', { replace: true })
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <div className="panel form">
        <h1>Yeni şifre belirle</h1>
        <p className="muted">{store.session.user.email} hesabı için yeni şifreni yaz.</p>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Yeni şifre</span>
            <input className="input" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={password} onChange={(e) => (setPassword(e.target.value), setError(''))} aria-describedby="new-password-hint" required />
          </label>
          <span id="new-password-hint" className="subtle" style={{ marginTop: -10 }}>
            En az {MIN_PASSWORD} karakter
          </span>
          <label className="field">
            <span>Yeni şifre (tekrar)</span>
            <input className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => (setRepeat(e.target.value), setError(''))} required />
          </label>
          {error && <Alert tone="danger">{error}</Alert>}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? <Spinner /> : <KeyRound size={18} />} Şifremi güncelle
          </button>
        </form>
      </div>
    </div>
  )
}
