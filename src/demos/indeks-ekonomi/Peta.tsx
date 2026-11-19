/**
 * Peta — the real kecamatan choropleth of the 12-month index (5 classes with breaks fixed over the 12 months, so a
 * colour change is a real change; hidden kecamatan hatched), the month StepScrubber with Play (time-lapse mission),
 * the ranked list (TimelapseRank: DOM order = rank, rows glide by transform) and "Kejadian ekonomi hari ini"
 * (ActivityFeed + hourly pulse, a lazy chunk fetched on intent or when an economic event arrives).
 * MapStage (map + scrubber) is reused by the Kepala Daerah Ringkasan.
 */
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useShell } from '../../demo-kit/shell'
import { Icon, flashNewRow, motionMode } from '../../demo-kit/ui'
import { rows, useClock, useWorld, world, type WorldState } from '../../demo-kit/world'
import { econEvents, econFrame, econPulse, econSeries } from '../../demo-kit/world/pasar-daerah'
import { MapLegend, MapView, StepScrubber, alertZones, choropleth, type MapLayer, type MapViewHandle } from '../../demo-kit/map'
import { usePdStrings } from '../../demo-kit/i18n/pd'
import { monthLabel, monthShort, nf, sgn, useT, type Lang } from './strings'
import type { View } from './types'

const loadFeed = () => import('./Feed')
const Feed = lazy(loadFeed)

const S = {
  id: {
    map: 'Peta indeks ekonomi per kecamatan',
    scrub: 'Bulan',
    legend: 'Indeks (100 = rata-rata 12 bulan)',
    legendShow: 'Legenda',
    zones: 'Wilayah peringatan banjir',
    rank: 'Peringkat kecamatan',
    rankOf: (m: string) => `Peringkat kecamatan · ${m}`,
    vs: 'vs bulan sebelumnya',
    events: 'Kejadian ekonomi hari ini',
    eventsN: (n: number, tx: number) => `${n} kejadian · ${tx} transaksi tercatat sejak 00.00 (simulasi)`,
    method: 'Indeks dari omzet usaha terdaftar per kecamatan (simulasi); kecamatan dengan < 10 usaha disembunyikan.',
    stepLabel: (m: string, v: string) => `${m}, indeks ${v}`,
  },
  en: {
    map: 'Economic index map by district',
    scrub: 'Month',
    legend: 'Index (100 = 12-month mean)',
    legendShow: 'Legend',
    zones: 'Flood warning areas',
    rank: 'District ranking',
    rankOf: (m: string) => `District ranking · ${m}`,
    vs: 'vs the previous month',
    events: 'Economic events today',
    eventsN: (n: number, tx: number) => `${n} events · ${tx} transactions recorded since 00:00 (simulated)`,
    method: 'Index from registered business turnover per district (simulated); districts with < 10 businesses are hidden.',
    stepLabel: (m: string, v: string) => `${m}, index ${v}`,
  },
}

const floodOn = (s: WorldState) => rows(s.alerts).some((a) => a.kind === 'banjir' && a.status === 'aktif')

/** 5 classes with breaks fixed over all 12 months (quintiles of every visible value) */
function useBreaks(months: string[]): number[] {
  const econ = useWorld((s) => s.econIndex)
  return useMemo(() => {
    const vals: number[] = []
    for (const m of months) for (const v of Object.values(econFrame(world.get(), m).values)) if (v != null) vals.push(v)
    vals.sort((a, b) => a - b)
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] ?? 100
    return [q(0.2), q(0.4), q(0.6), q(0.8)].map((v) => Math.round(v * 10) / 10).filter((v, i, a) => i === 0 || v > a[i - 1]!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [econ, months])
}

/** the map + month scrubber (Peta and the Kepala Daerah Ringkasan) */
export function MapStage({ view, compact }: { view: View; compact?: boolean }) {
  const { lang } = useT()
  const L = S[lang]
  const { pack, markMission } = useShell()
  const ym = view.months[view.monthIdx]!
  const frame = useWorld((s) => econFrame(s, ym))
  const breaks = useBreaks(view.months)
  const econ = useWorld((s) => s.econIndex)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kab = useMemo(() => econSeries(world.get(), null), [econ])
  const alerts = useWorld((s) => s.alerts)
  const flood = useWorld(floodOn)
  const latest = view.monthIdx === view.months.length - 1
  const zones = useMemo(() => (flood && latest ? alertZones(rows(alerts).filter((a) => a.kind === 'banjir')) : []), [alerts, flood, latest])
  const handle = useRef<MapViewHandle | null>(null)

  const choro = useMemo(
    () => choropleth('econ', frame.values as Record<string, number>, { hidden: frame.hidden, breaks, format: (v) => nf(lang, v, 1), title: { id: S.id.legend, en: S.en.legend }, unit: { id: 'indeks', en: 'index' } }),
    [frame, breaks, lang],
  )
  const layers = useMemo<MapLayer[]>(
    () => [
      { id: 'kec', kind: 'kecamatan', labels: view.phone || compact ? 'name' : 'name+value' },
      choro,
      { id: 'zones', kind: 'zones', visible: zones.length > 0, zones },
    ],
    [choro, zones, view.phone, compact],
  )
  // a focus arrival / list pick flies the map to the kecamatan
  const flown = useRef(0)
  useEffect(() => {
    if (view.flash && view.flash !== flown.current && view.sel) {
      flown.current = view.flash
      handle.current?.fitKecamatan(view.sel)
    }
  }, [view.flash, view.sel])

  // time-lapse mission: all 12 months shown in one run (Play end) or visited one by one
  const seen = useRef(new Set<number>([view.monthIdx]))
  const steps = useMemo(
    () => view.months.map((m, i) => ({ value: i, label: { id: S.id.stepLabel(monthLabel('id', m), nf('id', kab.points[i]?.index ?? 0, 1)), en: S.en.stepLabel(monthLabel('en', m), nf('en', kab.points[i]?.index ?? 0, 1)) }, short: { id: monthShort('id', m), en: monthShort('en', m) } })),
    [view.months, kab],
  )
  const [legendOpen, setLegendOpen] = useState(false)
  if (!pack) return null
  const legend = <MapLegend choropleth={choro} items={zones.length ? [{ id: 'z', label: L.zones, kind: 'line', tone: 'warn' }] : undefined} note={L.method} className="dk-ie-legend" />
  return (
    <div className={`dk-ie-stage${compact ? ' is-compact' : ''}`}>
      <div className="dk-ie-mapbox" data-tour="ie-map">
        <MapView
          regionId={pack.id}
          layers={layers}
          ariaLabel={`${L.map} · ${monthLabel(lang, ym)}`}
          minHeight={compact ? 300 : view.phone ? '52vh' : 460}
          selectedId={view.sel}
          onSelect={(id) => view.pick(id)}
          onReady={(h) => {
            handle.current = h
          }}
          fullscreenButton={!compact}
        />
      </div>
      <div className="dk-ie-scrub" data-hotspot="ie-play" data-tour="ie-scrubber">
        <StepScrubber
          value={view.monthIdx}
          steps={steps}
          label={L.scrub}
          onChange={(i) => {
            const k = Math.round(i)
            view.setMonthIdx(k)
            seen.current.add(k)
            if (seen.current.size >= view.months.length) markMission('timelapse')
          }}
          onEnd={() => markMission('timelapse')}
        />
      </div>
      {!view.phone && !compact && legend}
      {(view.phone || compact) && (
        <div className="dk-ie-legendchip">
          <button type="button" className="dk-chip" aria-expanded={legendOpen} onClick={() => setLegendOpen((o) => !o)}>
            <Icon name="layers" size={16} /> {L.legendShow}
          </button>
          {legendOpen && legend}
        </div>
      )}
    </div>
  )
}

export interface RankRow { id: string; name: string; index: number | null; delta: number | null; hidden: boolean; event?: { delta: number; kind: string | null } }

/** ranked kecamatan list: DOM order = rank (screen readers read it in order), rows glide to their new place by
 *  transform (FLIP, WAAPI); reduced motion / static: rows jump. ↑/↓/Home/End move focus, Enter picks. */
export function TimelapseRank({ rows: list, selected, onPick, flash, title, lang, anon }: { rows: RankRow[]; selected: string | null; onPick: (id: string) => void; flash: number; title: string; lang: Lang; anon: string }) {
  const ref = useRef<HTMLOListElement>(null)
  const pos = useRef(new Map<string, number>())
  const max = Math.max(1, ...list.map((r) => r.index ?? 0))
  const min = Math.min(max - 1, ...list.filter((r) => r.index != null).map((r) => r.index!))
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const mode = motionMode()
    const next = new Map<string, number>()
    for (const li of el.querySelectorAll<HTMLElement>('li[data-kec]')) {
      const id = li.dataset.kec!
      const top = li.offsetTop
      next.set(id, top)
      const before = pos.current.get(id)
      if (mode !== 'static' && mode !== 'reduced' && before != null && before !== top) li.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' })
    }
    pos.current = next
  })
  const flashed = useRef(0)
  useEffect(() => {
    if (!flash || flash === flashed.current || !selected) return
    flashed.current = flash
    const li = ref.current?.querySelector<HTMLElement>(`li[data-kec="${CSS.escape(selected)}"]`)
    if (!li) return
    li.scrollIntoView({ block: 'nearest' })
    flashNewRow(li)
  }, [flash, selected])
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    const j = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : null
    if (j == null) return
    e.preventDefault()
    btns[Math.max(0, Math.min(btns.length - 1, j))]?.focus()
  }
  let rank = 0
  return (
    <section className="dk-ie-rank" aria-label={title}>
      <h3 className="dk-ie-h3">{title}</h3>
      <ol ref={ref} onKeyDown={onKey} data-ie="rank">
        {list.map((r) => {
          if (!r.hidden) rank++
          const w = r.index != null ? 12 + ((r.index - min) / Math.max(0.1, max - min)) * 88 : 0
          return (
            <li key={r.id} data-kec={r.id} data-hidden={r.hidden || undefined} className={selected === r.id ? 'is-sel' : undefined}>
              <button type="button" onClick={() => onPick(r.id)} aria-current={selected === r.id || undefined} title={r.hidden ? anon : undefined}>
                <span className="dk-ie-rk dk-num">{r.hidden ? '–' : rank}</span>
                <span className="dk-ie-rname">{r.name}</span>
                {r.hidden ? (
                  <span className="dk-ie-rhid">
                    <span className="dk-ie-hatch" aria-hidden="true" />
                    <span>{anon}</span>
                  </span>
                ) : (
                  <>
                    <span className="dk-ie-rbar" aria-hidden="true">
                      <span style={{ transform: `scaleX(${w / 100})` }} />
                    </span>
                    <span className="dk-ie-rval dk-num" data-val>{nf(lang, r.index!, 1)}</span>
                    {r.event ? (
                      <span className="dk-ie-dchip dk-num" data-tone={r.event.delta < 0 ? 'down' : 'up'} data-ie="delta-chip">{sgn(lang, r.event.delta)}</span>
                    ) : (
                      <span className="dk-ie-rdelta dk-num" data-tone={(r.delta ?? 0) < 0 ? 'down' : (r.delta ?? 0) > 0 ? 'up' : 'flat'}>{sgn(lang, r.delta ?? 0)}</span>
                    )}
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default function Peta({ view }: { view: View }) {
  const { lang } = useT()
  const L = S[lang]
  const p = usePdStrings()
  const now = useClock().minutes
  const ym = view.months[view.monthIdx]!
  const frame = useWorld((s) => econFrame(s, ym))
  const econ = useWorld((s) => s.econIndex)
  const region = useWorld((s) => s.region)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const events = useMemo(() => econEvents(world.get(), now), [econ, now])
  const list = useMemo<RankRow[]>(() => {
    const name = (k: string) => region.kecamatan.find((x) => x.id === k)?.name ?? k
    const ev = new Map<string, { delta: number; kind: string | null }>()
    for (const e of events) if (e.month === ym && !e.hidden && !ev.has(e.kecId)) ev.set(e.kecId, { delta: e.delta, kind: e.kind })
    const vis = frame.rank.map((r) => ({ id: r.kecId, name: name(r.kecId), index: r.index, delta: r.delta, hidden: false, event: ev.get(r.kecId) }))
    const hid = frame.hidden.map((k) => ({ id: k, name: name(k), index: null, delta: null, hidden: true }))
    return [...vis, ...hid]
  }, [frame, region, events, ym])

  const sideRef = useRef<HTMLDivElement>(null)
  const [feedOn, setFeedOn] = useState(false)
  useEffect(() => {
    let live = true
    const on = () => live && setFeedOn(true)
    // the chunk is in once its loader resolves (intent or an arriving event)
    const el = sideRef.current
    const ask = () => void loadFeed().then(on)
    if (events.length) ask()
    el?.addEventListener('pointerenter', ask, { once: true })
    el?.addEventListener('focusin', ask, { once: true })
    el?.addEventListener('touchstart', ask, { once: true, passive: true })
    return () => {
      live = false
      el?.removeEventListener('pointerenter', ask)
      el?.removeEventListener('focusin', ask)
      el?.removeEventListener('touchstart', ask)
    }
  }, [events.length, sideRef])

  return (
    <div className="dk-ie-peta">
      <MapStage view={view} />
      <div className="dk-ie-side" ref={sideRef}>
        <TimelapseRank rows={list} selected={view.sel} onPick={(id) => view.pick(id)} flash={view.flash} title={L.rankOf(monthLabel(lang, ym))} lang={lang} anon={p.anonHidden} />
        <section className="dk-ie-events" aria-label={L.events} data-ie="events">
          <h3 className="dk-ie-h3">{L.events}</h3>
          {feedOn ? (
            <Suspense fallback={<p className="dk-ie-muted">{L.eventsN(events.length, 0)}</p>}>
              <Feed events={events} now={now} />
            </Suspense>
          ) : (
            <PulseLine n={events.length} now={now} text={L.eventsN} />
          )}
        </section>
      </div>
    </div>
  )
}

/** first paint of the events panel: one line with the live counts (the feed + sparkline come on intent) */
function PulseLine({ n, now, text }: { n: number; now: number; text: (n: number, tx: number) => string }) {
  const tx = useWorld((s) => econPulse(s, now).tx)
  return <p className="dk-ie-muted" data-ie="pulse-line">{text(n, tx)}</p>
}
