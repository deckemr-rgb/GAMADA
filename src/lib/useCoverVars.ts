/**
 * useCoverVars — writes --s / --ox / --oy on an element so trimmed layer images can be placed in
 * canvas coordinates with pure CSS (no React re-render on resize). Mirrors computeFrame().
 */
import { useLayoutEffect, type RefObject } from 'react'
import { computeFrame, layerBoxSize } from './frame'

const MOBILE_MQ = '(max-width: 768px)'

export function useCoverVars(ref: RefObject<HTMLElement | null>, focusX: number, focusXMobile: number): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const mq = window.matchMedia(MOBILE_MQ)
    const update = () => {
      const box = layerBoxSize(el.clientWidth || window.innerWidth, el.clientHeight || window.innerHeight)
      const m = computeFrame(box.w, box.h, mq.matches ? focusXMobile : focusX)
      el.style.setProperty('--s', m.s.toFixed(5))
      el.style.setProperty('--ox', `${m.ox.toFixed(2)}px`)
      el.style.setProperty('--oy', `${m.oy.toFixed(2)}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    mq.addEventListener('change', update)
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [ref, focusX, focusXMobile])
}
