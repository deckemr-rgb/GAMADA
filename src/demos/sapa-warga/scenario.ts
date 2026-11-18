/**
 * demos/sapa-warga/scenario.ts — the Simulasi scenario of Sapa Warga (spec §9.2, §11 P1): 32 intents with examples
 * in Bahasa Indonesia, English and Basa Jawa, answers built from the live world summary (`ctx.world` = SwContext from
 * model.buildContext): service requirements from the region pack, today's complaint counts, the citizen's own tickets,
 * MPP queue load, active warnings. A report intent returns a `ticket` structured result (the phone creates the
 * ticket when that card arrives); a citizen writing Basa Jawa gets a Basa Jawa answer with a translation.
 *
 * Loaded lazily (input focus / first send) and registered once: registerScenario(sapaWargaScenario).
 */
import type { Intent, Scenario, SimContext, SimResponse } from '../../demo-kit/ai/types'
import { CATEGORY_LABEL, type Bi, type ComplaintCategory } from '../../demo-kit/world'
import { SW, isEmergency, replyLang, slaText, type SwContext, type SwService } from './model'

type Ctx = SimContext<SwContext>
type RL = 'id' | 'en' | 'jv'

/* ------------------------------------------------------------------ helpers */

function w(ctx: Ctx): SwContext {
  // a Live request carries the compact context; its non-enumerable `full` is what this Simulasi fallback reads
  const raw = (ctx.world ?? {}) as Partial<SwContext> & { full?: SwContext }
  const x: Partial<SwContext> = raw.full ?? raw
  return {
    region: x.region ?? 'Kabupaten',
    now: x.now ?? '08:00',
    persona: x.persona ?? null,
    services: x.services ?? [],
    kecamatan: x.kecamatan ?? [],
    categoryOpd: x.categoryOpd ?? {},
    today: x.today ?? { complaints: 0, byCategory: {}, open: 0, mppBookings: 0, queueAhead: 0 },
    myTickets: x.myTickets ?? [],
    nextCode: x.nextCode ?? 'SW-0000-0000',
    justCreated: x.justCreated ?? null,
    alertHere: x.alertHere ?? null,
    clusterHere: x.clusterHere ?? null,
  }
}
const rlOf = (ctx: Ctx): RL => replyLang(ctx.text, ctx.lang)
/** answer object: Basa Jawa text with a translation in the UI language, or the plain answer */
function say(ctx: Ctx, ans: Bi, jv?: string): Pick<SimResponse, 'text' | 'translation'> {
  const rl = rlOf(ctx)
  if (rl === 'jv' && jv) return { text: jv, translation: ans[ctx.lang] }
  return { text: rl === 'jv' ? ans[ctx.lang] : ans[rl] }
}
const T = (ctx: Ctx, v: Bi): string => {
  const rl = rlOf(ctx)
  return rl === 'jv' ? v[ctx.lang] : v[rl]
}
const honor = (x: SwContext, lang: RL): string => {
  const p = x.persona
  if (!p) return ''
  const first = p.name.split(' ')[0] ?? p.name
  if (lang === 'jv') return p.gender === 'P' ? ` Bu ${first}` : p.age >= 50 ? ` Pak ${first}` : ` Mas ${first}`
  if (lang === 'en') return ` ${first}`
  return p.gender === 'P' ? ` Bu ${first}` : p.age >= 50 ? ` Pak ${first}` : ` Kak ${first}`
}
const placeOf = (sv: SwService | undefined, x: SwContext): Bi => {
  const kec = x.persona?.kecamatan ?? ''
  switch (sv?.channel) {
    case 'online':
      return { id: 'daring (online) dari HP, dengan pendampingan di MPP bila perlu', en: 'online from your phone, with help at the public service mall if needed' }
    case 'kecamatan':
      return { id: `kantor kecamatan (PATEN)${kec ? ` Kec. ${kec}` : ''}`, en: `the district office (PATEN)${kec ? ` in ${kec}` : ''}` }
    case 'dinas':
      return { id: `kantor ${sv.opd}`, en: `the ${sv.opd} office` }
    default:
      return { id: `Mal Pelayanan Publik (MPP) ${x.region}`, en: `the ${x.region} Public Service Mall (MPP)` }
  }
}
/** "Gratis (tidak dipungut biaya)" → "gratis" (no nested brackets inside a sentence) */
const feeShort = (fee: string): string => fee.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase()
const days = (n: number, l: 'id' | 'en') => (n <= 1 ? (l === 'id' ? '1 hari kerja' : '1 working day') : l === 'id' ? `${n} hari kerja` : `${n} working days`)

/** the chips under an answer (in the reply language) */
const chips = (ctx: Ctx, list: Bi[]): string[] => list.map((c) => T(ctx, c))
const CHIP = {
  nib: { id: 'Syarat bikin NIB apa?', en: 'What do I need for an NIB?' },
  ktp: { id: 'KTP-el rusak, bagaimana?', en: 'My e-ID card is damaged, what now?' },
  mpp: { id: 'MPP buka jam berapa?', en: 'When is the service mall open?' },
  queue: { id: 'Ambil antrean MPP', en: 'Book a service-mall slot' },
  status: { id: 'Cek status tiket saya', en: 'Check my ticket status' },
  officer: { id: 'Teruskan ke petugas', en: 'Forward to an officer' },
  flood: { id: 'Lapor banjir', en: 'Report a flood' },
  bansos: { id: 'Cek status bansos', en: 'Check my social-aid status' },
  capital: { id: 'Butuh modal usaha?', en: 'Need business capital?' },
} satisfies Record<string, Bi>

/* ------------------------------------------------------------------ services (checklist cards) */

function service(ctx: Ctx, serviceId: string, extra?: Bi): SimResponse {
  const x = w(ctx)
  const sv = x.services.find((s) => s.id === serviceId)
  const rl = rlOf(ctx)
  const l: 'id' | 'en' = rl === 'jv' ? ctx.lang : rl
  if (!sv) {
    return { ...say(ctx, { id: 'Untuk layanan itu, syaratnya bisa berbeda per daerah. Saya teruskan ke petugas agar dijawab pasti.', en: 'Requirements for that service differ by region. I will forward it to an officer for an exact answer.' }), followUps: chips(ctx, [CHIP.officer]) }
  }
  const where = placeOf(sv, x)
  const fee = sv.fee[l]
  const ans: Bi = {
    id: `Syarat ${sv.name.id}: ${sv.requirements.length} hal, saya rangkum di kartu di bawah. Waktu proses sekitar ${days(sv.slaDays, 'id')}, biaya: ${feeShort(sv.fee.id)}. Diurus ${where.id}.${extra ? ` ${extra.id}` : ''}`,
    en: `${sv.name.en} needs ${sv.requirements.length} things, summarised in the card below. Processing takes about ${days(sv.slaDays, 'en')}, fee: ${feeShort(sv.fee.en)}. Handled ${where.en}.${extra ? ` ${extra.en}` : ''}`,
  }
  const jv = `Sugeng${honor(x, 'jv')}. Syarat ${sv.name.id} sampun kula serat ing kertu ngandhap menika, nggih. Prosesipun kinten-kinten ${sv.slaDays} dinten.`
  return {
    ...say(ctx, ans, jv),
    structured: {
      kind: 'checklist',
      data: { serviceId: sv.id, service: sv.name[l], requirements: sv.requirements.map((r) => r[l]), estimate: days(sv.slaDays, l), office: where[l], fee, channel: sv.channel },
    },
    toolCalls: [
      { name: 'lookup_service', input: { query: ctx.text.slice(0, 60) }, output: { serviceId: sv.id, slaDays: sv.slaDays }, ms: 160 },
      { name: 'service_checklist', input: { serviceId: sv.id }, output: { requirements: sv.requirements.length }, ms: 140 },
    ],
    followUps: chips(ctx, sv.id === 'nib-oss' || sv.id === 'izin-usaha-mikro' ? [CHIP.queue, CHIP.capital] : sv.channel === 'mpp' || sv.channel === 'online' ? [CHIP.queue, CHIP.mpp] : [CHIP.mpp, CHIP.officer]),
  }
}

/* ------------------------------------------------------------------ reports (ticket cards) */

/** a stable simulated referral number per persona and day (RJK-YYYY-####) */
function refNo(x: SwContext): string {
  let h = 7
  for (const ch of `${x.persona?.name ?? ''}|${x.region}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `RJK-${/^SW-(\d{4})/.exec(x.nextCode)?.[1] ?? '2026'}-${String(10 + (h % 90)).padStart(4, '0')}`
}

const TIPS: Partial<Record<ComplaintCategory, Bi>> = {
  banjir: { id: 'Bila air terus naik, amankan dokumen penting dan matikan listrik dari meteran.', en: 'If the water keeps rising, secure important documents and switch off power at the meter.' },
  'pohon-tumbang': { id: 'Jauhi kabel yang putus sampai petugas datang.', en: 'Stay away from broken cables until the crew arrives.' },
  'jalan-rusak': { id: 'Petugas akan memasang tanda bahaya sementara lebih dulu.', en: 'The crew will place a temporary warning sign first.' },
  pju: { id: 'Regu PJU biasanya memperbaiki pada sore atau malam hari.', en: 'The street-light crew usually works in the late afternoon or evening.' },
  'air-bersih': { id: 'Tim akan memeriksa pipa dan tekanan air di jalur Anda.', en: 'The team will check the pipe and pressure on your line.' },
  pungli: { id: 'Identitas pelapor dirahasiakan. Simpan bukti bila ada.', en: 'Your identity stays confidential. Keep any evidence you have.' },
  kesehatan: { id: 'Untuk keadaan darurat, langsung ke IGD terdekat atau hubungi 112.', en: 'In an emergency go straight to the nearest ER or call 112.' },
  sampah: { id: 'Jadwal angkut di titik itu akan disesuaikan.', en: 'The pick-up schedule at that spot will be adjusted.' },
  sekolah: { id: 'Dinas akan meninjau bangunan dan memberi tahu sekolah.', en: 'The office will inspect the building and inform the school.' },
}
const JV_CAT: Partial<Record<ComplaintCategory, string>> = {
  banjir: 'banjir', 'jalan-rusak': 'dalan rusak', sampah: 'uwuh', pju: 'lampu dalan mati', 'air-bersih': 'toya resik', 'pohon-tumbang': 'wit ambruk', pungli: 'pungli', kesehatan: 'layanan kesehatan', sekolah: 'sekolah rusak',
}

function report(ctx: Ctx, matched: ComplaintCategory): SimResponse {
  const x = w(ctx)
  const rl = rlOf(ctx)
  const l: 'id' | 'en' = rl === 'jv' ? ctx.lang : rl
  const jc = x.justCreated
  // a ticket the phone already created (photo / voice note) keeps its own category, whatever the caption matched
  const cat: ComplaintCategory = jc?.category ?? matched
  const opd = jc?.opd ?? x.categoryOpd[cat] ?? 'OPD'
  const code = jc?.code ?? x.nextCode
  const hours = jc?.slaHours ?? SW.slaDays[cat] * 24
  // a kecamatan named in the message wins over the persona's home
  const named = x.kecamatan.find((k) => new RegExp(`\\b${k.name}\\b`, 'i').test(ctx.text))
  const kecId = named?.id ?? x.persona?.kecamatanId ?? ''
  const kec = named?.name ?? x.persona?.kecamatan ?? ''
  const desaId = named && named.id !== x.persona?.kecamatanId ? '' : (x.persona?.desaId ?? '')
  const desa = named && named.id !== x.persona?.kecamatanId ? '' : (x.persona?.desa ?? '')
  const place = jc?.place ?? (desa ? `${desa}, Kec. ${kec}` : kec ? `Kec. ${kec}` : x.region)
  const nToday = (x.today.byCategory[cat] ?? 0) + (jc ? 0 : 1)
  const label = CATEGORY_LABEL[cat]
  const tip = TIPS[cat]
  const cluster = cat === 'banjir' && x.clusterHere ? x.clusterHere : null
  // life safety: the triage forwards it to BPBD at once (triage.ts); the answer says so and gives 112
  if (isEmergency({ text: `${ctx.text} ${jc?.translation?.id ?? ''}`, category: cat })) {
    const sos: Bi = {
      id: `Terima kasih${honor(x, 'id')}. Ini kami tandai DARURAT: tiket ${code} di ${place} langsung diteruskan ke BPBD (triase darurat), tembusan ${opd}. Target respons 1 jam. Bila nyawa terancam sekarang, telepon 112. Utamakan lansia dan anak, pindah ke tempat yang lebih tinggi.`,
      en: `Thank you${honor(x, 'en')}. We have marked this as an EMERGENCY: ticket ${code} in ${place} goes straight to BPBD (emergency triage), copied to ${opd}. Response target 1 hour. If a life is in danger right now, call 112. Put the elderly and children first and move to higher ground.`,
    }
    return {
      ...say(ctx, sos, `Matur nuwun${honor(x, 'jv')}. Punika kula tandhani DARURAT: tiket ${code} langsung dipunaturaken dhateng BPBD. Menawi nyawa kaancam, enggal telpon 112.`),
      structured: { kind: 'ticket', data: { category: label[l], categoryId: cat, summary: (jc?.translation ?? { id: ctx.text, en: ctx.text })[l], urgency: 'tinggi', opd: 'BPBD', location: { kecamatan: kec, desa, detail: place }, kecamatanId: kecId, desaId, language: rl === 'jv' ? 'jv' : 'id', translationId: rl === 'jv' ? (jc?.translation?.id ?? '') : '', slaHours: 1, code, existing: !!jc } },
      toolCalls: [
        { name: 'classify_message', input: { text: ctx.text.slice(0, 60) }, output: { category: cat, emergency: true }, ms: 200 },
        { name: 'create_ticket', input: { category: cat, opd: 'BPBD' }, output: { code }, ms: 260 },
      ],
      followUps: chips(ctx, [{ id: 'Apakah perlu mengungsi?', en: 'Should we evacuate?' }, { id: `Status ${code}`, en: `Status of ${code}` }]),
    }
  }
  const ans: Bi = {
    id: `Terima kasih${honor(x, 'id')}. Laporan ${label.id.toLowerCase()} di ${place} sudah tercatat sebagai tiket ${code}. Setelah diverifikasi petugas, tiket akan diteruskan ke ${opd} (OPD yang disarankan AI). Estimasi tanggapan ${slaText(hours, 'id')}.${tip ? ` ${tip.id}` : ''} Ini laporan ${label.id.toLowerCase()} ke-${nToday} hari ini${cluster ? `; laporan di ${cluster.desa} sudah menjadi klaster ${cluster.complaints} aduan dan dipantau pimpinan` : ''}.`,
    en: `Thank you${honor(x, 'en')}. Your ${label.en.toLowerCase()} report in ${place} is logged as ticket ${code}. Once an officer verifies it, it will be forwarded to ${opd} (the agency the AI suggests). Expected response within ${slaText(hours, 'en')}.${tip ? ` ${tip.en}` : ''} It is report no. ${nToday} of this kind today${cluster ? `; reports in ${cluster.desa} already form a cluster of ${cluster.complaints} and the leadership is watching it` : ''}.`,
  }
  const jv = `Matur nuwun${honor(x, 'jv')}. Laporan ${JV_CAT[cat] ?? label.id.toLowerCase()} ing ${place} sampun kula cathet dados tiket ${code}. Sasampunipun dipunpriksa petugas, badhe dipunaturaken dhateng ${opd}. Paling dangu ${hours < 48 ? `${hours} jam` : `${Math.round(hours / 24)} dinten`} badhe dipuntindaklanjuti.${cat === 'banjir' ? ' Menawi toya taksih minggah, dokumen penting mangga dipunamanaken, listrik dipunpejahi saking meteran.' : ''} Punika laporan ${JV_CAT[cat] ?? label.id.toLowerCase()} kaping-${nToday} dinten punika${cluster ? `; laporan ing ${cluster.desa} sampun dados klaster ${cluster.complaints} aduan lan dipunpantau pimpinan` : ''}.`
  const summary = jc?.translation ?? { id: ctx.text, en: `${label.en} report in ${place}` }
  return {
    ...say(ctx, ans, jv),
    structured: {
      kind: 'ticket',
      data: {
        category: label[l], categoryId: cat, summary: summary[l], urgency: cat === 'banjir' || cat === 'pohon-tumbang' ? 'tinggi' : 'sedang', opd,
        location: { kecamatan: kec, desa, detail: place }, kecamatanId: kecId, desaId, language: rl === 'jv' ? 'jv' : 'id',
        translationId: rl === 'jv' ? (jc?.translation?.id ?? '') : '', slaHours: hours, code, existing: !!jc,
      },
    },
    toolCalls: [
      { name: jc?.channel === 'voice' ? 'transcribe_voice' : 'classify_message', input: { text: ctx.text.slice(0, 60) }, output: { category: cat, language: rl === 'jv' ? 'jv' : rl }, ms: jc?.channel === 'voice' ? 420 : 200 },
      { name: 'geocode', input: { desa, kecamatan: kec }, output: { found: !!kec }, ms: 150 },
      { name: 'create_ticket', input: { category: cat, opd }, output: { code }, ms: 260 },
    ],
    followUps: chips(ctx, [{ id: `Status ${code}`, en: `Status of ${code}` }, cat === 'banjir' ? { id: 'Apakah perlu mengungsi?', en: 'Should we evacuate?' } : CHIP.mpp]),
  }
}

/* ------------------------------------------------------------------ intents */

const svc = (id: string, serviceId: string, examples: string[], extra?: Bi): Intent<SwContext> => ({ id, examples, respond: (ctx) => service(ctx as Ctx, serviceId, extra) })
const rep = (id: string, cat: ComplaintCategory, examples: string[]): Intent<SwContext> => ({ id, examples, respond: (ctx) => report(ctx as Ctx, cat) })

const CODE_RE = /SW-\d{4}-\d{3,4}/i

const intents: Intent<SwContext>[] = [
  /* -------- services: civil registration */
  svc('syarat-ktp-el', 'ktp-el', [
    'KTP-el saya rusak, bagaimana cara ganti?', 'Syarat bikin KTP elektronik', 'KTP hilang, mau buat lagi', 'Cara cetak ulang KTP-el yang retak',
    'My e-ID card is damaged, how do I replace it?', 'How to get a new ID card', 'I lost my ID card',
    'KTP-el kula rusak, pripun carane ngurus?', 'KTP kula ical, badhe damel malih', 'KTPku rusak retak, piye carane?',
  ], { id: 'Untuk lansia ada loket prioritas, cukup tunjukkan KTP lama.', en: 'Senior citizens can use the priority counter; just bring the old card.' }),
  svc('syarat-kk', 'kk', [
    'Syarat bikin kartu keluarga baru', 'Mau ubah data KK setelah menikah', 'Cara tambah anggota keluarga di KK',
    'How do I update my family card?', 'Requirements for a new family card (KK)',
    'Badhe damel KK enggal, syaratipun menapa?', 'Ngganti data KK piye carane?',
  ]),
  svc('syarat-akta-lahir', 'akta-lahir', [
    'Syarat akta kelahiran anak', 'Cara bikin akta lahir bayi', 'Anak saya baru lahir, mau urus akta',
    'How do I get a birth certificate?', 'Birth certificate requirements for my baby',
    'Anakku nembe lair, ngurus akta piye?', 'Syarat akta lair menapa kemawon?',
  ]),
  svc('syarat-akta-kematian', 'akta-kematian', [
    'Syarat akta kematian', 'Orang tua saya meninggal, urus akta kematian bagaimana?', 'Cara lapor kematian ke dukcapil',
    'How do I get a death certificate?', 'Registering a death in the family',
    'Bapak kula seda, ngurus akta pejah pripun?', 'Akta pejah kangge simbah ingkang sampun seda', 'Surat kematian bapak kula',
  ]),
  svc('syarat-pindah', 'pindah-datang', [
    'Syarat surat pindah datang', 'Mau pindah domisili ke kabupaten lain', 'Cara urus SKPWNI', 'Pindah alamat KTP bagaimana?',
    'How do I move my residence registration?', 'Change of address letter requirements',
    'Badhe pindhah griya, ngurus surat pindhah pripun?',
  ]),
  /* -------- services: business & buildings */
  svc('syarat-nib', 'nib-oss', [
    'Syarat bikin NIB apa?', 'Cara daftar NIB lewat OSS', 'Mau urus izin usaha kedai kopi', 'Nomor induk berusaha untuk UMKM', 'Bikin NIB butuh apa saja',
    'What do I need for an NIB?', 'How do I register my business ID number?', 'Business licence for a small coffee shop',
    'Syarate gawe NIB apa wae?', 'Badhe ngurus NIB kangge warung kopi',
  ], { id: 'Formulirnya bisa saya isikan otomatis dari percakapan ini, lalu Anda bisa ambil antrean pendampingan di MPP.', en: 'I can pre-fill the form from this chat, then you can book an assisted slot at the service mall.' }),
  svc('izin-usaha-mikro', 'izin-usaha-mikro', [
    'Pendampingan izin usaha mikro', 'Sertifikat standar untuk usaha kecil', 'Izin usaha rumahan bagaimana',
    'Help with a micro-business permit', 'Permit for a home business',
    'Izin usaha cilik-cilikan piye?',
  ]),
  svc('syarat-pbg', 'pbg', [
    'Syarat PBG bangun rumah', 'Izin mendirikan bangunan sekarang PBG ya?', 'Mau bangun ruko, izinnya apa', 'Cara urus persetujuan bangunan gedung',
    'Building permit requirements', 'How do I get a building approval (PBG)?',
    'Badhe mbangun griya, izine menapa?',
  ]),
  svc('reklame', 'reklame', [
    'Izin pasang reklame atau baliho', 'Pajak papan nama toko', 'Cara izin spanduk promosi',
    'Billboard permit and tax', 'Permit for a shop sign',
    'Masang baliho kudu izin apa?',
  ]),
  svc('keramaian', 'rekom-keramaian', [
    'Izin keramaian untuk hajatan', 'Mau bikin acara konser kampung, izinnya?', 'Rekomendasi izin keramaian',
    'Permit for a village event', 'Crowd permit for a wedding party',
    'Badhe nganakake hajatan, izin keramaian pripun?',
  ]),
  svc('skck', 'pengantar-skck', [
    'Surat pengantar SKCK', 'Syarat bikin SKCK untuk melamar kerja', 'Pengantar catatan kepolisian',
    'Police clearance letter requirements', 'Cover letter for a police certificate',
    'Ngurus SKCK kangge nglamar kerja pripun?',
  ]),
  /* -------- services: tax, health, aid, water */
  svc('pbb', 'pbb', [
    'Cara bayar PBB', 'Cetak SPPT PBB yang hilang', 'Keberatan nilai PBB', 'Mutasi nama di PBB',
    'How do I pay my property tax?', 'Property tax bill reprint',
    'Bayar pajak bumi pripun?', 'SPPT PBB kula ical',
  ]),
  svc('bpjs-daerah', 'pbi-jkn', [
    'Daftar BPJS gratis dari pemda', 'BPJS ditanggung pemerintah daerah syaratnya', 'JKN PBI daerah bagaimana', 'BPJS saya nonaktif',
    'Free health insurance from the regency', 'How to join the regional health coverage',
    'BPJS gratis saking pemda pripun?',
  ]),
  svc('cek-bansos', 'cek-bansos', [
    'Cek status penerima bansos', 'Apakah saya terdaftar penerima bantuan sosial?', 'Nama saya hilang dari daftar bansos', 'Bansos belum cair',
    'Am I registered for social aid?', 'Check my social assistance status',
    'Jeneng kula ical saking daftar bansos', 'Bansos kula dereng cair',
  ], { id: 'Bila nama hilang dari daftar, ajukan sanggahan lewat desa; petugas Dinsos akan memeriksa.', en: 'If your name disappeared, file an objection through the village; Social Affairs will check it.' }),
  svc('sambungan-air', 'sambungan-air', [
    'Pasang baru sambungan air PDAM', 'Daftar langganan air minum', 'Biaya pasang air PDAM',
    'New water connection', 'How to get piped water at home',
    'Pasang banyu PDAM anyar pripun?',
  ]),
  /* -------- info */
  {
    id: 'jadwal-mpp',
    examples: [
      'MPP buka jam berapa?', 'Jadwal pelayanan mal pelayanan publik', 'Hari Sabtu MPP buka tidak?', 'Antrean MPP hari ini ramai?',
      'When is the service mall open?', 'Opening hours of the public service mall',
      'MPP bukak jam pinten?', 'Dinten Setu MPP bikak mboten?',
    ],
    respond: (c) => {
      const ctx = c as Ctx
      const x = w(ctx)
      const ans: Bi = {
        id: `Di demo ini MPP ${x.region} melayani Senin–Jumat pukul 08.00–15.00 (jam layanan contoh, simulasi; pastikan jadwal resmi sebelum datang). Hari ini sudah ada ${x.today.mppBookings} antrean terdaftar; ${x.today.queueAhead} orang terjadwal dalam satu jam ke depan. Ambil antrean dari sini supaya tidak menunggu lama.`,
        en: `In this demo the ${x.region} service mall is open Monday to Friday, 08.00–15.00 (sample hours, simulated; check the official schedule before you go). ${x.today.mppBookings} queue slots are booked today; ${x.today.queueAhead} people are scheduled in the next hour. Book a slot here to avoid waiting.`,
      }
      return { ...say(ctx, ans, `MPP ${x.region} bikak Senin dumugi Jumat, jam 08.00 dumugi 15.00. Dinten menika sampun wonten ${x.today.mppBookings} antrean.`), followUps: chips(ctx, [CHIP.queue, CHIP.ktp]) }
    },
  },
  {
    id: 'lokasi-kantor',
    examples: [
      'Di mana lokasi kantor dukcapil?', 'Alamat MPP di mana?', 'Kantor kecamatan saya di mana', 'Lokasi pelayanan terdekat',
      'Where is the civil registry office?', 'Where is the nearest service office?',
      'Kantor dukcapil nang ngendi?', 'MPP wonten pundi?',
    ],
    respond: (c) => {
      const ctx = c as Ctx
      const x = w(ctx)
      const kec = x.persona?.kecamatan
      const ans: Bi = {
        id: `Layanan tatap muka ada di Mal Pelayanan Publik (MPP) ${x.region} dan di kantor kecamatan (PATEN)${kec ? ` Kec. ${kec}` : ''}. Banyak layanan Dukcapil juga bisa daring. Titik lokasinya tercantum di tiket antrean.`,
        en: `In-person services are at the ${x.region} Public Service Mall (MPP) and at the district office (PATEN)${kec ? ` in ${kec}` : ''}. Many civil-registry services are also online. The exact location is printed on your queue ticket.`,
      }
      return { ...say(ctx, ans), followUps: chips(ctx, [CHIP.queue, CHIP.mpp]) }
    },
  },
  {
    id: 'peringatan-banjir',
    examples: [
      'Apakah perlu mengungsi?', 'Ada peringatan banjir di daerah saya?', 'Posko pengungsian di mana?', 'Air sungai naik, aman tidak?',
      'Should we evacuate?', 'Is there a flood warning for my area?',
      'Kudu ngungsi ora?', 'Wonten peringatan banjir mboten?',
    ],
    respond: (c) => {
      const ctx = c as Ctx
      const x = w(ctx)
      const a = x.alertHere
      const ans: Bi = a
        ? { id: `Ya, ada peringatan dini banjir level ${a.level} untuk Kec. ${a.kecamatan} (BPBD). Siapkan tas siaga, utamakan lansia dan anak, dan ikuti arahan petugas desa. ${a.posko ? `Menuju posko pengungsian ${a.posko}, sesuai peringatan BPBD.` : 'Posko pengungsian dibuka di balai desa terdekat.'} Darurat: 112.`, en: `Yes, there is a level-${a.level} early flood warning for ${a.kecamatan} (BPBD). Prepare a go-bag, put the elderly and children first and follow the village officials. ${a.posko ? `Go to the shelter at ${a.posko}, as the BPBD warning says.` : 'Shelters are open at the nearest village hall.'} Emergency: 112.` }
        : { id: `Saat ini belum ada peringatan dini resmi untuk wilayah Anda${x.clusterHere ? `, tetapi ${x.clusterHere.complaints} laporan banjir di ${x.clusterHere.desa} sedang dipantau BPBD` : ''}. Bila air masuk rumah dan terus naik, segera ke tempat tinggi dan hubungi 112. Peringatan resmi akan masuk ke HP ini.`, en: `There is no official early warning for your area yet${x.clusterHere ? `, but ${x.clusterHere.complaints} flood reports in ${x.clusterHere.desa} are being watched by BPBD` : ''}. If water enters the house and keeps rising, move to higher ground and call 112. Official warnings will arrive on this phone.` }
      const jv = a ? `Inggih, wonten peringatan banjir level ${a.level} kangge Kec. ${a.kecamatan}. Mangga siapaken tas siaga lan nderek arahan petugas desa.${a.posko ? ` Posko pengungsian wonten ${a.posko}.` : ''}` : 'Dereng wonten peringatan resmi. Menawi toya mlebet griya lan taksih minggah, enggal pindhah dhateng papan inggil lan telpon 112.'
      return { ...say(ctx, ans, jv), followUps: chips(ctx, [CHIP.flood, CHIP.status]) }
    },
  },
  /* -------- reports */
  rep('lapor-banjir', 'banjir', [
    'Mau lapor banjir di desa saya', 'Jalan depan rumah kebanjiran setinggi lutut', 'Air sungai meluap masuk ke rumah warga', 'Tanggul sungai bocor, air merembes',
    'I want to report a flood in my village', 'Our street is flooded after the heavy rain', 'The river embankment is leaking',
    'The road is knee-deep in water', 'The yard is waterlogged, water keeps rising', 'Flooded road, motorbikes cannot pass',
    'Tolong evakuasi, lansia terjebak banjir di rumah', 'Air sudah sepinggang, kami butuh perahu karet', 'Ada lansia yang perlu dievakuasi, air masuk rumah', 'Ibu saya terjebak air, mohon dievakuasi',
    'Please evacuate us, the water is waist-deep', 'My grandmother is trapped by the flood, send a boat',
    'Tulung, banyune wis sepinggang, simbah kudu dievakuasi',
    'Banyune munggah tekan omah, dalane kebanjiran', 'Tanggule kali bocor, banyune mrembes terus', 'Kampung kula kebanjiran wiwit wingi', 'Toya Bengawan sampun minggah',
  ]),
  rep('lapor-jalan-rusak', 'jalan-rusak', [
    'Jalan di desa kami rusak parah dan berlubang', 'Ada lubang besar di jalan dekat sekolah', 'Aspal jalan kabupaten mengelupas', 'Jalan cor ambles di pinggir kali',
    'There is a big pothole on the main road', 'The road near the market is badly damaged',
    'Dalane bolong-bolong, akeh sing tiba', 'Margi dhateng desa kula rusak sanget',
  ]),
  rep('lapor-sampah', 'sampah', [
    'Sampah menumpuk tidak diangkut seminggu', 'TPS dekat pasar penuh dan bau', 'Ada pembuangan sampah liar di pinggir jalan',
    'Garbage has not been collected for a week', 'Rubbish piling up near the market',
    'Uwuh numpuk ora diangkut, ambune ora karuan', 'Sampah cedhak pasar dereng dipunangkut',
  ]),
  rep('lapor-pju', 'pju', [
    'Lampu jalan di gang kami mati sudah seminggu', 'PJU depan masjid padam, jalan jadi gelap', 'Lampu penerangan jalan tidak menyala',
    'The streetlights on our road are out', 'A street lamp is broken near the bridge',
    'Lampu dalan mati, peteng banget yen wengi', 'Lampu margi prapatan pejah',
  ]),
  rep('lapor-air-bersih', 'air-bersih', [
    'Air PDAM tidak mengalir tiga hari', 'Air keran keruh dan bau', 'Tidak ada air bersih di kampung kami',
    'There has been no tap water for three days', 'The water supply is muddy',
    'Banyu PDAM ora mili wis telung dina', 'Toya ledeng butheg',
  ]),
  rep('lapor-pohon-tumbang', 'pohon-tumbang', [
    'Pohon tumbang menutup jalan', 'Ada pohon besar roboh kena angin, kabel putus', 'Batang pohon menimpa rumah warga',
    'A fallen tree is blocking the road', 'A big tree came down on the power line',
    'Wit gedhe ambruk nutupi dalan', 'Wit asem ambruk, kabel pedhot',
  ]),
  rep('lapor-pungli', 'pungli', [
    'Saya dimintai uang tanpa kuitansi saat urus surat', 'Ada pungutan liar di kantor desa', 'Oknum minta uang pelicin',
    'I was asked for money without a receipt', 'Someone demanded an illegal fee for a letter',
    'Kula dipunsuwuni arta tanpa kuitansi', 'Wonten pungli wonten kantor desa',
  ]),
  rep('lapor-kesehatan', 'kesehatan', [
    'Antrean puskesmas panjang sekali, dokter cuma satu', 'Ada warga kena demam berdarah, minta fogging', 'Layanan puskesmas kurang baik',
    'The health centre queue is very long', 'Dengue cases in our neighbourhood, please fog',
    'Puskesmas antrine dawa banget', 'Bocah telu kena demam berdarah, tulung difogging',
  ]),
  rep('lapor-sekolah', 'sekolah', [
    'Atap kelas SD bocor dan hampir roboh', 'Bangunan sekolah rusak berat', 'Kelas sekolah anak saya tidak layak',
    'The school roof is leaking and may collapse', 'The classroom building is badly damaged',
    'Atap kelas SD bocor lan kayune growong',
  ]),
  /* -------- tickets & queue */
  {
    id: 'status-tiket',
    examples: [
      'Cek status tiket saya', 'Bagaimana kelanjutan laporan saya?', 'Status SW-2026-0141', 'Lacak tiket aduan', 'Laporan saya sudah ditangani belum?',
      'Check my ticket status', 'What happened to my report?', 'Track my complaint',
      'Laporan kula sampun dipuntindaklanjuti dereng?', 'Tiketku piye kabare?',
    ],
    respond: (c) => {
      const ctx = c as Ctx
      const x = w(ctx)
      const want = CODE_RE.exec(ctx.text)?.[0]?.toUpperCase()
      const t = (want ? x.myTickets.find((k) => k.code.toUpperCase() === want) : undefined) ?? x.myTickets[0]
      if (!t) {
        return {
          ...say(ctx, want ? { id: `Tiket ${want} tidak ditemukan untuk nomor HP ini. Periksa lagi nomornya, atau kirim laporan baru.`, en: `Ticket ${want} is not linked to this phone number. Check the number, or send a new report.` } : { id: 'Belum ada tiket atas nomor HP ini. Ceritakan masalahnya, saya buatkan tiket.', en: 'There is no ticket for this phone number yet. Tell me the problem and I will open one.' }, 'Dereng wonten tiket atas nomer menika. Mangga dipuncariyosaken masalahipun.'),
          structured: want ? { kind: 'ticket-status', data: { ticketCode: want, status: 'tidak-ditemukan' } } : undefined,
          followUps: chips(ctx, [CHIP.flood, CHIP.officer]),
        }
      }
      const st: Record<string, Bi> = {
        baru: { id: 'baru masuk dan menunggu verifikasi petugas', en: 'new and waiting for an officer to verify it' },
        diverifikasi: { id: 'sudah diverifikasi petugas', en: 'verified by an officer' },
        diteruskan: { id: `sudah diteruskan ke ${t.opd}`, en: `forwarded to ${t.opd}` },
        diproses: { id: `sedang dikerjakan ${t.opd}`, en: `being handled by ${t.opd}` },
        selesai: { id: 'sudah selesai', en: 'resolved' },
      }
      const s = st[t.status] ?? st.baru!
      const left = t.status === 'selesai' ? '' : t.slaLeftMin >= 0 ? slaText(Math.max(1, Math.round(t.slaLeftMin / 60)), 'id') : ''
      const leftEn = t.status === 'selesai' ? '' : t.slaLeftMin >= 0 ? slaText(Math.max(1, Math.round(t.slaLeftMin / 60)), 'en') : ''
      const ans: Bi = {
        id: `Tiket ${t.code} (${CATEGORY_LABEL[t.category].id.toLowerCase()}) ${s.id}.${left ? ` Sisa waktu target layanan ${left}.` : t.status === 'selesai' ? (t.rating ? ` Terima kasih atas rating ${t.rating} bintang.` : ' Mohon beri rating 1–5 di pesan pembaruan.') : ' Target waktunya sudah lewat; saya tandai agar diprioritaskan.'}`,
        en: `Ticket ${t.code} (${CATEGORY_LABEL[t.category].en.toLowerCase()}) is ${s.en}.${leftEn ? ` ${leftEn} left on the service target.` : t.status === 'selesai' ? (t.rating ? ` Thanks for the ${t.rating}-star rating.` : ' Please rate 1–5 in the update message.') : ' The target time has passed; I flagged it for priority.'}`,
      }
      return {
        ...say(ctx, ans, `Tiket ${t.code} ${t.status === 'selesai' ? 'sampun rampung' : t.status === 'baru' ? 'nembe mlebet, ngentosi verifikasi petugas' : `sampun dipunasta ${t.opd}`}.`),
        structured: { kind: 'ticket-status', data: { ticketCode: t.code, ticketId: t.ticketId, status: t.status, opd: t.opd, eta: left || undefined } },
        toolCalls: [{ name: 'ticket_status', input: { ticketCode: t.code }, output: { status: t.status }, ms: 140 }],
        followUps: chips(ctx, [CHIP.officer]),
      }
    },
  },
  {
    id: 'ambil-antrean',
    examples: [
      'Ambil antrean MPP', 'Mau booking antrean jam 10', 'Daftar antrean online', 'Saya mau datang ke MPP besok pagi',
      'Book a service-mall slot', 'I want to book a queue number', 'Reserve a time at the service mall',
      'Badhe mendhet antrean MPP', 'Pesen antrean jam sepuluh',
    ],
    respond: (c) => {
      const ctx = c as Ctx
      const x = w(ctx)
      const key = x.persona?.key
      const sv = x.services.find((s) => s.id === (key === 'raka' ? 'nib-oss' : 'ktp-el')) ?? x.services[0]
      const l: 'id' | 'en' = rlOf(ctx) === 'jv' ? ctx.lang : (rlOf(ctx) as 'id' | 'en')
      return {
        ...say(ctx, { id: `Baik. Pilih jam datang di bawah untuk ${sv?.name.id ?? 'layanan'} di MPP ${x.region}. Slot 30 menit; ${x.today.queueAhead} orang terjadwal dalam satu jam ke depan.`, en: `Sure. Pick a time below for ${sv?.name.en ?? 'the service'} at the ${x.region} service mall. 30-minute slots; ${x.today.queueAhead} people are scheduled in the next hour.` }, 'Inggih. Mangga pilih jam rawuh ing ngandhap menika.'),
        structured: { kind: 'sapa-warga/slot-pick', data: { serviceId: sv?.id ?? 'ktp-el', service: sv?.name[l] ?? '' } },
        toolCalls: [{ name: 'book_queue', input: { serviceId: sv?.id ?? '' }, output: { slots: SW.slotCount }, ms: 150 }],
      }
    },
  },
  /* -------- after the NIB: a referral to business capital (UMKM finance; simulated referral, no lender named) */
  {
    id: 'modal-usaha',
    examples: [
      'Butuh modal usaha?', 'Mau pinjam modal untuk kedai', 'Cara dapat KUR untuk UMKM', 'Pinjaman modal usaha mikro', 'Setelah NIB bisa ajukan KUR?',
      'Need business capital?', 'How do I get a small business loan?', 'Microcredit for my coffee stall',
      'Butuh modal kangge usaha', 'Badhe nyambut modal usaha pripun?',
    ],
    respond: (c) => {
      const ctx = c as Ctx
      const x = w(ctx)
      const rl = rlOf(ctx)
      const l: 'id' | 'en' = rl === 'jv' ? ctx.lang : rl
      const opd = 'Dinas Koperasi & UMKM'
      const reqs: Bi[] = [
        { id: 'NIB (dari OSS, langkah sebelumnya)', en: 'NIB (from OSS, the previous step)' },
        { id: 'KTP-el dan KK', en: 'e-ID card and family card' },
        { id: 'Catatan usaha sederhana: omzet dan pengeluaran 3 bulan', en: 'Simple business records: 3 months of turnover and costs' },
        { id: 'Foto tempat usaha', en: 'Photo of the business premises' },
      ]
      return {
        ...say(
          ctx,
          {
            id: `Bisa${honor(x, 'id')}. NIB biasanya diminta saat mengajukan pembiayaan usaha mikro seperti KUR di bank penyalur atau pinjaman koperasi. Saya buatkan rujukan ke ${opd} ${x.region} untuk pendampingan; bunga dan plafon mengikuti ketentuan lembaga pembiayaan. Rujukan ini simulasi demo.`,
            en: `Yes${honor(x, 'en')}. An NIB is usually asked for when applying for micro-business finance such as KUR at a lending bank or a cooperative loan. I have made a referral to the ${x.region} ${opd} for guidance; rates and limits follow the lender's rules. This referral is a demo simulation.`,
          },
          `Saged${honor(x, 'jv')}. NIB limrahipun dipunsuwun menawi ngajokaken KUR utawi pinjaman koperasi. Kula damelaken rujukan dhateng ${opd}.`,
        ),
        structured: {
          kind: 'checklist',
          data: {
            serviceId: 'rujukan-modal', service: l === 'id' ? 'rujukan modal usaha (simulasi)' : 'business capital referral (simulated)', requirements: reqs.map((r) => r[l]), office: opd, fee: l === 'id' ? 'Pendampingan gratis' : 'Free guidance', channel: 'dinas',
            // a simulated referral number and status, so the referral can be followed up (not a real register)
            refNo: refNo(x), refStatus: l === 'id' ? 'Dijadwalkan pendampingan (simulasi)' : 'Mentoring scheduled (simulated)',
          },
        },
        toolCalls: [{ name: 'lookup_service', input: { query: ctx.text.slice(0, 60) }, output: { opd, refNo: refNo(x) }, ms: 150 }],
        followUps: chips(ctx, [CHIP.queue]),
      }
    },
  },
  /* -------- conversation */
  {
    id: 'salam',
    examples: ['Halo', 'Selamat pagi', 'Assalamualaikum', 'Permisi, mau tanya', 'Hello', 'Good morning', 'Hi there', 'Sugeng enjing', 'Kulanuwun', 'Nuwun sewu, badhe tanglet'],
    respond: (c) => {
      const ctx = c as Ctx
      const x = w(ctx)
      return {
        ...say(ctx, { id: `Selamat datang di layanan warga ${x.region}${honor(x, 'id')}. Saya bisa menjelaskan syarat layanan, mengambilkan antrean MPP, atau mencatat aduan Anda. Hari ini sudah ${x.today.complaints} aduan masuk.`, en: `Welcome to the ${x.region} citizen service${honor(x, 'en')}. I can explain service requirements, book a service-mall slot or log your complaint. ${x.today.complaints} complaints came in today.` }, `Sugeng rawuh ing layanan warga ${x.region}${honor(x, 'jv')}. Wonten ingkang saged kula biyantu?`),
        followUps: chips(ctx, [CHIP.nib, CHIP.ktp, CHIP.flood]),
      }
    },
  },
  {
    id: 'terima-kasih',
    examples: ['Terima kasih', 'Makasih banyak ya', 'Oke siap, terima kasih', 'Thank you', 'Thanks a lot', 'Matur nuwun', 'Matur nuwun sanget', 'Suwun'],
    respond: (c) => {
      const ctx = c as Ctx
      const x = w(ctx)
      return say(ctx, { id: `Sama-sama${honor(x, 'id')}. Pembaruan tiket akan masuk otomatis ke percakapan ini.`, en: `You are welcome${honor(x, 'en')}. Ticket updates will arrive in this chat automatically.` }, `Sami-sami${honor(x, 'jv')}. Kabar tiket badhe mlebet piyambak wonten obrolan menika.`)
    },
  },
  {
    id: 'teruskan-petugas',
    examples: ['Teruskan ke petugas', 'Saya mau bicara dengan petugas', 'Minta dihubungi petugas', 'Bisa sambungkan ke manusia?', 'Forward to an officer', 'I want to talk to a person', 'Nyuwun dipunaturaken dhateng petugas', 'Kula badhe matur kaliyan petugas'],
    respond: (c) => {
      const ctx = c as Ctx
      const x = w(ctx)
      const prev = [...ctx.history].reverse().find((m) => m.role === 'user' && !/petugas|officer|person|manusia/i.test(m.content))?.content ?? ctx.text
      return {
        ...say(ctx, { id: `Baik, pertanyaan Anda saya teruskan ke petugas layanan sebagai tiket ${x.nextCode}. Petugas akan membalas di percakapan ini pada jam kerja.`, en: `All right, I am forwarding your question to a service officer as ticket ${x.nextCode}. An officer will reply in this chat during office hours.` }, `Inggih, pitakenan panjenengan kula aturaken dhateng petugas dados tiket ${x.nextCode}.`),
        structured: { kind: 'ticket', data: { category: CATEGORY_LABEL.lainnya[ctx.lang], categoryId: 'lainnya', summary: prev.slice(0, 200), urgency: 'sedang', opd: x.categoryOpd.lainnya ?? 'OPD', language: rlOf(ctx) === 'jv' ? 'jv' : 'id', slaHours: SW.slaDays.lainnya * 24, code: x.nextCode, kecamatanId: x.persona?.kecamatanId ?? '', desaId: x.persona?.desaId ?? '', handoff: true, text: prev } },
        toolCalls: [{ name: 'create_ticket', input: { category: 'lainnya', handoff: true }, output: { code: x.nextCode }, ms: 220 }],
      }
    },
  },
]

export const sapaWargaScenario: Scenario<SwContext> = {
  product: 'sapa-warga',
  threshold: 0.3,
  intents,
  fallback: (c) => {
    const ctx = c as Ctx
    const x = w(ctx)
    // a complaint the intents missed: still open a ticket when the text clearly is one
    return {
      ...say(ctx, { id: `Maaf${honor(x, 'id')}, saya belum yakin maksudnya. Coba salah satu pertanyaan di bawah, atau saya teruskan ke petugas layanan.`, en: `Sorry${honor(x, 'en')}, I am not sure what you mean yet. Try one of the questions below, or I can forward it to a service officer.` }, `Nyuwun pangapunten${honor(x, 'jv')}, kula dereng mangertos. Mangga pilih pitakenan ing ngandhap, utawi kula aturaken dhateng petugas.`),
      followUps: chips(ctx, [CHIP.nib, CHIP.status, CHIP.bansos, CHIP.officer]),
    }
  },
}
