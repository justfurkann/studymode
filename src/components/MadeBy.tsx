/** The maker's signature: who built StudyMode, and where to find them. */
export const MAKER = 'JustFurkan'

export const SOCIALS: Array<{ label: string; handle: string; url: string }> = [
  { label: 'Instagram', handle: '@furkann_ztrk', url: 'https://www.instagram.com/furkann_ztrk' },
  { label: 'X', handle: '@furkan_ztrk_', url: 'https://x.com/furkan_ztrk_' },
  { label: 'TikTok', handle: '@justfurkann_', url: 'https://www.tiktok.com/@justfurkann_' },
  { label: 'YouTube', handle: '@justfurkann', url: 'https://www.youtube.com/@justfurkann' },
  { label: 'GitHub', handle: 'justfurkann', url: 'https://github.com/justfurkann' },
]

/** One quiet line: "Made by JustFurkan", linking to Instagram. */
export function MadeBy({ className = '' }: { className?: string }) {
  return (
    <a className={`made-by ${className}`} href={SOCIALS[0].url} target="_blank" rel="noopener noreferrer">
      Made by <strong>{MAKER}</strong>
    </a>
  )
}

/** The links as small chips, for the Settings "Hakkında" card. */
export function SocialLinks() {
  return (
    <ul className="socials" aria-label={`${MAKER} sosyal medya hesapları`}>
      {SOCIALS.map((s) => (
        <li key={s.label}>
          <a className="social-chip" href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.label}: ${s.handle}`}>
            <span className="social-name">{s.label}</span>
            <span className="social-handle">{s.handle}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
