/**
 * world/texts.ts — the small part of the catalog the RUNNING world needs (reducers, audit lines, reactions and
 * natural events): category labels and SLA, natural complaint/mention texts, media names, the emergency pump
 * package. Everything else the generator draws from lives in catalog.ts (loaded only when a world is generated).
 * All names here are FICTIONAL.
 */
import type { Bi, ComplaintCategory } from './types'

export const MEDIA_OUTLETS = ['Warta Senja Raya', 'Kabar Simpang Kota', 'Lensa Kalangan', 'Gema Pelita Daerah', 'Rona Kabar', 'Ruang Warta 24', 'Titik Temu News', 'Jurnal Pinggir Kali']
export const SOCIAL_HANDLES = ['@infowarga.kini', '@kabar.sekitar.id', '@sobat.lintas', '@jalan.kampung', '@ceritawarga', '@pantau.desa', '@suara.pinggiran', '@warung.diskusi', '@relawan.kali', '@anak.pasar']

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

export const CATEGORY_SLA_DAYS: Record<ComplaintCategory, number> = {
  banjir: 1, 'jalan-rusak': 7, sampah: 2, pju: 3, 'air-bersih': 2, 'pohon-tumbang': 1, pungli: 5, kesehatan: 3, sekolah: 7, adminduk: 3, bansos: 5, lainnya: 5,
}
export { CATEGORY_LABEL } from './labels'

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
