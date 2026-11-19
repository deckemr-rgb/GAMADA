/** Ecosystem node icons (24 × 24, stroke = currentColor, decorative). */
import type { ReactElement } from 'react'

export type EcoNodeId = 'hub' | 'satu-daerah' | 'usaha-pintar' | 'pasar-daerah'

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

export const ECO_ICONS: Record<EcoNodeId, () => ReactElement> = {
  // GAMADA Inti: stacked layers
  hub: () => (
    <svg {...base}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  ),
  'satu-daerah': () => (
    <svg {...base}>
      <path d="M3 9.5 12 4l9 5.5H3Z" />
      <path d="M6 12.5v6M10 12.5v6M14 12.5v6M18 12.5v6" />
      <path d="M3 21h18" />
    </svg>
  ),
  'usaha-pintar': () => (
    <svg {...base}>
      <path d="M4.5 10v10h15V10" />
      <path d="M3 5h18l-1.5 5h-15L3 5Z" />
      <path d="M10 20v-5h4v5" />
    </svg>
  ),
  'pasar-daerah': () => (
    <svg {...base}>
      <path d="M2 17h20" />
      <path d="M5 17v-7M19 17v-7" />
      <path d="M5 10c3 5 11 5 14 0" />
      <path d="M9 17v-3.5M12 17v-3M15 17v-3.5" />
    </svg>
  ),
}
