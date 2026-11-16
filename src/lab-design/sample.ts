/**
 * sample.ts — ONE shared data set for the three tahap-0 visual directions (/lab/_design), so the
 * directions are judged on look & motion, not on different content. Everything here is fictional
 * placeholder data ("contoh"); the real region pack arrives in tahap 1.
 */

export type DirectionId = 'editorial' | 'senja' | 'tenang'

export const DIRECTIONS: { id: DirectionId; code: string; name: { id: string; en: string }; brief: { id: string; en: string } }[] = [
  {
    id: 'editorial',
    code: 'A',
    name: { id: 'Presisi editorial', en: 'Editorial precision' },
    brief: {
      id: 'Seperti laporan riset kelas atas: grid tegas, garis rambut, angka besar Fraunces, banyak ruang kosong, warna aksen dipakai hemat.',
      en: 'Like a premium research report: firm grid, hairlines, large Fraunces numerals, generous space, accent colour used sparingly.',
    },
  },
  {
    id: 'senja',
    code: 'B',
    name: { id: 'Sinematik senja', en: 'Cinematic dusk' },
    brief: {
      id: 'Meneruskan beranda: permukaan bergradien senja, cahaya lembut di tepi, aksen yang berpendar, momen gerak yang terasa “wow”.',
      en: 'Continues the home page: dusk-gradient surfaces, soft edge light, glowing accents, motion moments that feel “wow”.',
    },
  },
  {
    id: 'tenang',
    code: 'C',
    name: { id: 'Data-dense tenang', en: 'Calm data-dense' },
    brief: {
      id: 'Konsol operasional: padat informasi tapi tenang, tipografi kecil yang rapi, tabel 32/40px, warna hanya untuk status.',
      en: 'Operations console: information-dense yet calm, tidy small type, 32/40 px tables, colour only for status.',
    },
  },
]

/** KPI strip (Meja Pimpinan style). `delta` is vs yesterday, `good` says whether up is good. */
export const KPIS = [
  { id: 'aduan', label: { id: 'Aduan hari ini', en: 'Complaints today' }, value: 142, unit: '', delta: 18, good: false },
  { id: 'sla', label: { id: 'SLA tepat waktu', en: 'SLA on time' }, value: 87.4, unit: '%', delta: 2.1, good: true },
  { id: 'peringatan', label: { id: 'Peringatan aktif', en: 'Active alerts' }, value: 3, unit: '', delta: 2, good: false },
  { id: 'isu', label: { id: 'Isu negatif', en: 'Negative issues' }, value: 5, unit: '', delta: -1, good: true },
  { id: 'terlambat', label: { id: 'Tindak lanjut terlambat', en: 'Overdue follow-ups' }, value: 9, unit: '', delta: -3, good: true },
  { id: 'indeks', label: { id: 'Indeks layanan', en: 'Service index' }, value: 78, unit: '/100', delta: 1, good: true },
] as const

export type TicketStatus = 'baru' | 'verifikasi' | 'opd' | 'proses' | 'selesai'
export const STATUS_LABEL: Record<TicketStatus, { id: string; en: string }> = {
  baru: { id: 'Baru', en: 'New' },
  verifikasi: { id: 'Diverifikasi', en: 'Verified' },
  opd: { id: 'Diteruskan ke OPD', en: 'Sent to agency' },
  proses: { id: 'Diproses', en: 'In progress' },
  selesai: { id: 'Selesai', en: 'Resolved' },
}

export interface TicketRow {
  id: string
  channel: 'WA' | 'Web' | 'Telepon'
  category: { id: string; en: string }
  kecamatan: string
  opd: string
  status: TicketStatus
  /** SLA hours left (negative = late) */
  slaHours: number
}

/** Ticket inbox rows (Sapa Warga console). `NEW_TICKET` is the one that slides in live. */
export const TICKETS: TicketRow[] = [
  { id: 'SW-2026-0138', channel: 'WA', category: { id: 'Jalan rusak', en: 'Damaged road' }, kecamatan: 'Sukamaju', opd: 'Dinas PUPR', status: 'proses', slaHours: 20 },
  { id: 'SW-2026-0139', channel: 'Web', category: { id: 'PJU mati', en: 'Street light out' }, kecamatan: 'Tirtajaya', opd: 'Dishub', status: 'opd', slaHours: 6 },
  { id: 'SW-2026-0140', channel: 'Telepon', category: { id: 'Sampah', en: 'Waste' }, kecamatan: 'Mekarsari', opd: 'DLH', status: 'verifikasi', slaHours: 30 },
  { id: 'SW-2026-0141', channel: 'WA', category: { id: 'Air bersih', en: 'Clean water' }, kecamatan: 'Karangrejo', opd: 'PDAM', status: 'baru', slaHours: -2 },
  { id: 'SW-2026-0137', channel: 'WA', category: { id: 'Pohon tumbang', en: 'Fallen tree' }, kecamatan: 'Wanasari', opd: 'BPBD', status: 'selesai', slaHours: 0 },
  { id: 'SW-2026-0136', channel: 'Web', category: { id: 'KTP-el', en: 'e-ID card' }, kecamatan: 'Sukamaju', opd: 'Disdukcapil', status: 'proses', slaHours: 44 },
]
export const NEW_TICKET: TicketRow = {
  id: 'SW-2026-0142',
  channel: 'WA',
  category: { id: 'Banjir / genangan', en: 'Flood / pooling' },
  kecamatan: 'Tirtajaya',
  opd: 'BPBD',
  status: 'baru',
  slaHours: 24,
}

/** Chat script (Sapa Warga: citizen ↔ AI). `ai` messages are streamed; `chips` drop in after. */
export const CHAT: { from: 'warga' | 'ai'; text: { id: string; en: string }; chips?: { id: string; en: string }[] }[] = [
  { from: 'warga', text: { id: 'Pak, depan rumah saya banjir sejak subuh, airnya sudah selutut.', en: 'Sir, the street in front of my house has been flooded since dawn, knee-deep now.' } },
  {
    from: 'ai',
    text: {
      id: 'Terima kasih, Bu Siti. Laporan Ibu sudah kami catat sebagai tiket SW-2026-0142 dan diteruskan ke BPBD. Petugas dijadwalkan meninjau dalam 6 jam. Mohon jauhi aliran air yang deras.',
      en: 'Thank you, Mrs Siti. Your report is logged as ticket SW-2026-0142 and sent to the disaster agency. An officer is scheduled to check within 6 hours. Please stay away from fast-flowing water.',
    },
    chips: [
      { id: 'Banjir / genangan', en: 'Flood / pooling' },
      { id: 'Kel. Tirtajaya', en: 'Tirtajaya ward' },
      { id: 'Urgensi: tinggi', en: 'Urgency: high' },
      { id: 'BPBD', en: 'Disaster agency' },
    ],
  },
]

/**
 * Fictional region map: 7 kecamatan polygons in a 600 × 440 viewBox (shared edges, no gaps),
 * one river, 3 points of interest. Value = complaints per 1 000 households (choropleth).
 */
export const MAP_VIEWBOX = '0 0 600 440'
const V = {
  P0: [60, 80], P1: [200, 40], P2: [340, 60], P3: [480, 50], P4: [560, 140], P5: [540, 280], P6: [450, 380], P7: [300, 410], P8: [160, 370], P9: [70, 260],
  A: [200, 170], B: [330, 180], C: [440, 200], D: [230, 290], E: [370, 300], F: [120, 200],
} as const
type VK = keyof typeof V
const poly = (...keys: VK[]) => keys.map((k) => V[k].join(',')).join(' ')
export const KECAMATAN: { id: string; name: string; points: string; centroid: [number, number]; value: number; floodRisk: number }[] = [
  { id: 'wanasari', name: 'Wanasari', points: poly('P9', 'P0', 'P1', 'A', 'F'), centroid: [130, 140], value: 4.2, floodRisk: 0.2 },
  { id: 'sukamaju', name: 'Sukamaju', points: poly('P1', 'P2', 'B', 'A'), centroid: [265, 115], value: 7.9, floodRisk: 0.35 },
  { id: 'mekarsari', name: 'Mekarsari', points: poly('P2', 'P3', 'P4', 'C', 'B'), centroid: [420, 125], value: 5.1, floodRisk: 0.15 },
  { id: 'karangrejo', name: 'Karangrejo', points: poly('F', 'A', 'D', 'P8', 'P9'), centroid: [160, 265], value: 6.3, floodRisk: 0.5 },
  { id: 'tirtajaya', name: 'Tirtajaya', points: poly('A', 'B', 'C', 'E', 'D'), centroid: [315, 235], value: 12.6, floodRisk: 0.85 },
  { id: 'pantairejo', name: 'Pantairejo', points: poly('C', 'P4', 'P5', 'P6', 'E'), centroid: [480, 270], value: 9.4, floodRisk: 0.7 },
  { id: 'gunungsari', name: 'Gunungsari', points: poly('D', 'E', 'P6', 'P7', 'P8'), centroid: [320, 350], value: 3.0, floodRisk: 0.1 },
]
export const RIVER_PATH = 'M 205 30 C 240 110, 270 180, 300 240 S 335 350, 318 420'
export const POIS: { name: string; kind: 'pasar' | 'mpp' | 'rs'; at: [number, number] }[] = [
  { name: 'Pasar Induk', kind: 'pasar', at: [282, 210] },
  { name: 'Mal Pelayanan Publik', kind: 'mpp', at: [250, 120] },
  { name: 'RSUD', kind: 'rs', at: [430, 300] },
]

/** 30-day complaints series + 7-day forecast band (for a small line/area chart). */
export const SERIES = {
  actual: [96, 102, 99, 110, 105, 98, 92, 101, 108, 115, 112, 109, 104, 99, 103, 111, 118, 121, 117, 113, 108, 112, 119, 126, 131, 128, 124, 129, 137, 142],
  forecast: [146, 151, 149, 155, 160, 158, 163],
  band: [8, 10, 12, 14, 16, 18, 20],
}

/** Document sample (incoming letter, scanned & slightly skewed) with OCR boxes in % of the page. */
export const DOC = {
  title: { id: 'Surat Masuk · Permohonan bantuan pompa air', en: 'Incoming letter · Request for water pumps' },
  number: '005/214/Kec.Tjy/XI/2026',
  from: 'Camat Tirtajaya',
  date: '17 November 2026',
  skewDeg: -1.6,
  boxes: [
    { field: { id: 'Nomor', en: 'Number' }, value: '005/214/Kec.Tjy/XI/2026', x: 12, y: 18, w: 46, h: 4, conf: 0.98 },
    { field: { id: 'Pengirim', en: 'Sender' }, value: 'Camat Tirtajaya', x: 12, y: 24, w: 32, h: 4, conf: 0.96 },
    { field: { id: 'Perihal', en: 'Subject' }, value: 'Permohonan bantuan 4 unit pompa air', x: 12, y: 30, w: 62, h: 4, conf: 0.93 },
    { field: { id: 'Tenggat', en: 'Deadline' }, value: '19 November 2026', x: 12, y: 62, w: 36, h: 4, conf: 0.88 },
    { field: { id: 'Penanda tangan', en: 'Signatory' }, value: 'Camat (TTE)', x: 58, y: 78, w: 30, h: 8, conf: 0.81 },
  ],
  summary: {
    id: ['Kecamatan Tirtajaya meminta 4 unit pompa air untuk 3 kelurahan tergenang.', 'Genangan rata-rata 40 cm sejak 17 Nov pagi.', 'Diminta tanggapan paling lambat 19 Nov 2026.'],
    en: ['Tirtajaya district asks for 4 water pumps for 3 flooded wards.', 'Average water depth 40 cm since the morning of 17 Nov.', 'A response is requested by 19 Nov 2026.'],
  },
  classification: { id: 'Permohonan · Segera', en: 'Request · Urgent' },
  disposition: { to: 'Kalaksa BPBD', instruction: { id: 'Tindak lanjuti hari ini, koordinasi dengan Dinas PUPR.', en: 'Act today, coordinate with Public Works.' } },
}
