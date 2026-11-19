/**
 * PulseStrip — the platform pulse (pure props, reusable by /ekosistem/inti in Tahap 6): 17 product dots in their 3
 * ecosystem clusters around the Inti centre (pure SVG). A dot pulses once (opacity / scale ring) when a new Audit
 * Log row of its product lands; dots with an event in the last 10 world minutes are bright. Compact (phones): the 3
 * ecosystem rings with their counts. The text alternative is the aria-label + the counter.
 */
import { useRef } from 'react'
import { PRODUCTS, type EcoId, type ProductSlug } from '../../content/products'

export interface PulseStripProps {
  perProduct: Partial<Record<ProductSlug, { count: number; lastAt: number }>>
  todayCount: number
  now: number
  compact?: boolean
  /** play the one-shot ring (false under reduced motion / static) */
  motion: boolean
  title: string
  countText: string
  aria: string
  ecoLabel: Record<string, string>
}

const ECOS: readonly EcoId[] = ['satu-daerah', 'usaha-pintar', 'pasar-daerah']
const BY_ECO: Record<EcoId, ProductSlug[]> = {
  'satu-daerah': PRODUCTS.filter((p) => p.eco === 'satu-daerah').map((p) => p.slug),
  'usaha-pintar': PRODUCTS.filter((p) => p.eco === 'usaha-pintar').map((p) => p.slug),
  'pasar-daerah': PRODUCTS.filter((p) => p.eco === 'pasar-daerah').map((p) => p.slug),
}
const NAME = Object.fromEntries(PRODUCTS.map((p) => [p.slug, p.name])) as Record<ProductSlug, string>
const CENTRE: Record<EcoId, { x: number; y: number; r: number }> = {
  'satu-daerah': { x: 78, y: 80, r: 44 },
  'usaha-pintar': { x: 342, y: 80, r: 42 },
  'pasar-daerah': { x: 210, y: 158, r: 30 },
}
const INTI = { x: 210, y: 70 }

export function PulseStrip({ perProduct, now, compact, motion, title, countText, aria, ecoLabel }: PulseStripProps) {
  // counts seen at mount: no ring for what was already there
  const first = useRef<Partial<Record<string, number>> | null>(null)
  if (!first.current) {
    first.current = {}
    for (const [k, v] of Object.entries(perProduct)) first.current[k] = v?.count ?? 0
    for (const e of ECOS) first.current[e] = BY_ECO[e].reduce((a, s) => a + (perProduct[s]?.count ?? 0), 0)
  }
  const seen = first.current
  const ring = (key: string, n: number, cx: number, cy: number, r: number) =>
    motion && n > (seen[key] ?? 0) ? <circle key={`${key}-${n}`} className="dk-in-ring" cx={cx} cy={cy} r={r} /> : null

  if (compact) {
    return (
      <div className="dk-in-pulse is-compact">
        <svg viewBox="0 0 320 92" role="img" aria-label={aria} className="dk-in-pulse-svg">
          {ECOS.map((e, i) => {
            const x = 56 + i * 104
            const n = BY_ECO[e].reduce((a, s) => a + (perProduct[s]?.count ?? 0), 0)
            return (
              <g key={e} data-eco={e} className="dk-in-ecoring">
                <circle className="dk-in-ecocircle" cx={x} cy={40} r={28} />
                {ring(e, n, x, 40, 28)}
                <text x={x} y={46} textAnchor="middle" className="dk-in-ecocount">
                  {n}
                </text>
                <text x={x} y={86} textAnchor="middle" className="dk-in-ecolabel">
                  {ecoLabel[e]}
                </text>
              </g>
            )
          })}
        </svg>
        <p className="dk-in-pulse-count" data-in="pulse-count">
          {countText}
        </p>
      </div>
    )
  }

  return (
    <div className="dk-in-pulse">
      <svg viewBox="0 0 420 206" role="img" aria-label={aria} className="dk-in-pulse-svg">
        <title>{title}</title>
        {ECOS.map((e) => (
          <line key={e} className="dk-in-spoke" x1={INTI.x} y1={INTI.y} x2={CENTRE[e].x} y2={CENTRE[e].y} />
        ))}
        <g data-eco="inti">
          <circle className="dk-in-core" cx={INTI.x} cy={INTI.y} r={17} />
          <text x={INTI.x} y={INTI.y + 4} textAnchor="middle" className="dk-in-corelabel">
            Inti
          </text>
        </g>
        {ECOS.map((e) => {
          const c = CENTRE[e]
          const list = BY_ECO[e]
          const sum = list.reduce((a, s) => a + (perProduct[s]?.count ?? 0), 0)
          return (
            <g key={e} data-eco={e}>
              {list.map((slug, i) => {
                const a = -Math.PI / 2 + (i / list.length) * Math.PI * 2
                const x = c.x + Math.cos(a) * c.r
                const y = c.y + Math.sin(a) * c.r
                const p = perProduct[slug]
                const hot = !!p && now - p.lastAt <= 10
                return (
                  <g key={slug} data-slug={slug} className={`dk-in-pdot${hot ? ' is-hot' : ''}${p ? ' has-events' : ''}`}>
                    <title>{`${NAME[slug]}: ${p?.count ?? 0}`}</title>
                    {ring(slug, p?.count ?? 0, x, y, 8)}
                    <circle className="dk-in-dot" cx={x} cy={y} r={8} />
                  </g>
                )
              })}
              <text x={c.x} y={c.y + 4} textAnchor="middle" className="dk-in-ecocount is-sm">
                {sum}
              </text>
              <text x={c.x} y={e === 'pasar-daerah' ? c.y + c.r + 18 : c.y - c.r - 12} textAnchor="middle" className="dk-in-ecolabel">
                {ecoLabel[e]}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="dk-in-pulse-count" data-in="pulse-count">
        {countText}
      </p>
    </div>
  )
}
