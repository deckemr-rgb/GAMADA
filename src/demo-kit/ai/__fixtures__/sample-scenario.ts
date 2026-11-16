/**
 * ai/__fixtures__/sample-scenario.ts — TEST FIXTURE for the ai module (self-tests + /lab/_kit showcase).
 * Not registered by default and not the real Sapa Warga scenario (that lives in demos/sapa-warga/scenario.ts,
 * tahap 2). 8 intents (ID · EN · Basa Jawa), one answered in Basa Jawa with a translation, a polite fallback
 * with "teruskan ke petugas". Answers read a tiny fixture world through ctx.world (narrowed with guards).
 * Kecamatan names are the real 28 districts of Kabupaten Bojonegoro; every ticket and person is fictional.
 */
import type { Extracted, ExtractRequest, Lang, Scenario, SimContext, SimResponse } from '../types'

/* ------------------------------------------------------------------ fixture world */

export interface FixtureTicket {
  id: string
  category: { id: string; en: string }
  kecamatan: string | null
  opd: string
  status: 'baru' | 'diproses' | 'selesai'
}
export interface FixtureWorld {
  complaintsToday: number
  tickets: Record<string, FixtureTicket>
  /** newest first */
  ticketIds: string[]
}

export function createFixtureWorld(): FixtureWorld {
  const seed: FixtureTicket[] = [
    { id: 'SW-2417', category: { id: 'Jalan rusak', en: 'Damaged road' }, kecamatan: 'Dander', opd: 'Dinas PU Bina Marga', status: 'diproses' },
    { id: 'SW-2416', category: { id: 'Lampu jalan mati', en: 'Streetlight out' }, kecamatan: 'Kapas', opd: 'Dinas Perhubungan', status: 'selesai' },
  ]
  return { complaintsToday: 37, tickets: Object.fromEntries(seed.map((t) => [t.id, t])), ticketIds: seed.map((t) => t.id) }
}

function readWorld(w: unknown): FixtureWorld {
  const o = (w ?? {}) as Partial<FixtureWorld>
  return {
    complaintsToday: typeof o.complaintsToday === 'number' ? o.complaintsToday : 0,
    tickets: o.tickets && typeof o.tickets === 'object' ? o.tickets : {},
    ticketIds: Array.isArray(o.ticketIds) ? o.ticketIds : [],
  }
}

/** Apply the fixture's emits to a fixture world (what the world store's reducers do for real). */
export function applyFixtureEmits(w: FixtureWorld, emits: { type: string; payload: Record<string, unknown> }[]): FixtureWorld {
  let next = w
  for (const e of emits) {
    if (e.type !== 'complaint.created') continue
    const t = e.payload.ticket as FixtureTicket | undefined
    if (!t || next.tickets[t.id]) continue
    next = { complaintsToday: next.complaintsToday + 1, tickets: { ...next.tickets, [t.id]: t }, ticketIds: [t.id, ...next.ticketIds] }
  }
  return next
}

/* ------------------------------------------------------------------ helpers */

export const KECAMATAN_BOJONEGORO = [
  'Margomulyo', 'Ngraho', 'Tambakrejo', 'Ngambon', 'Sekar', 'Bubulan', 'Gondang', 'Temayang', 'Sugihwaras', 'Kedungadem',
  'Kepohbaru', 'Baureno', 'Kanor', 'Sumberrejo', 'Balen', 'Sukosewu', 'Kapas', 'Bojonegoro', 'Trucuk', 'Dander', 'Ngasem',
  'Kalitidu', 'Malo', 'Purwosari', 'Padangan', 'Kasiman', 'Kedewan', 'Gayam',
]

const JAWA_MARKERS = /\b(banyu|munggah|omah|omahe|omahku|kelebon|dalan|akeh|tiba|peteng|wengi|banget|sing|ngarep|yen|maneh|kudu|wae|mawon|kalih|kula|kulo|dereng|durung|sampun|wis|uwis|uwuh|uwuhe|nyuwun|tulung|mboten|ora|niki|iki|dalane|banyune|pinten|piro|napa|opo|kapan\s+dijupuk|dijupuk|dipundhut|neng|ning|ing|lan|mambu|ambune|kebak|wingi|matur|badhe|tekan|ngendi)\b/gi
/** Rough Basa Jawa detector: ≥ 2 Jawa function words. */
export function looksJawa(text: string): boolean {
  return (text.match(JAWA_MARKERS) ?? []).length >= 2
}

const L = <T,>(lang: Lang, v: { id: T; en: T }): T => v[lang]

function nextTicketId(w: FixtureWorld): string {
  const max = w.ticketIds.reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, '')) || 0), 2400 + w.complaintsToday)
  return `SW-${max + 1}`
}

interface ReportSpec {
  category: { id: string; en: string }
  opd: string
  urgency: { id: string; en: string }
  slaHours: number
}

function report(ctx: SimContext, slots: Record<string, string>, spec: ReportSpec, text: { id: string; en: string }, jw?: string): SimResponse {
  const w = readWorld(ctx.world)
  const id = nextTicketId(w)
  const kec = slots.kecamatan ?? null
  const ticket: FixtureTicket = { id, category: spec.category, kecamatan: kec, opd: spec.opd, status: 'baru' }
  const fill = (s: string) =>
    s
      .replace('{id}', id)
      .replace('{kec}', kec ?? L(ctx.lang, { id: 'lokasi Anda', en: 'your location' }))
      .replace('{n}', String(w.complaintsToday + 1))
      .replace('{sla}', String(spec.slaHours))
  const res: SimResponse = {
    text: fill(jw ?? text[ctx.lang]),
    structured: {
      kind: 'ticket',
      data: { id, category: spec.category[ctx.lang], opd: spec.opd, urgency: spec.urgency[ctx.lang], kecamatan: kec ?? '—', sla: `${spec.slaHours} ${L(ctx.lang, { id: 'jam', en: 'h' })}` },
    },
    toolCalls: [
      { name: 'classify_message', input: { text: ctx.text.slice(0, 80) }, output: { category: spec.category.id }, ms: 210 },
      { name: 'geocode', input: { kecamatan: kec ?? '?' }, output: kec ? { kabupaten: 'Bojonegoro', kecamatan: kec } : { needsPin: true }, ms: 160 },
      { name: 'create_ticket', input: { category: spec.category.id, opd: spec.opd }, output: { id }, ms: 290 },
    ],
    followUps: [L(ctx.lang, { id: `Cek status ${id}`, en: `Check status ${id}` }), L(ctx.lang, { id: 'Teruskan ke petugas', en: 'Forward to an officer' })],
    emits: [{ type: 'complaint.created', payload: { ticket, source: 'sapa-warga' } }],
  }
  if (jw) res.translation = fill(text[ctx.lang])
  return res
}

const kecSlot = { kecamatan: KECAMATAN_BOJONEGORO }

/* ------------------------------------------------------------------ scenario */

export const sampleScenario: Scenario<FixtureWorld> = {
  product: 'sapa-warga',
  threshold: 0.32,
  intents: [
    {
      id: 'lapor-banjir',
      examples: [
        'Mau lapor banjir di desa saya',
        'Jalan depan rumah kebanjiran setinggi lutut',
        'Air sungai meluap masuk ke rumah warga',
        'Ada genangan air tinggi di Kalitidu',
        'I want to report a flood in my village',
        'Our street is flooded after the heavy rain',
        'Banyune munggah tekan omah, dalane kebanjiran',
        'Kampung kula kebanjiran wiwit wingi',
      ],
      slots: kecSlot,
      respond: (ctx, slots) =>
        report(
          ctx,
          slots,
          { category: { id: 'Banjir & genangan', en: 'Flood & waterlogging' }, opd: 'BPBD', urgency: { id: 'Tinggi', en: 'High' }, slaHours: 4 },
          {
            id: 'Terima kasih, laporan banjir di {kec} sudah kami catat sebagai tiket {id} dan diteruskan ke BPBD. Tim siaga dijadwalkan meninjau dalam {sla} jam. Bila air terus naik, amankan dokumen penting dan matikan listrik dari meteran. Ini aduan ke-{n} hari ini.',
            en: 'Thank you, the flood report in {kec} is logged as ticket {id} and forwarded to BPBD. The standby team will inspect within {sla} hours. If the water keeps rising, secure important documents and switch off power at the meter. This is complaint #{n} today.',
          },
          looksJawa(ctx.text)
            ? 'Matur nuwun, laporan banjir ing {kec} sampun kula cathet dados tiket {id} lan kula aturaken dhateng BPBD. Tim siaga badhe mriksa paling dangu {sla} jam. Menawi toya taksih minggah, dokumen penting mangga dipunamanaken.'
            : undefined,
        ),
    },
    {
      id: 'lapor-jalan-rusak',
      examples: [
        'Jalan di desa kami rusak parah dan berlubang',
        'Ada lubang besar di jalan dekat sekolah, bahaya untuk motor',
        'Aspal jalan kabupaten mengelupas',
        'Mau lapor jalan rusak di Dander',
        'There is a big pothole on the main road',
        'The road near the market is badly damaged',
        'Dalane bolong-bolong, akeh sing tiba',
        'Dalan menyang desa kula rusak sanget',
      ],
      slots: kecSlot,
      respond: (ctx, slots) =>
        report(
          ctx,
          slots,
          { category: { id: 'Jalan rusak', en: 'Damaged road' }, opd: 'Dinas PU Bina Marga', urgency: { id: 'Sedang', en: 'Medium' }, slaHours: 72 },
          {
            id: 'Laporan jalan rusak di {kec} kami terima sebagai tiket {id} untuk Dinas PU Bina Marga. Petugas akan memasang rambu sementara lalu menjadwalkan penambalan, target {sla} jam. Bila sempat, kirim foto dan titik lokasi agar perbaikan lebih cepat.',
            en: 'Your damaged-road report in {kec} is ticket {id} for the Public Works Office. Officers will place temporary signs and schedule patching, target {sla} hours. If you can, send a photo and a location pin to speed things up.',
          },
          looksJawa(ctx.text)
            ? 'Matur nuwun, laporan dalan rusak ing {kec} sampun dados tiket {id} kangge Dinas PU Bina Marga. Petugas badhe masang rambu rumiyin, lajeng ndandosi paling dangu {sla} jam.'
            : undefined,
        ),
    },
    {
      id: 'lampu-pju-mati',
      examples: [
        'Lampu jalan di gang kami mati sudah seminggu',
        'PJU depan masjid padam, jalan jadi gelap',
        'Lampu penerangan jalan tidak menyala',
        'The streetlights on our road are out',
        'A street lamp is broken near the bridge',
        'Lampu dalan mati, peteng banget yen wengi',
      ],
      slots: kecSlot,
      respond: (ctx, slots) =>
        report(
          ctx,
          slots,
          { category: { id: 'Lampu jalan mati', en: 'Streetlight out' }, opd: 'Dinas Perhubungan', urgency: { id: 'Sedang', en: 'Medium' }, slaHours: 48 },
          {
            id: 'Lampu jalan padam di {kec} sudah tercatat sebagai tiket {id} untuk Dinas Perhubungan. Regu PJU biasanya datang malam hari; target perbaikan {sla} jam.',
            en: 'The streetlight outage in {kec} is logged as ticket {id} for the Transport Office. The streetlight crew usually comes in the evening; target fix {sla} hours.',
          },
          looksJawa(ctx.text) ? 'Lampu dalan ingkang mati ing {kec} sampun kula cathet dados tiket {id} kangge Dinas Perhubungan. Regu PJU badhe ndandosi paling dangu {sla} jam.' : undefined,
        ),
    },
    {
      // the Basa Jawa intent: examples are Jawa, the answer is in Jawa (krama) with a translation
      id: 'sampah-jawa',
      examples: [
        'Uwuh ing pinggir dalan durung diangkut seminggu',
        'Uwuhe numpuk lan mambu, kapan dijupuk?',
        'Nyuwun tulung, uwuh ing RT kula dereng dipundhut',
        'Tong uwuh neng pasar wis kebak, ambune ora enak',
        'Sampah di TPS belum diangkut',
        'Garbage has not been collected for a week',
      ],
      slots: kecSlot,
      respond: (ctx, slots) =>
        report(
          ctx,
          slots,
          { category: { id: 'Sampah belum diangkut', en: 'Uncollected waste' }, opd: 'Dinas Lingkungan Hidup', urgency: { id: 'Sedang', en: 'Medium' }, slaHours: 48 },
          {
            id: 'Terima kasih atas laporannya. Sampah di {kec} sudah kami catat sebagai tiket {id} dan kami teruskan ke Dinas Lingkungan Hidup. Armada pengangkut dijadwalkan datang paling lambat {sla} jam.',
            en: 'Thank you for the report. The waste in {kec} is logged as ticket {id} and forwarded to the Environment Office. A collection truck is scheduled within {sla} hours.',
          },
          looksJawa(ctx.text)
            ? 'Matur nuwun laporanipun. Uwuh ing {kec} sampun kula cathet dados tiket {id} lan kula aturaken dhateng Dinas Lingkungan Hidup. Armada badhe rawuh paling dangu {sla} jam.'
            : undefined,
        ),
    },
    {
      id: 'syarat-ktp',
      examples: [
        'Syarat bikin KTP baru apa saja?',
        'Bagaimana cara membuat e-KTP?',
        'KTP saya hilang, mengurusnya bagaimana?',
        'What do I need to get an ID card?',
        'How do I replace a lost KTP?',
        'Badhe damel KTP, syarate napa mawon?',
      ],
      respond: (ctx) => ({
        text: L(ctx.lang, {
          id: 'Untuk KTP-el baru: berusia 17 tahun atau sudah menikah, bawa Kartu Keluarga, lalu lakukan perekaman di Disdukcapil atau Mal Pelayanan Publik. KTP hilang cukup membawa surat kehilangan dari kepolisian dan KK. Layanan ini gratis.',
          en: 'For a new e-KTP: be 17 or married, bring your Family Card (KK), then do the biometric recording at Disdukcapil or the Public Service Mall. For a lost KTP, bring a police loss report and your KK. The service is free.',
        }),
        structured: { kind: 'info', data: { service: 'KTP-el', place: L(ctx.lang, { id: 'Disdukcapil / MPP', en: 'Disdukcapil / Public Service Mall' }), cost: L(ctx.lang, { id: 'Gratis', en: 'Free' }) } },
        toolCalls: [{ name: 'search_knowledge', input: { q: 'syarat KTP-el' }, output: { hits: 3 }, ms: 240 }],
        followUps: [L(ctx.lang, { id: 'Jam layanan MPP?', en: 'Public Service Mall opening hours?' }), L(ctx.lang, { id: 'Teruskan ke petugas', en: 'Forward to an officer' })],
      }),
    },
    {
      id: 'cek-status',
      examples: [
        'Cek status laporan SW-2417',
        'Laporan saya sudah sampai mana?',
        'Bagaimana perkembangan aduan saya?',
        'What is the status of my report?',
        'Track ticket SW-2410',
        'Laporanku wis tekan ngendi?',
      ],
      slots: { ticket: /\b(SW-?\d{3,6})\b/i },
      respond: (ctx, slots) => {
        const w = readWorld(ctx.world)
        const want = slots.ticket?.toUpperCase().replace(/^SW-?/, 'SW-')
        const id = want ?? w.ticketIds[0]
        const t = id ? w.tickets[id] : undefined
        if (!t) {
          return {
            text: L(ctx.lang, {
              id: `Tiket ${id ?? ''} tidak kami temukan. Pastikan nomornya benar (format SW-1234), atau buat laporan baru.`.replace('  ', ' '),
              en: `We could not find ticket ${id ?? ''}. Check the number (format SW-1234), or file a new report.`.replace('  ', ' '),
            }),
            toolCalls: [{ name: 'lookup_ticket', input: { id: id ?? null }, output: null, ms: 120 }],
            followUps: [L(ctx.lang, { id: 'Teruskan ke petugas', en: 'Forward to an officer' })],
          }
        }
        const st = { baru: { id: 'baru diterima', en: 'just received' }, diproses: { id: 'sedang diproses', en: 'in progress' }, selesai: { id: 'selesai', en: 'resolved' } }[t.status]
        return {
          text: L(ctx.lang, {
            id: `Tiket ${t.id} (${t.category.id}${t.kecamatan ? `, ${t.kecamatan}` : ''}) ${st.id} oleh ${t.opd}. Anda akan mendapat pesan otomatis setiap ada perubahan status.`,
            en: `Ticket ${t.id} (${t.category.en}${t.kecamatan ? `, ${t.kecamatan}` : ''}) is ${st.en} by ${t.opd}. You will get an automatic message whenever the status changes.`,
          }),
          structured: { kind: 'ticket-status', data: { id: t.id, status: st[ctx.lang], opd: t.opd } },
          toolCalls: [{ name: 'lookup_ticket', input: { id: t.id }, output: { status: t.status }, ms: 130 }],
          followUps: [L(ctx.lang, { id: 'Teruskan ke petugas', en: 'Forward to an officer' })],
        }
      },
    },
    {
      id: 'jam-layanan',
      examples: [
        'Jam buka MPP kapan?',
        'Kantor Dukcapil buka jam berapa?',
        'Apakah hari Sabtu buka?',
        'What are the opening hours?',
        'Is the public service mall open on Saturday?',
        'MPP bukak jam pinten?',
      ],
      respond: (ctx) => ({
        text: L(ctx.lang, {
          id: 'Mal Pelayanan Publik buka Senin–Kamis 08.00–15.00 dan Jumat 08.00–11.00 WIB. Sabtu, Minggu, dan hari libur nasional tutup. Ambil nomor antrean daring agar tidak menunggu lama.',
          en: 'The Public Service Mall is open Monday–Thursday 08:00–15:00 and Friday 08:00–11:00 WIB. Closed on weekends and public holidays. Book a queue number online to avoid waiting.',
        }),
        structured: { kind: 'info', data: { place: 'MPP', hours: L(ctx.lang, { id: 'Sen–Kam 08.00–15.00', en: 'Mon–Thu 08:00–15:00' }) } },
        followUps: [L(ctx.lang, { id: 'Syarat bikin KTP?', en: 'What do I need for an ID card?' })],
      }),
    },
    {
      id: 'teruskan-petugas',
      examples: [
        'Teruskan ke petugas',
        'Saya mau bicara dengan petugas',
        'Sambungkan ke operator manusia',
        'Talk to a human please',
        'Connect me to an officer',
        'Kula badhe matur kalih petugas',
      ],
      respond: (ctx) => {
        const w = readWorld(ctx.world)
        const queue = 1 + (w.complaintsToday % 4)
        return {
          text: L(ctx.lang, {
            id: `Baik, percakapan ini kami teruskan ke Petugas Layanan beserta ringkasannya. Posisi antrean Anda: ${queue}. Petugas biasanya membalas dalam 5 menit pada jam kerja.`,
            en: `Sure, this conversation is forwarded to a Service Officer with a summary. Your queue position: ${queue}. Officers usually reply within 5 minutes during office hours.`,
          }),
          structured: { kind: 'handoff', data: { queue: L(ctx.lang, { id: 'Petugas Layanan', en: 'Service Officer' }), position: queue } },
          toolCalls: [
            { name: 'summarize_thread', input: { turns: ctx.history.length }, output: { chars: 180 }, ms: 260 },
            { name: 'handoff', input: { queue: 'petugas' }, output: { position: queue }, ms: 110 },
          ],
        }
      },
    },
  ],
  fallback: (ctx) => ({
    text: L(ctx.lang, {
      id: 'Maaf, saya belum memahami pertanyaan itu. Saya bisa membantu laporan banjir, jalan rusak, lampu jalan, sampah, syarat KTP, jam layanan, dan cek status tiket. Atau pesan Anda bisa saya teruskan ke petugas.',
      en: "Sorry, I didn't quite get that. I can help with flood, road, streetlight and waste reports, ID card requirements, opening hours and ticket status. Or I can forward your message to an officer.",
    }),
    followUps: [
      L(ctx.lang, { id: 'Mau lapor jalan rusak', en: 'Report a damaged road' }),
      L(ctx.lang, { id: 'Syarat bikin KTP?', en: 'What do I need for an ID card?' }),
      L(ctx.lang, { id: 'Teruskan ke petugas', en: 'Forward to an officer' }),
    ],
  }),
  extract: (req: ExtractRequest): Extracted => ({
    kind: req.kind,
    mode: 'sim',
    fields: [
      { key: 'nama', label: { id: 'Nama', en: 'Name' }, value: 'Sri Wahyuningsih', confidence: 0.97, box: { x: 18, y: 22, w: 46, h: 5 } },
      { key: 'desa', label: { id: 'Desa/Kel.', en: 'Village' }, value: 'Ngumpakdalem, Dander', confidence: 0.93, box: { x: 18, y: 30, w: 52, h: 5 } },
      { key: 'keperluan', label: { id: 'Keperluan', en: 'Purpose' }, value: req.sampleId === 'pengantar-ktp' ? 'Perekaman KTP-el' : 'Surat keterangan domisili', confidence: 0.88, box: { x: 18, y: 38, w: 60, h: 5 } },
    ],
    checks: [
      { id: 'stamp', label: { id: 'Stempel RT/RW', en: 'RT/RW stamp' }, status: 'ok' },
      { id: 'date', label: { id: 'Tanggal berlaku', en: 'Valid date' }, status: 'warn', note: 'H-3' },
    ],
    tamper: [{ x: 60, y: 70, w: 20, h: 10, score: 0.12 }],
  }),
}

/** Starter prompts per language (showcase). */
export const SAMPLE_PROMPTS: Record<Lang, string[]> = {
  id: ['Dalane bolong neng Dander, akeh sing tiba', 'Syarat bikin KTP baru apa saja?', 'Cek status SW-2417'],
  en: ['Our street in Kalitidu is flooded', 'What do I need to get an ID card?', 'Check status SW-2417'],
}
