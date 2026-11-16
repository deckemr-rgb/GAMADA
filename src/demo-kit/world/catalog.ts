/**
 * world/catalog.ts — word lists and templates the generator draws from. Every person, company, outlet,
 * medium, bank and brand produced from these lists is FICTIONAL; nothing here names a real person or firm.
 * Products are generic (no trademarks).
 */
import type { Bi, BizKind, ComplaintCategory, NameGroup } from './types'

/* ================================================================== names */

export interface NameSet {
  m: string[]
  f: string[]
  /** family / second names (shared or per gender) */
  last?: string[]
  lastF?: string[]
  /** probability of a second name */
  pLast: number
}

export const NAMES: Partial<Record<NameGroup, NameSet>> = {
  jawa: {
    m: ['Budi', 'Agus', 'Slamet', 'Sugeng', 'Joko', 'Bambang', 'Wahyu', 'Teguh', 'Hadi', 'Eko', 'Dwi', 'Puji', 'Sutrisno', 'Suparman', 'Darmo', 'Wawan', 'Yanto', 'Heru', 'Rudi', 'Supriyadi', 'Sukirno', 'Bayu', 'Aris', 'Tri', 'Sarwono', 'Mulyono', 'Raka', 'Dimas', 'Galih', 'Fajar'],
    f: ['Siti', 'Sri', 'Endang', 'Wulan', 'Rini', 'Tutik', 'Sulastri', 'Suminah', 'Ratna', 'Dewi', 'Ani', 'Yuni', 'Ningsih', 'Kartini', 'Sumarni', 'Indah', 'Puspita', 'Sumiati', 'Retno', 'Wartini', 'Dian', 'Ayu', 'Nur', 'Lestari'],
    last: ['Santoso', 'Wibowo', 'Susanto', 'Purnomo', 'Hartono', 'Setiawan', 'Nugroho', 'Saputra', 'Pratama', 'Prasetyo', 'Wicaksono', 'Gunawan', 'Utomo', 'Raharjo', 'Sulistyo'],
    lastF: ['Handayani', 'Rahmawati', 'Lestari', 'Utami', 'Wahyuni', 'Rahayu', 'Purwanti', 'Astuti', 'Susilowati', 'Kusumawati'],
    pLast: 0.55,
  },
  sunda: {
    m: ['Asep', 'Ujang', 'Dede', 'Cecep', 'Dadang', 'Ade', 'Iwan', 'Jajang', 'Yayan', 'Engkos', 'Dodi', 'Rahmat'],
    f: ['Euis', 'Neng', 'Yeni', 'Iis', 'Teti', 'Nenden', 'Lilis', 'Cucu', 'Nining', 'Imas'],
    last: ['Suryana', 'Hidayat', 'Permana', 'Sopian', 'Kusnadi', 'Ruhiyat', 'Supriatna', 'Gumilar'],
    lastF: ['Nurhayati', 'Komalasari', 'Rostika', 'Kurniasih', 'Suryani'],
    pLast: 0.7,
  },
  batak: {
    m: ['Togar', 'Parlindungan', 'Hotman', 'Bonar', 'Martua', 'Sahat', 'Jonner', 'Binsar', 'Poltak', 'Daniel'],
    f: ['Rosmawati', 'Lamtiur', 'Tiurma', 'Debora', 'Romauli', 'Hotnida', 'Ruth', 'Sondang'],
    last: ['Siregar', 'Nasution', 'Simanjuntak', 'Hutapea', 'Sitompul', 'Pardede', 'Lubis', 'Harahap', 'Sinaga', 'Manurung', 'Tambunan', 'Panjaitan'],
    pLast: 1,
  },
  minang: {
    m: ['Rizal', 'Zulkifli', 'Hendri', 'Afrizal', 'Yusrizal', 'Fadli', 'Syahrul', 'Irwan', 'Arif', 'Rahmad'],
    f: ['Rahmi', 'Yusnita', 'Elvi', 'Fitri', 'Desi', 'Zulaikha', 'Nurhasanah', 'Rosna'],
    last: ['Chaniago', 'Piliang', 'Sikumbang', 'Tanjung', 'Koto', 'Effendi', 'Syafri'],
    pLast: 0.6,
  },
  bugis: {
    m: ['Muhammad Ilham', 'Nurdin', 'Syarifuddin', 'Haerul', 'Sulfikar', 'Akbar', 'Irfan', 'Ridwan', 'Andi Baso', 'Andi Fikri'],
    f: ['Hasmawati', 'Nurhaedah', 'Jumriah', 'Rahmatia', 'Andi Nurul', 'Sitti Rahma', 'Hasnah', 'Rosmiati'],
    pLast: 0,
  },
  tionghoa: {
    m: ['Hendra', 'Kevin', 'Steven', 'William', 'Yohanes', 'Andreas', 'Felix', 'Hartono', 'Budi', 'Ronald', 'Wilson'],
    f: ['Lina', 'Mei Ling', 'Susan', 'Lily', 'Yuliana', 'Natalia', 'Veronica', 'Melinda', 'Fransiska', 'Shinta'],
    last: ['Wijaya', 'Halim', 'Tanuwijaya', 'Gunawan', 'Setiadi', 'Kusuma', 'Tanjaya', 'Lim', 'Tan', 'Gozali', 'Sutanto', 'Hartanto', 'Liem', 'Oei'],
    pLast: 0.9,
  },
  madura: {
    m: ['Moh. Hasan', 'Fathorrahman', 'Syaiful', 'Ahmad Fauzi', 'Mat Sahri', 'Abdul Rahem', 'Holili', 'Bakri', 'Moh. Rofiq', 'Sukri'],
    f: ['Siti Aisyah', 'Hosniyah', 'Maimunah', 'Juwairiyah', 'Nur Hasanah', 'Fatimah', 'Halimah', 'Sumiyati'],
    pLast: 0,
  },
  bali: {
    m: ['I Wayan Sudarsana', 'I Made Artawan', 'I Nyoman Suardana', 'I Ketut Wirawan', 'I Putu Budiasa', 'I Gede Mahendra', 'I Komang Adi'],
    f: ['Ni Wayan Sukarini', 'Ni Made Ayu Lestari', 'Ni Nyoman Ariani', 'Ni Ketut Sriasih', 'Ni Putu Wahyuni', 'Ni Kadek Dewi'],
    pLast: 0,
  },
  banjar: {
    m: ['Ahmad Rizani', 'Muhammad Yusran', 'Saberan', 'Rusdiansyah', 'Fahrurrazi', 'Taufikurrahman'],
    f: ['Masliana', 'Rusmini', 'Norhayati', 'Mahmudah', 'Rabiatul', 'Hairiyah'],
    pLast: 0,
  },
}

/** regional language code (pack.languages.regional) → name group it boosts */
export const LANG_GROUP: Record<string, NameGroup> = {
  jv: 'jawa', su: 'sunda', min: 'minang', bug: 'bugis', mad: 'madura', bal: 'bali', bat: 'batak', bjn: 'banjar',
}
/** national background mix (Indonesia is diverse everywhere) */
export const BASE_GROUP_WEIGHT: Partial<Record<NameGroup, number>> = {
  jawa: 10, sunda: 6, batak: 4, minang: 4, bugis: 3, tionghoa: 5, madura: 4, bali: 2, banjar: 2,
}
/** weight added to the region's own language groups (split between them) */
export const REGIONAL_BOOST = 140

/* ================================================================== fictional organisations */

export const COMPANY_WORDS = ['Sarana', 'Tirta', 'Karya', 'Mitra', 'Cipta', 'Bumi', 'Graha', 'Putra', 'Prima', 'Sentosa', 'Abadi', 'Makmur', 'Utama', 'Kencana', 'Perkasa', 'Mandiri', 'Lestari', 'Wira', 'Arta', 'Sinar', 'Daya', 'Teknik', 'Rekayasa', 'Selaras', 'Bangun', 'Cahaya', 'Tunas', 'Panca', 'Catur', 'Tri']
export const SHOP_NAMES = ['Karya Tirta Makmur', 'Sido Rukun Abadi', 'Sinar Lestari Jaya', 'Mulyo Agung Sentosa', 'Rejeki Bumi Mandiri', 'Tunas Kencana Baru']
export const MEDIA_OUTLETS = ['Warta Senja Raya', 'Kabar Simpang Kota', 'Lensa Kalangan', 'Gema Pelita Daerah', 'Rona Kabar', 'Ruang Warta 24', 'Titik Temu News', 'Jurnal Pinggir Kali']
export const SOCIAL_HANDLES = ['@infowarga.kini', '@kabar.sekitar.id', '@sobat.lintas', '@jalan.kampung', '@ceritawarga', '@pantau.desa', '@suara.pinggiran', '@warung.diskusi', '@relawan.kali', '@anak.pasar']
export const LENDERS = ['Koperasi Mitra Usaha Sejahtera', 'KSP Arunika Bersama', 'Bank Pelita Arta Daerah', 'BPR Sinar Lumbung Karya']
export const COMPETITOR_BRANDS = ['Toko Bangunan Gading Sentosa', 'Depo Bahan Sumber Agung']

/* ================================================================== businesses */

export const BIZ_KINDS: { kind: BizKind; w: number; sector: string; names: string[]; supplies: string[] }[] = [
  { kind: 'kelontong', w: 18, sector: 'Perdagangan', names: ['Toko', 'Toko Kelontong', 'Warung'], supplies: ['sembako', 'air-minum'] },
  { kind: 'warung-makan', w: 14, sector: 'Akomodasi & makan minum', names: ['Warung Makan', 'Depot', 'Rumah Makan'], supplies: ['konsumsi'] },
  { kind: 'kedai-kopi', w: 6, sector: 'Akomodasi & makan minum', names: ['Kedai Kopi', 'Warkop'], supplies: ['konsumsi'] },
  { kind: 'katering', w: 6, sector: 'Akomodasi & makan minum', names: ['Katering', 'Dapur'], supplies: ['konsumsi', 'nasi-kotak'] },
  { kind: 'toko-bangunan', w: 7, sector: 'Perdagangan', names: ['Toko Bangunan', 'Toko Besi', 'Depo Bahan'], supplies: ['karung-pasir', 'terpal', 'semen', 'pompa', 'alat-kerja'] },
  { kind: 'konveksi', w: 8, sector: 'Industri pengolahan', names: ['Konveksi', 'Penjahit'], supplies: ['seragam', 'kaos', 'karung-pasir'] },
  { kind: 'kerajinan', w: 7, sector: 'Industri pengolahan', names: ['Kerajinan', 'Sanggar'], supplies: ['suvenir', 'mebel'] },
  { kind: 'tani', w: 10, sector: 'Pertanian', names: ['Kelompok Tani', 'Tani'], supplies: ['beras', 'sayur'] },
  { kind: 'bengkel', w: 7, sector: 'Perdagangan', names: ['Bengkel', 'Bengkel Las'], supplies: ['servis-mesin', 'pompa'] },
  { kind: 'jasa', w: 6, sector: 'Jasa', names: ['Jasa Angkut', 'Ekspedisi'], supplies: ['angkutan'] },
  { kind: 'percetakan', w: 5, sector: 'Jasa', names: ['Percetakan', 'Fotokopi'], supplies: ['atk', 'spanduk'] },
  { kind: 'olahan-pangan', w: 6, sector: 'Industri pengolahan', names: ['Olahan', 'Camilan'], supplies: ['konsumsi', 'makanan-ringan'] },
]
export const BIZ_WORDS = ['Barokah', 'Sumber Rejeki', 'Makmur', 'Lancar', 'Jaya Abadi', 'Mekar', 'Sederhana', 'Rukun', 'Sentosa', 'Berkah', 'Mulya', 'Santoso', 'Tentrem', 'Manunggal', 'Lestari', 'Sido Mukti', 'Laris', 'Amanah', 'Cahaya', 'Pelangi']

/* ================================================================== SKUs (generic, no trademarks) */

/** [name, category, unit, price (Rp), tags?] */
export type SkuRow = [string, string, string, number, string[]?]

const pvc = ['1/2"', '3/4"', '1"', '1 1/4"', '1 1/2"', '2"', '3"', '4"']
const rebar = [6, 8, 10, 12, 13, 16]
const colors = ['putih', 'krem', 'abu-abu', 'hijau muda', 'biru langit', 'kuning gading', 'merah bata', 'cokelat susu']
const tiles = ['20x20', '30x30', '40x40', '50x50', '60x60']
const motifs = ['polos putih', 'motif kayu', 'motif batu', 'granit abu']

function shopSkus(): SkuRow[] {
  const r: SkuRow[] = []
  r.push(['Semen PCC 40 kg', 'semen', 'sak', 58000], ['Semen PCC 50 kg', 'semen', 'sak', 68000], ['Semen putih 1 kg', 'semen', 'kg', 6500],
    ['Semen instan perekat bata 40 kg', 'semen', 'sak', 82000], ['Semen instan acian 40 kg', 'semen', 'sak', 95000], ['Perekat keramik 25 kg', 'semen', 'sak', 78000],
    ['Semen tahan air 20 kg', 'semen', 'sak', 145000])
  pvc.forEach((d, i) => {
    r.push([`Pipa PVC ${d} AW 4 m`, 'pipa', 'batang', Math.round(22000 * (1 + i * 0.75))])
    r.push([`Pipa PVC ${d} D 4 m`, 'pipa', 'batang', Math.round(16000 * (1 + i * 0.7))])
  })
  for (const t of ['Elbow', 'Tee', 'Sok', 'Dop']) pvc.slice(0, 6).forEach((d, i) => r.push([`${t} PVC ${d}`, 'pipa', 'pcs', Math.round(2500 * (1 + i * 0.8))]))
  for (const mm of rebar) {
    r.push([`Besi beton polos ${mm} mm 12 m`, 'besi', 'batang', Math.round(mm * mm * 620)])
    r.push([`Besi beton ulir ${mm} mm 12 m`, 'besi', 'batang', Math.round(mm * mm * 700)])
  }
  for (const s of [30, 40, 50]) for (const t of [3, 4]) r.push([`Besi siku ${s}x${s} tebal ${t} mm 6 m`, 'besi', 'batang', s * t * 1150])
  pvc.slice(0, 6).forEach((d, i) => r.push([`Pipa galvanis ${d} 6 m`, 'pipa', 'batang', Math.round(115000 * (1 + i * 0.6))]))
  for (const m of [8, 10, 12]) for (const l of [5, 7, 10]) r.push([`Baut + mur M${m} ${l} cm`, 'paku', 'pcs', 900 + m * l * 18])
  r.push(['Engsel pintu 4"', 'kunci', 'pasang', 22000], ['Engsel jendela 3"', 'kunci', 'pasang', 16000], ['Kunci pintu set', 'kunci', 'set', 145000], ['Gembok 40 mm', 'kunci', 'pcs', 45000],
    ['Grendel pintu', 'kunci', 'pcs', 18000], ['Handel jendela', 'kunci', 'pcs', 15000])
  r.push(['Wiremesh M6 2,1x5,4 m', 'besi', 'lembar', 285000], ['Wiremesh M8 2,1x5,4 m', 'besi', 'lembar', 465000], ['Kawat bendrat 1 kg', 'besi', 'kg', 24000], ['Kawat bendrat 25 kg', 'besi', 'rol', 520000])
  for (const s of ['1"', '1,5"', '2"', '2,5"', '3"', '4"', '5"']) r.push([`Paku kayu ${s} 1 kg`, 'paku', 'kg', 21000])
  for (const s of ['2"', '3"', '4"']) r.push([`Paku beton ${s} 1 dus`, 'paku', 'dus', 18000])
  for (const s of ['6x1"', '6x1,25"', '8x1,5"', '8x2"']) r.push([`Sekrup gypsum ${s} 100 pcs`, 'paku', 'pak', 15000])
  for (const c of colors) {
    r.push([`Cat tembok ${c} 5 kg`, 'cat', 'pail', 98000])
    r.push([`Cat tembok ${c} 25 kg`, 'cat', 'pail', 420000])
  }
  for (const c of ['hitam', 'putih', 'merah', 'biru', 'hijau', 'abu-abu']) r.push([`Cat kayu & besi ${c} 1 kg`, 'cat', 'kaleng', 72000])
  r.push(['Plamir tembok 5 kg', 'cat', 'pail', 65000], ['Tiner 1 L', 'cat', 'kaleng', 28000], ['Tiner 5 L', 'cat', 'jeriken', 120000], ['Pelapis anti bocor 1 kg', 'cat', 'kaleng', 58000],
    ['Pelapis anti bocor 4 kg', 'cat', 'pail', 205000], ['Pelapis anti bocor 20 kg', 'cat', 'pail', 890000])
  for (const s of ['1"', '2"', '3"', '4"']) r.push([`Kuas cat ${s}`, 'cat', 'pcs', 6000 + parseInt(s) * 3000])
  r.push(['Rol cat 7"', 'cat', 'pcs', 28000], ['Rol cat 9"', 'cat', 'pcs', 34000])
  for (const t of tiles) motifs.forEach((m, i) => r.push([`Keramik ${t} ${m}`, 'keramik', 'dus', Math.round((parseInt(t) / 20) * 38000 + i * 9000)]))
  r.push(['Bata merah', 'bata', 'biji', 850], ['Batako press', 'bata', 'biji', 3200], ['Bata ringan 7,5 cm', 'bata', 'm3', 690000], ['Bata ringan 10 cm', 'bata', 'm3', 690000], ['Roster beton 20x20', 'bata', 'biji', 9500])
  r.push(['Pasir pasang 1 karung 25 kg', 'pasir-batu', 'karung', 9000], ['Pasir beton 1 karung 25 kg', 'pasir-batu', 'karung', 11000], ['Pasir pasang per m3', 'pasir-batu', 'm3', 285000],
    ['Pasir beton per m3', 'pasir-batu', 'm3', 340000], ['Batu split 1-2 per m3', 'pasir-batu', 'm3', 360000], ['Batu kali per m3', 'pasir-batu', 'm3', 260000], ['Sirtu per m3', 'pasir-batu', 'm3', 190000])
  for (const mm of [3, 4, 6, 9, 12, 15, 18]) r.push([`Triplek ${mm} mm 122x244`, 'kayu', 'lembar', 42000 + mm * 9500])
  for (const s of ['4x6', '5x7', '6x12', '2x3 (reng)', '4x6 (usuk)']) r.push([`Kayu ${s} 4 m`, 'kayu', 'batang', s.startsWith('2') ? 9000 : 38000 + parseInt(s) * 6000])
  r.push(['Papan GRC 4 mm', 'kayu', 'lembar', 62000], ['Papan GRC 6 mm', 'kayu', 'lembar', 89000], ['Papan gipsum 9 mm', 'kayu', 'lembar', 72000])
  for (const s of ['2x4', '4x4']) for (const t of ['0,3', '0,4']) r.push([`Hollow galvalum ${s} tebal ${t} mm`, 'baja-ringan', 'batang', 26000 + (s === '4x4' ? 9000 : 0) + (t === '0,4' ? 6000 : 0)])
  r.push(['Kanal C75 0,65 mm 6 m', 'baja-ringan', 'batang', 88000], ['Kanal C75 0,75 mm 6 m', 'baja-ringan', 'batang', 102000], ['Reng baja ringan 0,45 mm 6 m', 'baja-ringan', 'batang', 52000])
  r.push(['Genteng tanah liat', 'atap', 'biji', 2800], ['Genteng beton', 'atap', 'biji', 6200], ['Genteng metal pasir', 'atap', 'lembar', 34000])
  for (const cm of [180, 210, 240, 270, 300]) r.push([`Asbes gelombang ${cm} cm`, 'atap', 'lembar', Math.round(cm * 290)])
  r.push(['Spandek 0,30 mm per m', 'atap', 'm', 52000], ['Spandek 0,35 mm per m', 'atap', 'm', 61000], ['Seng gelombang 0,2 mm', 'atap', 'lembar', 48000], ['Talang PVC 4 m', 'atap', 'batang', 98000])
  for (const mm of ['1,5', '2,5', '4']) r.push([`Kabel NYA ${mm} mm² 50 m`, 'listrik', 'rol', mm === '4' ? 520000 : mm === '2,5' ? 340000 : 225000])
  for (const s of ['2x1,5', '2x2,5', '3x2,5']) r.push([`Kabel NYM ${s} mm² 50 m`, 'listrik', 'rol', s === '3x2,5' ? 780000 : s === '2x2,5' ? 610000 : 455000])
  r.push(['Saklar tunggal', 'listrik', 'pcs', 14000], ['Saklar ganda', 'listrik', 'pcs', 19000], ['Stop kontak 1 lubang', 'listrik', 'pcs', 15000], ['Stop kontak 2 lubang', 'listrik', 'pcs', 24000],
    ['Stop kontak 3 lubang + kabel 3 m', 'listrik', 'pcs', 46000], ['Fitting lampu plafon', 'listrik', 'pcs', 8000], ['Isolasi listrik', 'listrik', 'rol', 5000])
  for (const a of [2, 4, 6, 10, 16]) r.push([`MCB ${a} A`, 'listrik', 'pcs', 48000 + a * 1500])
  for (const w of [5, 9, 12, 15, 20]) r.push([`Lampu LED ${w} W`, 'listrik', 'pcs', 14000 + w * 1800])
  r.push(['Lampu darurat isi ulang', 'listrik', 'pcs', 98000, ['flood']], ['Senter isi ulang', 'listrik', 'pcs', 65000, ['flood']])
  r.push(['Kloset jongkok', 'sanitasi', 'pcs', 145000], ['Kloset duduk', 'sanitasi', 'set', 1250000], ['Wastafel dinding', 'sanitasi', 'set', 420000], ['Shower mandi', 'sanitasi', 'set', 98000],
    ['Floor drain', 'sanitasi', 'pcs', 32000], ['Toren air 300 L', 'sanitasi', 'unit', 780000], ['Toren air 550 L', 'sanitasi', 'unit', 1150000], ['Toren air 1000 L', 'sanitasi', 'unit', 1890000])
  for (const d of ['1/2"', '3/4"']) for (const m of ['plastik', 'kuningan']) r.push([`Kran air ${d} ${m}`, 'sanitasi', 'pcs', m === 'plastik' ? 12000 : 58000])
  r.push(['Selang air 1/2" per m', 'sanitasi', 'm', 5500], ['Selang air 5/8" per m', 'sanitasi', 'm', 7500], ['Pompa sumur dangkal 125 W', 'pompa', 'unit', 625000], ['Pompa sumur dangkal 250 W', 'pompa', 'unit', 980000])
  r.push(['Cangkul', 'alat', 'pcs', 78000, ['flood']], ['Sekop', 'alat', 'pcs', 72000, ['flood']], ['Linggis', 'alat', 'pcs', 85000], ['Palu kecil', 'alat', 'pcs', 35000], ['Palu besar 2 kg', 'alat', 'pcs', 95000],
    ['Gergaji kayu', 'alat', 'pcs', 68000], ['Meteran 3 m', 'alat', 'pcs', 22000], ['Meteran 5 m', 'alat', 'pcs', 32000], ['Meteran 7,5 m', 'alat', 'pcs', 45000], ['Waterpass 60 cm', 'alat', 'pcs', 55000],
    ['Sendok semen', 'alat', 'pcs', 25000], ['Ember cor', 'alat', 'pcs', 12000, ['flood']], ['Gerobak sorong', 'alat', 'unit', 520000], ['Tang kombinasi', 'alat', 'pcs', 48000], ['Obeng set 6 pcs', 'alat', 'set', 52000],
    ['Gunting seng', 'alat', 'pcs', 62000], ['Tangga aluminium 5 anak tangga', 'alat', 'unit', 520000], ['Tangga aluminium 7 anak tangga', 'alat', 'unit', 690000])
  // flood-sensitive stock (Toko Autopilot P8: sandbags, pumps, tarps surge after flood.alert)
  r.push(['Karung plastik pasir 50x80 cm', 'karung-pasir', 'lembar', 2500, ['flood', 'sandbag']], ['Karung goni 60x100 cm', 'karung-pasir', 'lembar', 9000, ['flood', 'sandbag']],
    ['Karung pasir siap pakai 25 kg', 'karung-pasir', 'karung', 14000, ['flood', 'sandbag']], ['Geobag 1x1 m', 'karung-pasir', 'pcs', 65000, ['flood', 'sandbag']])
  for (const s of ['2x3', '3x4', '4x6', '6x8', '8x10']) {
    const [a, b] = s.split('x').map(Number) as [number, number]
    r.push([`Terpal plastik ${s} m`, 'terpal', 'lembar', Math.round(a * b * 5200), ['flood', 'tarp']])
  }
  r.push(['Terpal kanvas 4x6 m', 'terpal', 'lembar', 385000, ['flood', 'tarp']])
  r.push(['Pompa celup 125 W', 'pompa', 'unit', 395000, ['flood', 'pump']], ['Pompa celup 250 W', 'pompa', 'unit', 620000, ['flood', 'pump']], ['Pompa celup 400 W', 'pompa', 'unit', 940000, ['flood', 'pump']],
    ['Pompa alkon 2" mesin bensin', 'pompa', 'unit', 2350000, ['flood', 'pump']], ['Pompa alkon 3" mesin bensin', 'pompa', 'unit', 3150000, ['flood', 'pump']],
    ['Selang spiral 2" per m', 'pompa', 'm', 32000, ['flood', 'pump']], ['Selang spiral 3" per m', 'pompa', 'm', 48000, ['flood', 'pump']], ['Selang buang 3" 20 m', 'pompa', 'rol', 420000, ['flood', 'pump']])
  r.push(['Sepatu bot karet', 'perlengkapan', 'pasang', 75000, ['flood']], ['Jas hujan setelan', 'perlengkapan', 'set', 85000, ['flood']], ['Tali tambang 6 mm 50 m', 'perlengkapan', 'rol', 62000, ['flood']],
    ['Tali tambang 10 mm 50 m', 'perlengkapan', 'rol', 135000, ['flood']], ['Lakban cokelat', 'perlengkapan', 'rol', 12000], ['Lem PVC 100 g', 'perlengkapan', 'tube', 14000], ['Lem kayu 1 kg', 'perlengkapan', 'kg', 32000],
    ['Sealant silikon', 'perlengkapan', 'tube', 38000], ['Sarung tangan kerja', 'perlengkapan', 'pasang', 9000], ['Masker kain', 'perlengkapan', 'pcs', 5000])
  return r
}

const KOPI: SkuRow[] = [
  ['Kopi tubruk', 'minuman', 'gelas', 6000], ['Kopi susu', 'minuman', 'gelas', 9000], ['Es kopi susu gula aren', 'minuman', 'gelas', 15000], ['Es kopi hitam', 'minuman', 'gelas', 10000],
  ['Kopi jahe', 'minuman', 'gelas', 9000], ['Teh manis panas', 'minuman', 'gelas', 4000], ['Es teh manis', 'minuman', 'gelas', 5000], ['Es teh tawar', 'minuman', 'gelas', 3000], ['Wedang jahe', 'minuman', 'gelas', 7000],
  ['Susu jahe', 'minuman', 'gelas', 9000], ['Cokelat panas', 'minuman', 'gelas', 12000], ['Es cokelat', 'minuman', 'gelas', 13000], ['Es jeruk', 'minuman', 'gelas', 7000], ['Jeruk panas', 'minuman', 'gelas', 6000],
  ['Air mineral botol', 'minuman', 'botol', 4000], ['Roti bakar cokelat', 'makanan', 'porsi', 12000], ['Roti bakar keju', 'makanan', 'porsi', 14000], ['Roti bakar srikaya', 'makanan', 'porsi', 12000],
  ['Pisang goreng', 'makanan', 'porsi', 8000], ['Mendoan', 'makanan', 'porsi', 8000], ['Tahu isi', 'makanan', 'porsi', 8000], ['Cireng', 'makanan', 'porsi', 8000], ['Kentang goreng', 'makanan', 'porsi', 12000],
  ['Mi rebus telur', 'makanan', 'porsi', 11000], ['Mi goreng telur', 'makanan', 'porsi', 11000], ['Nasi goreng kampung', 'makanan', 'porsi', 15000], ['Nasi kucing', 'makanan', 'bungkus', 3500], ['Sate usus', 'makanan', 'tusuk', 2500],
  ['Sate telur puyuh', 'makanan', 'tusuk', 3500], ['Gorengan campur', 'makanan', 'porsi', 6000], ['Biji kopi robusta 1 kg', 'bahan', 'kg', 120000], ['Biji kopi arabika 250 g', 'bahan', 'pak', 75000],
  ['Gula pasir 1 kg', 'bahan', 'kg', 17500], ['Gula aren cair 1 L', 'bahan', 'botol', 45000], ['Susu kental manis 370 g', 'bahan', 'kaleng', 12500], ['Susu segar 1 L', 'bahan', 'liter', 22000],
  ['Teh tubruk 250 g', 'bahan', 'pak', 18000], ['Es batu 5 kg', 'bahan', 'kantong', 10000], ['Roti tawar', 'bahan', 'bungkus', 16000], ['Mentega 200 g', 'bahan', 'pak', 12000], ['Meses cokelat 250 g', 'bahan', 'pak', 15000],
  ['Pisang kepok 1 sisir', 'bahan', 'sisir', 22000], ['Tepung terigu 1 kg', 'bahan', 'kg', 12500], ['Minyak goreng 2 L', 'bahan', 'pouch', 38000], ['Gas LPG 3 kg', 'bahan', 'tabung', 22000],
  ['Gelas plastik 16 oz 50 pcs', 'bahan', 'pak', 28000], ['Sedotan 100 pcs', 'bahan', 'pak', 9000], ['Kantong plastik', 'bahan', 'pak', 12000], ['Tisu 250 lembar', 'bahan', 'pak', 14000],
]
const WARUNG: SkuRow[] = [
  ['Nasi pecel', 'makanan', 'porsi', 10000], ['Nasi rawon', 'makanan', 'porsi', 18000], ['Soto ayam', 'makanan', 'porsi', 14000], ['Nasi campur', 'makanan', 'porsi', 15000], ['Nasi ayam goreng', 'makanan', 'porsi', 18000],
  ['Nasi lele goreng', 'makanan', 'porsi', 15000], ['Nasi telur balado', 'makanan', 'porsi', 12000], ['Nasi sayur asem + tempe', 'makanan', 'porsi', 11000], ['Nasi putih', 'makanan', 'porsi', 4000], ['Tempe goreng', 'makanan', 'pcs', 1500],
  ['Tahu goreng', 'makanan', 'pcs', 1500], ['Perkedel', 'makanan', 'pcs', 2500], ['Kerupuk', 'makanan', 'pcs', 1000], ['Sambal tambahan', 'makanan', 'porsi', 2000], ['Sayur lodeh', 'makanan', 'porsi', 6000],
  ['Pepes ikan', 'makanan', 'porsi', 10000], ['Ayam bakar', 'makanan', 'porsi', 20000], ['Bakwan jagung', 'makanan', 'pcs', 2000], ['Es teh manis', 'minuman', 'gelas', 4000], ['Teh manis panas', 'minuman', 'gelas', 3500],
  ['Es jeruk', 'minuman', 'gelas', 6000], ['Kopi hitam', 'minuman', 'gelas', 4000], ['Air mineral gelas', 'minuman', 'gelas', 1000], ['Nasi kotak (pesanan)', 'katering', 'kotak', 25000], ['Tumpeng mini (pesanan)', 'katering', 'kotak', 45000],
  ['Beras medium 5 kg', 'bahan', 'karung', 72000], ['Beras premium 5 kg', 'bahan', 'karung', 82000], ['Minyak goreng 2 L', 'bahan', 'pouch', 38000], ['Cabai rawit 1 kg', 'bahan', 'kg', 52000],
  ['Cabai merah keriting 1 kg', 'bahan', 'kg', 46000], ['Bawang merah 1 kg', 'bahan', 'kg', 38000], ['Bawang putih 1 kg', 'bahan', 'kg', 36000], ['Telur ayam 1 kg', 'bahan', 'kg', 29000], ['Ayam potong 1 kg', 'bahan', 'kg', 38000],
  ['Lele segar 1 kg', 'bahan', 'kg', 26000], ['Tempe papan', 'bahan', 'papan', 6000], ['Tahu 10 pcs', 'bahan', 'pak', 8000], ['Daging sapi 1 kg', 'bahan', 'kg', 135000], ['Kluwek 250 g', 'bahan', 'pak', 15000],
  ['Kecap manis 600 ml', 'bahan', 'botol', 24000], ['Garam 250 g', 'bahan', 'pak', 3000], ['Gula pasir 1 kg', 'bahan', 'kg', 17500], ['Teh tubruk 250 g', 'bahan', 'pak', 18000], ['Es batu 5 kg', 'bahan', 'kantong', 10000],
  ['Gas LPG 3 kg', 'bahan', 'tabung', 22000], ['Kertas nasi 100 lembar', 'bahan', 'pak', 18000], ['Kotak nasi 50 pcs', 'bahan', 'pak', 45000], ['Sayur campur 1 kg', 'bahan', 'kg', 15000], ['Jagung manis 1 kg', 'bahan', 'kg', 12000],
]
export const SKUS = { shop: shopSkus(), kopi: KOPI, warung: WARUNG }

/* ================================================================== text templates */

/** fallback complaint texts (Indonesian) when the pack has no template for a category; {d} = desa */
export const COMPLAINT_TEXT: Record<ComplaintCategory, Bi[]> = {
  banjir: [
    { id: 'Air mulai masuk rumah warga di {d}, sudah sebetis. Mohon bantuan pompa.', en: 'Water is entering homes in {d}, already calf-deep. Please send pumps.' },
    { id: 'Jalan utama {d} tergenang, motor tidak bisa lewat.', en: 'The main road in {d} is flooded, motorbikes cannot pass.' },
    { id: 'Saluran air di {d} meluap sejak subuh.', en: 'The drain in {d} has overflowed since dawn.' },
  ],
  'jalan-rusak': [
    { id: 'Jalan berlubang besar dekat balai desa {d}, sudah ada yang jatuh.', en: 'Big pothole near the {d} village hall, someone has already fallen.' },
    { id: 'Aspal jalan poros {d} mengelupas sepanjang 200 meter.', en: 'Asphalt on the {d} main road is peeling for 200 metres.' },
  ],
  sampah: [
    { id: 'Sampah di TPS {d} belum diangkut tiga hari, bau sekali.', en: 'Rubbish at the {d} collection point has not been picked up for three days.' },
    { id: 'Ada pembuangan sampah liar di pinggir sungai {d}.', en: 'Illegal dumping on the riverbank in {d}.' },
  ],
  pju: [
    { id: 'Lampu jalan di perempatan {d} mati sudah seminggu.', en: 'The street light at the {d} crossroads has been out for a week.' },
    { id: 'Tiga tiang PJU di {d} tidak menyala, rawan kecelakaan.', en: 'Three street lights in {d} are off, accident-prone.' },
  ],
  'air-bersih': [
    { id: 'Air PDAM di {d} keruh sejak kemarin.', en: 'Tap water in {d} has been murky since yesterday.' },
    { id: 'Distribusi air bersih ke {d} berhenti dua hari.', en: 'Clean-water supply to {d} stopped two days ago.' },
  ],
  'pohon-tumbang': [
    { id: 'Pohon tumbang menutup jalan di {d} setelah hujan deras.', en: 'A fallen tree blocks the road in {d} after heavy rain.' },
  ],
  pungli: [
    { id: 'Ada yang minta uang tambahan saat urus surat di {d}.', en: 'Someone asked for an extra payment when processing a letter in {d}.' },
  ],
  kesehatan: [
    { id: 'Antrean puskesmas dekat {d} sangat panjang, obat habis.', en: 'The health-centre queue near {d} is very long and medicine has run out.' },
  ],
  sekolah: [
    { id: 'Atap ruang kelas SD di {d} bocor, murid dipindah.', en: 'The roof of a primary-school classroom in {d} is leaking, pupils were moved.' },
  ],
  adminduk: [
    { id: 'KTP-el saya rusak, bagaimana cara ganti? Saya di {d}.', en: 'My e-ID card is damaged, how do I replace it? I live in {d}.' },
    { id: 'Akta kelahiran anak belum jadi sejak sebulan lalu.', en: "My child's birth certificate is still not issued after a month." },
  ],
  bansos: [
    { id: 'Saya terdaftar penerima bansos tapi bantuan belum cair. Warga {d}.', en: 'I am registered for social aid but have not received it. Resident of {d}.' },
  ],
  lainnya: [
    { id: 'Ada anjing liar berkeliaran di sekitar {d}.', en: 'Stray dogs are roaming around {d}.' },
  ],
}

export const COMPLAINT_WEIGHTS: [ComplaintCategory, number][] = [
  ['jalan-rusak', 22], ['banjir', 12], ['sampah', 12], ['pju', 10], ['air-bersih', 10], ['adminduk', 10], ['bansos', 8], ['pohon-tumbang', 5], ['kesehatan', 4], ['sekolah', 3], ['pungli', 2], ['lainnya', 2],
]

/** keyword guesses to map a complaint category to an OPD of the pack (short or name) */
export const CATEGORY_OPD_HINTS: Record<ComplaintCategory, string[]> = {
  banjir: ['pupr', 'pekerjaan umum', 'bpbd'],
  'jalan-rusak': ['pupr', 'pekerjaan umum', 'bina marga'],
  sampah: ['dlh', 'lingkungan hidup'],
  pju: ['dishub', 'perhubungan', 'perkim'],
  'air-bersih': ['air minum', 'perkim', 'pupr', 'cipta karya', 'pekerjaan umum'],
  'pohon-tumbang': ['dlh', 'lingkungan hidup', 'bpbd'],
  pungli: ['inspektorat'],
  kesehatan: ['dinkes', 'kesehatan'],
  sekolah: ['disdik', 'pendidikan'],
  adminduk: ['dukcapil', 'kependudukan'],
  bansos: ['dinsos', 'sosial'],
  lainnya: ['satpol', 'kominfo', 'sekretariat'],
}
export const CATEGORY_SLA_DAYS: Record<ComplaintCategory, number> = {
  banjir: 1, 'jalan-rusak': 7, sampah: 2, pju: 3, 'air-bersih': 2, 'pohon-tumbang': 1, pungli: 5, kesehatan: 3, sekolah: 7, adminduk: 3, bansos: 5, lainnya: 5,
}
export const CATEGORY_LABEL: Record<ComplaintCategory, Bi> = {
  banjir: { id: 'Banjir/Genangan', en: 'Flood/Waterlogging' }, 'jalan-rusak': { id: 'Jalan rusak', en: 'Damaged road' }, sampah: { id: 'Sampah', en: 'Waste' },
  pju: { id: 'PJU mati', en: 'Street light out' }, 'air-bersih': { id: 'Air bersih', en: 'Clean water' }, 'pohon-tumbang': { id: 'Pohon tumbang', en: 'Fallen tree' },
  pungli: { id: 'Pungli', en: 'Illegal levy' }, kesehatan: { id: 'Kesehatan', en: 'Health' }, sekolah: { id: 'Sekolah', en: 'School' },
  adminduk: { id: 'Adminduk', en: 'Civil registry' }, bansos: { id: 'Bansos', en: 'Social aid' }, lainnya: { id: 'Lainnya', en: 'Other' },
}

/** news / social mention templates ({k} = kecamatan, {r} = region short name) */
export const MENTION_TEXT: { topic: string; s: number; t: Bi }[] = [
  { topic: 'layanan', s: 0.6, t: { id: 'Urus KTP-el di MPP {r} sekarang cepat, 30 menit selesai.', en: 'Getting an e-ID at the {r} public service mall is now fast, done in 30 minutes.' } },
  { topic: 'layanan', s: -0.5, t: { id: 'Antrean layanan di Kec. {k} masih mengular sejak pagi.', en: 'Service queues in {k} district have been long since morning.' } },
  { topic: 'jalan', s: -0.7, t: { id: 'Warga Kec. {k} keluhkan jalan rusak yang tak kunjung diperbaiki.', en: 'Residents of {k} complain about a road that never gets fixed.' } },
  { topic: 'jalan', s: 0.4, t: { id: 'Perbaikan jalan poros Kec. {k} mulai dikerjakan pekan ini.', en: 'Repairs to the main road in {k} start this week.' } },
  { topic: 'banjir', s: -0.6, t: { id: 'Hujan semalam bikin was-was warga bantaran sungai di Kec. {k}.', en: 'Overnight rain worries riverbank residents in {k}.' } },
  { topic: 'banjir', s: 0.3, t: { id: 'BPBD {r} siagakan pompa dan perahu di titik rawan.', en: '{r} disaster agency puts pumps and boats on standby at vulnerable spots.' } },
  { topic: 'harga', s: -0.5, t: { id: 'Harga cabai di pasar Kec. {k} mulai merangkak naik.', en: 'Chilli prices at the {k} market are starting to creep up.' } },
  { topic: 'harga', s: 0.2, t: { id: 'Stok beras di pasar {r} dipastikan aman jelang akhir tahun.', en: 'Rice stocks in {r} markets are confirmed safe ahead of year-end.' } },
  { topic: 'umkm', s: 0.7, t: { id: 'UMKM {r} ramai pesanan dari pameran produk lokal.', en: '{r} small businesses busy with orders from a local product fair.' } },
  { topic: 'umkm', s: 0.4, t: { id: 'Pelatihan pembukuan digital untuk pelaku usaha Kec. {k}.', en: 'Digital bookkeeping training for business owners in {k}.' } },
  { topic: 'sampah', s: -0.4, t: { id: 'Tumpukan sampah di pinggir jalan Kec. {k} dikeluhkan pengendara.', en: 'Rubbish piles along the road in {k} annoy commuters.' } },
  { topic: 'kesehatan', s: 0.3, t: { id: 'Puskesmas Kec. {k} buka layanan sore untuk pekerja.', en: 'The {k} health centre opens an evening service for workers.' } },
  { topic: 'pendidikan', s: 0.5, t: { id: 'Sekolah di Kec. {k} raih juara lomba sains tingkat provinsi.', en: 'A school in {k} wins a provincial science contest.' } },
  { topic: 'bansos', s: -0.3, t: { id: 'Sebagian warga Kec. {k} tanyakan jadwal pencairan bansos.', en: 'Some residents of {k} ask about the social-aid payment schedule.' } },
  { topic: 'layanan', s: 0.0, t: { id: 'Pemkab {r} umumkan jadwal layanan keliling bulan ini.', en: '{r} government announces this month\'s mobile service schedule.' } },
]

export const LETTER_TPL: { kind: 'undangan' | 'permohonan' | 'laporan' | 'edaran'; from: string; s: Bi }[] = [
  { kind: 'undangan', from: 'Sekretariat Daerah Provinsi', s: { id: 'Undangan rapat koordinasi kesiapsiagaan musim hujan', en: 'Invitation: rainy-season preparedness coordination meeting' } },
  { kind: 'permohonan', from: 'Pemerintah Desa', s: { id: 'Permohonan bantuan perbaikan tanggul desa', en: 'Request for help repairing the village embankment' } },
  { kind: 'laporan', from: 'Camat', s: { id: 'Laporan situasi genangan di wilayah kecamatan', en: 'Situation report on waterlogging in the district' } },
  { kind: 'edaran', from: 'Kementerian (salinan)', s: { id: 'Surat edaran percepatan penyaluran bantuan sosial', en: 'Circular on accelerating social-aid distribution' } },
  { kind: 'permohonan', from: 'Kelompok Tani', s: { id: 'Permohonan bantuan pompa irigasi', en: 'Request for irrigation pumps' } },
  { kind: 'undangan', from: 'Forum UMKM Daerah', s: { id: 'Undangan pembukaan pameran produk UMKM', en: 'Invitation to open the small-business product fair' } },
  { kind: 'laporan', from: 'Kepala Dinas PUPR', s: { id: 'Laporan progres perbaikan jalan kabupaten', en: 'Progress report on district road repairs' } },
  { kind: 'permohonan', from: 'Yayasan Pendidikan', s: { id: 'Permohonan izin penggunaan gedung untuk kegiatan', en: 'Request to use a building for an event' } },
  { kind: 'laporan', from: 'Inspektorat', s: { id: 'Laporan hasil pemeriksaan reguler triwulan III', en: 'Quarter III regular audit report' } },
  { kind: 'edaran', from: 'Sekretariat Daerah', s: { id: 'Edaran jam kerja ASN selama musim hujan', en: 'Circular on civil-servant working hours during the rainy season' } },
  { kind: 'permohonan', from: 'Paguyuban Pedagang Pasar', s: { id: 'Permohonan penataan saluran air pasar', en: 'Request to fix the market drainage' } },
  { kind: 'undangan', from: 'DPRD', s: { id: 'Undangan rapat dengar pendapat anggaran', en: 'Invitation to a budget hearing' } },
]

export const MEETING_TPL: Bi[] = [
  { id: 'Rapat Koordinasi Penanganan Banjir', en: 'Flood Response Coordination Meeting' },
  { id: 'Rapat Evaluasi Layanan Publik Mingguan', en: 'Weekly Public Service Review' },
  { id: 'Rapat Persiapan Pameran UMKM', en: 'Small-Business Fair Preparation Meeting' },
  { id: 'Rapat Pengendalian Inflasi Daerah', en: 'Regional Inflation Control Meeting' },
  { id: 'Rapat Percepatan Penyerapan Anggaran', en: 'Budget Absorption Acceleration Meeting' },
  { id: 'Rapat Pembahasan Perbaikan Jalan Kabupaten', en: 'District Road Repair Meeting' },
]
export const MEETING_PARTICIPANTS = ['Sekda', 'Kepala Dinas PUPR', 'Kalaksa BPBD', 'Kepala Dinas Sosial', 'Camat', 'Kepala Bappeda', 'Kepala Disperindag', 'Kepala Diskominfo', 'Inspektur']

export const ACTION_TPL: Bi[] = [
  { id: 'Inventarisasi titik genangan dan kebutuhan pompa', en: 'List waterlogging spots and pump needs' },
  { id: 'Siapkan posko pengungsian sementara', en: 'Prepare a temporary shelter post' },
  { id: 'Perbaiki tanggul yang retak', en: 'Repair the cracked embankment' },
  { id: 'Verifikasi data penerima bantuan', en: 'Verify aid recipient data' },
  { id: 'Susun jadwal operasi pasar', en: 'Draw up the market-operation schedule' },
  { id: 'Laporkan progres perbaikan jalan', en: 'Report road-repair progress' },
  { id: 'Sosialisasi jalur evakuasi ke desa', en: 'Brief villages on evacuation routes' },
  { id: 'Tindak lanjuti aduan sampah di TPS', en: 'Follow up rubbish complaints at collection points' },
  { id: 'Koordinasi stok beras dengan distributor', en: 'Coordinate rice stocks with distributors' },
  { id: 'Rekap hasil pameran UMKM', en: 'Summarise the small-business fair results' },
  { id: 'Perbarui papan informasi layanan MPP', en: 'Update the service information board at the MPP' },
  { id: 'Normalisasi saluran drainase pasar', en: 'Clean out the market drainage' },
]

export const PROCUREMENT_TPL: { n: Bi; hint: string[]; base: number; items: [string, string, number, string][] }[] = [
  { n: { id: 'Rehabilitasi Jalan Poros Desa', en: 'Village Main Road Rehabilitation' }, hint: ['pupr', 'pekerjaan umum'], base: 1_850_000_000, items: [['Aspal hotmix', 'Hotmix asphalt', 420, 'ton'], ['Agregat kelas A', 'Class A aggregate', 900, 'm3']] },
  { n: { id: 'Pengadaan Alat Kesehatan Puskesmas', en: 'Health Centre Medical Equipment' }, hint: ['dinkes', 'kesehatan'], base: 920_000_000, items: [['Tensimeter digital', 'Digital blood-pressure monitor', 60, 'unit'], ['Timbangan bayi', 'Baby scale', 40, 'unit']] },
  { n: { id: 'Pengadaan Seragam Sekolah Gratis', en: 'Free School Uniforms' }, hint: ['disdik', 'pendidikan'], base: 1_250_000_000, items: [['Seragam SD', 'Primary uniform', 8000, 'stel'], ['Seragam SMP', 'Junior-high uniform', 5000, 'stel']] },
  { n: { id: 'Belanja Bibit Padi Unggul', en: 'High-Yield Rice Seed Purchase' }, hint: ['pertanian', 'ketahanan pangan'], base: 640_000_000, items: [['Benih padi bersertifikat', 'Certified rice seed', 32000, 'kg']] },
  { n: { id: 'Pengadaan Perahu Karet BPBD', en: 'Rubber Boats for BPBD' }, hint: ['bpbd'], base: 480_000_000, items: [['Perahu karet + mesin', 'Rubber boat + engine', 6, 'unit'], ['Pelampung', 'Life jacket', 120, 'pcs']] },
  { n: { id: 'Pemeliharaan Lampu Penerangan Jalan', en: 'Street-Light Maintenance' }, hint: ['dishub', 'perhubungan', 'perkim'], base: 560_000_000, items: [['Lampu PJU LED 60 W', '60 W LED street light', 400, 'unit']] },
  { n: { id: 'Pengadaan Komputer Layanan Kecamatan', en: 'District Service Computers' }, hint: ['kominfo', 'sekretariat'], base: 780_000_000, items: [['Komputer desktop', 'Desktop computer', 90, 'unit'], ['Printer', 'Printer', 30, 'unit']] },
  { n: { id: 'Normalisasi Saluran Drainase Kota', en: 'Town Drainage Normalisation' }, hint: ['pupr', 'pekerjaan umum'], base: 1_420_000_000, items: [['Galian sedimen', 'Sediment excavation', 6000, 'm3'], ['U-ditch beton', 'Concrete U-ditch', 800, 'm']] },
  { n: { id: 'Penyediaan Makan Minum Rapat', en: 'Meeting Catering' }, hint: ['sekretariat'], base: 185_000_000, items: [['Nasi kotak', 'Boxed meal', 6000, 'kotak']] },
  { n: { id: 'Pengadaan Tempat Sampah Terpilah', en: 'Sorted Waste Bins' }, hint: ['dlh', 'lingkungan hidup'], base: 320_000_000, items: [['Tempat sampah 3 warna', '3-colour waste bin', 500, 'set']] },
]

/** the emergency pump package created by the flood.alert reaction (Awas Belanja analyses it later) */
export const PUMP_PACKAGE = {
  key: 'pompa-darurat',
  name: { id: 'Pengadaan Pompa Air Darurat', en: 'Emergency Water Pump Procurement' },
  items: [
    { name: { id: 'Pompa air portabel 6 inci (diesel)', en: '6-inch portable water pump (diesel)' }, qty: 12, unit: 'unit', hpsPrice: 48_500_000, marketPrice: 31_800_000 },
    { name: { id: 'Selang hisap & buang 6 inci', en: '6-inch suction & discharge hose' }, qty: 24, unit: 'rol', hpsPrice: 6_900_000, marketPrice: 4_650_000 },
    { name: { id: 'Genset 10 kVA', en: '10 kVA generator' }, qty: 4, unit: 'unit', hpsPrice: 62_000_000, marketPrice: 47_500_000 },
    { name: { id: 'Bahan bakar solar (7 hari)', en: 'Diesel fuel (7 days)' }, qty: 3000, unit: 'liter', hpsPrice: 13_900, marketPrice: 12_900 },
  ],
}

export const TENDER_TPL: { t: Bi; kbli: string; base: number }[] = [
  { t: { id: 'Pengadaan Material Rehabilitasi Rumah Tidak Layak Huni', en: 'Materials for Substandard-Housing Rehabilitation' }, kbli: '46634', base: 680_000_000 },
  { t: { id: 'Pengadaan Semen dan Besi untuk Pembangunan Posyandu', en: 'Cement & Steel for Community Health Posts' }, kbli: '46634', base: 240_000_000 },
  { t: { id: 'Pengadaan Pipa Air Bersih Desa', en: 'Village Clean-Water Pipes' }, kbli: '46634', base: 390_000_000 },
  { t: { id: 'Pengadaan Cat dan Perlengkapan Renovasi Sekolah', en: 'Paint & Supplies for School Renovation' }, kbli: '46634', base: 175_000_000 },
  { t: { id: 'Pengadaan Konsumsi Kegiatan Pelatihan', en: 'Catering for Training Events' }, kbli: '56210', base: 95_000_000 },
  { t: { id: 'Pengadaan Seragam Linmas', en: 'Civil Defence Uniforms' }, kbli: '14111', base: 210_000_000 },
  { t: { id: 'Jasa Angkutan Logistik Bantuan', en: 'Aid Logistics Transport' }, kbli: '49431', base: 160_000_000 },
  { t: { id: 'Pengadaan Alat Tulis Kantor Kecamatan', en: 'District Office Stationery' }, kbli: '47612', base: 85_000_000 },
  { t: { id: 'Pengadaan Bibit Tanaman Penghijauan', en: 'Reforestation Seedlings' }, kbli: '01301', base: 130_000_000 },
  { t: { id: 'Pengadaan Spanduk Sosialisasi', en: 'Information Banners' }, kbli: '18111', base: 45_000_000 },
]

export const CANDIDATE_ROLES = ['Kasir', 'Staf Gudang', 'Admin Penjualan', 'Sopir Pengiriman', 'Sales Lapangan', 'Staf Keuangan']
export const SKILLS = ['Excel', 'Pembukuan', 'Kasir/POS', 'SIM B1', 'Negosiasi', 'Media sosial', 'Inventori', 'Pelayanan pelanggan', 'Bahasa Inggris', 'Desain grafis', 'Las', 'Forklift']

export const BRAND_TEXT: { topic: 'pengiriman' | 'kualitas' | 'harga' | 'layanan' | 'stok'; s: number; t: Bi }[] = [
  { topic: 'pengiriman', s: -0.7, t: { id: 'Pesanan semen saya telat dua hari, padahal dijanjikan besok.', en: 'My cement order was two days late although it was promised for the next day.' } },
  { topic: 'pengiriman', s: 0.6, t: { id: 'Pengiriman cepat, sopirnya ramah dan bantu menurunkan barang.', en: 'Fast delivery, the driver was friendly and helped unload.' } },
  { topic: 'kualitas', s: 0.7, t: { id: 'Besinya sesuai ukuran, tidak ada yang kurang.', en: 'The steel bars matched the size, nothing missing.' } },
  { topic: 'kualitas', s: -0.5, t: { id: 'Ada dua sak semen yang sudah mengeras.', en: 'Two bags of cement had already hardened.' } },
  { topic: 'harga', s: 0.5, t: { id: 'Harga paling bersaing di sekitar pasar.', en: 'The most competitive prices around the market.' } },
  { topic: 'harga', s: -0.4, t: { id: 'Harga terpal naik dibanding minggu lalu.', en: 'Tarp prices went up compared with last week.' } },
  { topic: 'layanan', s: 0.8, t: { id: 'Penjualnya sabar menjelaskan kebutuhan material.', en: 'The seller patiently explained which materials we need.' } },
  { topic: 'layanan', s: -0.6, t: { id: 'Chat WA lama dibalas.', en: 'WhatsApp replies are slow.' } },
  { topic: 'stok', s: -0.5, t: { id: 'Pompa celup kosong waktu saya datang.', en: 'Submersible pumps were out of stock when I came.' } },
]

export const CALL_CUSTOMERS = ['Bapak/Ibu pelanggan', 'Calon nasabah', 'Pemilik proyek rumah', 'Kontraktor kecil', 'Pengurus masjid', 'Kepala tukang']
export const AGENT_TEAMS = ['Tim Mawar', 'Tim Melati', 'Tim Kenanga']
