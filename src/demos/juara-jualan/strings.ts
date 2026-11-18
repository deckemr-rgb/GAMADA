/**
 * demos/juara-jualan/strings.ts — first-load strings (header, KPI strip, calls list, detail, live strip, missions).
 * Lazy tabs (Tim, Coaching, Latihan, Tanya QA, Agen) carry their own strings in their own chunk.
 */
import { useI18n } from '../../lib/i18n'
import type { Bi } from '../../demo-kit/world'

export const SLUG = 'juara-jualan'
export type Lang = 'id' | 'en'
export const pick = (b: Bi | string, lang: Lang): string => (typeof b === 'string' ? b : b[lang])

const id = {
  frame: 'Juara Jualan',
  industry: 'Industri',
  ind: { tb: 'Toko Bangunan', mf: 'Multifinance', asr: 'Asuransi' },
  kpis: 'Ringkasan hari ini',
  kToday: 'Percakapan hari ini',
  kAvg: 'Rata-rata skor',
  kCoach: 'Perlu coaching',
  kBreach: 'Pelanggaran skrip',
  sim: 'simulasi',
  tabs: 'Menu Juara Jualan',
  tCalls: 'Percakapan',
  tTeam: 'Tim',
  tCoach: 'Coaching',
  tPractice: 'Latihan',
  tQa: 'Tanya QA',
  tMyCoach: 'Coaching Saya',
  tMyCalls: 'Percakapan Saya',
  loading: 'Memuat…',
  live: 'Sedang berlangsung',
  liveSim: 'Simulasi panggilan langsung',
  liveNone: 'Tidak ada percakapan berlangsung. Panggilan berikutnya masuk dalam beberapa menit dunia.',
  liveTel: 'Telepon',
  liveWa: 'Chat WA',
  liveTyping: 'mengetik…',
  list: 'Percakapan hari ini',
  sortLabel: 'Urutkan',
  sortLow: 'Skor terendah dulu',
  sortNew: 'Terbaru',
  unscored: 'Belum dinilai',
  inProgress: 'Berlangsung',
  newRow: 'baru',
  empty: 'Belum ada percakapan hari ini.',
  scoreOf: (n: number) => `Skor ${n} dari 100`,
  openCall: (who: string, at: string) => `Buka percakapan ${who} pukul ${at}`,
  detail: 'Detail percakapan',
  close: 'Tutup',
  wa: 'WhatsApp',
  tel: 'Telepon',
  dur: (m: string) => `Durasi ${m}`,
  clipOf: (a: string, b: string) => `Cuplikan ${a} dari percakapan ${b}`,
  wave: 'Rekaman percakapan (geser untuk loncat)',
  waveText: (a: string, b: string) => `${a} dari ${b}`,
  moments: 'Momen',
  play: 'Putar',
  pause: 'Jeda',
  voice: 'Putar suara',
  voiceOff: 'Tanpa suara',
  silent: 'Rekaman diam: teks berjalan mengikuti waktu. “Putar suara” memakai suara browser.',
  transcript: 'Transkrip',
  you: 'Anda',
  criteria: 'Penilaian per kriteria',
  total: 'Total',
  evidence: 'Bukti dari percakapan',
  seekTo: (t: string) => `Loncat ke ${t}`,
  should: 'Seharusnya',
  noIssues: 'Tidak ada momen bermasalah di percakapan ini.',
  scoreNow: 'Nilai sekarang',
  scoring: 'Menilai…',
  liveWait: 'Panggilan masih berlangsung: nilai setelah selesai.',
  edit: 'Ubah skor',
  editHint: 'Ubah nilai per kriteria (0–100); total dihitung ulang dengan bobot yang sama.',
  save: 'Simpan skor',
  cancel: 'Batal',
  byAi: 'dinilai AI',
  bySup: 'diubah supervisor',
  assign: 'Tugaskan coaching',
  scoredToast: (n: number, code: string) => `Skor ${n} dicatat untuk ${code}`,
  scoredBody: (who: string) => `${who} · masuk ke papan tim dan audit`,
  manualToast: (n: number, code: string) => `Skor ${code} diubah menjadi ${n}`,
  poTitle: (c: string) => `Pra-pesan ${c}`,
  poItem: 'Barang',
  poPrice: 'Harga rak',
  poEta: 'Perkiraan tiba',
  poWait: 'menunggu balasan pemasok',
  poOpen: (c: string) => `Lihat ${c} di Toko Autopilot`,
  poSoon: (c: string) => `${c} tercatat di Toko Autopilot (demo segera hadir)`,
  floodChip: 'Konteks banjir',
  floodOpen: 'Buka peringatan di Siaga Wilayah',
  prapesanToast: (c: string) => `Chat pra-pesan ${c} masuk`,
  prapesanBody: (who: string) => `Dari Toko Autopilot · ditangani ${who}`,
  openIt: 'Buka',
  notFound: 'Data tidak ditemukan',
  notFoundBody: 'Tautan menunjuk data yang tidak ada di dunia ini.',
  hon: { tb: 'kasir baru' },
  now: 'sekarang',
  tomorrow: (t: string) => `besok ${t}`,
  todayAt: (t: string) => `hari ini ${t}`,
  roleHint: 'Masuk sebagai',
  dangerChip: 'Ketuk untuk membuka momen merah',
  scoreLine: (n: number) => `${n}/100`,
}

export type Strings = typeof id

const en: Strings = {
  frame: 'Juara Jualan',
  industry: 'Industry',
  ind: { tb: 'Building supplies', mf: 'Multifinance', asr: 'Insurance' },
  kpis: "Today's summary",
  kToday: 'Conversations today',
  kAvg: 'Average score',
  kCoach: 'Need coaching',
  kBreach: 'Script breaches',
  sim: 'simulated',
  tabs: 'Juara Jualan menu',
  tCalls: 'Conversations',
  tTeam: 'Team',
  tCoach: 'Coaching',
  tPractice: 'Practice',
  tQa: 'Ask QA',
  tMyCoach: 'My coaching',
  tMyCalls: 'My conversations',
  loading: 'Loading…',
  live: 'In progress',
  liveSim: 'Simulated live call',
  liveNone: 'No conversation in progress. The next call arrives within a few world minutes.',
  liveTel: 'Phone',
  liveWa: 'WA chat',
  liveTyping: 'typing…',
  list: "Today's conversations",
  sortLabel: 'Sort',
  sortLow: 'Lowest score first',
  sortNew: 'Newest',
  unscored: 'Not scored',
  inProgress: 'In progress',
  newRow: 'new',
  empty: 'No conversations yet today.',
  scoreOf: (n: number) => `Score ${n} out of 100`,
  openCall: (who: string, at: string) => `Open the conversation of ${who} at ${at}`,
  detail: 'Conversation detail',
  close: 'Close',
  wa: 'WhatsApp',
  tel: 'Phone',
  dur: (m: string) => `Duration ${m}`,
  clipOf: (a: string, b: string) => `${a} excerpt of a ${b} conversation`,
  wave: 'Conversation recording (drag to jump)',
  waveText: (a: string, b: string) => `${a} of ${b}`,
  moments: 'Moments',
  play: 'Play',
  pause: 'Pause',
  voice: 'Play voice',
  voiceOff: 'Silent',
  silent: 'Silent recording: the text runs on the timeline. “Play voice” uses the browser voice.',
  transcript: 'Transcript',
  you: 'You',
  criteria: 'Score per criterion',
  total: 'Total',
  evidence: 'Evidence from the conversation',
  seekTo: (t: string) => `Jump to ${t}`,
  should: 'Should have',
  noIssues: 'No problem moments in this conversation.',
  scoreNow: 'Score now',
  scoring: 'Scoring…',
  liveWait: 'The call is still running: score it once it ends.',
  edit: 'Edit score',
  editHint: 'Change each criterion (0–100); the total is recomputed with the same weights.',
  save: 'Save score',
  cancel: 'Cancel',
  byAi: 'scored by AI',
  bySup: 'edited by supervisor',
  assign: 'Assign coaching',
  scoredToast: (n: number, code: string) => `Score ${n} recorded for ${code}`,
  scoredBody: (who: string) => `${who} · added to the team board and the audit log`,
  manualToast: (n: number, code: string) => `${code} score changed to ${n}`,
  poTitle: (c: string) => `Pre-order ${c}`,
  poItem: 'Item',
  poPrice: 'Shelf price',
  poEta: 'Expected arrival',
  poWait: 'waiting for the supplier reply',
  poOpen: (c: string) => `View ${c} in Toko Autopilot`,
  poSoon: (c: string) => `${c} is recorded in Toko Autopilot (demo coming soon)`,
  floodChip: 'Flood context',
  floodOpen: 'Open the warning in Siaga Wilayah',
  prapesanToast: (c: string) => `Pre-order chat ${c} arrived`,
  prapesanBody: (who: string) => `From Toko Autopilot · handled by ${who}`,
  openIt: 'Open',
  notFound: 'Item not found',
  notFoundBody: 'The link points to data that does not exist in this world.',
  hon: { tb: 'new cashier' },
  now: 'now',
  tomorrow: (t: string) => `tomorrow ${t}`,
  todayAt: (t: string) => `today ${t}`,
  roleHint: 'Sign in as',
  dangerChip: 'Tap to open the red moment',
  scoreLine: (n: number) => `${n}/100`,
}

export const STRINGS: Record<Lang, Strings> = { id, en }

export function useT(): { t: Strings; lang: Lang } {
  const { lang } = useI18n()
  return { t: STRINGS[lang], lang }
}

/** "07.05" (ID) / "07:05" (EN) */
export const clockText = (hhmmStr: string, lang: Lang): string => (lang === 'id' ? hhmmStr.replace(':', '.') : hhmmStr)

/** customer role words of the seeded "Bpk. Nama (role)" strings */
const ROLE_EN: Record<string, string> = {
  kontraktor: 'contractor', 'pemilik rumah': 'home owner', tukang: 'builder', 'pengurus musala': 'prayer-house committee', 'calon nasabah': 'prospect', nasabah: 'customer',
  'pemegang polis': 'policy holder',
}
/** "Bpk. Hadi Wicaksono (kontraktor)" → { hon: 'Bpk.', name, role (in the session language), female } */
export function customerParts(c: string, lang: Lang): { name: string; role: string; female: boolean; full: string } {
  const pm = /^Pengurus musala (?:Desa )?(.+)$/.exec(c.trim())
  if (pm) {
    const full = lang === 'en' ? `Prayer-house committee, ${pm[1]} village` : c
    return { name: full, role: '', female: false, full }
  }
  const m = /^(Bpk\.|Ibu)\s+([^(]+?)\s*(?:\((.+)\))?$/.exec(c.trim())
  if (!m) return { name: c, role: '', female: false, full: c }
  const female = m[1] === 'Ibu'
  const role = m[3] ? (lang === 'en' ? (ROLE_EN[m[3]] ?? m[3]) : m[3]) : ''
  const hon = lang === 'en' ? (female ? 'Ms' : 'Mr') : m[1]!
  return { name: m[2]!, role, female, full: `${hon} ${m[2]}${role ? ` (${role})` : ''}` }
}
