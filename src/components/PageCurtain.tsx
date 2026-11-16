/**
 * PageCurtain — dusk mist that rises over the old page and lifts off the new one.
 * One fixed element (140vh tall, feathered top and bottom by a gradient) moved with transform
 * only: below the viewport → covering → above the viewport. cover + reveal ≤ 0.7 s.
 * Flag `pageCurtain` off or reduced motion → nothing is registered and pages swap instantly.
 */
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { EASE, SITE_MOTION, isEnabled } from '../lib/motion'
import { registerCurtain } from '../lib/pageTransition'

const C = SITE_MOTION.curtain
/** Feather above and below the opaque core, as a fraction of the viewport height (matches site.css). */
const FEATHER = 0.2

type State = 'idle' | 'covering' | 'covered' | 'revealing'

export default function PageCurtain() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !isEnabled('pageCurtain')) return
    let state: State = 'idle'
    let tween: gsap.core.Tween | null = null
    let safety = 0
    let t0 = 0
    const below = () => window.innerHeight * (1 + FEATHER)
    const above = () => -window.innerHeight * (1 + FEATHER)
    gsap.set(el, { y: below(), autoAlpha: 0 })

    const reveal = () => {
      window.clearTimeout(safety)
      if (state === 'idle' || state === 'revealing') return
      state = 'revealing'
      tween?.kill()
      // whatever route work happened between cover and reveal comes out of the reveal time
      const left = (C.budgetMs - (performance.now() - t0)) / 1000
      tween = gsap.to(el, {
        y: above(),
        duration: Math.min(C.reveal, Math.max(C.minReveal, left)),
        ease: EASE.inOut,
        onComplete: () => {
          gsap.set(el, { y: below(), autoAlpha: 0 })
          el.dataset.active = 'false'
          state = 'idle'
          pending = null
        },
      })
    }

    let pending: Promise<void> | null = null
    const cover = () => {
      // a second click while the mist is rising / down joins the transition already running
      if ((state === 'covering' || state === 'covered') && pending) return pending
      window.clearTimeout(safety)
      pending = new Promise<void>((resolve) => {
        tween?.kill()
        t0 = performance.now()
        state = 'covering'
        el.dataset.active = 'true'
        tween = gsap.fromTo(
          el,
          { y: below(), autoAlpha: 1 },
          {
            y: 0,
            duration: C.cover,
            ease: EASE.inOut,
            onComplete: () => {
              state = 'covered'
              resolve()
            },
          },
        )
        // never leave the page hidden (lazy chunk failed, navigation cancelled …)
        safety = window.setTimeout(reveal, C.maxHoldMs)
      })
      return pending
    }

    const unregister = registerCurtain({ cover, reveal })
    return () => {
      unregister()
      window.clearTimeout(safety)
      tween?.kill()
    }
  }, [])

  return (
    <div ref={ref} className="page-curtain" data-active="false" aria-hidden="true">
      <div className="page-curtain-core">
        <svg className="page-curtain-mark" viewBox="0 0 32 32">
          <circle cx="21" cy="11" r="4.2" fill="var(--c-peach-soft)" />
          <path d="M2 27 L12 12 L17 19 L21 14 L30 27 Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  )
}
