/**
 * /lab/_kit showcase section for the "map" module — owned by the map builder.
 * One MapView of Bojonegoro: real layer toggles, the complaints-per-1 000-KK choropleth computed from the
 * simulated world (with the anonymity hatch), markets + landmarks, the rain radar + growing flood driven by the
 * time scrubber, the legend and the accessible kecamatan list that flies the map.
 * ?static=1 renders the scrubber at +4 h without animation.
 * Desa polygons are lazy: the impact list asks the map (handle.loadDesa / floodImpact) once the scrubber leaves +0 h.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n, type Lang } from '../../lib/i18n'
import { DEFAULT_REGION_ID, loadRegion } from '../region/loader'
import type { RegionPack } from '../region/types'
import { DEFAULT_SEED, loadWorld, rows, useWorld, world, type Complaint } from '../world'
import {
  KecamatanList,
  LayerToggle,
  MapLegend,
  MapView,
  TimeScrubber,
  belowThreshold,
  choropleth,
  countByKecamatan,
  facilityMarkers,
  heatPoints,
  landmarkMarkers,
  marketMarkers,
  perThousandKK,
  pointMarkers,
  MAPC,
  type LegendItem,
  type MapLayer,
  type MapViewHandle,
} from '../map'
import '../ui/tokens.css'
import './map.css'

/* ------------------------------------------------------------------ constants (module-local) */
const SC = {
  /** kecamatan with fewer complaints than this are hidden (anonymity threshold demo) */
  minComplaints: 3,
  /** flood/rain hour shown with ?static=1 */
  staticHour: 4,
  /** affected desa listed under the scrubber */
  topDesa: 5,
}

type Bi = { id: string; en: string }
const T = {
  lead: {
    id: 'Satu peta untuk semua demo berpeta: batas kecamatan & desa nyata, choropleth dari dunia simulasi, pasar dan fasilitas, hujan radar yang bergerak masuk, dan genangan yang tumbuh mengikuti waktu.',
    en: 'One map for every map demo: real district & village boundaries, a choropleth from the simulated world, markets and facilities, radar rain moving in, and inundation that grows with time.',
  },
  choro: { id: 'Aduan per 1.000 KK', en: 'Complaints per 1,000 households' },
  choroUnit: { id: 'aduan / 1.000 KK (data simulasi)', en: 'complaints / 1,000 households (simulated)' },
  choroNote: {
    id: 'KK per kecamatan ∝ penduduk (angka simulasi). Kecamatan dengan < 3 aduan disembunyikan (ambang anonimitas).',
    en: 'Households per district ∝ population (simulated figures). Districts with < 3 complaints are hidden (anonymity threshold).',
  },
  kec: { id: 'Batas kecamatan', en: 'District boundaries' },
  desa: { id: 'Batas desa/kelurahan', en: 'Village boundaries' },
  desaHint: { id: 'nama desa tampil saat diperbesar', en: 'village names appear when zoomed in' },
  rivers: { id: 'Sungai & waduk', en: 'Rivers & reservoirs' },
  hazard: { id: 'Zona risiko banjir (turunan)', en: 'Flood-risk zones (derived)' },
  heat: { id: 'Kepadatan aduan', en: 'Complaint density' },
  complaints: { id: 'Titik aduan', en: 'Complaint points' },
  zones: { id: 'Zona peringatan (skenario)', en: 'Warning zones (scenario)' },
  imagery: { id: 'Citra satelit', en: 'Satellite imagery' },
  facilities: { id: 'Fasilitas & pengungsian', en: 'Facilities & shelters' },
  markets: { id: 'Pasar tradisional', en: 'Traditional markets' },
  landmarks: { id: 'Fasilitas penting', en: 'Key facilities' },
  flood: { id: 'Prediksi genangan', en: 'Predicted inundation' },
  rain: { id: 'Hujan (radar simulasi)', en: 'Rain (simulated radar)' },
  impact: { id: 'Dampak prediksi', en: 'Forecast impact' },
  desaCount: { id: 'desa terdampak', en: 'villages affected' },
  people: { id: 'perkiraan jiwa', en: 'est. people' },
  area: { id: 'km² tergenang', en: 'km² flooded' },
  dry: { id: 'Belum ada genangan pada waktu ini. Putar waktu ke depan.', en: 'No inundation at this time yet. Play time forward.' },
  floodNote: { id: 'Prediksi turunan (jarak ke Bengawan Solo × zona risiko), simulasi — bukan peta resmi BNPB.', en: 'Derived prediction (distance to the Bengawan Solo × risk zones), simulated — not an official BNPB map.' },
  loading: { id: 'Memuat region dan dunia simulasi…', en: 'Loading region and simulated world…' },
  loadingDesa: { id: 'Memuat batas desa…', en: 'Loading village boundaries…' },
  complaintsWord: { id: 'aduan', en: 'complaints' },
} satisfies Record<string, Bi>

const t = (k: keyof typeof T, lang: Lang) => T[k][lang]
const URG: Record<Complaint['urgency'], 'danger' | 'warn' | 'neutral'> = { tinggi: 'danger', sedang: 'warn', rendah: 'neutral' }

type ToggleId = 'kec' | 'desa' | 'rivers' | 'hazard' | 'choro' | 'heat' | 'complaints' | 'markets' | 'landmarks' | 'flood' | 'rain' | 'zones' | 'imagery' | 'facilities'

export default function Section() {
  const { lang } = useI18n()
  const [params] = useSearchParams()
  const isStatic = params.get('static') === '1'
  const mapRef = useRef<MapViewHandle>(null)
  const [pack, setPack] = useState<RegionPack | null>(null)
  const [desaReady, setDesaReady] = useState(false)
  const [hour, setHour] = useState(isStatic ? SC.staticHour : 0)
  const [selected, setSelected] = useState<string | null>(null)
  const [on, setOn] = useState<Record<ToggleId, boolean>>({
    kec: true,
    desa: true,
    rivers: true,
    hazard: false,
    choro: true,
    heat: false,
    complaints: false,
    markets: true,
    landmarks: false,
    flood: true,
    rain: true,
    zones: false,
    imagery: false,
    facilities: false,
  })

  useEffect(() => {
    let alive = true
    void loadRegion(DEFAULT_REGION_ID).then(async (p) => {
      if (!alive) return
      setPack(p)
      const s = world.get()
      if (world.status() !== 'ready' || s.regionId !== p.id) await loadWorld(p, DEFAULT_SEED)
    })
    return () => {
      alive = false
    }
  }, [])

  const complaints = useWorld((s) => s.complaints)
  const list = useMemo(() => rows(complaints), [complaints])
  const counts = useMemo(() => countByKecamatan(list), [list])
  const values = useMemo(() => (pack ? perThousandKK(pack, counts) : {}), [pack, counts])
  const hidden = useMemo(() => (pack && list.length ? belowThreshold(pack, counts, SC.minComplaints) : []), [pack, counts, list.length])

  const choroSpec = useMemo(() => choropleth('choro', values, { hidden, title: T.choro, unit: T.choroUnit, visible: on.choro }), [values, hidden, on.choro])
  const markets = useMemo(() => (pack ? marketMarkers(pack, lang) : []), [pack, lang])
  const landmarks = useMemo(() => (pack ? landmarkMarkers(pack, lang, ['kantor', 'rs', 'puskesmas', 'bendungan']) : []), [pack, lang])
  const heat = useMemo(() => heatPoints(list, (c) => (c.urgency === 'tinggi' ? 1 : c.urgency === 'sedang' ? 0.6 : 0.35)), [list])
  const points = useMemo(
    () => pointMarkers(list.slice(0, 80), (c) => ({ label: c.code, detail: `${c.summary[lang]}`, icon: c.category === 'banjir' ? 'water' : 'chat', tone: URG[c.urgency] })),
    [list, lang],
  )

  const floodKec = useWorld((s) => s.region.floodKecamatanIds)
  const zones = useMemo(() => [{ kecamatanIds: floodKec.slice(0, 2), tone: 'danger' as const }, { kecamatanIds: floodKec.slice(2), tone: 'warn' as const }], [floodKec])
  const facilityRows = useWorld((s) => s.facilities)
  const facilities = useMemo(() => facilityMarkers(rows(facilityRows).filter((f) => f.kind === 'pengungsian' || f.kind === 'rs'), lang), [facilityRows, lang])
  const layers = useMemo<MapLayer[]>(
    () => [
      { id: 'kec', kind: 'kecamatan', visible: on.kec, labels: 'name+value' },
      { id: 'desa', kind: 'desa', visible: on.desa },
      { id: 'rivers', kind: 'rivers', visible: on.rivers },
      { id: 'hazard', kind: 'hazard', visible: on.hazard },
      choroSpec,
      { id: 'flood', kind: 'flood', visible: on.flood, hour: isStatic ? SC.staticHour : 0 },
      { id: 'heat', kind: 'heat', visible: on.heat, points: heat },
      { id: 'rain', kind: 'rain', visible: on.rain, seed: DEFAULT_SEED, animate: !isStatic },
      { id: 'landmarks', kind: 'markers', visible: on.landmarks, items: landmarks },
      { id: 'markets', kind: 'markers', visible: on.markets, items: markets },
      { id: 'complaints', kind: 'markers', visible: on.complaints, items: points, size: 'sm' },
      { id: 'zones', kind: 'zones', visible: on.zones, zones: zones },
      { id: 'imagery', kind: 'imagery', visible: on.imagery, opacity: 0.85 },
      { id: 'facilities', kind: 'markers', visible: on.facilities, items: facilities },
    ],
    [on, choroSpec, heat, landmarks, markets, points, isStatic],
  )

  // the impact list needs desa polygons: ask the map for them once the scrubber leaves +0 h (same model it paints)
  const wantImpact = !!pack && hour > 0
  useEffect(() => {
    if (!wantImpact || desaReady) return
    let alive = true
    mapRef.current?.loadDesa().then(
      () => alive && setDesaReady(true),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [wantImpact, desaReady])
  const impact = useMemo(() => (desaReady && hour > 0 ? (mapRef.current?.floodImpact(hour) ?? null) : null), [desaReady, hour])
  const impactLoading = wantImpact && !desaReady

  const toggles: { id: ToggleId; label: string; hint?: string; icon?: import('../ui').IconName; swatch?: string }[] = [
    { id: 'choro', label: t('choro', lang), icon: 'chart', swatch: '#35a597' },
    { id: 'flood', label: t('flood', lang), icon: 'water', swatch: '#4fd1ff' },
    { id: 'rain', label: t('rain', lang), icon: 'rain' },
    { id: 'markets', label: t('markets', lang), icon: 'cart' },
    { id: 'landmarks', label: t('landmarks', lang), icon: 'building' },
    { id: 'heat', label: t('heat', lang), icon: 'pulse' },
    { id: 'complaints', label: t('complaints', lang), icon: 'chat' },
    { id: 'hazard', label: t('hazard', lang), icon: 'alert' },
    { id: 'zones', label: t('zones', lang), icon: 'alert' },
    { id: 'facilities', label: t('facilities', lang), icon: 'home' },
    { id: 'imagery', label: t('imagery', lang), icon: 'map' },
    { id: 'rivers', label: t('rivers', lang), icon: 'water' },
    { id: 'desa', label: t('desa', lang), hint: t('desaHint', lang), icon: 'grid' },
    { id: 'kec', label: t('kec', lang), icon: 'map' },
  ]

  const legendItems = ([
    on.flood && { id: 'flood', label: t('flood', lang), kind: 'water' as const },
    on.rain && { id: 'rain', label: t('rain', lang), kind: 'rain' as const },
    on.heat && { id: 'heat', label: t('heat', lang), kind: 'heat' as const },
    on.markets && { id: 'markets', label: t('markets', lang), kind: 'icon' as const, icon: 'cart' as const, tone: 'accent' as const },
    on.landmarks && { id: 'landmarks', label: t('landmarks', lang), kind: 'icon' as const, icon: 'building' as const, tone: 'neutral' as const },
    on.complaints && { id: 'complaints', label: t('complaints', lang), kind: 'icon' as const, icon: 'chat' as const, tone: 'danger' as const },
    on.rivers && { id: 'rivers', label: t('rivers', lang), kind: 'line' as const, color: MAPC.river },
    on.hazard && { id: 'hazard', label: t('hazard', lang), kind: 'dash' as const, color: MAPC.hazardHigh },
  ] as (LegendItem | false)[]).filter((x): x is LegendItem => !!x)

  const nf = (n: number, d = 0) => new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: d }).format(n)
  const kecItems = useMemo(() => pack?.kecamatan.map((k) => ({ id: k.id, name: k.name })) ?? [], [pack])

  if (!pack) return <p className="dk-sc-empty">{t('loading', lang)}</p>

  return (
    <div className="dk-root dk-scm" data-eco="satu-daerah">
      <p className="dk-scm-lead">{t('lead', lang)}</p>
      <div className="dk-scm-grid">
        <div className="dk-scm-main">
          <MapView
            ref={mapRef}
            regionId={pack.id}
            layers={layers}
            selectedId={selected}
            onSelect={(id) => setSelected(id)}
            className="dk-scm-map"
          />
          <div className="dk-scm-time">
            <TimeScrubber value={hour} onChange={setHour} onFrame={(h) => mapRef.current?.setTime(h)} />
            <section className="dk-scm-impact" aria-live="polite" aria-label={t('impact', lang)}>
              <h3>{t('impact', lang)}</h3>
              {impact && impact.desa.length ? (
                <>
                  <dl className="dk-scm-kpis">
                    <div>
                      <dt>{t('desaCount', lang)}</dt>
                      <dd className="dk-num">{nf(impact.desa.length)}</dd>
                    </div>
                    <div>
                      <dt>{t('people', lang)}</dt>
                      <dd className="dk-num">{nf(Math.round(impact.people / 100) * 100)}</dd>
                    </div>
                    <div>
                      <dt>{t('area', lang)}</dt>
                      <dd className="dk-num">{nf(impact.areaKm2, 1)}</dd>
                    </div>
                  </dl>
                  <ol className="dk-scm-desa">
                    {impact.desa.slice(0, SC.topDesa).map((d) => (
                      <li key={d.id}>
                        <button type="button" onClick={() => { setSelected(d.kecamatanId); mapRef.current?.fitKecamatan(d.kecamatanId) }}>
                          <span>{d.name}</span>
                          <span className="dk-scm-kec">{pack.kecamatan.find((k) => k.id === d.kecamatanId)?.name}</span>
                          <span className="dk-num">{nf(d.share * 100)} %</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </>
              ) : impactLoading ? (
                <p className="dk-scm-dry" aria-busy="true">
                  {t('loadingDesa', lang)}
                </p>
              ) : (
                <p className="dk-scm-dry">{t('dry', lang)}</p>
              )}
              <p className="dk-scm-note">{t('floodNote', lang)}</p>
            </section>
          </div>
        </div>
        <aside className="dk-scm-side">
          <LayerToggle items={toggles.map((x) => ({ ...x, checked: on[x.id] }))} onChange={(id, v) => setOn((o) => ({ ...o, [id as ToggleId]: v }))} />
          <MapLegend choropleth={on.choro ? choroSpec : null} items={legendItems} note={on.choro ? t('choroNote', lang) : undefined} />
          <KecamatanList
            items={kecItems}
            values={on.choro ? values : undefined}
            hidden={on.choro ? hidden : undefined}
            unit={on.choro ? t('choroUnit', lang) : undefined}
            selectedId={selected}
            onPick={(id) => {
              setSelected(id)
              mapRef.current?.fitKecamatan(id)
            }}
            onFocusItem={(id) => mapRef.current?.highlight(id)}
          />
        </aside>
      </div>
    </div>
  )
}
