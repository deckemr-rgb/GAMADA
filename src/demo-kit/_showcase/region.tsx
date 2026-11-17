/**
 * /lab/_kit showcase section for the "region" module — owned by the region builder.
 * Renders the Bojonegoro pack: SVG map of the 28 kecamatan (no MapLibre — that is the map module, wave 2)
 * with rivers, reservoirs, roads, markets, landmarks and the DERIVED flood zone; the BPS stats block with its
 * source line; sectors + staple prices; and the Basa Jawa complaint templates with a Jawa / ID / EN toggle.
 * ?static=1 renders final states (no draw-in).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useSearchParams } from 'react-router'
import { gsap } from 'gsap'
import { useI18n, type Lang } from '../../lib/i18n'
import { DEMO, isEnabled, prefersReducedMotion } from '../../lib/motion'
import { Badge, Chip, Segmented } from '../ui'
import { DEFAULT_REGION_ID, loadRegion, loadRegionGeo, regionText, type RegionGeo, type RegionPack } from '../region/loader'
import type { ComplaintCategory, LandmarkKind } from '../region/types'
import './region.css'

/* ------------------------------------------------------------------ constants (module-local) */
const MAP = {
  /** SVG user units across the map */
  width: 1000,
  pad: 14,
  /** stagger between kecamatan fades on first view (s) */
  stagger: 0.012,
}

type Bi = { id: string; en: string }
const T = {
  map: { id: 'Peta 28 kecamatan', en: 'Map of the 28 districts' },
  mapLead: {
    id: 'Arahkan kursor atau fokus (Tab) ke kecamatan; klik untuk detail desa.',
    en: 'Hover or focus (Tab) a district; click for its villages.',
  },
  layers: { id: 'Lapisan', en: 'Layers' },
  flood: { id: 'Zona banjir (turunan)', en: 'Flood zone (derived)' },
  roads: { id: 'Jalan utama', en: 'Main roads' },
  streams: { id: 'Sungai kecil', en: 'Streams' },
  markets: { id: 'Pasar', en: 'Markets' },
  landmarks: { id: 'Landmark', en: 'Landmarks' },
  people: { id: 'jiwa', en: 'people' },
  floodRisk: { id: 'Risiko banjir', en: 'Flood risk' },
  slideRisk: { id: 'Risiko longsor', en: 'Landslide risk' },
  derived: { id: 'turunan, simulasi', en: 'derived, simulated' },
  villages: { id: 'desa/kelurahan', en: 'villages' },
  kelurahan: { id: 'kelurahan', en: 'urban' },
  mainSector: { id: 'Sektor utama', en: 'Main sector' },
  clear: { id: 'Tutup detail', en: 'Close details' },
  pickHint: { id: 'Pilih kecamatan di peta untuk melihat desa, risiko, dan sektor utamanya.', en: 'Pick a district on the map to see its villages, risks and main sector.' },
  stats: { id: 'Statistik publik', en: 'Public statistics' },
  population: { id: 'Penduduk 2025', en: 'Population 2025' },
  households: { id: 'Keluarga (pemilik KK)', en: 'Families (KK holders)' },
  area: { id: 'Luas wilayah', en: 'Land area' },
  units: { id: 'Kecamatan · desa/kel.', en: 'Districts · villages' },
  economy: { id: 'Struktur ekonomi (PDRB 2025)', en: 'Economic structure (GRDP 2025)' },
  prices: { id: 'Harga dasar simulasi', en: 'Simulated base prices' },
  templates: { id: 'Template aduan bahasa daerah', en: 'Regional-language complaint templates' },
  all: { id: 'Semua', en: 'All' },
  readIn: { id: 'Baca dalam', en: 'Read in' },
  urgency: { tinggi: { id: 'mendesak', en: 'urgent' }, sedang: { id: 'sedang', en: 'medium' }, rendah: { id: 'rendah', en: 'low' } },
  sources: { id: 'Sumber & lisensi', en: 'Sources & licences' },
  loading: { id: 'Memuat region pack…', en: 'Loading region pack…' },
  failed: { id: 'Region pack gagal dimuat.', en: 'The region pack failed to load.' },
  derivedNote: { id: 'Zona banjir adalah turunan simulasi, bukan peta resmi BNPB.', en: 'The flood zone is a simulated derivation, not an official BNPB map.' },
} satisfies Record<string, Bi | Record<string, Bi>>

const LM_GLYPH: Record<LandmarkKind, string> = {
  pasar: 'P', kantor: 'K', rs: '+', puskesmas: '+', sekolah: 'S', bendungan: 'B', mpp: 'M', pelabuhan: 'L', pengungsian: 'E',
}
const LM_LABEL: Record<LandmarkKind, Bi> = {
  pasar: { id: 'Pasar', en: 'Market' },
  kantor: { id: 'Kantor', en: 'Office' },
  rs: { id: 'Rumah sakit', en: 'Hospital' },
  puskesmas: { id: 'Puskesmas', en: 'Health centre' },
  sekolah: { id: 'Sekolah', en: 'School' },
  bendungan: { id: 'Bendungan', en: 'Dam' },
  mpp: { id: 'Mal Pelayanan Publik', en: 'Public service mall' },
  pelabuhan: { id: 'Pelabuhan', en: 'Port' },
  pengungsian: { id: 'Pengungsian', en: 'Shelter' },
}

type Layer = 'flood' | 'roads' | 'streams' | 'markets' | 'landmarks'
type ReadLang = 'jv' | 'id' | 'en'

/* ------------------------------------------------------------------ projection */

type Pt = [number, number]
function makeProjection(bbox: [number, number, number, number]) {
  const [w, s, e, n] = bbox
  const lat0 = ((s + n) / 2) * (Math.PI / 180)
  const kx = Math.cos(lat0)
  const sc = (MAP.width - MAP.pad * 2) / ((e - w) * kx)
  const height = Math.round((n - s) * sc + MAP.pad * 2)
  const p = (c: Pt): Pt => [MAP.pad + (c[0] - w) * kx * sc, MAP.pad + (n - c[1]) * sc]
  return { p, height }
}
const f1 = (v: number) => Math.round(v * 10) / 10
function ringPath(ring: Pt[], p: (c: Pt) => Pt) {
  let d = ''
  ring.forEach((c, i) => {
    const [x, y] = p(c)
    d += `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`
  })
  return d + 'Z'
}
function geomPath(g: { type: string; coordinates: unknown }, p: (c: Pt) => Pt): string {
  if (g.type === 'Polygon') return (g.coordinates as Pt[][]).map((r) => ringPath(r, p)).join('')
  if (g.type === 'MultiPolygon') return (g.coordinates as Pt[][][]).map((poly) => poly.map((r) => ringPath(r, p)).join('')).join('')
  const lines = g.type === 'LineString' ? [g.coordinates as Pt[]] : g.type === 'MultiLineString' ? (g.coordinates as Pt[][]) : []
  return lines
    .map((l) =>
      l
        .map((c, i) => {
          const [x, y] = p(c)
          return `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`
        })
        .join(''),
    )
    .join('')
}

function useMotionMode(): 'static' | 'reduced' | 'full' {
  const [params] = useSearchParams()
  if (params.get('static') === '1') return 'static'
  return isEnabled('demoAnimations') && !prefersReducedMotion() ? 'full' : 'reduced'
}

/* ------------------------------------------------------------------ section */

export default function Section() {
  const { lang } = useI18n()
  const [pack, setPack] = useState<RegionPack | null>(null)
  const [geo, setGeo] = useState<RegionGeo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([loadRegion(DEFAULT_REGION_ID), loadRegionGeo(DEFAULT_REGION_ID)])
      .then(([p, g]) => {
        if (!alive) return
        setPack(p)
        setGeo(g)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [])

  if (error)
    return (
      <div className="dk-root dk-rg" role="alert">
        <p className="dk-rg-error">{T.failed[lang]} <code>{error}</code></p>
      </div>
    )
  if (!pack || !geo)
    return (
      <div className="dk-root dk-rg" aria-busy="true">
        <div className="dk-rg-skel" />
        <p className="dk-rg-muted">{T.loading[lang]}</p>
      </div>
    )
  return <Loaded pack={pack} geo={geo} lang={lang} />
}

function Loaded({ pack, geo, lang }: { pack: RegionPack; geo: RegionGeo; lang: Lang }) {
  const rt = useMemo(() => regionText(pack, lang), [pack, lang])
  return (
    <div className="dk-root dk-rg" data-eco="satu-daerah">
      <header className="dk-rg-head">
        <div>
          <p className="dk-rg-eyebrow">{rt.place} · {rt.typeLabel}</p>
          <h3 className="dk-rg-title">{rt.name}</h3>
          <p className="dk-rg-muted">{rt.summary}</p>
        </div>
        <p className="dk-rg-greet" lang="jv">
          “{pack.languages.samples.greetings[0]?.text}”
          <span className="dk-rg-greet-tr" lang={lang}>{lang === 'id' ? pack.languages.samples.greetings[0]?.id : pack.languages.samples.greetings[0]?.en}</span>
        </p>
      </header>
      <div className="dk-rg-grid">
        <MapCard pack={pack} geo={geo} lang={lang} />
        <div className="dk-rg-side">
          <StatsCard pack={pack} lang={lang} />
          <EconomyCard pack={pack} lang={lang} />
        </div>
      </div>
      <TemplatesCard pack={pack} lang={lang} />
      <SourcesCard pack={pack} lang={lang} />
    </div>
  )
}

/* ------------------------------------------------------------------ map */

function MapCard({ pack, geo, lang }: { pack: RegionPack; geo: RegionGeo; lang: Lang }) {
  const mode = useMotionMode()
  const nf = useMemo(() => new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB'), [lang])
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ flood: true, roads: true, streams: true, markets: true, landmarks: true })
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const proj = useMemo(() => makeProjection(pack.bbox), [pack.bbox])
  const kecPaths = useMemo(
    () => geo.kecamatan.features.map((f) => ({ id: String(f.properties?.id), d: geomPath(f.geometry, proj.p) })),
    [geo, proj],
  )
  const desaPaths = useMemo(
    () => (geo.desa?.features ?? []).map((f) => ({ kec: String(f.properties?.kecamatanId), id: String(f.properties?.id), d: geomPath(f.geometry, proj.p) })),
    [geo, proj],
  )
  const rivers = useMemo(
    () =>
      geo.rivers.features.map((f) => ({
        id: String(f.properties?.id),
        kind: String(f.properties?.kind),
        main: f.properties?.main === true,
        d: geomPath(f.geometry, proj.p),
      })),
    [geo, proj],
  )
  const roads = useMemo(() => (geo.roads?.features ?? []).map((f) => ({ id: String(f.properties?.id), cls: String(f.properties?.class), d: geomPath(f.geometry, proj.p) })), [geo, proj])
  const flood = useMemo(() => geo.hazards.flood.features.map((f) => ({ level: String(f.properties?.level), d: geomPath(f.geometry, proj.p) })), [geo, proj])
  const kecById = useMemo(() => Object.fromEntries(pack.kecamatan.map((k) => [k.id, k])), [pack])

  // first-view motion: kecamatan fade-in stagger + Bengawan Solo draw (stroke-dashoffset)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || mode !== 'full') return
    const ctx = gsap.context(() => {
      gsap.from(svg.querySelectorAll('.dk-rg-kec'), { opacity: 0, duration: DEMO.panel, stagger: MAP.stagger, ease: 'power2.out' })
      svg.querySelectorAll<SVGPathElement>('.dk-rg-river.is-main').forEach((el) => {
        const len = el.getTotalLength()
        gsap.fromTo(el, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: DEMO.chartDraw, delay: 0.2, ease: 'power1.inOut', clearProps: 'strokeDasharray,strokeDashoffset' })
      })
    }, svg)
    return () => ctx.revert()
  }, [mode])

  const toggle = (l: Layer) => setLayers((s) => ({ ...s, [l]: !s[l] }))
  const toLocal = (clientX: number, clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect()
    return r ? { x: clientX - r.left, y: clientY - r.top } : { x: 0, y: 0 }
  }
  const onMove = (id: string) => (e: PointerEvent<SVGPathElement>) => setHover({ id, ...toLocal(e.clientX, e.clientY) })
  const onFocus = (id: string) => () => {
    const k = kecById[id]
    const svg = svgRef.current
    if (!k || !svg) return
    const [x, y] = proj.p(k.centroid as Pt)
    const s = svg.getBoundingClientRect().width / MAP.width
    setHover({ id, x: x * s, y: y * s })
  }
  const onKey = (id: string) => (e: KeyboardEvent<SVGPathElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelected((cur) => (cur === id ? null : id))
    }
    if (e.key === 'Escape') setSelected(null)
  }

  const hk = hover ? kecById[hover.id] : undefined
  const sel = selected ? kecById[selected] : undefined
  const wrapW = wrapRef.current?.clientWidth ?? 0
  const floodSet = new Set(pack.scenario.floodKecamatanIds)

  return (
    <section className="dk-rg-card dk-rg-mapcard" aria-labelledby="rg-map-h">
      <div className="dk-rg-card-h">
        <h4 id="rg-map-h" className="dk-rg-h">{T.map[lang]}</h4>
        <p className="dk-rg-muted dk-rg-small">{T.mapLead[lang]}</p>
      </div>
      <div className="dk-rg-chips" role="group" aria-label={T.layers[lang]}>
        {(['flood', 'roads', 'streams', 'markets', 'landmarks'] as Layer[]).map((l) => (
          <Chip key={l} selected={layers[l]} onToggle={() => toggle(l)}>
            <span className={`dk-rg-swatch is-${l}`} aria-hidden="true" />
            {T[l][lang]}
          </Chip>
        ))}
      </div>
      <div className="dk-rg-mapwrap" ref={wrapRef} onPointerLeave={() => setHover(null)}>
        <svg ref={svgRef} className="dk-rg-svg" viewBox={`0 0 ${MAP.width} ${proj.height}`} role="group" aria-label={T.map[lang]}>
          <g className="dk-rg-kecs">
            {kecPaths.map((k) => {
              const kk = kecById[k.id]
              return (
                <path
                  key={k.id}
                  d={k.d}
                  className={`dk-rg-kec${selected === k.id ? ' is-selected' : ''}${hover?.id === k.id ? ' is-hover' : ''}${floodSet.has(k.id) ? ' is-scenario' : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selected === k.id}
                  aria-label={`${kk?.name ?? k.id}, ${nf.format(kk?.population ?? 0)} ${T.people[lang]}`}
                  onPointerMove={onMove(k.id)}
                  onPointerDown={onMove(k.id)}
                  onFocus={onFocus(k.id)}
                  onBlur={() => setHover(null)}
                  onClick={() => setSelected((cur) => (cur === k.id ? null : k.id))}
                  onKeyDown={onKey(k.id)}
                />
              )
            })}
          </g>
          {sel && (
            <g className="dk-rg-desas" aria-hidden="true">
              {desaPaths.filter((d) => d.kec === sel.id).map((d) => <path key={d.id} d={d.d} className="dk-rg-desa" />)}
            </g>
          )}
          {layers.flood && (
            <g className="dk-rg-flood" aria-hidden="true">
              {flood.map((f) => <path key={f.level} d={f.d} className={`dk-rg-flood-${f.level}`} fillRule="evenodd" />)}
            </g>
          )}
          {layers.roads && (
            <g aria-hidden="true">
              {roads.map((r) => <path key={r.id} d={r.d} className={`dk-rg-road is-${r.cls}`} />)}
            </g>
          )}
          <g aria-hidden="true">
            {rivers
              .filter((r) => r.kind !== 'stream' || layers.streams)
              .map((r) => (
                <path key={r.id} d={r.d} className={`dk-rg-river is-${r.kind}${r.main ? ' is-main' : ''}`} fillRule="evenodd" />
              ))}
          </g>
          {layers.markets && (
            <g aria-hidden="true">
              {pack.markets.map((m) => {
                const [x, y] = proj.p(m.coord as Pt)
                return <circle key={m.id} cx={f1(x)} cy={f1(y)} r={m.id === pack.scenario.shopMarketId ? 6 : 4} className={`dk-rg-market${m.id === pack.scenario.shopMarketId ? ' is-anchor' : ''}`} />
              })}
            </g>
          )}
          {layers.landmarks && (
            <g aria-hidden="true">
              {pack.landmarks.map((l) => {
                const [x, y] = proj.p(l.coord as Pt)
                return (
                  <g key={l.id} transform={`translate(${f1(x)} ${f1(y)})`} className={`dk-rg-lm is-${l.kind}`}>
                    <rect x={-6} y={-6} width={12} height={12} rx={3} />
                    <text y={3.5} textAnchor="middle">{LM_GLYPH[l.kind]}</text>
                  </g>
                )
              })}
            </g>
          )}
        </svg>
        {hk && hover && (
          <div
            className="dk-rg-tip"
            role="status"
            style={{ '--x': `${Math.min(hover.x + 14, Math.max(0, wrapW - 220))}px`, '--y': `${hover.y + 14}px` } as CSSProperties}
          >
            <strong>{hk.name}</strong>
            <span>{nf.format(hk.population)} {T.people[lang]} · {hk.desa.length} {T.villages[lang]}</span>
            <span>{T.floodRisk[lang]} {Math.round(hk.riskFlood * 100)}% <em>({T.derived[lang]})</em></span>
          </div>
        )}
      </div>
      <Legend pack={pack} lang={lang} layers={layers} />
      <KecDetail kec={sel} lang={lang} onClose={() => setSelected(null)} />
      <p className="dk-rg-attr">
        {lang === 'id' ? 'Batas: HDX COD-AB (BPS/OCHA, CC BY-IGO) · Sungai, jalan, pasar, landmark: © OpenStreetMap contributors (ODbL)' : 'Boundaries: HDX COD-AB (BPS/OCHA, CC BY-IGO) · Rivers, roads, markets, landmarks: © OpenStreetMap contributors (ODbL)'}
        {layers.flood && <> · {T.derivedNote[lang]}</>}
      </p>
    </section>
  )
}

function Legend({ pack, lang, layers }: { pack: RegionPack; lang: Lang; layers: Record<Layer, boolean> }) {
  const kinds = [...new Set(pack.landmarks.map((l) => l.kind))]
  return (
    <ul className="dk-rg-legend" aria-label={lang === 'id' ? 'Legenda' : 'Legend'}>
      <li><span className="dk-rg-key is-river" aria-hidden="true" />Bengawan Solo</li>
      {layers.flood && (
        <>
          <li><span className="dk-rg-key is-flood-tinggi" aria-hidden="true" />{lang === 'id' ? 'Risiko tinggi' : 'High risk'}</li>
          <li><span className="dk-rg-key is-flood-sedang" aria-hidden="true" />{lang === 'id' ? 'Risiko sedang' : 'Medium risk'}</li>
        </>
      )}
      {layers.markets && <li><span className="dk-rg-key is-market" aria-hidden="true" />{T.markets[lang]} ({pack.markets.length})</li>}
      {layers.landmarks &&
        kinds.map((k) => (
          <li key={k}>
            <span className={`dk-rg-key is-lm is-${k}`} aria-hidden="true">{LM_GLYPH[k]}</span>
            {LM_LABEL[k][lang]}
          </li>
        ))}
    </ul>
  )
}

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="dk-rg-meter">
      <span className="dk-rg-meter-l">{label}</span>
      <span className="dk-rg-meter-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
        <span style={{ transform: `scaleX(${value})` }} />
      </span>
      <span className="dk-rg-meter-v dk-num">{Math.round(value * 100)}%</span>
    </div>
  )
}

function KecDetail({ kec, lang, onClose }: { kec: RegionPack['kecamatan'][number] | undefined; lang: Lang; onClose: () => void }) {
  const nf = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB')
  if (!kec) return <p className="dk-rg-detail is-empty dk-rg-muted">{T.pickHint[lang]}</p>
  const kel = kec.desa.filter((d) => d.kind === 'kelurahan').length
  return (
    <div className="dk-rg-detail" aria-live="polite">
      <div className="dk-rg-detail-h">
        <div>
          <strong className="dk-rg-detail-name">{kec.name}</strong>
          <span className="dk-rg-muted dk-rg-small"> · BPS {kec.code} · {nf.format(kec.population)} {T.people[lang]} · {kec.desa.length} {T.villages[lang]}{kel ? ` (${kel} ${T.kelurahan[lang]})` : ''}</span>
        </div>
        <button type="button" className="dk-rg-close" onClick={onClose} aria-label={T.clear[lang]}>×</button>
      </div>
      <div className="dk-rg-detail-meters">
        <Meter value={kec.riskFlood} label={`${T.floodRisk[lang]} (${T.derived[lang]})`} />
        <Meter value={kec.riskLandslide} label={`${T.slideRisk[lang]} (${T.derived[lang]})`} />
      </div>
      <p className="dk-rg-small"><span className="dk-rg-muted">{T.mainSector[lang]}:</span> {kec.mainSector}</p>
      <ul className="dk-rg-desalist">
        {kec.desa.map((d) => (
          <li key={d.id} className={d.kind === 'kelurahan' ? 'is-kel' : undefined}>{d.name}</li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ stats + economy */

function StatsCard({ pack, lang }: { pack: RegionPack; lang: Lang }) {
  const nf = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB')
  const nf2 = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const desa = pack.kecamatan.reduce((a, k) => a + k.desa.length, 0)
  const items: [Bi, string][] = [
    [T.population, nf.format(pack.stats.population)],
    [T.households, nf.format(pack.stats.households)],
    [T.area, `${nf2.format(pack.stats.area_km2)} km²`],
    [T.units, `${pack.kecamatan.length} · ${desa}`],
  ]
  return (
    <section className="dk-rg-card" aria-labelledby="rg-stats-h">
      <h4 id="rg-stats-h" className="dk-rg-h">{T.stats[lang]}</h4>
      <dl className="dk-rg-kpis">
        {items.map(([label, v]) => (
          <div key={label.id} className="dk-rg-kpi">
            <dt>{label[lang]}</dt>
            <dd className="dk-num">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="dk-rg-source">{regionText(pack, lang).statsSource}</p>
    </section>
  )
}

function EconomyCard({ pack, lang }: { pack: RegionPack; lang: Lang }) {
  const nf = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB')
  const pf = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 })
  const sectors = pack.economy.sectors
  // ≤ 6 colours: top 5 + "other" (everything else folded)
  const top = sectors.filter((s) => s.name.id !== 'Lainnya').slice(0, 5)
  const rest = Math.max(0, 100 - top.reduce((a, s) => a + s.share, 0))
  const bars = [...top.map((s) => ({ label: s.name[lang], share: s.share })), { label: lang === 'id' ? 'Lainnya' : 'Other', share: rest }]
  return (
    <section className="dk-rg-card" aria-labelledby="rg-eco-h">
      <h4 id="rg-eco-h" className="dk-rg-h">{T.economy[lang]}</h4>
      <div className="dk-rg-stack" role="img" aria-label={bars.map((b) => `${b.label} ${pf.format(b.share)}%`).join(', ')}>
        {bars.map((b, i) => (
          <span key={b.label} className={`dk-rg-seg c${i}`} style={{ flexGrow: b.share }} />
        ))}
      </div>
      <ul className="dk-rg-stack-legend">
        {bars.map((b, i) => (
          <li key={b.label}>
            <span className={`dk-rg-dot c${i}`} aria-hidden="true" />
            <span>{b.label}</span>
            <span className="dk-num dk-rg-muted">{pf.format(b.share)}%</span>
          </li>
        ))}
      </ul>
      <h5 className="dk-rg-h5">{T.prices[lang]}</h5>
      <ul className="dk-rg-prices">
        {pack.economy.commodities.map((c) => (
          <li key={c.id}>
            <span>{c.name[lang]}</span>
            <span className="dk-num">Rp {nf.format(c.basePrice)}<span className="dk-rg-muted">/{c.unit}</span></span>
          </li>
        ))}
      </ul>
      <p className="dk-rg-source">{lang === 'id' ? 'Sumber' : 'Source'}: {pack.economy.source}</p>
    </section>
  )
}

/* ------------------------------------------------------------------ templates */

function TemplatesCard({ pack, lang }: { pack: RegionPack; lang: Lang }) {
  const rt = useMemo(() => regionText(pack, lang), [pack, lang])
  const [read, setRead] = useState<ReadLang>('jv')
  const [cat, setCat] = useState<ComplaintCategory | 'all'>('all')
  const tpl = pack.languages.samples.complaintTemplates
  const cats = [...new Set(tpl.map((t) => t.category))]
  const list = cat === 'all' ? tpl : tpl.filter((t) => t.category === cat)
  const textOf = (t: (typeof tpl)[number]) => (read === 'jv' ? t.text : t.translation[read])
  return (
    <section className="dk-rg-card dk-rg-tplcard" aria-labelledby="rg-tpl-h">
      <div className="dk-rg-tpl-head">
        <div>
          <h4 id="rg-tpl-h" className="dk-rg-h">{T.templates[lang]}</h4>
          <p className="dk-rg-muted dk-rg-small">
            {rt.languageName('jv')} · {lang === 'id' ? 'dialek Bojonegoroan, ngoko & krama' : 'Bojonegoro dialect, ngoko & krama'} · {tpl.length} template · speech <code>{pack.languages.speechCodes[0]}</code>
          </p>
        </div>
        <Segmented<ReadLang>
          label={T.readIn[lang]}
          size="sm"
          value={read}
          onChange={setRead}
          options={[
            { value: 'jv', label: 'Jawa' },
            { value: 'id', label: 'ID' },
            { value: 'en', label: 'EN' },
          ]}
        />
      </div>
      <div className="dk-rg-chips" role="group" aria-label={lang === 'id' ? 'Kategori' : 'Category'}>
        <Chip selected={cat === 'all'} onToggle={() => setCat('all')}>{T.all[lang]}</Chip>
        {cats.map((c) => (
          <Chip key={c} selected={cat === c} onToggle={() => setCat(cat === c ? 'all' : c)}>
            {rt.category(c)} <span className="dk-rg-muted dk-num">{tpl.filter((t) => t.category === c).length}</span>
          </Chip>
        ))}
      </div>
      <ul className="dk-rg-tpls" aria-live="polite">
        {list.map((t) => (
          <li key={t.id} className="dk-rg-tpl">
            <div className="dk-rg-tpl-meta">
              <Badge tone="accent">{rt.category(t.category)}</Badge>
              <Badge tone={t.urgency === 'tinggi' ? 'danger' : t.urgency === 'sedang' ? 'warn' : 'neutral'}>{T.urgency[t.urgency][lang]}</Badge>
            </div>
            <p className="dk-rg-tpl-text" lang={read === 'jv' ? 'jv' : read}>{textOf(t)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ sources */

function SourcesCard({ pack, lang }: { pack: RegionPack; lang: Lang }) {
  return (
    <details className="dk-rg-card dk-rg-sources">
      <summary className="dk-rg-h">{T.sources[lang]} ({pack.sources.length})</summary>
      <ul>
        {pack.sources.map((s) => (
          <li key={s.layer + s.name}>
            <span className="dk-rg-src-layer">{s.layer}</span>
            <span>
              {/^https?:/.test(s.url) ? (
                <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
              ) : (
                s.name
              )}
              <span className="dk-rg-muted"> · {s.license}{s.year ? ` · ${s.year}` : ''}</span>
              {s.note && <span className="dk-rg-muted dk-rg-src-note">{s.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
