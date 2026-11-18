/**
 * world/up/texts.ts — Usaha Pintar texts of the seed, the reactions and the natural events (lazy, with the UP module).
 * Every template carries entity slots ({item}, {desa}, {kec}, {code}, {days}, {eta} …), and pools rotate
 * least-recently-used, so no sentence repeats within a day's stream. All people / handles / companies are fictional.
 */
import type { Bi, BrandTopic, CriterionKey, Sentiment } from '../types'

/** fill {key} placeholders in both languages */
export function fillBi(t: Bi, v: Record<string, string | number>): Bi {
  const f = (x: string) => x.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))
  return { id: f(t.id), en: f(t.en) }
}

/* ------------------------------------------------------------------ tenders */
export const TENDER_TPL: { t: Bi; kbli: string; base: number; items?: [string, string, string, number, string][] }[] = [
  { t: { id: 'Pengadaan Material Rehabilitasi Rumah Tidak Layak Huni', en: 'Materials for Substandard-Housing Rehabilitation' }, kbli: '46634', base: 680_000_000, items: [['semen', 'Semen 50 kg', 'Cement 50 kg', 2400, 'sak'], ['besi', 'Besi beton 10 mm', 'Rebar 10 mm', 1800, 'batang']] },
  { t: { id: 'Pengadaan Semen dan Besi untuk Pembangunan Posyandu', en: 'Cement & Steel for Community Health Posts' }, kbli: '46634', base: 240_000_000, items: [['semen', 'Semen 50 kg', 'Cement 50 kg', 900, 'sak'], ['besi', 'Besi beton 8 mm', 'Rebar 8 mm', 700, 'batang']] },
  { t: { id: 'Pengadaan Pipa Air Bersih Desa', en: 'Village Clean-Water Pipes' }, kbli: '46634', base: 390_000_000, items: [['pipa', 'Pipa PVC 3"', 'PVC pipe 3"', 1400, 'batang']] },
  { t: { id: 'Pengadaan Cat dan Perlengkapan Renovasi Sekolah', en: 'Paint & Supplies for School Renovation' }, kbli: '46634', base: 175_000_000, items: [['cat', 'Cat tembok 25 kg', 'Wall paint 25 kg', 260, 'pail']] },
  { t: { id: 'Pengadaan Konsumsi Kegiatan Pelatihan', en: 'Catering for Training Events' }, kbli: '56210', base: 95_000_000 },
  { t: { id: 'Pengadaan Seragam Linmas', en: 'Civil Defence Uniforms' }, kbli: '14111', base: 210_000_000 },
  { t: { id: 'Jasa Angkutan Logistik Bantuan', en: 'Aid Logistics Transport' }, kbli: '49431', base: 160_000_000 },
  { t: { id: 'Pengadaan Alat Tulis Kantor Kecamatan', en: 'District Office Stationery' }, kbli: '47612', base: 85_000_000 },
  { t: { id: 'Pengadaan Bibit Tanaman Penghijauan', en: 'Reforestation Seedlings' }, kbli: '01301', base: 130_000_000 },
  { t: { id: 'Pengadaan Spanduk Sosialisasi', en: 'Information Banners' }, kbli: '18111', base: 45_000_000 },
]
/** the 07:01 natural tender (non-emergency, matches the shop) */
export const NATURAL_TENDER = {
  key: 'material-saluran-0701',
  t: { id: 'Pengadaan Material Perbaikan Saluran Desa', en: 'Materials for Village Drain Repair' } as Bi,
  items: [['semen', 'Semen 50 kg', 'Cement 50 kg', 420, 'sak'], ['pasir-batu', 'Batu kali', 'River stone', 60, 'm3']] as [string, string, string, number, string][],
}

/* ------------------------------------------------------------------ sales (Juara Jualan) */
export const ORG = {
  mf: 'Arta Kencana Finance',
  asr: 'Pelita Proteksi',
}
/** the multifinance agent whose voice is media SALES_CALL */
export const RINA = { name: 'Rina Wulandari', gender: 'P' as const }
export const SALES_CALL_CUSTOMER = 'Bpk. Darmaji'
export const CUSTOMER_ROLE: Record<string, Bi[]> = {
  'toko-bangunan': [{ id: 'kontraktor', en: 'contractor' }, { id: 'pemilik rumah', en: 'home owner' }, { id: 'tukang', en: 'builder' }, { id: 'pengurus musala', en: 'prayer-house committee' }],
  multifinance: [{ id: 'calon nasabah', en: 'prospect' }, { id: 'nasabah', en: 'customer' }],
  asuransi: [{ id: 'calon nasabah', en: 'prospect' }, { id: 'pemegang polis', en: 'policy holder' }],
}
/** one coaching focus + one example sentence per weak criterion (two variants: no card repeats a sentence) */
export const COACH: Record<CriterionKey, { focus: Bi; example: Bi }[]> = {
  salam: [
    { focus: { id: 'Buka dengan salam, nama, dan tujuan panggilan', en: 'Open with a greeting, your name and the purpose' }, example: { id: '“Selamat pagi, Pak. Saya {agent} dari {org}, mau konfirmasi pesanan Bapak.”', en: '“Good morning, sir. I am {agent} from {org}, calling to confirm your order.”' } },
    { focus: { id: 'Pastikan identitas pelanggan sebelum masuk ke detail', en: 'Confirm the customer’s identity before the details' }, example: { id: '“Betul saya bicara dengan Bapak pemilik proyek di {desa}?”', en: '“Am I speaking with the project owner in {desa}?”' } },
  ],
  gali: [
    { focus: { id: 'Gali kebutuhan dengan dua pertanyaan terbuka', en: 'Explore needs with two open questions' }, example: { id: '“Untuk pekerjaan apa barangnya, dan kapan mulai dipakai?”', en: '“What is it for, and when do you need it?”' } },
    { focus: { id: 'Ulangi kebutuhan pelanggan sebelum menawarkan', en: 'Restate the need before offering' }, example: { id: '“Jadi Bapak butuh untuk dua kamar, mulai minggu depan, betul?”', en: '“So you need it for two rooms, starting next week, right?”' } },
  ],
  keberatan: [
    { focus: { id: 'Jawab keberatan harga dengan nilai, bukan diskon', en: 'Answer price objections with value, not discounts' }, example: { id: '“Harganya memang selisih sedikit, tapi sudah termasuk antar dan garansi tukar.”', en: '“It is slightly more, but delivery and an exchange guarantee are included.”' } },
    { focus: { id: 'Akui keberatan dulu, lalu tawarkan pilihan', en: 'Acknowledge the objection, then offer options' }, example: { id: '“Saya paham, Bu. Ada pilihan tenor lebih panjang supaya cicilannya ringan.”', en: '“I understand, ma’am. A longer tenor keeps the instalment light.”' } },
  ],
  penawaran: [
    { focus: { id: 'Sebut satu penawaran yang jelas: barang, harga, waktu', en: 'Make one clear offer: item, price, timing' }, example: { id: '“Untuk 40 sak, totalnya Rp 2,8 juta, bisa kirim besok pagi.”', en: '“For 40 bags the total is Rp 2.8 million, delivered tomorrow morning.”' } },
    { focus: { id: 'Hubungkan penawaran dengan kebutuhan yang tadi digali', en: 'Tie the offer to the need you uncovered' }, example: { id: '“Karena dipakai di luar, saya sarankan yang tahan air ini.”', en: '“Since it is used outdoors, I suggest this waterproof one.”' } },
  ],
  closing: [
    { focus: { id: 'Tutup dengan ajakan yang konkret', en: 'Close with a concrete next step' }, example: { id: '“Saya catat pesanannya sekarang ya, Pak, dikirim jam 8 besok?”', en: '“Shall I book it now, sir, for delivery at 8 tomorrow?”' } },
    { focus: { id: 'Tawarkan dua pilihan waktu, bukan ya/tidak', en: 'Offer two time options, not yes/no' }, example: { id: '“Lebih enak dikirim pagi atau sore, Bu?”', en: '“Would morning or afternoon delivery suit you, ma’am?”' } },
  ],
  kepatuhan: [
    { focus: { id: 'Hindari janji yang tidak bisa dijamin', en: 'Avoid promises you cannot guarantee' }, example: { id: 'Ganti “pasti disetujui” dengan “kami bantu proses secepatnya”.', en: 'Replace “surely approved” with “we will process it as fast as we can”.' } },
    { focus: { id: 'Sebutkan syarat dan biaya dengan lengkap', en: 'State terms and fees in full' }, example: { id: '“Ada biaya administrasi Rp 150 ribu di awal, sudah saya kirim rinciannya.”', en: '“There is a Rp 150k admin fee up front; I have sent the breakdown.”' } },
  ],
}

/* ------------------------------------------------------------------ suppliers (C16): ≥ 20 replies, LRU */
export const SUPPLIER_REPLY: Bi[] = [
  { id: 'Siap, {code} kami proses. Barang dikirim {eta}.', en: 'Noted, we are processing {code}. Goods ship {eta}.' },
  { id: 'Pesanan {code} sudah masuk gudang kami, sopir berangkat {eta}.', en: 'Order {code} is in our warehouse, the driver leaves {eta}.' },
  { id: 'Terima kasih, {code} kami siapkan. Estimasi tiba {eta}.', en: 'Thank you, we are preparing {code}. Expected {eta}.' },
  { id: 'Oke Pak, {item} untuk {code} ready. Kirim {eta}.', en: 'OK sir, {item} for {code} is ready. Shipping {eta}.' },
  { id: '{code} sudah kami terima. Truk kami jadwalkan {eta}.', en: '{code} received. We have scheduled the truck {eta}.' },
  { id: 'Siap kirim {code}, nota menyusul bersama barang {eta}.', en: 'Ready to ship {code}; the invoice comes with the goods {eta}.' },
  { id: 'Baik, {code} masuk antrean muat. Perkiraan sampai {eta}.', en: 'Fine, {code} is in the loading queue. Expected {eta}.' },
  { id: 'Stok {item} aman untuk {code}. Kami antar {eta}.', en: '{item} stock covers {code}. We deliver {eta}.' },
  { id: 'Sudah kami cek, {code} lengkap. Pengiriman {eta}.', en: 'Checked, {code} is complete. Delivery {eta}.' },
  { id: 'Pesanan {code} diterima, mohon siapkan tempat bongkar {eta}.', en: 'Order {code} received; please clear the unloading space {eta}.' },
  { id: 'Terima kasih order {code}-nya. Armada kami tiba {eta}.', en: 'Thanks for order {code}. Our truck arrives {eta}.' },
  { id: 'Oke, {code} kami kirim bersama pesanan pasar {eta}.', en: 'OK, {code} goes out with the market run {eta}.' },
  { id: '{item} untuk {code} sudah dikemas. Jadwal antar {eta}.', en: '{item} for {code} is packed. Delivery slot {eta}.' },
  { id: 'Siap, Pak. {code} kami prioritaskan, sampai {eta}.', en: 'Sure, sir. We prioritise {code}, arriving {eta}.' },
  { id: 'Admin kami sudah input {code}. Barang jalan {eta}.', en: 'Our admin has entered {code}. Goods leave {eta}.' },
  { id: 'Konfirmasi {code}: jumlah sesuai, dikirim {eta}.', en: 'Confirming {code}: quantities match, shipping {eta}.' },
  { id: 'Baik, {code} kami bawa sekalian rute timur {eta}.', en: 'Fine, {code} rides with our eastern route {eta}.' },
  { id: 'Pesanan {code} oke. Kalau ada tambahan kabari sebelum {eta}.', en: 'Order {code} is fine. Tell us about extras before {eta}.' },
  { id: '{code} siap muat. Sopir akan telepon dulu {eta}.', en: '{code} is ready to load. The driver will call {eta}.' },
  { id: 'Terima kasih, {code} tercatat. Barang sampai toko {eta}.', en: 'Thank you, {code} is logged. Goods reach the shop {eta}.' },
  { id: 'Siap, {code}. {item} kami ambil dari stok baru, kirim {eta}.', en: 'Sure, {code}. {item} comes from fresh stock, shipping {eta}.' },
  { id: 'Oke, {code} kami kirim pakai pikap {eta}.', en: 'OK, {code} goes by pickup {eta}.' },
]
/** the supplier role's quick replies (Toko Autopilot) — product strings, listed here for the wording to match */
export const ETA_WORDS = {
  besokPagi: { id: 'besok pagi pukul 07.00', en: 'tomorrow at 07:00' } as Bi,
  days: { id: 'dalam {n} hari', en: 'in {n} days' } as Bi,
}

/* ------------------------------------------------------------------ brand (Pantau Merek) */
export interface BrandTpl { topic: BrandTopic; s: number; t: Bi }
/** ambient texts of the shop (≥ 4 per topic, mixed sentiment) */
export const BRAND_TEXT: BrandTpl[] = [
  { topic: 'pengiriman', s: 0.6, t: { id: 'Pengiriman {item} ke {desa} cepat, sopirnya bantu menurunkan.', en: 'Delivery of {item} to {desa} was quick; the driver helped unload.' } },
  { topic: 'pengiriman', s: 0.5, t: { id: 'Pesan {item} pagi, siang sudah sampai di {desa}.', en: 'Ordered {item} in the morning, it reached {desa} by noon.' } },
  { topic: 'pengiriman', s: -0.6, t: { id: 'Pesanan {item} saya ke {desa} telat sehari dari janji.', en: 'My {item} order to {desa} came a day later than promised.' } },
  { topic: 'pengiriman', s: 0.1, t: { id: 'Kirim ke {desa} bisa, tapi ongkirnya dihitung per rit.', en: 'They deliver to {desa}, but the fee is per trip.' } },
  { topic: 'kualitas', s: 0.7, t: { id: '{item} sesuai ukuran, tidak ada yang kurang.', en: '{item} matched the size, nothing missing.' } },
  { topic: 'kualitas', s: -0.5, t: { id: 'Ada dua {item} yang kondisinya kurang bagus.', en: 'Two pieces of {item} were in poor condition.' } },
  { topic: 'kualitas', s: 0.5, t: { id: '{item} awet, sudah dipakai setahun masih bagus.', en: '{item} lasts; still fine after a year.' } },
  { topic: 'kualitas', s: 0.2, t: { id: 'Kualitas {item} standar, sesuai harga.', en: '{item} quality is standard for the price.' } },
  { topic: 'harga', s: 0.5, t: { id: 'Harga {item} paling bersaing di sekitar {market}.', en: '{item} prices are the most competitive around {market}.' } },
  { topic: 'harga', s: -0.4, t: { id: 'Harga {item} naik dibanding minggu lalu.', en: '{item} went up compared with last week.' } },
  { topic: 'harga', s: 0.3, t: { id: 'Beli {item} banyak dapat potongan, lumayan.', en: 'Buying {item} in bulk gets a discount, not bad.' } },
  { topic: 'harga', s: 0, t: { id: 'Harga {item} sama saja dengan toko lain di {kec}.', en: '{item} costs the same as other shops in {kec}.' } },
  { topic: 'layanan', s: 0.8, t: { id: 'Penjualnya sabar menjelaskan {item} yang cocok.', en: 'The seller patiently explained which {item} fits.' } },
  { topic: 'layanan', s: -0.6, t: { id: 'Tanya stok {item} lewat chat, lama dibalas.', en: 'Asked about {item} stock by chat; slow reply.' } },
  { topic: 'layanan', s: 0.6, t: { id: 'Kasirnya ramah, antre di jam ramai tetap cepat.', en: 'Friendly cashier; even the rush-hour queue moved fast.' } },
  { topic: 'layanan', s: 0.4, t: { id: 'Bisa bayar QRIS, struknya rapi untuk laporan proyek.', en: 'QRIS accepted; tidy receipts for project reports.' } },
  { topic: 'stok', s: -0.5, t: { id: '{item} kosong waktu saya datang ke toko.', en: '{item} was out of stock when I came.' } },
  { topic: 'stok', s: 0.5, t: { id: 'Stok {item} lengkap, tidak perlu ke kota.', en: 'Plenty of {item} in stock; no need to go to town.' } },
  { topic: 'stok', s: 0.2, t: { id: '{item} ada, tapi ukuran besarnya tinggal sedikit.', en: '{item} in stock, but few large sizes left.' } },
  { topic: 'stok', s: -0.3, t: { id: 'Harus inden {item} dua hari.', en: 'Had to pre-order {item}; two days’ wait.' } },
  { topic: 'pengiriman', s: 0.4, t: { id: 'Barang {item} dikemas rapi, sampai {desa} aman.', en: '{item} was packed well and reached {desa} safely.' } },
  { topic: 'kualitas', s: -0.3, t: { id: 'Warna {item} beda sedikit dari contoh.', en: 'The {item} colour differs slightly from the sample.' } },
  { topic: 'harga', s: 0.4, t: { id: 'Ada promo {item} akhir pekan, hemat.', en: 'Weekend promo on {item}; good savings.' } },
  { topic: 'layanan', s: 0.5, t: { id: 'Dibantu hitung kebutuhan {item} untuk renovasi.', en: 'They helped me work out how much {item} I need.' } },
]
/** category posts (no shop named) */
export const CATEGORY_TEXT: BrandTpl[] = [
  { topic: 'harga', s: 0.1, t: { id: 'Ada yang tahu toko bangunan di {kec} yang harga {item}-nya miring?', en: 'Anyone know a building shop in {kec} with cheap {item}?' } },
  { topic: 'stok', s: -0.2, t: { id: 'Musim hujan, {item} di toko-toko {kec} mulai jarang.', en: 'Rainy season: {item} is getting scarce in {kec} shops.' } },
  { topic: 'layanan', s: 0.3, t: { id: 'Toko bangunan sekarang banyak yang bisa pesan lewat chat, praktis.', en: 'Many building shops now take chat orders; handy.' } },
  { topic: 'pengiriman', s: 0.2, t: { id: 'Warga {desa} biasanya beli material dari pasar, antar sendiri.', en: '{desa} residents usually buy materials at the market and haul them home.' } },
]
/** competitor posts */
export const COMPETITOR_TEXT: BrandTpl[] = [
  { topic: 'pengiriman', s: -0.5, t: { id: '{brand}: kiriman {item} ke {desa} belum datang juga.', en: '{brand}: my {item} delivery to {desa} still hasn’t come.' } },
  { topic: 'harga', s: 0.4, t: { id: '{brand} lagi diskon {item}, lumayan murah.', en: '{brand} has {item} on discount, fairly cheap.' } },
  { topic: 'layanan', s: 0.5, t: { id: 'Pelayanan {brand} cepat, langsung dicarikan {item}.', en: '{brand} service was quick; they found {item} straight away.' } },
  { topic: 'stok', s: -0.4, t: { id: '{brand} kehabisan {item} sejak kemarin.', en: '{brand} has been out of {item} since yesterday.' } },
  { topic: 'kualitas', s: 0.3, t: { id: '{item} dari {brand} bagus, tidak cepat rusak.', en: '{item} from {brand} is good, doesn’t wear fast.' } },
]
/** ambient handles (fictional, generic) */
export const HANDLES = ['warga_', 'tukang.', 'bunda', 'proyek.', 'kangmas_', 'mbak', 'renov.', 'pakde_', 'arek', 'kontraktor.', 'rumah', 'jualan_']

/** sentiment of a −1..1 score */
export const sentimentOf = (score: number): Sentiment => (score < -0.2 ? 'negatif' : score > 0.2 ? 'positif' : 'netral')
