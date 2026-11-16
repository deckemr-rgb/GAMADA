/**
 * Showcase fixtures for /lab/_kit (ui + frames sections). Place names are real kecamatan of Kabupaten
 * Bojonegoro; every person, ticket and number is FICTIONAL. Not used by products (they read the world store).
 */
import type { Bi } from '../../../content/products'

export type TicketStatus = 'baru' | 'verifikasi' | 'opd' | 'proses' | 'selesai'
export type Channel = 'WA' | 'Web' | 'Telepon'

export const STATUS_FLOW: TicketStatus[] = ['baru', 'verifikasi', 'opd', 'proses', 'selesai']

export const STATUS_LABEL: Record<TicketStatus, Bi> = {
  baru: { id: 'Baru', en: 'New' },
  verifikasi: { id: 'Diverifikasi', en: 'Verified' },
  opd: { id: 'Diteruskan ke OPD', en: 'Sent to agency' },
  proses: { id: 'Diproses', en: 'In progress' },
  selesai: { id: 'Selesai', en: 'Resolved' },
}

export interface Ticket {
  id: string
  channel: Channel
  category: Bi
  kecamatan: string
  opd: string
  status: TicketStatus
  /** minutes left at the demo moment (negative = overdue) */
  slaMin: number
  from: string
  text: Bi
  /** minutes since 00:00 */
  at: number
}

export const KECAMATAN = ['Bojonegoro', 'Kapas', 'Dander', 'Kalitidu', 'Sumberrejo', 'Baureno', 'Kanor', 'Padangan', 'Ngasem', 'Kedungadem', 'Temayang', 'Sugihwaras', 'Balen', 'Trucuk'] as const

export const CATEGORIES: { cat: Bi; opd: string; text: Bi }[] = [
  { cat: { id: 'Jalan berlubang', en: 'Pothole' }, opd: 'DPU Bina Marga', text: { id: 'Jalan poros desa berlubang dalam, motor sering jatuh kalau malam.', en: 'Deep potholes on the village road, motorbikes fall at night.' } },
  { cat: { id: 'Lampu jalan mati', en: 'Street light out' }, opd: 'Dishub', text: { id: 'Lampu PJU di pertigaan mati sudah seminggu.', en: 'The street light at the junction has been out for a week.' } },
  { cat: { id: 'Sampah menumpuk', en: 'Uncollected rubbish' }, opd: 'DLH', text: { id: 'Sampah di TPS pasar belum diangkut tiga hari.', en: 'Rubbish at the market depot not collected for three days.' } },
  { cat: { id: 'Saluran tersumbat', en: 'Blocked drain' }, opd: 'DPU SDA', text: { id: 'Got depan sekolah mampet, air meluber ke jalan.', en: 'The drain by the school is blocked and floods the road.' } },
  { cat: { id: 'Air keruh', en: 'Cloudy tap water' }, opd: 'PDAM', text: { id: 'Air PDAM keruh kecokelatan sejak pagi.', en: 'Tap water has been brownish since this morning.' } },
  { cat: { id: 'KTP-el belum jadi', en: 'ID card delayed' }, opd: 'Disdukcapil', text: { id: 'Rekam KTP-el sebulan lalu, belum bisa diambil.', en: 'Recorded my ID card a month ago, still not ready.' } },
  { cat: { id: 'Genangan banjir', en: 'Flood water' }, opd: 'BPBD', text: { id: 'Air Bengawan Solo naik, genangan masuk halaman warga.', en: 'The Bengawan Solo is rising, water entering yards.' } },
  { cat: { id: 'Pohon tumbang', en: 'Fallen tree' }, opd: 'DLH', text: { id: 'Pohon tumbang menutup separuh jalan setelah angin kencang.', en: 'A fallen tree blocks half the road after strong wind.' } },
]

export const NAMES = ['Siti Rahayu', 'Bambang Sutrisno', 'Dwi Lestari', 'Agus Prasetyo', 'Sri Wahyuni', 'Eko Nugroho', 'Ratna Kusuma', 'Joko Susilo', 'Nur Aini', 'Hadi Santoso', 'Wulan Sari', 'Teguh Wibowo', 'Lilis Suryani', 'Rudi Hartono'] as const

/** mulberry32 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)] as T
export const ticketId = (n: number) => `SW-2026-${String(n).padStart(4, '0')}`

export function makeTicket(n: number, r: () => number, at: number, status?: TicketStatus): Ticket {
  const c = pick(r, CATEGORIES)
  const st = status ?? pick(r, STATUS_FLOW)
  const slaMin = st === 'selesai' ? 0 : Math.round((r() < 0.14 ? -1 : 1) * (40 + r() * 46 * 60))
  return {
    id: ticketId(n),
    channel: pick(r, ['WA', 'WA', 'WA', 'Web', 'Telepon'] as const),
    category: c.cat,
    kecamatan: pick(r, KECAMATAN),
    opd: c.opd,
    status: st,
    slaMin,
    from: pick(r, NAMES),
    text: c.text,
    at,
  }
}

/** 14 hand-tuned-looking tickets, newest first (0141 … 0128). */
export function sampleTickets(): Ticket[] {
  const r = rng(42)
  const out: Ticket[] = []
  for (let i = 0; i < 14; i++) out.push(makeTicket(141 - i, r, 8 * 60 + 40 - i * 23))
  // a guaranteed mix for the legend: one late, one under 8 h, one resolved, two new
  const fix: Partial<Ticket>[] = [
    { status: 'baru', slaMin: 47 * 60 },
    { status: 'baru', slaMin: 46 * 60 + 20 },
    { status: 'verifikasi', slaMin: 6 * 60 + 10 },
    { status: 'opd', slaMin: -125 },
    { status: 'proses', slaMin: 20 * 60 },
    { status: 'selesai', slaMin: 0 },
  ]
  fix.forEach((f, i) => {
    const t = out[i]
    if (t) out[i] = { ...t, ...f }
  })
  return out
}

/** Large seeded set for the virtualised table (n rows, newest first). */
export function manyTickets(n: number): Ticket[] {
  const r = rng(7)
  return Array.from({ length: n }, (_, i) => makeTicket(n + 141 - i, r, Math.max(0, 23 * 60 - i)))
}

export function nextTicket(n: number, at: number): Ticket {
  return makeTicket(n, rng(1000 + n), at, 'baru')
}

export const fmtTime = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}.${String(min % 60).padStart(2, '0')}`

/** KPI series (14 days) for the sparkline. */
export const COMPLAINTS_14D = [118, 124, 109, 131, 127, 122, 138, 129, 133, 126, 140, 135, 124, 141]
