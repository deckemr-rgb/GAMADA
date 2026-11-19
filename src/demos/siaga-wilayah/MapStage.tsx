/**
 * siaga-wilayah/MapStage.tsx — the full map (MapView) with this product's layers, the layer switcher, legend,
 * Geo-AI insight card and the clicked-marker card. All layer data comes from the world (rain cells, flood reports,
 * alerts, facilities, harvest) or the region pack; the specs are memoised so MapView only re-applies what changed.
 * "Citra satelit" is the kit `imagery` layer: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0, listed in Sumber).
 * On a narrow map (< 760 px: laptops with the guide open) the insight and the legend fold into chips so the river
 * corridor where the flood grows stays visible.
 */
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { LayerToggle, MapLegend, MapView, alertZones, choropleth, facilityMarkers, pointMarkers, MAPC, type LegendItem, type MapLayer, type MapViewHandle, type MarkerItem } from '../../demo-kit/map'
import { Icon, IconButton } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import AppLink from '../../components/AppLink'
import { clock, rows, shallowEqual, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { harvestValues } from '../../demo-kit/world/satu-daerah'
import { allGauges, arrivalAt, arrivals, canSend, confirmedIds, floodAlerts, floodReports, forecastRain, gaugeName, gaugeNow, keyFacilities, clockText, levelState, productHref, riverGauge, riverLevelAt, shelterOcc, shelters, suggestedLevel, swRole, warnZone } from './data'
import { S, fill, nf, useT, type SKey } from './strings'
import { afterPaintDo, camMoved, ensureDesa, forgetDesa, mapReady, mapRef, ui, useUi, type LayerId } from './ui'

const clockBucket = () => Math.floor(clock.get().minutes / 10) * 10
const rainOf = (s: WorldState) => s.rainCells
const regionOf = (s: WorldState) => s.region
/** a harvest drop (positive number) as "↓12,5 %" (also reads right inside the legend's "< x" / "≥ x" classes) */
const fmtDrop = (lang: 'id' | 'en') => (v: number) => (v > 0 ? `↓${nf(v, lang, 1)} %` : '0 %')

interface RawMap {
  fitBounds(b: [[number, number], [number, number]], o: { padding: { top: number; bottom: number; left: number; right: number }; duration: number }): void
  getContainer(): HTMLElement
  isMoving(): boolean
  on(ev: string, fn: (e: { originalEvent?: unknown }) => void): void
  off(ev: string, fn: (e: { originalEvent?: unknown }) => void): void
}
/**
 * Phones: the kit fit keeps a column free for its map buttons on the right (≈ 90 px of a 358 px map), which leaves
 * the wide region small. Here those buttons sit above the region, so frame it edge to edge instead, again after a
 * layout resize, until the visitor (or a fly-to) moves the map. The map's Home button restores the kit fit.
 */
function phoneFit(h: MapViewHandle, bbox: readonly [number, number, number, number]): () => void {
  const m = h.raw() as RawMap | null
  if (!m || typeof m.fitBounds !== 'function') return () => {}
  const t0 = performance.now()
  // already flying (an arrival with ?focus=, a region switch): leave that camera alone
  let custom = m.isMoving()
  let raf = 0
  const fit = () => {
    const w = m.getContainer().clientWidth
    // a visitor gesture, a camera move this product asked for (forecast framing, a report, a district) or a flight
    // still running always wins over the region framing
    if (custom || camMoved.at > t0 || m.isMoving() || !w || w >= 640) return
    m.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: { top: 64, bottom: 52, left: 10, right: 10 }, duration: 0 })
  }
  const onMove = (e: { originalEvent?: unknown }) => {
    if (e.originalEvent) custom = true
  }
  // the kit re-fits on resize (its own padding) while its camera is untouched: frame it our way again next frame
  const onResize = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(fit)
  }
  m.on('movestart', onMove)
  m.on('resize', onResize)
  fit()
  return () => {
    cancelAnimationFrame(raf)
    m.off('movestart', onMove)
    m.off('resize', onResize)
  }
}

export const MapStage = memo(function MapStage() {
  const { lang, t } = useT()
  const { pack, markMission, size } = useShell()
  const on = useUi((s) => s.layers)
  const crop = useUi((s) => s.crop)
  const metric = useUi((s) => s.metric)
  const sites = useUi((s) => s.sites)
  const selectedKec = useUi((s) => s.selectedKec)

  /* ---------------------------------------------------------------- world → layer data */
  const rainT = useWorld(rainOf)
  // before the forecast is emitted the map shows the same cells at +0 h (waiting at the western edge)
  const regionT = useWorld(regionOf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preview = useMemo(() => forecastRain(world.get()).cells, [regionT])
  const cells = useMemo(() => (rainT.ids.length ? rows(rainT) : preview), [rainT, preview])
  const reports = useWorld(floodReports)
  const confirmed = useWorld(confirmedIds)
  const alerts = useWorld(floodAlerts)
  const facilities = useWorld(keyFacilities)
  const gauges = useWorld(allGauges)
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
  // the gauge reading follows the world clock (10-minute steps: the marker layer is not re-applied every minute)
  const tick = useSyncExternalStore(clock.subscribe, clockBucket, clockBucket)
  const gaugeItems = useMemo<MarkerItem[]>(
    () =>
      gauges.map((g) => {
        const v = riverLevelAt(g, tick)
        const st = levelState(g, v)
        return { id: g.id, coord: g.coord, icon: 'water', label: `${S.gauge[lang]} · ${gaugeName(g.name, lang)}`, detail: `${fill(S.gaugeOf[lang], { v: nf(v, lang, 2), s: nf(g.siaga, lang, 1), a: nf(g.awas, lang, 1) })} (${S.sim[lang]})`, tone: st === 'awas' ? 'danger' : st === 'siaga' ? 'warn' : 'info' }
      }),
    [gauges, lang, tick],
  )
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
      { id: 'imagery', kind: 'imagery', visible: on.imagery, opacity: 0.92 },
      { id: 'kec', kind: 'kecamatan', visible: on.kec, labels: choro ? 'name+value' : 'name' },
      { id: 'desa', kind: 'desa', visible: on.desa },
      { id: 'rivers', kind: 'rivers', visible: on.rivers },
      { id: 'hazard', kind: 'hazard', visible: on.hazard },
    ]
    if (choro) L.push(choro)
    L.push(
      { id: 'flood', kind: 'flood', visible: on.flood, hour: 0 },
      // no ambient drift: the cells move only with the scrubber, so +3 h always shows the rain over the flood area
      { id: 'rain', kind: 'rain', visible: on.rain, cells, animate: false },
      { id: 'zones', kind: 'zones', visible: on.zones, zones },
      { id: 'facilities', kind: 'markers', visible: on.facilities, items: facItems },
      { id: 'gauges', kind: 'markers', visible: on.gauges, items: gaugeItems, size: 'sm' },
      { id: 'changes', kind: 'markers', visible: on.changes, items: siteItems },
      { id: 'reports', kind: 'markers', visible: on.reports, items: reportItems, size: 'sm' },
    )
    return L
  }, [on, choro, cells, zones, facItems, gaugeItems, siteItems, reportItems])

  // the map re-applies its layers in a deferred render: a switch / tab / scenario click paints first (INP), the map
  // follows in the next frame
  // phones: the warning dialog is a full sheet over the map, so the map holds its last picture while it is open
  // (the new warning zone and its follow-ups paint once, after the sheet closes: no map frame inside "Kirim")
  const held = useRef(layers)
  const covered = useUi((s) => s.broadcastOpen) && size === 'sm'
  if (!covered) held.current = layers
  const mapLayers = useDeferredValue(covered ? held.current : layers)

  /* ---------------------------------------------------------------- map handle + imagery mission */
  const [handle, setHandle] = useState<MapViewHandle | null>(null)
  const onReady = useCallback((h: MapViewHandle) => {
    mapReady(h)
    setHandle(h)
    const hour = ui.get().hour
    if (hour > 0) {
      h.setTime(hour)
      void ensureDesa()
    }
  }, [])
  const bbox = pack?.bbox
  useEffect(() => (handle && bbox ? phoneFit(handle, bbox) : undefined), [handle, bbox])
  useEffect(
    () => () => {
      mapRef.current = null
      forgetDesa()
    },
    [],
  )
  const imageryOn = on.imagery
  useEffect(() => {
    if (imageryOn) markMission('imagery')
  }, [imageryOn, markMission])

  // narrow map (laptop + guide panel open): the overlays fold into chips
  const boxRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setNarrow((e?.contentRect.width ?? 1000) < 760))
    ro.observe(el)
    return () => ro.disconnect()
  }, [pack])

  const onMarker = useCallback((layer: string, id: string) => ui.set(layer === 'gauges' ? { picked: { layer, id }, gauge: id } : { picked: { layer, id } }), [])
  const onSelect = useCallback((id: string | null) => ui.set({ selectedKec: id }), [])

  if (!pack) return <div className="dk-sg-map is-loading" />
  return (
    <div className={`dk-sg-map${narrow ? ' is-narrow' : ''}`} ref={boxRef}>
      <MapView regionId={pack.id} layers={mapLayers} onReady={onReady} onMarker={onMarker} onSelect={onSelect} selectedId={selectedKec} ariaLabel={`${t('map')} · ${pack.shortName}`} className="dk-sg-mapview" notice={{ inset: 56 }} />
      <LayerMenu />
      <ImageryBadge />
      <Insight narrow={narrow} />
      <Picked />
      <KecCard />
      <Legend choro={choro} narrow={narrow} />
    </div>
  )
})

/* ------------------------------------------------------------------ layer switcher */
const TOGGLES: { id: LayerId; label: SKey; hint?: SKey; icon: import('../../demo-kit/ui').IconName }[] = [
  { id: 'flood', label: 'lFlood', icon: 'water' },
  { id: 'rain', label: 'lRain', icon: 'rain' },
  { id: 'reports', label: 'lReports', hint: 'lReportsHint', icon: 'chat' },
  { id: 'zones', label: 'lZones', icon: 'alert' },
  { id: 'facilities', label: 'lFacilities', hint: 'lFacilitiesHint', icon: 'home' },
  { id: 'gauges', label: 'lGauges', hint: 'lGaugesHint', icon: 'water' },
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
    <div className="dk-sg-layers" ref={boxRef}>
      <button ref={btnRef} type="button" className="dk-sg-chipbtn" aria-expanded={open} aria-controls="dk-sg-layer-pop" onClick={() => afterPaintDo(() => ui.set({ layersOpen: !ui.get().layersOpen }))} data-sw="layers">
        <Icon name="layers" size={16} />
        {t('layers')}
        <span className="dk-sg-count dk-num">{count}</span>
      </button>
      {open && (
        <div id="dk-sg-layer-pop" className="dk-sg-layer-pop" role="dialog" aria-label={t('layersTitle')}>
          <LayerToggle
            title={t('layersTitle')}
            items={TOGGLES.map((x) => ({ id: x.id, label: S[x.label][lang], hint: x.hint ? S[x.hint][lang] : undefined, icon: x.icon, checked: on[x.id] }))}
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
  if (!on) return null
  return (
    <p className="dk-sg-imgbadge" role="status">
      <Icon name="globe" size={14} />
      {t('imageryBadge')}
    </p>
  )
}

/* ------------------------------------------------------------------ Geo-AI insight */
function Insight({ narrow }: { narrow: boolean }) {
  const { lang, t } = useT()
  const [open, setOpen] = useState(false)
  const impact = useUi((s) => s.impact6)
  const ran = useUi((s) => s.ran)
  const reports = useWorld(floodReports)
  const confirmed = useWorld(confirmedIds)
  const { size } = useShell()
  const off = useUi((s) => s.insightOff)
  if (!ran || !impact || size === 'sm' || off) return null
  // the earliest village of the warning zone (one definition with the warning card, the AI draft and Geo-AI)
  const first = arrivals(impact, warnZone(world.get(), impact)).inZone[0] ?? impact.desa[0]
  const inZone = new Set(impact.desa.map((d) => d.id))
  const hits = reports.filter((r) => inZone.has(r.desaId)).length
  const conf = confirmed.size ? fill(S.insightConf[lang], { n: confirmed.size }) : hits ? fill(S.insightReports[lang], { n: hits }) : ''
  if (narrow && !open)
    return (
      <button type="button" className="dk-sg-chipbtn dk-sg-insight-chip" aria-expanded={false} onClick={() => setOpen(true)} data-sw="insight-chip">
        <Icon name="spark" size={16} />
        {t('insightChip', { n: nf(impact.desa.length, lang) })}
      </button>
    )
  return (
    <aside className={`dk-sg-insight${narrow ? ' is-open' : ''}`} aria-label={t('insight')}>
      <div className="dk-sg-picked-head">
        <p className="dk-sg-insight-k">
          <Icon name="spark" size={14} />
          {t('insight')}
        </p>
        <IconButton icon="close" label={narrow ? t('fold') : t('close')} size="sm" onClick={() => (narrow ? setOpen(false) : ui.set({ insightOff: true }))} />
      </div>
      <p>{t('insightRun', { desa: nf(impact.desa.length, lang), kec: impact.kecamatanIds.length, first: first?.name ?? '—', t: clockText(arrivalAt(first?.onset ?? 0), lang), conf })}</p>
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
    if (picked.layer === 'gauges') {
      const g = s.gauges.byId[picked.id]
      const m = clock.get().minutes
      return g ? { kind: 'gauge' as const, title: gaugeName(g.name, lang), sub: `${S.gauge[lang]}: ${fill(S.gaugeOf[lang], { v: nf(riverLevelAt(g, m), lang, 2), s: nf(g.siaga, lang, 1), a: nf(g.awas, lang, 1) })}`, at: g.kind === 'sungai' ? m : g.updatedAt, kec: g.kecamatanId ?? '', desa: '', ok: false } : null
    }
    if (picked.layer === 'facilities') {
      const f = s.facilities.byId[picked.id]
      return f ? { kind: 'facility' as const, title: f.name, sub: f.kind === 'pengungsian' ? fill(S.sheltersOf[lang], { o: nf(shelterOcc(s, f, clock.get().minutes), lang), c: nf(f.capacity, lang), n: 1 }) : '', at: null, kec: f.kecamatanId ?? '', desa: f.desaId ?? '', ok: false } : null
    }
    return null
  }, shallowEqual)
  const site = useUi((s) => (picked?.layer === 'changes' ? (s.sites.find((x) => x.id === picked.id) ?? null) : null))
  const { pack } = useShell()
  const session = useSession()
  const shown = !!picked && (!!item || !!site)
  useEffect(() => {
    if (!shown) return
    const key = (e: KeyboardEvent) => {
      // an open dialog / drawer / layer menu handles its own Escape first
      if (e.key !== 'Escape' || document.querySelector('[aria-modal="true"], #dk-sg-layer-pop')) return
      ui.set({ picked: null })
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [shown])
  if (!picked || (!item && !site)) return null
  const close = () => ui.set({ picked: null })
  const kecName = (id: string) => pack?.kecamatan.find((k) => k.id === id)?.name ?? id
  return (
    <aside className="dk-sg-picked" aria-live="polite">
      <div className="dk-sg-picked-head">
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
          <p className="dk-sg-muted">
            {item!.at !== null ? `${clockText(item!.at, lang)} · ` : ''}
            {item!.kec ? `Kec. ${kecName(item!.kec)}` : ''}
            {item!.kind === 'gauge' ? ` · ${t('gaugeSim')}` : ''}
          </p>
          {item!.ok && (
            <span className="dk-sg-okbadge">
              <Icon name="check" size={12} />
              {t('confirmed')}
            </span>
          )}
          {item!.kind === 'report' && (
            <AppLink to={productHref('sapa-warga', session, picked.id)} className="dk-sg-link">
              {t('openSapa')} →
            </AppLink>
          )}
        </>
      )}
    </aside>
  )
}

/* ------------------------------------------------------------------ tapped district: "will it flood, and when?" */
function KecCard() {
  const { lang, t } = useT()
  const sel = useUi((s) => s.selectedKec)
  const picked = useUi((s) => s.picked)
  const ran = useUi((s) => s.ran)
  const i6 = useUi((s) => s.impact6)
  const tab = useUi((s) => s.tab)
  const role = swRole(useSession().role)
  const k = useWorld((s) => (sel ? (s.region.kecamatan.find((x) => x.id === sel) ?? null) : null))
  const alert = useWorld((s) => (sel ? (floodAlerts(s).find((a) => a.kecamatanIds.includes(sel)) ?? null) : null))
  const sh = useWorld(shelters)
  const occOf = (f: (typeof sh)[number]) => shelterOcc(world.get(), f, clock.get().minutes)
  useEffect(() => {
    if (!sel) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[aria-modal="true"], #dk-sg-layer-pop')) return
      ui.set({ selectedKec: null })
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [sel])
  // a marker card wins; the farm tab's own table already reads the district (its choropleth labels carry the values)
  if (!k || picked || tab === 'agri') return null
  const rowsK = (i6?.desa ?? []).filter((d) => d.kecamatanId === k.id).sort((a, b) => a.onset - b.onset)
  const now = clock.get().minutes
  const first = rowsK[0]
  const kx = 111.32 * Math.cos((k.centroid[1] * Math.PI) / 180)
  const near = [...sh].map((f) => ({ f, km: Math.hypot(((f.coord?.[0] ?? 0) - k.centroid[0]) * kx, ((f.coord?.[1] ?? 0) - k.centroid[1]) * 110.57) })).sort((a, b) => (a.f.kecamatanId === k.id ? -1 : 0) - (b.f.kecamatanId === k.id ? -1 : 0) || a.km - b.km)[0]?.f
  const people = rowsK.reduce((n, d) => n + d.people, 0)
  const g = riverGauge(world.get())
  const warn = () => {
    ui.set({
      broadcastOpen: true,
      draft: { level: suggestedLevel(g ? gaugeNow(g, now) : null, g), message: '', channels: ['wa', 'sms'], areas: [k.name] },
    })
  }
  return (
    <aside className="dk-sg-picked dk-sg-keccard" aria-live="polite">
      <div className="dk-sg-picked-head">
        <strong>Kec. {k.name}</strong>
        <IconButton icon="close" label={t('close')} size="sm" onClick={() => ui.set({ selectedKec: null })} />
      </div>
      {!ran || !i6 ? (
        <p>{t('kecNoRun')}</p>
      ) : rowsK.length ? (
        <>
          <p>{t('kecCard', { d: nf(rowsK.length, lang), n: nf(k.desa.length, lang), p: nf(Math.round(people / 100) * 100, lang) })}</p>
          {first && <p className="dk-sg-muted">{t(arrivalAt(first.onset) < now ? 'kecFirstPast' : 'kecFirst', { t: clockText(arrivalAt(first.onset), lang), desa: first.name })}</p>}
        </>
      ) : (
        <p>{t('kecDry')}</p>
      )}
      {near && <p className="dk-sg-muted">{t('kecShelter', { s: near.name, n: nf(Math.max(0, near.capacity - occOf(near)), lang) })}</p>}
      {alert ? (
        <span className="dk-sg-okbadge">
          <Icon name="alert" size={12} />
          {t('kecWarned', { l: alert.level })}
        </span>
      ) : (
        ran && rowsK.length > 0 && canSend(role) && (
          <button type="button" className="dk-sg-link dk-sg-linkbtn" onClick={warn}>
            {t('kecWarn')} →
          </button>
        )
      )}
    </aside>
  )
}

/* ------------------------------------------------------------------ legend */
function Legend({ choro, narrow }: { choro: ReturnType<typeof choropleth> | null; narrow: boolean }) {
  const { lang, t } = useT()
  const on = useUi((s) => s.layers)
  const { size } = useShell()
  const [open, setOpen] = useState(false)
  const items = (
    [
      on.flood && { id: 'flood', label: S.lFlood[lang], kind: 'water' },
      on.rain && { id: 'rain', label: S.lRain[lang], kind: 'rain' },
      on.reports && { id: 'reports', label: S.lReports[lang], kind: 'icon', icon: 'chat', tone: 'warn' },
      on.reports && { id: 'conf', label: S.confirmed[lang], kind: 'icon', icon: 'check', tone: 'accent' },
      on.zones && { id: 'zones', label: S.lZones[lang], kind: 'fill', color: MAPC.hazardHigh },
      on.facilities && { id: 'fac', label: S.shelter[lang], kind: 'icon', icon: 'home', tone: 'warn' },
      on.gauges && { id: 'gauges', label: S.lGauges[lang], kind: 'icon', icon: 'water', tone: 'info' },
      on.rivers && { id: 'rivers', label: S.lRivers[lang], kind: 'line', color: MAPC.river },
    ] as (LegendItem | false)[]
  ).filter((x): x is LegendItem => !!x)
  if (size === 'sm' && !choro) return null
  // narrow map: the legend folds into a chip; phones fold the farmland / landslide scale too (the district labels on
  // the map already carry the values, and the open scale would cover half of a phone map)
  if ((narrow && !choro) || (size === 'sm' && choro))
    return (
      <div className="dk-sg-legend-fold">
        {open && <MapLegend className="dk-sg-legend is-fold" title={choro ? undefined : t('legend')} choropleth={choro} items={choro ? [] : items} />}
        <button type="button" className="dk-sg-chipbtn" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-sw="legend-chip">
          <Icon name={open ? 'close' : 'info'} size={16} />
          {t('legend')}
        </button>
      </div>
    )
  return <MapLegend
 className="dk-sg-legend" title={choro ? undefined : t('legend')} choropleth={choro} items={size === 'sm' || choro ? [] : items} />
}
