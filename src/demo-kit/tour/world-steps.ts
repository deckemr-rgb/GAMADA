/**
 * tour/world-steps.ts (lazy chunk, loaded on "Mulai tur" / "Putar bab N"): everything of the tour that reads or
 * changes the world — the WorldKey table (day story + payload builders that stand in for a product click, idempotent
 * by key), `prepareThrough(n)`, the chapter facts (narration fills, focus ids, done predicates) and `tourSummary`.
 * Numbers come from the same selectors the products use (plan §0.1 "numbers agree across screens").
 */
import { clock, emit, ensureEcosystem, naturalBacklog, ref, rows, settled, world, type WorldState } from '../world'
import { alertRecipients, analyzeProcurement, bansosBatch, hpsVsMarket, rainScenario, zoneCitizens } from '../world/satu-daerah'
import { activeFloodAlert, bidPayload, floodBanner, poSuggestions, repliesPayload, brandAlertsAt, kybCase, CALL_CRITERIA, CRITERIA_KEYS, weakest } from '../world/usaha-pintar'
import { LENDERS, SCORE_BANDS, bandOf, loanOffer, opSimulate, orderPayload, catalogShortlist, raporOf } from '../world/pasar-daerah'
import { dataTrail, platformPulse } from '../world/inti'
import { playDayStory, sitiComplaint, storyDone, type StoryKey } from '../world/story'
import { CHAPTERS, chapterOf } from './chapters'
import type { AwaitKey, Fills, FocusKey, Lang, TourSummary, WorldKey } from './types'

const DAY0 = 6 * 60
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const nf = (n: number, lang: Lang) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 })
const rp = (n: number, lang: Lang) => (lang === 'id' ? 'Rp ' : 'IDR ') + Math.round(n).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')
const juta = (n: number, lang: Lang) => (lang === 'id' ? `Rp ${nf(n / 1e6, lang)} juta` : `IDR ${nf(n / 1e6, lang)} million`)
const today = (s: WorldState, type: string) => rows(s.auditLog).some((a) => a.type === type && a.at >= DAY0)
const kecName = (s: WorldState, id: string | undefined) => s.region.kecamatan.find((k) => k.id === id)?.name ?? ''
const opdShort = (s: WorldState, id: string) => s.region.opd.find((o) => o.id === id)?.short ?? id
const shop = (s: WorldState) => s.meta.shopId

/* ------------------------------------------------------------------ world readiness + clock */

/** the ecosystem modules the tour needs (UP + PD data, live handlers and chains) */
export async function ensureTourWorld(): Promise<void> {
  await Promise.all([ensureEcosystem('usaha-pintar'), ensureEcosystem('pasar-daerah')])
}

/** wait until the natural replay queue is empty and every event (and reaction) settled (K6 rule) */
export async function caughtUp(): Promise<void> {
  for (let i = 0; i < 400; i++) {
    await settled()
    if (naturalBacklog() === 0) {
      await sleep(4)
      await settled()
      if (naturalBacklog() === 0) return
    }
    await sleep(8)
  }
}

/** forward only (a world never goes back in time) */
export async function jumpTo(t: string): Promise<void> {
  const m = toMin(t)
  if (clock.get().minutes < m) clock.setTime(m)
  await caughtUp()
}

/* ------------------------------------------------------------------ entities */

const alertOf = (s: WorldState) => activeFloodAlert(s) ?? null
const pumpOf = (s: WorldState) => rows(s.procurements).find((p) => p.key === 'pompa-darurat') ?? null
const floodNeed = (s: WorldState) => {
  const a = alertOf(s)
  return (a && rows(s.catalogNeeds).find((n) => n.cause === ref('alerts', a.id))) || rows(s.catalogNeeds).find((n) => n.emergency && n.at >= DAY0) || null
}
const recNeed = (s: WorldState) => {
  const p = pumpOf(s)
  return p ? rows(s.catalogNeeds).find((n) => n.cause === ref('procurements', p.id)) ?? null : null
}
const emergencyTender = (s: WorldState) => rows(s.tenders).find((t) => t.key === 'karung-terpal-darurat') ?? null
const hoaxOf = (s: WorldState) => rows(s.hoaxAlerts).filter((h) => h.at >= DAY0).sort((a, b) => a.at - b.at)[0] ?? null
const heroBiz = (s: WorldState) => s.businesses.byId[s.meta.facts.up?.kenalMitra.heroBusinessId ?? ''] ?? null
const shopPoToday = (s: WorldState) => rows(s.purchaseOrders).filter((p) => p.businessId === shop(s) && p.status !== 'draf' && p.at >= DAY0).sort((a, b) => b.at - a.at)[0] ?? null
const brandAlertOf = (s: WorldState) => brandAlertsAt(s, clock.get().minutes).find((a) => a.businessId === shop(s)) ?? rows(s.brandAlerts).find((a) => a.businessId === shop(s)) ?? null
const loanToday = (s: WorldState) => rows(s.loanApps).find((l) => l.businessId === shop(s) && l.at >= DAY0) ?? null
const opOf = (s: WorldState) => rows(s.marketOps).filter((o) => o.at >= DAY0).sort((a, b) => b.at - a.at)[0] ?? null
const warningOf = (s: WorldState) => rows(s.priceWarnings).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null

export function focusOf(key: FocusKey | undefined, s: WorldState = world.get()): string | null {
  switch (key) {
    case 'alert': return alertOf(s)?.id ?? null
    case 'hoax': return hoaxOf(s)?.id ?? null
    case 'pump': return pumpOf(s)?.id ?? null
    case 'need': return floodNeed(s)?.id ?? null
    case 'kybRequest': return s.meta.facts.up?.kenalMitra.heroRequestId ?? null
    case 'tender': return emergencyTender(s)?.id ?? null
    case 'floodSku': return floodBanner(s)?.productIds[0] ?? null
    case 'po': return shopPoToday(s)?.id ?? null
    case 'warning': return warningOf(s)?.id ?? null
    case 'siti': return sitiComplaint(s)?.id ?? null
    case 'cluster': return sitiComplaint(s)?.clusterId ?? null
    case 'brandAlert': return brandAlertOf(s)?.id ?? null
    case 'econ': {
      const a = alertOf(s)
      const k = a?.kecamatanIds[0]
      const cell = rows(s.econIndex).filter((e) => e.kecamatanId === k).sort((x, y) => y.month.localeCompare(x.month))[0]
      return cell ? `${cell.kecamatanId}:${cell.month}` : null
    }
    default: return null
  }
}

/* ------------------------------------------------------------------ world keys */

const STORY: StoryKey[] = ['flood', 'siti', 'neighbours', 'instruction', 'recommend']
type KeyDef = { done: (s: WorldState) => boolean; run: (s: WorldState, now: number) => boolean }

const KEYS: Record<Exclude<WorldKey, StoryKey>, KeyDef> = {
  broadcast: {
    done: (s) => !!alertOf(s)?.broadcast,
    run: (s) => {
      const a = alertOf(s)
      if (!a) return false
      const r = alertRecipients(s, a.kecamatanIds, { desaIds: a.desaIds, pack: world.pack() })
      const c = zoneCitizens(s, a.kecamatanIds, a.desaIds)
      emit('alert.broadcast', { alertId: a.id, channels: ['wa', 'sms'], recipients: r.length + c.length, desaIds: a.desaIds }, 'siaga-wilayah')
      return true
    },
  },
  clarify: {
    done: (s) => !!hoaxOf(s)?.clarification,
    run: (s) => {
      const h = hoaxOf(s)
      if (!h) return false
      emit('clarification.published', { hoaxId: h.id, tone: 'informatif', channels: ['web', 'sosmed', 'wa'] }, 'radar-isu')
      return true
    },
  },
  analyse: {
    done: (s) => !!pumpOf(s)?.findings.length,
    run: (s) => {
      const p = pumpOf(s)
      if (!p) return false
      const r = analyzeProcurement(s, p.id)
      emit('procurement.flagged', { procurementId: p.id, riskScore: r.riskScore, findings: r.findings }, 'awas-belanja')
      return true
    },
  },
  order: {
    done: (s) => {
      const n = floodNeed(s)
      return !!n && rows(s.orders).some((o) => o.needId === n.id)
    },
    run: (s) => {
      const n = floodNeed(s)
      const top = n ? catalogShortlist(s, n.id).top[0] : undefined
      const p = n && top ? orderPayload(s, n.id, top.business.id) : null
      if (!p) return false
      emit('order.created', p, 'katalog-lokal')
      return true
    },
  },
  verify: {
    done: (s) => !!heroBiz(s)?.verified,
    run: (s) => {
      const b = heroBiz(s)
      if (!b) return false
      emit('partner.verified', { subjectKind: 'business', subjectId: b.id, kind: 'kyb', result: 'lolos', score: kybCase(s, b.id)?.score ?? 90 }, 'kenal-mitra')
      return true
    },
  },
  bid: {
    done: (s) => {
      const t = emergencyTender(s)
      return !!t && rows(s.bids).some((b) => b.tenderId === t.id && b.businessId === shop(s) && b.status !== 'draf')
    },
    run: (s) => {
      const t = emergencyTender(s)
      if (!t) return false
      const price = Math.round(((t.hps ?? t.value) * 0.94) / 1000) * 1000
      emit('bid.submitted', bidPayload(t.id, shop(s), price, ['ringkasan', 'harga', 'teknis', 'jadwal', 'legal']), 'tenderpilot')
      return true
    },
  },
  po: {
    done: (s) => !!shopPoToday(s),
    run: (s, now) => {
      const sg = poSuggestions(s, now)[0]
      if (!sg) return false
      emit('po.sent', { ...(sg.poId ? { id: sg.poId } : {}), ...(sg.code ? { code: sg.code } : {}), businessId: shop(s), supplierId: sg.supplierId, items: sg.items.map(({ productId, qty, cost }) => ({ productId, qty, cost })) }, 'toko-autopilot')
      return true
    },
  },
  coach: {
    done: (s) => today(s, 'coaching.assigned'),
    run: (s) => {
      const up = s.meta.facts.up
      const agent = up ? s.agentsSales.byId[up.newCashierAgentId] : undefined
      if (!up || !agent) return false
      const callId = up.lowCall['toko-bangunan'] ?? null
      const call = callId ? s.calls.byId[callId] : undefined
      const keys = call?.criteria ? weakest(call.criteria, 3) : CRITERIA_KEYS.slice(0, 3)
      emit('coaching.assigned', { agentId: agent.id, focus: keys.map((k) => CALL_CRITERIA[k]), examples: [], focusKeys: keys, callId, baseline: agent.baseline }, 'juara-jualan')
      return true
    },
  },
  minutes: {
    done: (s) => today(s, 'meeting.transcribed'),
    run: (s) => {
      const m = rows(s.meetings).filter((x) => x.at >= 0 && x.at < 24 * 60 && !x.transcribed).sort((a, b) => a.at - b.at)[0]
      if (!m) return false
      emit('meeting.transcribed', { meetingId: m.id, durationMin: m.durationMin }, 'naskah-pintar')
      return true
    },
  },
  bulk: {
    done: (s) => today(s, 'document.verified'),
    run: (s) => {
      const b = bansosBatch(s)
      const of = { lolos: 'lengkap', kurang: 'kurang', ganda: 'cek-manual', 'luar-zona': 'cek-manual' } as const
      for (const r of b.rows) emit('document.verified', { documentId: r.doc.id, status: of[r.result], ...(r.missing ? { notes: r.missing } : {}) }, 'cek-berkas')
      return b.rows.length > 0
    },
  },
  tax: {
    done: (s) => today(s, 'tax.ready'),
    run: (s) => {
      const items = rows(s.taxItems).filter((t) => t.businessId === shop(s)).sort((a, b) => b.period.localeCompare(a.period))
      const period = items[0]?.period
      if (!period) return false
      emit('tax.ready', { businessId: shop(s), period, taxItemIds: items.filter((t) => t.period === period).map((t) => t.id) }, 'pajak-beres')
      return true
    },
  },
  loan: {
    done: (s) => loanToday(s)?.status === 'disetujui',
    run: (s, now) => {
      const lender = LENDERS[0]
      const l = loanToday(s)
      if (!l) {
        const offer = loanOffer(s, shop(s), now)
        const c = emit('consent.granted', { businessId: shop(s), lender, scopes: ['omzet', 'laporan', 'pajak'], days: 30 }, 'rapor-usaha')
        emit('loan.applied', { businessId: shop(s), lender, amount: offer.plafon, tenorMonths: 12, consentId: c.payload.id, ratePct: offer.ratePct, installment: offer.installment(offer.plafon, 12) }, 'rapor-usaha')
        return true
      }
      if (l.status === 'diajukan') {
        emit('loan.approved', { loanId: l.id, amount: l.amount }, 'rapor-usaha')
        return true
      }
      return false
    },
  },
  brandReply: {
    done: (s) => rows(s.brandMentions).filter((m) => m.brand === shop(s) && m.reply && m.at >= DAY0).length >= 5,
    run: (s) => {
      const a = brandAlertOf(s)
      if (!a) return false
      const ids = a.mentionIds.filter((id) => !s.brandMentions.byId[id]?.reply).slice(0, 5)
      if (!ids.length) return false
      const replies = ids.map((id) => {
        const m = s.brandMentions.byId[id]
        const code = m?.orderCode ? ` ${m.orderCode}` : ''
        return { id: `Mohon maaf atas keterlambatan pesanan${code}. Kami kirim hari ini dan kabari Anda begitu tiba.`, en: `Sorry for the delay on order${code}. We are shipping today and will tell you once it arrives.` }
      })
      emit('brand.replied', repliesPayload(ids, 'empatik', replies, 'brand-manager', a.id), 'pantau-merek')
      return true
    },
  },
  op: {
    done: (s) => rows(s.marketOps).some((o) => o.stage === 'running' && (o.startedAt ?? o.at) >= DAY0),
    run: (s, now) => {
      const w = warningOf(s)
      if (!w) return false
      const cur = rows(s.marketOps).find((o) => o.commodityId === w.commodityId && o.at >= DAY0 && o.stage !== 'done' && o.stage !== 'dismissed')
      const sim = opSimulate(s, { commodityId: w.commodityId, marketIds: w.marketIds, volumeTon: 10, days: 3 }, now)
      if (!cur || cur.stage === 'recommended')
        emit('market.operation', { ...(cur ? { id: cur.id } : {}), stage: 'approved', commodityId: w.commodityId, marketIds: w.marketIds, volumeTon: 10, days: 3, effectPct: sim.effectPct, sentBy: 'disperindag', forRole: 'kepala-daerah' }, 'sinyal-pasar')
      const id = cur?.id ?? opOf(world.get())?.id
      emit('market.operation', { ...(id ? { id } : {}), stage: 'running', commodityId: w.commodityId, marketIds: w.marketIds }, 'sinyal-pasar')
      return true
    },
  },
}

const isStory = (k: WorldKey): k is StoryKey => (STORY as string[]).includes(k)

export function keyDone(k: WorldKey, s: WorldState = world.get()): boolean {
  if (isStory(k)) return storyDone(s, clock.get().minutes)[k]
  return KEYS[k].done(s)
}

/** run one world key if it has not happened yet; resolves once it (and its reactions) settled */
export async function runKey(k: WorldKey): Promise<boolean> {
  if (keyDone(k)) return true
  if (isStory(k)) {
    // source 'clock' (default): sandbox-identical numbering and toasts (CONTRACTS Tahap 5, kit note)
    await playDayStory({ gapMs: 0, until: k })
    await caughtUp()
    return keyDone(k)
  }
  for (let i = 0; i < 3 && !keyDone(k); i++) {
    const ok = KEYS[k].run(world.get(), clock.get().minutes)
    await caughtUp()
    if (!ok) break
  }
  return keyDone(k)
}

/** apply the world keys of chapters < n (gap 0, idempotent), jumping the clock through their times */
export async function prepareThrough(n: number): Promise<void> {
  for (const ch of CHAPTERS) {
    if (ch.n >= n) break
    await jumpTo(ch.time)
    for (const k of ch.world) await runKey(k)
  }
  const cur = chapterOf(n)
  if (cur) await jumpTo(cur.time)
}

/* ------------------------------------------------------------------ waits */

export function awaitOf(key: AwaitKey, s: WorldState = world.get()): boolean {
  if (key === 'reply') return !!shopPoToday(s)?.reply
  if (key === 'opRunning') return KEYS.op.done(s)
  return true
}

/* ------------------------------------------------------------------ facts per chapter */

export function chapterFacts(n: number, lang: Lang, s: WorldState = world.get()): Fills {
  const now = clock.get().minutes
  const f: Fills = { region: world.pack()?.shortName ?? s.region.name }
  const a = alertOf(s)
  const kec0 = a?.kecamatanIds[0] ?? s.region.floodKecamatanIds[0]
  f.kec = kecName(s, kec0)
  switch (n) {
    case 1: {
      const r = rainScenario(s)
      f.n = r.kecamatanIds.length
      f.kecs = r.kecamatanIds.map((k) => kecName(s, k)).join(', ')
      f.mm = r.peakMmH
      break
    }
    case 2: {
      if (!a) break
      const r = alertRecipients(s, a.kecamatanIds, { desaIds: a.desaIds, pack: world.pack() })
      f.camat = r.filter((x) => x.kind === 'camat').length
      f.k = r.filter((x) => x.kind !== 'camat').length
      f.w = nf(a.broadcast ? Math.max(0, a.broadcast.recipients - r.length) : zoneCitizens(s, a.kecamatanIds, a.desaIds).length, lang)
      f.r = nf(a.broadcast?.recipients ?? r.length + zoneCitizens(s, a.kecamatanIds, a.desaIds).length, lang)
      break
    }
    case 3: {
      const b = rows(s.briefings).filter((x) => x.at >= DAY0).sort((x, y) => y.at - x.at)[0]
      f.items = b?.items.length ?? 0
      f.products = b ? new Set(b.items.map((i) => i.source)).size : 0
      break
    }
    case 4: {
      const c = sitiComplaint(s, now)
      const cl = c?.clusterId ? s.clusters.byId[c.clusterId] : undefined
      f.code = c?.code ?? '—'
      f.k = cl?.complaintIds.length ?? 0
      f.desa = s.region.kecamatan.find((k) => k.id === c?.kecamatanId)?.desa.find((d) => d.id === c?.desaId)?.name ?? ''
      break
    }
    case 5: {
      const c = sitiComplaint(s, now)
      const ins = rows(s.instructions).find((i) => c?.clusterId && i.refs.includes(ref('clusters', c.clusterId)))
      f.opd1 = ins ? opdShort(s, ins.opdIds[0] ?? '') : ''
      f.opd2 = ins ? opdShort(s, ins.opdIds[1] ?? ins.opdIds[0] ?? '') : ''
      const m = rows(s.meetings).filter((x) => x.transcribed && x.at >= 0).sort((x, y) => y.at - x.at)[0]
      f.tasks = m?.actionItemIds.length ?? 6
      break
    }
    case 6: {
      const h = hoaxOf(s)
      f.m = h?.clarification ? Math.max(1, h.clarification.at - h.at) : 0
      f.posts = rows(s.mentions).filter((x) => x.rumor && x.at >= DAY0).length
      break
    }
    case 7: {
      const p = pumpOf(s)
      if (!p) break
      const d = hpsVsMarket(s, p.id)
      f.gap = nf(Math.round(d.devPct * 10) / 10, lang)
      f.overpay = juta(d.overpay, lang)
      f.aff = analyzeProcurement(s, p.id).findings.some((x) => x.detector === 'afiliasi') ? s.meta.facts.pumpRingBidderIds.length : 0
      break
    }
    case 8: {
      const nd = floodNeed(s)
      f.bags = nf(nd?.items[0]?.qty ?? 0, lang)
      f.tarps = nf(nd?.items[1]?.qty ?? 0, lang)
      f.matches = nd ? rows(s.matches).filter((m) => m.needId === nd.id).length : 0
      const o = nd ? rows(s.orders).find((x) => x.needId === nd.id) : undefined
      f.biz = o ? s.businesses.byId[o.businessId]?.name ?? '' : nd ? catalogShortlist(s, nd.id).top[0]?.business.name ?? '' : ''
      break
    }
    case 9: {
      const b = heroBiz(s)
      f.owner = b?.ownerName ?? ''
      f.biz = b?.name ?? ''
      f.verified = rows(s.businesses).filter((x) => x.verified).length
      break
    }
    case 10: {
      const t = emergencyTender(s)
      f.p = t ? Math.round((t.matches[shop(s)] ?? 0) * 100) : 0
      f.hps = t ? rp(t.hps ?? t.value, lang) : ''
      break
    }
    case 11: {
      const fb = floodBanner(s)
      f.x = fb?.pct ?? 0
      const pid = fb?.productIds[0]
      f.item = pid ? s.products.byId[pid]?.name ?? '' : ''
      const po = shopPoToday(s)
      f.po = po?.code ?? ''
      f.supplier = po ? s.suppliers.byId[po.supplierId]?.name ?? '' : ''
      break
    }
    case 12: {
      const c = rows(s.coachings).filter((x) => x.at >= DAY0).sort((x, y) => y.at - x.at)[0]
      f.agent = c ? s.agentsSales.byId[c.agentId]?.name ?? '' : ''
      break
    }
    case 13: {
      const po = shopPoToday(s)
      f.po = po?.code ?? ''
      break
    }
    case 14: {
      const r = raporOf(s, shop(s))
      f.score = r?.score ?? 0
      f.band = r ? SCORE_BANDS[bandOf(r.score)]?.label[lang] ?? '' : ''
      const l = loanToday(s)
      f.plafon = juta(l?.amount ?? loanOffer(s, shop(s), now).plafon, lang)
      f.lender = LENDERS[0]
      break
    }
    case 15: {
      const ba = brandAlertOf(s)
      f.x = ba ? Math.round(ba.deltaPct) : 0
      f.n = 5
      break
    }
    case 16: {
      const b = bansosBatch(s)
      f.n = b.summary.total
      f.d = b.summary.gandaPairs
      break
    }
    case 17: {
      const w = warningOf(s)
      const com = s.region.commodities.find((c) => c.id === w?.commodityId)
      f.komoditas = com ? com.name[lang].toLowerCase() : ''
      f.pasar = w ? (s.markets.byId[w.marketIds[0] ?? '']?.name ?? '') : ''
      f.days = w?.peakInDays ?? 0
      f.y = w ? nf(Math.abs(opSimulate(s, { commodityId: w.commodityId, marketIds: w.marketIds, volumeTon: 10, days: 3 }, now).damp) * 100, lang) : 0
      break
    }
    case 18: {
      const cell = rows(s.econIndex).filter((e) => e.kecamatanId === kec0).flatMap((e) => e.events ?? [])
      const flood = cell.filter((e) => e.kind === 'banjir').sort((x, y) => y.at - x.at)[0]
      const prog = rows(s.econIndex).flatMap((e) => e.events ?? []).filter((e) => e.kind === 'program').sort((x, y) => y.at - x.at)[0]
      f.d = flood ? nf(Math.abs(flood.delta), lang) : 0
      f.p = prog ? nf(Math.abs(prog.delta), lang) : 0
      break
    }
    case 19: {
      const c = sitiComplaint(s, now)
      const t = c ? dataTrail(s, ref('complaints', c.id)) : null
      f.lanes = t ? t.spine.filter((x) => !!x.auditId).length : 0
      f.events = nf(platformPulse(s, now).todayCount, lang)
      break
    }
  }
  return f
}

/* ------------------------------------------------------------------ done predicates (plan §2 "done") */

export function chapterDone(n: number, s: WorldState = world.get()): boolean {
  const now = clock.get().minutes
  switch (n) {
    case 1: return rainScenario(s).kecamatanIds.length >= 1
    case 2: return !!alertOf(s)?.broadcast
    case 3: return rows(s.briefings).some((b) => b.at >= DAY0)
    case 4: {
      const c = sitiComplaint(s, now)
      const cl = c?.clusterId ? s.clusters.byId[c.clusterId] : undefined
      return !!c && (cl?.complaintIds.length ?? 0) >= 5
    }
    case 5: return storyDone(s, now).instruction && KEYS.minutes.done(s)
    case 6: return KEYS.clarify.done(s)
    case 7: return !!pumpOf(s)?.flagged && !!recNeed(s)
    case 8: {
      const nd = floodNeed(s)
      return !!nd && rows(s.matches).filter((m) => m.needId === nd.id).length >= 3 && KEYS.order.done(s)
    }
    case 9: return KEYS.verify.done(s)
    case 10: return KEYS.bid.done(s)
    case 11: return !!shopPoToday(s)?.reply
    case 12: return KEYS.coach.done(s)
    case 13: return KEYS.tax.done(s)
    case 14: return KEYS.loan.done(s)
    case 15: return KEYS.brandReply.done(s)
    case 16: return KEYS.bulk.done(s)
    case 17: return KEYS.op.done(s)
    case 18: {
      const ev = rows(s.econIndex).flatMap((e) => e.events ?? [])
      return ev.some((e) => e.kind === 'banjir' && e.at >= DAY0) && ev.some((e) => e.kind === 'program' && e.at >= DAY0)
    }
    case 19: {
      const c = sitiComplaint(s, now)
      return !!c && !!dataTrail(s, ref('complaints', c.id)).complete
    }
    case 20: {
      const t = tourSummary(s, [])
      return t.complaintsHandled > 0 && t.warningsSent > 0 && t.hoaxesCountered > 0 && t.savingsRp > 0 && t.umkmOrders > 0 && t.pricesStabilised > 0
    }
    default: return false
  }
}

/* ------------------------------------------------------------------ summary (plan §1.2 tourSummary) */

export function tourSummary(s: WorldState, seen: readonly string[]): TourSummary {
  const now = clock.get().minutes
  // complaints handled today: in a cluster (grouped + routed) or with a ticket past "baru"
  const complaintsHandled = rows(s.complaints).filter((c) => c.at >= DAY0 && (c.clusterId || (s.tickets.byId[c.ticketId]?.status ?? 'baru') !== 'baru')).length
  const warningsSent = rows(s.alerts).filter((a) => a.broadcast && a.broadcast.at >= DAY0).reduce((n, a) => n + (a.broadcast?.recipients ?? 0), 0)
  const hoaxesCountered = rows(s.hoaxAlerts).filter((h) => h.clarification && h.clarification.at >= DAY0).length
  const savingsRp = rows(s.procurements).filter((p) => p.flagged && p.findings.some((f) => f.detector === 'hps-kemahalan')).reduce((n, p) => n + Math.max(0, hpsVsMarket(s, p.id).overpay), 0)
  const umkmOrders = rows(s.orders).filter((o) => o.at >= DAY0).length + rows(s.bids).filter((b) => b.at >= DAY0 && b.status !== 'draf').length
  const pricesStabilised = new Set(rows(s.priceShocks).filter((x) => x.damp > 0).map((x) => x.commodityId)).size
  return { complaintsHandled, warningsSent, hoaxesCountered, savingsRp, umkmOrders, pricesStabilised, productsSeen: seen.length, events: platformPulse(s, now).todayCount }
}

export { STORY, rp, juta }
