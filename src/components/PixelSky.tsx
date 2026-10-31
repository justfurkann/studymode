/*
 * A small pixel-art sky for the maker card, in the style of the profile picture: two layers of
 * blocky clouds drifting at different speeds and a few twinkling highlighter sparks. Colors come
 * from theme tokens (day sky in light mode, night sky in dark mode). Motion stops for people who
 * ask for reduced motion (global rule).
 */

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

export function PixelSky() {
  return (
    <div className="pixel-sky" aria-hidden="true">
      <Layer className="sky-far" clouds={[{ x: 30, y: 14 }, { x: 170, y: 40 }, { x: 300, y: 10 }]} />
      <Layer className="sky-near" clouds={[{ x: 70, y: 48, big: true }, { x: 260, y: 26, big: true }]} />
      {SPARKS.map((s, i) => (
        <span key={i} className="sky-spark" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }} />
      ))}
    </div>
  )
}
