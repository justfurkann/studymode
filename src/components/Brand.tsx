import { useEffect, useState } from 'react'

/*
 * The StudyMode logo: the yellow ribbon "S" in a navy tile, with "study" and a highlighted "mode".
 * Files in public/brand (from the approved brand pack, see docs/BRAND-ASSETS.md); the letters are
 * real paths, so no font is needed. Never redraw, stretch or crop them: height is set, width follows.
 *
 * The file is drawn inline and its yellow shapes take --logo-yellow: the brand yellow by default,
 * the pen colour with another highlighter (Kırtasiye seti, data-pen on <html>). Every colour goes
 * through the same drawing, so switching colours can never change the logo's size or sharpness
 * (with yellow as an <img> and pens inline, yellow looked a little smaller on an iPhone). The <img>
 * is only shown until the file's markup has arrived.
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

/** The file's markup with its yellow shapes painted in --logo-yellow. Same file as the <img>, so it comes from the cache. */
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
          .replace(BRAND_YELLOW, 'fill="var(--logo-yellow)"'),
      )
    p.catch(() => tinted.delete(src))
    tinted.set(src, p)
  }
  return p
}

let ready: { light: string; dark: string } | null = null

function useTinted(): { light: string; dark: string } | null {
  const [svgs, setSvgs] = useState(ready)
  useEffect(() => {
    if (ready) return
    let alive = true
    Promise.all([tintedSvg(LIGHT), tintedSvg(DARK)])
      .then(([light, dark]) => {
        ready = { light, dark }
        if (alive) setSvgs(ready)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return svgs
}

/** Full logo. Both theme versions are in the page and CSS shows the one for the current theme. */
export function Brand({ size = 28, className = '' }: { size?: number; className?: string }) {
  const height = logoHeight(size)
  // The SVGs are 1298 × 284.
  const width = Math.round((height * 1298) / 284)
  const svgs = useTinted()
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
