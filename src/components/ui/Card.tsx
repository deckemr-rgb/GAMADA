/**
 * Card — surface with the shared hover language: 3D tilt (≤ 6°), cursor spotlight and a lavender
 * glow (box-shadow on a ::after layer, faded by opacity). Render as any element (article, li, a…).
 * Give the reveal kit `[data-rv="card"]` to batch them in.
 */
import { createElement, useRef, type ReactNode } from 'react'
import { useTilt } from '../../lib/useTilt'
import '../../styles/ui-kit.css'

interface Props {
  as?: 'article' | 'li' | 'div'
  className?: string
  tilt?: boolean
  children: ReactNode
}

function TiltLayer({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="card-spot" data-spotlight aria-hidden="true" />
      {children}
    </>
  )
}

export default function Card({ as = 'article', className = '', tilt = true, children }: Props) {
  const ref = useRef<HTMLElement>(null)
  useTilt(ref, tilt)
  return createElement(as, { ref, className: `card ${className}`, 'data-rv': 'card' }, <TiltLayer>{children}</TiltLayer>)
}
