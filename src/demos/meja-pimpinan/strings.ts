/**
 * demos/meja-pimpinan/strings.ts — bilingual strings of the always-loaded part of Meja Pimpinan (ID + EN, both
 * first-class). Lazy parts (chat, scorecard, meeting mode, phone view, instruction dialog) keep their own strings in
 * their files so the first screen does not download them.
 */
import type { Lang } from '../../lib/i18n'

export type Bi = { id: string; en: string }

export const S = {
  // header
  wallLabel: { id: 'Layar dinding Meja Pimpinan', en: 'Meja Pimpinan wall screen' },
  wallCaption: { id: 'Ruang rapat pimpinan · layar 86 inci · data simulasi', en: "Leaders' meeting room · 86-inch screen · simulated data" },
  title: { id: 'Ruang Kendali Daerah', en: 'Regional Command Center' },
  forLeader: { id: 'untuk', en: 'for the' },
  sekdaFor: { id: 'Disiapkan Sekretariat Daerah untuk', en: 'Prepared by the Regional Secretariat for the' },
  opdView: { id: 'Tampilan Kepala OPD', en: 'Agency head view' },
  compose: { id: 'Susun briefing', en: 'Compose briefing' },
  composeSekda: { id: 'Siapkan briefing', en: 'Prepare briefing' },
  recompose: { id: 'Perbarui briefing', en: 'Refresh briefing' },
  composeAs: { id: 'Lihat briefing {l}', en: "See the {l}'s briefing" },
  live: { id: 'Langsung', en: 'Live' },
  paused: { id: 'Jam dijeda', en: 'Clock paused' },
  clockPlay: { id: 'Jalankan jam dunia', en: 'Run the world clock' },
  clockPause: { id: 'Jeda jam dunia', en: 'Pause the world clock' },
  skipHoax: { id: 'Lompat ke 10.30 · isu viral masuk →', en: 'Jump to 10:30 · a viral claim lands →' },
  tryThis: { id: 'Coba ini', en: 'Try this' },
  briefingSiang: { id: 'Briefing Siang', en: 'Midday Briefing' },
  briefingSore: { id: 'Briefing Sore', en: 'Afternoon Briefing' },
  briefingMalam: { id: 'Briefing Malam', en: 'Evening Briefing' },
  listenSilent: { id: 'Baca bersama (tanpa suara)', en: 'Read along (no voice)' },
  instruct: { id: 'Beri instruksi', en: 'Issue instruction' },
  instructSekda: { id: 'Teruskan instruksi', en: 'Forward instruction' },
  meeting: { id: 'Mode rapat', en: 'Meeting mode' },
  phone: { id: 'Lihat di HP', en: 'View on phone' },
  hotspot: { id: 'Mulai di sini: briefing pagi tersusun sendiri dari 6 produk', en: 'Start here: the morning briefing assembles itself from 6 products' },
  // KPI
  kpis: { id: 'Indikator utama hari ini', en: "Today's key indicators" },
  kComplaints: { id: 'Aduan hari ini', en: 'Complaints today' },
  kSla: { id: 'SLA tepat waktu', en: 'SLA on time' },
  kAlerts: { id: 'Peringatan aktif', en: 'Active alerts' },
  kNegative: { id: 'Isu negatif', en: 'Negative issues' },
  kOverdue: { id: 'Tindak lanjut terlambat', en: 'Overdue follow-ups' },
  kIndex: { id: 'Indeks layanan', en: 'Service index' },
  cSla: { id: 'tiket selesai 30 hari', en: 'tickets closed, 30 days' },
  cAlertsNone: { id: 'tidak ada peringatan banjir', en: 'no flood warning' },
  cAlertsRiver: { id: 'belum ada peringatan · sungai {s} (simulasi)', en: 'no warning sent yet · river at {s} (simulated)' },
  cAlertsSome: { id: 'lihat zona di peta', en: 'see zones on the map' },
  cNegative: { id: 'teratas:', en: 'top:' },
  cNeg24: { id: 'topik, 24 jam', en: 'topics, 24 h' },
  cOverdue: { id: 'dari rapat & instruksi', en: 'from meetings & instructions' },
  cIndex: { id: 'SLA 40% · kepuasan 30% · disiplin 30%', en: 'SLA 40% · satisfaction 30% · discipline 30%' },
  spark7: { id: 'Aduan 7 hari', en: 'Complaints, 7 days' },
  sparkSla: { id: 'SLA harian 14 hari', en: 'Daily SLA, 14 days' },
  sparkNeg: { id: 'Mention negatif per jam', en: 'Negative mentions per hour' },
  sparkAria: { id: '{l}: {t} dari {a} ke {b}', en: '{l}: {t} from {a} to {b}' },
  sparkUp: { id: 'naik', en: 'up' },
  sparkDown: { id: 'turun', en: 'down' },
  sparkFlat: { id: 'tetap', en: 'flat' },
  // OPD role KPIs
  kOpdOpen: { id: 'Tiket terbuka', en: 'Open tickets' },
  kOpdSla: { id: 'SLA OPD 30 hari', en: 'Agency SLA, 30 days' },
  kOpdLate: { id: 'Tugas terlambat', en: 'Late tasks' },
  kOpdTasks: { id: 'Tugas terbuka', en: 'Open tasks' },
  kOpdRating: { id: 'Kepuasan warga', en: 'Citizen satisfaction' },
  kOpdRank: { id: 'Peringkat OPD', en: 'Agency rank' },
  opdPick: { id: 'OPD Anda', en: 'Your agency' },
  // map
  map: { id: 'Peta daerah', en: 'Regional map' },
  mapAria: { id: 'Peta kecamatan dengan lapisan aduan, risiko, peringatan, harga, dan proyek', en: 'District map with complaint, risk, alert, price and project layers' },
  lChoro: { id: 'Aduan 7 hari', en: 'Complaints, 7 days' },
  lHeat: { id: 'Kepadatan aduan', en: 'Complaint density' },
  lHazard: { id: 'Risiko bencana', en: 'Disaster risk' },
  lZones: { id: 'Peringatan aktif', en: 'Active alerts' },
  lMarkets: { id: 'Harga pasar', en: 'Market prices' },
  lProjects: { id: 'Proyek', en: 'Projects' },
  layers: { id: 'Lapisan peta', en: 'Map layers' },
  choroUnit: { id: 'aduan per kecamatan, 7 hari terakhir', en: 'complaints per district, last 7 days' },
  choroNote: { id: 'Data simulasi dari aduan Sapa Warga.', en: 'Simulated data from Sapa Warga complaints.' },
  insight: { id: 'Wawasan AI', en: 'AI insight' },
  insightTop: { id: '{kec}: aduan terbanyak 7 hari ({n}, pekan lalu {p}), terutama {cat}.', en: '{kec}: most complaints in 7 days ({n}, last week {p}), mostly {cat}.' },
  insightAct: { id: 'Lihat {kec}', en: 'Show {kec}' },
  insightOpd: { id: '{o} · {kec}: aduan terbanyak 7 hari ({n}, pekan lalu {p}), terutama {cat}.', en: '{o} · {kec}: most complaints in 7 days ({n}, last week {p}), mostly {cat}.' },
  lbKeys: { id: 'panah atas/bawah untuk berpindah, Enter membuka scorecard', en: 'up/down arrows to move, Enter opens the scorecard' },
  cluster: { id: 'Klaster', en: 'Cluster' },
  projectSim: { id: 'lokasi simulasi', en: 'simulated location' },
  priceWeek: { id: 'sepekan', en: 'in a week' },
  // briefing
  briefing: { id: 'Briefing Pagi', en: 'Morning Briefing' },
  briefingEmpty: { id: 'Briefing belum disusun', en: 'Briefing not composed yet' },
  briefingEmptyBody: { id: 'Satu tombol merakit butir terpenting dari produk lain di ekosistem. Tiap butir bertaut ke data sumbernya.', en: 'One button assembles the key items from the other products in the ecosystem. Each item links to its source data.' },
  readyNow: { id: 'Saat ini {n} temuan siap dirakit dari {p} produk', en: 'Right now {n} findings are ready from {p} products' },
  findings: { id: '{n} temuan', en: '{n} findings' },
  finding1: { id: '1 temuan', en: '1 finding' },
  assembling: { id: 'Membaca data dari {n} produk…', en: 'Reading data from {n} products…' },
  composedAt: { id: 'Disusun pukul {t} · {n} butir dari {p} produk', en: 'Composed at {t} · {n} items from {p} products' },
  updates: { id: '{n} pembaruan sejak briefing disusun', en: '{n} updates since the briefing was composed' },
  update1: { id: '1 pembaruan sejak briefing disusun', en: '1 update since the briefing was composed' },
  openIn: { id: 'Buka di {p}', en: 'Open in {p}' },
  itemInstruct: { id: 'Instruksikan', en: 'Instruct' },
  itemInstructAria: { id: 'Beri instruksi dari butir {n}', en: 'Issue an instruction from item {n}' },
  listen: { id: 'Dengarkan briefing', en: 'Listen to briefing' },
  listenLen: { id: '±{m} mnt', en: '≈ {m} min' },
  stopListen: { id: 'Hentikan', en: 'Stop' },
  loadingPlayer: { id: 'Menyiapkan suara…', en: 'Preparing voice…' },
  // hoax banner
  hoaxTitle: { id: 'Radar Isu: hoaks terdeteksi', en: 'Radar Isu: hoax detected' },
  hoaxScore: { id: 'skor hoaks {p}% · {n} akun · jangkauan ±{r}/jam', en: 'hoax score {p}% · {n} accounts · reach ≈ {r}/h' },
  hoaxClarify: { id: 'Instruksikan klarifikasi', en: 'Order a clarification' },
  hoaxHandled: { id: 'Klarifikasi diinstruksikan', en: 'Clarification ordered' },
  hoaxHandledD: { id: 'pukul {t} → {o} · {n} · menunggu rilis klarifikasi di Radar Isu', en: 'at {t} → {o} · {n} · awaiting the clarification release in Radar Isu' },
  hoaxHandledD0: { id: 'pukul {t} → {o} · menunggu rilis klarifikasi di Radar Isu', en: 'at {t} → {o} · awaiting the clarification release in Radar Isu' },
  hoaxSeeNote: { id: 'Lihat nota', en: 'See the memo' },
  hoaxOpen: { id: 'Buka Radar Isu', en: 'Open Radar Isu' },
  dismiss: { id: 'Tutup', en: 'Dismiss' },
  // focus arrival
  arrivedCluster: { id: 'Klaster aduan dari Sapa Warga: {d}, {n} aduan. Peta diarahkan ke lokasi.', en: 'Complaint cluster from Sapa Warga: {d}, {n} complaints. The map now shows the spot.' },
  // leaderboard
  leaderboard: { id: 'Papan peringkat OPD', en: 'Agency leaderboard' },
  sortBy: { id: 'Urutkan', en: 'Sort by' },
  sScore: { id: 'Skor', en: 'Score' },
  sSla: { id: 'SLA', en: 'SLA' },
  sLate: { id: 'Terlambat', en: 'Late' },
  colOpd: { id: 'OPD', en: 'Agency' },
  colOpen: { id: 'tiket terbuka', en: 'open tickets' },
  colSla: { id: 'SLA 30 hari', en: 'SLA 30 days' },
  colPastSla: { id: 'Lewat SLA', en: 'Past SLA' },
  colLate: { id: 'Tugas telat', en: 'Late tasks' },
  notEnoughN: { id: 'data belum cukup ({n} tiket)', en: 'not enough data ({n} tickets)' },
  lbN: { id: '{n} tiket', en: '{n} tickets' },
  notEnough: { id: 'data belum cukup', en: 'not enough data' },
  lbRule: { id: 'SLA 30 hari = tepat waktu ÷ (tiket selesai + tiket terbuka lewat SLA). Skor = 50% SLA + 30% disiplin tindak lanjut + 20% kepuasan. Kurang dari {n} tiket: data belum cukup, tanpa peringkat.', en: 'SLA 30 days = on time ÷ (tickets closed + open tickets past SLA). Score = 50% SLA + 30% follow-up discipline + 20% satisfaction. Fewer than {n} tickets: not enough data, no rank.' },
  openScorecard: { id: 'Buka scorecard {o}', en: 'Open the {o} scorecard' },
  you: { id: 'Anda', en: 'You' },
  noSla: { id: 'belum ada', en: 'none yet' },
  // timeline
  events: { id: 'Kejadian hari ini', en: "Today's events" },
  eventsEmpty: { id: 'Belum ada kejadian hari ini.', en: 'No events today yet.' },
  // ask
  ask: { id: 'Tanya data', en: 'Ask the data' },
  askPh: { id: 'Tanya dalam bahasa sehari-hari…', en: 'Ask in plain language…' },
  askLabel: { id: 'Pertanyaan data untuk asisten pimpinan', en: 'Data question for the leadership assistant' },
  askSend: { id: 'Tanya', en: 'Ask' },
  askHint: { id: 'Jawaban berupa teks, grafik, dan peta yang terbang ke kecamatan terkait.', en: 'Answers come as text, a chart, and the map flying to the district concerned.' },
  askQ1: { id: 'Kenapa aduan jalan naik minggu ini?', en: 'Why are road complaints up this week?' },
  askQ2: { id: 'Kecamatan mana paling banyak aduan?', en: 'Which district has the most complaints?' },
  askQ3: { id: 'OPD mana yang paling lambat?', en: 'Which agency is the slowest?' },
  loadingAsk: { id: 'Menyiapkan asisten…', en: 'Preparing the assistant…' },
  // mobile tabs
  tabsLabel: { id: 'Panel Meja Pimpinan', en: 'Meja Pimpinan panels' },
  tabTasks: { id: 'Tugas', en: 'Tasks' },
  tabBrief: { id: 'Briefing', en: 'Briefing' },
  tabAsk: { id: 'Tanya', en: 'Ask' },
  tabEvents: { id: 'Kejadian', en: 'Events' },
  // misc
  simulated: { id: 'simulasi', en: 'simulated' },
  simData: { id: 'data simulasi', en: 'simulated data' },
  loading: { id: 'Memuat…', en: 'Loading…' },
  instructionSent: { id: 'Instruksi terkirim', en: 'Instruction sent' },
  briefingDone: { id: 'Briefing tersusun · {n} butir', en: 'Briefing composed · {n} items' },
} satisfies Record<string, Bi>

export type Key = keyof typeof S
export const tr = (k: Key, lang: Lang): string => S[k][lang]
/** fill {placeholders} */
export const fill = (s: string, v: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))
export const trf = (k: Key, lang: Lang, v: Record<string, string | number>): string => fill(S[k][lang], v)
export const nf = (lang: Lang, n: number, d = 0): string => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: d })

/** the region's name in the language: "Kabupaten Bojonegoro" → EN "Bojonegoro Regency" ("Kota X" → "X City") */
export const regionLabel = (name: string, lang: Lang): string =>
  lang === 'en' ? name.replace(/^Kabupaten\s+(.+)$/i, '$1 Regency').replace(/^Kota\s+(.+)$/i, '$1 City') : name

/** the regional head by title only (officials are never named): Bupati for a kabupaten, Wali Kota for a kota */
export function leaderTitle(type: string | undefined): Bi {
  return type === 'kota' ? { id: 'Wali Kota', en: 'Mayor' } : { id: 'Bupati', en: 'Regent' }
}

/** public-issue topic keys of the world (Mention.topic) in both languages */
const TOPIC: Record<string, Bi> = {
  banjir: { id: 'banjir', en: 'flooding' }, bansos: { id: 'bansos', en: 'social aid' }, harga: { id: 'harga', en: 'prices' },
  'hoaks-bendungan': { id: 'hoaks bendungan', en: 'dam hoax' }, jalan: { id: 'jalan', en: 'roads' }, kesehatan: { id: 'kesehatan', en: 'health' },
  kualitas: { id: 'kualitas', en: 'quality' }, layanan: { id: 'layanan', en: 'public services' }, pendidikan: { id: 'pendidikan', en: 'education' },
  pengiriman: { id: 'pengiriman', en: 'delivery' }, sampah: { id: 'sampah', en: 'waste' }, stok: { id: 'stok', en: 'stock' }, umkm: { id: 'UMKM', en: 'small businesses' },
}
export const topicLabel = (topic: string, lang: Lang): string => TOPIC[topic]?.[lang] ?? topic
