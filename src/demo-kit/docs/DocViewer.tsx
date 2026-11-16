/**
 * DocViewer — a sample document on a stage with zoom/pan, OCR boxes that appear one by one (numbered, matching
 * ExtractPanel rows), keyboard box navigation, an optional tamper heatmap and the "luruskan" (deskew) animation
 * that straightens a skewed scan with GSAP (rotation / skew / scale / 3D tilt, ≤ 900 ms).
 *
 * Keyboard: stage focused → + / − / 0 zoom, arrows pan (when zoomed); boxes → ←/→/↑/↓ previous / next, Home/End,
 * Esc back to the stage. Ctrl/⌘ + wheel zooms at the pointer; drag pans when zoomed; two-finger pinch zooms.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type PointerEvent as RPointerEvent } from 'react'
import { gsap } from 'gsap'
import type { Extracted, ExtractedField } from '../ai/types'
import { DEMO, EASE } from '../../lib/motion'
import { useI18n } from '../../lib/i18n'
import { IconButton } from '../ui/Button'
import { motionMode } from '../ui/motion'
import { DocArt } from './DocArt'
import { pct } from './measure'
import { noiseUrl } from './noise'
import { TamperHeatmap } from './TamperHeatmap'
import type { SampleDoc } from './types'
import './docs.css'

/** DocViewer constants (seconds unless named otherwise). */
export const DOCS = {
  /** "luruskan" straighten animation (≤ 0.9 s, spec §8.3 wow band) */
  deskew: 0.9,
  /** delay between two OCR boxes */
  boxStagger: 0.11,
  /** all boxes visible within this, whatever their count */
  revealMax: 2.2,
  zoomMin: 1,
  zoomMax: 4,
  /** factor per +/− press */
  zoomStep: 1.4,
  /** pan per arrow press (px) */
  panStep: 60,
  /** noise / shading left after straightening (fraction) */
  cleanNoise: 0.35,
  /** perspective for the 3D scan tilt (px) */
  perspective: 1400,
  /** on-screen box height (px) from which its numbered marker is always shown */
  markerMinPx: 15,
  /** confidence under this → amber box */
  lowConfidence: 0.85,
} as const

export interface DocViewerBox {
  key: string
  label: { id: string; en: string }
  value: string
  confidence?: number
  /** % of the page */
  box: { x: number; y: number; w: number; h: number }
}

export interface DocViewerProps {
  doc: SampleDoc
  /** OCR boxes (Extracted.fields or custom); default: the document's ground-truth fields without confidence */
  boxes?: ExtractedField[] | DocViewerBox[]
  /** true → reveal all boxes one by one; a number → show the first n (controlled); false → none */
  revealBoxes: boolean | number
  /** change this value (e.g. a counter) to replay the reveal while revealBoxes stays true */
  replay?: number | string
  /** called each time a box appears (count, total) */
  onReveal?: (count: number, total: number) => void
  /** heatmap cells + layer opacity; null/undefined → no heatmap */
  tamper?: { cells: NonNullable<Extracted['tamper']>; opacity: number } | null
  /** straighten the scan (only for docs with `scan`); false → shows the raw scan */
  deskew?: boolean
  /** highlighted box (e.g. hovered row in ExtractPanel) */
  activeKey?: string | null
  onBoxFocus?: (key: string | null) => void
  /** accessible name of the viewer */
  label?: string
  /** overlay in page coordinates (disposition stamp …) */
  children?: ReactNode
  /** extra toolbar controls (right side) */
  toolbar?: ReactNode
  /** stage height (CSS length), default clamp(320px, 62vh, 620px) */
  height?: string
  className?: string
}

const S = {
  id: { viewer: 'Penampil dokumen', zoomIn: 'Perbesar', zoomOut: 'Perkecil', fit: 'Pas layar', boxes: 'Kotak teks terbaca (OCR)', conf: 'keyakinan', hint: 'Ctrl + gulir untuk zoom · seret untuk geser' },
  en: { viewer: 'Document viewer', zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit to screen', boxes: 'Recognised text boxes (OCR)', conf: 'confidence', hint: 'Ctrl + scroll to zoom · drag to pan' },
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export function DocViewer({ doc, boxes, revealBoxes, replay, onReveal, tamper, deskew = false, activeKey, onBoxFocus, label, children, toolbar, height, className }: DocViewerProps) {
  const { lang } = useI18n()
  const s = S[lang]
  const stageRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const noiseRef = useRef<HTMLDivElement>(null)
  const boxRefs = useRef<(HTMLButtonElement | null)[]>([])
  const view = useRef({ z: 1, x: 0, y: 0 })
  const [zoomPct, setZoomPct] = useState(100)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [focusIdx, setFocusIdx] = useState(0)
  const [hoverKey, setHoverKey] = useState<string | null>(null)

  const list: DocViewerBox[] = useMemo(
    () => (boxes as DocViewerBox[] | undefined)?.filter((b) => !!b.box) ?? doc.fields.map((f) => ({ key: f.key, label: f.label, value: f.value, box: pct(f.box, doc.w, doc.h) })),
    [boxes, doc],
  )
  const total = list.length

  /* ---------------------------------------------------------------- stage size → page fit */
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const pad = stage.w < 520 ? 12 : 28
  const aspect = doc.w / doc.h
  const pageW = Math.max(0, Math.min(stage.w - pad * 2, (stage.h - pad * 2) * aspect))
  const pageH = pageW / aspect

  /* ---------------------------------------------------------------- zoom / pan */
  const apply = useCallback((animate: boolean) => {
    const el = zoomRef.current
    if (!el) return
    const v = view.current
    if (animate && motionMode() === 'full') gsap.to(el, { x: v.x, y: v.y, scale: v.z, duration: DEMO.press, ease: EASE.out, overwrite: true })
    else gsap.set(el, { x: v.x, y: v.y, scale: v.z })
    setZoomPct(Math.round(v.z * 100))
  }, [])

  const clampPan = useCallback(() => {
    const v = view.current
    const st = stageRef.current
    if (!st) return
    const w = st.clientWidth
    const h = st.clientHeight
    v.x = clamp(v.x, w * (1 - v.z), 0)
    v.y = clamp(v.y, h * (1 - v.z), 0)
  }, [])

  const zoomAt = useCallback(
    (z1: number, sx?: number, sy?: number, animate = true) => {
      const st = stageRef.current
      if (!st) return
      const v = view.current
      const z = clamp(z1, DOCS.zoomMin, DOCS.zoomMax)
      const px = sx ?? st.clientWidth / 2
      const py = sy ?? st.clientHeight / 2
      const cx = (px - v.x) / v.z
      const cy = (py - v.y) / v.z
      v.z = z
      v.x = px - cx * z
      v.y = py - cy * z
      clampPan()
      apply(animate)
    },
    [apply, clampPan],
  )
  const fit = useCallback(() => {
    view.current = { z: 1, x: 0, y: 0 }
    apply(true)
  }, [apply])

  // reset the view when the document changes
  useEffect(() => {
    view.current = { z: 1, x: 0, y: 0 }
    apply(false)
  }, [doc.id, apply])

  // ctrl/⌘ + wheel zoom (non-passive so the page does not zoom)
  useEffect(() => {
    const st = stageRef.current
    if (!st) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = st.getBoundingClientRect()
      zoomAt(view.current.z * Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top, false)
    }
    st.addEventListener('wheel', onWheel, { passive: false })
    return () => st.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // drag-pan + pinch
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('.dk-doc-box')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.current.z }
    }
    if (view.current.z > 1 || pointers.current.size === 2) e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }]
      const r = e.currentTarget.getBoundingClientRect()
      zoomAt(pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, false)
      return
    }
    if (view.current.z <= 1) return
    view.current.x += e.clientX - prev.x
    view.current.y += e.clientY - prev.y
    clampPan()
    apply(false)
  }
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const v = view.current
    if (e.key === '+' || e.key === '=') zoomAt(v.z * DOCS.zoomStep)
    else if (e.key === '-' || e.key === '_') zoomAt(v.z / DOCS.zoomStep)
    else if (e.key === '0') fit()
    else if (v.z > 1 && e.key.startsWith('Arrow')) {
      if (e.key === 'ArrowLeft') v.x += DOCS.panStep
      if (e.key === 'ArrowRight') v.x -= DOCS.panStep
      if (e.key === 'ArrowUp') v.y += DOCS.panStep
      if (e.key === 'ArrowDown') v.y -= DOCS.panStep
      clampPan()
      apply(true)
    } else return
    e.preventDefault()
  }

  /* ---------------------------------------------------------------- scan look + deskew */
  const scan = doc.scan
  const wasDeskewed = useRef<{ id: string; on: boolean }>({ id: '', on: false })
  useLayoutEffect(() => {
    const page = pageRef.current
    const noise = noiseRef.current
    if (!page) return
    const raw = scan
      ? { rotation: scan.rotate, skewX: scan.skewX ?? 0, rotationX: scan.rotX ?? 0, rotationY: scan.rotY ?? 0, scale: scan.scale ?? 1 }
      : { rotation: 0, skewX: 0, rotationX: 0, rotationY: 0, scale: 1 }
    const flat = { rotation: 0, skewX: 0, rotationX: 0, rotationY: 0, scale: 1 }
    const noiseRaw = scan?.noise ?? 0
    const target = deskew ? flat : raw
    const noiseTarget = deskew ? noiseRaw * DOCS.cleanNoise : noiseRaw
    gsap.killTweensOf(page)
    if (noise) gsap.killTweensOf(noise)
    const mode = motionMode()
    const prev = wasDeskewed.current
    const already = prev.id === doc.id && prev.on
    wasDeskewed.current = { id: doc.id, on: deskew }
    if (!deskew || !scan || mode === 'static' || already) {
      gsap.set(page, { ...target, transformPerspective: DOCS.perspective })
      if (noise) gsap.set(noise, { opacity: noiseTarget })
      return
    }
    if (mode === 'reduced') {
      gsap.set(page, { ...target, transformPerspective: DOCS.perspective })
      gsap.fromTo(page, { opacity: 0.4 }, { opacity: 1, duration: DEMO.reducedFade })
      if (noise) gsap.set(noise, { opacity: noiseTarget })
      return
    }
    gsap.set(page, { ...raw, transformPerspective: DOCS.perspective })
    if (noise) gsap.set(noise, { opacity: noiseRaw })
    const tl = gsap.timeline()
    tl.to(page, { ...target, transformPerspective: DOCS.perspective, duration: DOCS.deskew, ease: EASE.reveal }, 0)
    if (noise) tl.to(noise, { opacity: noiseTarget, duration: DOCS.deskew * 0.8, ease: 'power1.out' }, 0.1)
    return () => {
      tl.kill()
    }
  }, [deskew, scan, doc.id])

  /* ---------------------------------------------------------------- box reveal */
  const controlled = typeof revealBoxes === 'number'
  const [shown, setShown] = useState(() => (controlled ? (revealBoxes as number) : 0))
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal
  useEffect(() => {
    if (typeof revealBoxes === 'number') {
      setShown(clamp(revealBoxes, 0, total))
      return
    }
    if (!revealBoxes) {
      setShown(0)
      return
    }
    if (motionMode() === 'static' || total === 0) {
      setShown(total)
      onRevealRef.current?.(total, total)
      return
    }
    setShown(0)
    const step = Math.min(DOCS.boxStagger, DOCS.revealMax / Math.max(1, total))
    const tl = gsap.timeline()
    for (let i = 1; i <= total; i++) {
      tl.call(
        () => {
          setShown(i)
          onRevealRef.current?.(i, total)
        },
        [],
        i * step,
      )
    }
    return () => {
      tl.kill()
    }
  }, [revealBoxes, total, doc.id, replay])

  /* ---------------------------------------------------------------- box keyboard */
  const visible = list.slice(0, shown)
  const focusBox = (i: number) => {
    const n = visible.length
    if (!n) return
    const j = (i + n) % n
    setFocusIdx(j)
    boxRefs.current[j]?.focus()
  }
  const onBoxKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') focusBox(i + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') focusBox(i - 1)
    else if (e.key === 'Home') focusBox(0)
    else if (e.key === 'End') focusBox(visible.length - 1)
    else if (e.key === 'Escape') {
      stageRef.current?.focus()
      onBoxFocus?.(null)
    } else return
    e.preventDefault()
  }
  const onBoxFocusIn = (i: number, b: DocViewerBox) => {
    setFocusIdx(i)
    onBoxFocus?.(b.key)
    // keep the box in view when zoomed
    const v = view.current
    const st = stageRef.current
    if (v.z > 1 && st) {
      const left = (st.clientWidth - pageW) / 2 + ((b.box.x + b.box.w / 2) / 100) * pageW
      const top = (st.clientHeight - pageH) / 2 + ((b.box.y + b.box.h / 2) / 100) * pageH
      v.x = st.clientWidth / 2 - left * v.z
      v.y = st.clientHeight / 2 - top * v.z
      clampPan()
      apply(true)
    }
  }

  const active = activeKey ?? hoverKey
  // never taller than the page needs at full width (landscape cards on phones)
  const fitH = stage.w ? Math.round((stage.w - pad * 2) / aspect + pad * 2) : 0
  const stageStyle = { ...(height ? { '--dk-doc-h': height } : {}), ...(fitH ? { '--dk-doc-fit': `${fitH}px` } : {}) } as CSSProperties
  const noiseBg = scan && scan.noise > 0 ? noiseUrl() : ''

  return (
    <section className={`dk-doc${className ? ` ${className}` : ''}`} aria-label={label ?? `${s.viewer}: ${doc.title[lang]}`}>
      <div className="dk-doc-bar">
        <div className="dk-doc-zoomctl" role="group" aria-label="Zoom">
          <IconButton icon="minus" label={s.zoomOut} size="sm" onClick={() => zoomAt(view.current.z / DOCS.zoomStep)} disabled={zoomPct <= 100} />
          <button type="button" className="dk-doc-zoomval dk-num" onClick={fit} title={s.fit} aria-label={`${s.fit} (${zoomPct}%)`}>
            {zoomPct}%
          </button>
          <IconButton icon="plus" label={s.zoomIn} size="sm" onClick={() => zoomAt(view.current.z * DOCS.zoomStep)} disabled={zoomPct >= DOCS.zoomMax * 100} />
        </div>
        <span className="dk-doc-hint">{s.hint}</span>
        {toolbar && <div className="dk-doc-tools">{toolbar}</div>}
      </div>
      <div
        ref={stageRef}
        className={`dk-doc-stage${zoomPct > 100 ? ' is-zoomed' : ''}`}
        style={stageStyle}
        tabIndex={0}
        role="group"
        aria-roledescription={lang === 'id' ? 'kanvas dokumen' : 'document canvas'}
        aria-label={`${doc.title[lang]} · ${zoomPct}%`}
        onKeyDown={onStageKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={zoomRef} className="dk-doc-zoom">
          <div ref={pageRef} className={`dk-doc-page is-${doc.bg}`} style={{ width: pageW, height: pageH }}>
            <DocArt doc={doc} label={doc.title[lang]} className="dk-doc-art" />
            {scan && (
              <>
                {scan.shade ? <div className="dk-doc-shade" style={{ opacity: scan.shade }} aria-hidden="true" /> : null}
                {noiseBg && <div ref={noiseRef} className="dk-doc-noise" style={{ backgroundImage: noiseBg }} aria-hidden="true" />}
              </>
            )}
            {tamper && <TamperHeatmap cells={tamper.cells} opacity={tamper.opacity} />}
            <div className="dk-doc-boxes" role="group" aria-label={s.boxes}>
              {list.map((b, i) => {
                const isIn = i < shown
                const low = b.confidence !== undefined && b.confidence < DOCS.lowConfidence
                // numbered markers only where they do not pile up (box ≥ markerMinPx tall on screen) or on the active box
                const roomy = (pageH * (zoomPct / 100) * b.box.h) / 100 >= DOCS.markerMinPx
                return (
                  <button
                    key={b.key}
                    ref={(el) => {
                      boxRefs.current[i] = el
                    }}
                    type="button"
                    className={`dk-doc-box${isIn ? ' is-in' : ''}${low ? ' is-low' : ''}${roomy ? ' is-roomy' : ''}${active === b.key ? ' is-active' : ''}`}
                    style={{ left: `${b.box.x}%`, top: `${b.box.y}%`, width: `${b.box.w}%`, height: `${b.box.h}%` }}
                    tabIndex={isIn && i === Math.min(focusIdx, shown - 1) ? 0 : -1}
                    aria-hidden={!isIn}
                    aria-pressed={active === b.key}
                    aria-label={`${i + 1}. ${b.label[lang]}: ${b.value}${b.confidence !== undefined ? `, ${s.conf} ${Math.round(b.confidence * 100)}%` : ''}`}
                    onKeyDown={(e) => onBoxKey(e, i)}
                    onFocus={() => onBoxFocusIn(i, b)}
                    onBlur={() => onBoxFocus?.(null)}
                    onPointerEnter={() => setHoverKey(b.key)}
                    onPointerLeave={() => setHoverKey(null)}
                    onClick={() => onBoxFocus?.(b.key)}
                  >
                    <span className="dk-doc-mark dk-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    {b.confidence !== undefined && (
                      <span className="dk-doc-conf dk-num" aria-hidden="true">
                        {Math.round(b.confidence * 100)}%
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {children && <div className="dk-doc-over">{children}</div>}
          </div>
        </div>
      </div>
    </section>
  )
}
