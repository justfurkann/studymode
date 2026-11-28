import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuota } from '../lib/account'
import { MANAGE_HINT, useAppStoreSubscription } from '../lib/appStore'
import { emailLabel } from '../lib/auth'
import { deleteAccount, deleteMessage, deleteWordOk, DELETE_WORD } from '../lib/deleteAccount'
import { formatUntil, hasPremiumUntil } from '../lib/premiumCodes'
import { useStore } from '../lib/store'
import { Alert, Modal, Spinner, useToast } from './ui'

/** Settings → "Hesabı sil": a separate, plainly worded way to delete the account and everything in it. */
export function DeleteAccountSection() {
  const store = useStore()
  const [open, setOpen] = useState(false)
  if (!store.session) return null
  return (
    <div className="panel form danger-zone">
      <p className="muted">
        Hesabını ve hesabındaki her şeyi (dersler, notlar, kartlar, sınav sonuçları, seri, paylaşım bağlantıları) kalıcı olarak siler. Telefon uygulamasındaki
        hesabın da aynı hesaptır, o da silinir.
      </p>
      <div>
        <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
          <Trash2 size={17} /> Hesabımı sil
        </button>
      </div>
      {open && <DeleteAccountDialog onClose={() => setOpen(false)} />}
    </div>
  )
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const quota = useQuota(store.session?.user.id ?? null)
  const appStore = useAppStoreSubscription()
  const [typed, setTyped] = useState('')
  const [premiumOk, setPremiumOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [serverUntil, setServerUntil] = useState<string | null>(null)
  const premiumUntil = serverUntil ?? (hasPremiumUntil(quota?.premiumUntil) ? quota!.premiumUntil! : null)
  const ready = deleteWordOk(typed) && (!premiumUntil || premiumOk) && !busy

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    setBusy(true)
    setError('')
    const result = await deleteAccount({ premiumOk: !!premiumUntil && premiumOk })
    if (result.ok) {
      toast('Hesabın ve bütün verilerin silindi')
      navigate('/', { replace: true })
      return
    }
    setBusy(false)
    if (result.error === 'premium_active' && result.premiumUntil) {
      setServerUntil(result.premiumUntil)
      setPremiumOk(false)
    }
    setError(deleteMessage(result.error))
  }

  return (
    <Modal title="Hesabı sil" onClose={onClose} closable={!busy}>
      <form className="form" onSubmit={submit}>
        <p>
          <strong>{emailLabel(store.session?.user.email)}</strong> hesabı ve içindeki her şey kalıcı olarak silinecek. <strong>Bu geri alınamaz.</strong>
        </p>
        <ul className="muted" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Dersler, notlar, özetler, kartlar, test ve sınav sonuçları</li>
          <li>Seri ve çalışma günleri, okul bilgisi, öğrenci tipi, başarımlar</li>
          <li>Paylaştığın ders bağlantıları (artık açılmaz) ve gönderdiğin geri bildirimler</li>
          <li>Rolün, yapay zekâ hakların ve Premium süren</li>
        </ul>
        <p className="subtle">İstersen önce Ayarlar’daki “Verilerin” bölümünden yedek indir.</p>
        {premiumUntil && (
          <Alert tone="warning">
            Premium süren {formatUntil(premiumUntil)} tarihine kadar devam ediyor. Hesabı silersen kalan süre kaybolur, iade edilmez ve başka hesaba taşınamaz.
            <label className="check-row" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={premiumOk} onChange={(e) => setPremiumOk(e.target.checked)} />
              <span>Kalan Premium süremin silineceğini anladım</span>
            </label>
          </Alert>
        )}
        {appStore.state !== 'none' && (
          <Alert tone="warning">
            {appStore.state === 'active' ? 'App Store’dan aldığın Premium aboneliği' : 'iPhone’dan App Store ile abone olduysan, aboneliğin'} hesap silinince durmaz; Apple
            ücret almaya devam eder. Silmeden önce {MANAGE_HINT}’den iptal et.
          </Alert>
        )}
        <label className="field">
          <span>
            Onaylamak için <strong>{DELETE_WORD}</strong> yaz
          </span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} />
        </label>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="btn-row">
          <button type="submit" className="btn btn-danger-solid" disabled={!ready}>
            {busy ? <Spinner size={15} /> : <Trash2 size={17} />} Hesabımı kalıcı olarak sil
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
        </div>
      </form>
    </Modal>
  )
}
