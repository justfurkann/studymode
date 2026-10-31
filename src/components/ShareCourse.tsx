import qrcode from 'qrcode-generator'
import { Copy, Link2, RefreshCw, Share2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { displayName } from '../lib/auth'
import { buildSnapshot, createShare, deleteShare, listShares, shareUrl, snapshotCounts, updateShare, ShareError, type ShareRow } from '../lib/share'
import { useStore } from '../lib/store'
import { Alert, Modal, Spinner, useToast } from './ui'

/** A QR code drawn as SVG: ink on the highlighter yellow, which scans well in both themes. */
export function QrCode({ text, size = 200 }: { text: string; size?: number }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`
    return { d, n: n + 8 }
  }, [text])
  return (
    <svg className="qr" width={size} height={size} viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label="Paylaşım bağlantısının QR kodu" shapeRendering="crispEdges">
      <rect width={path.n} height={path.n} className="qr-bg" />
      <path d={path.d} className="qr-ink" />
    </svg>
  )
}

/** The name a friend sees on the link: never the email address. */
function ownerName(user: Parameters<typeof displayName>[0]): string | null {
  const name = displayName(user)
  return name && name !== user?.email ? name : null
}

const errorText = (e: unknown) => (e instanceof ShareError ? e.message : 'Bir sorun oluştu. Yeniden dene.')

/** "Dersi paylaş": one link (and QR code) per course; the friend copies the course into their account. */
export function ShareCourse({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const store = useStore()
  const toast = useToast()
  const signedIn = !!store.session
  const [share, setShare] = useState<ShareRow | null>(null)
  const [loading, setLoading] = useState(signedIn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const snapshot = useMemo(() => buildSnapshot(store.data, courseId), [store.data, courseId])
  const counts = snapshot ? snapshotCounts(snapshot) : null

  useEffect(() => {
    if (!signedIn) return
    let alive = true
    listShares(courseId)
      .then((rows) => alive && setShare(rows[0] ?? null))
      .catch((e) => alive && setError(errorText(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [courseId, signedIn])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const url = share ? shareUrl(share.token) : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast('Bağlantı kopyalandı')
    } catch {
      setError('Kopyalanamadı; bağlantıyı elle seçip kopyala.')
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: snapshot?.course.name, text: `${snapshot?.course.name} dersimi StudyMode'da seninle paylaştım:`, url })
    } catch {
      // The student closed the share sheet; nothing to do.
    }
  }

  return (
    <Modal title="Dersi paylaş" onClose={onClose}>
      <div className="share">
        <p className="muted">
          Arkadaşın bu dersin notlarını, özetlerini, kartlarını, sorularını ve yaklaşan sınav tarihlerini kendi hesabına kopyalar. Senin ilerlemen, yazılı cevapların ve puanların paylaşılmaz.
        </p>
        {counts && (
          <p className="subtle">
            Paylaşılacak: {counts.notes} not · {counts.cards} kart · {counts.questions} soru{counts.exams ? ` · ${counts.exams} sınav tarihi` : ''}
          </p>
        )}

        {!signedIn ? (
          <Alert tone="info" action={<Link to="/giris" className="btn btn-sm">Giriş yap</Link>}>
            Paylaşım bağlantısı oluşturmak için giriş yapman gerekiyor. Notların hesabına taşınır, sonra paylaşabilirsin.
          </Alert>
        ) : loading ? (
          <div className="share-loading">
            <Spinner /> Paylaşım bilgisi yükleniyor…
          </div>
        ) : share ? (
          <>
            <div className="share-link">
              <input className="input" readOnly value={url} aria-label="Paylaşım bağlantısı" onFocus={(e) => e.currentTarget.select()} />
              <button className="btn" onClick={copy}>
                <Copy size={16} /> Kopyala
              </button>
            </div>
            {'share' in navigator && (
              <div>
                <button className="btn btn-primary" onClick={nativeShare}>
                  <Share2 size={16} /> WhatsApp, Instagram… ile paylaş
                </button>
              </div>
            )}
            <div className="share-qr">
              <QrCode text={url} />
              <span className="subtle">Yanındaysa telefon kamerasıyla okutsun.</span>
            </div>
            <p className="subtle">
              Son güncelleme: {new Date(share.updatedAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. Derse sonradan eklediklerin, bağlantıyı güncelleyene kadar paylaşılmaz.
            </p>
            <div className="btn-row">
              <button className="btn btn-sm" disabled={busy || !snapshot} onClick={() => run(async () => { setShare(await updateShare(share.id, snapshot!)); toast('Bağlantı güncellendi') })}>
                <RefreshCw size={15} /> Dersin şimdiki hâliyle güncelle
              </button>
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => run(async () => { await deleteShare(share.id); setShare(null); toast('Paylaşım kapatıldı; bağlantı artık çalışmaz') })}>
                <Trash2 size={15} /> Paylaşımı kapat
              </button>
            </div>
          </>
        ) : (
          <>
            <Alert tone="warning">Bağlantıya sahip olan herkes bu dersi görebilir. Hocanın materyallerini yalnızca güvendiğin kişilerle paylaş; istediğin an kapatabilirsin.</Alert>
            <div>
              <button className="btn btn-primary" disabled={busy || !snapshot || !counts?.notes} onClick={() => run(async () => setShare(await createShare(courseId, snapshot!, ownerName(store.session?.user))))}>
                {busy ? <Spinner size={16} /> : <Link2 size={16} />} Bağlantı oluştur
              </button>
            </div>
            {!counts?.notes && <p className="subtle">Paylaşmak için derste en az bir not olmalı.</p>}
          </>
        )}
        {error && (
          <p role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
