/**
 * siaga-wilayah/MapStage.tsx — the full map (MapView) with this product's layers, the layer switcher, legend,
 * Geo-AI insight card, the clicked-marker card and the procedural imagery hook. All layer data comes from the world
 * (rain cells, flood reports, alerts, facilities, harvest) or the region pack; the specs are memoised so MapView only
 * re-applies what changed.
 */
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { LayerToggle, MapLegend, MapView, alertZones, choropleth, facilityMarkers, pointMarkers, MAPC, type LegendItem, type MapLayer, type MapViewHandle, type MarkerItem } from '../../demo-kit/map'
import { Icon, IconButton } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { rows, shallowEqual, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { loadRegionGeo } from '../../demo-kit/region/loader'
import { harvestValues } from '../../demo-kit/world/satu-daerah'
import { confirmedIds, floodAlerts, floodReports, keyFacilities, clockText } from './data'
import { S, fill, nf, useT, type SKey } from './strings'
import { ensureDesa, forgetDesa, mapReady, mapRef, ui, useUi, type LayerId } from './ui'

const rainOf = (s: WorldState) => s.rainCells
/** a harvest drop (positive number) as "↓12,5 %" (also reads right inside the legend's "< x" / "≥ x" classes) */
const fmtDrop = (lang: 'id' | 'en') => (v: number) => (v > 0 ? `↓${nf(v, lang, 1)} %` : '0 %')

export const MapStage = memo(function MapStage() {
  const { lang, t } = useT()
  const { pack, markMission } = useShell()
  const { regionId } = useSession()
  const on = useUi((s) => s.layers)
  const crop = useUi((s) => s.crop)
  const metric = useUi((s) => s.metric)
  const sites = useUi((s) => s.sites)
  const selectedKec = useUi((s) => s.selectedKec)

  /* ---------------------------------------------------------------- world → layer data */
  const rainT = useWorld(rainOf)
  const cells = useMemo(() => (rainT.ids.length ? rows(rainT) : undefined), [rainT])
  const reports = useWorld(floodReports)
  const confirmed = useWorld(confirmedIds)
  const alerts = useWorld(floodAlerts)
  const facilities = useWorld(keyFacilities)
  const harvest = useWorld((s) => harvestValues(s, metric, crop === 'all' ? undefined : crop), shallowEqual)

  const reportItems = useMemo<MarkerItem[]>(
    () =>
      pointMarkers(reports, (c) => {
        const ok = confirmed.has(c.id)
        return { label: `${c.code} · ${S.report[lang]}`, detail: `${clockText(c.at, lang)} · ${c.summary[lang]}${ok ? ` · ${S.confirmed[lang]}` : ''}`, icon: ok ? 'check' : 'chat', tone: ok ? 'accent' : 'warn' }
      }),
    [reports, confirmed, lang],
  )
  const facItems = useMemo(() => facilityMarkers(facilities, lang), [facilities, lang])
  const zones = useMemo(() => alertZones(alerts), [alerts])
  const siteItems = useMemo<MarkerItem[]>(
    () => sites.map((x) => ({ id: x.id, coord: x.center, icon: 'eye', label: `${x.to[lang]} · ${x.kecamatanName}`, detail: `${x.from[lang]} → ${x.to[lang]} · ${nf(x.areaHa, lang)} ha (${S.sim[lang]})`, tone: 'warn' })),
    [sites, lang],
  )
  const choro = useMemo(() => {
    if (on.landslide && pack) {
      const v: Record<string, number> = {}
      for (const k of pack.kecamatan) v[k.id] = Math.round(k.riskLandslide * 100) / 100
      return choropleth('choro', v, { title: S.lLandslide, unit: S.landslideUnit, format: (n) => nf(n, lang, 2) })
    }
    if (!on.harvest) return null
    const unit = metric === 'change' ? S.harvestUnit : metric === 'estimate' ? S.harvestTon : S.ndviUnit
    const format = metric === 'change' ? fmtDrop(lang) : metric === 'estimate' ? (n: number) => nf(n, lang) : (n: number) => nf(n, lang, 2)
    // change → the DROP vs normal (the kit ramp runs dark → bright, so the hardest-hit districts are the brightest and
    // "no change" stays in the dark base class); fixed breaks so every unaffected district shares one class
    const values = metric === 'change' ? Object.fromEntries(Object.entries(harvest).map(([k, v]) => [k, Math.max(0, Math.round(-v * 10) / 10)])) : harvest
    const breaks = metric === 'change' ? [2, 8, 16, 24] : undefined
    return choropleth('choro', values, { title: S.lHarvest, unit, format, breaks })
  }, [on.landslide, on.harvest, pack, harvest, metric, lang])

  const layers = useMemo<MapLayer[]>(() => {
    const L: MapLayer[] = [
      { id: 'kec', kind: 'kecamatan', visible: on.kec, labels: choro ? 'name+value' : 'name' },
      { id: 'desa', kind: 'desa', visible: on.desa },
      { id: 'rivers', kind: 'rivers', visible: on.rivers },
      { id: 'hazard', kind: 'hazard', visible: on.hazard },
    ]
    if (choro) L.push(choro)
    L.push(
      { id: 'flood', kind: 'flood', visible: on.flood, hour: 0 },
      { id: 'rain', kind: 'rain', visible: on.rain, cells, seed: 7 },
      { id: 'zones', kind: 'zones', visible: on.zones, zones },
      { id: 'facilities', kind: 'markers', visible: on.facilities, items: facItems },
      { id: 'changes', kind: 'markers', visible: on.changes, items: siteItems },
      { id: 'reports', kind: 'markers', visible: on.reports, items: reportItems, size: 'sm' },
    )
    return L
  }, [on, choro, cells, zones, facItems, siteItems, reportItems])

  /* ---------------------------------------------------------------- map handle + imagery */
  const onReady = useCallback((h: MapViewHandle) => {
    mapReady(h)
    const hour = ui.get().hour
    if (hour > 0) {
      h.setTime(hour)
      void ensureDesa()
    }
  }, [])
  const imageryOn = on.imagery
  const imageryUsed = useRef(false)
  useEffect(
    () => () => {
      mapRef.current = null
      forgetDesa()
      if (imageryUsed.current) void import('./imagery').then((m) => m.resetImagery())
    },
    [],
  )
  useEffect(() => {
    if (!pack || (!imageryOn && !imageryUsed.current)) return
    imageryUsed.current = true
    let alive = true
    if (imageryOn) {
      markMission('imagery')
      ui.set({ imageryBusy: true })
    }
    void (async () => {
      const [{ setImagery, painterContext }, { changeSites }, geo] = await Promise.all([import('./imagery'), import('./sites'), loadRegionGeo(pack.id, { desa: false })])
      if (!alive) return
      const s = world.get()
      const centroids: Record<string, [number, number]> = {}
      const desa: { kecamatanId: string; centroid: [number, number] }[] = []
      for (const k of s.region.kecamatan) {
        centroids[k.id] = k.centroid
        for (const d of k.desa) desa.push({ kecamatanId: k.id, centroid: d.centroid })
      }
      const sitesNow = changeSites(pack, geo, centroids)
      if (!ui.get().sites.length) ui.set({ sites: sitesNow })
      const ctx = painterContext(pack, geo, desa, sitesNow)
      await setImagery(mapRef.current?.raw(), ctx, geo, imageryOn, window.matchMedia('(pointer: coarse)').matches)
      if (alive) ui.set({ imageryBusy: false })
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageryOn, pack, regionId])

  const onMarker = useCallback((layer: string, id: string) => ui.set({ picked: { layer, id } }), [])
  const onSelect = useCallback((id: string | null) => ui.set({ selectedKec: id }), [])

  if (!pack) return <div className="dk-sw-map is-loading" />
  return (
    <div className="dk-sw-map">
      <MapView regionId={pack.id} layers={layers} onReady={onReady} onMarker={onMarker} onSelect={onSelect} selectedId={selectedKec} ariaLabel={`${t('map')} · ${pack.shortName}`} className="dk-sw-mapview" />
      <LayerMenu />
      <ImageryBadge />
      <Insight />
      <Picked />
      <Legend choro={choro} />
    </div>
  )
})

/* ------------------------------------------------------------------ layer switcher */
const TOGGLES: { id: LayerId; label: SKey; hint?: SKey; icon: import('../../demo-kit/ui').IconName; swatch?: string }[] = [
  { id: 'flood', label: 'lFlood', icon: 'water', swatch: '#4fd1ff' },
  { id: 'rain', label: 'lRain', icon: 'rain' },
  { id: 'reports', label: 'lReports', hint: 'lReportsHint', icon: 'chat' },
  { id: 'zones', label: 'lZones', icon: 'alert' },
  { id: 'facilities', label: 'lFacilities', hint: 'lFacilitiesHint', icon: 'home' },
  { id: 'imagery', label: 'lImagery', hint: 'lImageryHint', icon: 'globe' },
  { id: 'harvest', label: 'lHarvest', icon: 'grid' },
  { id: 'landslide', label: 'lLandslide', icon: 'alert' },
  { id: 'hazard', label: 'lHazard', hint: 'lHazardHint', icon: 'shield' },
  { id: 'changes', label: 'lChanges', icon: 'eye' },
  { id: 'rivers', label: 'lRivers', icon: 'water' },
  { id: 'desa', label: 'lDesa', hint: 'lDesaHint', icon: 'grid' },
  { id: 'kec', label: 'lKec', icon: 'map' },
]

function LayerMenu() {
  const { lang, t } = useT()
  const open = useUi((s) => s.layersOpen)
  const on = useUi((s) => s.layers)
  const boxRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const count = TOGGLES.filter((x) => on[x.id]).length
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      ui.set({ layersOpen: false })
      btnRef.current?.focus()
    }
    const down = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) ui.set({ layersOpen: false })
    }
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', down)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('pointerdown', down)
    }
  }, [open])
  return (
    <div className="dk-sw-layers" ref={boxRef}>
      <button ref={btnRef} type="button" className="dk-sw-chipbtn" aria-expanded={open} aria-controls="dk-sw-layer-pop" onClick={() => ui.set({ layersOpen: !open })} data-sw="layers">
        <Icon name="layers" size={16} />
        {t('layers')}
        <span className="dk-sw-count dk-num">{count}</span>
      </button>
      {open && (
        <div id="dk-sw-layer-pop" className="dk-sw-layer-pop" role="dialog" aria-label={t('layersTitle')}>
          <LayerToggle
            title={t('layersTitle')}
            items={TOGGLES.map((x) => ({ id: x.id, label: S[x.label][lang], hint: x.hint ? S[x.hint][lang] : undefined, icon: x.icon, swatch: x.swatch, checked: on[x.id] }))}
            onChange={(id, v) => ui.layer(id as LayerId, v)}
          />
        </div>
      )}
    </div>
  )
}

function ImageryBadge() {
  const { t } = useT()
  const on = useUi((s) => s.layers.imagery)
  const busy = useUi((s) => s.imageryBusy)
  if (!on) return null
  return (
    <p className="dk-sw-imgbadge" role="status">
      {busy ? <span className="dk-sw-spin" aria-hidden="true" /> : <Icon name="globe" size={14} />}
      {busy ? t('imageryLoading') : t('imageryBadge')}
    </p>
  )
}

/* ------------------------------------------------------------------ Geo-AI insight */
function Insight() {
  const { lang, t } = useT()
  const impact = useUi((s) => s.impact6)
  const ran = useUi((s) => s.ran)
  const reports = useWorld(floodReports)
  const confirmed = useWorld(confirmedIds)
  const { size } = useShell()
  const off = useUi((s) => s.insightOff)
  if (!ran || !impact || size === 'sm' || off) return null
  const first = impact.desa.reduce((a, d) => (d.onset < a.onset ? d : a), impact.desa[0]!)
  const inZone = new Set(impact.desa.map((d) => d.id))
  const hits = reports.filter((r) => inZone.has(r.desaId)).length
  const conf = confirmed.size ? fill(S.insightConf[lang], { n: confirmed.size }) : hits ? fill(S.insightReports[lang], { n: hits }) : ''
  return (
    <aside className="dk-sw-insight" aria-label={t('insight')}>
      <div className="dk-sw-picked-head">
        <p className="dk-sw-insight-k">
          <Icon name="spark" size={14} />
          {t('insight')}
        </p>
        <IconButton icon="close" label={t('close')} size="sm" onClick={() => ui.set({ insightOff: true })} />
      </div>
      <p>{t('insightRun', { desa: nf(impact.desa.length, lang), kec: impact.kecamatanIds.length, first: first?.name ?? '—', onset: nf(first?.onset ?? 0, lang, 1), conf })}</p>
    </aside>
  )
}

/* ------------------------------------------------------------------ clicked marker */
function Picked() {
  const { lang, t } = useT()
  const picked = useUi((s) => s.picked)
  const item = useWorld((s) => {
    if (!picked) return null
    if (picked.layer === 'reports') {
      const c = s.complaints.byId[picked.id]
      return c ? { kind: 'report' as const, title: c.code, sub: c.summary[lang], at: c.at, kec: c.kecamatanId, desa: c.desaId, ok: confirmedIds(s).has(c.id) } : null
    }
    if (picked.layer === 'facilities') {
      const f = s.facilities.byId[picked.id]
      return f ? { kind: 'facility' as const, title: f.name, sub: f.kind === 'pengungsian' ? fill(S.sheltersOf[lang], { o: nf(f.occupied, lang), c: nf(f.capacity, lang), n: 1 }) : '', at: null, kec: f.kecamatanId ?? '', desa: f.desaId ?? '', ok: false } : null
    }
    return null
  }, shallowEqual)
  const site = useUi((s) => (picked?.layer === 'changes' ? (s.sites.find((x) => x.id === picked.id) ?? null) : null))
  const { pack } = useShell()
  if (!picked || (!item && !site)) return null
  const close = () => ui.set({ picked: null })
  const kecName = (id: string) => pack?.kecamatan.find((k) => k.id === id)?.name ?? id
  return (
    <aside className="dk-sw-picked" aria-live="polite">
      <div className="dk-sw-picked-head">
        <strong>{site ? site.to[lang] : item!.title}</strong>
        <IconButton icon="close" label={t('close')} size="sm" onClick={close} />
      </div>
      {site ? (
        <p>
          {site.from[lang]} → {site.to[lang]} · Kec. {site.kecamatanName} · {nf(site.areaHa, lang)} ha ({t('sim')})
        </p>
      ) : (
        <>
          <p>{item!.sub}</p>
          <p className="dk-sw-muted">
            {item!.at !== null ? `${clockText(item!.at, lang)} · ` : ''}Kec. {kecName(item!.kec)}
          </p>
          {item!.ok && (
            <span className="dk-sw-okbadge">
              <Icon name="check" size={12} />
              {t('confirmed')}
            </span>
          )}
        </>
      )}
    </aside>
  )
}

/* ------------------------------------------------------------------ legend */
function Legend({ choro }: { choro: ReturnType<typeof choropleth> | null }) {
  const { lang, t } = useT()
  const on = useUi((s) => s.layers)
  const { size } = useShell()
  const items = (
    [
      on.flood && { id: 'flood', label: S.lFlood[lang], kind: 'water' },
      on.rain && { id: 'rain', label: S.lRain[lang], kind: 'rain' },
      on.reports && { id: 'reports', label: S.lReports[lang], kind: 'icon', icon: 'chat', tone: 'warn' },
      on.reports && { id: 'conf', label: S.confirmed[lang], kind: 'icon', icon: 'check', tone: 'accent' },
      on.zones && { id: 'zones', label: S.lZones[lang], kind: 'fill', color: MAPC.hazardHigh },
      on.facilities && { id: 'fac', label: S.shelter[lang], kind: 'icon', icon: 'home', tone: 'warn' },
      on.rivers && { id: 'rivers', label: S.lRivers[lang], kind: 'line', color: MAPC.river },
    ] as (LegendItem | false)[]
  ).filter((x): x is LegendItem => !!x)
  if (size === 'sm' && !choro) return null
  return <MapLegend className="dk-sw-legend" title={choro ? undefined : t('legend')} choropleth={choro} items={size === 'sm' || choro ? [] : items} />
}
