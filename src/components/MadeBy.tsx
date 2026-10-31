import { BrandIcon, type Brand } from './BrandIcon'

/** The maker's signature: who built StudyMode, and where to find them. */
export const MAKER = 'JustFurkan'

export const SOCIALS: Array<{ brand: Brand; label: string; handle: string; url: string }> = [
  { brand: 'instagram', label: 'Instagram', handle: '@furkann_ztrk', url: 'https://www.instagram.com/furkann_ztrk' },
  { brand: 'x', label: 'X', handle: '@furkan_ztrk_', url: 'https://x.com/furkan_ztrk_' },
  { brand: 'tiktok', label: 'TikTok', handle: '@justfurkann_', url: 'https://www.tiktok.com/@justfurkann_' },
  { brand: 'youtube', label: 'YouTube', handle: '@justfurkann', url: 'https://www.youtube.com/@justfurkann' },
  { brand: 'github', label: 'GitHub', handle: 'justfurkann', url: 'https://github.com/justfurkann' },
]

const external = { target: '_blank', rel: 'noopener noreferrer' } as const

/** One quiet line: "Made by JustFurkan", linking to Instagram. */
export function MadeBy({ className = '' }: { className?: string }) {
  return (
    <a className={`made-by ${className}`} href={SOCIALS[0].url} {...external}>
      Made by <strong>{MAKER}</strong>
    </a>
  )
}

/** Settings → Hakkında: a small business card for the maker. */
export function MakerCard() {
  const instagram = SOCIALS[0]
  return (
    <div className="maker-card">
      <div className="maker-band" aria-hidden="true" />
      <div className="maker-body">
        <div className="maker-head">
          <span className="maker-avatar" aria-hidden="true">
            JF
          </span>
          <div className="maker-title">
            <strong className="maker-name">{MAKER}</strong>
            <span className="subtle">StudyMode'u yapan kişi</span>
          </div>
        </div>
        <p className="maker-text">
          Selam! StudyMode'u kendi sınav dönemim için yaptım, sonra arkadaşlarım da kullansın istedim. Bir fikrin, önerin ya da gözüne takılan bir hata varsa yaz; hepsini okuyorum.
        </p>
        <ul className="maker-socials" aria-label={`${MAKER} sosyal medya hesapları`}>
          {SOCIALS.map((s) => (
            <li key={s.brand}>
              <a className="maker-social" href={s.url} {...external} aria-label={`${s.label}: ${s.handle}`} title={s.handle}>
                <span className="maker-social-icon">
                  <BrandIcon brand={s.brand} />
                </span>
                <span className="maker-social-label">{s.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <a className="btn btn-primary maker-cta" href={instagram.url} {...external}>
          <BrandIcon brand="instagram" size={17} /> Instagram'dan yaz
        </a>
      </div>
    </div>
  )
}
