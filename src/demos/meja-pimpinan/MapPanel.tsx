/**
 * MapPanel — the real regional map in the centre of the wall (spec P2): layer toggles for complaints (choropleth +
 * density), disaster risk, active alerts (zones + rain cells), market prices and projects, an AI insight that flies
 * to the top district, and the legend. MapLibre itself loads in its own chunk (excluded from the demo budget).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'
import { useShell } from '../../demo-kit/shell'
import { Chip, Icon, IconButton, InsightCallout, Button } from '../../demo-kit/ui'
import { CATEGORY_LABEL, DAY_MIN, rows, shallowEqual, useWorld, type Complaint, type Minutes, type WorldState } from '../../demo-kit/world'
import { complaintsByKecamatan } from '../../demo-kit/world/satu-daerah'
import {
  MapView, alertZones, resolveChoropleth, choropleth, countByKecamatan, heatPoints, marketMarkers, pointMarkers,
  type ChoroplethLayer, type MapLayer, type MapViewHandle, type MarkerItem,
} from '../../demo-kit/map'
import { devOf, opdShort, projectPoints, useNow, weekChange } from './data'
import { nf, tr, trf } from './strings'

type Toggle = 'choro' | 'heat' | 'hazard' | 'zones' | 'markets' | 'projects'
const TOGGLES: { id: Toggle; icon: 'chart' | 'pulse' | 'alert' | 'bell' | 'cart' | 'package' }[] = [
  { id: 'choro', icon: 'chart' },
  { id: 'heat', icon: 'pulse' },
  { id: 'hazard', icon: 'alert' },
  { id: 'zones', icon: 'bell' },
  { id: 'markets', icon: 'cart' },
  { id: 'projects', icon: 'package' },
]
const LABEL: Record<Toggle, 'lChoro' | 'lHeat' | 'lHazard' | 'lZones' | 'lMarkets' | 'lProjects'> = {
  choro: 'lChoro', heat: 'lHeat', hazard: 'lHazard', zones: 'lZones', markets: 'lMarkets', projects: 'lProjects',
}

/** class breaks for small counts: 0 · 1 · 2 · 3–4 · ≥ 5 (or quarters of the max when counts grow) */
function breaksOf(v: Record<string, number>): number[] {
  const max = Math.max(0, ...Object.values(v))
  if (max <= 6) return [1, 2, 3, 5]
  const q = [1, Math.ceil(max * 0.25), Math.ceil(max * 0.5), Math.ceil(max * 0.75)]
  return q.filter((x, i) => i === 0 || x > q[i - 1]!)
}

/** complaints of the last 7 days up to now */
const week = (s: WorldState, now: Minutes) => rows(s.complaints).filter((c) => c.at > now - 7 * DAY_MIN && c.at <= now)

/** lower-case a label for use mid-sentence, but keep acronyms ("PJU mati") */
const lc = (t: string) => (/^[A-Z]{2}/.test(t) ? t : t.toLowerCase())

/** keep the previous value while the new one is equal by content (a stable layer spec = no map re-apply) */
function useStable<T>(v: T, eq: (a: T, b: T) => boolean): T {
  const ref = useRef(v)
  if (ref.current !== v && !eq(ref.current, v)) ref.current = v
  return ref.current
}

/** the district with most complaints in 7 days (optionally only the categories an agency handles), with last week's
 *  count and the dominant category */
function topDistrict(s: WorldState, now: Minutes, cats: Set<string> | null) {
  const cur = new Map<string, number>()
  const prev = new Map<string, number>()
  const byCat = new Map<string, Map<string, number>>()
  const keep = (c: Complaint) => !cats || cats.has(c.category)
  for (const c of rows(s.complaints)) {
    if (!keep(c) || c.at > now) continue
    if (c.at > now - 7 * DAY_MIN) {
      cur.set(c.kecamatanId, (cur.get(c.kecamatanId) ?? 0) + 1)
      const m = byCat.get(c.kecamatanId) ?? new Map<string, number>()
      m.set(c.category, (m.get(c.category) ?? 0) + 1)
      byCat.set(c.kecamatanId, m)
    } else if (c.at > now - 14 * DAY_MIN) prev.set(c.kecamatanId, (prev.get(c.kecamatanId) ?? 0) + 1)
  }
  // the whole region: the kit's ranking (the chat and the briefing use it too, so ties resolve the same way)
  // a tie is broken by name, so the headline does not flip between two districts with the same numbers
  const all = cats ? [] : complaintsByKecamatan(s, now, 7)
  const k0 = cats ? null : all.filter((k) => k.count === all[0]?.count).sort((x, y) => x.name.localeCompare(y.name))[0] ?? null
  const top: [string, number] | undefined = cats ? [...cur.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] : k0 && k0.count ? [k0.kecamatanId, k0.count] : undefined
  if (!top) return null
  const cat = [...(byCat.get(top[0]) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as keyof typeof CATEGORY_LABEL | undefined
  return { kecamatanId: top[0], name: s.region.kecamatan.find((k) => k.id === top[0])?.name ?? top[0], count: top[1], prev: prev.get(top[0]) ?? 0, cat: cat ?? null }
}

export function MapPanel({ selected, onSelect, onReady, onFly, note, onNoteDone, opdId, overlay, phone }: {
  selected: string | null
  onSelect: (id: string | null) => void
  onReady: (h: MapViewHandle) => void
  onFly: (kecamatanId: string, reveal?: boolean) => void
  note: string | null
  onNoteDone: () => void
  /** Kepala OPD view: the insight speaks about this agency's complaint categories */
  opdId?: string | null
  /** something drawn over the top of the map (the hoax banner on the wall screen) */
  overlay?: ReactNode
  phone?: boolean
}) {
  const { lang } = useI18n()
  const { pack } = useShell()
  // the map works on hourly windows: the layers change when the data changes, not every world minute
  const now = useNow(60)
  const [on, setOn] = useState<Record<Toggle, boolean>>({ choro: true, heat: false, hazard: false, zones: true, markets: false, projects: false })
  const complaints = useWorld((s) => s.complaints)
  const clusters = useWorld((s) => s.clusters)
  const alerts = useWorld((s) => s.alerts)
  const rain = useWorld((s) => s.rainCells)
  const prices = useWorld((s) => s.prices)
  const projects = useWorld(projectPoints)
  const opdCats = useWorld((s) => (opdId ? Object.entries(s.region.categoryOpd).filter(([, o]) => o === opdId).map(([c]) => c).join(',') : ''))
  const opdName = useWorld((s) => (opdId ? opdShort(s, opdId) : ''))
  const top = useWorld((s) => topDistrict(s, now, opdId ? new Set(opdCats.split(',').filter(Boolean)) : null), shallowEqual)
  const topCat = top?.cat ?? null

  const weekList = useMemo(() => week({ complaints } as WorldState, now), [complaints, now])
  const counts = useStable(
    useMemo(() => {
      const c = countByKecamatan(weekList)
      return Object.fromEntries((pack?.kecamatan ?? []).map((k) => [k.id, c[k.id] ?? 0])) as Record<string, number>
    }, [weekList, pack]),
    shallowEqual,
  )
  const choroSpec = useMemo(
    () => choropleth('choro', counts, { breaks: breaksOf(counts), title: { id: tr('lChoro', 'id'), en: tr('lChoro', 'en') }, unit: { id: tr('choroUnit', 'id'), en: tr('choroUnit', 'en') }, visible: on.choro, format: (v) => nf(lang, v) }),
    [counts, on.choro, lang],
  )
  const weekKey = useStable(weekList, (a, b) => a.length === b.length && a.every((x, i) => x === b[i]))
  const heat = useMemo(() => heatPoints(weekKey, (c) => (c.urgency === 'tinggi' ? 1 : c.urgency === 'sedang' ? 0.6 : 0.35)), [weekKey])
  const clusterMarkers = useMemo(
    () => rows(clusters).map((c): MarkerItem => ({ id: c.id, coord: c.center, icon: c.category === 'banjir' ? 'water' : 'pin', label: `${tr('cluster', lang)} ${CATEGORY_LABEL[c.category][lang].toLowerCase()}`, detail: `${c.complaintIds.length} ${lang === 'id' ? 'aduan' : 'complaints'} · ${c.radiusKm} km`, tone: 'danger' })),
    [clusters, lang],
  )
  const marketItems = useMemo(() => {
    if (!pack) return []
    const best = new Map<string, { d: number; name: string }>()
    for (const p of rows(prices)) {
      const d = weekChange(p.price, p.history)
      const cur = best.get(p.marketId)
      if (!cur || d > cur.d) best.set(p.marketId, { d, name: pack.economy.commodities.find((c) => c.id === p.commodityId)?.name[lang] ?? p.commodityId })
    }
    const hot = [...best.entries()].filter(([, v]) => v.d > 0.08).map(([k]) => k)
    return marketMarkers(pack, lang, { highlightIds: hot, detail: (id) => { const b = best.get(id); return b ? `${b.name} ${b.d >= 0 ? '+' : ''}${nf(lang, b.d * 100, 1)}% ${tr('priceWeek', lang)} (${tr('simulated', lang)})` : undefined } })
  }, [pack, prices, lang])
  const projectItems = useMemo(
    () => projects.map(({ p, kecamatanId, coord }) => {
      const dev = devOf(p)
      return { ...pointMarkers([{ id: p.id, coord, kecamatanId }], () => ({ label: `${p.code} · ${p.name[lang]}`, detail: `HPS Rp ${nf(lang, p.hps / 1e6, 1)} ${lang === 'id' ? 'jt' : 'm'} · ${p.flagged ? `risk ${p.riskScore}` : `${nf(lang, dev)}% > ${lang === 'id' ? 'pasar' : 'market'}`} · ${tr('projectSim', lang)}`, icon: 'package', tone: p.flagged || dev > 30 ? 'danger' : dev > 15 ? 'warn' : 'neutral' }))[0]! }
    }),
    [projects, lang],
  )
  const zones = useMemo(() => alertZones(rows(alerts)), [alerts])
  const cells = useMemo(() => rows(rain), [rain])

  const layers = useMemo<MapLayer[]>(
    () => [
      { id: 'kec', kind: 'kecamatan', labels: phone ? 'name' : 'name+value' },
      { id: 'rivers', kind: 'rivers' },
      { id: 'hazard', kind: 'hazard', visible: on.hazard },
      choroSpec,
      { id: 'zones', kind: 'zones', visible: on.zones && zones.length > 0, zones },
      { id: 'rain', kind: 'rain', visible: on.zones && cells.length > 0, cells, animate: true },
      { id: 'heat', kind: 'heat', visible: on.heat, points: heat },
      { id: 'markets', kind: 'markers', visible: on.markets, items: marketItems },
      { id: 'projects', kind: 'markers', visible: on.projects, items: projectItems },
      { id: 'clusters', kind: 'markers', visible: (on.choro || on.heat) && clusterMarkers.length > 0, items: clusterMarkers },
    ],
    [on, choroSpec, heat, marketItems, projectItems, clusterMarkers, zones, cells, phone],
  )

  // alerts arriving from Siaga Wilayah: make sure the zones layer is on
  const alertCount = zones.length
  const prevAlerts = useRef(alertCount)
  useEffect(() => {
    if (alertCount > prevAlerts.current) setOn((o) => (o.zones ? o : { ...o, zones: true }))
    prevAlerts.current = alertCount
  }, [alertCount])

  // the insight card steps aside when the map flies somewhere (an answer, a click); a chip brings it back
  const [tipHidden, setTipHidden] = useState(false)
  useEffect(() => {
    if (selected) setTipHidden(true)
  }, [selected])
  useEffect(() => {
    if (note) setTipHidden(false)
  }, [note])
  // the wall's hoax banner already lies over the top of the map: the insight folds into its chip meanwhile
  const banner = !!overlay
  useEffect(() => {
    if (banner) setTipHidden(true)
  }, [banner])
  // on the wall the insight is read once, then folds into its chip so it does not keep covering the west districts
  // (a cross-product note stays until dismissed)
  useEffect(() => {
    if (phone || tipHidden || note || !top) return
    const id = window.setTimeout(() => setTipHidden(true), 9000)
    return () => window.clearTimeout(id)
  }, [phone, tipHidden, note, top])

  const insightText = note ?? (top
    ? opdId
      ? trf('insightOpd', lang, { o: opdName, kec: top.name, n: top.count, p: top.prev, cat: topCat ? lc(CATEGORY_LABEL[topCat][lang]) : '-' })
      : trf('insightTop', lang, { kec: top.name, n: top.count, p: top.prev, cat: topCat ? lc(CATEGORY_LABEL[topCat][lang]) : '-' })
    : null)

  if (!pack) return null
  return (
    <section className={`dk-mp-map${phone ? ' is-phone' : ''}`} aria-label={tr('map', lang)}>
      <div className="dk-mp-maptools" role="group" aria-label={tr('layers', lang)}>
        {TOGGLES.map((t) => (
          <Chip key={t.id} icon={t.icon} selected={on[t.id]} onToggle={() => setOn((o) => ({ ...o, [t.id]: !o[t.id] }))}>
            {tr(LABEL[t.id], lang)}
          </Chip>
        ))}
      </div>
      {/* phones: the insight is a strip above the map, never a card over it */}
      {phone && insightText && (
        <div className="dk-mp-insight-strip" aria-live="polite">
          <Icon name="spark" size={14} />
          <p>
            <strong>{tr('insight', lang)}:</strong> {insightText}
          </p>
          {note ? (
            <IconButton icon="close" size="sm" label={tr('dismiss', lang)} onClick={onNoteDone} />
          ) : top ? (
            <Button size="sm" variant="ghost" onClick={() => onFly(top.kecamatanId)}>
              {trf('insightAct', lang, { kec: top.name })}
            </Button>
          ) : null}
        </div>
      )}
      <div className="dk-mp-mapbox">
        <div className={`dk-mp-mapover${overlay ? ' has-banner' : ''}`}>
        {overlay}
        {!phone && (note || top) && tipHidden && (
          <button type="button" className="dk-mp-tipchip" onClick={() => setTipHidden(false)}>
            <Icon name="spark" size={14} />
            {tr('insight', lang)}
          </button>
        )}
        {!phone && (note || top) && !tipHidden && (
          <div className="dk-mp-insight" aria-live="polite">
            {note ? (
              <InsightCallout title={tr('insight', lang)}>{note}</InsightCallout>
            ) : top ? (
              <InsightCallout
                title={tr('insight', lang)}
                action={
                  <Button size="sm" variant="ghost" iconEnd="arrowRight" onClick={() => onFly(top.kecamatanId)}>
                    {trf('insightAct', lang, { kec: top.name })}
                  </Button>
                }
              >
                {opdId
                  ? trf('insightOpd', lang, { o: opdName, kec: top.name, n: top.count, p: top.prev, cat: topCat ? lc(CATEGORY_LABEL[topCat][lang]) : '-' })
                  : trf('insightTop', lang, { kec: top.name, n: top.count, p: top.prev, cat: topCat ? lc(CATEGORY_LABEL[topCat][lang]) : '-' })}
              </InsightCallout>
            ) : null}
            <IconButton className="dk-mp-insight-x" icon="close" size="sm" label={tr('dismiss', lang)} onClick={note ? onNoteDone : () => setTipHidden(true)} />
          </div>
        )}
        </div>
        <MapView regionId={pack.id} layers={layers} selectedId={selected} onSelect={onSelect} onReady={onReady} className="dk-mp-mapview" ariaLabel={tr('mapAria', lang)} fullscreenButton={!phone} />
        {on.choro && <Ramp spec={choroSpec} />}
      </div>
    </section>
  )
}

/** compact legend of the complaint classes (0 · 1 · 2 · 3–4 · ≥ 5), bottom-right of the map */
function Ramp({ spec }: { spec: ChoroplethLayer }) {
  const { lang } = useI18n()
  const r = resolveChoropleth(spec, lang)
  const b = r.breaks
  const label = (i: number) => {
    if (i === 0) return b[0] === 1 ? '0' : `< ${b[0]}`
    if (i === b.length) return `≥ ${b[b.length - 1]}`
    const lo = b[i - 1]!
    const hi = b[i]! - 1
    return hi <= lo ? String(lo) : `${lo}–${hi}`
  }
  return (
    <div className="dk-mp-ramp" role="img" aria-label={`${tr('lChoro', lang)}: ${r.colors.map((_, i) => label(i)).join(', ')} · ${tr('choroNote', lang)}`}>
      <span className="dk-mp-ramp-t">{tr('lChoro', lang)}</span>
      {r.colors.map((c, i) => (
        <span key={i} className="dk-mp-ramp-c">
          <i style={{ background: c }} />
          {label(i)}
        </span>
      ))}
      <span className="dk-mp-ramp-n">{tr('simulated', lang)}</span>
    </div>
  )
}
