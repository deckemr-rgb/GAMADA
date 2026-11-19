/**
 * Ticker — pure-props running price strip (`priceTicker`: the 12 largest |7-day Δ|). One gsap.ticker listener moves the
 * track (transform only) while it is on screen, the tab is visible, nothing hovers / focuses it and the visitor did not
 * pause it; reduced motion / static ⇒ a plain scrollable list, no listener. Cells carry `data-sp-pair` (flash hook).
 */
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { IconButton, motionMode, useInView, usePageVisible } from '../../demo-kit/ui'

export interface TickerItem { id: string; item: string; market: string; price: string; week: string; up: boolean; anomaly: boolean }
export interface TickerProps {
  items: TickerItem[]
  label: string
  pauseLabel: string
  playLabel: string
  /** the latest tick line under the strip */
  latest?: string | null
  latestLabel?: string
}

export function Ticker({ items, label, pauseLabel, playLabel, latest, latestLabel }: TickerProps) {
  const box = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLUListElement>(null)
  const [paused, setPaused] = useState(false)
  const [hold, setHold] = useState(false)
  const inView = useInView(box, { once: false, threshold: 0 })
  const visible = usePageVisible()
  const moving = motionMode() === 'full'
  const run = moving && !paused && !hold && inView && visible && items.length > 0

  useEffect(() => {
    const el = track.current
    if (!run || !el) return
    let x = Number(el.dataset.x ?? 0)
    const tick = (_t: number, dt: number) => {
      const half = el.scrollWidth / 2
      if (half <= 0) return
      x -= (dt / 1000) * 38
      if (x <= -half) x += half
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`
      el.dataset.x = String(x)
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [run])

  const cells = (dup: boolean) =>
    items.map((r) => (
      <li key={(dup ? 'b' : 'a') + r.id} className={`dk-sp-tick${r.anomaly ? ' is-anom' : ''}`} data-sp-pair={r.id} aria-hidden={dup || undefined}>
        <span className="dk-sp-tick-item">{r.item}</span>
        <span className="dk-sp-tick-mkt">{r.market}</span>
        <span className="dk-sp-tick-price dk-num">{r.price}</span>
        <span className={`dk-sp-tick-w dk-num ${r.up ? 'is-up' : 'is-down'}`}>{r.week}</span>
      </li>
    ))

  return (
    <div className="dk-sp-ticker" data-tour="sp-ticker">
      <div
        ref={box}
        className={`dk-sp-ticker-box${moving ? '' : ' is-static'}`}
        role="region"
        aria-label={label}
        onPointerEnter={() => setHold(true)}
        onPointerLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
      >
        <ul ref={track} className="dk-sp-ticker-track">
          {cells(false)}
          {moving && cells(true)}
        </ul>
      </div>
      {moving && (
        <IconButton className="dk-sp-ticker-btn" icon={paused ? 'play' : 'pause'} label={paused ? playLabel : pauseLabel} aria-pressed={paused} onClick={() => setPaused((p) => !p)} />
      )}
      {latest && (
        <p className="dk-sp-latest" data-sp="latest">
          <span className="dk-sp-latest-dot" aria-hidden="true" />
          <span className="dk-sp-latest-k">{latestLabel}</span> {latest}
        </p>
      )}
    </div>
  )
}
