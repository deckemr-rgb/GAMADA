/**
 * demos/katalog-lokal/scenario.ts — AI simulation (spec §9.2), registered by the lazy AI surfaces (Spec, Ask), never
 * by the page. Intents (11 + fallback): buat-kebutuhan (→ need-spec, from the parser), kenapa-urutan (matchScore
 * parts), kenapa-belum-terverifikasi, bandingkan (→ katalog-lokal/compare), bagi-pesanan, harga-wajar (vs HPS),
 * lencana-artinya, waktu-kirim, pembayaran (simulasi, Kas Daerah), porsi-lokal (spendMonth), aturan. Every number
 * comes from the context (world selectors); the final choice stays with the authorised procurement official.
 */
import type { Lang, Scenario, SimContext, SimResponse } from '../../demo-kit/ai/types'
import { registerScenario, registerStructuredSchema } from '../../demo-kit/ai/chat'
import { world, type WorldState } from '../../demo-kit/world'
import { catalogKpi, catalogShortlist, listingOf, needView, type MatchParts } from '../../demo-kit/world/pasar-daerah'
import { parseNeed } from './parse'
import { SLUG, kecName, nf, rp, splitByBiz, splitPlan } from './model'

/** the context sent with each turn (≤ 6 KB): the need, its top 6 offers, HPS, Awas Belanja flags, KPIs */
export interface KlContext {
  need: { code: string; title: string; kecamatan: string; items: string[]; deadlineDays: number; emergency: boolean; budget: number | null } | null
  hps: number | null
  flags: number[]
  top: { ref: string; name: string; verified: boolean; taxTidy: boolean; score: number | null; km: number; match: number; parts: MatchParts; available: string; unitPrices: string; total: number; short: boolean; leadDays: number; source: string }[]
  waiting: { name: string; request: string | null }[]
  /** the split suggestion over the whole need list (first two lines = the item split between two UMKM) */
  split: { ref: string; name: string; category: string; item: string; qty: number }[]
  /** need items no verified local UMKM supplies (said aloud, never dropped silently) */
  splitMissing: string[]
  kpi: { spendMonth: number; paidOrdersMonth: number; verifiedLocal: number; openNeeds: number }
}

export function aiContext(s: WorldState, needId: string | null, lang: Lang, now: number): KlContext {
  const v = needId ? needView(s, needId) : null
  const sl = needId ? catalogShortlist(s, needId) : { top: [], waiting: [] }
  const k = catalogKpi(s, now)
  const sp = needId ? splitPlan(s, needId) : null
  return {
    need: v
      ? { code: v.need.code, title: v.need.title[lang], kecamatan: kecName(s, v.need.kecamatanId), items: v.need.items.map((i) => `${nf(lang, i.qty)} ${i.unit} ${i.name[lang]}`), deadlineDays: v.need.deadlineDays, emergency: v.need.emergency, budget: v.need.budget ?? null }
      : null,
    hps: v?.hps ?? null,
    flags: v?.flags.map((f) => f.pct) ?? [],
    top: sl.top.map((c) => ({
      ref: c.business.id, name: c.business.name, verified: c.badges.verified, taxTidy: c.badges.taxTidy, score: c.badges.score, km: c.km, match: Math.round(c.score * 100), parts: c.parts,
      available: c.offer.lines.map((l) => `${nf(lang, l.qtyAvailable)}/${nf(lang, l.qty)} ${l.unit}`).join(', '),
      unitPrices: c.offer.lines.map((l) => `${l.name[lang]} ${rp(l.unitPrice)}`).join(', '),
      total: c.offer.total, short: c.offer.lines.some((l) => l.qtyAvailable < l.qty),
      leadDays: Math.max(1, ...c.offer.lines.map((l) => listingOf(s, c.business.id, l.category).leadDays)), source: c.offer.source,
    })),
    waiting: sl.waiting.map((c) => ({ name: c.business.name, request: c.requestId ?? null })),
    split: (sp?.lines ?? []).map((x) => ({ ref: x.bizId, name: s.businesses.byId[x.bizId]?.name ?? x.bizId, category: x.category, item: x.name[lang], qty: x.qty })),
    splitMissing: (sp?.missing ?? []).map((m) => m.name[lang]),
    kpi: { spendMonth: k.spendMonth, paidOrdersMonth: k.paidOrdersMonth, verifiedLocal: k.verifiedLocal, openNeeds: k.openNeeds },
  }
}

type Ctx = SimContext<KlContext>
/** "A: Karung pasir 80, Terpal 50 + B: Karung pasir 1.920" (one group per UMKM) */
const splitText = (w: KlContext, L: Lang) => splitByBiz(w.split.map((x) => ({ ...x, bizId: x.ref }))).map((g) => `${g.lines[0]!.name}: ${g.lines.map((x) => `${x.item} ${nf(L, x.qty)}`).join(', ')}`).join(' + ')
const T = (lang: Lang, id: string, en: string) => (lang === 'id' ? id : en)
const chips = (lang: Lang, ...k: ('why' | 'cmp' | 'split' | 'price' | 'badge' | 'pay' | 'rule')[]) =>
  k.map(
    (x) =>
      ({
        why: T(lang, 'Kenapa urutannya begini?', 'Why this ranking?'),
        cmp: T(lang, 'Bandingkan tiga teratas', 'Compare the top three'),
        split: T(lang, 'Perlu bagi pesanan?', 'Should the order be split?'),
        price: T(lang, 'Apakah harganya wajar?', 'Is the price fair?'),
        badge: T(lang, 'Apa arti lencananya?', 'What do the badges mean?'),
        pay: T(lang, 'Bagaimana pembayarannya?', 'How is payment made?'),
        rule: T(lang, 'Siapa yang memutuskan?', 'Who decides?'),
      })[x],
  )
const noNeed = (c: Ctx): SimResponse => ({
  text: T(c.lang, 'Belum ada kebutuhan yang dibuka. Pilih satu dari daftar atau tulis kebutuhan baru, lalu tanya lagi: saya menjawab dengan angka kebutuhan itu.', 'No need is open yet. Pick one from the list or write a new one, then ask again: I answer with that need’s numbers.'),
  followUps: [],
})

function create(c: Ctx): SimResponse {
  const p = parseNeed(c.text, world.get())
  const L = c.lang
  if (!p.items.length)
    return { text: T(L, 'Saya belum menemukan barang yang dikenali. Sebut jumlah dan barangnya, misalnya "300 nasi kotak untuk Kec. …".', 'I could not find a known item. Name the quantity and item, e.g. "300 boxed meals for … district".'), followUps: [] }
  const items = p.items.map((i) => `${nf(L, i.qty)} ${i.unit} ${i.name[L].toLowerCase()}`).join(T(L, ' dan ', ' and '))
  const kec = p.kecamatanId ? kecName(world.get(), p.kecamatanId) : null
  return {
    text: T(
      L,
      `Saya susun ${p.items.length} baris spesifikasi: ${items}${kec ? `, lokasi Kec. ${kec}` : ''}, kirim ≤ ${p.deliveryDays} hari${p.emergency ? ', ditandai darurat' : ''}${p.budget ? `, pagu ${rp(p.budget)}` : ''}.${kec ? '' : ' Kecamatan belum dikenali: pilih dari daftar.'} Periksa jumlahnya, lalu terbitkan.`,
      `I drafted ${p.items.length} specification line${p.items.length > 1 ? 's' : ''}: ${items}${kec ? `, location ${kec}` : ''}, delivery ≤ ${p.deliveryDays} days${p.emergency ? ', marked as emergency' : ''}${p.budget ? `, budget ${rp(p.budget)}` : ''}.${kec ? '' : ' The district was not recognised: pick it from the list.'} Check the quantities, then publish.`,
    ),
    structured: {
      kind: 'need-spec',
      data: { items: p.items.map((i) => ({ name: i.name[L], qty: i.qty, unit: i.unit, spec: i.spec[L] })), ...(kec ? { location: kec } : {}), deliveryDays: p.deliveryDays, ...(p.budget ? { budgetCeiling: p.budget } : {}) },
    },
    toolCalls: [{ name: 'need_spec', input: { text: c.text.slice(0, 160) } }],
    followUps: [],
  }
}

function why(c: Ctx): SimResponse {
  const w = c.world
  if (!w.need) return noNeed(c)
  const L = c.lang
  const [a, b] = w.top
  if (!a) return { text: T(L, `Belum ada UMKM terverifikasi yang cocok untuk ${w.need.code}.`, `No verified SME matches ${w.need.code} yet.`), followUps: chips(L, 'badge') }
  const line = (x: KlContext['top'][number]) =>
    T(L, `${x.name} ${x.match}% (cakupan ${nf(L, x.parts.coverage, 2)}, jarak ${nf(L, x.parts.distance, 2)} untuk ${nf(L, x.km, 1)} km, skor usaha ${nf(L, x.parts.skor, 2)}, pajak ${x.parts.pajak}, kapasitas ${nf(L, x.parts.kapasitas, 2)})`, `${x.name} ${x.match}% (coverage ${nf(L, x.parts.coverage, 2)}, distance ${nf(L, x.parts.distance, 2)} for ${nf(L, x.km, 1)} km, business score ${nf(L, x.parts.skor, 2)}, tax ${x.parts.pajak}, capacity ${nf(L, x.parts.kapasitas, 2)})`)
  return {
    text: T(
      L,
      `Urutan ${w.need.code} memakai lima bobot: cakupan 35 %, jarak 25 %, skor usaha 20 %, pajak rapi 10 %, kapasitas 10 % (simulasi). Teratas: ${line(a)}.${b ? ` Berikutnya: ${line(b)}.` : ''} Hanya UMKM terverifikasi yang masuk daftar ini.`,
      `The ranking of ${w.need.code} uses five weights: coverage 35%, distance 25%, business score 20%, tax in order 10%, capacity 10% (simulated). Top: ${line(a)}.${b ? ` Next: ${line(b)}.` : ''} Only verified SMEs enter this list.`,
    ),
    followUps: chips(L, 'cmp', 'badge'),
  }
}

function unverified(c: Ctx): SimResponse {
  const w = c.world
  if (!w.need) return noNeed(c)
  const L = c.lang
  if (!w.waiting.length) return { text: T(L, `Semua pemasok yang cocok untuk ${w.need.code} sudah terverifikasi.`, `Every matching supplier of ${w.need.code} is already verified.`), followUps: chips(L, 'why') }
  const list = w.waiting.slice(0, 3).map((x) => `${x.name}${x.request ? ` (${x.request})` : ''}`).join(', ')
  return {
    text: T(
      L,
      `${w.waiting.length} pemasok belum lolos KYB di Kenal Mitra, jadi belum masuk peringkat: ${list}. Begitu verifikasinya lolos, kartunya pindah ke daftar teratas dengan skor yang sama.`,
      `${w.waiting.length} supplier${w.waiting.length > 1 ? 's have' : ' has'} not passed the Kenal Mitra KYB check, so they are not ranked yet: ${list}. Once the check passes, the card moves into the top list with the same score.`,
    ),
    followUps: chips(L, 'badge', 'why'),
  }
}

function compare(c: Ctx): SimResponse {
  const w = c.world
  if (!w.need) return noNeed(c)
  const L = c.lang
  const top = w.top.slice(0, 3)
  if (top.length < 2) return { text: T(L, `Baru ${top.length} UMKM terverifikasi untuk ${w.need.code}; perbandingan butuh minimal dua.`, `Only ${top.length} verified SME for ${w.need.code}; a comparison needs at least two.`), followUps: chips(L, 'why') }
  const pick = [...top].sort((a, b) => Number(a.short) - Number(b.short) || b.match - a.match || a.total - b.total)[0]!
  const ranking = top.map((x) => ({ businessId: x.ref, reason: T(L, `${x.match}% cocok, ${nf(L, x.km, 1)} km, total ${rp(x.total)}${x.short ? ', stok kurang' : ''}`, `${x.match}% match, ${nf(L, x.km, 1)} km, total ${rp(x.total)}${x.short ? ', short of stock' : ''}`).slice(0, 160) }))
  const risks = [
    ...(pick.short ? [T(L, 'Stok pilihan utama kurang dari jumlah diminta.', 'The main pick has less stock than requested.')] : []),
    ...(w.hps && pick.total > w.hps ? [T(L, 'Total di atas HPS acuan.', 'Total above the reference HPS.')] : []),
    T(L, 'Harga simulasi; keputusan tetap pada pejabat pengadaan.', 'Simulated prices; the procurement official decides.'),
  ].slice(0, 2)
  return {
    text: T(
      L,
      `Untuk ${w.need.code}, saya condong ke ${pick.name}: ${ranking.find((r) => r.businessId === pick.ref)?.reason}. ${top.filter((x) => x !== pick).map((x) => `${x.name} ${rp(x.total)}`).join('; ')}.${w.split.length ? ` Usulan bagi pesanan: ${splitText(w, L)}.${w.splitMissing.length ? ` ${w.splitMissing.join(', ')} belum ada UMKM lokal terverifikasi.` : ''}` : ''}`,
      `For ${w.need.code} I lean to ${pick.name}: ${ranking.find((r) => r.businessId === pick.ref)?.reason}. ${top.filter((x) => x !== pick).map((x) => `${x.name} ${rp(x.total)}`).join('; ')}.${w.split.length ? ` Suggested split: ${splitText(w, L)}.${w.splitMissing.length ? ` No verified local SME for ${w.splitMissing.join(', ')} yet.` : ''}` : ''}`,
    ),
    structured: { kind: 'katalog-lokal/compare', data: { pickId: pick.ref, ranking, ...(w.split.length ? { split: w.split.slice(0, 2).map((x) => ({ businessId: x.ref, category: x.category, qty: x.qty })) } : {}), risks } },
    toolCalls: [{ name: 'compare_offers', input: { need: w.need.code, offers: top.length } }],
    followUps: chips(L, 'split', 'price', 'rule'),
  }
}

function split(c: Ctx): SimResponse {
  const w = c.world
  if (!w.need) return noNeed(c)
  const L = c.lang
  return {
    text: w.split.length
      ? T(L, `Stok UMKM teratas tidak cukup sendiri untuk ${w.split[0]!.item}. Usulan: ${splitText(w, L)}.${w.splitMissing.length ? ` ${w.splitMissing.join(', ')}: belum ada UMKM lokal terverifikasi, pesan terpisah.` : ''} Tombol "Pakai usulan bagi pesanan" ada di jendela pembanding.`, `The top SME’s stock is not enough alone for ${w.split[0]!.item}. Suggestion: ${splitText(w, L)}.${w.splitMissing.length ? ` ${w.splitMissing.join(', ')}: no verified local SME yet, order it separately.` : ''} The "Use the split suggestion" button is in the comparison.`)
      : T(L, `Tidak perlu: UMKM teratas sanggup memenuhi seluruh ${w.need.code} sendiri.`, `Not needed: the top SME can supply all of ${w.need.code} alone.`),
    followUps: chips(L, 'cmp', 'price'),
  }
}

function price(c: Ctx): SimResponse {
  const w = c.world
  if (!w.need) return noNeed(c)
  const L = c.lang
  const a = w.top[0]
  if (!a) return noNeed(c)
  const vs = w.hps ? Math.round((a.total / w.hps - 1) * 100) : null
  return {
    text: T(
      L,
      `${a.name}: ${a.unitPrices}, total ${rp(a.total)} (simulasi).${vs !== null ? ` Itu ${vs <= 0 ? `${-vs} % di bawah` : `${vs} % di atas`} HPS acuan ${rp(w.hps!)}.` : ' Kebutuhan ini tanpa tender, jadi pembandingnya harga etalase UMKM lain.'}${w.flags.length ? ` Awas Belanja menandai HPS paket asal +${w.flags[0]} % di atas harga pasar.` : ''}`,
      `${a.name}: ${a.unitPrices}, total ${rp(a.total)} (simulated).${vs !== null ? ` That is ${vs <= 0 ? `${-vs}% below` : `${vs}% above`} the reference HPS of ${rp(w.hps!)}.` : ' This need has no tender, so the benchmark is the other SMEs’ storefront prices.'}${w.flags.length ? ` Awas Belanja flagged the source package HPS +${w.flags[0]}% above market.` : ''}`,
    ),
    followUps: chips(L, 'cmp', 'split'),
  }
}

const badge = (c: Ctx): SimResponse => ({
  text: T(
    c.lang,
    'Terverifikasi = dokumen usaha lolos KYB di Kenal Mitra. Pajak Rapi = jurnal dan pajak bulanan siap di Pajak Beres. Skor = Skor Usaha 0–1000 dari Rapor Usaha (simulasi). Lencana berubah begitu produk asalnya mencatat perubahan.',
    'Verified = business documents passed KYB in Kenal Mitra. Tax in order = journals and monthly tax ready in Pajak Beres. Score = the 0–1000 Business Score from Rapor Usaha (simulated). Badges change as soon as their source product records a change.',
  ),
  followUps: chips(c.lang, 'why', 'cmp'),
})

function lead(c: Ctx): SimResponse {
  const w = c.world
  if (!w.need) return noNeed(c)
  const L = c.lang
  const rows = w.top.slice(0, 3).map((x) => `${x.name} ${x.leadDays} ${T(L, 'hari', 'days')}`).join(', ')
  return { text: T(L, `Tenggat ${w.need.code}: kirim ≤ ${w.need.deadlineDays} hari. Perkiraan kirim (simulasi): ${rows || '—'}.`, `${w.need.code} deadline: deliver ≤ ${w.need.deadlineDays} days. Estimated delivery (simulated): ${rows || '—'}.`), followUps: chips(L, 'cmp', 'pay') }
}

const pay = (c: Ctx): SimResponse => ({
  text: T(
    c.lang,
    'Alurnya: pesanan → UMKM konfirmasi → barang dikirim → Pemda menekan "Terima & bayar". Pembayaran dicatat sebagai Transfer dari Kas Daerah (simulasi) setelah barang diterima; tidak ada QRIS atau nomor virtual account di demo ini.',
    'The flow: order → SME confirms → goods shipped → the government presses "Receive & pay". Payment is recorded as a transfer from the regional treasury (simulated) after delivery; there is no QR or virtual account number in this demo.',
  ),
  followUps: chips(c.lang, 'rule'),
})

const share = (c: Ctx): SimResponse => ({
  text: T(
    c.lang,
    `Bulan ini ${c.world.kpi.paidOrdersMonth} pesanan ke UMKM lokal sudah dibayar, total ${rp(c.world.kpi.spendMonth)} (simulasi), dari ${c.world.kpi.verifiedLocal} UMKM terverifikasi. Kebutuhan terbuka: ${c.world.kpi.openNeeds}.`,
    `This month ${c.world.kpi.paidOrdersMonth} orders to local SMEs were paid, ${rp(c.world.kpi.spendMonth)} in total (simulated), from ${c.world.kpi.verifiedLocal} verified SMEs. Open needs: ${c.world.kpi.openNeeds}.`,
  ),
  followUps: chips(c.lang, 'pay'),
})

const rule = (c: Ctx): SimResponse => ({
  text: T(
    c.lang,
    'Katalog Lokal hanya menyiapkan pilihan: etalase daerah yang melengkapi katalog elektronik nasional, bukan menggantikannya. Keputusan tetap pada pejabat pengadaan yang berwenang, mengikuti aturan pengadaan yang berlaku.',
    'Katalog Lokal only prepares the options: a regional storefront that complements the national e-catalogue, never replaces it. The authorised procurement official decides, under the procurement rules in force.',
  ),
  followUps: chips(c.lang, 'cmp', 'pay'),
})

const SCENARIO: Scenario<KlContext> = {
  product: SLUG,
  intents: [
    { id: 'buat-kebutuhan', examples: ['butuh 2000 karung pasir dan 50 terpal', 'pesan 300 nasi kotak untuk rapat', 'perlu air minum untuk posko', 'butuh seragam relawan 60 stel', 'need 2000 sandbags and 50 tarps', 'order 150 boxed meals for a meeting', 'we need bottled water for the post', 'butuh kursi lipat dan spanduk', 'darurat butuh terpal kirim 2 hari'], respond: (c) => create(c) },
    { id: 'kenapa-urutan', examples: ['kenapa urutannya begini', 'kenapa umkm ini paling atas', 'dasar peringkat', 'why this ranking', 'why is this sme first', 'how is the match score computed', 'skor kecocokan dari mana'], respond: (c) => why(c) },
    { id: 'kenapa-belum-terverifikasi', examples: ['kenapa belum terverifikasi', 'kenapa umkm itu tidak muncul', 'menunggu kenal mitra', 'why is it not verified', 'unverified supplier', 'why is that sme missing'], respond: (c) => unverified(c) },
    { id: 'bandingkan', examples: ['bandingkan penawaran', 'bandingkan tiga teratas', 'mana yang paling bagus', 'compare the offers', 'compare the top three', 'which one is best'], respond: (c) => compare(c) },
    { id: 'bagi-pesanan', examples: ['perlu bagi pesanan', 'pecah pesanan ke dua umkm', 'stok tidak cukup', 'should the order be split', 'split the order', 'not enough stock'], respond: (c) => split(c) },
    { id: 'harga-wajar', examples: ['apakah harganya wajar', 'harga wajar', 'dibanding hps', 'is the price fair', 'price compared to hps', 'terlalu mahal'], respond: (c) => price(c) },
    { id: 'lencana-artinya', examples: ['apa arti lencananya', 'apa itu pajak rapi', 'arti terverifikasi', 'what do the badges mean', 'what is tax in order', 'what is the score'], respond: (c) => badge(c) },
    { id: 'waktu-kirim', examples: ['kapan bisa dikirim', 'berapa lama pengiriman', 'waktu kirim', 'delivery time', 'when can they deliver', 'how long to ship'], respond: (c) => lead(c) },
    { id: 'pembayaran', examples: ['bagaimana pembayarannya', 'cara bayar', 'bayar lewat kas daerah', 'how is payment made', 'how do we pay', 'payment'], respond: (c) => pay(c) },
    { id: 'porsi-lokal', examples: ['berapa belanja ke umkm lokal', 'porsi belanja lokal bulan ini', 'total belanja umkm', 'local share of spend', 'how much spent on local smes', 'spend this month'], respond: (c) => share(c) },
    { id: 'aturan', examples: ['siapa yang memutuskan', 'apakah boleh langsung pilih', 'aturan pengadaan', 'who decides', 'is this allowed', 'procurement rules'], respond: (c) => rule(c) },
  ],
  fallback: (c) => {
    if (parseNeed(c.text, world.get()).items.length) return create(c)
    return {
      text: T(c.lang, 'Saya membantu kebutuhan belanja daerah ke UMKM lokal: menyusun spesifikasi, membaca peringkat, membandingkan penawaran, harga, waktu kirim, dan pembayaran (simulasi). Coba salah satu:', 'I help with local government purchases from SMEs: drafting specifications, reading the ranking, comparing offers, prices, delivery and payment (simulated). Try one:'),
      followUps: chips(c.lang, 'why', 'cmp', 'badge', 'pay'),
    }
  },
}

const str = (x: unknown, max: number) => typeof x === 'string' && x.length > 0 && x.length <= max
const compareSchema = {
  safeParse: (v: unknown): { success: true; data: unknown } | { success: false } => {
    const o = v as Record<string, unknown> | null
    const rk = o?.ranking
    const ok =
      !!o && str(o.pickId, 40) && Array.isArray(rk) && rk.length >= 1 && rk.length <= 3 && rk.every((r) => str((r as Record<string, unknown>).businessId, 40) && str((r as Record<string, unknown>).reason, 160)) &&
      Array.isArray(o.risks) && o.risks.length <= 2 && o.risks.every((x) => str(x, 200)) && (o.split === undefined || (Array.isArray(o.split) && o.split.length <= 2))
    return ok ? { success: true, data: o } : { success: false }
  },
}
registerStructuredSchema('katalog-lokal/compare', compareSchema)
registerStructuredSchema('katalog-lokal/compare_offers', compareSchema)
registerScenario(SCENARIO)
