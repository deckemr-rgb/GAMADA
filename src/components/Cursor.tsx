/**
 * Cursor — desktop-only custom cursor: a 10px white dot (mix-blend difference) that follows
 * motionState.pointer through quickTo on the shared gsap ticker and grows to ~56px over
 * links, buttons and [data-cursor="hover"]. The native cursor is hidden (html class) only
 * while this is mounted; form fields (input / textarea / select / contenteditable) always keep
 * the native cursor (ui.css) and the dot hides over them. will-change is set only while visible.
 */
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { EASE, UI, isEnabled, isTouchDevice } from '../lib/motion'
import { motionState } from '../lib/store'
import '../styles/ui.css'

const CURSOR = UI.cursor
const HOVER_SEL = 'a, button, [role="button"], label, [data-cursor="hover"]'
/** Keep in sync with the native-cursor rules in ui.css. */
const NATIVE_SEL = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

export default function Cursor() {
  const [enabled] = useState(() => isEnabled('customCursor') && !isTouchDevice())
  const rootRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const dot = dotRef.current
    if (!enabled || !root || !dot) return
    const html = document.documentElement
    html.classList.add('has-custom-cursor')

    const xTo = gsap.quickTo(root, 'x', { duration: CURSOR.follow, ease: EASE.pointer })
    const yTo = gsap.quickTo(root, 'y', { duration: CURSOR.follow, ease: EASE.pointer })
    let visible = false
    let lastX = NaN
    let lastY = NaN
    let hovering = false
    let overNative = false

    const show = (v: boolean) => {
      if (v === visible) return
      visible = v
      if (v) root.style.willChange = 'transform'
      gsap.to(root, {
        opacity: v ? 1 : 0,
        duration: CURSOR.fade,
        overwrite: 'auto',
        onComplete: () => {
          if (!visible) root.style.willChange = ''
        },
      })
    }

    // own fallback listener: pointer.ts starts after fonts.ready, the cursor should work before that
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      motionState.pointer.px = e.clientX
      motionState.pointer.py = e.clientY
    }
    const tick = () => {
      const { px, py } = motionState.pointer
      if (px < -1000 || py < -1000) {
        show(false)
        return
      }
      if (px === lastX && py === lastY) return
      if (Number.isNaN(lastX)) gsap.set(root, { x: px, y: py }) // first sample: no fly-in from 0,0
      lastX = px
      lastY = py
      xTo(px)
      yTo(py)
      show(!overNative)
    }

    const onOver = (e: PointerEvent) => {
      const t = e.target instanceof Element ? e.target : null
      const native = !!t?.closest(NATIVE_SEL)
      if (native !== overNative) {
        overNative = native
        show(!native && lastX > -1000)
      }
      const h = !native && !!t?.closest(HOVER_SEL)
      if (h === hovering) return
      hovering = h
      gsap.to(dot, { scale: h ? CURSOR.hoverScale : CURSOR.restScale, duration: CURSOR.grow, ease: EASE.pointer, overwrite: 'auto' })
    }
    const onLeave = () => show(false)
    const onDown = () =>
      gsap.to(dot, { scale: (hovering ? CURSOR.hoverScale : CURSOR.restScale) * CURSOR.pressScale, duration: CURSOR.press })
    const onUp = () =>
      gsap.to(dot, { scale: hovering ? CURSOR.hoverScale : CURSOR.restScale, duration: CURSOR.grow, ease: EASE.pointer })

    gsap.set(dot, { scale: CURSOR.restScale })
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerover', onOver, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerover', onOver)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      gsap.killTweensOf([root, dot])
      root.style.willChange = ''
      html.classList.remove('has-custom-cursor')
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <div ref={rootRef} className="cursor" aria-hidden="true">
      <span ref={dotRef} className="cursor-dot" />
    </div>
  )
}
