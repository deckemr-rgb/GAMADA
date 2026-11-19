/**
 * demos/inti/scenario.ts — the simulated GAMADA Inti orchestrator (registered by the lazy console in Inti Agen).
 * Every number comes from the context the console builds out of the world (ctx), so the answer agrees with the screen.
 * Intents: rencana_banjir → shared 'plan' + 5 agent steps (one per product, durations deterministic from the intent),
 * jejak_entitas → 'inti/trail', siapa_akses → 'inti/access', ringkas_hari → 'insight', kanal_hari_ini, cari_audit,
 * produk_terkait, umkm_siap_pasok, status_pajak_toko, harga_pangan; fallback. Wording rotates (least recently used);
 * every sentence names a kecamatan, a code, a product, an amount or a time.
 */
import { registerScenario, registerStructuredSchema, type SimContext, type SimResponse } from '../../demo-kit/ai/chat'

type Bi = { id: string; en: string }
export interface IntiCtx {
  product: 'inti'
  roleName: Bi
  role: string
  scope: 'semua' | 'usaha'
  today: number
  top: { name: string; count: number }[]
  alert: { id: string; kec: string; level: number } | null
  siti: { code: string; kec: string; cluster: number | null } | null
  instruction: { at: string; opds: number } | null
  pump: { code: string; hps: number } | null
  need: { code: string; item: Bi; qty: number; unit: string; matches: number } | null
  verifiedLocal: number
  trail: { root: string | null; products: string[]; rows: { t: string; p: string; x: Bi }[] }
  inbox: { total: number; unread: number; wa: number; web: number; telepon: number; calls: number }
  access: Record<string, string[]>
  mine: { allowed: string[]; denied: string[] }
  names: Record<string, string>
  audit: { t: string; p: string; x: Bi }[]
  shop: { name: string; verified: boolean; taxTidy: boolean; score: number | null } | null
  prices: { name: Bi; market: string; price: number }[]
  related: string[]
}
type L = 'id' | 'en'
type C = SimContext<IntiCtx>
const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const used = new Map<string, number>()
/** least recently used variant */
const pick = <T,>(key: string, list: T[]): T => {
  const i = used.get(key) ?? 0
  used.set(key, i + 1)
  return list[i % list.length]!
}
const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
/** deterministic step duration from intent + index, 80–900 ms */
export const stepMs = (intent: string, i: number) => 80 + ((hash(intent) + i * 211) % 821)
const x = (c: C): IntiCtx | null => (c.world && (c.world as IntiCtx).product === 'inti' ? (c.world as IntiCtx) : null)
const none = (l: L): SimResponse => ({ text: l === 'id' ? 'Data platform belum termuat. Coba lagi sebentar lagi.' : 'Platform data has not loaded yet. Try again in a moment.' })
const sim = (l: L) => (l === 'id' ? '(simulasi)' : '(simulated)')

function plan(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const kec = w.alert?.kec ?? w.siti?.kec ?? (l === 'id' ? 'terdampak' : 'affected')
  const I = 'rencana_banjir'
  const steps = [
    { product: 'siaga-wilayah', action: w.alert ? (l === 'id' ? `Pantau peringatan banjir level ${w.alert.level} di Kec. ${kec}` : `Monitor the level ${w.alert.level} flood warning in ${kec}`) : (l === 'id' ? `Pasang peringatan banjir untuk Kec. ${kec}` : `Issue a flood warning for ${kec}`) },
    { product: 'sapa-warga', action: w.siti?.cluster ? (l === 'id' ? `Gabungkan ${w.siti.cluster} aduan banjir sekitar ${w.siti.code} menjadi satu klaster` : `Merge the ${w.siti.cluster} flood complaints around ${w.siti.code} into one cluster`) : (l === 'id' ? `Kumpulkan aduan banjir warga Kec. ${kec}` : `Collect the residents’ flood complaints in ${kec}`) },
    { product: 'meja-pimpinan', action: l === 'id' ? `Terbitkan instruksi Kepala Daerah untuk Kec. ${kec} (BPBD + Dinsos)` : `Issue the Regional Head’s instruction for ${kec} (BPBD + social office)` },
    { product: 'awas-belanja', action: w.pump ? (l === 'id' ? `Periksa HPS paket ${w.pump.code} (${rp(w.pump.hps)}) terhadap harga pasar` : `Check the HPS of package ${w.pump.code} (${rp(w.pump.hps)}) against market prices`) : (l === 'id' ? 'Periksa HPS paket pompa darurat saat terbit' : 'Check the emergency pump package HPS once published') },
    { product: 'katalog-lokal', action: w.need ? (l === 'id' ? `Cocokkan kebutuhan ${w.need.code} dengan ${w.need.matches} UMKM terverifikasi` : `Match need ${w.need.code} with ${w.need.matches} verified SMEs`) : (l === 'id' ? `Cari UMKM lokal terverifikasi (${w.verifiedLocal} tersedia)` : `Find verified local SMEs (${w.verifiedLocal} available)`) },
  ]
  const toolCalls = [
    { name: 'cek_peringatan', input: { product: 'siaga-wilayah', kecamatan: kec }, output: w.alert ? { alertId: w.alert.id, level: w.alert.level } : { status: l === 'id' ? 'tidak ada peringatan aktif' : 'no active warning' }, ms: stepMs(I, 0) },
    { name: 'klaster_aduan', input: { product: 'sapa-warga', kecamatan: kec }, output: w.siti ? { complaint: w.siti.code, clusterSize: w.siti.cluster ?? 1 } : { complaints: 0 }, ms: stepMs(I, 1) },
    { name: 'susun_instruksi', input: { product: 'meja-pimpinan', kecamatan: kec }, output: w.instruction ? { issuedAt: w.instruction.at, opd: w.instruction.opds } : { draft: true }, ms: stepMs(I, 2) },
    { name: 'cek_hps', input: { product: 'awas-belanja', package: w.pump?.code ?? null }, output: w.pump ? { hps: w.pump.hps } : { status: l === 'id' ? 'paket belum terbit' : 'no package yet' }, ms: stepMs(I, 3) },
    { name: 'cari_umkm', input: { product: 'katalog-lokal', need: w.need?.code ?? null }, output: { matches: w.need?.matches ?? 0, verifiedLocal: w.verifiedLocal }, ms: stepMs(I, 4) },
  ]
  const lead = pick('plan', l === 'id'
    ? [`Rencana banjir Kec. ${kec} dari aduan sampai pengadaan: 5 agen bekerja berurutan ${sim(l)}.`, `Untuk Kec. ${kec} saya jalankan 5 agen, dari Siaga Wilayah sampai Katalog Lokal ${sim(l)}.`]
    : [`Flood plan for ${kec} from complaint to procurement: 5 agents run in order ${sim(l)}.`, `For ${kec} I run 5 agents, from Siaga Wilayah to Katalog Lokal ${sim(l)}.`])
  const facts = [
    w.alert ? (l === 'id' ? `Peringatan level ${w.alert.level} aktif.` : `A level ${w.alert.level} warning is active.`) : (l === 'id' ? 'Belum ada peringatan aktif.' : 'No warning is active yet.'),
    w.pump ? (l === 'id' ? `HPS paket pompa ${w.pump.code}: ${rp(w.pump.hps)}.` : `Pump package ${w.pump.code} HPS: ${rp(w.pump.hps)}.`) : '',
    w.need ? (l === 'id' ? `${w.need.matches} UMKM cocok untuk ${w.need.code}.` : `${w.need.matches} SMEs match ${w.need.code}.`) : '',
  ].filter(Boolean).join(' ')
  return {
    text: `${lead} ${facts}`,
    toolCalls,
    structured: { kind: 'plan', data: { steps } },
    followUps: l === 'id' ? ['Tampilkan jejak aduan Ibu Siti', 'Siapa yang bisa membuka Katalog Lokal?'] : ['Show the trail of Ibu Siti’s complaint', 'Who can open Katalog Lokal?'],
  }
}

function trail(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  if (!w.trail.root || !w.trail.rows.length)
    return { text: l === 'id' ? 'Belum ada jejak hari ini. Tekan "Putar jejak aduan Ibu Siti" di Inti Data untuk memutarnya.' : 'No trail today yet. Press "Play the trail of Ibu Siti’s complaint" in Inti Data.' }
  const path = w.trail.rows.slice(0, 6).map((r) => `${r.p} ${r.t}`).join(' → ')
  const head = pick('trail', l === 'id'
    ? [`Jejak ${w.trail.root} melintasi ${w.trail.products.length} produk: ${path}.`, `${w.trail.root} berpindah lewat ${w.trail.products.length} produk (${path}).`]
    : [`${w.trail.root} travels across ${w.trail.products.length} products: ${path}.`, `The trail of ${w.trail.root} passes ${w.trail.products.length} products (${path}).`])
  return {
    text: `${head} ${l === 'id' ? 'Setiap langkah adalah satu baris Audit Log.' : 'Every step is one Audit Log row.'}`,
    toolCalls: [{ name: 'trace_entity', input: { product: 'inti', root: w.trail.root }, output: { rows: w.trail.rows.length, products: w.trail.products }, ms: stepMs('jejak_entitas', 0) }],
    structured: { kind: 'inti/trail', data: { root: w.trail.root, products: w.trail.products, rows: w.trail.rows.length } },
  }
}

function access(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const q = c.text.toLowerCase()
  const hit = Object.entries(w.names).find(([, n]) => q.includes(n.toLowerCase()))
  const role = w.roleName[l]
  const note = hit
    ? (l === 'id' ? `${hit[1]} dapat dibuka oleh: ${(w.access[hit[0]] ?? []).join(', ')}.` : `${hit[1]} can be opened by: ${(w.access[hit[0]] ?? []).join(', ')}.`)
    : pick('acc', l === 'id' ? [`Peran ${role} membuka ${w.mine.allowed.length} dari 17 produk.`, `Dengan peran ${role}, ${w.mine.allowed.length} produk terbuka dan ${w.mine.denied.length} tertutup.`] : [`The ${role} role opens ${w.mine.allowed.length} of 17 products.`, `As ${role}, ${w.mine.allowed.length} products are open and ${w.mine.denied.length} closed.`])
  return {
    text: `${note} ${l === 'id' ? 'Sumbernya definisi peran tiap produk, sama dengan matriks Inti ID.' : 'The source is each product’s role definition, the same as the Inti ID matrix.'}`,
    toolCalls: [{ name: 'explain_access', input: { product: 'inti', role: w.role }, output: { allowed: w.mine.allowed.length, denied: w.mine.denied.length }, ms: stepMs('siapa_akses', 0) }],
    structured: { kind: 'inti/access', data: { role: w.role, allowed: w.mine.allowed, denied: w.mine.denied, note } },
  }
}

function summary(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const top = w.top.map((t) => `${t.name} ${t.count}`).join(', ')
  const text = pick('sum', l === 'id'
    ? [`Hari ini ${w.today} kejadian tercatat di Audit Log; paling sibuk: ${top}. ${w.alert ? `Peringatan banjir Kec. ${w.alert.kec} aktif.` : 'Tidak ada peringatan banjir aktif.'} ${sim(l)}`, `${w.today} kejadian sejak pagi (${top}). ${w.inbox.unread} pesan belum dibaca di Inti Kanal. ${sim(l)}`]
    : [`Today ${w.today} events are in the Audit Log; busiest: ${top}. ${w.alert ? `The ${w.alert.kec} flood warning is active.` : 'No flood warning is active.'} ${sim(l)}`, `${w.today} events since the morning (${top}). ${w.inbox.unread} unread messages in Inti Channels. ${sim(l)}`])
  return { text, structured: { kind: 'insight', data: { indicator: l === 'id' ? 'Kejadian hari ini' : 'Events today', trend: 'naik', explanation: text } } }
}

function inbox(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const b = w.inbox
  return {
    text: pick('kanal', l === 'id'
      ? [`Inti Kanal: ${b.total} percakapan hari ini (WA ${b.wa}, web ${b.web}, telepon ${b.telepon}), ${b.unread} belum dibaca, ${b.calls} panggilan penjualan.`, `${b.unread} dari ${b.total} percakapan belum dibaca; WhatsApp paling ramai (${b.wa}).`]
      : [`Inti Channels: ${b.total} conversations today (WA ${b.wa}, web ${b.web}, phone ${b.telepon}), ${b.unread} unread, ${b.calls} sales calls.`, `${b.unread} of ${b.total} conversations are unread; WhatsApp is busiest (${b.wa}).`]),
  }
}

function findAudit(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  const words = c.text.toLowerCase().split(/[^a-z0-9-]+/).filter((v) => v.length >= 4 && !/audit|cari|find|kejadian|event|tentang|about|yang|with/.test(v))
  const hits = w.audit.filter((a) => words.some((k) => `${a.x.id} ${a.x.en}`.toLowerCase().includes(k)))
  const list = (hits.length ? hits : w.audit).slice(0, 3).map((a) => `- ${a.t} · ${a.p}: ${a.x[l]}`).join('\n')
  return { text: `${hits.length ? (l === 'id' ? `${hits.length} baris cocok di Audit Log:` : `${hits.length} matching Audit Log rows:`) : l === 'id' ? 'Tidak ada yang cocok; 3 kejadian terbaru:' : 'No match; the 3 latest events:'}\n${list}` }
}

function related(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  return {
    text: l === 'id'
      ? `GAMADA Inti menghubungkan ${w.related.join(', ')}. Contoh: aduan Sapa Warga → klaster di Meja Pimpinan → surat Naskah Pintar → paket Awas Belanja → kebutuhan Katalog Lokal.`
      : `GAMADA Inti connects ${w.related.join(', ')}. Example: a Sapa Warga complaint → a Meja Pimpinan cluster → a Naskah Pintar letter → an Awas Belanja package → a Katalog Lokal need.`,
  }
}

function umkm(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w) return none(l)
  return {
    text: w.need
      ? (l === 'id' ? `${w.verifiedLocal} UMKM lokal terverifikasi di Katalog Lokal; ${w.need.matches} cocok untuk ${w.need.code} (${w.need.qty} ${w.need.unit} ${w.need.item.id}). ${sim(l)}` : `${w.verifiedLocal} verified local SMEs in Katalog Lokal; ${w.need.matches} match ${w.need.code} (${w.need.qty} ${w.need.unit} ${w.need.item.en}). ${sim(l)}`)
      : (l === 'id' ? `${w.verifiedLocal} UMKM lokal terverifikasi siap memasok; belum ada kebutuhan darurat yang dicocokkan. ${sim(l)}` : `${w.verifiedLocal} verified local SMEs are ready to supply; no emergency need matched yet. ${sim(l)}`),
  }
}

function tax(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w || !w.shop) return none(l)
  const s = w.shop
  return {
    text: l === 'id'
      ? `${s.name}: ${s.taxTidy ? 'pajak sudah rapi (Pajak Beres)' : 'pajak belum dirapikan di Pajak Beres'}, ${s.verified ? 'terverifikasi KYB' : 'belum terverifikasi KYB'}, skor Rapor Usaha ${s.score ?? '—'} ${sim(l)}.`
      : `${s.name}: ${s.taxTidy ? 'taxes in order (Pajak Beres)' : 'taxes not in order in Pajak Beres yet'}, ${s.verified ? 'KYB verified' : 'not KYB verified'}, Rapor Usaha score ${s.score ?? '—'} ${sim(l)}.`,
  }
}

function prices(c: C): SimResponse {
  const w = x(c)
  const l = c.lang
  if (!w || !w.prices.length) return none(l)
  return { text: w.prices.map((p) => `${p.name[l]} ${l === 'id' ? 'di' : 'at'} ${p.market}: ${rp(p.price)}`).join('; ') + ` ${sim(l)}.` }
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const okTrail = { safeParse: (v: unknown) => (obj(v) && typeof v.root === 'string' && Array.isArray(v.products) ? { success: true as const, data: v } : { success: false as const }) }
const okAccess = { safeParse: (v: unknown) => (obj(v) && typeof v.role === 'string' && Array.isArray(v.allowed) && Array.isArray(v.denied) ? { success: true as const, data: v } : { success: false as const }) }
let done = false
export function registerIntiScenario(): void {
  if (done) return
  done = true
  // sim kinds (inti/trail, inti/access) + the live tool kinds of prompts/inti.ts (trace_entity, explain_access)
  registerStructuredSchema('inti/trail', okTrail)
  registerStructuredSchema('inti/trace_entity', okTrail)
  registerStructuredSchema('inti/access', okAccess)
  registerStructuredSchema('inti/explain_access', okAccess)
  registerScenario<IntiCtx>({
    product: 'inti',
    intents: [
      { id: 'rencana_banjir', examples: ['tangani banjir dari aduan sampai pengadaan', 'rencana penanganan banjir', 'koordinasi banjir semua produk', 'handle the flood from complaint to procurement', 'flood response plan', 'tangani banjir kecamatan', 'banjir piye penanganane'], respond: plan },
      { id: 'jejak_entitas', examples: ['jejak aduan ibu siti', 'tampilkan jejak data', 'telusuri aduan', 'show the data trail', 'trace the complaint', 'lacak perjalanan data'], respond: trail },
      { id: 'siapa_akses', examples: ['siapa yang bisa membuka', 'hak akses peran', 'peran apa yang boleh', 'who can open', 'which role has access', 'akses produk'], respond: access },
      { id: 'ringkas_hari', examples: ['ringkas hari ini', 'apa yang terjadi hari ini', 'ringkasan platform', 'summarise today', 'what happened today', 'kabar dina iki'], respond: summary },
      { id: 'kanal_hari_ini', examples: ['pesan belum dibaca', 'kotak masuk hari ini', 'berapa pesan masuk', 'unread messages', 'inbox today', 'percakapan whatsapp'], respond: inbox },
      { id: 'cari_audit', examples: ['cari di audit log', 'cari kejadian', 'audit tentang', 'search the audit log', 'find an event', 'log kejadian'], respond: findAudit },
      { id: 'produk_terkait', examples: ['produk apa saja yang terhubung', 'bagaimana produk saling terhubung', 'produk terkait', 'how are the products connected', 'related products', 'alur antarproduk'], respond: related },
      { id: 'umkm_siap_pasok', examples: ['umkm siap pasok', 'umkm terverifikasi', 'pemasok lokal', 'local suppliers ready', 'verified smes', 'usaha lokal yang cocok'], respond: umkm },
      { id: 'status_pajak_toko', examples: ['status pajak toko', 'pajak toko sudah rapi', 'skor toko', 'shop tax status', 'is the shop tax in order', 'skor rapor usaha toko'], respond: tax },
      { id: 'harga_pangan', examples: ['harga beras', 'harga cabai', 'harga pangan hari ini', 'rice price', 'chili price', 'food prices today'], respond: prices },
    ],
    fallback: (c) => ({
      text: c.lang === 'id'
        ? 'Saya orkestrator GAMADA Inti: bisa menyusun rencana lintas produk, menelusuri jejak data, menjelaskan hak akses, meringkas hari ini, atau mencari di Audit Log. Pilih salah satu tombol di atas.'
        : 'I am the GAMADA Inti orchestrator: I can plan across products, trace data, explain access, summarise today or search the Audit Log. Pick one of the buttons above.',
    }),
  })
}
