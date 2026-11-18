/**
 * demos/pantau-merek/scenario.ts — the simulated reputation analyst (spec §9.2). Every number comes from the world
 * summary (ctx.ts → brand selectors), so the answer matches the screen. Structured kinds: 'clusters' (shared, Live
 * tool cluster_feedback), 'reply' (draft_reply) and 'pantau-merek/announcement' (product tool draft_announcement).
 * Registered by the lazy AI surfaces (Cluster, Ask), never by the page.
 */
import { registerScenario, registerStructuredSchema, type Intent, type Scenario, type SimContext, type SimResponse } from '../../demo-kit/ai/chat'
import { clock, world } from '../../demo-kit/world'
import { ANNOUNCE_CHANNEL } from '../../demo-kit/world/usaha-pintar'
import type { BrandCtx } from './ctx'
import { OFFERS, announcementDraft, type Offer } from './announce-text'
import { draftReply, signature } from './replies'
import { tm } from './strings'

type L = 'id' | 'en'
type Ctx = SimContext<BrandCtx>
const nf = (n: number, l: L) => n.toLocaleString(l === 'id' ? 'id-ID' : 'en-GB')
const rp = (n: number, l: L) => (l === 'id' ? `Rp ${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : `Rp ${(n / 1e6).toLocaleString('en-GB', { maximumFractionDigits: 1 })} M`)
const W = (ctx: Ctx): BrandCtx | null => {
  const x = ctx.world as BrandCtx | null
  return x && x.product === 'pantau-merek' ? x : null
}
const noAlert = (l: L): SimResponse => ({
  text: l === 'id' ? 'Belum ada lonjakan keluhan yang terdeteksi hari ini. Kartu sinyal awal tetap memantau keluhan pengiriman.' : 'No complaint spike has been detected today. The early-signal card keeps watching delivery complaints.',
})
const ACTION: Record<string, { id: string; en: string }> = {
  telat: { id: 'Umumkan perkiraan kirim baru per kecamatan.', en: 'Publish new delivery estimates per district.' },
  eta: { id: 'Kirim kabar status ke tiap pembeli hari ini.', en: 'Message every buyer with a status update today.' },
  stok: { id: 'Percepat PO pompa di Toko Autopilot.', en: 'Speed up the pump PO in Toko Autopilot.' },
  harga: { id: 'Jelaskan bahwa harga barang darurat tidak dinaikkan.', en: 'Explain that emergency item prices are not raised.' },
}

const intents: Intent<BrandCtx>[] = [
  {
    id: 'cluster_complaints',
    examples: ['kelompokkan keluhan', 'kelompokkan keluhan lonjakan ini', 'pola keluhan', 'group the complaints', 'cluster the complaints', 'what are the complaint patterns', 'klaster keluhan pelanggan'],
    respond: (ctx) => {
      const x = W(ctx)
      const l = ctx.lang
      if (!x?.alert || !x.clusters.length) return noAlert(l)
      const total = x.clusters.reduce((a, c) => a + c.count, 0)
      const top = x.clusters[0]!
      return {
        text:
          l === 'id'
            ? `${nf(total, l)} keluhan sejak ${tm(x.alert.at, l)} terbagi menjadi ${x.clusters.length} pola. Terbesar: “${top.label.id}” (${top.share}%). Contoh asli dan aksi yang disarankan ada di tiap kelompok.`
            : `${nf(total, l)} complaints since ${tm(x.alert.at, l)} fall into ${x.clusters.length} patterns. Largest: “${top.label.en}” (${top.share}%). Real samples and a suggested action sit under each group.`,
        structured: {
          kind: 'clusters',
          data: { clusters: x.clusters.map((c) => ({ label: c.label[l], share: c.share / 100, sample: c.samples[0] ?? c.label[l], suggestedAction: ACTION[c.key]?.[l] })) },
        },
        toolCalls: [{ name: 'cluster_feedback', input: { alertId: x.alert.id, mentions: total } }],
      }
    },
  },
  {
    id: 'draft_announcement',
    examples: ['sarankan pengumuman', 'buat pengumuman layanan', 'draf pengumuman keterlambatan', 'suggest a notice', 'draft a service announcement', 'write an announcement about the delay'],
    slots: { offer: /(ambil-sendiri|jadwal-ulang|gratis-ongkir)/ },
    respond: (ctx, slots) => {
      const x = W(ctx)
      const l = ctx.lang
      if (!x?.alert) return noAlert(l)
      const offer = (OFFERS.includes(slots.offer as Offer) ? slots.offer : 'ambil-sendiri') as Offer
      const text = announcementDraft(world.get(), x.alert.id, offer)[l]
      const chans = (['marketplace', 'sosmed', 'ulasan-peta', 'wa-status', 'struk'] as const).map((c) => ANNOUNCE_CHANNEL[c][l])
      return {
        text:
          l === 'id'
            ? `Draf pengumuman untuk Kec. ${x.alert.kecs.join(', ')} siap. Disarankan tayang di ${chans.join(', ')} supaya pembeli di toko juga membacanya di struk.`
            : `Draft notice for ${x.alert.kecs.join(', ')} is ready. Suggested channels: ${chans.join(', ')}, so walk-in buyers also see it on their receipt.`,
        structured: { kind: 'pantau-merek/announcement', data: { text, channels: ['marketplace', 'sosmed', 'ulasan-peta', 'wa-status', 'struk'], offer } },
        toolCalls: [{ name: 'draft_announcement', input: { alertId: x.alert.id, offer } }],
      }
    },
  },
  {
    id: 'draft_reply',
    examples: ['balas ulasan ini', 'buat balasan', 'draft a reply', 'reply to this review', 'tulis balasan untuk keluhan ini'],
    respond: (ctx) => {
      const x = W(ctx)
      const l = ctx.lang
      const r = x?.selected[0]
      if (!x || !r) return { text: l === 'id' ? 'Pilih satu ulasan di tab Ulasan dulu, lalu minta balasannya.' : 'Pick a review in the Reviews tab first, then ask for a reply.' }
      const reply = draftReply({ handle: r.author, item: r.item, orderCode: r.order, desa: r.desa, kec: '', daysLate: r.daysLate, lang: r.lang, topic: 'pengiriman', rating: null }, 'empatik', 0, signature(false, x.shop.name, x.shop.owner, r.lang), x.shop.market)
      return { text: reply, structured: { kind: 'reply', data: { tone: 'empatik', reply } } }
    },
  },
  {
    id: 'draft_bulk_replies',
    examples: ['balas semua yang terpilih', 'balas lima keluhan', 'reply to all selected', 'draft replies for the selected reviews'],
    respond: (ctx) => {
      const x = W(ctx)
      const l = ctx.lang
      const n = x?.selected.length ?? 0
      return {
        text: n
          ? l === 'id'
            ? `${n} ulasan terpilih. Buka “Balas ${n} terpilih”: tiap draf memakai nama akun, nomor pesanan, barang, dan desa ulasannya sendiri.`
            : `${n} reviews selected. Open “Reply to ${n} selected”: each draft uses its own handle, order number, item and village.`
          : l === 'id'
            ? 'Belum ada ulasan terpilih. Ketuk “Pilih 5 dari lonjakan” di tab Ulasan.'
            : 'No reviews selected yet. Tap “Pick 5 from the spike” in the Reviews tab.',
      }
    },
  },
  {
    id: 'explain_spike',
    examples: ['kenapa melonjak', 'jelaskan lonjakan', 'apa penyebab keluhan', 'why the spike', 'explain the spike', 'what caused the complaints'],
    respond: (ctx) => {
      const x = W(ctx)
      const l = ctx.lang
      if (!x?.alert) return noAlert(l)
      const kecs = x.alert.kecs
      return {
        text:
          l === 'id'
            ? `Lonjakan terdeteksi ${tm(x.alert.at, l)}: ${x.alert.volume} keluhan pengiriman dalam 2 jam, biasanya ${nf(x.alert.baselinePer2h, l)} (+${nf(x.alert.deltaPct, l)}%). Pemicunya peringatan banjir level ${x.flood?.level ?? 3} di Kec. ${kecs.join(', ')}; rute ke Kec. ${kecs[0] ?? ''} terdampak genangan (simulasi). Pesanan terdampak: ${x.affected.count} (${rp(x.affected.value, l)}, simulasi).`
            : `Spike detected at ${tm(x.alert.at, l)}: ${x.alert.volume} delivery complaints in 2 h against a usual ${nf(x.alert.baselinePer2h, l)} (+${nf(x.alert.deltaPct, l)}%). The trigger is the level-${x.flood?.level ?? 3} flood warning in ${kecs.join(', ')}; the route to ${kecs[0] ?? ''} is affected by flooding (simulated). Orders affected: ${x.affected.count} (${rp(x.affected.value, l)}, simulated).`,
      }
    },
  },
  {
    id: 'compare_competitors',
    examples: ['bandingkan dengan pesaing', 'bagaimana posisi kita', 'compare with competitors', 'how do we compare', 'perbandingan kompetitor'],
    respond: (ctx) => {
      const x = W(ctx)
      const l = ctx.lang
      if (!x) return noAlert(l)
      const [me, ...rest] = x.competitors
      if (!me) return noAlert(l)
      const fast = [...x.competitors].filter((r) => r.medianReplyMin != null).sort((a, b) => a.medianReplyMin! - b.medianReplyMin!)[0]
      return {
        text:
          l === 'id'
            ? `Porsi percakapan toko ${me.share}% dari ${x.competitors.length} merek (7 hari), sentimen net ${me.net}, tingkat balas ${me.replyRate}%. ${rest.map((r) => `${r.label}: porsi ${r.share}%, net ${r.net}`).join('; ')}. Balasan tercepat dimiliki ${fast?.label ?? me.label}; mempercepat balasan adalah langkah paling cepat menaikkan skor, tanpa perlu membahas pesaing di publik.`
            : `The shop holds ${me.share}% of the conversation among ${x.competitors.length} brands (7 days), net sentiment ${me.net}, reply rate ${me.replyRate}%. ${rest.map((r) => `${r.label}: share ${r.share}%, net ${r.net}`).join('; ')}. ${fast?.label ?? me.label} replies fastest; replying faster is the quickest way to lift the score, with no need to talk about competitors in public.`,
      }
    },
  },
  {
    id: 'summarize_today',
    examples: ['ringkas hari ini', 'ringkasan untuk pemilik', 'apa yang terjadi hari ini', 'summarize today', 'summary for the owner', 'what happened today'],
    respond: (ctx) => {
      const x = W(ctx)
      const l = ctx.lang
      if (!x) return noAlert(l)
      const rep = x.kpi.reputation
      const d = rep - x.repYesterday
      const top = x.clusters.slice(0, 3).map((c) => c.label[l])
      return {
        text:
          l === 'id'
            ? `Skor reputasi ${rep}/100 (${d >= 0 ? '+' : '−'}${Math.abs(d)} dari kemarin, simulasi). ${x.alert ? `Lonjakan keluhan pengiriman sejak ${tm(x.alert.at, l)} karena banjir; ${x.affected.count} pesanan terdampak senilai ${rp(x.affected.value, l)}.` : 'Belum ada lonjakan keluhan.'} ${top.length ? `Masalah utama: ${top.join('; ')}.` : ''} Keluhan belum dibalas: ${x.kpi.unreplied}.`
            : `Reputation score ${rep}/100 (${d >= 0 ? '+' : '−'}${Math.abs(d)} vs yesterday, simulated). ${x.alert ? `Delivery complaint spike since ${tm(x.alert.at, l)} because of the flood; ${x.affected.count} orders affected, worth ${rp(x.affected.value, l)}.` : 'No complaint spike yet.'} ${top.length ? `Main issues: ${top.join('; ')}.` : ''} Unanswered complaints: ${x.kpi.unreplied}.`,
      }
    },
  },
]

const scenario: Scenario<BrandCtx> = {
  product: 'pantau-merek',
  intents,
  fallback: (ctx) => ({
    text:
      ctx.lang === 'id'
        ? `Saya bisa mengelompokkan keluhan, menjelaskan lonjakan, menyusun pengumuman atau balasan, membandingkan dengan pesaing, dan meringkas hari ini (jam dunia ${tm(clock.get().minutes, 'id')}).`
        : `I can group complaints, explain the spike, draft a notice or replies, compare with competitors and summarise today (world clock ${tm(clock.get().minutes, 'en')}).`,
    followUps: ctx.lang === 'id' ? ['Kenapa melonjak?', 'Bandingkan dengan pesaing', 'Ringkas hari ini'] : ['Why the spike?', 'Compare with competitors', 'Summarize today'],
  }),
}

let done = false
/** register once (lazy AI surfaces call it) */
export function ensureScenario(): void {
  if (done) return
  done = true
  registerScenario(scenario as Scenario)
  const CH = new Set(['marketplace', 'sosmed', 'ulasan-peta', 'wa-status', 'struk'])
  registerStructuredSchema('pantau-merek/announcement', {
    safeParse(v: unknown) {
      const d = v as { text?: unknown; channels?: unknown; offer?: unknown } | null
      if (!d || typeof d.text !== 'string' || d.text.length < 20 || d.text.length > 900) return { success: false }
      if (!Array.isArray(d.channels) || !d.channels.length || !d.channels.every((c) => typeof c === 'string' && CH.has(c))) return { success: false }
      if (d.offer != null && !OFFERS.includes(d.offer as Offer)) return { success: false }
      return { success: true, data: d }
    },
  })
}
