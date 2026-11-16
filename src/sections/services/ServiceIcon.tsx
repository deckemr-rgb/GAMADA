/**
 * ServiceIcon — 48×48 line icons for the service cards. Every stroke is a <path> with
 * pathLength=1 so services.css can redraw it on card hover / focus (stroke-dashoffset 1 → 0,
 * staggered by --i). Accent strokes are peach. Decorative: aria-hidden.
 */
import type { CSSProperties } from 'react'

export type ServiceIconKey = 'web' | 'apk' | 'ml' | 'pos'

interface Stroke {
  d: string
  accent?: boolean
}

/** Circle as a path (keeps pathLength support uniform across browsers). */
const ring = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`

const ICONS: Record<ServiceIconKey, Stroke[]> = {
  web: [
    { d: 'M7 9h34a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3Z' },
    { d: 'M4 16h40' },
    { d: 'M18.5 22.5 13 28l5.5 5.5', accent: true },
    { d: 'M29.5 22.5 35 28l-5.5 5.5', accent: true },
    { d: 'M26.5 21 21.5 35' },
  ],
  apk: [
    { d: 'M17 4h14a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z' },
    { d: 'M21 9h6' },
    { d: 'M18 17h12' },
    { d: 'M18 23h8', accent: true },
    { d: 'M18 29h10' },
    { d: 'M22 38.5h4' },
  ],
  ml: [
    { d: 'M12.5 14.5 21.5 22.5M35.5 14.5 26.5 22.5M12.5 33.5 21.5 25.5M35.5 33.5 26.5 25.5' },
    { d: 'M10 17v14M38 17v14' },
    { d: ring(24, 24, 4), accent: true },
    { d: ring(10, 13, 3) },
    { d: ring(38, 13, 3) },
    { d: ring(10, 35, 3) },
    { d: ring(38, 35, 3) },
  ],
  pos: [
    { d: 'M12 5h24v36l-4-3-4 3-4-3-4 3-4-3-4 3V5Z' },
    { d: 'M17 13h14' },
    { d: 'M17 19h14' },
    { d: 'M17 25h8' },
    { d: 'M17 31.5h5M27 31.5h4', accent: true },
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
