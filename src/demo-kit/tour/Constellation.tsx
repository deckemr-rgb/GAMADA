/**
 * tour/Constellation.tsx — 17 product dots around GAMADA Inti (SVG), one arc per ecosystem; a dot lights when its
 * product has been on the stage. Text equivalent: "9 dari 17 produk sudah tampil".
 */
import { PRODUCTS, type ProductSlug } from '../../content/products'
import { TOUR_STRINGS, fill } from './strings'
import type { Lang } from './types'

const RING = PRODUCTS.filter((p) => p.eco !== 'inti')
const ECO_ORDER = ['satu-daerah', 'usaha-pintar', 'pasar-daerah'] as const
const ORDERED = ECO_ORDER.flatMap((e) => RING.filter((p) => p.eco === e))
/** dot positions on a circle (r 40 of a 100 box), a small gap between the ecosystems */
const POS = ORDERED.map((p, i) => {
  const gi = ECO_ORDER.indexOf(p.eco as (typeof ECO_ORDER)[number])
  const a = ((i + gi * 0.9) / (ORDERED.length + 2.7)) * Math.PI * 2 - Math.PI / 2
  return { slug: p.slug, eco: p.eco, name: p.name, x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a) }
})
export const RING_TOTAL = ORDERED.length

export function seenCount(seen: Partial<Record<ProductSlug, number>>): number {
  return POS.filter((p) => seen[p.slug] != null).length
}

export function Constellation({ seen, lang, all = false, size = 160 }: { seen: Partial<Record<ProductSlug, number>>; lang: Lang; all?: boolean; size?: number }) {
  const k = all ? RING_TOTAL : seenCount(seen)
  const label = fill(TOUR_STRINGS[lang].constellation, { k, total: RING_TOTAL })
  return (
    <figure className="dk-tour-const" style={{ width: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
        {POS.map((p) => (
          <line key={`l-${p.slug}`} x1={50} y1={50} x2={p.x} y2={p.y} className={`dk-tour-const-line${all || seen[p.slug] != null ? ' is-on' : ''}`} />
        ))}
        <circle cx={50} cy={50} r={6} className="dk-tour-const-core" data-on={all || seen.inti != null ? '' : undefined} />
        {POS.map((p) => (
          <circle key={p.slug} cx={p.x} cy={p.y} r={3.4} data-eco={p.eco} className={`dk-tour-const-dot${all || seen[p.slug] != null ? ' is-on' : ''}`}>
            <title>{p.name}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="dk-tour-const-cap">{label}</figcaption>
    </figure>
  )
}
