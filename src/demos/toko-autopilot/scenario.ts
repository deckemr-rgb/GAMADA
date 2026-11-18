/**
 * demos/toko-autopilot/scenario.ts — the simulated store assistant (registered by the lazy Assist drawer). Every
 * number comes from the context the drawer builds out of world/usaha-pintar selectors (ctx), so the answer agrees
 * with the screen. Intents: jelaskan_prediksi → 'insight', susun_po → 'po', saran_harga → 'toko-autopilot/price',
 * atur_shift → 'toko-autopilot/shifts'. Wording rotates per intent (least recently used); each sentence names an
 * item, a supplier, an amount or a time.
 */
import { registerScenario, registerStructuredSchema, type SimContext, type SimResponse } from '../../demo-kit/ai/chat'

export interface TokoCtx {
  product: 'toko-autopilot'
  outlet: string
  flood: { pct: number; text: { id: string; en: string } } | null
  risk: { name: string; onHand: number; daysLeft: number; unit: string; factors: { label: { id: string; en: string }; pct: number }[] }[]
  po: { supplier: string; code: string | null; items: { name: string; qty: number; unit: string; why: { id: string; en: string } }[]; total: number; lead: number } | null
  price: { productId: string; name: string; from: number; to: number; marginDelta: number; locked: { id: string; en: string } | null }[]
  shift: { day: string; start: string; end: string; staff: string; reason: { id: string; en: string } } | null
  outletId: string
}
type L = 'id' | 'en'
type C = SimContext<TokoCtx>
const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const n0 = (n: number, l: L) => n.toLocaleString(l === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 })
const used = new Map<string, number>()
/** least recently used variant of an intent's wording */
const pick = <T,>(key: string, list: T[]): T => {
  const i = used.get(key) ?? 0
  used.set(key, i + 1)
  return list[i % list.length]!
}
const x = (c: C): TokoCtx | null => (c.world && (c.world as TokoCtx).product === 'toko-autopilot' ? (c.world as TokoCtx) : null)
const none = (l: L): SimResponse => ({ text: l === 'id' ? 'Data toko belum termuat. Coba lagi sebentar lagi.' : 'Shop data has not loaded yet. Try again in a moment.' })

function explain(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const r = w.risk[0]
  if (!r) return { text: l === 'id' ? `Di ${w.outlet} tidak ada barang yang berisiko habis dalam 14 hari (simulasi).` : `At ${w.outlet} nothing is at risk of running out within 14 days (simulated).` }
  const f = r.factors.map((k) => `${k.label[l]} +${k.pct}%`).join(', ')
  const lead = pick('ex', l === 'id'
    ? [`${r.name} paling mendesak: stok ${n0(r.onHand, l)} ${r.unit}, habis dalam ${n0(r.daysLeft, l)} hari.`, `Perhatikan ${r.name}: tinggal ${n0(r.onHand, l)} ${r.unit}, cukup ±${n0(r.daysLeft, l)} hari lagi.`]
    : [`${r.name} is the most urgent: ${n0(r.onHand, l)} ${r.unit} left, runs out in ${n0(r.daysLeft, l)} days.`, `Watch ${r.name}: ${n0(r.onHand, l)} ${r.unit} left, enough for about ${n0(r.daysLeft, l)} days.`])
  const text = `${lead} ${f ? (l === 'id' ? `Faktor: ${f}.` : `Factors: ${f}.`) : ''}${w.flood ? ` ${w.flood.text[l]}.` : ''} ${l === 'id' ? '(simulasi)' : '(simulated)'}`
  return { text, structured: { kind: 'insight', data: { indicator: r.name, trend: 'naik', explanation: text } } }
}

function po(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  if (!w.po) return { text: l === 'id' ? 'Tidak ada barang yang perlu dipesan sekarang: stok di atas titik pesan ulang.' : 'Nothing needs ordering now: stock is above the reorder points.' }
  const p = w.po
  const lines = p.items.map((i) => `- ${i.name}: ${n0(i.qty, l)} ${i.unit} (${i.why[l]})`).join('\n')
  const head = pick('po', l === 'id'
    ? [`Draf PO untuk ${p.supplier} (kirim ${p.lead} hari), total ${rp(p.total)}:`, `Saya susun pesanan ke ${p.supplier}${p.code ? ` (${p.code})` : ''}, nilai ${rp(p.total)}:`]
    : [`Draft PO for ${p.supplier} (ships in ${p.lead} days), total ${rp(p.total)}:`, `Here is the order to ${p.supplier}${p.code ? ` (${p.code})` : ''}, worth ${rp(p.total)}:`])
  const tail = l === 'id' ? 'Setujui di tab PO dengan "Setujui & kirim".' : 'Approve it in the POs tab with "Approve & send".'
  return {
    text: `${head}\n${lines}\n${tail}`,
    structured: { kind: 'po', data: { supplier: p.supplier, items: p.items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })), reason: p.items[0]?.why[l] ?? '', deliverBy: l === 'id' ? `${p.lead} hari` : `${p.lead} days` } },
  }
}

function price(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const open = w.price.find((p) => !p.locked && p.from !== p.to)
  const locked = w.price.find((p) => p.locked)
  const ethics = locked ? (l === 'id' ? ` ${locked.name}: ${locked.locked!.id}.` : ` ${locked.name}: ${locked.locked!.en}.`) : ''
  if (!open) return { text: (l === 'id' ? `Belum ada saran harga baru di ${w.outlet}.` : `No new price suggestion at ${w.outlet}.`) + ethics }
  const head = pick('pr', l === 'id'
    ? [`Saran: ${open.name} dari ${rp(open.from)} ke ${rp(open.to)}; margin harian berubah ${open.marginDelta >= 0 ? '+' : '−'}${rp(Math.abs(open.marginDelta))} (elastisitas simulasi).`, `${open.name} bisa disesuaikan ke ${rp(open.to)} (sekarang ${rp(open.from)}); efek margin ${open.marginDelta >= 0 ? '+' : '−'}${rp(Math.abs(open.marginDelta))}/hari, simulasi.`]
    : [`Suggestion: ${open.name} from ${rp(open.from)} to ${rp(open.to)}; daily margin changes ${open.marginDelta >= 0 ? '+' : '−'}${rp(Math.abs(open.marginDelta))} (simulated elasticity).`, `${open.name} could move to ${rp(open.to)} (now ${rp(open.from)}); margin effect ${open.marginDelta >= 0 ? '+' : '−'}${rp(Math.abs(open.marginDelta))}/day, simulated.`])
  return {
    text: head + ethics,
    structured: { kind: 'toko-autopilot/price', data: { productId: open.productId, price: open.to, reason: head, ...(locked ? { ethicsNote: locked.locked![l] } : {}) } },
  }
}

function shifts(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  if (!w.shift) return { text: l === 'id' ? `Jadwal ${w.outlet} minggu ini sudah cukup untuk perkiraan antrean (simulasi).` : `This week’s ${w.outlet} schedule covers the expected queues (simulated).` }
  const s = w.shift
  const text = pick('sh', l === 'id'
    ? [`Tambah 1 kasir ${s.day} ${s.start}–${s.end} (${s.staff}). ${s.reason.id}.`, `${s.reason.id}: saya sarankan ${s.staff} jaga tambahan ${s.day} ${s.start}–${s.end}.`]
    : [`Add 1 cashier ${s.day} ${s.start}–${s.end} (${s.staff}). ${s.reason.en}.`, `${s.reason.en}: I suggest ${s.staff} takes an extra ${s.day} ${s.start}–${s.end} shift.`])
  return { text, structured: { kind: 'toko-autopilot/shifts', data: { outletId: w.outletId, blocks: [{ day: s.day, start: s.start, end: s.end, staff: s.staff }], note: text } } }
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
let done = false
export function registerTokoScenario(): void {
  if (done) return
  done = true
  registerStructuredSchema('toko-autopilot/price', { safeParse: (v) => (obj(v) && typeof v.productId === 'string' && typeof v.price === 'number' && v.price > 0 ? { success: true, data: v } : { success: false }) })
  registerStructuredSchema('toko-autopilot/shifts', { safeParse: (v) => (obj(v) && typeof v.outletId === 'string' && Array.isArray(v.blocks) ? { success: true, data: v } : { success: false }) })
  registerScenario<TokoCtx>({
    product: 'toko-autopilot',
    intents: [
      { id: 'jelaskan_prediksi', examples: ['jelaskan prediksi stok', 'kenapa permintaan naik', 'barang apa yang mau habis', 'why is demand up', 'explain the forecast', 'stok opo sing arep entek'], respond: explain },
      { id: 'susun_po', examples: ['susun PO', 'buat purchase order', 'pesan barang ke supplier', 'kulakan apa saja', 'draft a purchase order', 'order from the supplier'], respond: po },
      { id: 'saran_harga', examples: ['saran harga', 'harga berapa yang pas', 'naikkan harga', 'price suggestion', 'what price should I set', 'regane piro'], respond: price },
      { id: 'atur_shift', examples: ['atur shift', 'jadwal kasir', 'perlu kasir tambahan', 'plan the shifts', 'do I need another cashier', 'jadwal jaga'], respond: shifts },
    ],
    fallback: (c) => ({
      text: c.lang === 'id'
        ? 'Saya bisa menjelaskan prediksi stok, menyusun PO, memberi saran harga, atau mengatur shift. Pilih salah satu tombol di atas.'
        : 'I can explain the stock forecast, draft a PO, suggest prices or plan shifts. Pick one of the buttons above.',
    }),
  })
}
