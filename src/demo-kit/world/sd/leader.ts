/**
 * world/sd/leader.ts — Meja Pimpinan: KPI strip, scorecard, briefing, instruction ideas.
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { ActionItem, Bi, Briefing, Complaint, EntityRef, Minutes, Ticket, WaterGauge, WorldState } from '../types'
import type { ProductSlug } from '../../../content/products'
import { createParamSelector, complaintKpi, slaOnTimePct, activeAlerts, negativeIssues, overdueActions, serviceIndex } from '../selectors'
import { CATEGORY_LABEL } from '../labels'
import { DAY_MIN, WORLD, hhmm, ref, rows } from '../util'
import { kecName, desaName, opdShort, idNum, enNum, rpShort, n1, hm, devPct, topicLabel } from './base'
import { gaugeName, gaugeLevelAt, gaugeOutlook } from './gauge'
import { bansosBatch } from './bansos'

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
      slaPct: slaOnTimePct(s, now),
      alerts: activeAlerts(s).length,
      negativeIssues: negativeIssues(s, now).length,
      overdue: overdueActions(s, now).length,
      serviceIndex: serviceIndex(s, now),
    }
  },
)

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
  // stable on ties, so the chat, the briefing and the map insight name the same district
  return [...by.entries()].map(([kecamatanId, r]) => ({ kecamatanId, name: kecName(s, kecamatanId), ...r })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
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

/**
 * Change vs 7 days ago as a fraction (0.155 = +15.5 %). `history` holds daily closes EXCLUDING today, so 7 days ago
 * is the 7th value from the end. Every product that quotes a weekly price change uses this one.
 */
// moved to world/price-math.ts (Pasar Daerah reads it without sd/leader); re-exported for the Satu Daerah barrel
import { weekChangeOf } from '../price-math'
export { weekChangeOf }

const UNIT_EN: Record<string, string> = { kg: 'kg', liter: 'litre', l: 'litre', butir: 'egg', ikat: 'bunch', ekor: 'head', papan: 'tray', bungkus: 'pack', karung: 'sack' }

/** true when the alert was raised by the clock (the automatic scenario warning), not by a person in Siaga Wilayah */
function isClockAlert(s: WorldState, alertId: string): boolean {
  const key = ref('alerts', alertId)
  for (const id of s.auditLog.ids) {
    const a = s.auditLog.byId[id]
    if (a?.type === 'flood.alert' && a.entityRefs.includes(key)) return a.source === 'clock'
  }
  return false
}

/**
 * Briefing item 3 without an alert: the river's ONE clock-driven reading (gaugeOutlook) with its status, in the same
 * words Meja Pimpinan, Siaga Wilayah and "Tanya data" use. SIMULATED readings.
 */
function riverTitle(g: WaterGauge, now: Minutes): Bi {
  const o = gaugeOutlook(g, now)
  const name = gaugeName(g)
  const level = gaugeLevelAt(g, now)
  const rise = level - gaugeLevelAt(g, now - DAY_MIN)
  if (o.state === 'normal') return { id: `Muka air ${name.id} ${n1(level, 'id')} m, ${rise >= 0 ? 'naik' : 'turun'} ${n1(Math.abs(rise), 'id')} m dalam 24 jam`, en: `${name.en} at ${n1(level, 'en')} m, ${rise >= 0 ? 'up' : 'down'} ${n1(Math.abs(rise), 'en')} m in 24 h` }
  return o.state === 'awas'
    ? { id: `${name.id} status AWAS: ${n1(level, 'id')} m (batas awas ${n1(g.awas, 'id')} m)`, en: `${name.en} at danger level AWAS: ${n1(level, 'en')} m (threshold ${n1(g.awas, 'en')} m)` }
    : { id: `${name.id} status SIAGA: ${n1(level, 'id')} m (batas siaga ${n1(g.siaga, 'id')} m)`, en: `${name.en} at alert level SIAGA: ${n1(level, 'en')} m (threshold ${n1(g.siaga, 'en')} m)` }
}
function riverDetail(s: WorldState, g: WaterGauge, now: Minutes): Bi {
  const o = gaugeOutlook(g, now)
  const level = gaugeLevelAt(g, now)
  const rise = level - gaugeLevelAt(g, now - DAY_MIN)
  const up: Bi = { id: `${rise >= 0 ? 'Naik' : 'Turun'} ${n1(Math.abs(rise), 'id')} m dalam 24 jam`, en: `${rise >= 0 ? 'Up' : 'Down'} ${n1(Math.abs(rise), 'en')} m in 24 h` }
  const next: Bi = o.peak.level > level + 0.05
    ? { id: `puncak ±${n1(o.peak.level, 'id')} m sekitar pukul ${hm(o.peak.at, 'id')}`, en: `crest ≈ ${n1(o.peak.level, 'en')} m around ${hm(o.peak.at, 'en')}` }
    : o.trend < -0.02 ? { id: 'mulai surut', en: 'starting to recede' } : { id: 'bertahan', en: 'holding' }
  // the heavy-rain outlook belongs to the morning only
  const rain: Bi = now % DAY_MIN < 11 * 60 ? { id: ' Hujan lebat diprakirakan siang ini.', en: ' Heavy rain expected this afternoon.' } : { id: '', en: '' }
  if (o.state === 'normal') return { id: `Batas siaga ${n1(g.siaga, 'id')} m; ${next.id} (data simulasi).${rain.id}`, en: `Alert level ${n1(g.siaga, 'en')} m; ${next.en} (simulated data).${rain.en}` }
  const alerts = rows(s.alerts).filter((a) => a.status === 'aktif' && a.kind === 'banjir').length
  return alerts
    ? { id: `${up.id}; ${next.id}. ${alerts} peringatan banjir aktif (data simulasi).`, en: `${up.en}; ${next.en}. ${alerts} flood warning(s) active (simulated data).` }
    : { id: `${up.id}; ${next.id}. Belum ada peringatan banjir resmi (data simulasi).${rain.id}`, en: `${up.en}; ${next.en}. No official flood warning yet (simulated data).${rain.en}` }
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
    // an automatic warning (the clock's scenario alert, in Siaga Wilayah's domain) is worded as such: it is active,
    // only the broadcast to residents is still to be sent
    const auto = !alert.broadcast && isClockAlert(s, alert.id)
    push('siaga-wilayah', { id: `Peringatan banjir level ${alert.level}: Kec. ${alert.kecamatanIds.map((x) => kecName(s, x)).join(', ')}`, en: `Flood warning level ${alert.level}: ${alert.kecamatanIds.map((x) => kecName(s, x)).join(', ')}` },
      alert.broadcast
        ? { id: `Peringatan dini terkirim ke ${idNum(alert.broadcast.recipients)} penerima`, en: `Early warning sent to ${enNum(alert.broadcast.recipients)} recipients` }
        : auto
          ? { id: `Peringatan banjir level ${alert.level} aktif sejak ${hm(alert.at, 'id')}; siaran ke warga belum dikirim`, en: `Level-${alert.level} flood warning active since ${hm(alert.at, 'en')}; broadcast to residents not yet sent` }
          : { id: 'Peringatan dini belum dikirim ke warga', en: 'Early warning not yet sent to residents' },
      [ref('alerts', alert.id)])
  } else if (river) {
    push('siaga-wilayah', riverTitle(river, now), riverDetail(s, river, now), [ref('gauges', river.id)])
  }
  // 4 · viral issue (Radar Isu)
  const hoax = rows(s.hoaxAlerts).find((h) => h.status === 'aktif')
  const neg = negativeIssues(s, now)[0]
  if (hoax) {
    // a clarification the leader already ordered (an instruction that refs the hoax): say so, not "not clarified yet"
    const key = ref('hoaxAlerts', hoax.id)
    const ins = rows(s.instructions).filter((i) => i.refs.includes(key)).sort((a, b) => b.at - a.at)[0]
    const opds = ins ? ins.opdIds.map((o) => opdShort(s, o)).join(', ') : ''
    push('radar-isu', { id: `Hoaks viral: ${hoax.claim.id}`, en: `Viral hoax: ${hoax.claim.en}` },
      ins
        ? { id: `Klarifikasi diinstruksikan pukul ${hm(ins.at, 'id')} (${opds}), menunggu rilis`, en: `Clarification ordered at ${hm(ins.at, 'en')} (${opds}), awaiting release` }
        : { id: `Skor hoaks ${Math.round(hoax.score * 100)}%, belum diklarifikasi`, en: `Hoax score ${Math.round(hoax.score * 100)}%, not clarified yet` },
      [key])
  } else if (neg) {
    push('radar-isu', { id: `Isu negatif terbesar: ${topicLabel(neg.topic, 'id')} (${neg.count} mention)`, en: `Top negative issue: ${topicLabel(neg.topic, 'en')} (${neg.count} mentions)` }, { id: `Jangkauan ±${idNum(neg.reach)} akun dalam 24 jam`, en: `Reach ≈ ${enNum(neg.reach)} accounts in 24 h` }, [ref('mentions', neg.latest.id)])
  }
  // 5 · risky procurement (Awas Belanja)
  const procs = rows(s.procurements).filter((p) => p.status !== 'selesai')
  const risky = procs.filter((p) => p.flagged).sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))[0] ?? procs.find((p) => p.emergency) ?? procs.sort((a, b) => devPct(b) - devPct(a))[0]
  if (risky) {
    const d = Math.round(devPct(risky))
    push('awas-belanja', { id: `Paket berisiko: ${risky.name.id} (${rpShort(risky.hps).id})`, en: `Risky package: ${risky.name.en} (${rpShort(risky.hps).en})` },
      risky.flagged ? { id: `Skor risiko ${risky.riskScore}, ${risky.findings.filter((f) => f.level !== 'lolos').length} temuan`, en: `Risk score ${risky.riskScore}, ${risky.findings.filter((f) => f.level !== 'lolos').length} findings` } : { id: `HPS ${d}% di atas harga pasar, belum dianalisis`, en: `Owner's estimate (HPS) ${d}% above market price, not analysed yet` }, [ref('procurements', risky.id)])
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
    const u = s.region.commodities.find((x) => x.id === p.commodityId)?.unit || ''
    const unitOf: Bi = u ? { id: u, en: UNIT_EN[u] ?? u } : { id: 'satuan', en: 'unit' }
    const pct = Math.round(weekChangeOf(p.price, p.history) * 1000) / 10
    const fmtPct = (l: 'id' | 'en') => Math.abs(pct).toLocaleString(l === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 })
    push('sinyal-pasar', { id: `Harga ${c.id.toLowerCase()} di ${m} ${pct >= 0 ? 'naik' : 'turun'} ${fmtPct('id')}% sepekan`, en: `${c.en} at ${m} ${pct >= 0 ? 'up' : 'down'} ${fmtPct('en')}% in a week` },
      { id: `Rp ${idNum(p.price)} per ${unitOf.id}${p.anomaly ? ', ditandai anomali' : ''} (data simulasi)`, en: `Rp ${enNum(p.price)} per ${unitOf.en}${p.anomaly ? ', flagged as an anomaly' : ''} (simulated data)` }, [ref('prices', p.id)])
  }
  // 7 · overdue follow-ups (Naskah Pintar)
  const late = overdueActions(s, now)
  if (late.length) {
    // agencies by number of overdue items, most first, with the counts
    const per = new Map<string, number>()
    for (const a of late) per.set(a.opdId, (per.get(a.opdId) ?? 0) + 1)
    const opds = [...per.entries()].sort((a, b) => b[1] - a[1] || opdShort(s, a[0]).localeCompare(opdShort(s, b[0]))).slice(0, 3).map(([id, n]) => `${opdShort(s, id)} (${n})`).join(', ')
    push('naskah-pintar', { id: `${late.length} tindak lanjut rapat lewat tenggat`, en: `${late.length} meeting follow-ups overdue` }, { id: `Terbanyak di ${opds}`, en: `Mostly at ${opds}` }, late.slice(0, 5).map((a) => ref('actionItems', a.id)))
  }
  // 8 · bansos registration (Cek Berkas) when open
  const prog = rows(s.programs).find((p) => p.open)
  if (prog) {
    const docs = rows(s.documents).filter((d) => d.program === prog.kind)
    const checked = docs.filter((d) => d.status !== 'baru')
    const quota = { id: `Kuota ${idNum(prog.quota)} KK`, en: `Quota ${enNum(prog.quota)} households` }
    if (!checked.length) push('cek-berkas', { id: `Pendaftaran bansos banjir dibuka: ${docs.length} berkas masuk`, en: `Flood-aid registration open: ${docs.length} applications in` }, quota, [ref('programs', prog.id)])
    else {
      // the verification result (Cek Berkas), counted from the document statuses; NIK pairs and out-of-zone files are
      // named once the whole batch has been checked
      const n = (st: string) => checked.filter((d) => d.status === st).length
      const b = checked.length === docs.length ? bansosBatch(s) : null
      const parts: Bi[] = [
        b ? { id: `${checked.length} berkas diperiksa`, en: `${checked.length} files checked` } : { id: `${checked.length} dari ${docs.length} berkas diperiksa`, en: `${checked.length} of ${docs.length} files checked` },
        { id: `${n('lengkap')} lolos`, en: `${n('lengkap')} complete` },
      ]
      if (b?.summary.gandaPairs) parts.push({ id: `${b.summary.gandaPairs} pasang NIK ganda ditahan`, en: `${b.summary.gandaPairs} duplicate-ID pair${b.summary.gandaPairs === 1 ? '' : 's'} held` })
      if (b?.summary.luarZona) parts.push({ id: `${b.summary.luarZona} luar zona`, en: `${b.summary.luarZona} outside the zone` })
      if (!b && n('kurang')) parts.push({ id: `${n('kurang')} kurang`, en: `${n('kurang')} incomplete` })
      if (!b && n('cek-manual')) parts.push({ id: `${n('cek-manual')} perlu cek manual`, en: `${n('cek-manual')} need a manual check` })
      push('cek-berkas', { id: `Pendaftaran bansos banjir: ${parts.map((x) => x.id).join(' · ')}`, en: `Flood-aid registration: ${parts.map((x) => x.en).join(' · ')}` }, quota, [ref('programs', prog.id)])
    }
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
