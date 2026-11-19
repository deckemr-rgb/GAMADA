/**
 * demos/rapor-usaha/scenario.ts — "Tanya skor" (owner) + "Ringkas pengajuan" (analyst) simulation. Every number comes
 * from RuContext (world selectors: raporOf, scoreActions, loanOffer, loanAdvice, consents), so the answer equals the
 * screens. Rules: only context numbers, scores are SIMULATED, never promise approval ("keputusan tetap di koperasi").
 * Registered by the lazy AI surfaces (Ask.tsx, Brief.tsx), never by the page.
 */
import type { Intent, Lang, Scenario, SimContext, SimResponse } from '../../demo-kit/ai/types'
import { registerScenario } from '../../demo-kit/ai/chat'
import type { Bi, WorldState } from '../../demo-kit/world'
import { CONSENT_SCOPE, LOAN, SCORE_BANDS, SCORE_FACTOR, loanAdvice, netProfitAvg } from '../../demo-kit/world/pasar-daerah'
import { LENDER, actionsM, jt, offerM, ownLoan, pctText, raporM, rateText, rp } from './model'
import { consentState } from './consent'

export interface RuContext {
  shop: string
  score: number
  band: Bi
  delta: number
  prevScore: number
  peer: number
  factors: { key: string; label: Bi; points: number; evidence: Bi }[]
  actions: { key: string; gain: number; kind: string }[]
  offer: { plafon: number; ratePct: number; inst12: number; dsr: number; net: number; next: { min: number; plafon: number } | null; eligible: boolean }
  consent: { scopes: string[]; revoked: boolean; days: number | null }
  loan: { id: string; status: string; amount: number; tenor: number } | null
  brief: LoanBrief | null
}
export interface LoanBrief { loanId: string; business: string; rec: 'setujui' | 'setujui-bersyarat' | 'tinjau-manual'; strengths: Bi[]; risks: Bi[]; maxAmount: number; scoreNow: number; amount: number }

/** the loan brief from loanAdvice + the business's data (fair wording: business data only) */
export function loanBrief(s: WorldState, loanId: string): LoanBrief | null {
  const l = s.loanApps.byId[loanId]
  const b = l ? s.businesses.byId[l.businessId] : undefined
  const adv = loanAdvice(s, loanId)
  if (!l || !b || !adv) return null
  const sc = s.bizScores.byId[b.id]
  const f = sc?.factors
  const net = netProfitAvg(s, b.id)
  const strengths: Bi[] = []
  const risks: Bi[] = []
  if (b.verified) strengths.push({ id: 'Lolos verifikasi KYB', en: 'Passed the KYB check' })
  else risks.push({ id: 'Belum lolos KYB: minta verifikasi sebelum memutus', en: 'No KYB yet: request the check before deciding' })
  if (f && f.omzet >= 0.7) strengths.push({ id: `Omzet stabil (${pctText(f.omzet, 'id')})`, en: `Stable turnover (${pctText(f.omzet, 'en')})` })
  else if (f) risks.push({ id: `Omzet kurang stabil (${pctText(f.omzet, 'id')})`, en: `Uneven turnover (${pctText(f.omzet, 'en')})` })
  if (f && f.supplier >= 0.8) strengths.push({ id: `Bayar pemasok tepat waktu ${pctText(f.supplier, 'id')}`, en: `Pays suppliers on time ${pctText(f.supplier, 'en')}` })
  else if (f) risks.push({ id: `Tagihan pemasok tepat waktu baru ${pctText(f.supplier, 'id')}`, en: `Only ${pctText(f.supplier, 'en')} of supplier bills on time` })
  if (b.taxTidy) strengths.push({ id: 'Pajak rapi', en: 'Tax in order' })
  else risks.push({ id: 'Pajak belum rapi', en: 'Tax not in order yet' })
  const inst = l.installment ?? 0
  const ratio = net > 0 && inst ? inst / net : 0
  if (ratio && ratio <= LOAN.dsrMax) strengths.push({ id: `Cicilan ${pctText(ratio, 'id')} dari laba bersih`, en: `Instalment ${pctText(ratio, 'en')} of net profit` })
  else if (ratio) risks.push({ id: `Cicilan ${pctText(ratio, 'id')} dari laba bersih (di atas 35%)`, en: `Instalment ${pctText(ratio, 'en')} of net profit (above 35%)` })
  if (l.amount > adv.maxAmount) risks.push({ id: `Jumlah di atas plafon simulasi ${jt(adv.maxAmount, 'id')}`, en: `Amount above the simulated limit ${jt(adv.maxAmount, 'en')}` })
  const pad: Bi[] = [
    { id: 'Riwayat pinjaman di koperasi belum ada', en: 'No loan history at the cooperative yet' },
    { id: 'Skor dihitung dari data 12 bulan terakhir', en: 'Score built from the last 12 months of data' },
    { id: 'Data yang tidak dibagikan tidak ikut dinilai', en: 'Data not shared is not part of the assessment' },
  ]
  while (strengths.length < 3) strengths.push(pad[strengths.length % 3]!)
  while (risks.length < 3) risks.push(pad[(risks.length + 1) % 3]!)
  return { loanId, business: b.name, rec: adv.rec, strengths: strengths.slice(0, 3), risks: risks.slice(0, 3), maxAmount: adv.maxAmount, scoreNow: adv.scoreNow, amount: l.amount }
}

export function ruContext(s: WorldState, now: number, loanId?: string | null): RuContext {
  const shop = s.meta.shopId
  const r = raporM(s, shop)!
  const o = offerM(s, shop)
  const cs = consentState(s, now)
  const loan = ownLoan(s)
  return {
    shop: s.businesses.byId[shop]?.name ?? '',
    score: r.score,
    band: SCORE_BANDS[r.band]!.label,
    delta: r.deltaMonth,
    prevScore: r.score - r.deltaMonth,
    peer: r.peerScore,
    factors: r.factors.map((f) => ({ key: f.key, label: SCORE_FACTOR[f.key].label, points: f.contribution, evidence: f.evidence })),
    actions: actionsM(s, shop).map((a) => ({ key: a.key, gain: a.gain, kind: a.kind })),
    offer: { plafon: o.plafon, ratePct: o.ratePct, inst12: o.installment(o.plafon, 12), dsr: o.dsr, net: o.netProfit, next: o.nextBand && o.nextBand.plafon > o.plafon ? { min: o.nextBand.min, plafon: o.nextBand.plafon } : null, eligible: o.eligible },
    consent: { scopes: cs.active?.scopes ?? [], revoked: cs.revoked, days: cs.active?.days ?? null },
    loan: loan ? { id: loan.id, status: loan.status, amount: loan.amount, tenor: loan.tenorMonths } : null,
    brief: loanId ? loanBrief(s, loanId) : null,
  }
}

type Ctx = SimContext<RuContext>
const T = (lang: Lang, id: string, en: string) => (lang === 'id' ? id : en)
const L2 = (lang: Lang): 'id' | 'en' => (lang === 'id' ? 'id' : 'en')
const END = { id: 'Skor dan angka ini simulasi, bukan keputusan kredit.', en: 'These scores and numbers are simulated, not a credit decision.' }
const end = (lang: Lang, text: string) => `${text}\n\n${END[L2(lang)]}`
const sgn = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`
const CHIP = {
  turun: { id: 'Kenapa skor saya turun?', en: 'Why did my score drop?' },
  naik: { id: 'Bagaimana cara menaikkan skor?', en: 'How do I raise my score?' },
  pajak: { id: 'Apa pengaruh pajak ke skor?', en: 'How does tax affect my score?' },
  plafon: { id: 'Berapa plafon saya?', en: 'What is my limit?' },
  kenapa: { id: 'Kenapa plafonnya segitu?', en: 'Why is my limit that amount?' },
  cicilan: { id: 'Berapa cicilannya?', en: 'What is the instalment?' },
  data: { id: 'Data apa yang dibagikan?', en: 'Which data is shared?' },
  cabut: { id: 'Bagaimana mencabut akses?', en: 'How do I revoke access?' },
  pasti: { id: 'Apakah pasti disetujui?', en: 'Will it surely be approved?' },
}
const chips = (lang: Lang, ...keys: (keyof typeof CHIP)[]) => keys.map((k) => CHIP[k][L2(lang)])
const ACTION_TEXT: Record<string, Bi> = {
  'rapikan-jurnal': { id: 'Rapikan jurnal yang perlu ditinjau (kartu "Rapikan jurnal")', en: 'Tidy the journal entries that need review (the "Tidy" card)' },
  'pajak-siap': { id: 'Siapkan pajak bulan ini di Pajak Beres', en: 'Get this month’s tax ready in Pajak Beres' },
  kyb: { id: 'Selesaikan verifikasi KYB di Kenal Mitra', en: 'Finish the KYB check in Kenal Mitra' },
  'stok-aman': { id: 'Kirim PO tepat waktu di Toko Autopilot', en: 'Send POs on time in Toko Autopilot' },
  'bayar-supplier': { id: 'Bayar pemasok sebelum jatuh tempo', en: 'Pay suppliers before the due date' },
}
const actionLines = (w: RuContext, lang: Lang) =>
  w.actions.map((a) => `- ${ACTION_TEXT[a.key]?.[L2(lang)] ?? a.key}: ${a.kind === 'langsung' ? T(lang, `+${a.gain} poin`, `+${a.gain} pts`) : T(lang, `perkiraan +${a.gain} saat tutup buku`, `about +${a.gain} at the book close`)}`).join('\n')

/** the shared business-score card from the world's own numbers */
export function scoreCard(w: RuContext, lang: Lang) {
  const l = L2(lang)
  const sorted = [...w.factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 4)
  return {
    kind: 'business-score',
    data: {
      score: w.score,
      drivers: sorted.map((f) => ({ name: f.label[l], direction: f.points >= 0 ? ('naik' as const) : ('turun' as const), note: f.evidence[l].slice(0, 200) })),
      actions: w.actions.map((a) => (ACTION_TEXT[a.key]?.[l] ?? a.key).slice(0, 200)).slice(0, 3),
    },
  }
}

const I = (id: string, examples: string[], respond: (ctx: Ctx) => SimResponse): Intent<RuContext> => ({ id, examples, respond })

const INTENTS: Intent<RuContext>[] = [
  I('kenapa-turun', ['kenapa skor saya turun', 'skor turun kenapa', 'kok skornya turun', 'why did my score drop', 'why is my score lower', 'kenging menapa skor kula mudhun'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const worst = [...w.factors].sort((a, b) => a.points - b.points)[0]!
    const text = T(
      L,
      `Skor ${w.shop} sekarang ${w.score} (${w.band.id}), ${sgn(w.delta)} dibanding tutup buku bulan lalu (${w.prevScore}).\n- Penurun terbesar: ${worst.label.id} ${sgn(worst.points)} poin. ${worst.evidence.id}.\n- Median toko sejenis ${w.peer}; faktor lain menaikkan skor di atas median.`,
      `${w.shop}'s score is ${w.score} (${w.band.en}) now, ${sgn(w.delta)} vs last month's book close (${w.prevScore}).\n- Biggest drag: ${worst.label.en} ${sgn(worst.points)} pts. ${worst.evidence.en}.\n- Peer median ${w.peer}; the other factors lift the score above it.`,
    )
    return { text: end(L, text), structured: scoreCard(w, L), followUps: chips(L, 'naik', 'pajak', 'plafon') }
  }),
  I('cara-naik', ['bagaimana cara menaikkan skor', 'cara naik skor', 'gimana biar skor naik', 'how do I raise my score', 'how to improve the score', 'piye carane skor munggah'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    return { text: end(L, T(L, `Tiga cara yang paling berpengaruh sekarang:\n${actionLines(w, L)}`, `The three steps that matter most now:\n${actionLines(w, L)}`)), structured: scoreCard(w, L), followUps: chips(L, 'pajak', 'plafon') }
  }),
  I('faktor-pajak', ['apa pengaruh pajak ke skor', 'faktor pajak', 'kenapa pajak menurunkan skor', 'how does tax affect my score', 'tax factor', 'pajek pengaruhe apa'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const f = w.factors.find((x) => x.key === 'pajak')!
    const gain = w.actions.filter((a) => a.key === 'rapikan-jurnal' || a.key === 'pajak-siap').reduce((a, x) => a + x.gain, 0)
    return {
      text: end(L, T(L, `Kepatuhan pajak menyumbang ${sgn(f.points)} poin dibanding median. ${f.evidence.id}. Merapikan jurnal dan menyiapkan pajak bulan ini bisa menambah sekitar ${gain} poin; faktor ini diperbarui langsung.`, `Tax compliance adds ${sgn(f.points)} pts vs the median. ${f.evidence.en}. Tidying the journals and getting this month's tax ready can add about ${gain} pts; this factor updates live.`)),
      followUps: chips(L, 'naik', 'plafon'),
    }
  }),
  I('berapa-plafon', ['berapa plafon saya', 'bisa pinjam berapa', 'limit pinjaman', 'what is my limit', 'how much can I borrow', 'saged nyilih pinten'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const o = w.offer
    if (!o.eligible) return { text: end(L, T(L, 'Dengan skor sekarang belum ada plafon modal kerja. Naikkan skor ke 550 atau lebih dulu.', 'There is no working-capital limit at the current score. Raise it to 550 or more first.')), followUps: chips(L, 'naik') }
    const next = o.next ? T(L, ` Capai ${o.next.min} untuk plafon ${jt(o.next.plafon, 'id')}.`, ` Reach ${o.next.min} for a ${jt(o.next.plafon, 'en')} limit.`) : ''
    return { text: end(L, T(L, `Plafon simulasi Anda ${jt(o.plafon, 'id')} di ${LENDER}, bunga flat ${rateText(o.ratePct, 'id')}/bulan.${next}`, `Your simulated limit is ${jt(o.plafon, 'en')} at ${LENDER}, flat rate ${rateText(o.ratePct, 'en')}/month.${next}`)), followUps: chips(L, 'kenapa', 'cicilan', 'pasti') }
  }),
  I('kenapa-plafon', ['kenapa plafonnya segitu', 'plafon dihitung dari apa', 'rumus plafon', 'why is my limit that amount', 'how is the limit computed', 'plafon saka ngendi'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const o = w.offer
    return {
      text: end(L, T(L, `Plafon = laba bersih rata-rata Sep–Okt (${jt(o.net, 'id')}) × pengali pita skor ${w.band.id}, dibulatkan ke bawah per Rp 5 jt dan dibatasi kebijakan koperasi; hasilnya ${jt(o.plafon, 'id')}. Cicilan dijaga paling banyak 35% dari laba bersih.`, `Limit = average Sep–Oct net profit (${jt(o.net, 'en')}) × the ${w.band.en} band multiplier, rounded down to Rp 5 M and capped by the cooperative's policy; that gives ${jt(o.plafon, 'en')}. The instalment stays at most 35% of net profit.`)),
      followUps: chips(L, 'cicilan', 'naik'),
    }
  }),
  I('berapa-cicilan', ['berapa cicilannya', 'cicilan per bulan', 'angsuran berapa', 'what is the instalment', 'monthly payment', 'cicilane pinten'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const o = w.offer
    return { text: end(L, T(L, `Untuk ${jt(o.plafon, 'id')} selama 12 bulan dengan bunga flat ${rateText(o.ratePct, 'id')}/bulan, cicilannya ${rp(o.inst12, 'id')} per bulan (${pctText(o.dsr, 'id', 1)} dari laba bersih). Geser plafon dan tenor di tab Modal kerja untuk angka lain.`, `For ${jt(o.plafon, 'en')} over 12 months at a flat ${rateText(o.ratePct, 'en')}/month, the instalment is ${rp(o.inst12, 'en')} a month (${pctText(o.dsr, 'en', 1)} of net profit). Slide the amount and tenor in Working capital for other numbers.`)), followUps: chips(L, 'kenapa', 'pasti') }
  }),
  I('data-dibagikan', ['data apa yang dibagikan', 'koperasi bisa lihat apa', 'data saya dipakai untuk apa', 'which data is shared', 'what can the cooperative see', 'data apa sing dienggo'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const l = L2(L)
    if (!w.consent.scopes.length) return { text: end(L, T(L, `Belum ada data yang dibagikan ke ${LENDER}${w.consent.revoked ? ' (akses terakhir sudah dicabut)' : ''}. Pilih datanya di tab Berbagi data.`, `No data is shared with ${LENDER}${w.consent.revoked ? ' (the last access was revoked)' : ''}. Pick the data in the Data sharing tab.`)), followUps: chips(L, 'plafon') }
    const list = w.consent.scopes.map((k) => CONSENT_SCOPE[k as keyof typeof CONSENT_SCOPE][l]).join(', ')
    return { text: end(L, T(L, `${LENDER} boleh membaca: ${list}, selama ${w.consent.days} hari. Data lain tertulis "Tidak dibagikan pemilik" di layar analis.`, `${LENDER} may read: ${list}, for ${w.consent.days} days. Other data shows as "Not shared by the owner" on the analyst's screen.`)), followUps: chips(L, 'cabut') }
  }),
  I('cabut-akses', ['bagaimana mencabut akses', 'cabut akses data', 'hentikan berbagi data', 'how do I revoke access', 'stop sharing my data', 'mbatalke akses'], (ctx) => {
    const L = ctx.lang
    return { text: end(L, T(L, 'Buka tab Berbagi data lalu tekan "Cabut akses" pada baris koperasi. Setelah dicabut, pengajuan baru tidak bisa dikirim sampai Anda berbagi lagi.', 'Open the Data sharing tab and press "Revoke access" on the cooperative row. After that, no new application can be sent until you share again.')), followUps: chips(L, 'data') }
  }),
  I('pasti-disetujui', ['apakah pasti disetujui', 'dijamin cair', 'kapan cair', 'will it surely be approved', 'is approval guaranteed', 'mesti disetujoni'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const st = w.loan ? T(L, ` Pengajuan ${w.loan.id} saat ini berstatus ${w.loan.status}.`, ` Application ${w.loan.id} is now ${w.loan.status}.`) : ''
    return { text: end(L, T(L, `Tidak ada yang pasti: keputusan tetap di koperasi. Skor membantu analis membaca data usaha Anda lebih cepat.${st}`, `Nothing is guaranteed: the cooperative decides. The score helps the analyst read your business data faster.${st}`)), followUps: chips(L, 'naik', 'cicilan') }
  }),
  I('ringkas-pengajuan', ['ringkas pengajuan', 'ringkasan pengajuan ini', 'kekuatan dan risiko', 'summarise the application', 'strengths and risks of this application', 'ringkesan pengajuan'], (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    const b = w.brief
    if (!b) return { text: end(L, T(L, 'Buka satu pengajuan dulu untuk diringkas.', 'Open an application first to summarise it.')), followUps: [] }
    const recTxt: Record<string, Bi> = { setujui: { id: 'setujui', en: 'approve' }, 'setujui-bersyarat': { id: 'setujui bersyarat', en: 'approve with conditions' }, 'tinjau-manual': { id: 'tinjau manual', en: 'manual review' } }
    const text = T(
      L,
      `${b.business} (${b.loanId}) · skor ${b.scoreNow} · rekomendasi ${recTxt[b.rec]!.id}.\nKekuatan:\n${b.strengths.map((x) => `- ${x.id}`).join('\n')}\nRisiko:\n${b.risks.map((x) => `- ${x.id}`).join('\n')}\nJumlah maksimal yang wajar ${jt(b.maxAmount, 'id')}. Penilaian dari data usaha, keputusan tetap di analis.`,
      `${b.business} (${b.loanId}) · score ${b.scoreNow} · recommendation ${recTxt[b.rec]!.en}.\nStrengths:\n${b.strengths.map((x) => `- ${x.en}`).join('\n')}\nRisks:\n${b.risks.map((x) => `- ${x.en}`).join('\n')}\nReasonable maximum ${jt(b.maxAmount, 'en')}. Judged on business data; the analyst decides.`,
    )
    return { text: end(L, text), structured: { kind: 'rapor-usaha/loan-brief', data: { loanId: b.loanId, rec: b.rec, strengths: b.strengths, risks: b.risks, maxAmount: b.maxAmount } }, followUps: [] }
  }),
]

const scenario: Scenario<RuContext> = {
  product: 'rapor-usaha',
  intents: INTENTS,
  fallback: (ctx) => {
    const w = ctx.world
    const L = ctx.lang
    return {
      text: end(L, T(L, `Saya hanya bisa membahas skor usaha, cara menaikkannya, plafon modal kerja, dan berbagi data dengan koperasi. Skor ${w.shop} sekarang ${w.score} (${w.band.id}).`, `I can only discuss the business score, how to raise it, the working-capital limit and data sharing with the cooperative. ${w.shop}'s score is ${w.score} (${w.band.en}) now.`)),
      structured: scoreCard(w, L),
      followUps: chips(L, 'turun', 'naik', 'plafon'),
    }
  },
}

registerScenario(scenario)
export const SUGGEST = (lang: Lang) => chips(lang, 'turun', 'naik', 'plafon', 'data')
