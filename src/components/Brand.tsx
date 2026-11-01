import { useEffect, useState } from 'react'

/*
 * The StudyMode logo: the yellow ribbon "S" in a navy tile, with "study" and a highlighted "mode".
 * Files in public/brand (from the approved brand pack, see docs/BRAND-ASSETS.md); the letters are
 * real paths, so no font is needed. Never redraw, stretch or crop them: height is set, width follows.
 *
 * With the default yellow highlighter the brand files are shown as they are (<img>). With another
 * pen colour (Kırtasiye seti, data-pen on <html>) the same file is drawn inline and only its yellow
 * shapes take the pen colour: the shapes themselves change colour, so there is no layer on top and
 * no yellow halo at the edges (an earlier overlay left one).
 */

/** Height of the full logo for a given `size` (the old mark size), so existing call sites keep their scale. */
const logoHeight = (size: number) => Math.round(size * 1.15)

const LIGHT = '/brand/svg/logo.svg'
const DARK = '/brand/svg/logo-dark.svg'
/** The brand yellow in the files. */
const BRAND_YELLOW = /fill="#FFE34F"/gi

/** The app icon: yellow S in the navy tile. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <img className="brand-mark" src="/brand/svg/icon.svg" width={size} height={size} alt="" aria-hidden="true" decoding="async" />
}

/** Whether a highlighter colour other than the default yellow is on (data-pen on <html>). */
function usePen(): boolean {
  const read = () => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-pen')
  const [pen, setPen] = useState(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setPen(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-pen'] })
    setPen(read())
    return () => observer.disconnect()
  }, [])
  return pen
}

/** The file's markup with its yellow shapes painted in the pen colour (--hi). Same file as the <img>, so it comes from the cache. */
const tinted = new Map<string, Promise<string>>()
function tintedSvg(src: string): Promise<string> {
  let p = tinted.get(src)
  if (!p) {
    p = fetch(src)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((svg) =>
        svg
          .replace(/<title[^>]*>[\s\S]*?<\/title>/, '')
          .replace(/ role="img"| aria-labelledby="[^"]*"/g, '')
          .replace(/ id="[^"]*"/g, '')
          .replace(/<svg /, '<svg aria-hidden="true" focusable="false" ')
          .replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%"')
          .replace(BRAND_YELLOW, 'fill="var(--hi)"'),
      )
    p.catch(() => tinted.delete(src))
    tinted.set(src, p)
  }
  return p
}

function useTinted(on: boolean): { light: string; dark: string } | null {
  const [svgs, setSvgs] = useState<{ light: string; dark: string } | null>(null)
  useEffect(() => {
    if (!on) return
    let alive = true
    Promise.all([tintedSvg(LIGHT), tintedSvg(DARK)])
      .then(([light, dark]) => alive && setSvgs({ light, dark }))
      .catch(() => alive && setSvgs(null))
    return () => {
      alive = false
    }
  }, [on])
  return on ? svgs : null
}

/** Full logo. Both theme versions are in the page and CSS shows the one for the current theme. */
export function Brand({ size = 28, className = '' }: { size?: number; className?: string }) {
  const height = logoHeight(size)
  // The SVGs are 1298 × 284.
  const width = Math.round((height * 1298) / 284)
  const svgs = useTinted(usePen())
  return (
    <span className={`brand ${className}`.trim()} role="img" aria-label="studymode">
      {svgs ? (
        <>
          <span className="brand-logo is-light is-tinted" style={{ width, height }} dangerouslySetInnerHTML={{ __html: svgs.light }} />
          <span className="brand-logo is-dark is-tinted" style={{ width, height }} dangerouslySetInnerHTML={{ __html: svgs.dark }} />
        </>
      ) : (
        <>
          <img className="brand-logo is-light" src={LIGHT} width={width} height={height} alt="" decoding="async" />
          <img className="brand-logo is-dark" src={DARK} width={width} height={height} alt="" decoding="async" />
        </>
      )}
    </span>
  )
}
