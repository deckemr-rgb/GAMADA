/**
 * KecDrawer — one kecamatan: 12-month index (TrendChart vs the kabupaten, markers for flood / programme / harvest
 * events), the sector mix, today's economic events, its markets (→ Sinyal Pasar ?focus=<market>:<commodity>) and
 * "Jelaskan" (Tanya ekonom). A hidden kecamatan (< 10 businesses) shows the hatch and the anonymity text only.
 */
import { useMemo } from 'react'
import AppLink from '../../components/AppLink'
import { DEMO_READY } from '../registry'
import { demoHref } from '../../demo-kit/shell'
import { Button, Drawer } from '../../demo-kit/ui'
import { TrendChart, type ChartMarker } from '../../demo-kit/viz'
import { rows, useClock, useSession, useWorld, world } from '../../demo-kit/world'
import { econEvents, econFrame, econSectors, econSeries, priceBoard } from '../../demo-kit/world/pasar-daerah'
import { usePdStrings } from '../../demo-kit/i18n/pd'
import { HatchBars } from './bars'
import { monthLabel, monthShort, nf, rpShort, sgn, useT } from './strings'
import type { View } from './types'

const S = {
  id: { eyebrow: 'Kecamatan', idx: 'Indeks', d: 'vs bulan lalu', omzet: 'Omzet UMKM', biz: 'Usaha', trend: 'Indeks 12 bulan', kab: 'Kabupaten', sectors: 'Komposisi sektor', events: 'Kejadian hari ini', noEv: 'Belum ada kejadian ekonomi di kecamatan ini hari ini.', markets: 'Pasar di kecamatan ini', noMk: 'Tidak ada pasar terdata di kecamatan ini.', spSoon: 'Sinyal Pasar (demo tahap 4)', explain: 'Jelaskan dengan AI', hidden: 'Kecamatan ini memiliki kurang dari 10 usaha terdaftar. Indeks, omzet, dan sektornya tidak ditampilkan di layar, briefing, maupun jawaban AI.', ask: (k: string) => `Jelaskan kecamatan ${k}`, src: 'Data simulasi · indeks dari omzet usaha terdaftar' },
  en: { eyebrow: 'District', idx: 'Index', d: 'vs last month', omzet: 'MSME turnover', biz: 'Businesses', trend: '12-month index', kab: 'Regency', sectors: 'Sector mix', events: 'Events today', noEv: 'No economic event in this district today.', markets: 'Markets in this district', noMk: 'No market recorded in this district.', spSoon: 'Sinyal Pasar (stage 4 demo)', explain: 'Explain with AI', hidden: 'This district has fewer than 10 registered businesses. Its index, turnover and sectors are not shown on screen, in the briefing or in AI answers.', ask: (k: string) => `Explain the district ${k}`, src: 'Simulated data · index from registered business turnover' },
}
const TONE: Record<string, ChartMarker['tone']> = { banjir: 'warn', program: 'ok', panen: 'info' }

export default function KecDrawer({ view, kecId, onClose }: { view: View; kecId: string; onClose: () => void }) {
  const { lang } = useT()
  const L = S[lang]
  const p = usePdStrings()
  const session = useSession()
  const now = useClock().minutes
  const ym = view.months[view.monthIdx]!
  const econ = useWorld((s) => s.econIndex)
  const name = useWorld((s) => s.region.kecamatan.find((k) => k.id === kecId)?.name ?? kecId)
  const frame = useWorld((s) => econFrame(s, ym))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const series = useMemo(() => econSeries(world.get(), kecId), [econ, kecId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kab = useMemo(() => econSeries(world.get(), null), [econ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sectors = useMemo(() => econSectors(world.get(), ym, kecId), [econ, ym, kecId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const events = useMemo(() => econEvents(world.get(), now).filter((e) => e.kecId === kecId), [econ, now, kecId])
  const markets = useWorld((s) => s.markets)
  const prices = useWorld((s) => s.prices)
  const mk = useMemo(() => {
    const s = world.get()
    return rows(markets)
      .filter((m) => m.kecamatanId === kecId)
      .map((m) => {
        const top = priceBoard(s, now, { market: m.id })[0]
        const c = top ? s.region.commodities.find((x) => x.id === top.commodityId) : undefined
        return { id: m.id, name: m.name, focus: top ? `${m.id}:${top.commodityId}` : m.id, commodity: c?.name, weekPct: top?.weekPct ?? 0 }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, prices, kecId, Math.floor(now / 60)])
  const hidden = series.hidden || frame.hidden.includes(kecId)
  const idx = frame.values[kecId] ?? null
  const delta = frame.rank.find((r) => r.kecId === kecId)?.delta ?? 0
  const cell = world.get().econIndex.byId[`${kecId}:${ym}`]
  const keep = () => (new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : '')

  return (
    <Drawer open onClose={onClose} title={`Kec. ${name}`} eyebrow={`${L.eyebrow} · ${monthLabel(lang, ym)}`} width={480} className="dk-ie-ov">
      <div className="dk-ie-drawer" data-ie="drawer" data-kec={kecId}>
        {hidden ? (
          <div className="dk-ie-hidbox" data-ie="drawer-hidden">
            <span className="dk-ie-hatch is-box" aria-hidden="true" />
            <p><b>{p.anonHidden}.</b> {L.hidden}</p>
          </div>
        ) : (
          <>
            <dl className="dk-ie-stats">
              <div><dt>{L.idx}</dt><dd className="dk-num" data-ie="drawer-index">{idx != null ? nf(lang, idx, 1) : '–'}</dd></div>
              <div><dt>{L.d}</dt><dd className="dk-num">{sgn(lang, delta)}</dd></div>
              <div><dt>{L.omzet}</dt><dd className="dk-num">{cell ? rpShort(lang, cell.omzet) : '–'}</dd></div>
              <div><dt>{L.biz}</dt><dd className="dk-num">{cell ? nf(lang, cell.businesses) : '–'}</dd></div>
            </dl>
            <TrendChart
              title={L.trend}
              unit={lang === 'id' ? 'indeks, 100 = rata-rata 12 bulan' : 'index, 100 = 12-month mean'}
              source={L.src}
              x={view.months.map((m) => monthShort(lang, m))}
              series={[
                { id: 'kec', label: `Kec. ${name}`, values: series.points.map((x) => x.index ?? 0) },
                { id: 'kab', label: L.kab, values: kab.points.map((x) => x.index ?? 0), dashed: true },
              ]}
              format={(v) => nf(lang, v, 1)}
              markers={series.markers.map((m) => ({ x: Math.max(0, view.months.indexOf(m.month)), label: m.label, tone: TONE[m.kind ?? ''] ?? 'neutral' }))}
              height={190}
            />
            <h3 className="dk-ie-h3">{L.sectors}</h3>
            <HatchBars lang={lang} title={L.sectors} anon={p.anonHidden} rows={sectors.map((r) => ({ key: r.key, label: r.label[lang], value: r.omzet, count: r.businesses, merged: r.merged }))} />
            <h3 className="dk-ie-h3">{L.events}</h3>
            {events.length ? (
              <ul className="dk-ie-evlist">
                {events.map((e) => (
                  <li key={`${e.at}:${e.month}`}>{e.reason[lang]} · {sgn(lang, e.delta)}</li>
                ))}
              </ul>
            ) : (
              <p className="dk-ie-muted">{L.noEv}</p>
            )}
            <h3 className="dk-ie-h3">{L.markets}</h3>
            {mk.length ? (
              <ul className="dk-ie-mklist">
                {mk.map((m) => (
                  <li key={m.id}>
                    {DEMO_READY['sinyal-pasar'] ? <AppLink to={demoHref('sinyal-pasar', session, m.focus) + keep()}>{m.name}</AppLink> : <span>{m.name}</span>}
                    {m.commodity && <small className="dk-ie-muted"> · {m.commodity[lang]} {sgn(lang, m.weekPct)}% {lang === 'id' ? '7 hari' : '7 days'}</small>}
                  </li>
                ))}
                {!DEMO_READY['sinyal-pasar'] && <li className="dk-ie-muted">{L.spSoon}</li>}
              </ul>
            ) : (
              <p className="dk-ie-muted">{L.noMk}</p>
            )}
            <Button size="sm" variant="secondary" icon="spark" onClick={() => { onClose(); view.ask(L.ask(name)) }} data-ie="drawer-explain">
              {L.explain}
            </Button>
          </>
        )}
      </div>
    </Drawer>
  )
}
