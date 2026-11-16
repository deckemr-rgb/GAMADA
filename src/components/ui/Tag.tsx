/**
 * Tag — small pill. Tones: default (lavender outline) · live (teal, slow blinking dot: "Live Demo",
 * online status) · real (peach: "Proyek Asli") · ai (cyan) · mobile (plum) · danger (red: "Sold out").
 */
import type { ReactNode } from 'react'
import '../../styles/ui-kit.css'

export type TagTone = 'default' | 'live' | 'real' | 'ai' | 'mobile' | 'danger'

export default function Tag({ tone = 'default', children, className = '' }: { tone?: TagTone; children: ReactNode; className?: string }) {
  return (
    <span className={`tag tag--${tone} ${className}`} data-rv="tag">
      {tone === 'live' ? <span className="tag-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
