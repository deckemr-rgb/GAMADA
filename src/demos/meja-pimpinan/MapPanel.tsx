/**
 * MapPanel — the real regional map in the centre of the wall (spec P2): layer toggles for complaints (choropleth +
 * density), disaster risk, active alerts (zones + rain cells), market prices and projects, an AI insight that flies
 * to the top district, and the legend. MapLibre itself loads in its own chunk (excluded from the demo budget).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useShell } from '../../demo-kit/shell'
import { Chip, Icon, IconButton, InsightCallout, Button } from '../../demo-kit/ui'
import { CATEGORY_LABEL, DAY_MIN, rows, useWorld, type Minutes, type WorldState } from '../../demo-kit/world'
import { complaintsByKecamatan } from '../../demo-kit/world/satu-daerah'
import {
  MapView, alertZones, resolveChoropleth, choropleth, countByKecamatan, heatPoints, marketMarkers, pointMarkers,
  type ChoroplethLayer, type MapLayer, type MapViewHandle, type MarkerItem,
} from '../../demo-kit/map'
import { devOf, projectPoints, weekChange } from './data'
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

export function MapPanel({ now, selected, onSelect, onReady, onFly, note, onNoteDone, phone }: {
  now: Minutes
  selected: string | null
  onSelect: (id: string | null) => void
  onReady: (h: MapViewHandle) => void
  onFly: (kecamatanId: string, reveal?: boolean) => void
  note: string | null
  onNoteDone: () => void
  phone?: boolean
}) {
  const { lang } = useI18n()
  const { pack } = useShell()
  const [on, setOn] = useState<Record<Toggle, boolean>>({ choro: true, heat: false, hazard: false, zones: true, markets: false, projects: false })
  const complaints = useWorld((s) => s.complaints)
  const clusters = useWorld((s) => s.clusters)
  const alerts = useWorld((s) => s.alerts)
  const rain = useWorld((s) => s.rainCells)
  const prices = useWorld((s) => s.prices)
  const projects = useWorld(projectPoints)
  const top = useWorld((s) => complaintsByKecamatan(s, now, 7)[0] ?? null)
  const topCat = useWorld((s) => {
    if (!top) return null
    const by = new Map<string, number>()
    for (const c of week(s, now)) if (c.kecamatanId === top.kecamatanId) by.set(c.category, (by.get(c.category) ?? 0) + 1)
    const t = [...by.entries()].sort((a, b) => b[1] - a[1])[0]
    return t ? (t[0] as keyof typeof CATEGORY_LABEL) : null
  })

  const weekList = useMemo(() => week({ complaints } as WorldState, now), [complaints, now])
  const counts = useMemo(() => {
    const c = countByKecamatan(weekList)
    return Object.fromEntries((pack?.kecamatan ?? []).map((k) => [k.id, c[k.id] ?? 0])) as Record<string, number>
  }, [weekList, pack])
  const choroSpec = useMemo(
    () => choropleth('choro', counts, { breaks: breaksOf(counts), title: { id: tr('lChoro', 'id'), en: tr('lChoro', 'en') }, unit: { id: tr('choroUnit', 'id'), en: tr('choroUnit', 'en') }, visible: on.choro, format: (v) => nf(lang, v) }),
    [counts, on.choro, lang],
  )
  const heat = useMemo(() => heatPoints(weekList, (c) => (c.urgency === 'tinggi' ? 1 : c.urgency === 'sedang' ? 0.6 : 0.35)), [weekList])
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
      <div className="dk-mp-mapbox">
        <MapView regionId={pack.id} layers={layers} selectedId={selected} onSelect={onSelect} onReady={onReady} className="dk-mp-mapview" ariaLabel={tr('mapAria', lang)} fullscreenButton={!phone} />
        {(note || top) && tipHidden && (
          <button type="button" className="dk-mp-tipchip" onClick={() => setTipHidden(false)}>
            <Icon name="spark" size={14} />
            {tr('insight', lang)}
          </button>
        )}
        {(note || top) && !tipHidden && (
          <div className="dk-mp-insight" aria-live="polite">
            {note ? (
              <InsightCallout title={tr('insight', lang)} action={<IconButton icon="close" size="sm" label={tr('dismiss', lang)} onClick={onNoteDone} />}>
                {note}
              </InsightCallout>
            ) : top ? (
              <InsightCallout
                title={tr('insight', lang)}
                action={
                  <span className="dk-mp-ph-act">
                    <Button size="sm" variant="ghost" iconEnd="arrowRight" onClick={() => onFly(top.kecamatanId)}>
                      {trf('insightAct', lang, { kec: top.name })}
                    </Button>
                    <IconButton icon="close" size="sm" label={tr('dismiss', lang)} onClick={() => setTipHidden(true)} />
                  </span>
                }
              >
                {trf('insightTop', lang, { kec: top.name, n: top.count, p: top.prev, cat: topCat ? CATEGORY_LABEL[topCat][lang].toLowerCase() : '-' })}
              </InsightCallout>
            ) : null}
          </div>
        )}
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
