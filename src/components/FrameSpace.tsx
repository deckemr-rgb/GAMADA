/**
 * FrameSpace — a 2560 × 2304 coordinate space that sits exactly on top of the
 * image layers (same cover mapping). Children position themselves in canvas px.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CANVAS } from '../lib/assets'
import { computeFrame, type FrameMapping } from '../lib/frame'
import { FrameContext } from '../lib/frameContext'

interface Props {
  focusX: number
  focusXMobile: number
  children?: ReactNode
}

const MOBILE_MQ = '(max-width: 768px)'

export default function FrameSpace({ focusX, focusXMobile, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [mapping, setMapping] = useState<FrameMapping>({ s: 1, ox: 0, oy: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!el || !box) return
    const mq = window.matchMedia(MOBILE_MQ)
    const update = () => {
      const fx = mq.matches ? focusXMobile : focusX
      const m = computeFrame(box.clientWidth, box.clientHeight, fx)
      el.style.transform = `translate3d(${m.ox}px, ${m.oy}px, 0) scale(${m.s})`
      setMapping(m)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(box)
    mq.addEventListener('change', update)
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [focusX, focusXMobile])

  return (
    <div ref={ref} className="frame-space" style={{ width: CANVAS.w, height: CANVAS.h }}>
      <FrameContext.Provider value={mapping}>{children}</FrameContext.Provider>
    </div>
  )
}
