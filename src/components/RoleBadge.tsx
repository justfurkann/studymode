import { Crown, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { quotaText, useQuota } from '../lib/account'
import { useStore } from '../lib/store'
import { Celebrate, Modal } from './ui'

const VIP_LIMIT = 150
const NORMAL_LIMIT = 40
const welcomedKey = (userId: string) => `studymode.vipWelcomed.${userId}`

/** What being VIP gives, in one place so the badge and the welcome say the same thing. */
function VipPerks({ used }: { used: number }) {
  return (
    <ul className="vip-perks">
      <li>
        <Sparkles size={16} aria-hidden /> Günde <strong>{VIP_LIMIT}</strong> ücretsiz yapay zekâ isteği (normalde {NORMAL_LIMIT}). Bugün {used} tanesini kullandın.
      </li>
      <li>
        <Crown size={16} aria-hidden /> Logonun yanında VIP rozeti.
      </li>
      <li>
        <Sparkles size={16} aria-hidden /> Yeni özellikleri herkesten önce deneyenlerden olacaksın.
      </li>
    </ul>
  )
}

/** A tilted sticker next to the logo: "VIP" opens what VIP gives; "Yönetici" opens the admin page. */
export function RoleBadge() {
  const { session } = useStore()
  const quota = useQuota(session?.user.id ?? null)
  const [open, setOpen] = useState(false)

  if (!quota || quota.role === 'normal') return null

  if (quota.role === 'admin') {
    return (
      <Link to="/yonetim" className="role-pill is-admin" aria-label="Yönetici: yönetim paneli" title="Yönetim paneli">
        <ShieldCheck size={13} aria-hidden /> Yönetici
      </Link>
    )
  }

  return (
    <>
      <button type="button" className="role-pill is-vip" onClick={() => setOpen(true)} aria-label="VIP: ayrıcalıklarını gör">
        <Crown size={13} aria-hidden /> VIP
      </button>
      {open && <VipDialog title="VIP ayrıcalıkların" used={quota.used} text={quotaText(quota)} onClose={() => setOpen(false)} />}
    </>
  )
}

function VipDialog({ title, used, text, welcome = false, onClose }: { title: string; used: number; text: string; welcome?: boolean; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="vip-modal">
        {welcome && (
          <p>
            <Celebrate>Tebrikler!</Celebrate> Hesabına VIP verildi. İşte sende olanlar:
          </p>
        )}
        <VipPerks used={used} />
        <p className="subtle">{text}. Hak her gece yarısı yenilenir.</p>
        <button className="btn btn-primary" onClick={onClose}>
          Harika
        </button>
      </div>
    </Modal>
  )
}

/** Mounted once in the app shell: the first time someone shows up as VIP on a device, welcome them. */
export function VipWelcome() {
  const { session } = useStore()
  const userId = session?.user.id ?? null
  const quota = useQuota(userId)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (quota?.role !== 'vip' || !userId) return
    try {
      if (!localStorage.getItem(welcomedKey(userId))) {
        localStorage.setItem(welcomedKey(userId), '1')
        setShow(true)
      }
    } catch {
      // Without storage the welcome simply does not show.
    }
  }, [quota?.role, userId])

  if (!show || !quota) return null
  return <VipDialog title="Artık VIP’sin!" used={quota.used} text={quotaText(quota)} welcome onClose={() => setShow(false)} />
}
