/*
 * The StudyMode logo: the yellow ribbon "S" in a navy tile, with "study" and a highlighted "mode".
 * Files in public/brand (from the approved brand pack, see docs/BRAND-ASSETS.md); the letters are
 * real paths, so no font is needed. Never redraw, stretch or crop them: height is set, width follows.
 */

/** Height of the full logo for a given `size` (the old mark size), so existing call sites keep their scale. */
const logoHeight = (size: number) => Math.round(size * 1.15)

/** The app icon: yellow S in the navy tile. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <img className="brand-mark" src="/brand/svg/icon.svg" width={size} height={size} alt="" aria-hidden="true" decoding="async" />
}

/**
 * Full logo. Both versions are in the page and CSS shows the one for the current theme.
 * With a highlighter colour other than yellow (Kırtasiye seti, data-pen), a layer painted in --hi and
 * cut to the logo's yellow parts (logo-tint.svg, logo-dark-tint.svg) covers them, so the ribbon and
 * the "mode" highlight follow the pen. Yellow shows the brand files untouched.
 */
export function Brand({ size = 28, className = '' }: { size?: number; className?: string }) {
  const height = logoHeight(size)
  // The SVGs are 1298 × 284.
  const width = Math.round((height * 1298) / 284)
  return (
    <span className={`brand ${className}`.trim()} role="img" aria-label="studymode">
      <img className="brand-logo is-light" src="/brand/svg/logo.svg" width={width} height={height} alt="" decoding="async" />
      <img className="brand-logo is-dark" src="/brand/svg/logo-dark.svg" width={width} height={height} alt="" decoding="async" />
      <span className="brand-tint is-light" aria-hidden="true" />
      <span className="brand-tint is-dark" aria-hidden="true" />
    </span>
  )
}
