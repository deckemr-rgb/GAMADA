/** Line icons for direction A (stroke = currentColor, 1.5 px, same family as sections/ecosystem/icons). */
import type { ReactElement, SVGProps } from 'react'

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
})

type Icon = (p?: { size?: number }) => ReactElement

export const IconUp: Icon = ({ size = 12 } = {}) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
)
export const IconDown: Icon = ({ size = 12 } = {}) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
)
export const IconPlus: Icon = ({ size = 16 } = {}) => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconReplay: Icon = ({ size = 16 } = {}) => (
  <svg {...base(size)}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4v4h4" />
  </svg>
)
export const IconCheck: Icon = ({ size = 16 } = {}) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)
export const IconStamp: Icon = ({ size = 16 } = {}) => (
  <svg {...base(size)}>
    <path d="M9.5 3.5h5l-.8 6.5h-3.4z" />
    <path d="M5 13.5h14v3H5z" />
    <path d="M6 20.5h12" />
  </svg>
)
export const IconUndo: Icon = ({ size = 16 } = {}) => (
  <svg {...base(size)}>
    <path d="M9 7.5L4.5 12 9 16.5" />
    <path d="M4.5 12h10a5 5 0 0 1 0 10h-2" />
  </svg>
)
export const IconScan: Icon = ({ size = 16 } = {}) => (
  <svg {...base(size)}>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <path d="M4 12h16" />
  </svg>
)
export const IconRowsComfort: Icon = ({ size = 16 } = {}) => (
  <svg {...base(size)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)
export const IconRowsCompact: Icon = ({ size = 16 } = {}) => (
  <svg {...base(size)}>
    <path d="M4 5h16M4 9.5h16M4 14h16M4 18.5h16" />
  </svg>
)

/** Generic "verified account" tick: a scalloped seal with a check — not any platform's badge. */
export function VerifiedTick({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 1l1.6 1.2 2-.2.7 1.9 1.8.9-.3 2L15 8l-1.2 1.6.3 2-1.8.9-.7 1.9-2-.2L8 15l-1.6-1.2-2 .2-.7-1.9-1.8-.9.3-2L1 8l1.2-1.6-.3-2 1.8-.9.7-1.9 2 .2z"
        fill="var(--lde-acc)"
      />
      <path d="M5.2 8.2l1.9 1.9 3.8-3.9" fill="none" stroke="var(--lde-acc-on)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Map point-of-interest glyphs, drawn inside a 0-centred 18 px disc (SVG user units). */
export function PoiGlyph({ kind }: { kind: 'pasar' | 'mpp' | 'rs' }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'pasar')
    return (
      <g {...s}>
        <path d="M-4.5 -1.5h9M-4 -1.5l1-3h6l1 3" />
        <path d="M-3.5 -1.5v5h7v-5M-1 3.5v-2.5h2v2.5" />
      </g>
    )
  if (kind === 'mpp')
    return (
      <g {...s}>
        <path d="M-5 -2l5-3 5 3M-4.5 4h9M-3 -1.5v4.5M0 -1.5v4.5M3 -1.5v4.5" />
      </g>
    )
  return (
    <g {...s} strokeWidth={1.8}>
      <path d="M0 -4v8M-4 0h8" />
    </g>
  )
}
