/**
 * tour.ts — the chapter list of the tour "Satu Hari di [DAERAH_1]" (spec §12.2), shared by /tur, /tur/:bab,
 * /ekosistem/:eco ("Mulai tur dari bab X") and /produk/:slug ("Lihat di tur").
 * This is the INDEX only: the cinematic DSL (steps, narration, mapFly …) lives in src/demo-kit/tour/chapters.ts
 * (tahap 5) and must keep these numbers, times and products.
 */
import type { Bi, EcoOrInti, ProductSlug } from './products'
import { PRODUCT_BY_SLUG } from './products'
import type { KnownRegionId } from '../demo-kit/region/loader'

/**
 * The tour's region and day (owner decisions). The name mirrors REGIONS in src/demo-kit/region/loader.ts and is
 * kept literal so the site pages do not pull the region loader (zod) into their chunks.
 */
export const TOUR = {
  regionId: 'bojonegoro' satisfies KnownRegionId,
  regionName: 'Bojonegoro',
  /** demo day (Tuesday) */
  day: '2026-11-17',
  /** the tour opens at 06:00; the sandbox clock starts at 07:00 */
  start: '06:00',
  /** total length at 1× (spec: 7–9 min) */
  minutes: 8,
} as const

export interface TourChapter {
  /** 1-based chapter number; also the /tur/:bab segment */
  n: number
  /** world time "HH:MM"; null for the closing summary */
  time: string | null
  /** products shown, in order (empty for the summary) */
  products: ProductSlug[]
  title: Bi
}

export const TOUR_CHAPTERS: readonly TourChapter[] = [
  { n: 1, time: '06:00', products: ['siaga-wilayah'], title: { id: 'Sel hujan masuk; prediksi genangan +6 jam; 4 kecamatan waspada', en: 'Rain cells move in; flooding forecast +6 h; 4 districts on alert' } },
  { n: 2, time: '06:20', products: ['siaga-wilayah', 'sapa-warga'], title: { id: 'Peringatan dini terkirim ke camat dan kepala desa; warga di zona menerima pesan', en: 'Early warning sent to district and village heads; residents in the zone get a message' } },
  { n: 3, time: '07:00', products: ['meja-pimpinan'], title: { id: 'Briefing pagi tersusun sendiri; pimpinan bertanya "Desa mana paling berisiko?"', en: 'The morning briefing assembles itself; the head asks "Which village is most at risk?"' } },
  { n: 4, time: '08:15', products: ['sapa-warga'], title: { id: 'Ibu Siti mengirim pesan suara berbahasa Jawa; tiket terbentuk; klaster aduan banjir', en: 'Ibu Siti sends a voice note in Javanese; a ticket forms; flood complaints cluster' } },
  { n: 5, time: '09:00', products: ['naskah-pintar'], title: { id: 'Rapat koordinasi; notulen dan 6 tindak lanjut tersusun live; disposisi ke OPD', en: 'Coordination meeting; minutes and 6 follow-ups written live; dispositions to agencies' } },
  { n: 6, time: '10:00', products: ['radar-isu'], title: { id: 'Hoaks "bendungan jebol" terdeteksi; klarifikasi terbit; sentimen pulih', en: 'A "dam burst" hoax is detected; a clarification goes out; sentiment recovers' } },
  { n: 7, time: '11:00', products: ['awas-belanja'], title: { id: 'Paket darurat pompa air dianalisis: HPS kemahalan dan peserta terafiliasi', en: 'Emergency water-pump package analysed: overpriced estimate and affiliated bidders' } },
  { n: 8, time: '11:40', products: ['katalog-lokal'], title: { id: 'Kebutuhan karung pasir dan terpal dicocokkan ke UMKM lokal berlencana', en: 'Sandbag and tarpaulin needs matched to badged local SMEs' } },
  { n: 9, time: '12:00', products: ['kenal-mitra'], title: { id: 'UMKM baru diverifikasi KYB, lalu lencananya muncul', en: 'A new SME passes KYB verification and earns its badge' } },
  { n: 10, time: '12:30', products: ['tenderpilot'], title: { id: 'Toko bangunan menerima notifikasi tender, skor peluang 78%, penawaran terkirim', en: 'A hardware store gets a tender alert, 78% win score, bid submitted' } },
  { n: 11, time: '13:00', products: ['toko-autopilot'], title: { id: 'Prediksi permintaan melonjak; PO otomatis ke supplier; supplier membalas', en: 'Demand forecast jumps; automatic PO to the supplier; the supplier replies' } },
  { n: 12, time: '13:30', products: ['juara-jualan'], title: { id: 'Chat penjualan dinilai; coaching untuk kasir baru', en: 'Sales chats scored; coaching for a new cashier' } },
  { n: 13, time: '14:00', products: ['pajak-beres'], title: { id: 'Nota pembelian stok menjadi jurnal; status pajak "siap"', en: 'Stock purchase receipts become journal entries; tax status "ready"' } },
  { n: 14, time: '14:30', products: ['rapor-usaha'], title: { id: 'Skor usaha naik, koperasi mitra menyetujui modal kerja', en: 'The business score rises; the partner cooperative approves working capital' } },
  { n: 15, time: '15:00', products: ['pantau-merek'], title: { id: 'Keluhan "pengiriman lambat" ditangani dengan balasan massal', en: '"Slow delivery" complaints handled with bulk replies' } },
  { n: 16, time: '15:30', products: ['cek-berkas'], title: { id: '50 pendaftar bansos banjir diverifikasi; 3 NIK ganda ditemukan', en: '50 flood-aid applicants verified; 3 duplicate ID numbers found' } },
  { n: 17, time: '16:00', products: ['sinyal-pasar'], title: { id: 'Harga cabai dan beras mulai naik; rekomendasi operasi pasar', en: 'Chilli and rice prices start to rise; market operation recommended' } },
  { n: 18, time: '16:30', products: ['indeks-ekonomi'], title: { id: 'Dampak banjir dan operasi pasar pada ekonomi kecamatan', en: 'Impact of the flood and the market operation on district economies' } },
  { n: 19, time: '17:00', products: ['meja-pimpinan', 'inti'], title: { id: 'Penutupan hari: jejak data aduan Ibu Siti melintasi 6 produk', en: "Closing the day: Ibu Siti's complaint traced across 6 products" } },
  { n: 20, time: null, products: [], title: { id: 'Ringkasan: angka hari ini, PDF bawa pulang, coba sendiri', en: "Summary: today's numbers, take-home PDF, try it yourself" } },
]

export const chapterByNumber = (n: number): TourChapter | undefined => TOUR_CHAPTERS.find((c) => c.n === n)

/** Parses the /tur/:bab segment ("5"); anything else → undefined. */
export function parseChapter(bab: string | undefined): TourChapter | undefined {
  if (!bab || !/^\d{1,2}$/.test(bab)) return undefined
  return chapterByNumber(Number(bab))
}

/** First chapter in which a product appears (products.ts `chapters` is the source). */
export function firstChapterOf(slug: ProductSlug): number | undefined {
  return PRODUCT_BY_SLUG[slug].chapters[0]
}

/** Chapters that show at least one product of an ecosystem, in tour order. */
export function chaptersOfEco(eco: EcoOrInti): TourChapter[] {
  return TOUR_CHAPTERS.filter((c) => c.products.some((s) => PRODUCT_BY_SLUG[s].eco === eco))
}
