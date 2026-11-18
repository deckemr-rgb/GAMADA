/**
 * demos/juara-jualan/scenario.ts — the simulated QA assistant ("Tanya QA", lazy; registered by AskQa, never by the
 * page): 11 intents + fallback. Every number comes from the world selectors via `qaCtx` (same as the screen). Structured
 * kinds: 'score' (shared score_call, criteria 0–5 + evidence) and 'juara-jualan/draft_coaching' (3 focus areas).
 */
import { registerScenario, registerStructuredSchema, type Intent, type SimContext, type SimResponse } from '../../demo-kit/ai/chat'
import { DAY_MIN, rows, world, type Bi, type CriterionKey, type Industry, type WorldState } from '../../demo-kit/world'
import { CALL_CRITERIA, CALL_FLAG, CRITERIA_KEYS, IND_SHORT, callDetail, salesKpi, teamBoard, weakest } from '../../demo-kit/world/usaha-pintar'
import { buildClip, clipLibNow } from './clips'
import { exampleOf, focusOf } from './coach-text'

type L = 'id' | 'en'
const IND_LABEL: Record<Industry, Bi> = { 'toko-bangunan': { id: 'Toko Bangunan', en: 'Building supplies' }, multifinance: { id: 'Multifinance', en: 'Multifinance' }, asuransi: { id: 'Asuransi', en: 'Insurance' } }

export interface QaCtx {
  product: 'juara-jualan'
  mode: 'qa'
  industry: Industry
  now: number
  kpi: { today: number; avgScore: number | null; needCoaching: number; breaches: number }
  board: { id: string; name: string; avg14: number | null; delta7: number; rank: number; weakest: CriterionKey[] }[]
  lowest: { id: string; agent: string; score: number; flags: string[] } | null
  flags14: { flag: string; n: number }[]
  week: { last7: number | null; prev7: number | null }
  teams: { industry: Industry; avg: number | null }[]
  call: { id: string; agent: string; agentId: string; score: number | null; criteria: Record<CriterionKey, number> | null; flags: string[]; weak: CriterionKey | null; transcript: string[]; fix: string[] } | null
}

const avg = (l: number[]) => (l.length ? Math.round(l.reduce((a, x) => a + x, 0) / l.length) : null)

/** the QA context from the world (also what Live receives, compact) */
export function qaCtx(s: WorldState, now: number, ind: Industry, callId: string | null): QaCtx {
  const board = teamBoard(s, now, ind)
  const today = rows(s.calls).filter((c) => c.industry === ind && c.at >= 0 && c.at <= now && c.score !== null).sort((a, b) => a.score! - b.score!)
  const low = today[0]
  const from = now - 14 * DAY_MIN
  const recent = rows(s.calls).filter((c) => c.industry === ind && c.at > from && c.at <= now)
  const fc = new Map<string, number>()
  for (const c of recent) for (const f of c.flags) fc.set(f, (fc.get(f) ?? 0) + 1)
  const scored = (a: number, b: number) => recent.filter((c) => c.score !== null && c.at > now - a * DAY_MIN && c.at <= now - b * DAY_MIN).map((c) => c.score!)
  const d = callId ? callDetail(s, callId) : null
  let call: QaCtx['call'] = null
  if (d) {
    const lib = clipLibNow(d.call.industry)
    const clip = lib ? buildClip(s, d.call, lib) : null
    call = {
      id: d.call.id, agent: d.agent?.name ?? '', agentId: d.call.agentId, score: d.call.score, criteria: d.call.criteria, flags: d.call.flags, weak: d.clip?.weak ?? null,
      transcript: clip ? clip.segments.map((x, i) => `${clip.lines[i]!.sp === 'a' ? 'Agen' : 'Pelanggan'}: ${x.text}`) : [],
      fix: clip ? clip.lines.filter((l) => l.fix).map((l) => l.fix!.id) : [],
    }
  }
  return {
    product: 'juara-jualan', mode: 'qa', industry: ind, now,
    kpi: salesKpi(s, now, ind),
    board: board.map((r) => ({ id: r.agent.id, name: r.agent.name, avg14: r.avg14, delta7: r.delta7, rank: r.rank, weakest: weakest(r.radar, 3) })),
    lowest: low ? { id: low.id, agent: s.agentsSales.byId[low.agentId]?.name ?? '', score: low.score!, flags: low.flags } : null,
    flags14: [...fc.entries()].map(([flag, n]) => ({ flag, n })).sort((a, b) => b.n - a.n || a.flag.localeCompare(b.flag)),
    week: { last7: avg(scored(7, 0)), prev7: avg(scored(14, 7)) },
    teams: (['toko-bangunan', 'multifinance', 'asuransi'] as Industry[]).map((i) => ({ industry: i, avg: salesKpi(s, now, i).avgScore })),
    call,
  }
}

type Ctx = SimContext<QaCtx>
const x = (ctx: Ctx): QaCtx | null => ((ctx.world as QaCtx | null)?.product === 'juara-jualan' ? (ctx.world as QaCtx) : null)
const crit = (k: CriterionKey, l: L) => CALL_CRITERIA[k][l]
const flag = (f: string, l: L) => CALL_FLAG[f]?.[l] ?? f
const noData = (l: L): SimResponse => ({ text: l === 'id' ? 'Data tim belum termuat. Coba lagi sebentar lagi.' : 'Team data has not loaded yet. Please try again in a moment.' })
const noCall = (l: L): SimResponse => ({ text: l === 'id' ? 'Buka satu percakapan di tab Percakapan dulu, lalu tanyakan lagi.' : 'Open a conversation in the Conversations tab first, then ask again.' })

/** the coaching draft for an agent (3 weakest criteria, focus + example) */
function draftFor(c: QaCtx, agentId: string): SimResponse['structured'] {
  const r = c.board.find((b) => b.id === agentId)
  const a = world.get().agentsSales.byId[agentId]
  if (!r || !a) return undefined
  return { kind: 'juara-jualan/draft_coaching', data: { agentId, focus: r.weakest.map((k) => ({ key: k, title: focusOf(k).id, example: exampleOf(k, a).id, titleEn: focusOf(k).en, exampleEn: exampleOf(k, a).en })) } }
}

const PRICE_ANSWER: Record<Industry, Bi> = {
  'toko-bangunan': {
    id: '“Wajar dibandingkan, Pak. Bedanya, kami antar gratis dalam kota, bayar setelah barang sampai, dan stok kami tahan sampai hari cor. Untuk 50 sak ke atas ada harga grosir.”',
    en: '“It is fair to compare, sir. The difference: free delivery in town, payment on arrival, and we hold the stock until pour day. From 50 bags there is a wholesale price.”',
  },
  multifinance: {
    id: '“Saya paham angsurannya terasa berat. Bandingkan total biayanya, bukan hanya angsuran: punya kami tertulis tanpa biaya tambahan, dan tenornya bisa dibuat lebih panjang supaya lebih ringan.”',
    en: '“I understand the instalment feels heavy. Compare the total cost, not just the instalment: ours is in writing with no extra fees, and a longer tenor makes it lighter.”',
  },
  asuransi: {
    id: '“Betul preminya naik. Penyebabnya nilai kendaraan dan klaim di wilayah ini; kalau Bapak mau, ada opsi risiko sendiri supaya premi turun, manfaat utamanya tetap.”',
    en: '“Yes, the premium went up, because of the vehicle value and claims in this area; if you like, an own-risk option lowers the premium and keeps the main cover.”',
  },
}

const intents: Intent<QaCtx>[] = [
  {
    id: 'skor-terendah-hari-ini',
    examples: ['skor terendah hari ini', 'percakapan paling jelek hari ini', 'siapa skor paling rendah', 'lowest score today', 'worst call today'],
    respond: (ctx) => {
      const c = x(ctx)
      if (!c) return noData(ctx.lang)
      const l = c.lowest
      if (!l) return { text: ctx.lang === 'id' ? 'Belum ada percakapan yang dinilai hari ini.' : 'No conversation has been scored today yet.' }
      const f = l.flags[0] ? flag(l.flags[0], ctx.lang) : ctx.lang === 'id' ? 'tanpa tanda' : 'no flag'
      return {
        text: ctx.lang === 'id' ? `Skor terendah hari ini (${IND_LABEL[c.industry].id}): ${l.id} oleh ${l.agent}, skor ${l.score}/100, tanda: ${f}. Buka di tab Percakapan, klik penanda merah untuk loncat ke momennya.` : `Lowest score today (${IND_LABEL[c.industry].en}): ${l.id} by ${l.agent}, ${l.score}/100, flag: ${f}. Open it in Conversations and click the red marker to jump to the moment.`,
        toolCalls: [{ name: 'baca_skor_hari_ini', input: { industri: IND_SHORT[c.industry] }, output: { id: l.id, skor: l.score } }],
      }
    },
  },
  {
    id: 'agen-paling-perlu-coaching',
    examples: ['agen paling perlu coaching', 'siapa yang harus dilatih', 'siapa perlu coaching', 'who needs coaching most', 'which agent needs coaching'],
    respond: (ctx) => {
      const c = x(ctx)
      if (!c) return noData(ctx.lang)
      const r = [...c.board].sort((a, b) => (a.avg14 ?? 999) - (b.avg14 ?? 999))[0]
      if (!r) return noData(ctx.lang)
      const w = r.weakest.map((k) => crit(k, ctx.lang)).join(', ')
      return {
        text: ctx.lang === 'id' ? `${r.name} paling perlu coaching: rata-rata 14 hari ${r.avg14 ?? '–'} (peringkat ${r.rank} dari ${c.board.length}). Tiga kriteria terlemah: ${w}. Draf kartu coaching di bawah bisa langsung dikirim.` : `${r.name} needs coaching most: 14-day average ${r.avg14 ?? '–'} (rank ${r.rank} of ${c.board.length}). Three weakest criteria: ${w}. The coaching card draft below can be sent right away.`,
        structured: draftFor(c, r.id),
      }
    },
  },
  {
    id: 'kenapa-skor-rendah',
    examples: ['kenapa skornya rendah', 'kenapa percakapan ini rendah', 'apa masalahnya', 'why is the score low', 'why did this call score low'],
    respond: (ctx) => {
      const c = x(ctx)
      if (!c) return noData(ctx.lang)
      if (!c.call) return noCall(ctx.lang)
      const k = c.call.weak
      const cr = c.call.criteria
      const low = cr ? [...CRITERIA_KEYS].sort((a, b) => cr[a] - cr[b]).slice(0, 2) : k ? [k] : []
      const lines = low.map((q) => `${crit(q, ctx.lang)}${cr ? ` ${cr[q]}` : ''}`).join(', ')
      return {
        text: ctx.lang === 'id' ? `${c.call.id} (${c.call.agent}) rendah terutama di ${lines}. ${c.call.fix[0] ?? ''}` : `${c.call.id} (${c.call.agent}) is low mainly on ${lines}. The red moment on the recording shows where it went wrong; the fix is listed under the criterion.`,
      }
    },
  },
  {
    id: 'keberatan-tersering',
    examples: ['keberatan tersering', 'masalah paling sering 14 hari', 'tanda yang paling sering muncul', 'most common objection', 'most frequent issue in 14 days'],
    respond: (ctx) => {
      const c = x(ctx)
      if (!c) return noData(ctx.lang)
      const top = c.flags14.slice(0, 3)
      if (!top.length) return { text: ctx.lang === 'id' ? 'Tidak ada tanda masalah dalam 14 hari terakhir.' : 'No issue flags in the last 14 days.' }
      const list = top.map((t) => `${flag(t.flag, ctx.lang)} (${t.n}×)`).join(', ')
      return { text: ctx.lang === 'id' ? `Dalam 14 hari terakhir di ${IND_LABEL[c.industry].id}, tanda yang paling sering: ${list}.` : `In the last 14 days in ${IND_LABEL[c.industry].en}, the most frequent flags: ${list}.` }
    },
  },
  {
    id: 'bandingkan-tim',
    examples: ['bandingkan tim', 'tim mana paling bagus', 'perbandingan industri', 'compare the teams', 'which team is best'],
    respond: (ctx) => {
      const c = x(ctx)
      if (!c) return noData(ctx.lang)
      const list = c.teams.map((t) => `${IND_LABEL[t.industry][ctx.lang]} ${t.avg ?? '–'}`).join(' · ')
      return { text: ctx.lang === 'id' ? `Rata-rata skor hari ini per tim: ${list}.` : `Average score today per team: ${list}.` }
    },
  },
  {
    id: 'tren-minggu-ini',
    examples: ['tren minggu ini', 'skor minggu ini naik atau turun', 'perkembangan tim', 'trend this week', 'is the team improving'],
    respond: (ctx) => {
      const c = x(ctx)
      if (!c) return noData(ctx.lang)
      const { last7, prev7 } = c.week
      if (last7 === null || prev7 === null) return { text: ctx.lang === 'id' ? 'Data 14 hari belum cukup untuk tren.' : 'Not enough data in 14 days for a trend.' }
      const dlt = last7 - prev7
      const dir = ctx.lang === 'id' ? (dlt > 0 ? 'naik' : dlt < 0 ? 'turun' : 'stabil') : dlt > 0 ? 'up' : dlt < 0 ? 'down' : 'flat'
      return { text: ctx.lang === 'id' ? `Rata-rata 7 hari terakhir ${last7}, 7 hari sebelumnya ${prev7}: ${dir} ${Math.abs(dlt)} poin.` : `Last 7 days average ${last7}, the 7 days before ${prev7}: ${dir} ${Math.abs(dlt)} points.` }
    },
  },
  {
    id: 'contoh-jawab-keberatan-harga',
    examples: ['contoh jawab keberatan harga', 'bagaimana menjawab kalau pelanggan bilang mahal', 'kalau pelanggan bilang mahal', 'how to answer a price objection', 'customer says too expensive'],
    respond: (ctx) => {
      const c = x(ctx)
      if (!c) return noData(ctx.lang)
      return { text: ctx.lang === 'id' ? `Contoh untuk ${IND_LABEL[c.industry].id}: ${PRICE_ANSWER[c.industry].id} Intinya: akui, jelaskan nilai, tawarkan satu opsi; jangan langsung diskon.` : `Example for ${IND_LABEL[c.industry].en}: ${PRICE_ANSWER[c.industry].en} In short: acknowledge, explain the value, offer one option; no instant discount.` }
    },
  },
  {
    id: 'arti-kriteria-kepatuhan',
    examples: ['apa arti kepatuhan skrip', 'kepatuhan skrip itu apa', 'pelanggaran skrip maksudnya', 'what is script compliance', 'what counts as a script breach'],
    respond: (ctx) => ({
      text:
        ctx.lang === 'id'
          ? 'Kepatuhan skrip (bobot 10) menilai kejujuran: tidak menjanjikan hasil (“pasti disetujui”, “dijamin”, “100 %”), tidak menekan, dan menyebut syarat atau biaya dengan benar. Janji berlebihan dihitung sebagai pelanggaran skrip.'
          : 'Script compliance (weight 10) rates honesty: no promised outcomes (“definitely approved”, “guaranteed”, “100 %”), no pressure, and conditions and costs stated correctly. Over-promising counts as a script breach.',
    }),
  },
  {
    id: 'ringkas-panggilan-ini',
    examples: ['ringkas panggilan ini', 'ringkasan percakapan ini', 'nilai percakapan ini', 'summarise this call', 'score this conversation'],
    respond: (ctx) => {
      const c = x(ctx)
      if (!c) return noData(ctx.lang)
      if (!c.call) return noCall(ctx.lang)
      const cr = c.call.criteria
      const data = cr
        ? { criteria: CRITERIA_KEYS.map((k) => ({ id: k === 'gali' ? 'gali-kebutuhan' : k === 'kepatuhan' ? 'kepatuhan-skrip' : k, score: Math.round(cr[k] / 20), evidence: c.call!.transcript[0]?.slice(0, 120) ?? '' })), total: c.call.score ?? 0, coaching: c.call.fix.slice(0, 3) }
        : null
      return {
        text: ctx.lang === 'id' ? `${c.call.id} · ${c.call.agent}: ${c.call.transcript.length} giliran, skor ${c.call.score ?? 'belum dinilai'}${c.call.flags[0] ? `, tanda ${flag(c.call.flags[0], 'id')}` : ''}.` : `${c.call.id} · ${c.call.agent}: ${c.call.transcript.length} turns, score ${c.call.score ?? 'not scored yet'}${c.call.flags[0] ? `, flag ${flag(c.call.flags[0], 'en')}` : ''}.`,
        ...(data ? { structured: { kind: 'score', data } } : {}),
      }
    },
  },
  {
    id: 'buat-kartu-coaching',
    examples: ['buat kartu coaching', 'draf coaching untuk agen ini', 'susun coaching', 'draft a coaching card', 'make a coaching plan'],
    respond: (ctx) => {
      const c = x(ctx)
      if (!c) return noData(ctx.lang)
      const id = c.call?.agentId ?? [...c.board].sort((a, b) => (a.avg14 ?? 999) - (b.avg14 ?? 999))[0]?.id
      const r = c.board.find((b) => b.id === id)
      if (!id || !r) return noData(ctx.lang)
      return { text: ctx.lang === 'id' ? `Draf kartu coaching untuk ${r.name} (baseline ${r.avg14 ?? '–'}). Tekan “Buka dialog coaching” untuk memeriksa lalu mengirim.` : `Coaching card draft for ${r.name} (baseline ${r.avg14 ?? '–'}). Press “Open the coaching dialog” to check and send it.`, structured: draftFor(c, id) }
    },
  },
  {
    id: 'mulai-latihan',
    examples: ['mulai latihan', 'saya mau latihan roleplay', 'ajak saya latihan', 'start a practice', 'let me practise a roleplay'],
    respond: (ctx) => ({
      text: ctx.lang === 'id' ? 'Latihan roleplay ada di tab Latihan: pilih persona (ragu harga, buru-buru, banyak tanya), balas minimal 6 giliran, lalu skor dibandingkan dengan baseline Anda.' : 'Roleplay practice lives in the Practice tab: pick a persona (price-hesitant, in a hurry, many questions), answer at least 6 turns, then your score is compared with your baseline.',
    }),
  },
]

registerScenario<QaCtx>({
  product: 'juara-jualan',
  intents,
  fallback: (ctx) => ({
    text: ctx.lang === 'id' ? 'Saya bisa menjawab soal skor, tim, keberatan, tren, kepatuhan skrip, kartu coaching, dan latihan. Coba salah satu pertanyaan cepat.' : 'I can answer about scores, the team, objections, trends, script compliance, coaching cards and practice. Try one of the quick questions.',
    followUps: ctx.lang === 'id' ? ['Skor terendah hari ini?', 'Siapa paling perlu coaching?', 'Contoh jawab keberatan harga'] : ['Lowest score today?', 'Who needs coaching most?', 'How to answer a price objection'],
  }),
})

/** the product-owned kind (Live: proxy tool draft_coaching) — accepted only with 3 known criteria */
registerStructuredSchema('juara-jualan/draft_coaching', {
  safeParse(v: unknown) {
    const d = v as { focus?: { key?: string; title?: string; example?: string }[] }
    const ok = !!d && Array.isArray(d.focus) && d.focus.length === 3 && d.focus.every((f) => typeof f?.title === 'string' && typeof f?.example === 'string' && CRITERIA_KEYS.includes(f.key as CriterionKey))
    return ok ? { success: true, data: v } : { success: false }
  },
})
