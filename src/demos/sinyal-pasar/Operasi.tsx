/**
 * Operasi — the Operasi Pasar tab (lazy): every market operation (`opView`: stage, sender, markets, volume, days,
 * effect; the seeded past op is done + measured; a C13 op is "Usulan otomatis · belum dikirim Disperindag"), the
 * stage action ("Kirim ke Meja Pimpinan" for a C13 op; "Mulai operasi pasar" disabled with its reason until approved,
 * enabled after) and the OpSimulator (`opSimulate`; mission 3 when "sesudah" differs from "tanpa operasi").
 */
import { useEffect, useMemo, useState } from 'react'
import AppLink from '../../components/AppLink'
import { DEMO_READY } from '../registry'
import { demoHref, useShell } from '../../demo-kit/shell'
import { Button, flashNewRow, motionMode } from '../../demo-kit/ui'
import { DAY_MIN, emit, hhmm, rows, useClock, useSession, useWorld, world, type MarketOperation, type WorldState } from '../../demo-kit/world'
import { opSimulate, opView } from '../../demo-kit/world/pasar-daerah'
import { OpSimulator } from './OpSimulator'
import { cName, mName } from './model'
import { pct, rp, tm, type Lang } from './strings'
import { ui, useUi } from './store'

const keep = () => (new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : '')
const S = {
  id: {
    title: 'Operasi pasar',
    lead: 'Usulan, persetujuan, dan hasil operasi pasar (simulasi; 3 hari dipercepat menjadi 90 menit dunia demo).',
    list: 'Daftar operasi pasar',
    auto: 'Usulan otomatis · belum dikirim Disperindag',
    sentBy: (t: string) => `Dikirim Disperindag ${t}`,
    vol: (v: number, d: number) => `${v} ton · ${d} hari`,
    effect: (e: string) => `efek ${e}`,
    measured: (e: string) => `Efek terukur ${e} (selisih-ganda, simulasi)`,
    ago: (n: number) => `${n} hari lalu`,
    start: 'Mulai operasi pasar',
    waitReason: 'Menunggu persetujuan Kepala Daerah',
    autoBy: (t: string) => `Disetujui otomatis pukul ${t} bila belum diputus (simulasi).`,
    approved: 'Disetujui Kepala Daerah. Operasi bisa dimulai.',
    running: (a: string, b: string) => `Berjalan sejak ${a} · selesai ${b} (3 hari, dipercepat untuk demo).`,
    done: 'Selesai. Tanda anomali di pasarnya dihapus.',
    dismissed: 'Ditolak di Meja Pimpinan.',
    send: 'Kirim ke Meja Pimpinan',
    openMeja: 'Buka di Meja Pimpinan',
    empty: 'Belum ada operasi pasar.',
    sim: (item: string, m: string) => `Simulasi operasi pasar ${item} · ${m}`,
    volume: 'Volume',
    ton: 'ton',
    days: 'Lama operasi',
    dayUnit: 'hari',
    simulate: 'Simulasikan',
    base: 'Tanpa operasi',
    after: 'Sesudah operasi',
    day: (d: number) => `+${d} hr`,
    source: 'Data simulasi · model operasi pasar dunia demo',
    result: (e: string, a: string, b: string, c: string) => `Efek harga ${e} · puncak ${a} → ${b} · subsidi ${c} (simulasi)`,
    stale: 'ubah tersimpan, simulasikan lagi',
    reason: (item: string, m: string) => `Disperindag: operasi pasar ${item} di ${m} untuk menahan lonjakan harga (simulasi).`,
  },
  en: {
    title: 'Market operations',
    lead: 'Recommendations, approvals and results of market operations (simulated; 3 days sped up to 90 demo-world minutes).',
    list: 'Market operations',
    auto: 'Automatic suggestion · not sent by the Trade Office yet',
    sentBy: (t: string) => `Sent by the Trade Office ${t}`,
    vol: (v: number, d: number) => `${v} t · ${d} days`,
    effect: (e: string) => `effect ${e}`,
    measured: (e: string) => `Measured effect ${e} (difference-in-differences, simulated)`,
    ago: (n: number) => `${n} days ago`,
    start: 'Start the market operation',
    waitReason: 'Waiting for the Regional Head’s approval',
    autoBy: (t: string) => `Approved automatically at ${t} if not decided (simulated).`,
    approved: 'Approved by the Regional Head. The operation can start.',
    running: (a: string, b: string) => `Running since ${a} · ends ${b} (3 days, sped up for the demo).`,
    done: 'Completed. The anomaly flag at its markets is cleared.',
    dismissed: 'Dismissed in Meja Pimpinan.',
    send: 'Send to Meja Pimpinan',
    openMeja: 'Open in Meja Pimpinan',
    empty: 'No market operation yet.',
    sim: (item: string, m: string) => `${item} market operation simulation · ${m}`,
    volume: 'Volume',
    ton: 'tonnes',
    days: 'Duration',
    dayUnit: 'days',
    simulate: 'Simulate',
    base: 'Without operation',
    after: 'With operation',
    day: (d: number) => `+${d} d`,
    source: 'Simulated data · market-operation model of the demo world',
    result: (e: string, a: string, b: string, c: string) => `Price effect ${e} · peak ${a} → ${b} · subsidy ${c} (simulated)`,
    stale: 'changed, simulate again',
    reason: (item: string, m: string) => `Trade Office: ${item} market operation at ${m} to hold the price spike (simulated).`,
  },
}
type T = (typeof S)['id']

const ORDER: Record<MarketOperation['stage'], number> = { recommended: 0, approved: 1, running: 2, done: 3, dismissed: 4 }

export default function Operasi() {
  const { lang, regionId, seed, present } = useSession()
  const L = lang as Lang
  const t = S[L]
  const u = useUi()
  const now = useClock().minutes
  const opsT = useWorld((s) => s.marketOps)
  const region = useWorld((s) => s.region)
  const markets = useWorld((s) => s.markets)
  const sw = { region, markets } as WorldState
  const ops = useMemo(() => rows(opsT).sort((a, b) => ORDER[a.stage] - ORDER[b.stage] || b.at - a.at || a.id.localeCompare(b.id)), [opsT])
  const sel = ops.find((o) => o.id === u.op) ?? ops[0] ?? null
  const session = { regionId, seed, lang: L, present }

  // ?focus=OP-…: bring the op row into view and flash it
  useEffect(() => {
    if (!u.op) return
    const el = document.querySelector<HTMLElement>(`[data-op="${CSS.escape(u.op)}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
    flashNewRow(el, { slide: false })
  }, [u.op, u.n])

  return (
    <div className="dk-sp-ops">
      <header className="dk-sp-boardbar">
        <div>
          <h2>{t.title}</h2>
          <p className="dk-sp-muted">{t.lead}</p>
        </div>
      </header>
      <div className="dk-sp-opsgrid">
        {ops.length ? (
          <ul className="dk-sp-oplist" aria-label={t.list}>
            {ops.map((o) => (
              <OpRow key={o.id} o={o} t={t} L={L} sw={sw} active={o.id === sel?.id} />
            ))}
          </ul>
        ) : (
          <p className="dk-sp-muted">{t.empty}</p>
        )}
        <div className="dk-sp-opside">
          {sel && <OpActions op={sel} t={t} L={L} sw={sw} now={now} session={session} />}
          <Simulator op={sel} t={t} L={L} sw={sw} now={now} />
        </div>
      </div>
    </div>
  )
}

function OpRow({ o, t, L, sw, active }: { o: MarketOperation; t: T; L: Lang; sw: WorldState; active: boolean }) {
  const v = useWorld((s) => opView(s, o.id))
  if (!v) return null
  const when = o.at < 0 ? t.ago(Math.round(-o.at / DAY_MIN)) : tm(hhmm(o.at), L)
  return (
    <li className={`dk-sp-op is-${o.stage}${active ? ' is-active' : ''}`} data-op={o.id}>
      <button type="button" className="dk-sp-opbtn" aria-current={active || undefined} onClick={() => ui.set({ op: o.id })}>
        <span className="dk-sp-op-h">
          <strong>{cName(sw, o.commodityId)[L]}</strong>
          <span className={`dk-sp-pill is-stage-${o.stage}`}>{v.stage[L]}</span>
        </span>
        <span className="dk-sp-muted">
          {o.id} · {when} · {v.markets.join(', ')}
        </span>
        <span className="dk-sp-muted">
          {v.auto ? t.auto : t.sentBy(o.sentAt != null ? (o.sentAt < 0 ? t.ago(Math.round(-o.sentAt / DAY_MIN)) : tm(hhmm(o.sentAt), L)) : when)}
          {o.volumeTon != null && o.days != null ? ` · ${t.vol(o.volumeTon, o.days)}` : ''} · {t.effect(pct(o.effectPct, L))}
        </span>
        {v.measured && <span className="dk-sp-strong">{t.measured(pct(o.effectPct, L))}</span>}
      </button>
    </li>
  )
}

function OpActions({ op, t, L, sw, now, session }: { op: MarketOperation; t: T; L: Lang; sw: WorldState; now: number; session: { regionId: string; seed: number; lang: Lang; present: boolean } }) {
  const v = useWorld((s) => opView(s, op.id))
  if (!v) return null
  const meja = DEMO_READY['meja-pimpinan'] ? <AppLink className="dk-sp-link" to={demoHref('meja-pimpinan', session, op.id) + keep()}>{t.openMeja}</AppLink> : null
  const start = () => emit('market.operation', { id: op.id, stage: 'running', commodityId: op.commodityId, marketIds: op.marketIds }, 'sinyal-pasar')
  const sendAuto = () => {
    const vol = op.volumeTon ?? 10
    const days = op.days ?? 3
    const names = op.marketIds.map((m) => mName(sw, m)).join(', ')
    const c = cName(sw, op.commodityId)
    emit('market.operation', {
      id: op.id, stage: 'recommended', commodityId: op.commodityId, marketIds: op.marketIds, sentBy: 'disperindag', volumeTon: vol, days, forRole: 'kepala-daerah',
      effectPct: opSimulate(world.get(), { commodityId: op.commodityId, marketIds: op.marketIds, volumeTon: vol, days }, now).effectPct,
      reason: { id: S.id.reason(c.id.toLowerCase(), names), en: S.en.reason(c.en.toLowerCase(), names) },
    }, 'sinyal-pasar')
  }
  return (
    <section className="dk-sp-panel-box" data-sp="op-actions" data-stage={op.stage}>
      <h3>
        {op.id} · {cName(sw, op.commodityId)[L]}
      </h3>
      {op.stage === 'recommended' && v.auto && (
        <>
          <p className="dk-sp-muted">{t.auto}</p>
          <div className="dk-sp-actbtns">
            <SendAuto onSend={sendAuto} label={t.send} />
            {meja}
          </div>
        </>
      )}
      {(op.stage === 'recommended' && !v.auto) || op.stage === 'approved' ? (
        <>
          {op.stage === 'approved' ? <p className="dk-sp-strong">{t.approved}</p> : v.approveBy != null && <p className="dk-sp-muted">{t.autoBy(tm(hhmm(v.approveBy), L))}</p>}
          <div className="dk-sp-actbtns">
            <Button variant="primary" icon="play" disabled={!v.canStart} aria-describedby={v.canStart ? undefined : 'dk-sp-wait'} onClick={start} data-sp="start-op">
              {t.start}
            </Button>
            {!v.canStart && (
              <span id="dk-sp-wait" className="dk-sp-muted" data-sp="start-reason">
                {t.waitReason}
              </span>
            )}
            {!v.canStart && meja}
          </div>
        </>
      ) : null}
      {op.stage === 'running' && <p className="dk-sp-strong">{t.running(tm(hhmm(op.startedAt ?? op.at), L), tm(hhmm(v.endsAt ?? now), L))}</p>}
      {op.stage === 'done' && <p className="dk-sp-strong">{v.measured ? t.measured(pct(op.effectPct, L)) : t.done}</p>}
      {op.stage === 'dismissed' && <p className="dk-sp-muted">{t.dismissed}</p>}
    </section>
  )
}

function SendAuto({ onSend, label }: { onSend: () => void; label: string }) {
  return (
    <Button variant="primary" icon="send" onClick={onSend} data-sp="send-auto">
      {label}
    </Button>
  )
}

/**
 * the world without the operations of this commodity (shock damps 0, running ops paused): the "tanpa operasi" side of
 * the simulator stays meaningful once an operation runs (opSimulate itself is pure; this is its counterfactual input)
 */
const cfCache = new WeakMap<WorldState, Map<string, WorldState>>()
function withoutOps(s: WorldState, commodityId: string): WorldState {
  let m = cfCache.get(s)
  const hit = m?.get(commodityId)
  if (hit) return hit
  const shocks = s.priceShocks.ids.filter((id) => s.priceShocks.byId[id]!.commodityId === commodityId && s.priceShocks.byId[id]!.damp > 0)
  const ops = s.marketOps.ids.filter((id) => s.marketOps.byId[id]!.commodityId === commodityId && s.marketOps.byId[id]!.stage === 'running')
  const out: WorldState = !shocks.length && !ops.length ? s : {
    ...s,
    priceShocks: { ...s.priceShocks, byId: { ...s.priceShocks.byId, ...Object.fromEntries(shocks.map((id) => [id, { ...s.priceShocks.byId[id]!, damp: 0 }])) } },
    marketOps: { ...s.marketOps, byId: { ...s.marketOps.byId, ...Object.fromEntries(ops.map((id) => [id, { ...s.marketOps.byId[id]!, stage: 'approved' as const }])) } },
  }
  if (!m) cfCache.set(s, (m = new Map()))
  m.set(commodityId, out)
  return out
}

function Simulator({ op, t, L, sw, now }: { op: MarketOperation | null; t: T; L: Lang; sw: WorldState; now: number }) {
  const shell = useShell()
  const fallback = useWorld((s) => {
    const sh = rows(s.priceShocks)[0]
    if (sh) return `${sh.commodityId}|${sh.marketIds.join(',')}`
    const tick = s.meta.facts.pd?.tickMarketId ?? s.markets.ids[0] ?? ''
    return `${s.meta.facts.pd?.shockCommodityIds[0] ?? s.region.commodities[0]?.id ?? ''}|${tick}`
  })
  const [fc, fm] = fallback.split('|')
  const commodityId = op?.commodityId ?? fc ?? ''
  const marketIds = op?.marketIds.length ? op.marketIds : (fm ?? '').split(',').filter(Boolean)
  const [volume, setVolume] = useState(op?.volumeTon ?? 10)
  const [days, setDays] = useState(op?.days ?? 3)
  const [ran, setRan] = useState<{ volume: number; days: number; key: string } | null>(null)
  const key = `${commodityId}|${marketIds.join(',')}`
  useEffect(() => {
    setRan(null)
    setVolume(op?.volumeTon ?? 10)
    setDays(op?.days ?? 3)
  }, [op?.id, op?.volumeTon, op?.days])
  const base = useWorld((s) => opSimulate(withoutOps(s, commodityId), { commodityId, marketIds, volumeTon: volume, days }, now))
  const run = useWorld((s) => (ran && ran.key === key ? opSimulate(withoutOps(s, commodityId), { commodityId, marketIds, volumeTon: ran.volume, days: ran.days }, now) : null))
  const differs = !!run && run.forecastAfter.some((v, i) => v !== run.baseline[i])
  useEffect(() => {
    if (differs) shell.markMission('efek')
  }, [differs, shell])
  const peak = (a: number[]) => (a.length ? Math.max(...a) : 0)
  const result = run
    ? t.result(pct(run.effectPct, L), rp(peak(run.baseline)), rp(peak(run.forecastAfter)), rp(run.costRp))
    : null
  return (
    <OpSimulator
      title={t.sim(cName(sw, commodityId)[L], marketIds.map((m) => mName(sw, m)).join(', '))}
      volume={volume}
      days={days}
      onVolume={setVolume}
      onDays={setDays}
      labels={{ volume: { id: S.id.volume, en: S.en.volume }, ton: { id: S.id.ton, en: S.en.ton }, days: { id: S.id.days, en: S.en.days }, dayUnit: { id: S.id.dayUnit, en: S.en.dayUnit } }}
      baseline={base.baseline}
      after={run ? run.forecastAfter : null}
      onSimulate={() => setRan({ volume, days, key })}
      simulateLabel={t.simulate}
      baseLabel={t.base}
      afterLabel={t.after}
      dayLabel={t.day}
      source={t.source}
      result={result}
      stale={!!ran && (ran.volume !== volume || ran.days !== days)}
      staleText={t.stale}
    />
  )
}
