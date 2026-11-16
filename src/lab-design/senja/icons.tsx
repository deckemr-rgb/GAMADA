/** Direction B icons — 20 × 20, 1.5 px stroke, round caps (same family as sections/ecosystem/icons.tsx). */
import type { ReactElement, SVGProps } from 'react'

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
})

/** Path data, reusable inside other SVGs (map glyphs). */
export const PATHS = {
  chat: 'M4.2 15.8 5 12.9A6.3 6.3 0 1 1 7.3 15.2Z',
  globe: 'M10 3.2a6.8 6.8 0 1 0 0 13.6 6.8 6.8 0 0 0 0-13.6ZM3.2 10h13.6M10 3.2c1.9 1.9 2.7 4.2 2.7 6.8s-.8 4.9-2.7 6.8c-1.9-1.9-2.7-4.2-2.7-6.8s.8-4.9 2.7-6.8Z',
  phone: 'M6.8 3.5H4.9a1 1 0 0 0-1 1.1c.6 6.1 5.4 10.9 11.5 11.5a1 1 0 0 0 1.1-1v-1.9l-3.1-1.3-1.5 1.5a8.3 8.3 0 0 1-4.1-4.1l1.5-1.5Z',
  plus: 'M10 4.5v11M4.5 10h11',
  replay: 'M4.6 10.4a5.5 5.5 0 1 0 1.6-4.3M5.8 3.4v3h3',
  rowsComfort: 'M4 5.5h12M4 10h12M4 14.5h12',
  rowsCompact: 'M4 4.5h12M4 8.2h12M4 11.8h12M4 15.5h12',
  layers: 'M10 3.5 3.5 7 10 10.5 16.5 7ZM3.5 10.5 10 14l6.5-3.5M3.5 13.8 10 17.3l6.5-3.5',
  drop: 'M10 3.3c2.7 3.3 4.6 5.8 4.6 8.2a4.6 4.6 0 0 1-9.2 0c0-2.4 1.9-4.9 4.6-8.2Z',
  check: 'M5 10.4 8.3 13.5 15 6.5',
  sparkle: 'M9 3.2c.5 3.3 1.9 4.7 5.2 5.2-3.3.5-4.7 1.9-5.2 5.2-.5-3.3-1.9-4.7-5.2-5.2 3.3-.5 4.7-1.9 5.2-5.2ZM15 12.6c.25 1.5.9 2.15 2.4 2.4-1.5.25-2.15.9-2.4 2.4-.25-1.5-.9-2.15-2.4-2.4 1.5-.25 2.15-.9 2.4-2.4Z',
  clock: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM10 6.6V10l2.4 1.5',
  stamp: 'M7.6 3.5h4.8l-.9 5.4H8.5ZM4.5 11.5h11v2.8h-11ZM5.2 16.8h9.6',
  doc: 'M6 3h6l3.5 3.5V17H6ZM12 3v3.5h3.5M8.3 10.2h4.6M8.3 13.2h4.6',
  basket: 'M3.4 8.2h13.2l-1.5 7.6H4.9ZM7 8.2l2-4.3M13 8.2l-2-4.3',
  building: 'M3.8 16.5h12.4M5.2 16.5V8.3L10 4.6l4.8 3.7v8.2M8.2 11v3M11.8 11v3',
  cross: 'M8.2 4.2h3.6v4h4v3.6h-4v4H8.2v-4h-4V8.2h4Z',
  lock: 'M5.5 9h9v7.5h-9ZM7.2 9V6.8a2.8 2.8 0 0 1 5.6 0V9',
  inbox: 'M3.5 11.2 5.6 4.5h8.8l2.1 6.7v4.3h-13ZM3.5 11.2h3.8l1 2h3.4l1-2h3.8',
  map: 'M3.5 5.5 7.6 4l4.8 1.6 4.1-1.5v10.4l-4.1 1.5-4.8-1.6-4.1 1.5ZM7.6 4v10.4M12.4 5.6V16',
  chart: 'M3.5 16.2h13M5.2 13l3.3-3.6 2.6 2.1 4.2-5.2',
  route: 'M5 15.5a2 2 0 1 0 0-.01M15 4.5a2 2 0 1 0 0-.01M6.6 14.2c3.8-1 1.7-5.2 4.6-6.6 1-.5 1.8-.7 2.3-.9',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }): ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <path d={PATHS[name]} />
    </svg>
  )
}

/** Generic "verified account" badge (scalloped disc + tick), not any platform's mark. */
export function VerifiedBadge({ label }: { label: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" role="img" aria-label={label} className="lds-verified">
      <path
        d="M10 1.8l2 1.6 2.6-.2.8 2.4 2.2 1.4-.8 2.5.8 2.5-2.2 1.4-.8 2.4-2.6-.2-2 1.6-2-1.6-2.6.2-.8-2.4L2.4 12l.8-2.5-.8-2.5 2.2-1.4.8-2.4 2.6.2Z"
        fill="currentColor"
      />
      <path d="M6.6 10.2 8.9 12.4 13.5 7.7" fill="none" stroke="#1a1638" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Small filled triangle for KPI deltas. */
export function DeltaArrow({ up }: { up: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d={up ? 'M5 1.5 9 8.5H1Z' : 'M5 8.5 1 1.5h8Z'} fill="currentColor" />
    </svg>
  )
}
