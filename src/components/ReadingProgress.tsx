/**
 * ReadingProgress — thin bar at the very top on every page except the home (where the scene
 * rail does this job). scaleX only; scroll read in a passive listener, written on the shared gsap
 * ticker only when the scroll position or the page height changed (height cached via ResizeObserver).
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
    let y = window.scrollY
    let dirty = true
    const measure = () => {
      max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      dirty = true
    }
    // scroll position is read in a passive listener (no forced layout inside the ticker);
    // the ticker only writes, and only when something changed.
    const onScroll = () => {
      y = window.scrollY
      dirty = true
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', onScroll, { passive: true })
    const tick = () => {
      if (!dirty) return
      dirty = false
      setX(Math.min(1, Math.max(0, y / max)))
    }
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="reading-progress" aria-hidden="true">
      <span ref={barRef} className="reading-progress-bar" />
    </div>
  )
}
