/**
 * ServiceIcon — 48×48 line icons for the ecosystem cards (#layanan). Every stroke is a <path> with
 * pathLength=1 so services.css can redraw it on card hover / focus (stroke-dashoffset 1 → 0,
 * staggered by --i). Accent strokes are peach. Decorative: aria-hidden.
 */
import type { CSSProperties } from 'react'

export type ServiceIconKey = 'satu-daerah' | 'usaha-pintar' | 'pasar-daerah'

interface Stroke {
  d: string
  accent?: boolean
}

const ICONS: Record<ServiceIconKey, Stroke[]> = {
  // town hall: pediment, columns, steps, a flag
  'satu-daerah': [
    { d: 'M6 18 24 8l18 10H6Z' },
    { d: 'M11 22v13M19 22v13M29 22v13M37 22v13' },
    { d: 'M6 39h36M4 43h40' },
    { d: 'M24 8V3h7', accent: true },
  ],
  // shop: awning, counter, a rising line
  'usaha-pintar': [
    { d: 'M8 20v20h32V20' },
    { d: 'M5 12h38l-3 8H8l-3-8Z' },
    { d: 'M19 40V29h10v11' },
    { d: 'M12 6h24', accent: true },
  ],
  // bridge between two banks, with a flow across
  'pasar-daerah': [
    { d: 'M3 34h42' },
    { d: 'M8 34V20M40 34V20' },
    { d: 'M8 20c6 10 26 10 32 0' },
    { d: 'M16 34v-7M24 34v-5M32 34v-7' },
    { d: 'M14 42h20', accent: true },
  ],
}

export default function ServiceIcon({ name }: { name: ServiceIconKey }) {
  return (
    <svg className="svc-icon-svg" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      {ICONS[name].map((s, i) => (
        <path
          key={i}
          d={s.d}
          pathLength={1}
          className={s.accent ? 'svc-stroke svc-stroke--accent' : 'svc-stroke'}
          style={{ '--i': i } as CSSProperties}
        />
      ))}
    </svg>
  )
}
