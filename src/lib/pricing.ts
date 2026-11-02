import { SHOPIER_URL } from './config'

/*
 * What is sold and for how much, in one place: the public /fiyatlar page, the distance sales
 * contract on it and the links in the app all read from here. Prices and seller details were
 * given by the seller (2 Kasım 2026); change them only on their word.
 */

export interface PremiumPackage {
  id: 'aylik' | 'donem'
  name: string
  /** Days of Premium the code gives (the admin code maker offers 30 and 120). */
  days: number
  /** Total price in Turkish lira. */
  price: number
  note: string
  /** This package's own Shopier link; empty falls back to SHOPIER_URL. */
  shopierUrl: string
}

export const PACKAGES: PremiumPackage[] = [
  { id: 'aylik', name: '1 aylık Premium', days: 30, price: 50, note: 'Bir ay boyunca bütün Premium özellikleri.', shopierUrl: '' },
  { id: 'donem', name: '4 aylık dönem paketi', days: 120, price: 150, note: 'Bir dönemi baştan sona kapsar; aylığa göre 50 TL daha uygun.', shopierUrl: '' },
]

/** Where "Satın al" goes for a package, or null while there is no Shopier link yet. */
export function buyUrl(pkg: Pick<PremiumPackage, 'shopierUrl'>, fallback: string = SHOPIER_URL): string | null {
  return pkg.shopierUrl || fallback || null
}

export const formatPrice = (lira: number) => `${lira.toLocaleString('tr-TR')} TL`

/** The seller, as the law asks it to be shown on the sales page and the contract. */
export const SELLER = {
  name: 'Muhammed Furkan Öztürk',
  kind: 'Şahıs (gerçek kişi)',
  email: 'justfurkan42@gmail.com',
  phone: '0501 608 74 92',
  phoneHref: 'tel:+905016087492',
  address: 'Şehit Tunç Uncu Sokak No: 1, Şişli / İstanbul',
}

/** How and how fast a bought code reaches the buyer (manual for now). */
export const DELIVERY = {
  within: 'en geç 24 saat',
  how: 'Shopier siparişinde yazdığın e-posta adresine',
}

export const PRICING_UPDATED = '2 Kasım 2026'
