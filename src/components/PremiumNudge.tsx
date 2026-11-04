import { Gem } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuota } from '../lib/account'
import { mayNudge, readMemory, writeMemory } from '../lib/nudge'
import { usePremium } from '../lib/premium'
import { useStore } from '../lib/store'
import { useTourActive } from '../lib/tour'
import { BuyPremium, PremiumPerks } from './BuyPremium'
import { Modal } from './ui'

/** Seconds on a page before the pop-up may show, so it never greets someone who just arrived. */
const SETTLE_MS = 20_000

/**
 * "Premium'u dene": now and then, a normal account (never VIP, admin or Premium) is shown what
 * Premium gives and two buy buttons. When and how often: lib/nudge.ts.
 * Tests: localStorage "studymode.nudge.off" keeps it away (set for every test in playwright.config),
 * "studymode.nudge.force" shows it after a moment, skipping the waiting but not the who.
 */
export function PremiumNudge() {
  const store = useStore()
  const { pathname } = useLocation()
  const userId = store.session?.user.id ?? null
  const quota = useQuota(userId)
  const premium = usePremium()
  const touring = useTourActive()
  const [show, setShow] = useState(false)
  // Tests skip the waiting (account age, spacing), never the who: VIPs are still left alone.
  const forced = isForced()

  const eligible =
    !!userId &&
    !isOff() &&
    !touring &&
    mayNudge({
      signedIn: true,
      role: quota?.role ?? null,
      premiumLocked: premium.state === 'locked',
      accountCreatedAt: forced ? '2000-01-01T00:00:00Z' : (store.session?.user.created_at ?? null),
      notes: store.data.notes.length,
      pathname,
      memory: forced ? { at: 0, no: 0, buyAt: 0 } : readMemory(userId),
      now: Date.now(),
    })

  useEffect(() => {
    if (!eligible || show || !userId) return
    const timer = window.setTimeout(
      () => {
        // Never on top of another window (VIP welcome, education question, a dialog the student opened).
        if (document.querySelector('.modal-backdrop, .assistant-panel')) return
        writeMemory(userId, { ...readMemory(userId), at: Date.now() })
        setShow(true)
      },
      forced ? 800 : SETTLE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [eligible, show, userId, pathname, forced])

  if (!show || !userId) return null

  function notNow() {
    const m = readMemory(userId!)
    writeMemory(userId!, { ...m, no: m.no + 1 })
    setShow(false)
  }

  function bought() {
    writeMemory(userId!, { ...readMemory(userId!), buyAt: Date.now() })
    setShow(false)
  }

  return (
    <Modal title="Premium’u dene" onClose={notNow}>
      <div className="nudge">
        <span className="nudge-icon" aria-hidden>
          <Gem size={26} />
        </span>
        <p className="nudge-lead">
          Notların <span className="hl">konuşsun</span>, daha hızlı çalış.
        </p>
        <PremiumPerks />
        <BuyPremium onBuy={bought} compact />
        <div className="nudge-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={notNow}>
            Şimdi değil
          </button>
          <Link to="/premium" className="btn btn-ghost btn-sm" onClick={() => setShow(false)}>
            Premium’u incele
          </Link>
        </div>
      </div>
    </Modal>
  )
}

function isForced(): boolean {
  try {
    return localStorage.getItem('studymode.nudge.force') === '1'
  } catch {
    return false
  }
}

function isOff(): boolean {
  try {
    return localStorage.getItem('studymode.nudge.off') === '1' && !isForced()
  } catch {
    return false
  }
}
