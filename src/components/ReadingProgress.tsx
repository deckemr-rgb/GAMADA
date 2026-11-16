/**
 * ReadingProgress — thin bar at the very top on every page except the home (where the scene
 * rail does this job). scaleX only; updated on the shared gsap ticker and only when the scroll
 * position or the page height changed (page height cached via ResizeObserver, no per-frame layout).
 */
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

export default function ReadingProgress() {
  const barRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const setX = gsap.quickSetter(bar, 'scaleX')
    let max = 1
    let lastY = -1
    let dirty = true
    const measure = () => {
      max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      dirty = true
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    window.addEventListener('resize', measure)
    const tick = () => {
      const y = window.scrollY
      if (y === lastY && !dirty) return
      lastY = y
      dirty = false
      setX(Math.min(1, Math.max(0, y / max)))
    }
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div className="reading-progress" aria-hidden="true">
      <span ref={barRef} className="reading-progress-bar" />
    </div>
  )
}
