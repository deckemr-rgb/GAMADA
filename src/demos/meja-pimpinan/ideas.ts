/**
 * demos/meja-pimpinan/ideas.ts — what loads only after a user action: the "Beri instruksi" suggestions (instruction
 * dialog) and the AI context of "Tanya data" (chat). Kept out of data.ts so the first screen does not carry them.
 */
import type { ProductSlug } from '../../content/products'
import type { Lang } from '../../lib/i18n'
import { CATEGORY_LABEL, DAY_MIN, overdueActions, rows, ref, type Bi, type EntityRef, type Minutes, type WorldState } from '../../demo-kit/world'
import { complaintsByKecamatan, instructionIdeas, kpiStrip, opdLeaderboard } from '../../demo-kit/world/satu-daerah'
import { MP, desaName, findOpd, kecName, mpBriefingItems, opdShort, refId, riskiestProcurement, topRiser } from './data'

/* ------------------------------------------------------------------ "Beri instruksi" ideas */

export interface Idea {
  id: string
  text: Bi
  opdIds: string[]
  refs: EntityRef[]
  /** accepted market-operation suggestion ⇒ instruction origin */
  origin?: EntityRef
  /** product the idea comes from */
  source: ProductSlug
}

/** AI suggestions for "Beri instruksi" (spec P2 step 5): the kit's instructionIdeas + what today's briefing shows. */
export function leaderIdeas(s: WorldState, now: Minutes): Idea[] {
  const out: Idea[] = []
  const add = (i: Omit<Idea, 'id'>) => {
    if (!i.opdIds.length || out.some((o) => o.text.id === i.text.id)) return
    out.push({ ...i, id: `idea-${out.length + 1}` })
  }
  for (const k of instructionIdeas(s, now)) {
    const r0 = k.refs[0] ?? ''
    const src: ProductSlug = r0.startsWith('clusters') ? 'sapa-warga' : r0.startsWith('hoaxAlerts') ? 'radar-isu' : r0.startsWith('marketOps') ? 'sinyal-pasar' : 'naskah-pintar'
    add({ ...k, source: src, ...(r0.startsWith('marketOps:') ? { origin: r0 } : {}) })
  }
  const bpbd = findOpd(s, 'bpbd')
  const pupr = findOpd(s, 'pupr')
  // flood reports without a cluster yet: pumps + drainage check at the desa with most reports
  const dayStart = Math.floor(now / DAY_MIN) * DAY_MIN
  const flood = rows(s.complaints).filter((c) => c.category === 'banjir' && c.at >= dayStart - DAY_MIN / 2 && c.at <= now)
  if (flood.length && bpbd && !rows(s.clusters).length) {
    const by = new Map<string, typeof flood>()
    for (const c of flood) by.set(`${c.kecamatanId}|${c.desaId}`, [...(by.get(`${c.kecamatanId}|${c.desaId}`) ?? []), c])
    const [key, list] = [...by.entries()].sort((a, b) => b[1].length - a[1].length)[0]!
    const [kec = '', desa = ''] = key.split('|')
    add({
      text: { id: `Kerahkan pompa portabel dan cek drainase di Desa ${desaName(s, kec, desa)}, Kec. ${kecName(s, kec)}, laporkan tiap 2 jam`, en: `Deploy portable pumps and check drainage in ${desaName(s, kec, desa)} village, ${kecName(s, kec)}; report every 2 hours` },
      opdIds: [bpbd, ...(pupr ? [pupr] : [])], refs: list.slice(0, 5).map((c) => ref('complaints', c.id)), source: 'sapa-warga',
    })
  }
  // river gauge close to the alert level
  const river = rows(s.gauges).find((g) => g.kind === 'sungai')
  if (river && bpbd && river.level >= river.normal + (river.siaga - river.normal) * 0.6)
    add({ text: { id: `Siagakan posko banjir dan pantau muka air ${river.name} tiap jam`, en: `Put flood posts on standby and monitor the ${river.name} water level hourly` }, opdIds: [bpbd], refs: [ref('gauges', river.id)], source: 'siaga-wilayah' })
  // risky procurement not analysed yet
  const insp = findOpd(s, 'inspektorat')
  const proc = riskiestProcurement(s)
  if (proc && insp)
    add({ text: { id: `Reviu HPS paket "${proc.name.id}" sebelum kontrak ditandatangani`, en: `Review the cost estimate of "${proc.name.en}" before the contract is signed` }, opdIds: [insp, ...(findOpd(s, 'ukpbj') ? [findOpd(s, 'ukpbj')!] : [])], refs: [ref('procurements', proc.id)], source: 'awas-belanja' })
  // biggest weekly price rise
  const dag = findOpd(s, 'disperindag')
  const rise = topRiser(s)
  if (rise && dag && rise.d > 0.05) {
    const c = s.region.commodities.find((x) => x.id === rise.p.commodityId)?.name ?? { id: rise.p.commodityId, en: rise.p.commodityId }
    const m = s.markets.byId[rise.p.marketId]?.name ?? rise.p.marketId
    add({ text: { id: `Pantau pasokan ${c.id.toLowerCase()} di ${m} dan siapkan opsi operasi pasar`, en: `Monitor ${c.en.toLowerCase()} supply at ${m} and prepare a market-operation option` }, opdIds: [dag], refs: [ref('prices', rise.p.id)], source: 'sinyal-pasar' })
  }
  // follow-ups overdue at several OPDs
  const late = overdueActions(s, now)
  if (late.length >= 2) {
    const sek = findOpd(s, 'bappeda')
    const opds = [...new Set(late.map((a) => a.opdId))].slice(0, 4)
    if (sek || opds.length) add({ text: { id: `Tuntaskan ${late.length} tindak lanjut rapat yang lewat tenggat paling lambat besok`, en: `Close the ${late.length} overdue meeting follow-ups by tomorrow` }, opdIds: opds, refs: late.slice(0, 5).map((a) => ref('actionItems', a.id)), source: 'naskah-pintar' })
  }
  // most urgent first: field situation, then risk and money, then paperwork
  const order: ProductSlug[] = ['sapa-warga', 'siaga-wilayah', 'radar-isu', 'sinyal-pasar', 'awas-belanja', 'naskah-pintar']
  return out.sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source)).slice(0, MP.ideas)
}


/** OPD that usually acts on an item of this source */
const SOURCE_OPD: Partial<Record<ProductSlug, string>> = { 'siaga-wilayah': 'bpbd', 'radar-isu': 'kominfo', 'awas-belanja': 'inspektorat', 'sinyal-pasar': 'disperindag', 'cek-berkas': 'dinsos' }

/** "Instruksikan" on a briefing item: the matching AI suggestion, else a follow-up for the agency that owns it */
export function presetFor(s: WorldState, now: Minutes, it: { title: Bi; source: ProductSlug; refs: EntityRef[] }): { text: Bi; opdIds: string[]; refs: EntityRef[]; origin?: EntityRef } {
  const idea = leaderIdeas(s, now).find((i) => i.refs.some((r) => it.refs.includes(r)))
  if (idea) return { text: idea.text, opdIds: idea.opdIds, refs: idea.refs, ...(idea.origin ? { origin: idea.origin } : {}) }
  let opd: string | undefined
  const r0 = it.refs[0] ?? ''
  if (r0.startsWith('complaints:')) {
    const c = s.complaints.byId[refId(r0) ?? '']
    opd = c ? (s.tickets.byId[c.ticketId]?.opdId ?? s.region.categoryOpd[c.category]) : undefined
  } else if (r0.startsWith('actionItems:')) opd = s.actionItems.byId[refId(r0) ?? '']?.opdId
  else if (SOURCE_OPD[it.source]) opd = findOpd(s, SOURCE_OPD[it.source]!)
  return { text: { id: `Tindak lanjuti: ${it.title.id}`, en: `Follow up: ${it.title.en}` }, opdIds: opd ? [opd] : [], refs: it.refs }
}

/* ------------------------------------------------------------------ live AI context (≤ 6 KB, spec §9.3) */

/**
 * The context for "Tanya data". Live mode sends a JSON summary of it (summarize() ≤ 6 KB); the simulation reads the
 * full world through the non-enumerable `state` property (never serialised).
 */
export interface AskContext {
  region: string
  leader: string
  time: string
  lang: Lang
  kpi: ReturnType<typeof kpiStrip>
  briefing: { source: string; title: string }[]
  complaintsByKecamatan7d: { kecamatan: string; count: number; prev: number }[]
  topCategories7d: { category: string; count: number; prev: number }[]
  opd: { opd: string; score: number; slaPct: number | null; open: number; late: number }[]
  overdue: { title: string; opd: string; dueDaysAgo: number }[]
  alerts: { level: number; kecamatan: string[] }[]
  instructionsToday: string[]
  state?: WorldState
  now?: Minutes
}

export function askContext(s: WorldState, now: Minutes, lang: Lang, leader: string): AskContext {
  const cats = new Map<string, { count: number; prev: number }>()
  for (const c of rows(s.complaints)) {
    const r = cats.get(c.category) ?? { count: 0, prev: 0 }
    if (c.at > now - 7 * DAY_MIN && c.at <= now) r.count++
    else if (c.at > now - 14 * DAY_MIN && c.at <= now - 7 * DAY_MIN) r.prev++
    cats.set(c.category, r)
  }
  const ctx: AskContext = {
    region: s.region.name,
    leader,
    time: `${String(Math.floor(now / 60)).padStart(2, '0')}:${String(now % 60).padStart(2, '0')}`,
    lang,
    kpi: kpiStrip(s, now),
    briefing: mpBriefingItems(s, now).map((b) => ({ source: b.source, title: b.title[lang] })),
    complaintsByKecamatan7d: complaintsByKecamatan(s, now, 7).slice(0, 10).map((k) => ({ kecamatan: k.name, count: k.count, prev: k.prev })),
    topCategories7d: [...cats.entries()].map(([k, v]) => ({ category: CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL]?.[lang] ?? k, ...v })).sort((a, b) => b.count - a.count).slice(0, 6),
    opd: opdLeaderboard(s, now).map((o) => ({ opd: o.short, score: o.score, slaPct: o.slaPct, open: o.openTickets, late: o.actionsLate })),
    overdue: overdueActions(s, now).slice(0, 6).map((a) => ({ title: a.title[lang], opd: opdShort(s, a.opdId), dueDaysAgo: Math.round((now - a.dueAt) / DAY_MIN) })),
    alerts: rows(s.alerts).filter((a) => a.status === 'aktif').map((a) => ({ level: a.level, kecamatan: a.kecamatanIds.map((k) => kecName(s, k)) })),
    instructionsToday: rows(s.instructions).filter((i) => i.at >= 0).map((i) => i.text[lang]).slice(0, 5),
  }
  Object.defineProperty(ctx, 'state', { value: s, enumerable: false })
  Object.defineProperty(ctx, 'now', { value: now, enumerable: false })
  return ctx
}
