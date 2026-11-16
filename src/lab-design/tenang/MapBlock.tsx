/**
 * 05 · Choropleth of the fictional kecamatan, river, POIs, keyboard-focusable polygons, tooltip,
 * legend, and a ranked list that stays linked to the map (hover / focus / select both ways).
 * Layer switch cross-fades two fill groups (opacity only) and FLIP-reorders the ranking.
 */
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { gsap } from 'gsap'
import { EASE } from '../../lib/motion'
import { useI18n } from '../../lib/i18n'
import { KECAMATAN, MAP_VIEWBOX, POIS, RIVER_PATH, TICKETS } from '../sample'
import { StatusChip } from './Console'
import { Icon, SectionHead, TT, fmt, motionMode, useGsap } from './shared'

type Layer = 'value' | 'flood'

const C = {
  id: {
    title: 'Peta wilayah',
    lead: 'Choropleth kecamatan dengan sungai dan titik layanan. Poligon bisa difokus dengan Tab; Enter mengunci pilihan.',
    layer: 'Lapisan peta',
    value: 'Aduan per 1.000 KK',
    flood: 'Risiko banjir',
    rank: 'Peringkat',
    tickets: (n: number) => (n ? `${n} tiket di kotak masuk` : 'Tidak ada tiket aktif'),
    perKK: 'per 1.000 KK',
    risk: 'risiko',
    attribution: 'Data contoh · fiktif',
    map: 'Peta kecamatan',
    low: 'Rendah',
    high: 'Tinggi',
    north: 'U',
    poi: { pasar: 'Pasar', mpp: 'Layanan publik', rs: 'Rumah sakit' },
    pinned: 'Dikunci',
    focus: 'Disorot',
    top: 'Tertinggi',
    inInbox: 'Tiket di kotak masuk',
    none: 'Belum ada tiket dari kecamatan ini.',
  },
  en: {
    title: 'Region map',
    lead: 'District choropleth with the river and service points. Polygons are focusable with Tab; Enter pins a selection.',
    layer: 'Map layer',
    value: 'Complaints per 1,000 households',
    flood: 'Flood risk',
    rank: 'Ranking',
    tickets: (n: number) => (n ? `${n} ticket${n > 1 ? 's' : ''} in the inbox` : 'No active tickets'),
    perKK: 'per 1,000 HH',
    risk: 'risk',
    attribution: 'Sample data · fictional',
    map: 'District map',
    low: 'Low',
    high: 'High',
    north: 'N',
    poi: { pasar: 'Market', mpp: 'Public service hall', rs: 'Hospital' },
    pinned: 'Pinned',
    focus: 'Highlighted',
    top: 'Highest',
    inInbox: 'Tickets in the inbox',
    none: 'No tickets from this district yet.',
  },
}

const SCALE: Record<Layer, { stops: number[]; colors: string[] }> = {
  value: { stops: [4.5, 6, 8, 10], colors: ['#262f52', '#204a60', '#1f6c6e', '#299a84', '#3fe0c0'] },
  flood: { stops: [0.2, 0.4, 0.6, 0.8], colors: ['#272d5a', '#254272', '#235e91', '#2b88b8', '#4fd1ff'] },
}
/** Label anchors nudged off the river and POI glyphs (tooltips still use the centroid). */
const LABEL_AT: Record<string, [number, number]> = { sukamaju: [300, 98], tirtajaya: [382, 238], gunungsari: [252, 352] }
const cls = (layer: Layer, v: number) => SCALE[layer].stops.filter((s) => v >= s).length
const metric = (layer: Layer, k: (typeof KECAMATAN)[number]) => (layer === 'value' ? k.value : k.floodRisk)

function PoiGlyph({ kind }: { kind: 'pasar' | 'mpp' | 'rs' }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'pasar')
    return (
      <g {...p}>
        <path d="M-5 -2.5h10l-1 -3h-8Z" />
        <path d="M-4 -2.5v6h8v-6M-1.3 3.5v-3h2.6v3" />
      </g>
    )
  if (kind === 'mpp')
    return (
      <g {...p}>
        <path d="M-5.5 -2 0 -5.5 5.5 -2M-4 -1.5v5M0 -1.5v5M4 -1.5v5M-5.5 4h11" />
      </g>
    )
  return (
    <g {...p}>
      <path d="M0 -4.5v9M-4.5 0h9" strokeWidth="1.8" />
    </g>
  )
}

export default function MapBlock() {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = motionMode()
  const [layer, setLayer] = useState<Layer>('value')
  const [hover, setHover] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const floodRef = useRef<SVGGElement>(null)
  const listItems = useRef(new Map<string, HTMLLIElement>())
  const tops = useRef<Map<string, number> | null>(null)
  const firstLayer = useRef(true)
  const run = useGsap()

  const sorted = useMemo(() => [...KECAMATAN].sort((a, b) => metric(layer, b) - metric(layer, a)), [layer])
  const max = Math.max(...KECAMATAN.map((k) => metric(layer, k)))
  const ticketsBy = useMemo(() => {
    const m = new Map<string, number>()
    TICKETS.forEach((t) => {
      if (t.status !== 'selesai') m.set(t.kecamatan, (m.get(t.kecamatan) ?? 0) + 1)
    })
    return m
  }, [])

  const switchLayer = (l: Layer) => {
    if (l === layer) return
    const m = new Map<string, number>()
    listItems.current.forEach((el, id) => m.set(id, el.getBoundingClientRect().top))
    tops.current = m
    setLayer(l)
  }

  useLayoutEffect(() => {
    const g = floodRef.current
    if (!g) return
    run(() => {
      const to = layer === 'flood' ? 1 : 0
      const initial = firstLayer.current
      if (initial || mode === 'static') {
        firstLayer.current = false
        gsap.set(g, { opacity: to })
      } else gsap.to(g, { opacity: to, duration: mode === 'reduced' ? TT.reduced : TT.press, ease: 'power1.inOut' })
      const t = tops.current
      tops.current = null
      if (t && mode === 'full') {
        listItems.current.forEach((el, id) => {
          const before = t.get(id)
          if (before === undefined) return
          const dy = before - el.getBoundingClientRect().top
          if (dy) gsap.fromTo(el, { y: dy }, { y: 0, duration: TT.panel, ease: EASE.out })
        })
      }
      // bars
      const bars = [...listItems.current.values()].map((el) => el.querySelector<HTMLElement>('.ldt-rank-bar > i'))
      bars.forEach((b) => {
        if (!b) return
        const v = Number(b.dataset.v)
        if (mode === 'full' && !initial) gsap.to(b, { scaleX: v, duration: TT.panel, ease: EASE.out })
        else gsap.set(b, { scaleX: v })
      })
    })
  }, [layer, mode, run])

  const shown = hover ?? selected
  const k = KECAMATAN.find((x) => x.id === shown)
  const fmtMetric = (l: Layer, v: number) => (l === 'value' ? fmt(lang, v, 1) : `${fmt(lang, v * 100)}%`)

  const onPolyKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelected((s) => (s === id ? null : id))
    } else if (e.key === 'Escape') setSelected(null)
  }

  const [vx, vy, vw, vh] = MAP_VIEWBOX.split(' ').map(Number) as [number, number, number, number]
  const tipSide = k ? (k.centroid[0] < 150 ? 'l' : k.centroid[0] > 450 ? 'r' : 'c') : 'c'
  const tipBelow = k ? k.centroid[1] < 120 : false
  const hiK = KECAMATAN.find((x) => x.id === shown)
  const sc = SCALE[layer]

  return (
    <section className="ldt-block" aria-labelledby="ldt-h-map">
      <SectionHead num="05" id="ldt-h-map" title={c.title} lead={c.lead} />
      <div className="ldt-card ldt-mapcard">
        <div className="ldt-map-toolbar">
          <span className="ldt-card-h-l">
            {Icon.map()}
            {layer === 'value' ? c.value : c.flood}
          </span>
          <div className="ldt-seg" role="radiogroup" aria-label={c.layer}>
            {(['value', 'flood'] as Layer[]).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={layer === l} onClick={() => switchLayer(l)}>
                <span>{l === 'value' ? c.value : c.flood}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ldt-map-body">
          <div className="ldt-map-wrap">
            <svg className="ldt-map" viewBox={MAP_VIEWBOX} role="group" aria-label={`${c.map} · ${layer === 'value' ? c.value : c.flood}`}>
              <g aria-hidden="true">
                {KECAMATAN.map((x) => (
                  <polygon key={x.id} points={x.points} fill={SCALE.value.colors[cls('value', x.value)]} />
                ))}
              </g>
              <g aria-hidden="true" ref={floodRef} style={{ opacity: 0 }}>
                {KECAMATAN.map((x) => (
                  <polygon key={x.id} points={x.points} fill={SCALE.flood.colors[cls('flood', x.floodRisk)]} />
                ))}
              </g>
              <path d={RIVER_PATH} className="ldt-river-case" aria-hidden="true" />
              <path d={RIVER_PATH} className="ldt-river" aria-hidden="true" />
              <g>
                {KECAMATAN.map((x) => (
                  <polygon
                    key={x.id}
                    points={x.points}
                    className="ldt-poly"
                    tabIndex={0}
                    role="button"
                    aria-pressed={selected === x.id}
                    aria-label={`${x.name}: ${fmt(lang, x.value, 1)} ${c.perKK}, ${c.flood.toLowerCase()} ${fmt(lang, x.floodRisk * 100)}%`}
                    onPointerEnter={() => setHover(x.id)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(x.id)}
                    onBlur={() => setHover(null)}
                    onClick={() => setSelected((s) => (s === x.id ? null : x.id))}
                    onKeyDown={(e) => onPolyKey(e, x.id)}
                  />
                ))}
              </g>
              {hiK && <polygon points={hiK.points} className="ldt-poly-hi" aria-hidden="true" />}
              {selected && selected !== shown && <polygon points={KECAMATAN.find((x) => x.id === selected)!.points} className="ldt-poly-sel" aria-hidden="true" />}
              <g className="ldt-map-labels" aria-hidden="true">
                {KECAMATAN.map((x) => {
                  const bright = cls(layer, metric(layer, x)) === 4
                  return (
                    <g key={x.id} transform={`translate(${(LABEL_AT[x.id] ?? x.centroid).join(' ')})`} className={bright ? 'is-dark' : ''}>
                      <text y="-3">{x.name}</text>
                      <text y="12" className="ldt-map-v">
                        {fmtMetric(layer, metric(layer, x))}
                      </text>
                    </g>
                  )
                })}
              </g>
              <g className="ldt-pois" aria-hidden="true">
                {POIS.map((p) => (
                  <g key={p.name} transform={`translate(${p.at[0]} ${p.at[1]})`}>
                    <circle r="10" />
                    <PoiGlyph kind={p.kind} />
                  </g>
                ))}
              </g>
              <g className="ldt-north" transform={`translate(${vx + vw - 28} ${vy + 30})`} aria-hidden="true">
                <path d="M0 -14 6 4 0 0 -6 4Z" />
                <text y="18">{c.north}</text>
              </g>
              <title>{c.map}</title>
              <desc>{`${vw}×${vh}`}</desc>
            </svg>
            {k && (
              <div
                className={`ldt-tip ldt-maptip is-${tipSide}${tipBelow ? ' is-below' : ''}`}
                style={{ left: `${(k.centroid[0] / vw) * 100}%`, top: `${(k.centroid[1] / vh) * 100}%` }}
                aria-hidden="true"
              >
                <b>{k.name}</b>
                <span className="ldt-tip-row">
                  <span>{c.value}</span>
                  <span className="ldt-num">{fmt(lang, k.value, 1)}</span>
                </span>
                <span className="ldt-tip-row">
                  <span>{c.flood}</span>
                  <span className="ldt-num">{fmt(lang, k.floodRisk * 100)}%</span>
                </span>
                <span className="ldt-tip-foot">{c.tickets(ticketsBy.get(k.name) ?? 0)}</span>
              </div>
            )}
            <div className="ldt-map-foot">
            <div className="ldt-legend">
              <span className="ldt-legend-t">{layer === 'value' ? c.perKK : c.flood}</span>
              <span className="ldt-legend-row">
                {sc.colors.map((col, i) => (
                  <i key={col} style={{ background: col }} title={i === 0 ? c.low : i === 4 ? c.high : undefined} />
                ))}
              </span>
              <span className="ldt-legend-ticks ldt-num">
                {sc.stops.map((s) => (
                  <span key={s}>{layer === 'value' ? fmt(lang, s, 1) : `${fmt(lang, s * 100)}%`}</span>
                ))}
              </span>
            </div>
            <ul className="ldt-poi-key">
              {(['pasar', 'mpp', 'rs'] as const).map((kind) => (
                <li key={kind}>
                  <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
                    <PoiGlyph kind={kind} />
                  </svg>
                  {c.poi[kind]}
                </li>
              ))}
            </ul>
            <span className="ldt-attrib">{c.attribution}</span>
            </div>
          </div>

          <div className="ldt-rank" data-layer={layer}>
            <p className="ldt-rank-h">
              <span>{c.rank}</span>
              <span className="ldt-faint">{layer === 'value' ? c.perKK : c.risk}</span>
            </p>
            <ol>
              {sorted.map((x, i) => (
                <li
                  key={x.id}
                  ref={(el) => {
                    if (el) listItems.current.set(x.id, el)
                    else listItems.current.delete(x.id)
                  }}
                >
                  <button
                    type="button"
                    className={`ldt-rank-row${shown === x.id ? ' is-hi' : ''}`}
                    aria-pressed={selected === x.id}
                    onPointerEnter={() => setHover(x.id)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(x.id)}
                    onBlur={() => setHover(null)}
                    onClick={() => setSelected((s) => (s === x.id ? null : x.id))}
                  >
                    <span className="ldt-rank-i ldt-num">{i + 1}</span>
                    <span className="ldt-rank-n">{x.name}</span>
                    <span className="ldt-rank-bar" aria-hidden="true">
                      <i data-v={metric(layer, x) / max} />
                    </span>
                    <span className="ldt-rank-v ldt-num">{fmtMetric(layer, metric(layer, x))}</span>
                  </button>
                </li>
              ))}
            </ol>
            {(() => {
              const d = KECAMATAN.find((x) => x.id === shown) ?? sorted[0]!
              const list = TICKETS.filter((t) => t.kecamatan === d.name)
              return (
                <div className="ldt-rank-detail">
                  <p className="ldt-rank-h">
                    <span>{d.name}</span>
                    <span className="ldt-faint">{hover ? c.focus : selected ? c.pinned : c.top}</span>
                  </p>
                  <dl className="ldt-dl ldt-dl--tight">
                    <div>
                      <dt>{c.value}</dt>
                      <dd className="ldt-num">{fmt(lang, d.value, 1)}</dd>
                    </div>
                    <div>
                      <dt>{c.flood}</dt>
                      <dd className="ldt-num">{fmt(lang, d.floodRisk * 100)}%</dd>
                    </div>
                  </dl>
                  <p className="ldt-rank-sub">{c.inInbox}</p>
                  {list.length ? (
                    <ul className="ldt-rank-tickets">
                      {list.map((t) => (
                        <li key={t.id}>
                          <span className="ldt-num ldt-faint">{t.id.slice(-4)}</span>
                          <span className="ldt-rank-tcat">{t.category[lang]}</span>
                          <StatusChip s={t.status} lang={lang} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ldt-faint ldt-rank-none">{c.none}</p>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </section>
  )
}
