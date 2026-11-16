/** Security card icons + the padlock (decorative, aria-hidden). */
import type { ReactElement } from 'react'

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

export const SEC_ICONS: readonly (() => ReactElement)[] = [
  // SSH key
  () => (
    <svg {...base}>
      <circle cx="8" cy="15" r="4.5" />
      <path d="M11.3 11.8 20 3.5M16.5 7l2.5 2.5M14.2 9.3l1.8 1.8" />
      <circle cx="8" cy="15" r="1.2" />
    </svg>
  ),
  // firewall
  () => (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="16" rx="1.8" />
      <path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20" />
    </svg>
  ),
  // certificate renew
  () => (
    <svg {...base}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
    </svg>
  ),
  // hardening
  () => (
    <svg {...base}>
      <rect x="3.5" y="3.5" width="17" height="6.5" rx="1.6" />
      <rect x="3.5" y="14" width="10" height="6.5" rx="1.6" />
      <circle cx="7" cy="6.75" r="0.6" fill="currentColor" />
      <circle cx="7" cy="17.25" r="0.6" fill="currentColor" />
      <path d="M11 6.75h6" />
      <path d="m16 17.5 1.8 1.8 3.2-3.6" />
    </svg>
  ),
]

/** Padlock: the shackle (`.lock-shackle`) is drawn in its locked position; JS lifts it first. */
export function Padlock() {
  return (
    <svg className="lock-svg" viewBox="0 0 96 104" aria-hidden="true" focusable="false">
      <circle className="lock-burst" cx="48" cy="66" r="40" />
      <g className="lock-shackle">
        <path d="M27 50V34a21 21 0 0 1 42 0v16" fill="none" stroke="#dcd8ff" strokeWidth="8.5" strokeLinecap="round" />
        <path d="M27 50V34a21 21 0 0 1 42 0v16" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" transform="translate(-2 0)" />
      </g>
      <g className="lock-body">
        <rect x="14" y="44" width="68" height="52" rx="12" fill="url(#lockGrad)" />
        <rect x="14" y="44" width="68" height="52" rx="12" fill="none" stroke="#ffd77e" strokeOpacity="0.55" strokeWidth="1.5" />
        <path d="M22 54h52" stroke="#fff" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
        <circle cx="48" cy="67" r="6.5" fill="#1a1638" />
        <path d="M48 70v10" stroke="#1a1638" strokeWidth="5" strokeLinecap="round" />
        <circle className="lock-key" cx="48" cy="67" r="3" fill="#3fe0c0" />
      </g>
      <defs>
        <linearGradient id="lockGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc79a" />
          <stop offset="1" stopColor="#f59a62" />
        </linearGradient>
      </defs>
    </svg>
  )
}
