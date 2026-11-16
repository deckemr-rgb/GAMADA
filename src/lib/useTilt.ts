/**
 * useTilt — card hover: 3D tilt (max SITE_REVEAL.tiltMax°) + a radial spotlight that follows the
 * cursor. Both are transform-only: the card rotates (quickTo on the shared ticker) and the spotlight
 * is a child element (`[data-spotlight]`) translated under the pointer and faded by opacity.
 * Mouse only; flag `cardTilt` (off under reduced motion). The card's rect is measured on enter.
 */
import { useEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { EASE, SITE_REVEAL as R, isEnabled, isTouchDevice } from './motion'

export function useTilt(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled || !isEnabled('cardTilt') || isTouchDevice()) return
    const spot = el.querySelector<HTMLElement>('[data-spotlight]')
    gsap.set(el, { transformPerspective: R.tiltPerspective })
    const rx = gsap.quickTo(el, 'rotationX', { duration: R.tiltFollow, ease: EASE.pointer })
    const ry = gsap.quickTo(el, 'rotationY', { duration: R.tiltFollow, ease: EASE.pointer })
    const sx = spot ? gsap.quickSetter(spot, 'x', 'px') : null
    const sy = spot ? gsap.quickSetter(spot, 'y', 'px') : null
    let rect: DOMRect | null = null

    const enter = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      rect = el.getBoundingClientRect()
      // reveal tweens may have cleared the transform (clearProps) → restore the perspective
      gsap.set(el, { transformPerspective: R.tiltPerspective })
      el.style.willChange = 'transform'
      if (spot) gsap.to(spot, { opacity: 1, duration: 0.3, overwrite: 'auto' })
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = rect ?? (rect = el.getBoundingClientRect())
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      ry((px - 0.5) * 2 * R.tiltMax)
      rx(-(py - 0.5) * 2 * R.tiltMax)
      sx?.(e.clientX - r.left)
      sy?.(e.clientY - r.top)
    }
    const leave = () => {
      rect = null
      rx(0)
      ry(0)
      if (spot) gsap.to(spot, { opacity: 0, duration: 0.4, overwrite: 'auto' })
      window.setTimeout(() => {
        if (!rect) el.style.willChange = ''
      }, R.tiltFollow * 1000 + 50)
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      gsap.killTweensOf(el)
      gsap.set(el, { clearProps: 'transform,willChange' })
    }
  }, [ref, enabled])
}
