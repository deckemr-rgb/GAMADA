/**
 * LearnMore — "—— Selengkapnya" text link: a 28px rule that grows to 64px on hover/focus
 * while the label nudges right. In-page anchors scroll smoothly through Lenis when possible,
 * then focus moves to the target so keyboard / screen-reader users land where they scrolled.
 */
import type { CSSProperties, MouseEvent } from 'react'
import { gsap } from 'gsap'
import { DUR, EASE } from '../lib/motion'
import { getLenis } from '../lib/smoothScroll'
import AppLink from './AppLink'
import '../styles/ui.css'

function focusTarget(el: HTMLElement): void {
  if (!el.hasAttribute('tabindex')) el.tabIndex = -1
  el.focus({ preventScroll: true })
}

/**
 * Scroll to an in-page anchor (`#id`): Lenis when it is running, a native jump otherwise.
 * When `focus` is true the target receives focus once the scroll has landed.
 * Returns false (and leaves the click alone) when href is not an in-page anchor.
 */
export function goToAnchor(href: string, e?: MouseEvent<HTMLAnchorElement>, focus = true): boolean {
  if (!href.startsWith('#') || href.length < 2) return false
  const target = document.getElementById(href.slice(1))
  if (!target) {
    if (import.meta.env.DEV) console.warn(`[gamada] anchor target "${href}" does not exist`)
    return false
  }
  e?.preventDefault()
  const lenis = getLenis()
  if (lenis) {
    lenis.scrollTo(target, {
      duration: DUR.scrollToScene,
      easing: gsap.parseEase(EASE.scrollTo) ?? undefined,
      onComplete: () => {
        if (focus) focusTarget(target)
      },
    })
  } else {
    // smooth scroll off / reduced motion: plain jump
    target.scrollIntoView({ block: 'start' })
    if (focus) focusTarget(target)
  }
  return true
}

export default function LearnMore({ label, href }: { label: string; href: string }) {
  // routes ("/proses") go through AppLink (curtain transition); "#anchors" scroll in place
  if (href.startsWith('/'))
    return (
      <AppLink className="learn-more" to={href} data-cursor="hover" style={{ '--ui-hover': `${DUR.hover}s` } as CSSProperties}>
        <span className="learn-more-line" aria-hidden="true" />
        <span className="learn-more-label">{label}</span>
      </AppLink>
    )
  return (
    <a
      className="learn-more"
      href={href}
      data-cursor="hover"
      onClick={(e) => void goToAnchor(href, e)}
      style={{ '--ui-hover': `${DUR.hover}s` } as CSSProperties}
    >
      <span className="learn-more-line" aria-hidden="true" />
      <span className="learn-more-label">{label}</span>
    </a>
  )
}
