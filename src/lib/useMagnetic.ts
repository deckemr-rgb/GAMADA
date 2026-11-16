/**
 * useMagnetic — the magnetic pull of the hero CTAs (extracted from StartButton so every primary CTA
 * shares it). Pointer within MAGNETIC.radius × the element's half-size pulls the element (and its
 * label a bit further); elastic return on leave. Mouse only; flag `magneticButton`.
 * Rest geometry is cached and re-measured only after pointerenter / scroll / resize / scene / intro.
 */
import { useEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { DUR, EASE, MAGNETIC, UI, isEnabled, isTouchDevice } from './motion'
import { on } from './store'

interface Zone {
  cx: number
  cy: number
  zx: number
  zy: number
  live: boolean
}

export function useMagnetic(elRef: RefObject<HTMLElement | null>, labelRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const btn = elRef.current
    const text = labelRef.current
    if (!btn || !text || !isEnabled('magneticButton') || isTouchDevice()) return

    let inside = false
    let zone: Zone | null = null

    const measure = (): Zone => {
      const r = btn.getBoundingClientRect()
      const z: Zone = {
        cx: r.left + r.width / 2 - Number(gsap.getProperty(btn, 'x')),
        cy: r.top + r.height / 2 - Number(gsap.getProperty(btn, 'y')),
        zx: (r.width / 2) * MAGNETIC.radius,
        zy: (r.height / 2) * MAGNETIC.radius,
        live: r.width > 0 && getComputedStyle(btn).visibility !== 'hidden',
      }
      zone = z
      return z
    }
    const invalidate = () => {
      zone = null
    }
    const setLayer = (active: boolean) => {
      const v = active ? 'transform' : ''
      btn.style.willChange = v
      text.style.willChange = v
    }
    const release = () => {
      inside = false
      gsap.to([btn, text], {
        x: 0,
        y: 0,
        duration: DUR.magneticReturn,
        ease: UI.magnetic.returnEase,
        overwrite: 'auto',
        onComplete: () => {
          if (!inside) setLayer(false)
        },
      })
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const z = zone ?? measure()
      const dx = e.clientX - z.cx
      const dy = e.clientY - z.cy
      const within = z.live && Math.abs(dx) < z.zx && Math.abs(dy) < z.zy
      if (within) {
        if (!inside) {
          inside = true
          setLayer(true)
        }
        gsap.to(btn, { x: dx * MAGNETIC.strength, y: dy * MAGNETIC.strength, duration: UI.magnetic.follow, ease: EASE.pointer, overwrite: 'auto' })
        gsap.to(text, { x: dx * MAGNETIC.textStrength, y: dy * MAGNETIC.textStrength, duration: UI.magnetic.follow, ease: EASE.pointer, overwrite: 'auto' })
      } else if (inside) {
        release()
      }
    }
    const onLeaveWindow = () => {
      if (inside) release()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    btn.addEventListener('pointerenter', invalidate)
    window.addEventListener('scroll', invalidate, { passive: true })
    window.addEventListener('resize', invalidate)
    const offScene = on('scene', invalidate)
    const offIntro = on('intro', invalidate)
    const offResize = on('resize', invalidate)
    document.documentElement.addEventListener('pointerleave', onLeaveWindow)
    return () => {
      window.removeEventListener('pointermove', onMove)
      btn.removeEventListener('pointerenter', invalidate)
      window.removeEventListener('scroll', invalidate)
      window.removeEventListener('resize', invalidate)
      offScene()
      offIntro()
      offResize()
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow)
      gsap.killTweensOf([btn, text])
      gsap.set([btn, text], { clearProps: 'transform' })
      setLayer(false)
    }
  }, [elRef, labelRef])
}
