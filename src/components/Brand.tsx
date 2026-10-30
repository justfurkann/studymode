/** The highlighter mark: a navy tile with a yellow marker stroke (colors swap in dark mode via CSS). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" />
      <path d="M7 22 22 7l3 3-15 15H7z" />
      <path className="brand-mark-line" d="M7 25.4h18" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

/** Logo: mark plus "study" and a highlighted "mode". */
export function Brand({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`brand ${className}`.trim()} role="img" aria-label="studymode">
      <BrandMark size={size} />
      <span className="brand-word" aria-hidden="true">
        study<span className="hl">mode</span>
      </span>
    </span>
  )
}
