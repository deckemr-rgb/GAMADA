/** Ecosystem node icons (24 × 24, stroke = currentColor, decorative). */
import type { ReactElement } from 'react'

export type EcoNodeId = 'hub' | 'web' | 'app' | 'auto' | 'ai' | 'infra'

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
  hub: () => (
    <svg {...base}>
      <rect x="3" y="3" width="8" height="10" rx="1.6" />
      <rect x="13" y="3" width="8" height="6" rx="1.6" />
      <rect x="13" y="11" width="8" height="10" rx="1.6" />
      <rect x="3" y="15" width="8" height="6" rx="1.6" />
    </svg>
  ),
  web: () => (
    <svg {...base}>
      <rect x="2.5" y="4" width="19" height="16" rx="2.2" />
      <path d="M2.5 8.5h19" />
      <circle cx="5.6" cy="6.25" r="0.5" fill="currentColor" />
      <circle cx="7.8" cy="6.25" r="0.5" fill="currentColor" />
      <path d="M6.5 13h6M6.5 16h9" />
    </svg>
  ),
  app: () => (
    <svg {...base}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.4" />
      <path d="M10.5 18.5h3" />
      <path d="M9.5 5.5h5" />
    </svg>
  ),
  auto: () => (
    <svg {...base}>
      <path d="M19.5 12a7.5 7.5 0 0 1-12.9 5.2" />
      <path d="M4.5 12a7.5 7.5 0 0 1 12.9-5.2" />
      <path d="M17.6 3.2v3.6H14" />
      <path d="M6.4 20.8v-3.6H10" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  ai: () => (
    <svg {...base}>
      <path d="M11 3.5c.6 3.9 2.3 5.6 6.2 6.2-3.9.6-5.6 2.3-6.2 6.2-.6-3.9-2.3-5.6-6.2-6.2 3.9-.6 5.6-2.3 6.2-6.2Z" />
      <path d="M18 14.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3Z" />
    </svg>
  ),
  infra: () => (
    <svg {...base}>
      <rect x="3.5" y="3.5" width="17" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="17" height="7" rx="1.8" />
      <circle cx="7.2" cy="7" r="0.6" fill="currentColor" />
      <circle cx="7.2" cy="17" r="0.6" fill="currentColor" />
      <path d="M11 7h6M11 17h6" />
    </svg>
  ),
}

export function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3.5 8.4 6.6 11.4 12.5 4.8" />
    </svg>
  )
}
