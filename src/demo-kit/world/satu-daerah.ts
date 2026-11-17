/**
 * world/satu-daerah.ts — shared selectors and scenario helpers for the Satu Daerah products (tahap 2: Sapa Warga,
 * Meja Pimpinan, Naskah Pintar, Radar Isu, Siaga Wilayah, Awas Belanja, Cek Berkas).
 *
 * NOT re-exported from the world barrel: products import it directly
 *   import { kpiStrip, briefingItems } from '../../demo-kit/world/satu-daerah'
 * so demos of other ecosystems never download it. Every selector is memoised on the identity of the tables it
 * reads (structural sharing in the reducers), so calling them from `useWorld` on each notify is cheap.
 * Scenario helpers (`floodScenarioAlert`, `rainScenario`, `hoaxBurst`) return event PAYLOADS: the product emits
 * them with its own slug as source, so the shell can announce the cross-product effects.
 *
 * Numbers are SIMULATED (seeded world); label them "simulasi" in the UI where they could pass for official data.
 */
import type {
  ActionItem, Alert, Bi, Bidder, Briefing, Citizen, CitizenMessage, Complaint, ComplaintCluster, DocumentRec, EntityRef, EventMap, Facility,
  Harvest, Letter, Mention, Minutes, Procurement, ProcurementFinding, Ticket, WorldState,
} from './types'
import type { ProductSlug } from '../../content/products'
import type { RegionPack } from '../region/types'
import { createParamSelector, createSelector, complaintKpi, slaOnTimePct, activeAlerts, negativeIssues, overdueActions, serviceIndex } from './selectors'
import { CATEGORY_LABEL } from './labels'
import { HOAX_OFFSETS, HOAX_SCENARIO, hoaxPost } from './scenario-texts'
import { DAY_MIN, WORLD, distanceKm, hhmm, offsetKm, ref, rows } from './util'

const kecName = (s: WorldState, id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
const desaName = (s: WorldState, kec: string, desa: string) => s.region.kecamatan.find((k) => k.id === kec)?.desa.find((d) => d.id === desa)?.name ?? desa
const opdShort = (s: WorldState, id: string) => s.region.opd.find((o) => o.id === id)?.short ?? id
const idNum = (n: number, d = 0) => n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d })
const enNum = (n: number, d = 0) => n.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d })
const rpShort = (n: number): Bi => {
  const a = Math.abs(n)
  if (a >= 1e9) return { id: `Rp ${idNum(n / 1e9, 1)} M`, en: `Rp ${enNum(n / 1e9, 1)} bn` }
  if (a >= 1e6) return { id: `Rp ${idNum(n / 1e6, 1)} jt`, en: `Rp ${enNum(n / 1e6, 1)} m` }
  return { id: `Rp ${idNum(n)}`, en: `Rp ${enNum(n)}` }
}
/** deterministic 0..1 from a string (stable per entity id) */
function unit(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/* ================================================================== personas · citizen phone (Sapa Warga) */

export interface Personas {
  siti: Citizen | undefined
  raka: Citizen | undefined
  darmo: Citizen | undefined
}
/** the three script personas (Ibu Siti — regional language, flood desa; Raka — NIB; Pak Darmo — damaged e-KTP) */
export const personas = /*#__PURE__*/ createSelector((s) => [s.citizens, s.meta.personas], (c, p): Personas => ({
  siti: c.byId[p.siti], raka: c.byId[p.raka], darmo: c.byId[p.darmo],
}))

export interface CitizenInbox {
  messages: CitizenMessage[]
  complaints: { complaint: Complaint; ticket: Ticket | undefined }[]
  bookings: WorldState['bookings']['byId'][string][]
}
/** everything that shows on one citizen's phone, newest first */
export const citizenInbox = /*#__PURE__*/ createParamSelector((s) => [s.messages, s.complaints, s.tickets, s.bookings], (citizenId: string, msgs, complaints, tickets, bookings): CitizenInbox => ({
  messages: rows(msgs).filter((m) => m.to.includes(citizenId)),
  complaints: rows(complaints).filter((c) => c.citizenId === citizenId).map((complaint) => ({ complaint, ticket: tickets.byId[complaint.ticketId] })),
  bookings: rows(bookings).filter((b) => b.citizenId === citizenId),
}))

export interface ConsoleTicket {
  ticket: Ticket
  complaint: Complaint
  citizen: Citizen | undefined
  /** minutes left until the SLA due time at `now` (negative = late) */
  slaLeft: number
}
/** Konsol Petugas rows: ticket + complaint + citizen, newest first (filter / group in the product) */
export const consoleTickets = /*#__PURE__*/ createParamSelector((s) => [s.tickets, s.complaints, s.citizens], (now: Minutes, tickets, complaints, citizens): ConsoleTicket[] => {
  const out: ConsoleTicket[] = []
  for (const t of rows(tickets)) {
    const complaint = complaints.byId[t.complaintId]
    if (!complaint) continue
    out.push({ ticket: t, complaint, citizen: complaint.citizenId ? citizens.byId[complaint.citizenId] : undefined, slaLeft: t.status === 'selesai' ? 0 : t.slaDueAt - now })
  }
  return out
})

/** open complaints of the same category within `radiusKm` (the "Gabungkan duplikat" candidates) */
export function duplicateCandidates(s: WorldState, complaintId: string, radiusKm = 0.5): Complaint[] {
  const c = s.complaints.byId[complaintId]
  if (!c) return []
  return rows(s.complaints).filter((x) => {
    if (x.id === c.id || x.category !== c.category || Math.abs(x.at - c.at) > DAY_MIN) return false
    const st = s.tickets.byId[x.ticketId]?.status
    return st !== 'selesai' && distanceKm(x.coord, c.coord) <= radiusKm
  })
}

/* ================================================================== Meja Pimpinan */

export interface KpiStrip {
  complaints: { today: number; yesterday: number; delta: number }
  slaPct: number
  alerts: number
  negativeIssues: number
  overdue: number
  serviceIndex: number
}
/** the six KPI cards (spec P2): complaints today (Δ vs yesterday same time), SLA on time %, active alerts, negative issues, overdue follow-ups, service index */
export const kpiStrip: (s: WorldState, now: Minutes) => KpiStrip = /*#__PURE__*/ createParamSelector(
  (s) => [s.complaints, s.tickets, s.alerts, s.mentions, s.actionItems],
  (now: Minutes, complaints, tickets, alerts, mentions, actionItems): KpiStrip => {
    const s = { complaints, tickets, alerts, mentions, actionItems } as WorldState
    return {
      complaints: complaintKpi(s, now),
      slaPct: slaOnTimePct(s),
      alerts: activeAlerts(s).length,
      negativeIssues: negativeIssues(s, now).length,
      overdue: overdueActions(s, now).length,
      serviceIndex: serviceIndex(s, now),
    }
  },
)

export interface OpdRow {
  opdId: string
  name: string
  short: string
  openTickets: number
  closed30: number
  /** % of tickets closed in the last 30 days that met their SLA (null when none closed) */
  slaPct: number | null
  /** average rating 1–5 (null when no rating) */
  rating: number | null
  actionsOpen: number
  actionsLate: number
  /** composite 0–100: SLA 50 %, follow-up discipline 30 %, satisfaction 20 % */
  score: number
}
/** OPD leaderboard (Meja Pimpinan "papan peringkat"), best first; OPDs without tickets or actions are left out */
export const opdLeaderboard = /*#__PURE__*/ createParamSelector((s) => [s.tickets, s.actionItems, s.region], (now: Minutes, tickets, actions, region): OpdRow[] => {
  const by = new Map<string, OpdRow & { onTime: number; rSum: number; rN: number }>()
  const row = (opdId: string) => {
    let r = by.get(opdId)
    if (!r) {
      const o = region.opd.find((x) => x.id === opdId)
      r = { opdId, name: o?.name ?? opdId, short: o?.short ?? opdId, openTickets: 0, closed30: 0, slaPct: null, rating: null, actionsOpen: 0, actionsLate: 0, score: 0, onTime: 0, rSum: 0, rN: 0 }
      by.set(opdId, r)
    }
    return r
  }
  for (const t of rows(tickets)) {
    const r = row(t.opdId)
    if (t.status !== 'selesai') r.openTickets++
    else if (t.closedAt !== null && t.closedAt >= now - 30 * DAY_MIN) {
      r.closed30++
      if (t.closedAt <= t.slaDueAt) r.onTime++
    }
    if (t.rating !== null) {
      r.rSum += t.rating
      r.rN++
    }
  }
  for (const a of rows(actions)) {
    if (a.status === 'selesai') continue
    const r = row(a.opdId)
    r.actionsOpen++
    if (a.dueAt < now) r.actionsLate++
  }
  const out: OpdRow[] = []
  for (const r of by.values()) {
    const sla = r.closed30 ? Math.round((r.onTime / r.closed30) * 100) : null
    const rating = r.rN ? Math.round((r.rSum / r.rN) * 10) / 10 : null
    const discipline = r.actionsOpen ? 1 - r.actionsLate / r.actionsOpen : 1
    const score = Math.round(0.5 * (sla ?? 80) + 30 * discipline + 20 * ((rating ?? 3.5) / 5))
    out.push({ opdId: r.opdId, name: r.name, short: r.short, openTickets: r.openTickets, closed30: r.closed30, slaPct: sla, rating, actionsOpen: r.actionsOpen, actionsLate: r.actionsLate, score })
  }
  return out.sort((a, b) => b.score - a.score || a.short.localeCompare(b.short))
})

export interface OpdScorecard {
  opdId: string
  /** 30 daily points, oldest → newest: tickets closed that day and % on time (null = none closed) */
  trend: { day: number; closed: number; onTimePct: number | null }[]
  openTickets: Ticket[]
  actions: ActionItem[]
}
/** one OPD's scorecard (Meja Pimpinan step 4) */
export function opdScorecard(s: WorldState, opdId: string, now: Minutes): OpdScorecard {
  const today = Math.floor(now / DAY_MIN)
  const trend = Array.from({ length: 30 }, (_, i) => ({ day: today - 29 + i, closed: 0, onTime: 0 }))
  const openTickets: Ticket[] = []
  for (const t of rows(s.tickets)) {
    if (t.opdId !== opdId) continue
    if (t.status !== 'selesai') openTickets.push(t)
    else if (t.closedAt !== null) {
      const slot = trend[Math.floor(t.closedAt / DAY_MIN) - (today - 29)]
      if (slot) {
        slot.closed++
        if (t.closedAt <= t.slaDueAt) slot.onTime++
      }
    }
  }
  return {
    opdId,
    trend: trend.map((d) => ({ day: d.day, closed: d.closed, onTimePct: d.closed ? Math.round((d.onTime / d.closed) * 100) : null })),
    openTickets,
    actions: rows(s.actionItems).filter((a) => a.opdId === opdId),
  }
}

/** complaints per kecamatan (and the top category) over the last `days` days up to `now` — "Tanya data" answers, map heat */
export function complaintsByKecamatan(s: WorldState, now: Minutes, days = 7, category?: Complaint['category']): { kecamatanId: string; name: string; count: number; prev: number }[] {
  const from = now - days * DAY_MIN
  const by = new Map<string, { count: number; prev: number }>()
  for (const c of rows(s.complaints)) {
    if (category && c.category !== category) continue
    const r = by.get(c.kecamatanId) ?? { count: 0, prev: 0 }
    if (c.at > from && c.at <= now) r.count++
    else if (c.at > from - days * DAY_MIN && c.at <= from) r.prev++
    by.set(c.kecamatanId, r)
  }
  return [...by.entries()].map(([kecamatanId, r]) => ({ kecamatanId, name: kecName(s, kecamatanId), ...r })).sort((a, b) => b.count - a.count)
}

export type BriefingItem = Briefing['items'][number] & {
  /** a one-line detail under the title */
  detail: Bi
  /** where the item jumps to (product + entity for `?focus=`) */
  focus: string | null
}
/**
 * The morning briefing assembled from the world (spec P2 step 1): ≥ 6 items, each tied to world data and to the
 * product it comes from. Emit `briefing.generated` with `items.map(({ title, source, refs }) => …)`.
 */
/** Radar Isu topic ids in both languages (briefing, KPI captions, AI answers) */
export const TOPIC_LABEL: Record<string, Bi> = {
  banjir: { id: 'banjir', en: 'flooding' }, bansos: { id: 'bansos', en: 'social aid' }, harga: { id: 'harga', en: 'prices' },
  'hoaks-bendungan': { id: 'hoaks bendungan', en: 'dam hoax' }, jalan: { id: 'jalan', en: 'roads' }, kesehatan: { id: 'kesehatan', en: 'health' },
  kualitas: { id: 'kualitas', en: 'quality' }, layanan: { id: 'layanan', en: 'public services' }, pendidikan: { id: 'pendidikan', en: 'education' },
  pengiriman: { id: 'pengiriman', en: 'delivery' }, sampah: { id: 'sampah', en: 'waste' }, stok: { id: 'stok', en: 'stock' }, umkm: { id: 'UMKM', en: 'small businesses' },
}
export const topicLabel = (topic: string, lang: 'id' | 'en'): string => TOPIC_LABEL[topic]?.[lang] ?? topic

/**
 * Change vs 7 days ago as a fraction (0.155 = +15.5 %). `history` holds daily closes EXCLUDING today, so 7 days ago
 * is the 7th value from the end. Every product that quotes a weekly price change uses this one.
 */
export function weekChangeOf(price: number, history: readonly number[]): number {
  const base = history[history.length - 7] ?? history[0] ?? price
  return base > 0 ? (price - base) / base : 0
}

export function briefingItems(s: WorldState, now: Minutes): BriefingItem[] {
  const out: BriefingItem[] = []
  // an item never links to the same record as an earlier one (e.g. "complaints today" and "flood reports" share one)
  const used = new Set<EntityRef>()
  const push = (source: ProductSlug, title: Bi, detail: Bi, refs0: EntityRef[]) => {
    const free = refs0.length > 1 && refs0[0] && used.has(refs0[0]) ? refs0.find((r) => !used.has(r)) : undefined
    const refs = free ? [free, ...refs0.filter((r) => r !== free)] : refs0
    if (refs[0]) used.add(refs[0])
    out.push({ source, title, detail, refs, focus: refs[0]?.split(':').slice(1).join(':') || null })
  }
  // 1 · complaints today (Sapa Warga)
  const today = rows(s.complaints).filter((c) => c.at >= Math.floor(now / DAY_MIN) * DAY_MIN && c.at <= now)
  const cats = new Map<string, Complaint[]>()
  for (const c of today) cats.set(c.category, [...(cats.get(c.category) ?? []), c])
  const top = [...cats.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  const k = complaintKpi(s, now)
  if (top) {
    const lab = CATEGORY_LABEL[top[0] as Complaint['category']]
    push('sapa-warga', { id: `${k.today} aduan masuk hari ini, terbanyak ${lab.id.toLowerCase()} (${top[1].length})`, en: `${k.today} complaints today, most about ${lab.en.toLowerCase()} (${top[1].length})` },
      { id: `${k.delta >= 0 ? '+' : ''}${k.delta} dibanding kemarin pada jam yang sama`, en: `${k.delta >= 0 ? '+' : ''}${k.delta} vs yesterday at the same time` }, top[1].slice(0, 5).map((c) => ref('complaints', c.id)))
  }
  // 2 · biggest cluster (Sapa Warga → Meja Pimpinan)
  const cl = rows(s.clusters).sort((a, b) => b.complaintIds.length - a.complaintIds.length)[0]
  if (cl) {
    push('sapa-warga', { id: `Klaster ${CATEGORY_LABEL[cl.category].id.toLowerCase()} di ${desaName(s, cl.kecamatanId, cl.desaId)}: ${cl.complaintIds.length} aduan`, en: `${CATEGORY_LABEL[cl.category].en} cluster in ${desaName(s, cl.kecamatanId, cl.desaId)}: ${cl.complaintIds.length} complaints` },
      { id: `Kec. ${kecName(s, cl.kecamatanId)}, radius ${cl.radiusKm} km`, en: `${kecName(s, cl.kecamatanId)} district, ${cl.radiusKm} km radius` }, [ref('clusters', cl.id)])
  } else {
    const flood = today.filter((c) => c.category === 'banjir')
    push('sapa-warga', { id: `${flood.length} aduan banjir sejak dini hari, belum membentuk klaster`, en: `${flood.length} flood reports since dawn, no cluster yet` },
      { id: `Klaster terbentuk pada ${WORLD.clusterMin} aduan dalam ${WORLD.clusterRadiusKm} km`, en: `A cluster forms at ${WORLD.clusterMin} reports within ${WORLD.clusterRadiusKm} km` }, flood.slice(0, 5).map((c) => ref('complaints', c.id)))
  }
  // 3 · rain / flood (Siaga Wilayah)
  const alert = activeAlerts(s).filter((a) => a.kind === 'banjir').sort((a, b) => b.level - a.level)[0]
  const river = rows(s.gauges).find((g) => g.kind === 'sungai')
  if (alert) {
    push('siaga-wilayah', { id: `Peringatan banjir level ${alert.level}: Kec. ${alert.kecamatanIds.map((x) => kecName(s, x)).join(', ')}`, en: `Flood warning level ${alert.level}: ${alert.kecamatanIds.map((x) => kecName(s, x)).join(', ')}` },
      alert.broadcast ? { id: `Peringatan dini terkirim ke ${idNum(alert.broadcast.recipients)} penerima`, en: `Early warning sent to ${enNum(alert.broadcast.recipients)} recipients` } : { id: 'Peringatan dini belum dikirim ke warga', en: 'Early warning not yet sent to residents' }, [ref('alerts', alert.id)])
  } else if (river) {
    const rising = river.level - (river.history[0] ?? river.level)
    push('siaga-wilayah', { id: `Muka air ${river.name} ${idNum(river.level, 1)} m, naik ${idNum(rising, 1)} m dalam 24 jam`, en: `${river.name} at ${enNum(river.level, 1)} m, up ${enNum(rising, 1)} m in 24 h` },
      { id: `Batas siaga ${idNum(river.siaga, 1)} m (data simulasi). Hujan lebat diprakirakan siang ini.`, en: `Alert level ${enNum(river.siaga, 1)} m (simulated data). Heavy rain expected this afternoon.` }, [ref('gauges', river.id)])
  }
  // 4 · viral issue (Radar Isu)
  const hoax = rows(s.hoaxAlerts).find((h) => h.status === 'aktif')
  const neg = negativeIssues(s, now)[0]
  if (hoax) {
    push('radar-isu', { id: `Hoaks viral: ${hoax.claim.id}`, en: `Viral hoax: ${hoax.claim.en}` }, { id: `Skor hoaks ${Math.round(hoax.score * 100)}%, belum diklarifikasi`, en: `Hoax score ${Math.round(hoax.score * 100)}%, not clarified yet` }, [ref('hoaxAlerts', hoax.id)])
  } else if (neg) {
    push('radar-isu', { id: `Isu negatif terbesar: ${topicLabel(neg.topic, 'id')} (${neg.count} mention)`, en: `Top negative issue: ${topicLabel(neg.topic, 'en')} (${neg.count} mentions)` }, { id: `Jangkauan ±${idNum(neg.reach)} akun dalam 24 jam`, en: `Reach ≈ ${enNum(neg.reach)} accounts in 24 h` }, [ref('mentions', neg.latest.id)])
  }
  // 5 · risky procurement (Awas Belanja)
  const procs = rows(s.procurements).filter((p) => p.status !== 'selesai')
  const risky = procs.filter((p) => p.flagged).sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))[0] ?? procs.find((p) => p.emergency) ?? procs.sort((a, b) => devPct(b) - devPct(a))[0]
  if (risky) {
    const d = Math.round(devPct(risky))
    push('awas-belanja', { id: `Paket berisiko: ${risky.name.id} (${rpShort(risky.hps).id})`, en: `Risky package: ${risky.name.en} (${rpShort(risky.hps).en})` },
      risky.flagged ? { id: `Skor risiko ${risky.riskScore}, ${risky.findings.filter((f) => f.level !== 'lolos').length} temuan`, en: `Risk score ${risky.riskScore}, ${risky.findings.filter((f) => f.level !== 'lolos').length} findings` } : { id: `HPS ${d}% di atas harga pasar, belum dianalisis`, en: `HPS ${d}% above market price, not analysed yet` }, [ref('procurements', risky.id)])
  }
  // 6 · prices (Sinyal Pasar)
  const op = rows(s.marketOps).find((m) => m.stage === 'recommended')
  const anomaly = rows(s.prices).find((p) => p.anomaly)
  // the single market × commodity with the largest true 7-day rise (an anomaly row wins, with its real change)
  let rise: { p: (typeof s.prices.byId)[string]; d: number } | null = null
  for (const p of rows(s.prices)) {
    const d = weekChangeOf(p.price, p.history)
    if (!rise || d > rise.d) rise = { p, d }
  }
  if (op) push('sinyal-pasar', { id: `Rekomendasi operasi pasar: ${s.region.commodities.find((c) => c.id === op.commodityId)?.name.id ?? op.commodityId}`, en: `Market operation recommended: ${s.region.commodities.find((c) => c.id === op.commodityId)?.name.en ?? op.commodityId}` }, op.reason, [ref('marketOps', op.id)])
  else if (anomaly || rise) {
    const p = anomaly ?? rise!.p
    const c = s.region.commodities.find((x) => x.id === p.commodityId)?.name ?? { id: p.commodityId, en: p.commodityId }
    const m = s.markets.byId[p.marketId]?.name ?? p.marketId
    const pct = Math.round(weekChangeOf(p.price, p.history) * 1000) / 10
    const fmtPct = (l: 'id' | 'en') => Math.abs(pct).toLocaleString(l === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 })
    push('sinyal-pasar', { id: `Harga ${c.id.toLowerCase()} di ${m} ${pct >= 0 ? 'naik' : 'turun'} ${fmtPct('id')}% sepekan`, en: `${c.en} at ${m} ${pct >= 0 ? 'up' : 'down'} ${fmtPct('en')}% in a week` },
      { id: `Rp ${idNum(p.price)} per satuan${p.anomaly ? ', ditandai anomali' : ''} (data simulasi)`, en: `Rp ${enNum(p.price)} per unit${p.anomaly ? ', flagged as an anomaly' : ''} (simulated data)` }, [ref('prices', p.id)])
  }
  // 7 · overdue follow-ups (Naskah Pintar)
  const late = overdueActions(s, now)
  if (late.length) {
    const opds = [...new Set(late.map((a) => opdShort(s, a.opdId)))].slice(0, 3).join(', ')
    push('naskah-pintar', { id: `${late.length} tindak lanjut rapat lewat tenggat`, en: `${late.length} meeting follow-ups overdue` }, { id: `Terbanyak di ${opds}`, en: `Mostly at ${opds}` }, late.slice(0, 5).map((a) => ref('actionItems', a.id)))
  }
  // 8 · bansos registration (Cek Berkas) when open
  const prog = rows(s.programs).find((p) => p.open)
  if (prog) {
    const docs = rows(s.documents).filter((d) => d.program === prog.kind)
    push('cek-berkas', { id: `Pendaftaran bansos banjir dibuka: ${docs.length} berkas masuk`, en: `Flood-aid registration open: ${docs.length} applications in` }, { id: `Kuota ${idNum(prog.quota)} KK`, en: `Quota ${enNum(prog.quota)} households` }, [ref('programs', prog.id)])
  }
  // 9 · economic index (Indeks Ekonomi) when an update arrived today (post-flood harvest, chain C10): lowest district
  const dayStart = Math.floor(now / DAY_MIN) * DAY_MIN
  const econ = new Map<EntityRef, Minutes>()
  for (const id of s.auditLog.ids) {
    const a = s.auditLog.byId[id]
    const r = a?.entityRefs[0]
    if (a && r && a.type === 'econ.updated' && a.at >= dayStart && a.at <= now && !econ.has(r)) econ.set(r, a.at)
  }
  const econRows = [...econ.entries()]
    .map(([r, at]) => ({ r, at, row: s.econIndex.byId[r.split(':').slice(1).join(':')] }))
    .filter((e): e is { r: EntityRef; at: Minutes; row: NonNullable<typeof e.row> } => !!e.row)
    .sort((a, b) => a.row.index - b.row.index)
  const low = econRows[0]
  if (low) {
    const k = kecName(s, low.row.kecamatanId)
    const n = econRows.length
    const at = hhmm(Math.max(...econRows.map((e) => e.at)))
    push('indeks-ekonomi', n > 1
      ? { id: `Indeks ekonomi diperbarui di ${n} kecamatan; terendah Kec. ${k}: ${idNum(low.row.index, 1)}`, en: `Economic index updated in ${n} districts; lowest ${k}: ${enNum(low.row.index, 1)}` }
      : { id: `Indeks ekonomi Kec. ${k} diperbarui: ${idNum(low.row.index, 1)}`, en: `Economic index of ${k} updated: ${enNum(low.row.index, 1)}` },
    { id: `100 = rata-rata 12 bulan; pukul ${at.replace(':', '.')} (data simulasi)`, en: `100 = 12-month average; at ${at} (simulated data)` }, [low.r])
  }
  return out
}

/** "Beri instruksi" suggestions (spec P2 step 5) derived from what the briefing shows */
export function instructionIdeas(s: WorldState, now: Minutes): { text: Bi; opdIds: string[]; refs: EntityRef[] }[] {
  const out: { text: Bi; opdIds: string[]; refs: EntityRef[] }[] = []
  const opd = (hint: string) => s.region.opd.find((o) => `${o.id} ${o.short}`.toLowerCase().includes(hint))?.id
  const cl = rows(s.clusters).sort((a, b) => b.complaintIds.length - a.complaintIds.length)[0]
  const bpbd = opd('bpbd')
  const pupr = opd('pupr')
  if (cl && bpbd) out.push({ text: { id: `Kerahkan pompa ke ${desaName(s, cl.kecamatanId, cl.desaId)}, Kec. ${kecName(s, cl.kecamatanId)}`, en: `Deploy pumps to ${desaName(s, cl.kecamatanId, cl.desaId)}, ${kecName(s, cl.kecamatanId)}` }, opdIds: [bpbd, ...(pupr ? [pupr] : [])], refs: [ref('clusters', cl.id)] })
  const late = overdueActions(s, now)[0]
  if (late) out.push({ text: { id: `Selesaikan tindak lanjut "${late.title.id}" paling lambat besok`, en: `Close the follow-up "${late.title.en}" by tomorrow` }, opdIds: [late.opdId], refs: [ref('actionItems', late.id)] })
  const hoax = rows(s.hoaxAlerts).find((h) => h.status === 'aktif')
  const kominfo = opd('kominfo')
  if (hoax && kominfo) out.push({ text: { id: 'Terbitkan klarifikasi resmi hari ini juga', en: 'Publish an official clarification today' }, opdIds: [kominfo], refs: [ref('hoaxAlerts', hoax.id)] })
  for (const m of rows(s.marketOps).filter((x) => x.stage === 'recommended').slice(0, 1)) {
    const dag = opd('disperindag')
    if (dag) out.push({ text: { id: `Setujui operasi pasar ${s.region.commodities.find((c) => c.id === m.commodityId)?.name.id ?? m.commodityId}`, en: `Approve the ${s.region.commodities.find((c) => c.id === m.commodityId)?.name.en ?? m.commodityId} market operation` }, opdIds: [dag], refs: [ref('marketOps', m.id)] })
  }
  return out
}

/* ================================================================== Naskah Pintar */

/** incoming letters (status 'masuk' first, newest first) */
export const letterInbox = /*#__PURE__*/ createSelector((s) => [s.letters], (t): Letter[] => rows(t).sort((a, b) => (a.status === b.status ? b.receivedAt - a.receivedAt : a.status === 'masuk' ? -1 : 1)))

export interface ActionColumn {
  opdId: string
  short: string
  items: (ActionItem & { late: boolean })[]
}
/** Tindak Lanjut kanban: one column per OPD with open items (late ones first), plus every instruction's tasks */
export const actionBoard = /*#__PURE__*/ createParamSelector((s) => [s.actionItems, s.region], (now: Minutes, t, region): ActionColumn[] => {
  const by = new Map<string, ActionColumn>()
  for (const a of rows(t)) {
    let c = by.get(a.opdId)
    if (!c) by.set(a.opdId, (c = { opdId: a.opdId, short: region.opd.find((o) => o.id === a.opdId)?.short ?? a.opdId, items: [] }))
    c.items.push({ ...a, late: a.status !== 'selesai' && a.dueAt < now })
  }
  for (const c of by.values()) c.items.sort((a, b) => Number(b.late) - Number(a.late) || a.dueAt - b.dueAt)
  return [...by.values()].sort((a, b) => b.items.filter((i) => i.late).length - a.items.filter((i) => i.late).length || b.items.length - a.items.length)
})

/* ================================================================== Radar Isu */

export interface HourBucket {
  /** world minute where the hour starts */
  start: Minutes
  count: number
  neg: number
  neu: number
  pos: number
  /** mean sentiment score −1..1 (0 when empty) */
  avg: number
  /** mentions of a hoax / rumor in this hour */
  hoax: number
  reach: number
}
const byHourSel = /*#__PURE__*/ createParamSelector((s) => [s.mentions], (key: string, t): HourBucket[] => {
  const [now, hours] = key.split('|').map(Number) as [number, number]
  return byHour({ mentions: t } as WorldState, now, hours)
})
/** mention volume + sentiment per hour, the last `hours` hours up to `now` (oldest first) — sentiment chart, volume. Memoised. */
export function mentionsByHour(s: WorldState, now: Minutes, hours = 24): HourBucket[] {
  return byHourSel(s, `${now}|${hours}`)
}
function byHour(s: WorldState, now: Minutes, hours: number): HourBucket[] {
  const end = Math.floor(now / 60) * 60 + 60
  const start = end - hours * 60
  const b: HourBucket[] = Array.from({ length: hours }, (_, i) => ({ start: start + i * 60, count: 0, neg: 0, neu: 0, pos: 0, avg: 0, hoax: 0, reach: 0 }))
  const sums = new Array<number>(hours).fill(0)
  for (const m of rows(s.mentions)) {
    if (m.at > now || m.at < start) continue
    const i = Math.floor((m.at - start) / 60)
    const x = b[i]
    if (!x) continue
    x.count++
    x.reach += m.reach
    sums[i]! += m.score
    if (m.sentiment === 'negatif') x.neg++
    else if (m.sentiment === 'positif') x.pos++
    else x.neu++
    if (m.rumor || m.hoaxId) x.hoax++
  }
  b.forEach((x, i) => (x.avg = x.count ? Math.round((sums[i]! / x.count) * 100) / 100 : 0))
  return b
}

const seriesSel = /*#__PURE__*/ createParamSelector((s) => [s.mentions], (key: string, t): { start: Minutes; value: number; count: number }[] => {
  const [now, hours] = key.split('|').map(Number) as [number, number]
  let last = 0
  return mentionsByHour({ mentions: t } as WorldState, now, hours).map((h) => {
    if (h.count) last = Math.round(h.avg * 100)
    return { start: h.start, value: last, count: h.count }
  })
})
/** sentiment index per hour (−100..100), carrying the last value through empty hours — the 24 h line. Memoised. */
export function sentimentSeries(s: WorldState, now: Minutes, hours = 24): { start: Minutes; value: number; count: number }[] {
  return seriesSel(s, `${now}|${hours}`)
}

export interface TopicCluster {
  topic: string
  count: number
  reach: number
  /** mean score −1..1 */
  score: number
  sentiment: Mention['sentiment']
  latest: Mention
  hoax: boolean
}
const topicSel = /*#__PURE__*/ createParamSelector((s) => [s.mentions], (key: string, t): TopicCluster[] => {
  const [now, hours] = key.split('|').map(Number) as [number, number]
  return topics({ mentions: t } as WorldState, now, hours)
})
/** topic bubbles (size = volume, colour = sentiment) over the last `hours` up to `now`, biggest first. Memoised. */
export function topicClusters(s: WorldState, now: Minutes, hours = 24): TopicCluster[] {
  return topicSel(s, `${now}|${hours}`)
}
function topics(s: WorldState, now: Minutes, hours: number): TopicCluster[] {
  const by = new Map<string, { n: number; reach: number; sum: number; latest: Mention; hoax: boolean }>()
  for (const m of rows(s.mentions)) {
    if (m.at > now || m.at < now - hours * 60) continue
    const g = by.get(m.topic)
    if (g) {
      g.n++
      g.reach += m.reach
      g.sum += m.score
      if (m.at > g.latest.at) g.latest = m
      g.hoax ||= !!(m.rumor || m.hoaxId)
    } else by.set(m.topic, { n: 1, reach: m.reach, sum: m.score, latest: m, hoax: !!(m.rumor || m.hoaxId) })
  }
  return [...by.entries()].map(([topic, g]) => {
    const score = Math.round((g.sum / g.n) * 100) / 100
    return { topic, count: g.n, reach: g.reach, score, sentiment: (score < -0.2 ? 'negatif' : score > 0.2 ? 'positif' : 'netral') as Mention['sentiment'], latest: g.latest, hoax: g.hoax }
  }).sort((a, b) => b.count - a.count || b.reach - a.reach)
}

/** mentions up to `now`, newest first (the live stream); `limit` keeps the list short */
export function mentionStream(s: WorldState, now: Minutes, limit = 60): Mention[] {
  const out: Mention[] = []
  for (const id of s.mentions.ids) {
    const m = s.mentions.byId[id]
    if (!m || m.at > now) continue
    out.push(m)
    if (out.length >= limit) break
  }
  return out.sort((a, b) => b.at - a.at)
}

/**
 * The false-narrative burst (spec P4 step 2): `mention.created` payloads at `at` + 0…25 min. Emit them in order with
 * your product as source ("Picu skenario"); the 6th one makes the world raise `hoax.detected` (→ Meja Pimpinan toast).
 * The clock does the same by itself at 10:00 when natural events run (source 'clock'). Empty when already fired.
 */
export function hoaxBurst(s: WorldState, at: Minutes): EventMap['mention.created'][] {
  const rumor = s.meta.facts.hoax.rumor || HOAX_SCENARIO.rumor
  if (rows(s.mentions).some((m) => m.rumor === rumor)) return []
  const dam = s.meta.facts.hoax.damName || 'Bendungan'
  const k = kecName(s, s.region.floodKecamatanIds[0] ?? s.region.kecamatan[0]?.id ?? '')
  return HOAX_OFFSETS.map((_, i) => hoaxPost(i, at, dam, k, rumor))
}

/** the rumor's mentions (oldest first) with cumulative reach — the small exponential "kecepatan sebar" chart */
export function rumorSpread(s: WorldState, rumor: string): { at: Minutes; reach: number; cumulative: number }[] {
  let cum = 0
  return rows(s.mentions).filter((m) => m.rumor === rumor).sort((a, b) => a.at - b.at).map((m) => ({ at: m.at, reach: m.reach, cumulative: (cum += m.reach) }))
}

/* ================================================================== Siaga Wilayah */

/**
 * The scenario flood alert payload (emit with source 'siaga-wilayah'): the pack's flood kecamatan, level 3, the
 * scenario river. Using the same alert keeps every downstream count consistent (Cek Berkas outside-zone = facts).
 */
export function floodScenarioAlert(s: WorldState, now: Minutes, opts: { level?: 1 | 2 | 3 | 4; kecamatanIds?: string[]; desaIds?: string[] } = {}): EventMap['flood.alert'] {
  return { level: opts.level ?? 3, kecamatanIds: opts.kecamatanIds ?? s.region.floodKecamatanIds, desaIds: opts.desaIds ?? [], riverId: s.region.floodRiverId || null, expectedAt: now + 180 }
}

/** rain.forecast payload for the morning scenario: cells entering from the west over the flood kecamatan (deterministic) */
export function rainScenario(s: WorldState, horizonH = 6): EventMap['rain.forecast'] {
  const ks = s.region.floodKecamatanIds.map((id) => s.region.kecamatan.find((k) => k.id === id)).filter((k): k is NonNullable<typeof k> => !!k)
  const anchors = ks.length ? ks : s.region.kecamatan.slice(0, 2)
  const cells = anchors.slice(0, 4).map((k, i) => ({
    center: offsetKm(k.centroid, -14 - 4 * i, (i % 2 ? 1 : -1) * 2.5),
    radiusKm: 6 + (i % 3) * 2,
    intensity: [48, 36, 28, 22][i] ?? 20,
    heading: 80 + i * 6,
    speedKmh: 18 + i * 2,
  }))
  return { cells, horizonH, peakMmH: Math.max(...cells.map((c) => c.intensity)), kecamatanIds: anchors.map((k) => k.id) }
}

export interface Recipient {
  id: string
  /** title only (officials are never named) */
  title: Bi
  kind: 'camat' | 'kades' | 'lurah'
  kecamatanId: string
  desaId: string | null
  /** fictional, masked */
  phone: string
}
/** early-warning recipients per real kecamatan / desa: the camat and every kades / lurah (titles only, fictional numbers) */
export function alertRecipients(s: WorldState, kecamatanIds: string[], opts: { desaIds?: string[]; pack?: RegionPack | null } = {}): Recipient[] {
  const desaSet = opts.desaIds?.length ? new Set(opts.desaIds) : null
  const out: Recipient[] = []
  const phone = (key: string) => `08${12 + Math.floor(unit(key) * 87)}-xxxx-${String(Math.floor(unit(`${key}#`) * 9999)).padStart(4, '0')}`
  for (const kid of kecamatanIds) {
    const k = s.region.kecamatan.find((x) => x.id === kid)
    if (!k) continue
    out.push({ id: `camat:${kid}`, title: { id: `Camat ${k.name}`, en: `Head of ${k.name} district (Camat)` }, kind: 'camat', kecamatanId: kid, desaId: null, phone: phone(`camat:${kid}`) })
    const pk = opts.pack?.kecamatan.find((x) => x.id === kid)
    for (const d of k.desa) {
      if (desaSet && !desaSet.has(d.id)) continue
      const kel = pk?.desa.find((x) => x.id === d.id)?.kind === 'kelurahan'
      out.push({
        id: `${kel ? 'lurah' : 'kades'}:${d.id}`, kind: kel ? 'lurah' : 'kades', kecamatanId: kid, desaId: d.id, phone: phone(`desa:${d.id}`),
        title: kel ? { id: `Lurah ${d.name}`, en: `Head of ${d.name} urban village (Lurah)` } : { id: `Kepala Desa ${d.name}`, en: `Head of ${d.name} village (Kades)` },
      })
    }
  }
  return out
}

/** citizens who would receive a broadcast for these kecamatan (and desa) — the count shown before "Kirim" */
export function zoneCitizens(s: WorldState, kecamatanIds: string[], desaIds?: string[]): Citizen[] {
  const zone = new Set(kecamatanIds)
  const desa = desaIds?.length ? new Set(desaIds) : null
  return rows(s.citizens).filter((c) => zone.has(c.kecamatanId) && (!desa || desa.has(c.desaId)))
}

/** flood complaints that confirm an alert ("Terkonfirmasi warga") — from the alert's confirmations, else today's flood complaints in its zone */
export function confirmedComplaints(s: WorldState, alert: Alert | undefined): Complaint[] {
  if (!alert) return []
  if (alert.confirmedBy?.length) return alert.confirmedBy.map((id) => s.complaints.byId[id]).filter((c): c is Complaint => !!c)
  const zone = new Set(alert.kecamatanIds)
  return rows(s.complaints).filter((c) => c.category === 'banjir' && c.at >= alert.at - 12 * 60 && zone.has(c.kecamatanId))
}

/** facilities of some kinds (all when omitted); shelters carry origin 'simulasi' — label them so */
export const facilitiesOf = /*#__PURE__*/ createParamSelector((s) => [s.facilities], (kinds: string, t): Facility[] => {
  const want = kinds ? new Set(kinds.split(',')) : null
  return rows(t).filter((f) => !want || want.has(f.kind))
})

const harvestSel = /*#__PURE__*/ createParamSelector((s) => [s.harvests], (key: string, t): Record<string, number> => {
  const [metric, crop] = key.split('|') as ['estimate' | 'change' | 'ndvi', string]
  return harvestAgg({ harvests: t } as WorldState, metric, (crop || undefined) as Harvest['crop'] | undefined)
})
/** harvest choropleth values per kecamatan: 'estimate' (ton), 'change' (% vs normal) or 'ndvi' (0..1) for one crop or all. Memoised. */
export function harvestValues(s: WorldState, metric: 'estimate' | 'change' | 'ndvi', crop?: Harvest['crop']): Record<string, number> {
  return harvestSel(s, `${metric}|${crop ?? ''}`)
}
function harvestAgg(s: WorldState, metric: 'estimate' | 'change' | 'ndvi', crop?: Harvest['crop']): Record<string, number> {
  const agg = new Map<string, { base: number; now: number; ndvi: number; n: number }>()
  for (const h of rows(s.harvests)) {
    if (crop && h.crop !== crop) continue
    const a = agg.get(h.kecamatanId) ?? { base: 0, now: 0, ndvi: 0, n: 0 }
    a.base += h.baselineTon
    a.now += h.estimateTon
    a.ndvi += h.ndvi
    a.n++
    agg.set(h.kecamatanId, a)
  }
  const out: Record<string, number> = {}
  for (const [k, a] of agg) out[k] = metric === 'estimate' ? a.now : metric === 'ndvi' ? Math.round((a.ndvi / a.n) * 100) / 100 : a.base ? Math.round(((a.now - a.base) / a.base) * 1000) / 10 : 0
  return out
}

/* ================================================================== Awas Belanja */

const devPct = (p: Procurement) => {
  const hps = p.items.reduce((a, i) => a + i.hpsPrice * i.qty, 0)
  const mkt = p.items.reduce((a, i) => a + i.marketPrice * i.qty, 0)
  return mkt ? ((hps - mkt) / mkt) * 100 : 0
}

export interface PackageRow {
  procurement: Procurement
  bidders: Bidder[]
  /** HPS vs market price deviation % over all items */
  deviationPct: number
}
/** the package list (newest first) with bidders resolved */
export const packages = /*#__PURE__*/ createSelector((s) => [s.procurements, s.bidders], (t, b): PackageRow[] =>
  rows(t).map((procurement) => ({ procurement, bidders: procurement.bidderIds.map((id) => b.byId[id]).filter((x): x is Bidder => !!x), deviationPct: Math.round(devPct(procurement) * 10) / 10 })),
)

export interface AffiliationEdge {
  a: string
  b: string
  kinds: ('alamat' | 'direktur' | 'ip' | 'giliran')[]
  evidence: Bi[]
}
/** edges between a package's bidders: same address, same director, same registration IP, rotating past wins */
export function affiliationEdges(s: WorldState, procurementId: string): AffiliationEdge[] {
  const p = s.procurements.byId[procurementId]
  if (!p) return []
  const bs = p.bidderIds.map((id) => s.bidders.byId[id]).filter((x): x is Bidder => !!x)
  const history = rows(s.procurements).filter((x) => x.id !== p.id && x.opdId === p.opdId && x.winnerId)
  const out: AffiliationEdge[] = []
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i]!
      const b = bs[j]!
      const kinds: AffiliationEdge['kinds'] = []
      const evidence: Bi[] = []
      if (a.address === b.address) {
        kinds.push('alamat')
        evidence.push({ id: `Alamat sama: ${a.address}`, en: `Same address: ${a.address}` })
      }
      if (a.director === b.director) {
        kinds.push('direktur')
        evidence.push({ id: `Direktur sama: ${a.director}`, en: `Same director: ${a.director}` })
      }
      if (a.ip === b.ip) {
        kinds.push('ip')
        evidence.push({ id: `IP pendaftaran sama: ${a.ip}`, en: `Same registration IP: ${a.ip}` })
      }
      const together = history.filter((h) => h.bidderIds.includes(a.id) && h.bidderIds.includes(b.id))
      const wins = together.filter((h) => h.winnerId === a.id || h.winnerId === b.id)
      if (together.length >= 2 && wins.length === together.length && new Set(wins.map((h) => h.winnerId)).size === 2) {
        kinds.push('giliran')
        evidence.push({ id: `Menang bergiliran di ${wins.length} paket: ${wins.map((h) => h.code).join(', ')}`, en: `Won in turns in ${wins.length} packages: ${wins.map((h) => h.code).join(', ')}` })
      }
      if (kinds.length) out.push({ a: a.id, b: b.id, kinds, evidence })
    }
  return out
}

export interface ItemDeviation {
  name: Bi
  qty: number
  unit: string
  hps: number
  market: number
  /** (HPS − market) / market × 100 */
  devPct: number
  /** (HPS − market) × qty */
  overpay: number
  level: 'lolos' | 'waspada' | 'tinggi'
}
/** HPS vs market table (spec P6 "HPS vs Pasar"): the memo must quote these same numbers */
export function hpsVsMarket(s: WorldState, procurementId: string): { items: ItemDeviation[]; hps: number; market: number; overpay: number; devPct: number } {
  const p = s.procurements.byId[procurementId]
  const items: ItemDeviation[] = (p?.items ?? []).map((it) => {
    const dev = it.marketPrice ? ((it.hpsPrice - it.marketPrice) / it.marketPrice) * 100 : 0
    return { name: it.name, qty: it.qty, unit: it.unit, hps: it.hpsPrice, market: it.marketPrice, devPct: Math.round(dev * 10) / 10, overpay: (it.hpsPrice - it.marketPrice) * it.qty, level: dev > 20 ? 'tinggi' : dev > 10 ? 'waspada' : 'lolos' }
  })
  const hps = items.reduce((a, i) => a + i.hps * i.qty, 0)
  const market = items.reduce((a, i) => a + i.market * i.qty, 0)
  return { items, hps, market, overpay: hps - market, devPct: market ? Math.round(((hps - market) / market) * 1000) / 10 : 0 }
}

/** the direct-procurement ceiling used by the 'pemecahan-paket' detector (Rp; simulated rule of the demo) */
export const DIRECT_PROCUREMENT_CEILING = 200_000_000

/**
 * Run the seven detectors on a package (spec P6 "Pola") — deterministic, every finding with an explanation that
 * quotes world numbers. Emit `procurement.flagged` with { riskScore, findings } after the scan animation.
 */
export function analyzeProcurement(s: WorldState, procurementId: string): { riskScore: number; findings: ProcurementFinding[] } {
  const p = s.procurements.byId[procurementId]
  if (!p) return { riskScore: 0, findings: [] }
  const f: ProcurementFinding[] = []
  const name = (id: string) => s.bidders.byId[id]?.name ?? id
  // 1 · uniform bid prices
  const bids = [...(p.bids ?? [])].sort((a, b) => a.price - b.price)
  let tight: typeof bids = []
  for (let i = 0; i < bids.length; i++) {
    const grp = bids.filter((b) => b.price >= bids[i]!.price && b.price <= bids[i]!.price * 1.005)
    if (grp.length > tight.length) tight = grp
  }
  f.push(tight.length >= 3
    ? { detector: 'harga-seragam', level: 'tinggi', note: { id: `${tight.length} penawaran berselisih kurang dari 0,5% (${tight.map((b) => name(b.bidderId)).join(', ')})`, en: `${tight.length} bids within 0.5% of each other (${tight.map((b) => name(b.bidderId)).join(', ')})` } }
    : { detector: 'harga-seragam', level: 'lolos', note: { id: 'Sebaran harga penawaran wajar', en: 'Bid prices are reasonably spread' } })
  // 2 · repeat winners (same OPD, current bidders)
  const past = rows(s.procurements).filter((x) => x.id !== p.id && x.opdId === p.opdId && x.winnerId && p.bidderIds.includes(x.winnerId))
  const winners = new Set(past.map((x) => x.winnerId))
  f.push(past.length >= 3
    ? { detector: 'pemenang-berulang', level: 'tinggi', note: { id: `${past.length} paket ${opdShort(s, p.opdId)} sebelumnya dimenangkan ${winners.size} peserta paket ini secara bergiliran`, en: `${past.length} earlier ${opdShort(s, p.opdId)} packages were won in turns by ${winners.size} bidders of this package` } }
    : past.length ? { detector: 'pemenang-berulang', level: 'waspada', note: { id: `${past.length} paket sebelumnya dimenangkan peserta yang sama`, en: `${past.length} earlier package(s) won by the same bidders` } }
    : { detector: 'pemenang-berulang', level: 'lolos', note: { id: 'Tidak ada pola pemenang berulang', en: 'No repeat-winner pattern' } })
  // 3 · split packages under the direct-procurement ceiling (same OPD, 30 days)
  const split = rows(s.procurements).filter((x) => x.id !== p.id && x.opdId === p.opdId && x.method === 'pengadaan-langsung' && x.hps < DIRECT_PROCUREMENT_CEILING && Math.abs(x.createdAt - p.createdAt) <= 30 * DAY_MIN && x.hps >= DIRECT_PROCUREMENT_CEILING * 0.9)
  f.push(split.length >= 2
    ? { detector: 'pemecahan-paket', level: 'waspada', note: { id: `${split.length} paket sejenis ${opdShort(s, p.opdId)} masing-masing ${rpShort(split[0]!.hps).id}, tepat di bawah ambang ${rpShort(DIRECT_PROCUREMENT_CEILING).id}`, en: `${split.length} similar ${opdShort(s, p.opdId)} packages of ${rpShort(split[0]!.hps).en} each, just under the ${rpShort(DIRECT_PROCUREMENT_CEILING).en} ceiling` } }
    : { detector: 'pemecahan-paket', level: 'lolos', note: { id: 'Tidak ada indikasi pemecahan paket', en: 'No sign of package splitting' } })
  // 4 · short schedule
  const days = p.scheduleDays ?? Math.round((p.deadlineAt - p.createdAt) / DAY_MIN)
  f.push(p.hps >= 1_000_000_000 && days < 7
    ? { detector: 'jadwal-singkat', level: p.emergency ? 'waspada' : 'tinggi', note: { id: `Jadwal penawaran ${days} hari untuk nilai ${rpShort(p.hps).id}${p.emergency ? ' (status darurat, tetap perlu justifikasi)' : ''}`, en: `${days}-day bidding window for ${rpShort(p.hps).en}${p.emergency ? ' (emergency status, still needs justification)' : ''}` } }
    : { detector: 'jadwal-singkat', level: 'lolos', note: { id: `Jadwal ${days} hari sesuai nilai paket`, en: `${days}-day window fits the package value` } })
  // 5 · brand-locked spec
  const spec = p.spec?.id ?? ''
  f.push(/merek/i.test(spec) && !/setara/i.test(spec)
    ? { detector: 'spesifikasi-merek', level: 'tinggi', note: { id: 'Spesifikasi menyebut satu merek tanpa "atau setara"', en: 'The spec names one brand without "or equivalent"' } }
    : { detector: 'spesifikasi-merek', level: 'lolos', note: { id: 'Spesifikasi netral merek', en: 'Brand-neutral specification' } })
  // 6 · HPS above market
  const hv = hpsVsMarket(s, p.id)
  f.push({
    detector: 'hps-kemahalan', level: hv.devPct > 20 ? 'tinggi' : hv.devPct > 10 ? 'waspada' : 'lolos',
    note: { id: `HPS ${idNum(hv.devPct, 1)}% di atas median pasar (selisih ${rpShort(hv.overpay).id})`, en: `HPS ${enNum(hv.devPct, 1)}% above the market median (difference ${rpShort(hv.overpay).en})` },
  })
  // 7 · affiliated bidders
  const edges = affiliationEdges(s, p.id)
  const ring = new Set(edges.flatMap((e) => [e.a, e.b]))
  f.push(edges.length
    ? { detector: 'afiliasi', level: ring.size >= 3 ? 'tinggi' : 'waspada', note: { id: `${ring.size} peserta terhubung lewat ${edges.length} kesamaan (alamat, direktur, IP, giliran menang)`, en: `${ring.size} bidders linked by ${edges.length} shared traits (address, director, IP, rotating wins)` } }
    : { detector: 'afiliasi', level: 'lolos', note: { id: 'Tidak ada keterkaitan antarpeserta', en: 'No links between bidders' } })
  const w = { lolos: 0, waspada: 8, tinggi: 18 }
  const riskScore = Math.min(100, 8 + f.reduce((a, x) => a + w[x.level], 0))
  return { riskScore, findings: f }
}

/** local UMKM offers matched through Katalog Lokal for a package's need (price benchmark, spec P6 consume match.made) */
export function localBenchmarks(s: WorldState, procurementId: string): { businessId: string; name: string; score: number; needId: string }[] {
  const cause = ref('procurements', procurementId)
  const needs = rows(s.catalogNeeds).filter((n) => n.cause === cause).map((n) => n.id)
  return rows(s.matches).filter((m) => needs.includes(m.needId)).map((m) => ({ businessId: m.businessId, name: s.businesses.byId[m.businessId]?.name ?? m.businessId, score: m.score, needId: m.needId }))
}

/* ================================================================== Cek Berkas */

export interface BansosRow {
  doc: DocumentRec
  citizen: Citizen | undefined
  /** other applicant documents sharing this NIK */
  duplicateOf: string[]
  /** address outside the zone checked against (Siaga Wilayah) */
  outsideZone: boolean
  /** deterministic per document: a required attachment is missing */
  missing: Bi | null
  result: 'lolos' | 'kurang' | 'ganda' | 'luar-zona'
}
export interface BansosBatch {
  rows: BansosRow[]
  /** kecamatan the addresses were checked against */
  zone: string[]
  /** NIK-sharing groups (doc ids) — draw the connecting lines between these cards */
  duplicateGroups: string[][]
  /** ganda = files in a NIK-sharing group, gandaPairs = groups (= facts.bansosDuplicatePairs), luarZona = every file outside the zone */
  summary: { total: number; lolos: number; kurang: number; ganda: number; gandaPairs: number; luarZona: number }
}
const MISSING: Bi[] = [
  { id: 'Foto rumah belum dilampirkan', en: 'House photo not attached' },
  { id: 'Fotokopi KK belum dilampirkan', en: 'Family card copy not attached' },
  { id: 'Surat keterangan domisili belum ada', en: 'Domicile letter missing' },
]
/**
 * The 50 flood-aid applicant files (spec P7 "Massal"). Zone = the open bansos programme's kecamatan, else the active
 * flood alert's, else the scenario flood kecamatan. With the scenario alert, ganda pairs = facts.bansosDuplicatePairs
 * and luar-zona = facts.bansosOutsideZone.
 */
const bansosSel = /*#__PURE__*/ createParamSelector((s) => [s.documents, s.programs, s.alerts, s.citizens, s.region], (zone: string, documents, programs, alerts, citizens, region): BansosBatch =>
  batch({ documents, programs, alerts, citizens, region } as WorldState, zone ? zone.split(',') : undefined),
)
export function bansosBatch(s: WorldState, zone?: string[]): BansosBatch {
  return bansosSel(s, zone?.join(',') ?? '')
}
function batch(s: WorldState, zone?: string[]): BansosBatch {
  const prog = rows(s.programs).find((p) => p.open && p.kind === 'bansos-banjir')
  const alert = activeAlerts(s).find((a) => a.kind === 'banjir')
  const z = zone ?? prog?.kecamatanIds ?? alert?.kecamatanIds ?? s.region.floodKecamatanIds
  const zs = new Set(z)
  const docs = rows(s.documents).filter((d) => d.program === 'bansos-banjir' && d.kind === 'ktp').sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  const byNik = new Map<string, string[]>()
  for (const d of docs) if (d.nik) byNik.set(d.nik, [...(byNik.get(d.nik) ?? []), d.id])
  const groups = [...byNik.values()].filter((g) => g.length > 1)
  const out: BansosRow[] = docs.map((doc) => {
    const dup = doc.nik ? (byNik.get(doc.nik) ?? []).filter((id) => id !== doc.id) : []
    const outsideZone = !zs.has(doc.kecamatanId)
    const u = unit(doc.id)
    const missing = !dup.length && !outsideZone && u < 0.12 ? MISSING[Math.floor(u * 100) % MISSING.length]! : null
    return { doc, citizen: doc.citizenId ? s.citizens.byId[doc.citizenId] : undefined, duplicateOf: dup, outsideZone, missing, result: dup.length ? 'ganda' : outsideZone ? 'luar-zona' : missing ? 'kurang' : 'lolos' }
  })
  const n = (r: BansosRow['result']) => out.filter((x) => x.result === r).length
  return {
    rows: out, zone: z, duplicateGroups: groups,
    summary: { total: out.length, lolos: n('lolos'), kurang: n('kurang'), ganda: n('ganda'), gandaPairs: groups.length, luarZona: out.filter((x) => x.outsideZone).length },
  }
}

/** CSV of a batch (Ekspor CSV) — fictional specimen data; NIK masked except the last 4 digits */
export function bansosCsv(b: BansosBatch, lang: 'id' | 'en'): string {
  const head = lang === 'id' ? ['berkas', 'nama', 'nik', 'kecamatan', 'hasil', 'catatan'] : ['file', 'name', 'nik', 'district', 'result', 'note']
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = b.rows.map((r) => [r.doc.id, r.doc.ownerName, r.doc.nik ? `************${r.doc.nik.slice(-4)}` : '', r.doc.kecamatanId, r.result, r.missing?.[lang] ?? (r.duplicateOf.length ? r.duplicateOf.join(' ') : '')].map(q).join(','))
  return [head.join(','), ...lines].join('\n')
}

/** cluster + its complaints (Sapa Warga "Klaster aduan", Siaga Wilayah points) */
export function clusterDetail(s: WorldState, clusterId: string): { cluster: ComplaintCluster | undefined; complaints: Complaint[] } {
  const cluster = s.clusters.byId[clusterId]
  return { cluster, complaints: (cluster?.complaintIds ?? []).map((id) => s.complaints.byId[id]).filter((c): c is Complaint => !!c) }
}
