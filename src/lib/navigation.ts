/**
 * navigation.ts — "go to scene N". The master timeline registers the scroll
 * position of every scene label; UI calls scrollToScene().
 */
import { gsap } from 'gsap'
import { DUR, EASE } from './motion'
import { scrollToY } from './smoothScroll'

let positions: number[] = []

export function registerScenePositions(p: number[]): void {
  positions = p
}

export function scenePosition(index: number): number | undefined {
  return positions[index]
}

export function scrollToScene(index: number, duration: number = DUR.scrollToScene): void {
  const y = positions[index]
  if (y === undefined) return
  const ease = gsap.parseEase(EASE.scrollTo) ?? ((t: number) => t)
  scrollToY(y, duration, ease)
}

/* ------------------------------------------------------------------ in-page anchors (site pages) */

/** Top offset for anchors: the element's scroll-margin-top (set in site.css to clear the navbar). */
function anchorOffset(el: HTMLElement): number {
  const m = parseFloat(getComputedStyle(el).scrollMarginTop)
  return Number.isFinite(m) ? m : 0
}

/** Absolute document Y that puts `el` just under the navbar. */
export function anchorY(el: HTMLElement): number {
  return el.getBoundingClientRect().top + window.scrollY - anchorOffset(el)
}

/**
 * Scroll to an element (smooth through Lenis / the native fallback, or an instant jump).
 * `onDone` runs when the scroll has landed.
 */
export function scrollToElement(el: HTMLElement, smooth: boolean, onDone?: () => void): void {
  const y = Math.max(0, anchorY(el))
  const ease = gsap.parseEase(EASE.scrollTo) ?? ((t: number) => t)
  if (!smooth) {
    scrollToY(y, 0, ease)
    onDone?.()
    return
  }
  const dist = Math.abs(window.scrollY - y)
  // shorter hops feel snappier; long jumps cap at the scene duration
  const duration = Math.min(DUR.scrollToScene, 0.6 + dist / 2400)
  scrollToY(y, duration, ease)
  window.setTimeout(() => onDone?.(), duration * 1000 + 40)
}

/** Find an element by URL hash ("#web"), tolerant of encoded ids. */
export function elementForHash(hash: string): HTMLElement | null {
  if (!hash || hash.length < 2) return null
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)))
  } catch {
    return null
  }
}
