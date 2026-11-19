/**
 * Constellation — the /ekosistem hero sky (spec §13, plan §2.1): GAMADA Inti at the centre, the 17 products as stars
 * in 3 eco clusters (fixed table, no physics), relation lines from products.ts `related` (deduped), faint eco hulls.
 *  - lines draw in on enter (stroke-dashoffset, ECO_SITE.constellation.lineDraw / lineStagger); 6 stars twinkle
 *    (opacity only) while the sky is on screen; both only with the `constellation` flag (?off=constellation) and full
 *    motion. Reduced motion / flag off: lines drawn, no twinkle, no zoom.
 *  - every star is a <button> (44 px hit area over an 8 px dot) in a logical order (Inti, then eco by eco). Hover /
 *    focus shows the mini card (aria-live) and brightens the star's lines; the rest dim to ECO_SITE...dimTo.
 *  - click / Enter: the star scales 1 → zoomScale while the sky fades (zoomMs), then the normal curtain navigation.
 *    Touch: first tap shows the card, a second tap (or the card link) opens the product.
 *  - text equivalent: a visually hidden list of the products per ecosystem.
 * ConstellationGlyph: the same sky as a small static picture with one cluster highlighted (/ekosistem/:eco hero).
 */
import { startTransition, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { gsap } from 'gsap'
import { ECOSYSTEMS, PRODUCTS, PRODUCT_BY_SLUG, type EcoOrInti, type ProductSlug } from '../../content/products'
import { ECO_SITE, isEnabled, prefersReducedMotion } from '../../lib/motion'
import { goTo } from '../../components/AppLink'
import AppLink from '../../components/AppLink'
import Arrow from '../../components/ui/Arrow'
import { Icon } from '../../demo-kit/ui/icons'
import { preloadRoute } from '../../routeLoaders'
import { useEcoI18n } from '../../content/i18n/useEco'
import type { EcoPagesCopy } from '../../content/ecoPages'
import { fill, EcoBadge, ECO_ORDER } from '../EcoParts'
import { productHref, useMedia, warmProduct } from './parts'

const C = ECO_SITE.constellation

type Pt = readonly [number, number]
interface Layout {
  w: number
  h: number
  stars: Record<ProductSlug, Pt>
  hulls: Record<Exclude<EcoOrInti, 'inti'>, readonly [number, number, number, number]>
  labels: Record<EcoOrInti, Pt> | null
}

/** Fixed star table. wide: 1000 × 620 sky; narrow (phones): 4:5 box with the clusters stacked. */
const LAYOUTS: Record<'wide' | 'narrow', Layout> = {
  wide: {
    w: 1000,
    h: 620,
    stars: {
      inti: [500, 310],
      'sapa-warga': [150, 150],
      'meja-pimpinan': [265, 110],
      'naskah-pintar': [372, 165],
      'radar-isu': [118, 265],
      'siaga-wilayah': [240, 225],
      'awas-belanja': [348, 285],
      'cek-berkas': [218, 338],
      'toko-autopilot': [700, 135],
      'pajak-beres': [822, 112],
      'juara-jualan': [902, 205],
      'kenal-mitra': [648, 245],
      'pantau-merek': [782, 262],
      tenderpilot: [872, 335],
      'katalog-lokal': [395, 485],
      'rapor-usaha': [508, 450],
      'indeks-ekonomi': [622, 492],
      'sinyal-pasar': [530, 552],
    },
    hulls: {
      'satu-daerah': [245, 222, 182, 150],
      'usaha-pintar': [775, 226, 172, 148],
      'pasar-daerah': [510, 500, 160, 82],
    },
    labels: {
      'satu-daerah': [245, 48],
      'usaha-pintar': [775, 52],
      'pasar-daerah': [510, 604],
      inti: [500, 362],
    },
  },
  narrow: {
    w: 400,
    h: 500,
    stars: {
      'sapa-warga': [55, 70],
      'meja-pimpinan': [150, 62],
      'naskah-pintar': [250, 70],
      'radar-isu': [345, 62],
      'siaga-wilayah': [100, 140],
      'awas-belanja': [200, 138],
      'cek-berkas': [300, 140],
      inti: [200, 220],
      'toko-autopilot': [70, 290],
      'pajak-beres': [200, 296],
      'juara-jualan': [330, 290],
      'kenal-mitra': [135, 355],
      'pantau-merek': [265, 355],
      tenderpilot: [362, 352],
      'katalog-lokal': [62, 440],
      'rapor-usaha': [155, 446],
      'indeks-ekonomi': [248, 440],
      'sinyal-pasar': [340, 446],
    },
    hulls: {
      'satu-daerah': [200, 102, 190, 62],
      'usaha-pintar': [210, 322, 196, 58],
      'pasar-daerah': [200, 443, 186, 36],
    },
    labels: null,
  },
}

/** Star order for keyboard and the text list: Inti, then eco by eco (products.ts order). */
const ORDER: readonly ProductSlug[] = ['inti', ...ECO_ORDER.filter((e) => e !== 'inti').flatMap((e) => PRODUCTS.filter((p) => p.eco === e).map((p) => p.slug))]

/** Relation lines from products.ts `related`, deduped (a–b once). */
const LINES: readonly (readonly [ProductSlug, ProductSlug])[] = (() => {
  const seen = new Set<string>()
  const out: [ProductSlug, ProductSlug][] = []
  for (const p of PRODUCTS)
    for (const r of p.related) {
      const k = [p.slug, r].sort().join('|')
      if (seen.has(k)) continue
      seen.add(k)
      out.push([p.slug, r])
    }
  return out
})()

const ecoOf = (s: ProductSlug): EcoOrInti => PRODUCT_BY_SLUG[s].eco
const lineEco = ([a, b]: readonly [ProductSlug, ProductSlug]): EcoOrInti | 'mix' => (ecoOf(a) === ecoOf(b) ? ecoOf(a) : 'mix')
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`

/** The SVG layers (hulls, lines, star dots). Shared by the live sky and the static glyph. */
function Sky({ L, active = null, hot, focusEco, svgRef }: { L: Layout; active?: ProductSlug | null; hot: Set<ProductSlug> | null; focusEco?: EcoOrInti; svgRef?: Ref<SVGSVGElement> }) {
  return (
    <svg ref={svgRef} className="cst-svg" viewBox={`0 0 ${L.w} ${L.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="cst-glow">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {(Object.keys(L.hulls) as (keyof Layout['hulls'])[]).map((e) => {
        const [cx, cy, rx, ry] = L.hulls[e]
        return <ellipse key={e} className="cst-hull" data-eco={e} data-dim={focusEco && focusEco !== 'inti' && focusEco !== e ? '' : undefined} cx={cx} cy={cy} rx={rx} ry={ry} />
      })}
      <g className="cst-lines">
        {LINES.map(([a, b]) => {
          const [x1, y1] = L.stars[a]
          const [x2, y2] = L.stars[b]
          const on = active !== null && (a === active || b === active)
          const dim = focusEco ? !(focusEco === 'inti' ? a === 'inti' || b === 'inti' : ecoOf(a) === focusEco && ecoOf(b) === focusEco) : false
          return (
            <line
              key={a + b}
              className="cst-line"
              data-eco={lineEco([a, b])}
              data-on={on ? '' : undefined}
              data-dim={dim ? '' : undefined}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              pathLength={1}
            />
          )
        })}
      </g>
      <g className="cst-stars">
        {ORDER.map((s) => {
          const [x, y] = L.stars[s]
          const inti = s === 'inti'
          const dim = focusEco ? (focusEco === 'inti' ? !inti : ecoOf(s) !== focusEco && !inti) : false
          return (
            <g key={s} className="cst-star" data-slug={s} data-eco={ecoOf(s)} data-on={hot?.has(s) ? '' : undefined} data-dim={dim ? '' : undefined}>
              <circle className="cst-halo" cx={x} cy={y} r={inti ? 34 : 15} fill="url(#cst-glow)" />
              <circle className="cst-dot" cx={x} cy={y} r={inti ? 8 : 4.5} />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/** Small static cluster picture for /ekosistem/:eco (decorative). */
export function ConstellationGlyph({ eco }: { eco: EcoOrInti }) {
  return (
    <div className="cst cst--glyph" data-eco={eco} aria-hidden="true">
      <Sky L={LAYOUTS.wide} hot={null} focusEco={eco} />
    </div>
  )
}

export default function Constellation({ P }: { P: EcoPagesCopy['constellation'] }) {
  const { lang } = useEcoI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const narrow = useMedia('(max-width: 640px)')
  const touch = useMedia('(hover: none)')
  const L = narrow ? LAYOUTS.narrow : LAYOUTS.wide
  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pointerType = useRef('')
  const leaving = useRef(false)
  /** was the star already showing its card when this press began (a transition may still be pending at click) */
  const wasActive = useRef(false)
  const [active, setActive] = useState<ProductSlug | null>(null)

  const hot = useMemo(() => {
    if (!active) return null
    const s = new Set<ProductSlug>([active])
    for (const [a, b] of LINES) {
      if (a === active) s.add(b)
      if (b === active) s.add(a)
    }
    return s
  }, [active])
  const links = hot ? hot.size - 1 : 0

  // lines draw in once the sky is on screen; then 6 stars twinkle (opacity) while it stays visible
  useLayoutEffect(() => {
    const root = rootRef.current
    const svg = svgRef.current
    if (!root || !svg) return
    const live = isEnabled('constellation') && !prefersReducedMotion()
    if (!live) return
    const ctx = gsap.context(() => {
      const lines = svg.querySelectorAll('.cst-line')
      gsap.set(lines, { strokeDasharray: 1, strokeDashoffset: 1 })
      let drawn = false
      let twinkle: gsap.core.Tween | null = null
      const dots = Array.from(svg.querySelectorAll<SVGCircleElement>('.cst-star:not([data-slug="inti"]) .cst-dot'))
      const round = () => {
        const pick = gsap.utils.shuffle(dots.slice()).slice(0, C.twinkleCount)
        gsap.to(pick, { opacity: 0.3, duration: C.twinkle / 2, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: C.twinkle / (2 * C.twinkleCount) })
        twinkle = gsap.delayedCall(C.twinkle * 1.25, round)
      }
      const io = new IntersectionObserver((entries) => {
        const vis = !!entries[entries.length - 1]?.isIntersecting
        if (vis && !drawn) {
          drawn = true
          gsap.to(lines, { strokeDashoffset: 0, duration: C.lineDraw, ease: 'power2.out', stagger: C.lineStagger / Math.max(1, lines.length), clearProps: 'strokeDasharray,strokeDashoffset' })
        }
        if (vis && !twinkle) twinkle = gsap.delayedCall(C.lineDraw, round)
        if (!vis && twinkle) {
          twinkle.kill()
          twinkle = null
          gsap.set(dots, { opacity: 1 })
        }
      })
      io.observe(root)
      return () => {
        io.disconnect()
        twinkle?.kill()
      }
    }, root)
    return () => ctx.revert()
  }, [narrow])

  const open = (slug: ProductSlug) => {
    if (leaving.current) return
    const to = productHref(slug)
    const root = rootRef.current
    const live = isEnabled('constellation') && !prefersReducedMotion()
    if (!live || !root) {
      void goTo(to, navigate, location.pathname)
      return
    }
    leaving.current = true
    void preloadRoute(new URL(to, window.location.origin).pathname)
    const [x, y] = L.stars[slug]
    const star = root.querySelector(`.cst-star[data-slug="${slug}"]`)
    const d = C.zoomMs / 1000
    // INP (Tahap 7): the zoom tweens start after the click's own paint (their first frame is the costly one)
    requestAnimationFrame(() =>
      setTimeout(() => {
        gsap.to(star, { scale: C.zoomScale, svgOrigin: `${x} ${y}`, duration: d, ease: 'power2.in' })
        gsap.to(root.querySelectorAll('.cst-lines, .cst-hull, .cst-star:not([data-slug="' + slug + '"]), .cst-card, .cst-label'), {
          opacity: 0,
          duration: d,
          ease: 'power1.in',
          onComplete: () => {
            void goTo(to, navigate, location.pathname)
          },
        })
      }, 0),
    )
  }
  /** the card + highlighted links render as a transition, so a tap or focus paints at once */
  const show = (slug: ProductSlug | null) => startTransition(() => setActive(slug))

  const onStar = (slug: ProductSlug) => {
    // touch: the first tap only shows the card
    if (pointerType.current === 'touch' && !wasActive.current) {
      show(slug)
      return
    }
    open(slug)
  }

  const a = active ? PRODUCT_BY_SLUG[active] : null
  const [ax, ay] = active ? L.stars[active] : [0, 0]
  const cardStyle = { '--x': pct(ax, L.w), '--y': pct(ay, L.h) } as CSSProperties

  return (
    <div
      ref={rootRef}
      className="cst"
      data-active={active ? '' : undefined}
      data-narrow={narrow ? '' : undefined}
      role="group"
      aria-label={P.label}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && !rootRef.current?.contains(document.activeElement)) setActive(null)
      }}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setActive(null)
      }}
    >
      <div className="cst-box" style={{ aspectRatio: `${L.w} / ${L.h}` }}>
        <Sky L={L} active={active} hot={hot} svgRef={svgRef} />
        {L.labels
          ? (Object.keys(L.labels) as EcoOrInti[]).map((e) => {
              const [x, y] = L.labels![e]
              return (
                <span key={e} className="cst-label" data-eco={e} style={{ left: pct(x, L.w), top: pct(y, L.h) }} aria-hidden="true">
                  {ECOSYSTEMS[e].name.replace('GAMADA ', '')}
                </span>
              )
            })
          : null}
        {ORDER.map((s) => {
          const p = PRODUCT_BY_SLUG[s]
          const [x, y] = L.stars[s]
          return (
            <button
              key={s}
              type="button"
              className="cst-btn"
              data-slug={s}
              data-eco={p.eco}
              aria-pressed={active === s}
              aria-label={fill(P.starLabel, { name: p.name, eco: ECOSYSTEMS[p.eco].name })}
              style={{ left: pct(x, L.w), top: pct(y, L.h) }}
              onPointerDown={(e) => {
                pointerType.current = e.pointerType
                wasActive.current = active === s
              }}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') {
                  show(s)
                  warmProduct(s)
                }
              }}
              onFocus={() => {
                show(s)
                warmProduct(s)
                pointerType.current = ''
              }}
              onClick={() => onStar(s)}
            />
          )
        })}
        {!narrow ? (
          <div className="cst-card-slot" aria-live="polite">
            {a ? <Card a={a} links={links} P={P} lang={lang} style={cardStyle} onOpen={() => open(a.slug)} /> : null}
          </div>
        ) : null}
      </div>
      {narrow ? (
        <div className="cst-card-slot is-below" aria-live="polite">
          {a ? <Card a={a} links={links} P={P} lang={lang} onOpen={() => open(a.slug)} /> : <p className="cst-hint">{touch ? P.hintTouch : P.hint}</p>}
        </div>
      ) : (
        <p className="cst-hint">{touch ? P.hintTouch : P.hint}</p>
      )}
      <div className="sr-only">
        <p>{P.listTitle}</p>
        {ECO_ORDER.map((e) => (
          <ul key={e} aria-label={ECOSYSTEMS[e].name}>
            {PRODUCTS.filter((p) => p.eco === e).map((p) => (
              <li key={p.slug}>
                {p.name}: {p.tagline[lang]}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}

function Card({
  a,
  links,
  P,
  lang,
  style,
  onOpen,
}: {
  a: (typeof PRODUCTS)[number]
  links: number
  P: EcoPagesCopy['constellation']
  lang: 'id' | 'en'
  style?: CSSProperties
  onOpen: () => void
}) {
  return (
    <div className="cst-card" data-eco={a.eco} style={style} data-low={style && parseFloat(String((style as Record<string, string>)['--y'])) > 52 ? '' : undefined}>
      <div className="cst-card-head">
        <span className="cst-card-icon">
          <Icon name={a.icon} size={20} />
        </span>
        <span>
          <span className="cst-card-name">{a.name}</span>
          <span className="cst-card-meta">
            <EcoBadge eco={a.eco} />
            {links > 0 ? <span className="cst-card-links">{fill(P.links, { n: links })}</span> : null}
          </span>
        </span>
      </div>
      <p className="cst-card-tag">{a.tagline[lang]}</p>
      <AppLink
        to={productHref(a.slug)}
        className="cst-card-go"
        onClick={(e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          onOpen()
        }}
      >
        {a.slug === 'inti' ? P.openInti : P.open}
        <Arrow />
      </AppLink>
    </div>
  )
}
