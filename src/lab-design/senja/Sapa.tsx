/**
 * 03 + 04 · Sapa Warga stage: inbox and phone side by side. WOW moment #1: when the chat produces
 * a ticket (or "Simulate new ticket" is pressed), a ticket card flies along a curved path from the
 * phone into the inbox (1.2 s, transform/opacity only, driven by one GSAP tween), then the row lands.
 */
import { useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { NEW_TICKET } from '../sample'
import Inbox from './Inbox'
import Phone from './Phone'
import { Icon } from './icons'
import { SJ, clamp01, motionMode, useGsapContext } from './shared'

type Pt = { x: number; y: number }
const bez = (a: Pt, b: Pt, c: Pt, t: number): Pt => {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y }
}
const TRAIL_LAGS = [0.045, 0.09, 0.135]

export default function Sapa() {
  const { lang } = useI18n()
  const mode = motionMode()
  const [newKey, setNewKey] = useState(mode === 'static' ? 1 : 0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const counter = useRef(mode === 'static' ? 1 : 0)
  const stageRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLTableSectionElement>(null)
  const flight = useRef<gsap.core.Timeline | null>(null)
  const ctx = useGsapContext(stageRef)

  const land = useCallback(() => {
    counter.current += 1
    setNewKey(counter.current)
  }, [])

  const deliver = useCallback(() => {
    if (busyRef.current) return
    const stage = stageRef.current
    const layer = layerRef.current
    const src = sourceRef.current ?? screenRef.current
    if (mode !== 'full' || !stage || !layer || !src || !targetRef.current) {
      land()
      return
    }
    // Take the old row out first so the ticket lands in an empty slot, then measure.
    flushSync(() => setNewKey(0))
    const dst = targetRef.current
    const sr = stage.getBoundingClientRect()
    const a = src.getBoundingClientRect()
    const b = dst.getBoundingClientRect()
    const p0: Pt = { x: a.left + a.width / 2 - sr.left, y: a.top + a.height / 2 - sr.top }
    const p2: Pt = { x: b.left + Math.min(150, b.width / 2) - sr.left, y: b.top + 20 - sr.top }
    // Control point: perpendicular to the chord, on the "upper" side, clamped inside the stage.
    const dx = p2.x - p0.x
    const dy = p2.y - p0.y
    const len = Math.hypot(dx, dy) || 1
    let nx = -dy / len
    let ny = dx / len
    if (ny > 0 || (Math.abs(ny) < 0.2 && nx < 0)) {
      nx = -nx
      ny = -ny
    }
    const bend = Math.min(260, len * 0.38)
    const p1: Pt = {
      x: Math.min(sr.width - 60, Math.max(60, (p0.x + p2.x) / 2 + nx * bend)),
      y: Math.max(-40, (p0.y + p2.y) / 2 + ny * bend),
    }

    busyRef.current = true
    setBusy(true)
    ctx.current?.add(() => {
      const card = layer.querySelector<HTMLElement>('.lds-flight-card')
      const dots = Array.from(layer.querySelectorAll<HTMLElement>('.lds-flight-dot'))
      if (!card) return
      const els = [card, ...dots]
      const sx = els.map((el) => gsap.quickSetter(el, 'x', 'px'))
      const sy = els.map((el) => gsap.quickSetter(el, 'y', 'px'))
      const rot = gsap.quickSetter(card, 'rotation', 'deg')
      const lags = [0, ...TRAIL_LAGS]
      const st = { t: 0 }
      gsap.set(els, { xPercent: -50, yPercent: -50, x: p0.x, y: p0.y, opacity: 0 })
      flight.current?.kill()
      flight.current = gsap
        .timeline({
          onComplete: () => {
            busyRef.current = false
            setBusy(false)
            land()
          },
        })
        .to(
          st,
          {
            t: 1,
            duration: SJ.wow,
            ease: 'power2.inOut',
            onUpdate: () => {
              lags.forEach((lag, i) => {
                const p = bez(p0, p1, p2, clamp01(st.t - lag))
                sx[i]?.(p.x)
                sy[i]?.(p.y)
              })
              const p = bez(p0, p1, p2, st.t)
              const q = bez(p0, p1, p2, Math.min(1, st.t + 0.02))
              // Bank into the turn: horizontal heading → up to ±12°, easing back to 0 at both ends.
              const heading = (q.x - p.x) / (Math.hypot(q.x - p.x, q.y - p.y) || 1)
              rot(heading * 12 * Math.sin(Math.PI * st.t))
            },
          },
          0,
        )
        .fromTo(card, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.24, ease: 'power2.out' }, 0)
        .to(card, { scale: 0.82, opacity: 0, duration: 0.2, ease: 'power2.in' }, SJ.wow - 0.18)
        .fromTo(dots, { opacity: 0 }, { opacity: (i: number) => [0.75, 0.5, 0.28][i] ?? 0.3, duration: 0.2, stagger: 0.04 }, 0.06)
        .to(dots, { opacity: 0, duration: 0.24 }, SJ.wow - 0.16)
    })
  }, [ctx, land, mode])

  const reset = useCallback(() => {
    flight.current?.kill()
    flight.current = null
    busyRef.current = false
    setBusy(false)
    if (layerRef.current) gsap.set(layerRef.current.children, { opacity: 0 })
    setNewKey(0)
  }, [])

  return (
    <div className="lds-stage" ref={stageRef}>
      <div className="lds-panel lds-stage-inbox">
        <Inbox newKey={newKey} busy={busy} onSimulate={deliver} targetRef={targetRef} />
      </div>
      <Phone sourceRef={sourceRef} screenRef={screenRef} onTicket={deliver} onReset={reset} />
      <div className="lds-flight" ref={layerRef} aria-hidden="true">
        <span className="lds-flight-dot" />
        <span className="lds-flight-dot" />
        <span className="lds-flight-dot" />
        <span className="lds-flight-card">
          <Icon name="chat" size={14} />
          <span>
            <b>{NEW_TICKET.id}</b>
            <small>{NEW_TICKET.category[lang]}</small>
          </span>
        </span>
      </div>
    </div>
  )
}
