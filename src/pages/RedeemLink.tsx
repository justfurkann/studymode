import { Gem, LogIn, Ticket, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BuyPremium } from '../components/BuyPremium'
import { Celebrate, Spinner } from '../components/ui'
import { refreshQuota } from '../lib/account'
import { clearPendingCode, codeFromHash, formatUntil, loadPendingCode, maskCode, REDEEM_MESSAGES, redeemCode, savePendingCode, type RedeemError } from '../lib/premiumCodes'
import { useStore } from '../lib/store'

/*
 * /kod#SM-XXXX-XXXX-XXXX: a Premium code as a link (or a QR code of it). Signed in, the code is
 * used at once and Premium opens. Signed out, the code waits on this device (lib/premiumCodes
 * savePendingCode) while the student signs in or makes an account; PendingCodeReturn brings them
 * back here afterwards.
 */

type State = { kind: 'none' } | { kind: 'waiting'; code: string } | { kind: 'busy'; code: string } | { kind: 'done'; days: number; until: string } | { kind: 'failed'; code: string; error: RedeemError }

export function RedeemLink() {
  const { session } = useStore()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const fromLink = codeFromHash(hash)
  const [code] = useState(() => fromLink ?? loadPendingCode())
  const [state, setState] = useState<State>(() => (code ? { kind: 'waiting', code } : { kind: 'none' }))
  const tried = useRef('')
  const userId = session?.user.id ?? null

  // The code leaves the address bar (and the history) as soon as it is read.
  useEffect(() => {
    if (fromLink) {
      savePendingCode(fromLink)
      navigate('/kod', { replace: true })
    }
  }, [fromLink, navigate])

  useEffect(() => {
    if (!code || !userId || tried.current === `${userId}:${code}`) return
    tried.current = `${userId}:${code}`
    setState({ kind: 'busy', code })
    void redeemCode(code).then((result) => {
      if (result.ok) {
        clearPendingCode()
        setState({ kind: 'done', days: result.days, until: result.premiumUntil })
        void refreshQuota(userId)
        return
      }
      // A code that will never work is forgotten; a connection problem keeps it for another try.
      if (result.error !== 'network' && result.error !== 'not_signed_in' && result.error !== 'too_many') clearPendingCode()
      setState({ kind: 'failed', code, error: result.error })
    })
  }, [code, userId])

  return (
    <div className="page page-narrow redeem-link">
      <div className="panel redeem-link-card">
        {state.kind === 'none' && (
          <>
            <span className="redeem-link-icon" aria-hidden>
              <Ticket size={26} />
            </span>
            <h1>Bu bağlantıda kod yok</h1>
            <p className="subtle">Bağlantı eksik kopyalanmış olabilir. Kodu elle de girebilirsin.</p>
            <Link to="/premium" className="btn btn-primary">
              Premium sayfasına git
            </Link>
          </>
        )}

        {(state.kind === 'waiting' || state.kind === 'busy') && !session && (
          <>
            <span className="redeem-link-icon is-gem" aria-hidden>
              <Gem size={26} />
            </span>
            <h1>
              Sana bir <span className="hl">Premium</span> kodu geldi
            </h1>
            <p className="subtle">
              Premium’u almak için hesap aç ya da giriş yap. Sonra buraya kendiliğinden döneceksin ve Premium hesabında açılacak. Kodun bu cihazda bekliyor (
              <code>{maskCode(state.code)}</code>).
            </p>
            <div className="btn-row">
              <Link to="/giris?mod=kayit" className="btn btn-primary">
                <UserPlus size={16} aria-hidden /> Hesap aç
              </Link>
              <Link to="/giris" className="btn">
                <LogIn size={16} aria-hidden /> Giriş yap
              </Link>
            </div>
          </>
        )}

        {(state.kind === 'waiting' || state.kind === 'busy') && session && (
          <div className="share-loading" role="status">
            <Spinner /> Premium açılıyor…
          </div>
        )}

        {state.kind === 'done' && (
          <div role="status" className="redeem-link-done">
            <span className="redeem-link-icon is-gem" aria-hidden>
              <Gem size={26} />
            </span>
            <h1>
              <Celebrate>Premium açıldı!</Celebrate>
            </h1>
            <p className="subtle">
              {state.days} gün eklendi; <strong>{formatUntil(state.until)}</strong> tarihine kadar seninle.
              {session?.user.email ? ` Hesap: ${session.user.email}` : ''}
            </p>
            <Link to="/premium" className="btn btn-primary">
              Premium’u keşfet
            </Link>
          </div>
        )}

        {state.kind === 'failed' && state.error === 'used' && (
          <>
            <span className="redeem-link-icon" aria-hidden>
              <Ticket size={26} />
            </span>
            <h1>Bu kodu başkası kaptı</h1>
            <p className="redeem-error" role="alert">
              {REDEEM_MESSAGES.used} <code>{maskCode(state.code)}</code>
            </p>
            <p className="subtle">Hediye kodları tek kişilik; ilk tıklayan alıyor. Premium’u lansman fiyatıyla hemen açabilirsin:</p>
            <BuyPremium compact />
          </>
        )}

        {state.kind === 'failed' && state.error !== 'used' && (
          <>
            <span className="redeem-link-icon" aria-hidden>
              <Ticket size={26} />
            </span>
            <h1>Kod kullanılamadı</h1>
            <p className="redeem-error" role="alert">
              {REDEEM_MESSAGES[state.error]} <code>{maskCode(state.code)}</code>
            </p>
            <div className="btn-row">
              <Link to="/premium" className="btn">
                Premium sayfasına git
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * After signing in or confirming a new account the app opens on its home page: if a code from a
 * link is waiting on this device, this sends the student back to /kod to use it.
 */
export function PendingCodeReturn() {
  const { session } = useStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (!session || pathname === '/kod' || pathname.startsWith('/giris') || pathname.startsWith('/sifre-yenile')) return
    if (loadPendingCode()) navigate('/kod')
  }, [session, pathname, navigate])
  return null
}
