import type { TypeId } from '../lib/studentType'
import { TYPES } from '../lib/studentType'

/*
 * One original character per student type: a soft round "note blob" with a face, in the type's
 * colour, holding its prop (planner, clock, moon, magnifier...). Colours are written inline, not as
 * CSS variables, so the same SVG can be drawn onto the story image. Motion comes from CSS classes
 * (quiz.css) and stops for people who ask for reduced motion.
 */

const INK = '#1b2250'

function Face({ sleepy = false, worried = false }: { sleepy?: boolean; worried?: boolean }) {
  return (
    <g>
      <g className="sc-blink">
        {sleepy ? (
          <>
            <path d="M78 96 q8 6 16 0" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M106 96 q8 6 16 0" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="86" cy="95" rx="6" ry="8" fill={INK} />
            <ellipse cx="114" cy="95" rx="6" ry="8" fill={INK} />
            <circle cx="88" cy="92" r="2" fill="#fff" />
            <circle cx="116" cy="92" r="2" fill="#fff" />
          </>
        )}
      </g>
      {worried ? (
        <path d="M90 120 q10 -7 20 0" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M89 115 q11 10 22 0" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      <ellipse cx="74" cy="110" rx="7" ry="4" fill="#ff7aa8" opacity="0.45" />
      <ellipse cx="126" cy="110" rx="7" ry="4" fill="#ff7aa8" opacity="0.45" />
    </g>
  )
}

/** The blob: a rounded sheet of paper with a folded corner and ruled lines. */
function Body({ color }: { color: string }) {
  return (
    <g>
      <ellipse cx="100" cy="182" rx="46" ry="7" fill={INK} opacity="0.18" className="sc-shadow" />
      <g className="sc-bob">
        <path d="M58 60 Q58 44 74 44 L132 44 L146 58 L146 158 Q146 172 132 172 L72 172 Q58 172 58 158 Z" fill={color} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M132 44 L132 58 L146 58" fill="#ffffff" fillOpacity="0.55" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M70 140 H134 M70 152 H120" stroke={INK} strokeOpacity="0.18" strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
  )
}

function Prop({ id, accent }: { id: TypeId; accent: string }) {
  switch (id) {
    case 'ajanda':
      return (
        <g className="sc-float">
          <rect x="138" y="96" width="44" height="52" rx="6" fill="#fff" stroke={INK} strokeWidth="4" />
          <rect x="138" y="96" width="44" height="12" rx="4" fill={INK} />
          <path d="M146 120 l5 5 l9 -10 M146 136 l5 5 l9 -10" stroke="#1c8a55" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M166 122 h9 M166 138 h9" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </g>
      )
    case 'sondakika':
      return (
        <g>
          <g className="sc-shake">
            <circle cx="160" cy="62" r="22" fill="#fff" stroke={INK} strokeWidth="4" />
            <path d="M160 50 V62 L170 68" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M144 42 l-6 -6 M176 42 l6 -6" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          </g>
          <path className="sc-drip" d="M54 74 q-8 12 0 16 q8 -4 0 -16 Z" fill="#7cc7ff" stroke={INK} strokeWidth="3" />
        </g>
      )
    case 'gecekusu':
      return (
        <g>
          <path className="sc-float" d="M160 30 a22 22 0 1 0 22 30 a17 17 0 1 1 -22 -30 Z" fill={accent} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <g className="sc-twinkle">
            <path d="M40 40 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 Z" fill={accent} />
            <path d="M176 112 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill={accent} />
          </g>
          <path d="M64 68 Q100 40 140 68" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="54" y="66" width="14" height="22" rx="6" fill={INK} />
          <rect x="132" y="66" width="14" height="22" rx="6" fill={INK} />
        </g>
      )
    case 'kasif':
      return (
        <g>
          <g className="sc-float">
            <circle cx="160" cy="118" r="18" fill="#dff4ff" fillOpacity="0.7" stroke={INK} strokeWidth="5" />
            <path d="M147 132 L132 150" stroke={INK} strokeWidth="7" strokeLinecap="round" />
          </g>
          <text className="sc-twinkle" x="40" y="52" fontSize="30" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">?</text>
          <text className="sc-twinkle sc-late" x="150" y="44" fontSize="24" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">?</text>
        </g>
      )
    case 'anlatici':
      return (
        <g>
          <g className="sc-float">
            <path d="M136 26 h50 a8 8 0 0 1 8 8 v24 a8 8 0 0 1 -8 8 h-30 l-12 10 v-10 h-8 a8 8 0 0 1 -8 -8 v-24 a8 8 0 0 1 8 -8 Z" fill="#fff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <circle cx="148" cy="46" r="4" fill={INK} />
            <circle cx="161" cy="46" r="4" fill={INK} />
            <circle cx="174" cy="46" r="4" fill={INK} />
          </g>
          <path className="sc-wave" d="M146 128 L182 96" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        </g>
      )
    case 'fosforlu':
      return (
        <g>
          <g className="sc-draw">
            <rect x="140" y="86" width="16" height="54" rx="4" transform="rotate(28 148 113)" fill="#ff9fcf" stroke={INK} strokeWidth="4" />
            <path d="M160 138 l8 12 l-14 -2 Z" fill="#ff9fcf" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          </g>
          <path d="M40 186 h120" stroke="#ff9fcf" strokeWidth="10" strokeLinecap="round" opacity="0.8" className="sc-stroke" />
          <g className="sc-twinkle">
            <path d="M44 56 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 Z" fill="#ff9fcf" />
            <path d="M170 60 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 Z" fill="#7ff0b8" />
          </g>
        </g>
      )
    case 'avci':
      return (
        <g className="sc-float">
          <circle cx="164" cy="70" r="24" fill="#fff" stroke={INK} strokeWidth="4" />
          <circle cx="164" cy="70" r="14" fill="#ff7a80" stroke={INK} strokeWidth="3" />
          <circle cx="164" cy="70" r="5" fill={INK} />
          <path d="M126 104 L160 72" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <path d="M126 104 l-4 -12 M126 104 l12 4" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case 'maratoncu':
      return (
        <g>
          <circle className="sc-rise" cx="166" cy="54" r="18" fill="#ffd34d" stroke={INK} strokeWidth="4" />
          <rect x="56" y="62" width="92" height="12" rx="6" fill="#ff7a80" stroke={INK} strokeWidth="3" />
          <path d="M146 68 l18 -6 M146 70 l16 8" stroke="#ff7a80" strokeWidth="6" strokeLinecap="round" />
          <path className="sc-steps" d="M30 176 h16 M30 164 h10" stroke={INK} strokeOpacity="0.4" strokeWidth="4" strokeLinecap="round" />
        </g>
      )
  }
}

export function StudentCharacter({ id, size = 200, still = false }: { id: TypeId; size?: number; still?: boolean }) {
  const [color, accent] = TYPES[id].colors
  return (
    <svg className={`student-character ${still ? '' : 'is-animated'}`} viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`${TYPES[id].name} karakteri`} xmlns="http://www.w3.org/2000/svg">
      <Body color={color} />
      <g className="sc-bob">
        <Face sleepy={id === 'gecekusu'} worried={id === 'sondakika'} />
      </g>
      <Prop id={id} accent={accent} />
    </svg>
  )
}
