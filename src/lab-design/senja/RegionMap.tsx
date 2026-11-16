/**
 * 05 · District choropleth. Layer toggle value ↔ flood risk. WOW moment #2: the flood layer washes
 * in district by district, ordered by distance from the river source, each with a ripple (1.2 s).
 */
import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { gsap } from 'gsap'
import { useI18n, type Lang } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { KECAMATAN, MAP_VIEWBOX, POIS, RIVER_PATH } from '../sample'
import { Icon, PATHS } from './icons'
import { SJ, fmtNum, motionMode, useEnter, useGsapContext } from './shared'

type Layer = 'value' | 'flood'
type Kec = (typeof KECAMATAN)[number]

const C = {
  id: {
    map: 'Peta tematik kecamatan',
    layer: 'Lapisan peta',
    value: 'Aduan per 1.000 KK',
    flood: 'Risiko banjir',
    unit: 'aduan / 1.000 KK',
    risk: 'indeks risiko',
    legend: 'Legenda',
    ranking: 'Peringkat kecamatan',
    poi: 'Titik layanan',
    poiNames: { pasar: 'Pasar', mpp: 'Mal pelayanan', rs: 'Rumah sakit' },
    river: 'Sungai',
    attribution: 'Data contoh · fiktif',
    floodLevels: ['Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi'],
    hint: 'Pilih kecamatan di peta atau daftar untuk menyematkan detail.',
    insight: (n: string, v: string, r: string) => (
      <>
        <b>{n}</b> tertinggi di kedua lapisan: {v} aduan per 1.000 KK dan indeks risiko banjir {r}. Kandidat pertama untuk pompa air.
      </>
    ),
    pinned: 'disematkan',
    north: 'U',
  },
  en: {
    map: 'District thematic map',
    layer: 'Map layer',
    value: 'Complaints per 1,000 HH',
    flood: 'Flood risk',
    unit: 'complaints / 1,000 HH',
    risk: 'risk index',
    legend: 'Legend',
    ranking: 'District ranking',
    poi: 'Service points',
    poiNames: { pasar: 'Market', mpp: 'Public service hall', rs: 'Hospital' },
    river: 'River',
    attribution: 'Sample data · fictional',
    floodLevels: ['Low', 'Medium', 'High', 'Very high'],
    hint: 'Pick a district on the map or in the list to pin its details.',
    insight: (n: string, v: string, r: string) => (
      <>
        <b>{n}</b> leads on both layers: {v} complaints per 1,000 HH and a flood-risk index of {r}. First in line for water pumps.
      </>
    ),
    pinned: 'pinned',
    north: 'N',
  },
} as const

const VALUE_STEPS = [
  { max: 4, color: '#3a3473', label: '< 4' },
  { max: 6, color: '#35507f', label: '4–6' },
  { max: 8, color: '#2f7088', label: '6–8' },
  { max: 10, color: '#2f998f', label: '8–10' },
  { max: Infinity, color: '#3fd6b6', label: '≥ 10' },
] as const
const FLOOD_STEPS = [
  { max: 0.25, color: '#2c3f78' },
  { max: 0.5, color: '#2f5f9e' },
  { max: 0.75, color: '#3a8ccc' },
  { max: Infinity, color: '#62c9ff' },
] as const
const valueColor = (v: number) => VALUE_STEPS.find((s) => v < s.max)?.color ?? '#3fd6b6'
const floodColor = (v: number) => FLOOD_STEPS.find((s) => v < s.max)?.color ?? '#62c9ff'
const floodLevel = (v: number) => FLOOD_STEPS.findIndex((s) => v < s.max)

const SOURCE: [number, number] = [205, 30]
const WASH_ORDER = [...KECAMATAN].sort(
  (a, b) => Math.hypot(a.centroid[0] - SOURCE[0], a.centroid[1] - SOURCE[1]) - Math.hypot(b.centroid[0] - SOURCE[0], b.centroid[1] - SOURCE[1]),
)
/** Label anchors that avoid POI glyphs and the river (default: centroid). */
const LABEL_AT: Record<string, [number, number]> = { sukamaju: [300, 84], tirtajaya: [352, 256], pantairejo: [490, 236] }
const labelAt = (k: Kec): [number, number] => LABEL_AT[k.id] ?? k.centroid
const TOP = [...KECAMATAN].sort((a, b) => b.value - a.value)[0]

const POI_PATH: Record<(typeof POIS)[number]['kind'], string> = { pasar: PATHS.basket, mpp: PATHS.building, rs: PATHS.cross }

function metricText(k: Kec, layer: Layer, lang: Lang): string {
  const c = C[lang]
  return layer === 'value' ? `${fmtNum(k.value, lang, 1)} ${c.unit}` : `${c.floodLevels[floodLevel(k.floodRisk)] ?? ''} · ${fmtNum(k.floodRisk, lang, 2)}`
}

export default function RegionMap() {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = motionMode()
  const [layer, setLayer] = useState<Layer>('value')
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const ctx = useGsapContext(ref)
  const firstLayer = useRef(true)

  const ranked = useMemo(
    () => [...KECAMATAN].sort((a, b) => (layer === 'value' ? b.value - a.value : b.floodRisk - a.floodRisk)),
    [layer],
  )
  const max = layer === 'value' ? Math.max(...KECAMATAN.map((k) => k.value)) : 1

  // Entrance: districts fade in, river draws (≤ 800 ms).
  useLayoutEffect(() => {
    if (mode === 'static') return
    ctx.current?.add(() => {
      const svg = svgRef.current
      if (!svg) return
      if (mode === 'reduced') return gsap.set(svg, { opacity: 0 })
      gsap.set(svg.querySelectorAll('.lds-map-base polygon'), { opacity: 0 })
      gsap.set(svg.querySelectorAll('.lds-river-line'), { strokeDashoffset: 1 })
      gsap.set(svg.querySelectorAll('.lds-map-labels, .lds-map-pois, .lds-river-glow'), { opacity: 0 })
    })
  }, [ctx, mode])
  useEnter(mapRef, () =>
    ctx.current?.add(() => {
      const svg = svgRef.current
      if (!svg) return
      if (mode === 'reduced') return gsap.to(svg, { opacity: 1, duration: SJ.fade })
      gsap.to(svg.querySelectorAll('.lds-map-base polygon'), { opacity: 1, duration: SJ.panel, stagger: 0.05, ease: EASE.out })
      gsap.to(svg.querySelectorAll('.lds-river-line'), { strokeDashoffset: 0, duration: SJ.chartDraw, delay: 0.1, ease: 'power2.inOut' })
      gsap.to(svg.querySelectorAll('.lds-river-glow'), { opacity: 1, duration: SJ.panel, delay: 0.5 })
      gsap.to(svg.querySelectorAll('.lds-map-labels, .lds-map-pois'), { opacity: 1, duration: SJ.panel, delay: 0.45 })
    }),
  )

  // Layer switch: flood washes in (wow), or fades out (panel duration).
  useLayoutEffect(() => {
    const initial = firstLayer.current
    firstLayer.current = false
    if (initial) return
    ctx.current?.add(() => {
      const svg = svgRef.current
      if (!svg) return
      const polys = WASH_ORDER.map((k) => svg.querySelector(`.lds-map-flood [data-k="${k.id}"]`)).filter((p): p is Element => !!p)
      const rings = WASH_ORDER.map((k) => svg.querySelector(`.lds-map-ripples [data-k="${k.id}"]`)).filter((p): p is Element => !!p)
      gsap.killTweensOf([...polys, ...rings])
      if (mode !== 'full') {
        gsap.to(polys, { opacity: layer === 'flood' ? 1 : 0, duration: mode === 'static' ? 0 : SJ.fade })
        return
      }
      if (layer === 'flood') {
        const tl = gsap.timeline()
        tl.fromTo(polys, { opacity: 0 }, { opacity: 1, duration: 0.42, stagger: SJ.washStagger, ease: 'power2.out' }, 0)
        tl.fromTo(
          rings,
          { opacity: 0.85, scale: 0.25, transformOrigin: '50% 50%' },
          { opacity: 0, scale: 1.5, duration: 0.6, stagger: SJ.washStagger, ease: 'power2.out' },
          0,
        )
        tl.fromTo(svg.querySelector('.lds-river-glow'), { opacity: 1 }, { opacity: 0.35, duration: 0.3, yoyo: true, repeat: 1 }, 0)
      } else {
        gsap.to(polys, { opacity: 0, duration: SJ.panel, ease: 'power1.out' })
      }
    })
  }, [layer, ctx, mode])

  const activeId = hover?.id ?? pinned
  const active = KECAMATAN.find((k) => k.id === activeId) ?? null

  const toLocal = (x: number, y: number) => {
    const box = mapRef.current?.getBoundingClientRect()
    return box ? { x: x - box.left, y: y - box.top } : { x: 0, y: 0 }
  }
  const atCentroid = (k: Kec) => {
    const w = mapRef.current?.clientWidth ?? 600
    const s = w / 600
    return { x: k.centroid[0] * s, y: k.centroid[1] * s }
  }
  const onMove = (k: Kec, e: RPointerEvent) => setHover({ id: k.id, ...toLocal(e.clientX, e.clientY) })
  const togglePin = (id: string) => setPinned((p) => (p === id ? null : id))

  const tip = hover ?? (active ? { id: active.id, ...atCentroid(active) } : null)
  const tipW = mapRef.current?.clientWidth ?? 600

  return (
    <div className="lds-mapgrid" ref={ref}>
      <div className="lds-panel lds-map-panel">
        <div className="lds-map" ref={mapRef}>
          <svg ref={svgRef} viewBox={MAP_VIEWBOX} className={`lds-map-svg is-${layer}`} role="group" aria-label={`${c.map} · ${layer === 'value' ? c.value : c.flood}`}>
            <defs>
              <pattern id="lds-map-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M24 0H0V24" fill="none" stroke="rgba(185,178,255,.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="600" height="440" fill="url(#lds-map-grid)" />
            <g className="lds-map-base" aria-hidden="true">
              {KECAMATAN.map((k) => (
                <polygon key={k.id} points={k.points} fill={valueColor(k.value)} />
              ))}
            </g>
            <g className="lds-map-flood" aria-hidden="true">
              {KECAMATAN.map((k) => (
                <polygon key={k.id} data-k={k.id} points={k.points} fill={floodColor(k.floodRisk)} />
              ))}
            </g>
            <g className="lds-map-edges" aria-hidden="true">
              {KECAMATAN.map((k) => (
                <polygon key={k.id} points={k.points} />
              ))}
            </g>
            <path className="lds-river-glow" d={RIVER_PATH} aria-hidden="true" />
            <path className="lds-river-line" d={RIVER_PATH} pathLength={1} aria-hidden="true" />
            <g className="lds-map-ripples" aria-hidden="true">
              {KECAMATAN.map((k) => (
                <circle key={k.id} data-k={k.id} cx={k.centroid[0]} cy={k.centroid[1]} r="46" />
              ))}
            </g>
            <g className="lds-map-labels" aria-hidden="true">
              {KECAMATAN.map((k) => (
                <text key={k.id} x={labelAt(k)[0]} y={labelAt(k)[1]}>
                  <tspan className="lds-map-name">{k.name}</tspan>
                  <tspan className="lds-map-val" x={labelAt(k)[0]} dy="16">
                    {layer === 'value' ? fmtNum(k.value, lang, 1) : fmtNum(k.floodRisk, lang, 2)}
                  </tspan>
                </text>
              ))}
            </g>
            <g className="lds-map-hits">
              {KECAMATAN.map((k) => (
                <polygon
                  key={k.id}
                  points={k.points}
                  tabIndex={0}
                  role="button"
                  aria-pressed={pinned === k.id}
                  aria-label={`${k.name}: ${metricText(k, layer, lang)}`}
                  onPointerEnter={(e) => onMove(k, e)}
                  onPointerMove={(e) => onMove(k, e)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover({ id: k.id, ...atCentroid(k) })}
                  onBlur={() => setHover(null)}
                  onClick={() => togglePin(k.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      togglePin(k.id)
                    }
                  }}
                />
              ))}
            </g>
            {active && <polygon className="lds-map-active" points={active.points} aria-hidden="true" />}
            <g className="lds-map-pois">
              {POIS.map((p) => (
                <g key={p.name} transform={`translate(${p.at[0]} ${p.at[1]})`} role="img" aria-label={`${c.poiNames[p.kind]}: ${p.name}`}>
                  <circle r="11" className="lds-poi-bg" />
                  <path d={POI_PATH[p.kind]} transform="translate(-7 -7) scale(.7)" className="lds-poi-ic" />
                </g>
              ))}
            </g>
            <g className="lds-map-north" transform="translate(560 44)" aria-hidden="true">
              <circle r="15" />
              <path d="M0 -10 5 6 0 2 -5 6Z" />
              <text y="-19">{c.north}</text>
            </g>
          </svg>
          {tip && active && (
            <div
              className={`lds-maptip${tip.x > tipW - 150 ? ' is-left' : ''}`}
              style={{ left: `${Math.round(tip.x)}px`, top: `${Math.round(tip.y)}px` }}
              role="status"
            >
              <b>{active.name}</b>
              <span>
                {layer === 'value' ? (
                  <>
                    <strong>{fmtNum(active.value, lang, 1)}</strong> {c.unit}
                  </>
                ) : (
                  <>
                    <strong>{c.floodLevels[floodLevel(active.floodRisk)]}</strong> · {c.risk} {fmtNum(active.floodRisk, lang, 2)}
                  </>
                )}
              </span>
              {pinned === active.id && <em>{c.pinned}</em>}
            </div>
          )}
          <p className="lds-map-attr">{c.attribution}</p>
        </div>
      </div>

      <aside className="lds-panel lds-map-side" aria-label={c.legend}>
        <div className="lds-seg is-full" role="group" aria-label={c.layer}>
          <button type="button" className="lds-seg-btn" aria-pressed={layer === 'value'} onClick={() => setLayer('value')}>
            <Icon name="layers" size={16} />
            <span>{c.value}</span>
          </button>
          <button type="button" className="lds-seg-btn" aria-pressed={layer === 'flood'} onClick={() => setLayer('flood')}>
            <Icon name="drop" size={16} />
            <span>{c.flood}</span>
          </button>
        </div>

        <div className="lds-legend">
          <p className="lds-label">{layer === 'value' ? c.unit : c.flood}</p>
          <ol className="lds-legend-scale">
            {layer === 'value'
              ? VALUE_STEPS.map((s) => (
                  <li key={s.label}>
                    <span style={{ background: s.color }} />
                    {s.label}
                  </li>
                ))
              : FLOOD_STEPS.map((s, i) => (
                  <li key={s.color}>
                    <span style={{ background: s.color }} />
                    {c.floodLevels[i]}
                  </li>
                ))}
          </ol>
        </div>

        <div className="lds-rank">
          <p className="lds-label">{c.ranking}</p>
          <ol>
            {ranked.map((k) => {
              const v = layer === 'value' ? k.value : k.floodRisk
              return (
                <li key={k.id}>
                  <button
                    type="button"
                    className="lds-rank-btn"
                    aria-pressed={pinned === k.id}
                    onClick={() => togglePin(k.id)}
                    onPointerEnter={() => setHover({ id: k.id, ...atCentroid(k) })}
                    onPointerLeave={() => setHover(null)}
                  >
                    <span className="lds-rank-name">{k.name}</span>
                    <span className="lds-rank-bar" aria-hidden="true">
                      <span style={{ transform: `scaleX(${v / max})`, background: layer === 'value' ? valueColor(k.value) : floodColor(k.floodRisk) }} />
                    </span>
                    <span className="lds-rank-v">{layer === 'value' ? fmtNum(v, lang, 1) : fmtNum(v, lang, 2)}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="lds-hint">{c.hint}</p>
        </div>

        {TOP && (
          <div className="lds-insight">
            <Icon name="sparkle" size={18} />
            <p>{c.insight(TOP.name, fmtNum(TOP.value, lang, 1), fmtNum(TOP.floodRisk, lang, 2))}</p>
          </div>
        )}

        <div className="lds-poi-legend">
          <p className="lds-label">{c.poi}</p>
          <ul>
            {(['pasar', 'mpp', 'rs'] as const).map((kind) => (
              <li key={kind}>
                <svg width="20" height="20" viewBox="-11 -11 22 22" aria-hidden="true">
                  <circle r="10" className="lds-poi-bg" />
                  <path d={POI_PATH[kind]} transform="translate(-7 -7) scale(.7)" className="lds-poi-ic" />
                </svg>
                {c.poiNames[kind]}
              </li>
            ))}
            <li>
              <span className="lds-river-key" aria-hidden="true" />
              {c.river}
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
