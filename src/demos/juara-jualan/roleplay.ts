/**
 * demos/juara-jualan/roleplay.ts — the practice customer (lazy, local, deterministic). Three personas per industry
 * (ragu harga · buru-buru · banyak tanya), an 8-step script whose next line reacts to the quality of the agent's
 * last reply (good / average / weak / promise breach). Replies are classified locally (probe, empathy, value, price,
 * discount, pressure, breach words, call to action); 3 suggestion chips per turn (good / average / weak) let phones
 * play without typing, and weak chips honestly score lower. Score = callScore(criteria) like a real call.
 */
import { fmtRp, hashString, rows, type Bi, type Criteria, type CriterionKey, type Industry, type RoleplayPersona, type WorldState } from '../../demo-kit/world'
import { CALL_CRITERIA, CRITERIA_KEYS, callScore } from '../../demo-kit/world/usaha-pintar'

export type Quality = 'good' | 'avg' | 'weak'
export const TURN_LIMIT = 8
export const MIN_TURNS = 6
type V = Record<'product' | 'price' | 'benefit' | 'alt' | 'next' | 'agent' | 'org', Bi>

/** industry vocabulary; Toko Bangunan prices come from the shop's own shelf (world) */
export function vocabFor(s: WorldState, ind: Industry, agentName: string, org: string): V {
  const first = agentName.split(' ')[0] ?? agentName
  const base = { agent: { id: first, en: first }, org: { id: org, en: org } }
  if (ind === 'toko-bangunan') {
    const sem = rows(s.products).find((p) => p.businessId === s.meta.shopId && p.category === 'semen' && /^semen pcc/i.test(p.name)) ?? rows(s.products).find((p) => p.businessId === s.meta.shopId && p.category === 'semen')
    const pr = sem ? `${fmtRp(sem.price)} per ${sem.unit}` : ''
    return {
      ...base,
      product: { id: 'semen untuk renovasi', en: 'cement for a renovation' },
      price: { id: `${sem?.name ?? 'semen'} ${pr}`, en: `${sem?.name ?? 'cement'} at ${pr}` },
      benefit: { id: 'antar gratis dalam kota dan bayar setelah barang sampai', en: 'free delivery in town and payment on arrival' },
      alt: { id: 'harga grosir mulai 50 sak atau antar gratis', en: 'a wholesale price from 50 bags or free delivery' },
      next: { id: 'pengiriman Sabtu pagi', en: 'delivery on Saturday morning' },
    }
  }
  if (ind === 'multifinance')
    return {
      ...base,
      product: { id: 'kredit motor', en: 'a motorbike loan' },
      price: { id: 'angsuran Rp 860.000 per bulan selama 24 bulan', en: 'Rp 860,000 a month for 24 months' },
      benefit: { id: 'proses 2 hari kerja dan total biaya tertulis di awal', en: 'a 2-working-day process and the total cost in writing up front' },
      alt: { id: 'tenor lebih panjang supaya angsuran lebih ringan', en: 'a longer tenor for a lighter instalment' },
      next: { id: 'survei rumah Sabtu pagi', en: 'a home survey on Saturday morning' },
    }
  return {
    ...base,
    product: { id: 'asuransi kesehatan keluarga', en: 'family health insurance' },
    price: { id: 'premi Rp 350.000 per bulan', en: 'a premium of Rp 350,000 a month' },
    benefit: { id: 'rawat inap tanpa uang muka di rumah sakit rekanan', en: 'inpatient care with no deposit at partner hospitals' },
    alt: { id: 'paket tanpa rawat jalan dengan premi lebih ringan', en: 'a plan without outpatient cover and a lighter premium' },
    next: { id: 'pengisian formulir Kamis sore', en: 'filling in the form on Thursday afternoon' },
  }
}
const fill = (b: Bi, v: V): Bi => ({ id: b.id.replace(/\{(\w+)\}/g, (m, k: string) => v[k as keyof V]?.id ?? m), en: b.en.replace(/\{(\w+)\}/g, (m, k: string) => v[k as keyof V]?.en ?? m) })
const b = (id: string, en: string): Bi => ({ id, en })

/** what each step of the script tests */
const STEP_CRIT: CriterionKey[][] = [['salam'], ['gali'], ['penawaran'], ['keberatan'], ['penawaran'], ['keberatan', 'kepatuhan'], ['keberatan', 'closing'], ['closing']]

const CUSTOMER: Record<RoleplayPersona, Bi[]> = {
  'ragu-harga': [
    b('Halo, saya lihat {product} di tempat Anda. Tapi kok kelihatannya mahal ya?', 'Hello, I saw {product} at your place. But it looks expensive, doesn’t it?'),
    b('Sebenarnya saya butuh cepat, tapi anggaran saya terbatas.', 'I actually need it soon, but my budget is tight.'),
    b('Jadi harganya berapa persisnya?', 'So what exactly is the price?'),
    b('Di tempat lain ada yang lebih murah sedikit.', 'Somewhere else is a little cheaper.'),
    b('Kalau saya ambil di Anda, untungnya apa?', 'If I take it from you, what do I gain?'),
    b('Masih bisa kurang tidak?', 'Can you go any lower?'),
    b('Hmm, saya masih ragu.', 'Hmm, I am still unsure.'),
    b('Baik, kalau saya mau, langkah berikutnya apa?', 'All right, if I want it, what is the next step?'),
  ],
  'buru-buru': [
    b('Saya cuma punya waktu sebentar. Langsung saja: {product} ada?', 'I only have a moment. Straight to it: do you have {product}?'),
    b('Intinya saya butuh minggu ini. Bisa?', 'Bottom line, I need it this week. Can you?'),
    b('Berapa? Angka saja.', 'How much? Just the number.'),
    b('Jangan panjang-panjang, saya tidak sempat baca brosur.', 'Keep it short, I have no time for brochures.'),
    b('Kenapa saya harus pilih Anda?', 'Why should I pick you?'),
    b('Ada syarat yang ribet tidak?', 'Any complicated conditions?'),
    b('Oke, terus saya harus apa?', 'OK, so what do I do?'),
    b('Ya sudah, cepat ya.', 'Fine, make it quick.'),
  ],
  'banyak-tanya': [
    b('Saya mau tanya-tanya dulu soal {product}, boleh?', 'I would like to ask a few things about {product} first, may I?'),
    b('Bedanya dengan yang lain apa?', 'How is it different from the others?'),
    b('Totalnya berapa, dan ada biaya lain?', 'What is the total, and are there other costs?'),
    b('Kalau ada masalah setelah itu, bagaimana?', 'If there is a problem afterwards, what happens?'),
    b('Apa jaminannya buat saya?', 'What assurance do I get?'),
    b('Bisa dibayar bertahap atau ada potongan?', 'Can I pay in stages, or is there a discount?'),
    b('Kalau saya batal nanti, bagaimana?', 'What if I cancel later?'),
    b('Oke, cukup jelas. Lalu?', 'OK, that is clear enough. What next?'),
  ],
}
/** the customer's reaction to the last reply, before the next script line (rotates: no repeat in one session) */
const REACT: Record<Quality | 'breach', Bi[]> = {
  good: [b('Oke, masuk akal.', 'OK, that makes sense.'), b('Nah, begitu lebih jelas.', 'Right, that is clearer.'), b('Baik, itu membantu.', 'Good, that helps.'), b('Hmm, boleh juga.', 'Hmm, not bad.')],
  avg: [b('Ya…', 'Well…'), b('Hmm, oke.', 'Hmm, OK.'), b('Begitu ya.', 'I see.'), b('Baiklah.', 'All right.')],
  weak: [b('Kok langsung jualan sih?', 'Why go straight to selling?'), b('Saya belum dapat jawabannya.', 'I still have no answer.'), b('Kesannya memaksa, ya.', 'That feels pushy.'), b('Maksudnya bagaimana?', 'What do you mean?')],
  breach: [b('Pasti? Bisa ditulis di perjanjian?', 'Definitely? Can that go in the agreement?'), b('Seratus persen? Saya jadi curiga.', 'A hundred percent? Now I am suspicious.')],
}
const ACCEPT: Record<RoleplayPersona, Bi> = {
  'ragu-harga': b('Oke, saya setuju. Silakan kirim rinciannya.', 'OK, I agree. Please send the details.'),
  'buru-buru': b('Sip, jadwalkan saja. Saya tunggu.', 'Good, just book it. I will wait.'),
  'banyak-tanya': b('Baik, pertanyaan saya terjawab. Saya ambil.', 'Fine, my questions are answered. I will take it.'),
}
/** suggestion chips per step: good / average / weak */
const CHIPS: [Bi, Bi, Bi][] = [
  [b('Selamat pagi, saya {agent} dari {org}. Boleh saya tanya dulu kebutuhan Anda?', 'Good morning, this is {agent} from {org}. May I first ask what you need?'), b('Halo, ada yang bisa dibantu?', 'Hello, how can I help?'), b('Langsung saja, punya kami paling murah.', 'Straight to it, ours is the cheapest.')],
  [b('Boleh tahu untuk keperluan apa dan kapan dibutuhkan?', 'May I ask what it is for and when you need it?'), b('Butuhnya berapa banyak?', 'How much do you need?'), b('Pokoknya ambil yang ini saja.', 'Just take this one.')],
  [b('Untuk kebutuhan itu: {price}, dengan {benefit}.', 'For that need: {price}, with {benefit}.'), b('Harganya ada beberapa, nanti saya kirim.', 'There are several prices, I will send them later.'), b('Murah kok, pasti disetujui.', 'It is cheap, definitely approved.')],
  [b('Saya paham. Bedanya, {benefit}, dan total biayanya saya tulis jelas.', 'I understand. The difference is {benefit}, and I will write out the total cost.'), b('Harga kami memang segitu.', 'That is simply our price.'), b('Kalau tidak sekarang, besok sudah naik.', 'If not now, it goes up tomorrow.')],
  [b('Untungnya: {benefit}, dan semuanya tercatat tertulis.', 'What you gain: {benefit}, and it is all in writing.'), b('Kualitasnya bagus kok.', 'The quality is good.'), b('Dijamin 100 % puas.', 'Guaranteed 100 % satisfied.')],
  [b('Saya tidak bisa janji diskon, tapi bisa {alt}; syaratnya saya kirim tertulis.', 'I cannot promise a discount, but I can offer {alt}; the terms come in writing.'), b('Nanti saya tanyakan atasan.', 'I will ask my manager.'), b('Bisa, saya kasih diskon 20 % asal sekarang.', 'Sure, 20 % off if you decide now.')],
  [b('Wajar ragu. Bagaimana kalau rinciannya saya kirim dan kita jadwalkan {next}?', 'Fair to hesitate. Shall I send the details and we schedule {next}?'), b('Ya sudah, dipikir dulu saja.', 'Fine, think it over.'), b('Sayang lho kalau dilewatkan, ambil sekarang saja.', 'It would be a shame to miss it, just take it now.')],
  [b('Saya kirim formulirnya sekarang dan jadwalkan {next}. Setuju?', 'I will send the form now and schedule {next}. Agreed?'), b('Nanti saya hubungi lagi.', 'I will contact you again later.'), b('Pokoknya transfer dulu saja.', 'Just transfer the money first.')],
]
const Q_ORDER: Quality[] = ['good', 'avg', 'weak']

/** the three chips of a step, in a per-persona order (the good one is not always first) */
export function chipsFor(step: number, persona: RoleplayPersona, v: V): { id: string; label: Bi; q: Quality }[] {
  const set = CHIPS[Math.min(step, CHIPS.length - 1)]!
  const out = set.map((c, i) => ({ id: `${step}-${Q_ORDER[i]}`, label: fill(c, v), q: Q_ORDER[i]! }))
  const r = hashString(`${persona}|${step}`) % 3
  return [...out.slice(r), ...out.slice(0, r)]
}

const RX = {
  greet: /(selamat (pagi|siang|sore|malam)|halo|assalamualaikum|good (morning|afternoon|evening)|hello|\bdari\b|\bfrom\b)/i,
  probe: /(\?|boleh tahu|untuk (apa|keperluan)|kapan|berapa banyak|kebutuhan|what (is it )?for|when|how (much|many) do you need|need)/i,
  value: /(antar|gratis|tertulis|proses|manfaat|garansi|hemat|tanpa uang muka|bayar setelah|delivery|free|in writing|process|benefit|warranty|save|no deposit)/i,
  price: /(rp|harga|angsuran|premi|price|instal|premium|\d)/i,
  empathy: /(paham|wajar|mengerti|maaf|betul juga|understand|fair|sorry|i see why)/i,
  cta: /(jadwal|kirim (formulir|rincian)|setuju\?|besok jam|saya catat|schedule|send the form|agreed\?|book)/i,
  breach: /(pasti disetujui|dijamin|100 ?%|seratus persen|guaranteed|definitely approved)/i,
  pressure: /(sekarang juga|ambil sekarang|sayang lho|besok sudah naik|pokoknya|asal sekarang|right now|just take|goes up tomorrow|transfer .* first)/i,
}
export interface Reply { q: Quality; breach: boolean; pressure: boolean; cta: boolean; end: boolean }

/** local classification of a typed reply for this step */
export function classify(text: string, step: number): Reply {
  const t = text.trim()
  const end = /^(selesai|done|stop)\b/i.test(t)
  const breach = RX.breach.test(t)
  const pressure = RX.pressure.test(t)
  const cta = RX.cta.test(t)
  const want = STEP_CRIT[Math.min(step, STEP_CRIT.length - 1)]!
  let hits = 0
  for (const k of want) {
    if (k === 'salam' && RX.greet.test(t)) hits++
    if (k === 'gali' && RX.probe.test(t)) hits++
    if (k === 'penawaran' && (RX.price.test(t) || RX.value.test(t))) hits++
    if (k === 'keberatan' && (RX.empathy.test(t) || RX.value.test(t))) hits++
    if (k === 'closing' && cta) hits++
    if (k === 'kepatuhan' && !breach && !pressure) hits++
  }
  const q: Quality = breach || pressure ? 'weak' : hits >= 1 && t.length >= 30 ? 'good' : hits >= 1 || t.length >= 24 ? 'avg' : 'weak'
  return { q, breach, pressure, cta, end }
}
/** a chip's reply (its quality is known) */
export const chipReply = (q: Quality, text: string, step: number): Reply => ({ ...classify(text, step), q })

export interface Turn { step: number; q: Quality; breach: boolean; pressure: boolean }

/** the customer's next message after `turns` (reaction + next script line), or the acceptance */
export function customerNext(persona: RoleplayPersona, turns: Turn[], v: V, accepted: boolean): Bi {
  if (accepted) return ACCEPT[persona]
  const step = turns.length
  const line = fill(CUSTOMER[persona][Math.min(step, TURN_LIMIT - 1)]!, v)
  const last = turns[turns.length - 1]
  if (!last) return line
  const key = last.breach ? 'breach' : last.q
  const pool = REACT[key]
  const used = turns.slice(0, -1).filter((x) => (x.breach ? 'breach' : x.q) === key).length
  const r = pool[used % pool.length]!
  return { id: `${r.id} ${line.id}`, en: `${r.en} ${line.en}` }
}

const Q_VALUE: Record<Quality, number> = { good: 92, avg: 66, weak: 38 }
/** criteria from the turns (each step tests its criteria; breaches and pressure cut compliance) */
export function scoreTurns(turns: Turn[]): Criteria {
  const acc: Record<CriterionKey, number[]> = { salam: [], gali: [], keberatan: [], penawaran: [], closing: [], kepatuhan: [] }
  for (const tn of turns) for (const k of STEP_CRIT[Math.min(tn.step, STEP_CRIT.length - 1)]!) acc[k].push(Q_VALUE[tn.q])
  const c = {} as Criteria
  for (const k of CRITERIA_KEYS) c[k] = acc[k].length ? Math.round(acc[k].reduce((a, x) => a + x, 0) / acc[k].length) : 55
  const breaches = turns.filter((x) => x.breach).length
  const pressure = turns.filter((x) => x.pressure && !x.breach).length
  const comp = acc.kepatuhan.length ? c.kepatuhan : 92
  c.kepatuhan = Math.max(10, Math.min(100, comp - 30 * breaches - 12 * pressure))
  return c
}
export const scoreOf = (c: Criteria): number => callScore(c)

/** three feedback bullets: the strongest criterion, the weakest with a tip, and compliance */
export function bullets(c: Criteria, turns: Turn[]): Bi[] {
  const sorted = [...CRITERIA_KEYS].sort((a, b2) => c[b2] - c[a])
  const best = sorted[0]!
  const worst = sorted[sorted.length - 1]!
  const breaches = turns.filter((x) => x.breach).length
  const TIP: Record<CriterionKey, Bi> = {
    salam: b('buka dengan nama dan tempat kerja Anda', 'open with your name and workplace'),
    gali: b('tanyakan kebutuhan dan waktunya sebelum menawarkan', 'ask about the need and timing before offering'),
    keberatan: b('akui keberatan lalu jawab dengan nilai', 'acknowledge the objection, then answer with value'),
    penawaran: b('sebut satu angka dan manfaat yang jelas', 'give one clear figure and benefit'),
    closing: b('tutup dengan satu langkah dan waktu yang pasti', 'close with one definite step and time'),
    kepatuhan: b('jangan menjanjikan hasil atau memaksa', 'never promise outcomes or pressure the customer'),
  }
  return [
    b(`Terkuat: ${CALL_CRITERIA[best].id} (${c[best]}).`, `Strongest: ${CALL_CRITERIA[best].en} (${c[best]}).`),
    b(`Perlu dilatih: ${CALL_CRITERIA[worst].id} (${c[worst]}): ${TIP[worst].id}.`, `To practise: ${CALL_CRITERIA[worst].en} (${c[worst]}): ${TIP[worst].en}.`),
    breaches
      ? b(`${breaches} janji berlebihan terdeteksi (“pasti”, “dijamin”, “100 %”): kepatuhan skrip turun.`, `${breaches} over-promise(s) detected (“definitely”, “guaranteed”, “100 %”): script compliance dropped.`)
      : b(`Tanpa janji berlebihan dalam ${turns.length} giliran: kepatuhan skrip terjaga.`, `No over-promising in ${turns.length} turns: script compliance kept.`),
  ]
}
