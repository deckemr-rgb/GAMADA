/**
 * demos/sinyal-pasar/scenario.ts — the simulated "Tanya Sinyal Pasar" assistant (registered by the lazy Assist
 * drawer). Every number comes from the context Assist builds out of world/pasar-daerah selectors (priceBoard,
 * priceOutlook, opSimulate, pdKpi), so the answer agrees with the screen. Intents: jelaskan_anomali → 'insight',
 * rekomendasi_aksi → 'sinyal-pasar/action-plan', pesan_umkm → 'sinyal-pasar/umkm-alert', ringkas_pasar → 'insight'.
 * Wording rotates (least recently used); each sentence names a commodity, a market or a number. No speculation or
 * hoarding advice; prices are simulated.
 */
import { registerScenario, registerStructuredSchema, type SimContext, type SimResponse } from '../../demo-kit/ai/chat'

type B = { id: string; en: string }
export interface SpCtx {
  product: 'sinyal-pasar'
  rows: { item: B; market: string; price: number; weekPct: number; deltaPct: number; anomaly: boolean }[]
  focus: {
    commodityId: string; item: B; market: string; marketIds: string[]; markets: string[]; price: number; deltaPct: number; peakPct: number; peakDay: number
    factors: { label: B; pct: number }[]; effectPct: number; afterPeakPct: number; costRp: number
  } | null
  warning: { commodityId: string; item: B; peakPct: number; peakInDays: number; market: string } | null
  anomalies: number
  warnings: number
  subscribers: number
  ops: { id: string; item: B; stage: B }[]
}
type L = 'id' | 'en'
type C = SimContext<SpCtx>
const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const pc = (v: number, l: L) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toLocaleString(l === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 })}%`
const used = new Map<string, number>()
const pick = <T,>(key: string, list: T[]): T => {
  const i = used.get(key) ?? 0
  used.set(key, i + 1)
  return list[i % list.length]!
}
const x = (c: C): SpCtx | null => (c.world && (c.world as SpCtx).product === 'sinyal-pasar' ? (c.world as SpCtx) : null)
const none = (l: L): SimResponse => ({ text: l === 'id' ? 'Data harga belum termuat. Coba lagi sebentar lagi.' : 'Price data has not loaded yet. Try again in a moment.' })

function explain(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const f = w.focus
  if (!f) return { text: l === 'id' ? 'Belum ada harga yang keluar dari pola musiman hari ini (simulasi).' : 'No price has left its seasonal pattern today (simulated).' }
  const factors = f.factors.map((k) => `${k.label[l]} ${pc(k.pct, l)}`).join(', ')
  const lead = pick('ex', l === 'id'
    ? [`${f.item.id} di ${f.market} sekarang ${rp(f.price)}, ${pc(f.deltaPct, l)} dari pola musiman.`, `Harga ${f.item.id.toLowerCase()} di ${f.market} (${rp(f.price)}) berada ${pc(f.deltaPct, l)} dari polanya.`]
    : [`${f.item.en} at ${f.market} is now ${rp(f.price)}, ${pc(f.deltaPct, l)} vs its seasonal pattern.`, `The ${f.item.en.toLowerCase()} price at ${f.market} (${rp(f.price)}) sits ${pc(f.deltaPct, l)} from its pattern.`])
  const tail = l === 'id' ? `Prakiraan puncak ${pc(f.peakPct, l)} pada hari +${f.peakDay}. Faktor: ${factors}. (proyeksi, simulasi)` : `Forecast peak ${pc(f.peakPct, l)} on day +${f.peakDay}. Factors: ${factors}. (projection, simulated)`
  const text = `${lead} ${tail}`
  return { text, structured: { kind: 'insight', data: { indicator: f.item[l], trend: f.deltaPct > 0 ? 'naik' : f.deltaPct < 0 ? 'turun' : 'stabil', explanation: text } } }
}

function plan(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const f = w.focus
  if (!f) return { text: l === 'id' ? 'Belum perlu tindakan: tidak ada anomali atau peringatan dini hari ini.' : 'No action needed yet: no anomaly or early warning today.' }
  const m = f.markets.join(', ')
  const actions = [
    { kind: 'operasi-pasar' as const, marketIds: f.marketIds, volumeTon: 10, days: 3, why: { id: `Operasi pasar 10 ton selama 3 hari di ${m} menurunkan puncak dari ${pc(f.peakPct, 'id')} ke ${pc(f.afterPeakPct, 'id')}.`, en: `A 10-tonne, 3-day market operation at ${m} lowers the peak from ${pc(f.peakPct, 'en')} to ${pc(f.afterPeakPct, 'en')}.` } },
    { kind: 'pantau-distributor' as const, marketIds: f.marketIds, why: { id: `Pantau stok distributor ${f.item.id.toLowerCase()} yang memasok ${m}.`, en: `Watch the stock of the ${f.item.en.toLowerCase()} distributors supplying ${m}.` } },
    { kind: 'imbauan' as const, marketIds: f.marketIds, why: { id: `Imbau ${w.subscribers} pelanggan UMKM belanja ${f.item.id.toLowerCase()} secukupnya untuk 5–7 hari.`, en: `Advise the ${w.subscribers} UMKM subscribers to buy ${f.item.en.toLowerCase()} for 5–7 days only.` } },
  ]
  const head = pick('pl', l === 'id' ? [`Tiga langkah untuk ${f.item.id.toLowerCase()}:`, `Rencana aksi ${f.item.id.toLowerCase()} (simulasi):`] : [`Three steps for ${f.item.en.toLowerCase()}:`, `Action plan for ${f.item.en.toLowerCase()} (simulated):`])
  const text = `${head}\n${actions.map((a, i) => `${i + 1}. ${a.why[l]}`).join('\n')}\n${l === 'id' ? `Efek harga ${pc(f.effectPct, l)}, subsidi ${rp(f.costRp)} (simulasi).` : `Price effect ${pc(f.effectPct, l)}, subsidy ${rp(f.costRp)} (simulated).`}`
  return { text, structured: { kind: 'sinyal-pasar/action-plan', data: { commodityId: f.commodityId, actions: actions.map((a) => ({ ...a, why: a.why[l] })), expectedEffectPct: f.effectPct } } }
}

function umkm(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const wr = w.warning
  if (!wr) return { text: l === 'id' ? 'Belum ada peringatan dini untuk diteruskan ke UMKM hari ini.' : 'There is no early warning to pass on to UMKM today.' }
  const text = pick('um', l === 'id'
    ? [`Harga ${wr.item.id.toLowerCase()} di ${wr.market} diperkirakan naik ${pc(wr.peakPct, l)} dalam ${wr.peakInDays} hari (simulasi).`, `Info Sinyal Pasar: ${wr.item.id.toLowerCase()} (${wr.market}) bisa naik ${pc(wr.peakPct, l)} dalam ${wr.peakInDays} hari, simulasi.`]
    : [`The ${wr.item.en.toLowerCase()} price at ${wr.market} is expected to rise ${pc(wr.peakPct, l)} within ${wr.peakInDays} days (simulated).`, `Sinyal Pasar notice: ${wr.item.en.toLowerCase()} (${wr.market}) may rise ${pc(wr.peakPct, l)} within ${wr.peakInDays} days, simulated.`])
  const advice = l === 'id' ? `Siapkan stok ${wr.item.id.toLowerCase()} secukupnya untuk 5–7 hari, jangan menimbun.` : `Stock ${wr.item.en.toLowerCase()} for 5–7 days only, do not hoard.`
  return { text: `${text}\n${advice}`, structured: { kind: 'sinyal-pasar/umkm-alert', data: { commodityId: wr.commodityId, peakInDays: wr.peakInDays, peakPct: wr.peakPct, text, advice } } }
}

function summary(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const top = w.rows.slice(0, 3).map((r) => `${r.item[l]} (${r.market}) ${pc(r.deltaPct, l)}`).join('; ')
  const ops = w.ops.length ? w.ops.map((o) => `${o.id} ${o.item[l].toLowerCase()} ${o.stage[l].toLowerCase()}`).join(', ') : l === 'id' ? 'belum ada' : 'none yet'
  const text = l === 'id'
    ? `${w.anomalies} anomali aktif, ${w.warnings} peringatan dini hari ini. Selisih terbesar dari pola: ${top}. Operasi pasar: ${ops}. (simulasi)`
    : `${w.anomalies} active anomalies, ${w.warnings} early warnings today. Largest gaps to the pattern: ${top}. Market operations: ${ops}. (simulated)`
  return { text, structured: { kind: 'insight', data: { indicator: l === 'id' ? 'Harga bahan pokok' : 'Staple prices', trend: w.anomalies ? 'naik' : 'stabil', explanation: text } } }
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
let done = false
export function registerSpScenario(): void {
  if (done) return
  done = true
  registerStructuredSchema('sinyal-pasar/action-plan', { safeParse: (v) => (obj(v) && typeof v.commodityId === 'string' && Array.isArray(v.actions) && typeof v.expectedEffectPct === 'number' ? { success: true, data: v } : { success: false }) })
  registerStructuredSchema('sinyal-pasar/umkm-alert', { safeParse: (v) => (obj(v) && typeof v.commodityId === 'string' && typeof v.peakPct === 'number' && typeof v.text === 'string' && typeof v.advice === 'string' ? { success: true, data: v } : { success: false }) })
  registerScenario<SpCtx>({
    product: 'sinyal-pasar',
    intents: [
      { id: 'jelaskan_anomali', examples: ['jelaskan anomali', 'kenapa harga cabai naik', 'harga apa yang tidak wajar', 'explain the anomaly', 'why is the price up', 'regane kok mundhak'], respond: explain },
      { id: 'rekomendasi_aksi', examples: ['rekomendasi aksi', 'apa yang harus dilakukan', 'perlu operasi pasar', 'recommend an action', 'what should we do', 'kudu piye'], respond: plan },
      { id: 'pesan_umkm', examples: ['pesan untuk UMKM', 'tulis imbauan ke pedagang', 'peringatan untuk toko', 'message for UMKM', 'draft the shop alert', 'kabar kanggo bakul'], respond: umkm },
      { id: 'ringkas_pasar', examples: ['ringkas pasar', 'ringkasan harga hari ini', 'kondisi pasar', 'summarise the market', 'market summary today', 'piye pasar dina iki'], respond: summary },
    ],
    fallback: (c) => ({
      text: c.lang === 'id'
        ? 'Saya bisa menjelaskan anomali harga, menyarankan tindakan, menulis pesan untuk UMKM, atau meringkas pasar hari ini. Pilih salah satu tombol di atas.'
        : 'I can explain a price anomaly, recommend actions, write a message for UMKM or summarise today’s market. Pick one of the buttons above.',
    }),
  })
}
