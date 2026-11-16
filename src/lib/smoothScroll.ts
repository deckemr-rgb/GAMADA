/**
 * smoothScroll.ts — Lenis driven by the GSAP ticker (one RAF loop for everything),
 * bridged to ScrollTrigger. Also keeps motionState.velocity / speed / wind fresh.
 */
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SCROLL, WIND, clamp, isEnabled, prefersReducedMotion } from './motion'
import { motionState } from './store'

gsap.registerPlugin(ScrollTrigger)

let lenis: Lenis | null = null
let nativeLastY = 0

export function getLenis(): Lenis | null {
  return lenis
}

function updateSpeed(): void {
  const target = clamp(Math.abs(motionState.velocity) / WIND.velocityNorm)
  motionState.speed += (target - motionState.speed) * 0.15
  motionState.wind += (target - motionState.wind) * WIND.follow
  // velocity decays when no scroll events arrive (native mode)
  if (!lenis) motionState.velocity *= 0.9
}

export function initSmoothScroll(): () => void {
  const tickSpeed = () => updateSpeed()
  gsap.ticker.add(tickSpeed)

  if (isEnabled('smoothScroll')) {
    lenis = new Lenis({
      duration: SCROLL.lenisDuration,
      wheelMultiplier: SCROLL.lenisWheelMultiplier,
      touchMultiplier: SCROLL.lenisTouchMultiplier,
      smoothWheel: true,
    })
    const l = lenis
    l.on('scroll', () => {
      motionState.velocity = l.velocity
      ScrollTrigger.update()
    })
    const raf = (time: number) => l.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(raf)
      gsap.ticker.remove(tickSpeed)
      l.destroy()
      lenis = null
    }
  }

  nativeLastY = window.scrollY
  const onScroll = () => {
    const y = window.scrollY
    motionState.velocity = y - nativeLastY
    nativeLastY = y
  }
  const onScrollEnd = () => {
    motionState.velocity = 0
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('scrollend', onScrollEnd)
  return () => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('scrollend', onScrollEnd)
    gsap.ticker.remove(tickSpeed)
  }
}

/** Scroll to an absolute position (px) with Lenis when available. */
export function scrollToY(y: number, duration: number, ease: (t: number) => number): void {
  if (lenis) lenis.scrollTo(y, { duration, easing: ease })
  else if (duration <= 0 || prefersReducedMotion()) window.scrollTo({ top: y, behavior: 'auto' })
  else {
    // native scroll: still honour the custom duration + ease from motion.ts
    const proxy = { y: window.scrollY }
    gsap.to(proxy, { y, duration, ease, overwrite: true, onUpdate: () => window.scrollTo(0, proxy.y) })
  }
}
