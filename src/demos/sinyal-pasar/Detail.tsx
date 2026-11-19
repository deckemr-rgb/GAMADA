/**
 * Detail — the price drawer (lazy): price, Δ vs seasonal, 7-day Δ (the board row), OutlookChart (`priceOutlook`),
 * factor chips, the economy context line (L12) and "Tindakan": recommend a market operation (markets, volume, days,
 * live effect from `opSimulate` ⇒ `market.operation` recommended, sentBy disperindag, patching C13's open op), watch
 * distributors (`distributor.watched`) and "Imbauan ke UMKM" (Langganan tab). Mission 1 ticks when an anomaly's chart
 * rendered.
 */
import { useEffect, useMemo, useState } from 'react'
import AppLink from '../../components/AppLink'
import { DEMO_READY } from '../registry'
import { demoHref, useShell } from '../../demo-kit/shell'
import { Button, Drawer, RangeField, Segmented } from '../../demo-kit/ui'
import { emit, hhmm, monthOf, rows, useClock, useSession, useWorld, type MarketOperation } from '../../demo-kit/world'
import { distributorsFor, opSimulate, opView, priceBoard, priceOutlook } from '../../demo-kit/world/pasar-daerah'
import { OutlookChart } from './OutlookChart'
import { cName, cUnit, mName } from './model'
import { pct, rp, tm, type Lang } from './strings'
import { ui, useUi } from './store'

const keep = () => (new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : '')

const S = {
  id: {
    eyebrow: 'Detail harga · simulasi',
    now: 'Harga hari ini',
    week: '7 hari',
    delta: 'vs pola musiman',
    expected: (v: string) => `Pola musiman ${v}`,
    chart: (item: string) => `Prakiraan harga ${item} 14 hari`,
    hist: 'Harga harian',
    fc: 'Prakiraan (proyeksi)',
    today: 'Hari ini',
    peak: (p: string) => `Puncak ${p}`,
    day: (d: number) => (d === 0 ? 'hari ini' : d > 0 ? `+${d} hr` : `${d} hr`),
    source: 'Data simulasi · pola musiman 60 hari dunia demo (bukan harga acuan resmi)',
    summary: (item: string, p: string, d: number, now: string) => `${item} sekarang ${now}; prakiraan puncak ${p} dari pola musiman pada hari +${d} (proyeksi, simulasi).`,
    factors: 'Faktor prakiraan',
    factorsSum: (p: string) => `Puncak prakiraan ${p} =`,
    econ: (k: string, d: string) => `Indeks ekonomi Kec. ${k} ${d} poin hari ini (Indeks Ekonomi, simulasi)`,
    actions: 'Tindakan',
    recommend: 'Rekomendasikan operasi pasar',
    watch: 'Pantau distributor',
    umkm: 'Imbauan ke UMKM',
    markets: 'Pasar tujuan',
    volume: 'Volume',
    ton: 'ton',
    days: 'Lama operasi',
    daysOpt: (d: number) => `${d} hari`,
    effect: (e: string, a: string, b: string, c: string) => `Efek harga ${e} · puncak ${a} → ${b} · subsidi ${c} (simulasi)`,
    send: 'Kirim ke Meja Pimpinan',
    noMarket: 'Pilih minimal satu pasar.',
    sent: (code: string, t: string) => `Terkirim ke Meja Pimpinan (${code}). Disetujui otomatis pukul ${t} bila belum diputus (simulasi).`,
    already: (code: string, st: string) => `Operasi pasar ${code} sudah dikirim Disperindag · ${st}.`,
    openMeja: 'Buka di Meja Pimpinan',
    openOps: 'Lihat di Operasi Pasar',
    auto: (code: string) => `Usulan otomatis ${code} dari anomali · belum dikirim Disperindag. Kirim ini akan memperbaruinya.`,
    distLead: 'Distributor fiktif, kecamatan nyata, stok dalam hari (simulasi).',
    stock: (d: number) => `stok ${d} hari`,
    watched: 'Dipantau',
    watchN: (n: number) => `Pantau ${n} distributor`,
    watchNone: 'Centang distributor yang ingin dipantau.',
    watchDone: (n: number) => `${n} distributor dipantau. Penurunan stok mereka muncul di sini.`,
    reason: (item: string, m: string) => `Disperindag: operasi pasar ${item} di ${m} untuk menahan lonjakan harga (simulasi).`,
  },
  en: {
    eyebrow: 'Price details · simulated',
    now: 'Price today',
    week: '7 days',
    delta: 'vs seasonal pattern',
    expected: (v: string) => `Seasonal pattern ${v}`,
    chart: (item: string) => `${item} price forecast, 14 days`,
    hist: 'Daily price',
    fc: 'Forecast (projection)',
    today: 'Today',
    peak: (p: string) => `Peak ${p}`,
    day: (d: number) => (d === 0 ? 'today' : d > 0 ? `+${d} d` : `${d} d`),
    source: 'Simulated data · 60-day seasonal pattern of the demo world (not an official reference price)',
    summary: (item: string, p: string, d: number, now: string) => `${item} now ${now}; forecast peak ${p} above the seasonal pattern on day +${d} (projection, simulated).`,
    factors: 'Forecast factors',
    factorsSum: (p: string) => `Forecast peak ${p} =`,
    econ: (k: string, d: string) => `Economic index of ${k} ${d} points today (Indeks Ekonomi, simulated)`,
    actions: 'Actions',
    recommend: 'Recommend a market operation',
    watch: 'Watch distributors',
    umkm: 'Advice to UMKM',
    markets: 'Target markets',
    volume: 'Volume',
    ton: 'tonnes',
    days: 'Duration',
    daysOpt: (d: number) => `${d} days`,
    effect: (e: string, a: string, b: string, c: string) => `Price effect ${e} · peak ${a} → ${b} · subsidy ${c} (simulated)`,
    send: 'Send to Meja Pimpinan',
    noMarket: 'Pick at least one market.',
    sent: (code: string, t: string) => `Sent to Meja Pimpinan (${code}). Approved automatically at ${t} if not decided (simulated).`,
    already: (code: string, st: string) => `Market operation ${code} already sent by the Trade Office · ${st}.`,
    openMeja: 'Open in Meja Pimpinan',
    openOps: 'View in Market operations',
    auto: (code: string) => `Automatic suggestion ${code} from the anomaly · not sent by the Trade Office yet. Sending updates it.`,
    distLead: 'Fictional distributors, real districts, stock in days (simulated).',
    stock: (d: number) => `${d} days of stock`,
    watched: 'Watched',
    watchN: (n: number) => `Watch ${n} distributors`,
    watchNone: 'Tick the distributors to watch.',
    watchDone: (n: number) => `${n} distributors watched. Their stock drops show here.`,
    reason: (item: string, m: string) => `Trade Office: ${item} market operation at ${m} to hold the price spike (simulated).`,
  },
}

const opCode = (op: MarketOperation) => op.id
const DAYS = ['3', '5', '7'] as const

export default function Detail({ id }: { id: string }) {
  const { lang, regionId, seed, present } = useSession()
  const L = lang as Lang
  const t = S[L]
  const shell = useShell()
  const u = useUi()
  const now = useClock().minutes
  const p = useWorld((s) => s.prices.byId[id])
  const row = useWorld((s) => (p ? priceBoard(s, now, { commodity: p.commodityId, market: p.marketId })[0] : undefined))
  const outlook = useWorld((s) => (p ? priceOutlook(s, id, now) : null))
  const region = useWorld((s) => s.region)
  const markets = useWorld((s) => s.markets)
  const ops = useWorld((s) => s.marketOps)
  const shocks = useWorld((s) => s.priceShocks)
  const econ = useWorld((s) => s.econIndex)
  const day = useWorld((s) => s.day)
  const sw = { region, markets } as Parameters<typeof cName>[0]
  const close = () => ui.set({ detail: null, panel: 'none' })

  // mission 1: an anomaly's chart rendered
  const anomaly = !!p?.anomaly
  useEffect(() => {
    if (anomaly && outlook) shell.markMission('anomali')
  }, [anomaly, outlook, shell])

  if (!p || !row || !outlook) return null
  const item = cName(sw, p.commodityId)[L]
  const market = mName(sw, p.marketId)
  const kec = markets.byId[p.marketId]?.kecamatanId ?? null
  const cell = kec ? econ.byId[`${kec}:${monthOf(day)}`] : undefined
  const ev = cell && cell.businesses >= 10 ? (cell.events ?? []).filter((x) => x.at >= 0 && x.at <= now).at(-1) : undefined
  const kecName = kec ? region.kecamatan.find((k) => k.id === kec)?.name ?? kec : ''

  return (
    <Drawer open onClose={close} title={`${item} · ${market}`} eyebrow={t.eyebrow} width={580} className="dk-sp-ov">
      <div className="dk-sp-detail" data-sp="detail" data-pair={id}>
        <dl className="dk-sp-facts">
          <div>
            <dt>{t.now}</dt>
            <dd className="dk-num" data-sp="detail-price">{rp(row.price)}<small>/{cUnit(sw, p.commodityId)}</small></dd>
          </div>
          <div>
            <dt>{t.delta}</dt>
            <dd className={`dk-num${row.deltaPct >= 5 ? ' is-high' : ''}`} data-sp="detail-delta">{pct(row.deltaPct, L)}</dd>
          </div>
          <div>
            <dt>{t.week}</dt>
            <dd className="dk-num" data-sp="detail-week">{pct(row.weekPct, L)}</dd>
          </div>
        </dl>
        <p className="dk-sp-muted">{t.expected(rp(row.expected))}</p>
        <OutlookChart
          title={t.chart(item)}
          history={outlook.history30}
          forecast={outlook.forecast14}
          lo={outlook.lo}
          hi={outlook.hi}
          peakDay={outlook.peakDay}
          peakLabel={t.peak(pct(outlook.peakPct, L))}
          todayLabel={t.today}
          seriesLabel={t.hist}
          forecastLabel={t.fc}
          dayLabel={t.day}
          source={t.source}
          summary={t.summary(item, pct(outlook.peakPct, L), outlook.peakDay, rp(row.price))}
        />
        <div className="dk-sp-factors" role="group" aria-label={t.factors}>
          <span className="dk-sp-muted" data-sp="factor-sum">{t.factorsSum(pct(outlook.peakPct, L))}</span>
          {outlook.factors.map((f) => (
            <span key={f.key} className={`dk-sp-factor is-${f.key}`} data-factor={f.key}>
              {f.label[L]} <strong className="dk-num">{pct(f.pct, L)}</strong>
            </span>
          ))}
        </div>
        {ev && (
          <p className="dk-sp-context" data-sp="econ-line">
            {t.econ(kecName, pct(ev.delta, L).slice(0, -1))}
          </p>
        )}
        <section className="dk-sp-actions" aria-label={t.actions}>
          <h3>{t.actions}</h3>
          <div className="dk-sp-actbtns">
            <Button size="sm" variant={u.panel === 'rekom' ? 'primary' : 'secondary'} icon="truck" aria-expanded={u.panel === 'rekom'} data-tour="sp-recommend" onClick={() => ui.set({ panel: u.panel === 'rekom' ? 'none' : 'rekom' })}>
              {t.recommend}
            </Button>
            <Button size="sm" variant={u.panel === 'dist' ? 'primary' : 'secondary'} icon="users" aria-expanded={u.panel === 'dist'} onClick={() => ui.set({ panel: u.panel === 'dist' ? 'none' : 'dist' })}>
              {t.watch}
            </Button>
            <Button size="sm" variant="ghost" icon="bell" onClick={() => ui.set({ tab: 'langganan', detail: null, panel: 'none' })}>
              {t.umkm}
            </Button>
          </div>
          {u.panel === 'rekom' && <Recommend t={t} L={L} commodityId={p.commodityId} marketId={p.marketId} item={item} now={now} ops={rows(ops)} shockMarkets={rows(shocks).find((x) => x.commodityId === p.commodityId)?.marketIds ?? []} sw={sw} session={{ regionId, seed, lang: L, present }} basePeak={outlook.peakPct} expected={outlook.expected} />}
          {u.panel === 'dist' && <Distributors t={t} commodityId={p.commodityId} />}
        </section>
      </div>
    </Drawer>
  )
}

type T = (typeof S)['id']

function Recommend({ t, L, commodityId, marketId, item, now, ops, shockMarkets, sw, session, basePeak, expected }: {
  t: T; L: Lang; commodityId: string; marketId: string; item: string; now: number; ops: MarketOperation[]; shockMarkets: string[]; sw: Parameters<typeof cName>[0]
  session: { regionId: string; seed: number; lang: Lang; present: boolean }; basePeak: number; expected: number
}) {
  const marketList = useWorld((s) => s.prices.ids.filter((k) => s.prices.byId[k]!.commodityId === commodityId).map((k) => s.prices.byId[k]!.marketId).join(','))
  const [picked, setPicked] = useState<string[]>(() => [...new Set([marketId, ...shockMarkets])])
  const [volume, setVolume] = useState(10)
  const [days, setDays] = useState<(typeof DAYS)[number]>('3')
  const [sentId, setSentId] = useState<string | null>(null)
  const sim = useWorld((s) => opSimulate(s, { commodityId, marketIds: picked, volumeTon: volume, days: Number(days) }, now))
  const sent = ops.find((o) => o.commodityId === commodityId && o.sentBy && (o.stage === 'recommended' || o.stage === 'approved' || o.stage === 'running'))
  const auto = ops.find((o) => o.commodityId === commodityId && !o.sentBy && o.stage === 'recommended')
  const view = useWorld((s) => (sent ? opView(s, sent.id) : null))
  const afterPeak = sim.forecastAfter.length ? Math.round((Math.max(...sim.forecastAfter) / expected - 1) * 1000) / 10 : basePeak
  const all = marketList ? marketList.split(',') : []
  const ordered = [...picked.filter((m) => all.includes(m)), ...all.filter((m) => !picked.includes(m))]
  const meja = (id: string) => (DEMO_READY['meja-pimpinan'] ? <AppLink className="dk-sp-link" to={demoHref('meja-pimpinan', session, id) + keep()}>{t.openMeja}</AppLink> : null)

  if (sent && view) {
    return (
      <div className="dk-sp-panel-box" data-sp="rekom-status">
        <p className="dk-sp-strong">
          {sentId === sent.id && view.approveBy != null ? t.sent(opCode(sent), tm(hhmm(view.approveBy), L)) : t.already(opCode(sent), view.stage[L])}
        </p>
        <div className="dk-sp-actbtns">
          {meja(sent.id)}
          <Button size="sm" variant="ghost" iconEnd="arrowRight" onClick={() => ui.set({ tab: 'operasi', op: sent.id, detail: null, panel: 'none' })}>
            {t.openOps}
          </Button>
        </div>
      </div>
    )
  }
  const send = () => {
    if (!picked.length) return
    const e = emit('market.operation', {
      ...(auto ? { id: auto.id } : {}), stage: 'recommended', commodityId, marketIds: picked, sentBy: 'disperindag', volumeTon: volume, days: Number(days), effectPct: sim.effectPct, forRole: 'kepala-daerah',
      reason: { id: S.id.reason(cName(sw, commodityId).id.toLowerCase(), picked.map((m) => mName(sw, m)).join(', ')), en: S.en.reason(cName(sw, commodityId).en.toLowerCase(), picked.map((m) => mName(sw, m)).join(', ')) },
    }, 'sinyal-pasar')
    setSentId(e.payload.id ?? auto?.id ?? null)
  }
  return (
    <div className="dk-sp-panel-box" data-sp="rekom">
      {auto && <p className="dk-sp-muted">{t.auto(opCode(auto))}</p>}
      <fieldset className="dk-sp-markets">
        <legend>{t.markets}</legend>
        {ordered.map((m) => (
          <label key={m} className="dk-sp-check">
            <input type="checkbox" checked={picked.includes(m)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, m] : x.filter((y) => y !== m)))} />
            <span>{mName(sw, m)}</span>
          </label>
        ))}
      </fieldset>
      <RangeField label={{ id: S.id.volume, en: S.en.volume }} min={2} max={20} step={1} value={volume} onChange={setVolume} unit={{ id: S.id.ton, en: S.en.ton }} hook="sp-volume" />
      <div className="dk-sp-field">
        <span className="dk-sp-label">{t.days}</span>
        <Segmented size="sm" label={t.days} value={days} onChange={setDays} options={DAYS.map((d) => ({ value: d, label: t.daysOpt(Number(d)) }))} />
      </div>
      <p className="dk-sp-effect dk-num" aria-live="polite" data-sp="rekom-effect" data-effect={sim.effectPct}>
        {t.effect(pct(sim.effectPct, L), pct(basePeak, L), pct(afterPeak, L), rp(sim.costRp))}
      </p>
      <p className="dk-sp-muted">{item}</p>
      <div className="dk-sp-actbtns">
        <Button variant="primary" icon="send" onClick={send} disabled={!picked.length} aria-describedby={picked.length ? undefined : 'dk-sp-nomkt'} data-sp="send-meja">
          {t.send}
        </Button>
        {!picked.length && <span id="dk-sp-nomkt" className="dk-sp-muted">{t.noMarket}</span>}
      </div>
    </div>
  )
}

function Distributors({ t, commodityId }: { t: T; commodityId: string }) {
  const list = useWorld((s) => distributorsFor(s, commodityId))
  const [picked, setPicked] = useState<string[]>(() => list.filter((d) => !d.watched && d.stockDays <= 5).map((d) => d.id))
  const [done, setDone] = useState(0)
  const open = useMemo(() => picked.filter((id) => !list.find((d) => d.id === id)?.watched), [picked, list])
  const watch = () => {
    if (!open.length) return
    emit('distributor.watched', { commodityId, distributorIds: open, by: 'disperindag' }, 'sinyal-pasar')
    setDone(open.length)
    setPicked([])
  }
  return (
    <div className="dk-sp-panel-box" data-sp="dist">
      <p className="dk-sp-muted">{t.distLead}</p>
      <ul className="dk-sp-dist">
        {list.map((d) => (
          <li key={d.id} data-dist={d.id}>
            <label className="dk-sp-check">
              <input type="checkbox" disabled={d.watched} checked={d.watched || picked.includes(d.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, d.id] : x.filter((y) => y !== d.id)))} />
              <span>
                <strong>{d.name}</strong> · {d.kecamatan} · {t.stock(d.stockDays)}
              </span>
            </label>
            {d.watched && <span className="dk-sp-pill is-watched">{t.watched}</span>}
          </li>
        ))}
      </ul>
      {done > 0 && <p className="dk-sp-strong" role="status">{t.watchDone(done)}</p>}
      <div className="dk-sp-actbtns">
        <Button variant="primary" icon="eye" onClick={watch} disabled={!open.length} data-sp="watch">
          {open.length ? t.watchN(open.length) : t.watchN(0)}
        </Button>
        {!open.length && <span className="dk-sp-muted">{t.watchNone}</span>}
      </div>
    </div>
  )
}
