import { Gem, Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** A small shiny "Premium" tag, for buttons and tabs that lead to a Premium feature. */
export function PremiumMark({ label = 'Premium' }: { label?: string }) {
  return (
    <span className="prem-mark">
      <Gem size={11} aria-hidden /> {label}
    </span>
  )
}

/** Shown where a Premium action would be, for accounts that do not have it: what it is and where to look. */
export function PremiumLock({ children }: { children: ReactNode }) {
  return (
    <div className="prem-lock">
      <span className="prem-lock-icon" aria-hidden>
        <Lock size={15} />
      </span>
      <span className="grow">{children}</span>
      <Link to="/premium" className="btn btn-sm prem-btn">
        <Gem size={14} aria-hidden /> Premium'u gör
      </Link>
    </div>
  )
}
