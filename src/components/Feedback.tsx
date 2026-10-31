import { Lightbulb, MessageSquareHeart } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { FeedbackError, sendFeedback, type FeedbackKind } from '../lib/feedback'
import { useStore } from '../lib/store'
import { Celebrate, Modal, Spinner } from './ui'

const KINDS: Array<{ id: FeedbackKind; label: string; placeholder: string }> = [
  { id: 'fikir', label: 'Fikir', placeholder: 'Şu olsa çok iyi olurdu…' },
  { id: 'hata', label: 'Hata', placeholder: 'Ne yapıyordun, ne oldu? Hangi ekrandaydın?' },
  { id: 'diger', label: 'Diğer', placeholder: 'Aklında ne varsa…' },
]

/** "Fikrin mi var, hata mı buldun?" — goes straight to the maker. */
export function FeedbackDialog({ onClose, initialKind = 'fikir' }: { onClose: () => void; initialKind?: FeedbackKind }) {
  const { session } = useStore()
  const [kind, setKind] = useState<FeedbackKind>(initialKind)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const current = KINDS.find((k) => k.id === kind)!

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setState('sending')
    try {
      await sendFeedback({ kind, message, contact })
      setState('sent')
    } catch (e) {
      setError(e instanceof FeedbackError ? e.message : 'Gönderilemedi. Yeniden dene.')
      setState('idle')
    }
  }

  return (
    <Modal title="Fikrin mi var, hata mı buldun?" onClose={onClose}>
      {state === 'sent' ? (
        <div className="feedback-done" role="status">
          <p>
            <Celebrate>Teşekkürler!</Celebrate> Mesajın doğrudan Furkan'a ulaştı; hepsini tek tek okuyor.
          </p>
          <button className="btn btn-primary" onClick={onClose}>
            Kapat
          </button>
        </div>
      ) : (
        <form className="form feedback-form" onSubmit={submit}>
          <div className="segmented" role="group" aria-label="Mesaj türü">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Mesajın</span>
            <textarea className="input" rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={current.placeholder} required />
          </label>
          {!session && (
            <label className="field">
              <span>Sana nasıl dönelim? (isteğe bağlı)</span>
              <input className="input" maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Instagram kullanıcı adın ya da e-postan" />
            </label>
          )}
          <p className="subtle">{session ? 'Hesabınla birlikte gönderilir; gerekirse sana dönebiliriz.' : 'Hangi sayfada olduğun ve cihaz türün de eklenir; notlarının içeriği gönderilmez.'}</p>
          {error && (
            <p role="alert" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn-primary" disabled={state === 'sending' || message.trim().length < 3}>
              {state === 'sending' ? <Spinner size={16} /> : <MessageSquareHeart size={16} />} Gönder
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/** A small link that opens the dialog. */
export function FeedbackLink({ className = '', label = 'Fikir · Hata bildir' }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={`feedback-link ${className}`} onClick={() => setOpen(true)}>
        <Lightbulb size={14} aria-hidden /> {label}
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  )
}
