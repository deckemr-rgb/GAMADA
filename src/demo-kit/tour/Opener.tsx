/**
 * tour/Opener.tsx — the dusk opener: the region drawn as a dot cloud of its desa centroids (from the pack, no extra
 * geometry) appearing out of a fog layer (opacity only), a clock face whose hands spin to 06:00 (rotate only),
 * "Satu Hari di {region}", "Mulai tur (±8 menit)" and "Pilih bab". Reduced motion / ?off=tourCinematics /
 * ?static=1: the final state at once.
 */
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import AppLink from '../../components/AppLink'
import { Icon } from '../ui/icons'
import { TOUR_STRINGS, fill } from './strings'
import type { Lang } from './types'

export interface RegionDots {
  name: string
  /** projected points 0..100 */
  pts: [number, number][]
}

export function Opener({ lang, region, minutes, cinematic, onStart, onPick, busy, pickRef }: { lang: Lang; region: RegionDots | null; minutes: number; cinematic: boolean; onStart: () => void; onPick: () => void; busy: boolean; pickRef: React.RefObject<HTMLButtonElement | null> }) {
  const t = TOUR_STRINGS[lang]
  const map = useRef<SVGGElement>(null)
  const fog = useRef<HTMLDivElement>(null)
  const hh = useRef<SVGLineElement>(null)
  const mm = useRef<SVGLineElement>(null)
  useEffect(() => {
    if (!cinematic) return
    const ctx = gsap.context(() => {
      if (map.current) gsap.fromTo(map.current, { opacity: 0 }, { opacity: 1, duration: 2.4, ease: 'power2.out', delay: 0.2 })
      if (fog.current) gsap.fromTo(fog.current, { opacity: 0.9 }, { opacity: 0.25, duration: 3, ease: 'power1.out' })
      if (hh.current) gsap.fromTo(hh.current, { rotation: -240, svgOrigin: '50 50' }, { rotation: 180, svgOrigin: '50 50', duration: 2.6, ease: 'power3.inOut' })
      if (mm.current) gsap.fromTo(mm.current, { rotation: -1440, svgOrigin: '50 50' }, { rotation: 0, svgOrigin: '50 50', duration: 2.6, ease: 'power3.inOut' })
    })
    return () => ctx.revert()
  }, [cinematic, region])
  const name = region?.name ?? '…'
  return (
    <section className="dk-tour-opener" aria-labelledby="dk-tour-op-title">
      <div className="dk-tour-op-top">
        <AppLink to="/" className="dk-tour-btn dk-tour-btn--ghost" data-tour-ctl="home">
          <Icon name="arrowLeft" size={16} />
          <span>{t.home}</span>
        </AppLink>
      </div>
      <div className="dk-tour-op-art" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="dk-tour-op-map">
          <g ref={map}>
            {region?.pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={0.55} />
            ))}
          </g>
        </svg>
        <div ref={fog} className="dk-tour-op-fog" />
        <svg viewBox="0 0 100 100" className="dk-tour-op-clock">
          <circle cx="50" cy="50" r="46" className="dk-tour-clock-face" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="50" y1="8" x2="50" y2={i % 3 ? 12 : 15} transform={`rotate(${i * 30} 50 50)`} className="dk-tour-op-tick" />
          ))}
          <line ref={hh} x1="50" y1="50" x2="50" y2="26" className="dk-tour-clock-h" transform="rotate(180 50 50)" />
          <line ref={mm} x1="50" y1="50" x2="50" y2="14" className="dk-tour-clock-m" />
          <circle cx="50" cy="50" r="2.4" className="dk-tour-op-pin" />
        </svg>
      </div>
      <div className="dk-tour-op-copy">
        <p className="dk-tour-eyebrow">{t.eyebrow} · 06.00 – 17.00</p>
        <h1 id="dk-tour-op-title" className="dk-tour-op-title">
          {fill(t.title, { region: name })}
        </h1>
        <p className="dk-tour-op-lead">{t.lead}</p>
        <div className="dk-tour-op-ctas">
          <button type="button" className="dk-tour-btn dk-tour-btn--accent dk-tour-btn--lg" onClick={onStart} disabled={busy} aria-busy={busy || undefined} data-tour-ctl="start">
            <Icon name="play" size={18} />
            <span>{busy ? t.loading : fill(t.start, { m: minutes })}</span>
          </button>
          <button ref={pickRef} type="button" className="dk-tour-btn dk-tour-btn--lg" onClick={onPick} aria-haspopup="dialog" data-tour-ctl="pick">
            <Icon name="list" size={18} />
            <span>{t.pick}</span>
          </button>
        </div>
      </div>
    </section>
  )
}
