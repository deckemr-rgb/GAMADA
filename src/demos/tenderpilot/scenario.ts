/**
 * demos/tenderpilot/scenario.ts — AI simulation (spec §9.2), registered by the lazy AI surface (ai.tsx), never by the
 * page. Intents: ringkas-tender (→ tenderpilot/tender-summary), jelaskan-skor (→ win-score), saran-harga (→ win-score
 * priceRange), cek-syarat, susun-bagian:<section> (→ tenderpilot/bid-section, the same text as the Dokumen tab),
 * pertanyaan-klarifikasi (pump mirror only), fallback. Every number comes from the context (world selectors).
 */
import type { Lang, Scenario, SimContext, SimResponse } from '../../demo-kit/ai/types'
import { registerScenario, registerStructuredSchema } from '../../demo-kit/ai/chat'
import { world, type Bi, type WorldState } from '../../demo-kit/world'
import { bidHistory, requirementsFor, vendorProfile, winScore } from '../../demo-kit/world/usaha-pintar'
import { SECTIONS, getDraft, type SectionId } from './draft'
import { bidOf, countdown, deadlineText, rp } from './model'
import { SECTION_TITLE, docCtx, sectionText } from './sections'

/** the context sent with each turn (≤ 6 KB): tender, requirements, price advice, profile, history */
export interface TpContext {
  tenderId: string | null
  tender: { code: string; title: string; opd: string; kecamatan: string; hps: number; deadline: string; dueIn: string; method: string; competitors: number; mirror: boolean; risk: number | null; spec: string | null; items: { name: string; qty: number; unit: string; hpsPrice: number }[] } | null
  probability: number | null
  factors: { key: string; impact: string; note: string }[]
  requirements: { key: string; label: string; ok: boolean; detail: string }[]
  priceAdvice: { hps: number; cost: number | null; low: number; high: number; suggested: number; bid: number } | null
  profile: { name: string; kbli: string; years: number; staff: number; verified: boolean; taxTidy: boolean } | null
  history: { bids: number; winRate: number; valueWon: number }
}

export function aiContext(s: WorldState, tenderId: string | null, lang: Lang, now: number): TpContext {
  const shop = s.meta.shopId
  const t = tenderId ? s.tenders.byId[tenderId] : undefined
  const prof = vendorProfile(s, shop)
  const h = bidHistory(s, shop)
  const ws = t ? winScore(s, t.id, shop) : null
  const bid = t ? bidOf(s, t.id, getDraft(t.id)) : null
  const proc = t?.procurementId ? s.procurements.byId[t.procurementId] : undefined
  return {
    tenderId: t?.id ?? null,
    tender: t
      ? {
          code: t.code, title: t.title[lang], opd: s.region.opd.find((o) => o.id === t.opdId)?.name ?? t.opdId, kecamatan: s.region.kecamatan.find((k) => k.id === t.kecamatanId)?.name ?? t.kecamatanId,
          hps: t.hps ?? t.value, deadline: deadlineText(s.day, t.deadlineAt, lang), dueIn: countdown(t.deadlineAt - now, lang), method: t.method, competitors: t.competitors, mirror: !!t.procurementId,
          risk: t.risk?.score ?? (proc?.riskScore != null && proc.riskScore >= 60 ? proc.riskScore : null), spec: t.spec?.[lang] ?? null,
          items: (t.items ?? []).map((i) => ({ name: i.name[lang], qty: i.qty, unit: i.unit, hpsPrice: i.hpsPrice })),
        }
      : null,
    probability: t ? Math.round((t.matches[shop] ?? ws?.probability ?? 0) * 100) : null,
    factors: (ws?.factors ?? []).map((f) => ({ key: f.key, impact: f.impact, note: f.note[lang] })),
    requirements: t ? requirementsFor(s, t.id, shop).map((r) => ({ key: r.key, label: r.label[lang], ok: r.ok, detail: (r.warn ?? r.detail)[lang] })) : [],
    priceAdvice: bid?.advice ? { hps: bid.advice.hps, cost: bid.advice.cost, low: bid.advice.range[0], high: bid.advice.range[1], suggested: bid.advice.suggested, bid: bid.total } : null,
    profile: prof ? { name: prof.name, kbli: prof.kbli.map((k) => k.code).join(', '), years: prof.years, staff: prof.staffCount, verified: prof.verified, taxTidy: prof.taxTidy } : null,
    history: { bids: h.rows.length, winRate: Math.round(h.winRate * 100), valueWon: h.valueWon },
  }
}

type Ctx = SimContext<TpContext>
const T = (lang: Lang, id: string, en: string) => (lang === 'id' ? id : en)
const FACTOR: Record<string, Bi> = { kbli: { id: 'Kesesuaian KBLI', en: 'KBLI match' }, pengalaman: { id: 'Pengalaman', en: 'Experience' }, jarak: { id: 'Jarak', en: 'Distance' }, harga: { id: 'Harga pokok', en: 'Cost price' }, pesaing: { id: 'Pesaing', en: 'Competitors' } }
const chips = (lang: Lang, ...k: ('sum' | 'why' | 'price' | 'req' | 'surat')[]) =>
  k.map((x) => ({ sum: T(lang, 'Ringkas tender ini', 'Summarise this tender'), why: T(lang, 'Kenapa peluangnya segini?', 'Why is the chance this high?'), price: T(lang, 'Berapa harga yang pas?', 'What price should I bid?'), req: T(lang, 'Syarat apa yang kurang?', 'Which requirement is missing?'), surat: T(lang, 'Susun bagian surat penawaran', 'Draft the bid letter section') })[x])

const noTender = (ctx: Ctx): SimResponse => ({
  text: T(ctx.lang, 'Belum ada tender yang dibuka. Pilih satu dari umpan (misalnya tender darurat karung pasir & terpal), lalu tanyakan lagi: saya menjawab dengan angka tender itu.', 'No tender is open yet. Pick one from the feed (the emergency sandbag & tarp tender, for example) and ask again: I will answer with that tender’s numbers.'),
  followUps: [],
})

function summary(ctx: Ctx): SimResponse {
  const w = ctx.world
  if (!w.tender) return noTender(ctx)
  const L = ctx.lang
  const miss = w.requirements.filter((r) => !r.ok)
  const key = w.requirements.slice(0, 5).map((r) => `${r.label}${r.ok ? '' : T(L, ' (belum)', ' (missing)')}`)
  const risks = [
    ...(w.tender.risk !== null ? [T(L, `Awas Belanja menandai paket ini dengan skor risiko ${w.tender.risk}.`, `Awas Belanja flagged this package with risk score ${w.tender.risk}.`)] : []),
    ...(w.tender.mirror ? [T(L, 'Spesifikasi mengunci satu merek dan sebagian peserta terafiliasi.', 'The spec locks one brand and some bidders are affiliated.')] : []),
    ...miss.slice(0, 2).map((r) => T(L, `${r.label}: ${r.detail}`, `${r.label}: ${r.detail}`)),
    ...(w.tender.method === 'darurat' ? [T(L, `Tenggat singkat, ${w.tender.dueIn} lagi.`, `Short deadline, ${w.tender.dueIn} left.`)] : []),
  ].slice(0, 3)
  const items = w.tender.items.map((i) => `${i.qty.toLocaleString('id-ID')} ${i.unit} ${i.name}`).join(T(L, ' dan ', ' and '))
  const text = T(
    L,
    `${w.tender.code} · ${w.tender.title} dari ${w.tender.opd}, lokasi Kec. ${w.tender.kecamatan}. Nilai HPS ${rp(w.tender.hps)} (simulasi)${items ? ` untuk ${items}` : ''}. Peluang menang ${w.probability}% dengan ${w.tender.competitors} pesaing. Syarat lengkap ${w.requirements.length - miss.length} dari ${w.requirements.length}${miss.length ? `; yang kurang: ${miss.map((r) => r.label).join(', ')}` : ''}. Tenggat ${w.tender.deadline}.`,
    `${w.tender.code} · ${w.tender.title} from ${w.tender.opd}, in ${w.tender.kecamatan} district. HPS ${rp(w.tender.hps)} (simulated)${items ? ` for ${items}` : ''}. Win chance ${w.probability}% against ${w.tender.competitors} competitors. ${w.requirements.length - miss.length} of ${w.requirements.length} requirements complete${miss.length ? `; missing: ${miss.map((r) => r.label).join(', ')}` : ''}. Deadline ${w.tender.deadline}.`,
  )
  return {
    text,
    structured: { kind: 'tenderpilot/tender-summary', data: { summary: text, keyRequirements: key, risks, deadline: w.tender.deadline } },
    followUps: chips(L, 'why', 'price', 'req'),
  }
}

function winStructured(w: TpContext, lang: Lang, withRange: boolean) {
  return {
    kind: 'win-score',
    data: {
      probability: w.probability ?? 0,
      factors: w.factors.map((f) => ({ name: FACTOR[f.key]?.[lang] ?? f.key, impact: f.impact, note: f.note })),
      ...(withRange && w.priceAdvice ? { priceRange: { low: w.priceAdvice.low, high: w.priceAdvice.high } } : {}),
    },
  }
}

function why(ctx: Ctx): SimResponse {
  const w = ctx.world
  if (!w.tender) return noTender(ctx)
  const L = ctx.lang
  const up = w.factors.filter((f) => f.impact === 'naik').map((f) => `${FACTOR[f.key]?.[L] ?? f.key} (${f.note})`)
  const down = w.factors.filter((f) => f.impact === 'turun').map((f) => `${FACTOR[f.key]?.[L] ?? f.key} (${f.note})`)
  return {
    text: T(
      L,
      `Peluang ${w.probability}% untuk ${w.tender.code} dihitung dari lima faktor model simulasi. Yang menaikkan: ${up.join('; ') || 'tidak ada yang menonjol'}. Yang menurunkan: ${down.join('; ') || 'tidak ada'}.`,
      `The ${w.probability}% chance for ${w.tender.code} comes from five factors of the simulated model. Raising it: ${up.join('; ') || 'nothing stands out'}. Lowering it: ${down.join('; ') || 'nothing'}.`,
    ),
    structured: winStructured(w, L, false),
    toolCalls: [{ name: 'estimate_win', input: { tender: w.tender.code } }],
    followUps: chips(L, 'price', 'req'),
  }
}

function price(ctx: Ctx): SimResponse {
  const w = ctx.world
  if (!w.tender || !w.priceAdvice) return noTender(ctx)
  const L = ctx.lang
  const a = w.priceAdvice
  return {
    text: T(
      L,
      `Untuk ${w.tender.code}, rentang wajar dari riwayat penawaran toko adalah ${rp(a.low)} sampai ${rp(a.high)} (HPS ${rp(a.hps)}). Saran saya ${rp(a.suggested)}${a.cost !== null ? `, di atas harga pokok toko ${rp(a.cost)}` : ''}. Harga di dokumen saat ini ${rp(a.bid)}. Angka simulasi; jangan menawar di bawah harga pokok.`,
      `For ${w.tender.code}, the fair range from the shop’s past bids is ${rp(a.low)} to ${rp(a.high)} (HPS ${rp(a.hps)}). I suggest ${rp(a.suggested)}${a.cost !== null ? `, above the shop’s cost price of ${rp(a.cost)}` : ''}. The document now carries ${rp(a.bid)}. Simulated figures; never bid below cost.`,
    ),
    structured: winStructured(w, L, true),
    toolCalls: [{ name: 'estimate_win', input: { tender: w.tender.code, priceRange: true } }],
    followUps: chips(L, 'why', 'surat'),
  }
}

function reqs(ctx: Ctx): SimResponse {
  const w = ctx.world
  if (!w.tender) return noTender(ctx)
  const L = ctx.lang
  const miss = w.requirements.filter((r) => !r.ok)
  return {
    text: miss.length
      ? T(L, `${w.requirements.length - miss.length} dari ${w.requirements.length} syarat ${w.tender.code} sudah lengkap. Yang kurang: ${miss.map((r) => `${r.label} (${r.detail})`).join('; ')}.`, `${w.requirements.length - miss.length} of ${w.requirements.length} requirements of ${w.tender.code} are complete. Missing: ${miss.map((r) => `${r.label} (${r.detail})`).join('; ')}.`)
      : T(L, `Ketujuh syarat ${w.tender.code} sudah lengkap: dokumen bisa disusun dan dikirim.`, `All requirements of ${w.tender.code} are complete: the document can be built and sent.`),
    followUps: chips(L, 'surat', 'price'),
  }
}

const SECTION_WORDS: [RegExp, SectionId][] = [
  [/surat|letter/i, 'surat'],
  [/harga|kuantitas|price|quantit/i, 'harga'],
  [/spesifikasi|contoh|spec|sample/i, 'spek'],
  [/jadwal|kirim|pengiriman|schedule|deliver/i, 'jadwal'],
  [/pengalaman|experience/i, 'pengalaman'],
  [/pakta|pernyataan|integrit|pact|declar/i, 'pakta'],
  [/lampiran|legal|nib|npwp|annex/i, 'lampiran'],
]
function section(ctx: Ctx): SimResponse {
  const w = ctx.world
  if (!w.tenderId) return noTender(ctx)
  const L = ctx.lang
  const id = SECTION_WORDS.find(([re]) => re.test(ctx.text))?.[1] ?? 'surat'
  const s = world.get()
  const d = getDraft(w.tenderId)
  const bid = bidOf(s, w.tenderId, d)
  const c = bid ? docCtx(s, w.tenderId, bid.target, d.units) : null
  if (!c) return noTender(ctx)
  const text = sectionText(id, c, L, true)
  const pages = SECTIONS.find((x) => x.id === id)?.pages ?? 1
  return {
    text: T(L, `Draf bagian ${SECTION_TITLE[id].id} (${pages} halaman) untuk ${c.code}:\n\n${text}`, `Draft of the ${SECTION_TITLE[id].en} section (${pages} pages) for ${c.code}:\n\n${text}`),
    structured: { kind: 'tenderpilot/bid-section', data: { section: id, title: SECTION_TITLE[id][L], text } },
    followUps: chips(L, 'price', 'req'),
  }
}

function clarify(ctx: Ctx): SimResponse {
  const w = ctx.world
  if (!w.tender) return noTender(ctx)
  const L = ctx.lang
  if (!w.tender.mirror)
    return {
      text: T(L, `Spesifikasi ${w.tender.code} tidak mengunci merek, jadi tidak perlu pertanyaan klarifikasi soal merek. Pertanyaan klarifikasi berguna untuk paket pompa darurat yang menyebut satu merek.`, `The spec of ${w.tender.code} does not lock a brand, so no brand clarification is needed. A clarification question is useful for the emergency pump package that names one brand.`),
      followUps: chips(L, 'sum'),
    }
  return {
    text: T(
      L,
      `Usulan pertanyaan klarifikasi kepada ${w.tender.opd} untuk ${w.tender.code}:\n\n"Dengan hormat, pada spesifikasi teknis tercantum satu merek pompa tanpa keterangan 'atau setara'. Mohon penjelasan apakah pompa celup dengan kapasitas dan daya hisap yang sama dari merek lain dapat ditawarkan, agar persaingan sehat dan harga wajar. Terima kasih."`,
      `Suggested clarification question to ${w.tender.opd} for ${w.tender.code}:\n\n"Dear Sir or Madam, the technical specification names one pump brand without 'or equivalent'. Please confirm whether a submersible pump of the same capacity and suction from another brand may be offered, so that competition stays fair and prices reasonable. Thank you."`,
    ),
    followUps: chips(L, 'why'),
  }
}

export const SCENARIO: Scenario<TpContext> = {
  product: 'tenderpilot',
  intents: [
    { id: 'ringkas-tender', examples: ['ringkas tender ini', 'ringkasan tender', 'rangkum paket ini', 'apa isi tender ini', 'summarise this tender', 'tender summary', 'what is this tender about', 'ringkesan tender'], respond: (c) => summary(c) },
    { id: 'jelaskan-skor', examples: ['kenapa peluangnya segini', 'jelaskan skor peluang', 'peluang menang dari mana', 'why is the chance this high', 'explain the win score', 'win probability', 'kok peluange semono'], respond: (c) => why(c) },
    { id: 'saran-harga', examples: ['berapa harga yang pas', 'saran harga penawaran', 'harga berapa sebaiknya', 'what price should i bid', 'price advice', 'suggested bid price', 'regane piro'], respond: (c) => price(c) },
    { id: 'cek-syarat', examples: ['syarat apa yang kurang', 'cek syarat', 'kelengkapan dokumen', 'which requirement is missing', 'check the requirements', 'are we eligible'], respond: (c) => reqs(c) },
    {
      id: 'susun-bagian',
      examples: ['susun bagian surat penawaran', 'tulis daftar harga', 'buat pakta integritas', 'susun jadwal pengiriman', 'tulis pengalaman pekerjaan sejenis', 'draft the bid letter section', 'write the delivery schedule', 'draft the integrity pact', 'susun lampiran legal'],
      respond: (c) => section(c),
    },
    { id: 'pertanyaan-klarifikasi', examples: ['tulis pertanyaan klarifikasi', 'tanya panitia soal spesifikasi merek', 'pertanyaan ke panitia', 'write a clarification question', 'ask the committee about the brand'], respond: (c) => clarify(c) },
  ],
  fallback: (c) => ({
    text: T(c.lang, 'Saya bisa meringkas tender, menjelaskan peluang menang, menyarankan harga, memeriksa syarat, menyusun satu bagian dokumen, atau menulis pertanyaan klarifikasi. Pilih salah satu saran di bawah.', 'I can summarise the tender, explain the win chance, suggest a price, check requirements, draft one document section or write a clarification question. Pick a suggestion below.'),
    followUps: chips(c.lang, 'sum', 'why', 'price', 'req'),
  }),
}

const str = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max
const summarySchema = {
  safeParse: (v: unknown): { success: true; data: unknown } | { success: false } => {
    const o = v as Record<string, unknown> | null
    const ok = !!o && str(o.summary, 1500) && Array.isArray(o.keyRequirements) && o.keyRequirements.length <= 5 && o.keyRequirements.every((x) => str(x, 200)) && Array.isArray(o.risks) && o.risks.length <= 3 && o.risks.every((x) => str(x, 240)) && str(o.deadline, 80)
    return ok ? { success: true, data: o } : { success: false }
  },
}
const sectionSchema = {
  safeParse: (v: unknown): { success: true; data: unknown } | { success: false } => {
    const o = v as Record<string, unknown> | null
    const ok = !!o && typeof o.section === 'string' && SECTIONS.some((x) => x.id === o.section) && str(o.text, 4000)
    return ok ? { success: true, data: o } : { success: false }
  },
}
// sim kinds (plan) + the Live tool kinds ('<slug>/<tool name>' from prompts/tenderpilot.ts)
registerStructuredSchema('tenderpilot/tender-summary', summarySchema)
registerStructuredSchema('tenderpilot/summarize_tender', summarySchema)
registerStructuredSchema('tenderpilot/bid-section', sectionSchema)
registerStructuredSchema('tenderpilot/draft_bid_section', sectionSchema)
registerScenario(SCENARIO)
