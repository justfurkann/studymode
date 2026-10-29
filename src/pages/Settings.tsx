import { Cloud, Download, Eye, EyeOff, KeyRound, LogOut, Monitor, Moon, Sun, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Spinner, useToast } from '../components/ui'
import { hasLocalData, parseData } from '../lib/backend'
import { AI_MODELS, updateSettings, useSettings, type AiModel, type Theme } from '../lib/settings'
import { migrateLocalToCloud, useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { emptyData } from '../lib/types'

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

function AiSection() {
  const settings = useSettings()
  const [key, setKey] = useState(settings.apiKey)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>({ kind: 'idle' })

  async function save() {
    const trimmed = key.trim()
    if (!trimmed) {
      updateSettings({ apiKey: '' })
      setState({ kind: 'idle' })
      return
    }
    setState({ kind: 'testing' })
    try {
      await (await import('../lib/ai')).testApiKey(trimmed, settings.model)
      updateSettings({ apiKey: trimmed })
      setState({ kind: 'ok', message: 'Anahtar çalışıyor ve kaydedildi.' })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Anahtar doğrulanamadı.' })
    }
  }

  return (
    <div className="form">
      <p className="muted">
        Yapay zekâ modu isteğe bağlıdır. Kendi Anthropic API anahtarını eklersen notların Claude ile işlenir; ücreti doğrudan senin Anthropic hesabından düşer
        (orta uzunlukta bir not genellikle birkaç sent tutar). Anahtar eklemezsen uygulama ücretsiz basit modla çalışır.
      </p>
      <label className="field">
        <span>Anthropic API anahtarı</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            type={visible ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn btn-icon" style={{ minHeight: 42, width: 42 }} aria-label={visible ? 'Anahtarı gizle' : 'Anahtarı göster'} onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
      <label className="field">
        <span>Model</span>
        <select className="select" value={settings.model} onChange={(e) => updateSettings({ model: e.target.value as AiModel })}>
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.hint}
            </option>
          ))}
        </select>
      </label>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={save} disabled={state.kind === 'testing' || key.trim() === settings.apiKey}>
          {state.kind === 'testing' ? <Spinner size={16} /> : <KeyRound size={17} />} {!key.trim() && settings.apiKey ? 'Anahtarı kaldır' : 'Doğrula ve kaydet'}
        </button>
        {settings.apiKey && <span className="chip chip-success">Yapay zekâ açık</span>}
      </div>
      {state.kind === 'ok' && <Alert tone="info">{state.message}</Alert>}
      {state.kind === 'error' && <Alert tone="danger">{state.message}</Alert>}
      <p className="subtle">
        Anahtarı <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>console.anthropic.com</a> adresinden
        alabilirsin. Anahtar yalnızca bu tarayıcıda saklanır, hesabına senkronize edilmez; notun işlenirken doğrudan Anthropic’e gönderilir. Ortak kullanılan bir bilgisayarda anahtar kaydetme.
      </p>
    </div>
  )
}

function DataSection() {
  const store = useStore()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'studymode', version: 2, ...store.data }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `studymode-yedek-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    setError('')
    try {
      const data = parseData(JSON.parse(await file.text()))
      if (!window.confirm(`Yedekte ${data.courses.length} ders ve ${data.notes.length} not var. Mevcut verilerin bunlarla değiştirilsin mi?`)) return
      await store.replaceAll(data)
      toast('Yedek geri yüklendi')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yedek okunamadı.')
    }
  }

  async function wipe() {
    if (!window.confirm('Tüm dersler, notlar ve kartlar silinsin mi? Bu geri alınamaz.')) return
    try {
      await store.replaceAll(emptyData())
      toast('Tüm veriler silindi')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi.')
    }
  }

  return (
    <div className="form">
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

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <h1>Ayarlar</h1>
        </div>
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
        <h2>Görünüm</h2>
        <div className="panel">
          <div className="segmented" role="group" aria-label="Tema">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button key={id} aria-pressed={settings.theme === id} onClick={() => updateSettings({ theme: id })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Verilerin</h2>
        <div className="panel">
          <DataSection />
        </div>
      </section>
    </div>
  )
}
