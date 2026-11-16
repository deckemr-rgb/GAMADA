/** 05 · Map — SVG choropleth with a layer toggle, keyboard-focusable districts and a ranked ledger. */
import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { useI18n, type Lang } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { KECAMATAN, MAP_VIEWBOX, POIS, RIVER_PATH } from '../sample'
import { PoiGlyph } from './icons'
import { LDE, fmt, motionMode } from './lde'
import { RuleToggle } from './parts'

gsap.registerPlugin(Flip)

type Layer = 'value' | 'floodRisk'
type Kec = (typeof KECAMATAN)[number]

const STOPS: Record<Layer, number[]> = { value: [3, 6, 9, 12], floodRisk: [0.2, 0.4, 0.6, 0.8] }
const MIX = [12, 28, 46, 68, 92]

const C = {
  layer: { id: 'Lapisan peta', en: 'Map layer' },
  value: { id: 'Aduan per 1.000 KK', en: 'Complaints per 1,000 households' },
  valueShort: { id: 'Aduan / 1.000 KK', en: 'Complaints / 1,000 HH' },
  flood: { id: 'Risiko banjir', en: 'Flood risk' },
  rank: { id: 'Peringkat kecamatan', en: 'District ranking' },
  attribution: { id: 'Data contoh · fiktif', en: 'Sample data · fictional' },
  hint: { id: 'Arahkan atau fokus (Tab) ke kecamatan untuk melihat nilainya.', en: 'Hover or focus (Tab) a district to see its value.' },
  low: { id: 'Rendah', en: 'Low' },
  mid: { id: 'Sedang', en: 'Medium' },
  high: { id: 'Tinggi', en: 'High' },
  poi: { pasar: { id: 'Pasar', en: 'Market' }, mpp: { id: 'Mal pelayanan', en: 'Service hall' }, rs: { id: 'Rumah sakit', en: 'Hospital' } },
  river: { id: 'Sungai', en: 'River' },
  mapLabel: { id: 'Peta kecamatan', en: 'District map' },
}

/** Label anchors nudged off the river and the POI glyphs (presentation only). */
const LABEL_AT: Record<string, [number, number]> = { sukamaju: [292, 98], tirtajaya: [380, 248], gunungsari: [252, 354] }

const bin = (layer: Layer, v: number) => STOPS[layer].filter((s) => v >= s).length

function riskWord(lang: Lang, r: number) {
  return r >= 0.6 ? C.high[lang] : r >= 0.3 ? C.mid[lang] : C.low[lang]
}
function valueText(lang: Lang, layer: Layer, k: Kec) {
  return layer === 'value' ? fmt(lang, k.value, 1) : `${riskWord(lang, k.floodRisk)} · ${fmt(lang, Math.round(k.floodRisk * 100))}%`
}

const [, , VW = 600, VH = 440] = MAP_VIEWBOX.split(' ').map(Number)

export default function MapBlock() {
  const { lang } = useI18n()
  const [layer, setLayer] = useState<Layer>('value')
  const [active, setActive] = useState<{ id: string; x: number; y: number } | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const layersRef = useRef<SVGGElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const flipState = useRef<Flip.FlipState | null>(null)
  const first = useRef(true)
  const ctxRef = useRef<gsap.Context | null>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {})
    ctxRef.current = ctx
    return () => {
      ctx.revert()
      ctxRef.current = null
      first.current = true
    }
  }, [])

  const ranked = useMemo(() => [...KECAMATAN].sort((a, b) => (layer === 'value' ? b.value - a.value : b.floodRisk - a.floodRisk)), [layer])
  const max = layer === 'value' ? Math.max(...KECAMATAN.map((k) => k.value)) : 1
  const act = KECAMATAN.find((k) => k.id === active?.id) ?? null

  const changeLayer = (l: Layer) => {
    if (l === layer) return
    if (listRef.current && motionMode() === 'full') flipState.current = Flip.getState(listRef.current.querySelectorAll('li'))
    setLayer(l)
  }

  // Cross-fade the two fill layers (opacity only) + re-rank the ledger with Flip.
  useLayoutEffect(() => {
    const g = layersRef.current
    if (!g) return
    const mode = motionMode()
    const v = g.querySelector('[data-layer="value"]')
    const f = g.querySelector('[data-layer="floodRisk"]')
    const ctx = ctxRef.current
    if (!ctx) return
    ctx.add(() => {
      const instant = first.current || mode === 'static'
      const d = mode === 'full' ? LDE.press : LDE.fade
      gsap.to(v, { opacity: layer === 'value' ? 1 : 0, duration: instant ? 0 : d })
      gsap.to(f, { opacity: layer === 'floodRisk' ? 1 : 0, duration: instant ? 0 : d })
      const bars = listRef.current?.querySelectorAll<HTMLElement>('.lde-rank-bar')
      bars?.forEach((b) => {
        const s = Number(b.dataset.s)
        if (instant) gsap.set(b, { scaleX: s })
        else gsap.to(b, { scaleX: s, duration: mode === 'full' ? LDE.panel : 0, ease: EASE.out })
      })
      if (flipState.current) {
        Flip.from(flipState.current, { duration: LDE.panel, ease: EASE.reveal })
        flipState.current = null
      }
    })
    first.current = false
  }, [layer])

  const fromPointer = (e: RPointerEvent, id: string) => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    setActive({ id, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }

  const fill = (lay: Layer, k: Kec) => `color-mix(in oklab, var(${lay === 'value' ? '--lde-acc' : '--lde-acc-2'}) ${MIX[bin(lay, lay === 'value' ? k.value : k.floodRisk)]}%, var(--c-ink-2))`

  const legend = STOPS[layer]

  return (
    <div className="lde-map">
      <div className="lde-map-bar">
        <RuleToggle
          label={C.layer[lang]}
          value={layer}
          onChange={changeLayer}
          options={[
            { value: 'value', label: C.valueShort[lang] },
            { value: 'floodRisk', label: C.flood[lang] },
          ]}
        />
        <div className="lde-legend">
          <span className="lde-cap">{layer === 'value' ? C.value[lang] : C.flood[lang]}</span>
          <span className="lde-legend-steps" aria-hidden="true">
            {MIX.map((m) => (
              <span key={m} style={{ background: `color-mix(in oklab, var(${layer === 'value' ? '--lde-acc' : '--lde-acc-2'}) ${m}%, var(--c-ink-2))` }} />
            ))}
          </span>
          <span className="lde-legend-ticks lde-num" aria-hidden="true">
            {legend.map((s) => (
              <span key={s}>{layer === 'value' ? fmt(lang, s) : `${fmt(lang, s * 100)}%`}</span>
            ))}
          </span>
        </div>
      </div>

      <div className="lde-map-grid">
        <div className="lde-map-stage" ref={wrap} onPointerLeave={() => setActive(null)}>
          <svg viewBox={MAP_VIEWBOX} className="lde-map-svg" role="group" aria-label={`${C.mapLabel[lang]} · ${layer === 'value' ? C.value[lang] : C.flood[lang]}`}>
            <g ref={layersRef} aria-hidden="true">
              {(['value', 'floodRisk'] as const).map((lay) => (
                <g key={lay} data-layer={lay} className="lde-map-fill">
                  {KECAMATAN.map((k) => (
                    <polygon key={k.id} points={k.points} style={{ fill: fill(lay, k) }} />
                  ))}
                </g>
              ))}
            </g>
            <g aria-hidden="true" className="lde-river">
              <path d={RIVER_PATH} className="lde-river-case" />
              <path d={RIVER_PATH} className="lde-river-line" />
            </g>
            <g className="lde-map-labels" aria-hidden="true">
              {KECAMATAN.map((k) => (
                <text key={k.id} x={(LABEL_AT[k.id] ?? k.centroid)[0]} y={(LABEL_AT[k.id] ?? k.centroid)[1]} className={bin(layer, layer === 'value' ? k.value : k.floodRisk) >= 3 ? 'is-dark' : undefined}>
                  {k.name}
                </text>
              ))}
            </g>
            <g className="lde-pois" aria-hidden="true">
              {POIS.map((p) => (
                <g key={p.name} transform={`translate(${p.at[0]} ${p.at[1]})`}>
                  <circle r="10" className="lde-poi-disc" />
                  <PoiGlyph kind={p.kind} />
                </g>
              ))}
            </g>
            <g className="lde-map-hit">
              {KECAMATAN.map((k) => (
                <polygon
                  key={k.id}
                  points={k.points}
                  tabIndex={0}
                  role="img"
                  aria-label={`${k.name}: ${valueText(lang, layer, k)}${layer === 'value' ? ` ${lang === 'id' ? 'aduan per 1.000 KK' : 'complaints per 1,000 households'}` : ` ${lang === 'id' ? 'risiko banjir' : 'flood risk'}`}`}
                  onPointerEnter={(e) => fromPointer(e, k.id)}
                  onPointerMove={(e) => fromPointer(e, k.id)}
                  onFocus={() => setActive({ id: k.id, x: (k.centroid[0] / VW) * 100, y: (k.centroid[1] / VH) * 100 })}
                  onBlur={() => setActive(null)}
                />
              ))}
            </g>
            {act && <polygon points={act.points} className="lde-map-active" aria-hidden="true" />}
          </svg>

          {act && active && (
            <div className="lde-tip lde-map-tip" style={{ left: `${active.x}%`, top: `${active.y}%` }} aria-hidden="true">
              <span className="lde-tip-k">{act.name}</span>
              <span className="lde-tip-v lde-num">{valueText(lang, layer, act)}</span>
              <span className="lde-tip-u">{layer === 'value' ? C.valueShort[lang] : C.flood[lang]}</span>
            </div>
          )}
          <p className="lde-map-attr">{C.attribution[lang]}</p>
        </div>

        <div className="lde-map-side">
          <h3 className="lde-cap lde-cap-strong">{C.rank[lang]}</h3>
          <ol className="lde-rank" ref={listRef}>
            {ranked.map((k, i) => {
              const v = layer === 'value' ? k.value : k.floodRisk
              return (
                <li
                  key={k.id}
                  data-flip-id={k.id}
                  className={active?.id === k.id ? 'is-active' : undefined}
                  onPointerEnter={() => setActive({ id: k.id, x: (k.centroid[0] / VW) * 100, y: (k.centroid[1] / VH) * 100 })}
                  onPointerLeave={() => setActive(null)}
                >
                  <span className="lde-rank-n lde-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="lde-rank-name">{k.name}</span>
                  <span className="lde-rank-v lde-num">{layer === 'value' ? fmt(lang, v, 1) : `${fmt(lang, Math.round(v * 100))}%`}</span>
                  <span className="lde-rank-track" aria-hidden="true">
                    <span className="lde-rank-bar" data-s={v / max} />
                  </span>
                </li>
              )
            })}
          </ol>
          <ul className="lde-map-key">
            {(['pasar', 'mpp', 'rs'] as const).map((p) => (
              <li key={p}>
                <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">
                  <circle r="10" className="lde-poi-disc" />
                  <PoiGlyph kind={p} />
                </svg>
                {C.poi[p][lang]}
              </li>
            ))}
            <li>
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                <path d="M3 17 C 8 13, 12 9, 19 5" className="lde-river-line" />
              </svg>
              {C.river[lang]}
            </li>
          </ul>
          <p className="lde-note">{C.hint[lang]}</p>
        </div>
      </div>
    </div>
  )
}
