/**
 * flyBetween — a clone of `from` flies to `to` (journal entry → ledger, checklist tick → TenderPilot): fixed-position
 * clone, translate + scale + opacity on one write-only ticker tween (≤ 900 ms), removed when done. Reduced motion:
 * no flight, the target just fades in; ?static=1: nothing moves. Resolves when the target may update.
 */
import { DEMO } from '../../lib/motion'
import { animatePose, motionMode } from './motion'

export function flyBetween(from: Element | null, to: Element | null, opts: { duration?: number } = {}): Promise<void> {
  const mode = motionMode()
  if (!from || !to || mode === 'static' || typeof document === 'undefined') return Promise.resolve()
  if (mode === 'reduced') {
    return new Promise((done) => {
      animatePose(to, { opacity: 0.4 }, { opacity: 1 }, { duration: DEMO.reducedFade, onComplete: done })
    })
  }
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  const clone = from.cloneNode(true) as HTMLElement
  clone.setAttribute('aria-hidden', 'true')
  clone.removeAttribute('id')
  Object.assign(clone.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: '0', zIndex: '60', pointerEvents: 'none', transformOrigin: '0 0' })
  document.body.appendChild(clone)
  const scale = Math.max(0.2, Math.min(1, b.width / Math.max(1, a.width)))
  const duration = Math.min(0.9, (opts.duration ?? 700) / 1000)
  return new Promise((done) => {
    animatePose(clone, { x: 0, y: 0, scale: 1, opacity: 1 }, { x: b.left - a.left, y: b.top - a.top, scale, opacity: 0.25 }, {
      duration,
      ease: 'power2.inOut',
      clear: false,
      onComplete: () => {
        clone.remove()
        done()
      },
    })
  })
}
