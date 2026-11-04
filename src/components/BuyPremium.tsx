import { ArrowRight, AudioLines, Check, Image as ImageIcon, Search, ShoppingBag, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buyUrl, formatPrice, PACKAGES } from '../lib/pricing'

/** What Premium gives, in four short lines (the full list is on /fiyatlar). */
export const PREMIUM_PERKS = [
  { icon: AudioLines, text: 'Notun iki kişilik sesli sohbete dönüşür' },
  { icon: Search, text: 'Notlarında anlamla arama' },
  { icon: ImageIcon, text: 'Konuyu anlatan yapay zekâ görselleri' },
  { icon: Sparkles, text: 'Daha güçlü model (Free+), günde 150 istek' },
] as const

/**
 * The two packages as big "Hemen al" buttons, straight to the payment page. Shown on the Premium
 * page and in the Premium pop-up; `onBuy` lets the pop-up remember the tap.
 */
export function BuyPremium({ onBuy, compact = false }: { onBuy?: () => void; compact?: boolean }) {
  const buyable = PACKAGES.map((pkg) => ({ pkg, url: buyUrl(pkg) })).filter((x): x is { pkg: (typeof PACKAGES)[number]; url: string } => !!x.url)
  if (!buyable.length) {
    return (
      <Link to="/fiyatlar" className="btn prem-btn buy-main">
        Fiyatları gör <ArrowRight size={17} aria-hidden />
      </Link>
    )
  }
  return (
    <div className={`buy-premium${compact ? ' is-compact' : ''}`}>
      {buyable.map(({ pkg, url }, i) => (
        <a
          key={pkg.id}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`buy-option${i === 0 ? ' is-main' : ''}`}
          onClick={onBuy}
          aria-label={`${pkg.name}, ${formatPrice(pkg.price)}: hemen al`}
        >
          {pkg.badge && <span className="buy-badge">{pkg.badge}</span>}
          <span className="buy-name">{pkg.name}</span>
          <span className="buy-price">
            <strong>{formatPrice(pkg.price)}</strong> <span className="buy-days">{pkg.days} gün</span>
          </span>
          <span className={`btn ${i === 0 ? 'prem-btn' : 'btn-primary'} buy-cta`}>
            <ShoppingBag size={17} aria-hidden /> Hemen al
          </span>
        </a>
      ))}
      <p className="buy-fine">
        <Check size={14} aria-hidden /> Tek seferlik ödeme, otomatik yenileme yok. Kod e-postana link olarak gelir; tıklayınca Premium açılır.
      </p>
    </div>
  )
}

/** The perks as a small list. */
export function PremiumPerks() {
  return (
    <ul className="buy-perks">
      {PREMIUM_PERKS.map(({ icon: Icon, text }) => (
        <li key={text}>
          <span className="buy-perk-icon" aria-hidden>
            <Icon size={16} />
          </span>
          {text}
        </li>
      ))}
    </ul>
  )
}

