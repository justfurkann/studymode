/*
 * A small pixel-art sky for the maker card, in the style of the profile picture: two layers of
 * blocky clouds drifting at different speeds and a few twinkling highlighter sparks. Colors come
 * from theme tokens (day sky in light mode, night sky in dark mode). Motion stops for people who
 * ask for reduced motion (global rule).
 */

import { useEffect, useState } from 'react'
import { isNightOwlHour } from '../lib/receipt'

const U = 4 // one "pixel" of the art, in SVG units

/** Rows of a cloud: [startColumn, length] per row, top to bottom; the last row is the shade. */
const BIG: Array<[number, number]> = [
  [5, 4],
  [3, 9],
  [1, 14],
  [0, 17],
  [1, 15],
]
const SMALL: Array<[number, number]> = [
  [2, 3],
  [1, 7],
  [0, 10],
  [1, 8],
]

function Cloud({ x, y, rows }: { x: number; y: number; rows: Array<[number, number]> }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {rows.map(([start, length], i) => (
        <rect key={i} x={start * U} y={i * U} width={length * U} height={U} className={i === rows.length - 1 ? 'sky-cloud-shade' : 'sky-cloud'} />
      ))}
    </g>
  )
}

/** One tile of a layer; the track holds it twice so the drift loops without a seam. */
function Layer({ className, clouds }: { className: string; clouds: Array<{ x: number; y: number; big?: boolean }> }) {
  const tile = (key: string) => (
    <svg key={key} viewBox="0 0 400 96" width="400" height="96" shapeRendering="crispEdges" aria-hidden="true">
      {clouds.map((c, i) => (
        <Cloud key={i} x={c.x} y={c.y} rows={c.big ? BIG : SMALL} />
      ))}
    </svg>
  )
  return <div className={`sky-layer ${className}`}>{[tile('a'), tile('b')]}</div>
}

const SPARKS = [
  { x: 12, y: 22, d: 0 },
  { x: 47, y: 58, d: 1.2 },
  { x: 71, y: 18, d: 2.1 },
  { x: 90, y: 46, d: 0.6 },
]

/** Shooting stars, only after midnight (the night-owl hours). */
const SHOOTING = [
  { x: 18, y: 8, d: 0.4 },
  { x: 62, y: 4, d: 3.1 },
  { x: 84, y: 14, d: 6.3 },
]

function useNightOwl() {
  const [night, setNight] = useState(() => isNightOwlHour(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setNight(isNightOwlHour(new Date())), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return night
}

export function PixelSky() {
  const night = useNightOwl()
  return (
    <div className={`pixel-sky ${night ? 'is-night' : ''}`} aria-hidden="true">
      <Layer className="sky-far" clouds={[{ x: 30, y: 14 }, { x: 170, y: 40 }, { x: 300, y: 10 }]} />
      <Layer className="sky-near" clouds={[{ x: 70, y: 48, big: true }, { x: 260, y: 26, big: true }]} />
      {SPARKS.map((s, i) => (
        <span key={i} className="sky-spark" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }} />
      ))}
      {night &&
        SHOOTING.map((s, i) => <span key={`shoot-${i}`} className="sky-shooting" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }} />)}
    </div>
  )
}
