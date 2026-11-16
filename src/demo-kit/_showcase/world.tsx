/**
 * /lab/_kit showcase section for the "world" module — owned by the world builder.
 * Proves the shared world works: clock control, buttons that emit REAL events, a live audit log, entity counts
 * and a checklist of cross-product effects produced by world/reactions.ts. ?static=1 renders a final state.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../../lib/i18n'
import { isEnabled } from '../../lib/motion'
import { PRODUCT_BY_SLUG, isProductSlug, type EcoOrInti } from '../../content/products'
import { RegionPack } from '../region/types'
import { MINI_PACK } from '../world/__fixtures__/mini-pack'
import {
  CLOCK, DEFAULT_SEED, WORLD, activeAlerts, clock, complaintKpi, distanceKm, emit, formatTime, latestAudit, loadWorld, overdueActions, resetWorld, rows,
  serviceIndex, setNaturalEvents, settled, shallowEqual, slaOnTimePct, tableCounts, useClock, useNaturalEvents, useWorld, useWorldStatus, world, worldDate,
  type AuditEntry, type EventSource, type LngLat, type TableKey, type WorldState,
} from '../world'
import '../ui/tokens.css'
import '../world/world-lab.css'

type L = 'id' | 'en'
const T = {
  id: {
    ready: 'Dunia siap', loading: 'Memuat dunia…', seedNote: 'Data simulasi · seed', entities: 'entitas', clock: 'Jam dunia', play: 'Jalankan jam', pause: 'Jeda jam',
    speed: 'Kecepatan', jump: 'Lompat ke', natural: 'Kejadian alami', naturalHint: 'aduan, transaksi, mention, harga mengikuti ritme jam',
    triggers: 'Picu kejadian nyata', reset: 'Reset dunia', resetSure: 'Yakin? Klik lagi', audit: 'Log audit (live)', auditHint: 'setiap event menulis satu baris; ↳ = reaksi lintas produk',
    rows: 'baris', processed: 'event diproses sejak seed', effects: 'Efek lintas produk', counts: 'Jumlah entitas', reaction: 'reaksi', empty: 'Belum ada event.',
    kpiComplaints: 'Aduan hari ini', kpiSla: 'SLA tepat waktu', kpiAlerts: 'Peringatan aktif', kpiLate: 'Tindak lanjut terlambat', kpiIndex: 'Indeks layanan', vsYesterday: 'vs kemarin',
  },
  en: {
    ready: 'World ready', loading: 'Loading world…', seedNote: 'Simulated data · seed', entities: 'entities', clock: 'World clock', play: 'Run clock', pause: 'Pause clock',
    speed: 'Speed', jump: 'Jump to', natural: 'Natural events', naturalHint: 'complaints, sales, mentions, prices follow the hour',
    triggers: 'Trigger real events', reset: 'Reset world', resetSure: 'Sure? Click again', audit: 'Audit log (live)', auditHint: 'every event writes one row; ↳ = cross-product reaction',
    rows: 'rows', processed: 'events processed since seed', effects: 'Cross-product effects', counts: 'Entity counts', reaction: 'reaction', empty: 'No events yet.',
    kpiComplaints: 'Complaints today', kpiSla: 'SLA on time', kpiAlerts: 'Active alerts', kpiLate: 'Overdue follow-ups', kpiIndex: 'Service index', vsYesterday: 'vs yesterday',
  },
} satisfies Record<L, Record<string, string>>

const ECO_VAR: Record<EcoOrInti, string> = { inti: 'var(--c-lavender)', 'satu-daerah': 'var(--c-teal)', 'usaha-pintar': 'var(--c-peach)', 'pasar-daerah': 'var(--c-plum)' }
const SOURCE_LABEL: Record<string, { id: string; en: string }> = { user: { id: 'Pengguna', en: 'User' }, clock: { id: 'Jam', en: 'Clock' }, tour: { id: 'Tur', en: 'Tour' } }

const COUNT_KEYS: { k: TableKey; id: string; en: string }[] = [
  { k: 'complaints', id: 'Aduan', en: 'Complaints' }, { k: 'clusters', id: 'Klaster', en: 'Clusters' }, { k: 'alerts', id: 'Peringatan', en: 'Alerts' },
  { k: 'procurements', id: 'Paket pengadaan', en: 'Procurements' }, { k: 'catalogNeeds', id: 'Kebutuhan pemda', en: 'Gov. needs' }, { k: 'programs', id: 'Program bansos', en: 'Aid programmes' },
  { k: 'marketOps', id: 'Operasi pasar', en: 'Market ops' }, { k: 'letters', id: 'Surat', en: 'Letters' }, { k: 'actionItems', id: 'Tindak lanjut', en: 'Action items' },
  { k: 'sales', id: 'Transaksi', en: 'Sales' }, { k: 'ledger', id: 'Jurnal', en: 'Journal entries' }, { k: 'mentions', id: 'Mention', en: 'Mentions' },
  { k: 'citizens', id: 'Warga', en: 'Citizens' }, { k: 'businesses', id: 'UMKM', en: 'Businesses' }, { k: 'products', id: 'SKU', en: 'SKUs' }, { k: 'auditLog', id: 'Log audit', en: 'Audit rows' },
]

/* ------------------------------------------------------------------ region pack (real one when present) */
const PACKS = import.meta.glob<{ default: unknown }>('../region/packs/*/pack.json')
async function loadShowcasePack(): Promise<RegionPack> {
  const key = Object.keys(PACKS).find((k) => k.includes('/bojonegoro/'))
  if (key) {
    try {
      const m = await PACKS[key]!()
      const r = RegionPack.safeParse(m.default)
      if (r.success) return r.data
    } catch {
      /* fall back to the fixture */
    }
  }
  return MINI_PACK
}

/* ------------------------------------------------------------------ scenario helpers (all emit real events) */
/** the seeded flood hot spot: first of today's flood complaints in the first flood kecamatan */
function hotSpot(s: WorldState): { kecamatanId: string; desaId: string; coord: LngLat } | null {
  const first = s.region.floodKecamatanIds[0]
  const c = rows(s.complaints).filter((x) => x.category === 'banjir' && x.at >= 0 && x.kecamatanId === first).at(-1)
  if (c) return { kecamatanId: c.kecamatanId, desaId: c.desaId, coord: c.coord }
  const k = s.region.kecamatan.find((x) => x.id === first) ?? s.region.kecamatan[0]
  const d = k?.desa[0]
  return k && d ? { kecamatanId: k.id, desaId: d.id, coord: d.centroid } : null
}
function clusterProgress(s: WorldState): { n: number; clustered: number | null } {
  const spot = hotSpot(s)
  if (!spot) return { n: 0, clustered: null }
  const cl = rows(s.clusters).find((c) => distanceKm(c.center, spot.coord) <= WORLD.clusterRadiusKm)
  if (cl) return { n: cl.complaintIds.length, clustered: cl.complaintIds.length }
  const n = rows(s.complaints).filter((c) => c.category === 'banjir' && c.at >= 0 && !c.clusterId && distanceKm(c.coord, spot.coord) <= WORLD.clusterRadiusKm).length
  return { n, clustered: null }
}
function emitFloodComplaint(pack: RegionPack) {
  const s = world.get()
  const spot = hotSpot(s)
  if (!spot) return
  const k = clusterProgress(s).n
  const tpl = pack.languages.samples.complaintTemplates.find((t) => t.category === 'banjir')
  const a = (k * 137) % 360
  const coord: LngLat = [spot.coord[0] + Math.cos(a) * 0.0025, spot.coord[1] + Math.sin(a) * 0.0025]
  emit('complaint.created', {
    category: 'banjir', channel: 'voice', text: tpl?.text ?? 'Air masuk rumah, mohon bantuan pompa.', lang: tpl?.lang ?? 'id',
    summary: tpl?.translation ?? { id: 'Air masuk rumah, mohon bantuan pompa.', en: 'Water is entering homes, please send pumps.' },
    kecamatanId: spot.kecamatanId, desaId: spot.desaId, coord, urgency: 'tinggi', photo: true, ...(tpl ? { templateId: tpl.id } : {}),
  }, 'sapa-warga')
}
function emitFloodAlert() {
  const s = world.get()
  emit('flood.alert', { level: 3, kecamatanIds: s.region.floodKecamatanIds.slice(0, 2), riverId: s.region.floodRiverId, expectedAt: clock.get().minutes + 180 }, 'siaga-wilayah')
}
function chiliRow(s: WorldState) {
  const commodity = s.region.commodities.find((c) => /cabai/i.test(c.id)) ?? s.region.commodities[0]
  const market = s.markets.byId[s.region.shopMarketId]?.id ?? s.markets.ids[0]
  return commodity && market ? s.prices.byId[`${market}:${commodity.id}`] : undefined
}
function emitPriceAnomaly() {
  const p = chiliRow(world.get())
  if (!p) return
  const price = Math.round((p.price * 1.28) / 500) * 500
  emit('price.anomaly', { marketId: p.marketId, commodityId: p.commodityId, price, expected: p.price, deltaPct: Math.round((price / p.price - 1) * 100) }, 'sinyal-pasar')
}
function emitInstruction() {
  const s = world.get()
  const sug = rows(s.marketOps).find((m) => m.stage === 'recommended')
  const opd = (hint: string) => s.region.opd.find((o) => `${o.short} ${o.name}`.toLowerCase().includes(hint))?.id
  if (sug) {
    const name = s.region.commodities.find((c) => c.id === sug.commodityId)?.name ?? { id: sug.commodityId, en: sug.commodityId }
    emit('instruction.issued', { text: { id: `Gelar operasi pasar ${name.id} besok pagi`, en: `Run a ${name.en} market operation tomorrow morning` }, opdIds: [opd('perdagangan') ?? opd('disperindag') ?? s.region.opd[0]!.id], origin: `marketOps:${sug.id}` }, 'meja-pimpinan')
    return
  }
  const ids = [opd('bpbd'), opd('pupr') ?? opd('pekerjaan umum')].filter((x): x is string => !!x)
  emit('instruction.issued', { text: { id: 'Kerahkan pompa ke titik genangan terparah', en: 'Deploy pumps to the worst-flooded spot' }, opdIds: ids.length ? ids : [s.region.opd[0]!.id] }, 'meja-pimpinan')
}

let staticDone = false
async function runStaticScript(pack: RegionPack) {
  if (staticDone) return
  staticDone = true
  await resetWorld()
  emitFloodAlert()
  await settled()
  for (let i = 0; i < 2; i++) {
    emitFloodComplaint(pack)
    await settled()
  }
  emitPriceAnomaly()
  await settled()
  emitInstruction()
  await settled()
  // one shop sale (Toko Autopilot) → journal (Pajak Beres)
  const s = world.get()
  const outlet = rows(s.outlets).find((o) => o.kind === 'toko')
  const sku = outlet && rows(s.products).find((p) => p.outletId === outlet.id && p.tags.includes('sandbag'))
  if (outlet && sku) emit('sale.created', { outletId: outlet.id, items: [{ productId: sku.id, qty: 40, price: sku.price }], payment: 'qris' }, 'toko-autopilot')
  await settled()
}

/* ------------------------------------------------------------------ small pieces */
function SourceChip({ source, lang }: { source: EventSource; lang: L }) {
  if (isProductSlug(source)) {
    const p = PRODUCT_BY_SLUG[source]
    return (
      <span className="dk-world-src" style={{ ['--dot' as string]: ECO_VAR[p.eco] }}>
        <i aria-hidden="true" />
        {p.name}
      </span>
    )
  }
  return <span className="dk-world-src dk-world-src--plain">{SOURCE_LABEL[source]?.[lang] ?? source}</span>
}

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
const ICON = {
  play: 'M6.5 4.5v11l9-5.5z',
  pause: 'M7 4.5v11M13 4.5v11',
  bolt: 'M11 2.5 4.5 11h5l-1 6.5 6.5-8.5h-5z',
  reset: 'M4 10a6 6 0 1 0 2-4.5M4 3.5V6h2.5',
  check: 'M4.5 10.5 8 14l7.5-8',
  dot: 'M10 10h.01',
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="dk-world-kpi">
      <span className="dk-world-kpi-label">{label}</span>
      <strong className="dk-world-kpi-value">{value}</strong>
      {sub ? <span className="dk-world-kpi-sub">{sub}</span> : null}
    </div>
  )
}

function AuditRow({ a, lang }: { a: AuditEntry; lang: L }) {
  const depth = Math.min(3, a.depth)
  return (
    <li className={`dk-world-row${depth ? ' is-reaction' : ''}`} style={{ ['--depth' as string]: depth }}>
      <time className="dk-world-time">{formatTime(a.at)}</time>
      <SourceChip source={a.source} lang={lang} />
      <span className="dk-world-sum">
        {depth ? <span className="dk-world-arrow" aria-hidden="true">↳ </span> : null}
        {a.summary[lang]}
      </span>
      <code className="dk-world-type">{a.type}</code>
    </li>
  )
}

function Counts({ lang }: { lang: L }) {
  const counts = useWorld(tableCounts, shallowEqual)
  const prev = useRef<Record<string, number> | null>(null)
  const [deltas, setDeltas] = useState<Record<string, { d: number; key: number }>>({})
  useEffect(() => {
    const p = prev.current
    prev.current = counts
    if (!p) return
    const next: Record<string, { d: number; key: number }> = {}
    for (const { k } of COUNT_KEYS) {
      const d = counts[k] - (p[k] ?? 0)
      if (d) next[k] = { d, key: Date.now() }
    }
    if (Object.keys(next).length) setDeltas((old) => ({ ...old, ...next }))
  }, [counts])
  return (
    <ul className="dk-world-counts">
      {COUNT_KEYS.map(({ k, id, en }) => (
        <li key={k}>
          <span className="dk-world-count-label">{lang === 'id' ? id : en}</span>
          <strong className="dk-world-count">{counts[k].toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')}</strong>
          {deltas[k] ? (
            <span key={deltas[k].key} className="dk-world-delta" aria-hidden="true">
              {deltas[k].d > 0 ? '+' : ''}
              {deltas[k].d}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

interface Effect {
  id: string
  label: { id: string; en: string }
  product: string
  done: (s: WorldState) => boolean
}
const EFFECTS: Effect[] = [
  { id: 'pump', product: 'awas-belanja', label: { id: 'Paket “Pengadaan Pompa Air Darurat” muncul', en: '“Emergency Water Pump” package appears' }, done: (s) => rows(s.procurements).some((p) => p.key === 'pompa-darurat') },
  { id: 'forecast', product: 'toko-autopilot', label: { id: 'Prediksi karung pasir, pompa, terpal +340%', en: 'Sandbag, pump, tarp forecast +340%' }, done: (s) => rows(s.stock).some((x) => x.factor > 1) },
  { id: 'need', product: 'katalog-lokal', label: { id: 'Kebutuhan karung pasir & terpal dibuat', en: 'Sandbag & tarp need created' }, done: (s) => rows(s.catalogNeeds).some((n) => n.emergency) },
  { id: 'aid', product: 'cek-berkas', label: { id: 'Kuota pendaftar bansos banjir dibuka', en: 'Flood-aid registration opened' }, done: (s) => rows(s.programs).some((p) => p.open) },
  { id: 'cluster', product: 'sapa-warga', label: { id: '≥ 5 aduan banjir dalam 1 km → klaster', en: '≥ 5 flood reports within 1 km → cluster' }, done: (s) => s.clusters.ids.length > 0 },
  { id: 'marketop', product: 'meja-pimpinan', label: { id: 'Anomali harga → saran operasi pasar', en: 'Price anomaly → market-operation suggestion' }, done: (s) => s.marketOps.ids.length > 0 },
  { id: 'instruction', product: 'naskah-pintar', label: { id: 'Instruksi → disposisi + tindak lanjut', en: 'Instruction → disposition + action items' }, done: (s) => rows(s.instructions).some((i) => !!i.letterId && i.actionItemIds.length > 0) },
  { id: 'ledger', product: 'pajak-beres', label: { id: 'Transaksi toko → jurnal otomatis', en: 'Shop sale → automatic journal entry' }, done: (s) => rows(s.ledger).some((j) => j.source === 'sale' && j.refId !== null) },
]

function Effects({ lang }: { lang: L }) {
  const done = useWorld((s) => EFFECTS.map((e) => e.done(s)), shallowEqual)
  return (
    <ul className="dk-world-effects">
      {EFFECTS.map((e, i) => {
        const p = isProductSlug(e.product) ? PRODUCT_BY_SLUG[e.product] : null
        return (
          <li key={e.id} className={done[i] ? 'is-done' : ''}>
            <span className="dk-world-check" aria-hidden="true">{done[i] ? <Icon d={ICON.check} size={14} /> : null}</span>
            <span className="dk-world-effect-text">
              {e.label[lang]}
              {p ? <span className="dk-world-effect-prod" style={{ ['--dot' as string]: ECO_VAR[p.eco] }}>{p.name}</span> : null}
            </span>
            <span className="dk-sr">{done[i] ? (lang === 'id' ? 'terjadi' : 'happened') : lang === 'id' ? 'belum' : 'not yet'}</span>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ section */
export default function Section() {
  const { lang } = useI18n()
  const t = T[lang]
  const [params] = useSearchParams()
  const isStatic = params.get('static') === '1'
  const status = useWorldStatus()
  const c = useClock()
  const natural = useNaturalEvents()
  const [pack, setPack] = useState<RegionPack | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const anim = useMemo(() => isEnabled('demoAnimations'), [])

  useEffect(() => {
    let alive = true
    void loadShowcasePack().then(async (p) => {
      if (!alive) return
      setPack(p)
      const s = world.get()
      if (world.status() !== 'ready' || s.regionId !== p.id || s.seed !== DEFAULT_SEED) await loadWorld(p, DEFAULT_SEED)
      if (alive && isStatic) await runStaticScript(p)
    })
    return () => {
      alive = false
      clock.pause()
    }
  }, [isStatic])

  useEffect(() => {
    if (!confirmReset) return
    const id = window.setTimeout(() => setConfirmReset(false), 3000)
    return () => window.clearTimeout(id)
  }, [confirmReset])

  const header = useWorld((s) => ({ name: s.region.name, day: s.day, seed: s.seed, processed: s.meta.processed }), shallowEqual)
  const audit = useWorld((s) => latestAudit(s, 14))
  const auditTotal = useWorld((s) => s.auditLog.ids.length)
  const kpi = useWorld((s) => ({
    ...complaintKpi(s, c.minutes), sla: slaOnTimePct(s), alerts: activeAlerts(s).length, late: overdueActions(s, c.minutes).length, index: serviceIndex(s, c.minutes),
  }), shallowEqual)
  const cluster = useWorld(clusterProgress, shallowEqual)
  const hasSuggestion = useWorld((s) => rows(s.marketOps).some((m) => m.stage === 'recommended'))
  const entityTotal = useWorld((s) => Object.values(tableCounts(s)).reduce((a, b) => a + b, 0))

  const locale = lang === 'id' ? 'id-ID' : 'en-GB'
  const dateLabel = worldDate(header.day, 0).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
  const ready = status === 'ready' && !!pack
  const fmt = (n: number) => n.toLocaleString(locale)

  const triggers = [
    {
      id: 'complaint', icon: ICON.bolt, run: () => pack && emitFloodComplaint(pack), type: 'complaint.created', source: 'sapa-warga',
      label: lang === 'id' ? 'Warga lapor banjir (voice note)' : 'Citizen reports a flood (voice note)',
      note: cluster.clustered !== null ? (lang === 'id' ? `Klaster aktif: ${cluster.clustered} aduan` : `Cluster active: ${cluster.clustered} reports`) : `${Math.min(cluster.n, WORLD.clusterMin)}/${WORLD.clusterMin} ${lang === 'id' ? 'menuju klaster' : 'to a cluster'}`,
    },
    { id: 'flood', icon: ICON.bolt, run: emitFloodAlert, type: 'flood.alert', source: 'siaga-wilayah', label: lang === 'id' ? 'Kirim peringatan banjir level 3' : 'Issue a level-3 flood warning', note: lang === 'id' ? '4 reaksi lintas produk' : '4 cross-product reactions' },
    { id: 'price', icon: ICON.bolt, run: emitPriceAnomaly, type: 'price.anomaly', source: 'sinyal-pasar', label: lang === 'id' ? 'Harga cabai melonjak 28%' : 'Chilli price jumps 28%', note: lang === 'id' ? 'saran ke Meja Pimpinan' : 'suggestion to Meja Pimpinan' },
    {
      id: 'instruction', icon: ICON.bolt, run: emitInstruction, type: 'instruction.issued', source: 'meja-pimpinan',
      label: hasSuggestion ? (lang === 'id' ? 'Setujui saran operasi pasar' : 'Approve the market-operation suggestion') : lang === 'id' ? 'Instruksi: kerahkan pompa' : 'Instruction: deploy pumps',
      note: lang === 'id' ? 'jadi disposisi + tugas OPD' : 'becomes disposition + agency tasks',
    },
  ] as const

  return (
    <div className={`dk-root dk-world${anim ? ' is-anim' : ''}`} data-eco="inti" aria-busy={!ready}>
      <div className="dk-world-bar">
        <div className="dk-world-bar-l">
          <strong>{header.name || '—'}</strong>
          <span className="dk-world-faint">{dateLabel}</span>
        </div>
        <div className="dk-world-bar-r">
          <span className={`dk-world-pill${ready ? ' is-ready' : ''}`}>
            <i aria-hidden="true" />
            {ready ? `${t.ready} · ${fmt(entityTotal)} ${t.entities}` : t.loading}
          </span>
          <span className="dk-world-faint">{t.seedNote} {header.seed || DEFAULT_SEED}</span>
        </div>
      </div>

      <div className="dk-world-kpis">
        <Kpi label={t.kpiComplaints} value={fmt(kpi.today)} sub={`${kpi.delta >= 0 ? '+' : ''}${kpi.delta} ${t.vsYesterday}`} />
        <Kpi label={t.kpiSla} value={`${kpi.sla}%`} />
        <Kpi label={t.kpiAlerts} value={fmt(kpi.alerts)} />
        <Kpi label={t.kpiLate} value={fmt(kpi.late)} />
        <Kpi label={t.kpiIndex} value={kpi.index} />
      </div>

      <div className="dk-world-grid">
        <div className="dk-world-col">
          <section className="dk-world-card" aria-labelledby="dk-world-clock-h">
            <h3 id="dk-world-clock-h" className="dk-world-h">{t.clock}</h3>
            <div className="dk-world-clockrow">
              <span className="dk-world-time-big" aria-live="off">{formatTime(c.minutes)}</span>
              <button type="button" className="dk-world-play" onClick={() => clock.toggle()} disabled={!ready} aria-label={c.running ? t.pause : t.play} aria-pressed={c.running}>
                <Icon d={c.running ? ICON.pause : ICON.play} size={20} />
              </button>
            </div>
            <div className="dk-world-field">
              <span className="dk-world-label" id="dk-world-speed">{t.speed}</span>
              <div className="dk-world-seg" role="group" aria-labelledby="dk-world-speed">
                {CLOCK.speeds.map((sp) => (
                  <button key={sp} type="button" aria-pressed={c.speed === sp} onClick={() => clock.setSpeed(sp)}>×{sp}</button>
                ))}
              </div>
            </div>
            <div className="dk-world-field">
              <span className="dk-world-label" id="dk-world-jump">{t.jump}</span>
              <div className="dk-world-jumps" role="group" aria-labelledby="dk-world-jump">
                {CLOCK.jumps.map((j) => (
                  <button key={j} type="button" aria-pressed={formatTime(c.minutes) === j} onClick={() => clock.setTime(j)}>{j}</button>
                ))}
              </div>
            </div>
            <button type="button" className="dk-world-switch" role="switch" aria-checked={natural} onClick={() => setNaturalEvents(!natural)}>
              <span className="dk-world-switch-track" aria-hidden="true"><span /></span>
              <span>
                <strong>{t.natural}</strong>
                <span className="dk-world-faint">{t.naturalHint}</span>
              </span>
            </button>
          </section>

          <section className="dk-world-card" aria-labelledby="dk-world-trig-h">
            <h3 id="dk-world-trig-h" className="dk-world-h">{t.triggers}</h3>
            <div className="dk-world-triggers">
              {triggers.map((g) => {
                const p = isProductSlug(g.source) ? PRODUCT_BY_SLUG[g.source] : null
                return (
                  <button key={g.id} type="button" className="dk-world-trigger" onClick={g.run} disabled={!ready} style={{ ['--dot' as string]: p ? ECO_VAR[p.eco] : 'var(--c-lavender)' }}>
                    <span className="dk-world-trigger-ic"><Icon d={g.icon} /></span>
                    <span className="dk-world-trigger-main">
                      <strong>{g.label}</strong>
                      <span className="dk-world-faint"><code>{g.type}</code> · {p?.name} · {g.note}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button" className={`dk-world-reset${confirmReset ? ' is-armed' : ''}`} disabled={!ready}
              onClick={() => {
                if (!confirmReset) return setConfirmReset(true)
                setConfirmReset(false)
                void resetWorld()
              }}
            >
              <Icon d={ICON.reset} size={16} /> {confirmReset ? t.resetSure : t.reset}
            </button>
          </section>
        </div>

        <section className="dk-world-card dk-world-auditcard" aria-labelledby="dk-world-audit-h">
          <div className="dk-world-auditbar">
            <h3 id="dk-world-audit-h" className="dk-world-h">{t.audit}</h3>
            <span className="dk-world-faint">{fmt(auditTotal)} {t.rows} · {fmt(header.processed)} {t.processed}</span>
          </div>
          <p className="dk-world-faint dk-world-hint">{t.auditHint}</p>
          {audit.length ? (
            <ol className="dk-world-audit" aria-live="polite" aria-relevant="additions">
              {audit.map((a) => <AuditRow key={a.id} a={a} lang={lang} />)}
            </ol>
          ) : (
            <p className="dk-world-faint">{t.empty}</p>
          )}
        </section>
      </div>

      <div className="dk-world-grid dk-world-grid--bottom">
        <section className="dk-world-card" aria-labelledby="dk-world-eff-h">
          <h3 id="dk-world-eff-h" className="dk-world-h">{t.effects}</h3>
          <Effects lang={lang} />
        </section>
        <section className="dk-world-card" aria-labelledby="dk-world-cnt-h">
          <h3 id="dk-world-cnt-h" className="dk-world-h">{t.counts}</h3>
          <Counts lang={lang} />
        </section>
      </div>
    </div>
  )
}
