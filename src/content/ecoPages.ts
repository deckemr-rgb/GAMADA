/**
 * ecoPages.ts — words of the ecosystem site pages (/ekosistem, /ekosistem/:eco, /lab additions), Tahap 6 plan §2.1,
 * §2.2, §2.4, §3.2. ID lives here; EN lives in ecoPages.en.ts (same shape, type-checked) and loads lazily.
 * Structure that does not depend on the language (which products serve which buyer, which chapter a flow node
 * belongs to, module icons) is in the constants below. Product / ecosystem names come from products.ts: copy uses
 * {name} / {n} / {region} placeholders filled by fill() in routes/EcoParts.tsx, never a retyped name.
 * Honesty (plan §0.1, §7 Q5): no prices, no certification, e-Katalog or client claims; "dibahas saat konsultasi".
 */
import { useEffect, useState } from 'react'
import type { EcoId, ProductSlug } from './products'
import type { Lang } from '../lib/i18n'

/* ------------------------------------------------------------------ structure (language-neutral) */

/** "Bagaimana semuanya terhubung" (spec §13): the flood example, one node per product, time from the tour chapter. */
export const HUB_FLOW: readonly { slug: ProductSlug; ch: number }[] = [
  { slug: 'siaga-wilayah', ch: 2 },
  { slug: 'sapa-warga', ch: 2 },
  { slug: 'meja-pimpinan', ch: 3 },
  { slug: 'naskah-pintar', ch: 5 },
  { slug: 'awas-belanja', ch: 7 },
  { slug: 'katalog-lokal', ch: 8 },
  { slug: 'sinyal-pasar', ch: 17 },
]
/** the flow ends with "Lihat langsung di tur, bab {n}" */
export const HUB_FLOW_CHAPTER = 2

/** "Untuk siapa": the products that serve each buyer type (same order as the words in `ecos[eco].buyers`). */
export const BUYER_PRODUCTS: Record<EcoId, readonly (readonly ProductSlug[])[]> = {
  'satu-daerah': [
    ['meja-pimpinan', 'siaga-wilayah', 'radar-isu'],
    ['naskah-pintar', 'awas-belanja', 'cek-berkas'],
    ['sapa-warga', 'radar-isu'],
    ['siaga-wilayah', 'sapa-warga'],
  ],
  'usaha-pintar': [
    ['toko-autopilot', 'pajak-beres', 'pantau-merek'],
    ['juara-jualan', 'toko-autopilot'],
    ['kenal-mitra', 'rapor-usaha'],
    ['tenderpilot', 'pajak-beres'],
  ],
  'pasar-daerah': [
    ['katalog-lokal', 'rapor-usaha'],
    ['sinyal-pasar', 'katalog-lokal'],
    ['indeks-ekonomi', 'sinyal-pasar'],
    ['rapor-usaha', 'kenal-mitra'],
  ],
}

/** GAMADA Inti modules (spec P0), icon keys from demo-kit/ui/icons. */
export const INTI_MODULE_ICONS = ['users', 'spark', 'inbox', 'layers'] as const

/* ------------------------------------------------------------------ words: ID */

const id = {
  constellation: {
    label: 'Konstelasi produk GAMADA',
    hint: 'Arahkan atau fokus ke bintang untuk melihat produknya. Klik untuk membuka.',
    hintTouch: 'Ketuk bintang untuk melihat produknya, ketuk lagi untuk membuka.',
    open: 'Lihat produk',
    openInti: 'Lihat GAMADA Inti',
    listTitle: 'Daftar produk per ekosistem',
    starLabel: '{name}, {eco}',
    links: '{n} hubungan',
  },
  hub: {
    exploreProducts: 'Jelajahi produk',
    panels: {
      eyebrow: 'Tiga ekosistem',
      title: 'Satu fondasi, tiga cara memakainya.',
      lead: 'Pilih dari sisi mana Anda masuk. Setiap produk bisa dipakai sendiri, dan semuanya berbagi akun, data, dan kejadian lewat GAMADA Inti.',
      benefitsLabel: 'Manfaat',
      productsLabel: 'Produk',
      intiTitle: 'Fondasi bersama',
    },
    flow: {
      eyebrow: 'Satu kejadian, tujuh produk',
      title: 'Bagaimana semuanya terhubung',
      lead: 'Contoh dari tur "Satu Hari di {region}": hujan deras pagi hari mengalir dari peringatan dini sampai harga di pasar. Setiap langkah dikerjakan produk yang berbeda.',
      steps: [
        'Prediksi genangan memicu peringatan dini ke camat dan kepala desa di zona rawan.',
        'Warga di zona itu menerima pesan, lalu melapor lewat WhatsApp. Aduan langsung menjadi tiket.',
        'Briefing pagi menyusun dirinya sendiri: desa berisiko, aduan masuk, dan stok bantuan.',
        'Rapat koordinasi menghasilkan notulen dan disposisi ke OPD tanpa diketik ulang.',
        'Paket pengadaan darurat diperiksa: harga di atas pasar dan peserta yang terafiliasi ditandai.',
        'Kebutuhan karung pasir dan terpal dicocokkan ke UMKM lokal yang terverifikasi.',
        'Lonjakan harga bahan pokok terbaca lebih awal, dan operasi pasar menahan harga tetap stabil.',
      ],
      cta: 'Lihat langsung di tur, bab {n}',
      listLabel: 'Alur kejadian antarproduk',
    },
    tour: {
      eyebrow: 'Tur interaktif',
      lead: 'Sekitar {m} menit. Ikuti satu hari hujan di {region} dari pukul {start}: {n} produk saling meneruskan kejadian, dan Anda bisa berhenti di bab mana pun untuk mencoba sendiri.',
      pick: 'Pilih bab',
    },
    faq: {
      eyebrow: 'Pertanyaan umum',
      title: 'Yang biasanya ditanyakan sebelum mulai',
      lead: 'Jawaban singkat untuk pertanyaan pengadaan, keamanan, dan teknis. Detailnya selalu dibahas saat konsultasi, sesuai kebutuhan instansi atau usaha Anda.',
      items: [
        {
          id: 'pengadaan',
          q: 'Bagaimana cara membeli atau mengadakannya?',
          a: 'Alurnya dimulai dari konsultasi, lalu demo personal dengan data contoh yang mirip kondisi Anda, lalu proposal. Skema pengadaannya dibahas bersama dan mengikuti aturan yang berlaku di instansi Anda.',
        },
        {
          id: 'keamanan',
          q: 'Bagaimana keamanan datanya?',
          a: 'Setiap pengguna masuk dengan perannya sendiri dan hanya melihat data yang menjadi tugasnya. Setiap tindakan tercatat di jejak audit GAMADA Inti, dan data dienkripsi saat dikirim. Anda bisa melihat matriks peran dan jejak audit itu langsung di demo.',
        },
        {
          id: 'server',
          q: 'Apakah bisa dipasang di server dalam negeri atau di server kami sendiri?',
          a: 'Bisa dipasang di server dalam negeri atau on-premise di instansi Anda. Pilihan tempat pemasangan, kebutuhan perangkat, dan pemeliharaannya dibahas saat konsultasi.',
        },
        {
          id: 'integrasi',
          q: 'Bisakah tersambung dengan sistem yang sudah kami pakai?',
          a: 'Bisa, lewat API atau ekspor-impor data, misalnya dari sistem keuangan daerah, aplikasi kasir, atau basis data kependudukan yang sudah berjalan. Cakupan integrasinya dipetakan bersama saat konsultasi.',
        },
        {
          id: 'mulai',
          q: 'Apakah harus membeli semuanya sekaligus?',
          a: 'Tidak. Anda bisa mulai dari satu produk. Karena semua produk berbagi GAMADA Inti, produk berikutnya tinggal tersambung ke akun, data, dan jejak audit yang sama.',
        },
      ],
    },
  },
  ecos: {
    'satu-daerah': {
      short: 'Aduan warga, briefing pimpinan, peringatan dini, dan pengawasan belanja bicara satu bahasa, sehingga keputusan diambil dari data yang sama.',
      benefits: ['Aduan warga masuk rapi, langsung jadi tiket', 'Pimpinan melihat seluruh daerah di satu layar', 'Peringatan dan pengadaan terbaca lebih awal'],
      story: [
        'Hari ini, aduan warga tersebar di banyak kanal, briefing pimpinan disusun manual setiap pagi, dan peringatan bencana bergantung pada telepon berantai.',
        'Di Satu Daerah, aduan dari WhatsApp menjadi tiket yang rapi, peta risiko menggerakkan peringatan, dan briefing pagi tersusun sendiri dari kejadian semalam.',
        'Hasilnya, pimpinan memberi instruksi yang langsung menjadi tugas OPD, dan setiap langkahnya bisa ditelusuri kembali ke aduan awalnya.',
      ],
      buyers: [
        { who: 'Kepala Daerah', benefit: 'Briefing pagi yang siap tanpa diminta, dan isu yang terlihat sebelum ramai.' },
        { who: 'Sekda dan OPD', benefit: 'Notulen, disposisi, pengadaan, dan berkas warga yang diperiksa otomatis.' },
        { who: 'Diskominfo', benefit: 'Satu kanal layanan warga lewat WhatsApp, dan klarifikasi hoaks yang cepat.' },
        { who: 'BPBD', benefit: 'Prediksi genangan di peta daerah dan peringatan ke warga yang tepat.' },
      ],
    },
    'usaha-pintar': {
      short: 'Kasir, stok, pembukuan, tim penjualan, dan reputasi berjalan sendiri, lalu ikut membaca kejadian di daerah seperti banjir atau lonjakan harga.',
      benefits: ['Stok dan PO ke supplier berjalan sendiri', 'Nota menjadi jurnal, pajak siap tepat waktu', 'Tim penjualan dan reputasi terpantau setiap hari'],
      story: [
        'Pemilik usaha menghabiskan malam untuk mencocokkan nota, menebak stok, dan membalas keluhan satu per satu.',
        'Di Usaha Pintar, transaksi kasir menggerakkan stok dan PO ke supplier, nota foto menjadi jurnal, dan percakapan penjualan dinilai lalu dilatih.',
        'Hasilnya, usaha siap menghadapi hari yang tidak biasa, misalnya hujan deras yang menaikkan permintaan, dan pemiliknya punya waktu untuk mengembangkan usaha.',
      ],
      buyers: [
        { who: 'Pemilik toko multi-cabang', benefit: 'Stok, harga, pembukuan, dan keluhan pelanggan dari semua cabang dalam satu tempat.' },
        { who: 'Manajer sales', benefit: 'Setiap percakapan dinilai, dan setiap agen dilatih di titik lemahnya.' },
        { who: 'Bank dan koperasi', benefit: 'Verifikasi calon nasabah dan skor kesehatan usaha dari data transaksi.' },
        { who: 'Vendor pengadaan', benefit: 'Tender yang cocok ditemukan, syarat dicentang, dokumen penawaran tersusun.' },
      ],
    },
    'pasar-daerah': {
      short: 'Belanja pemda mengalir ke UMKM lokal yang terverifikasi, dan dampaknya pada harga serta ekonomi kecamatan terbaca setiap hari.',
      benefits: ['Kebutuhan pemda cocok ke UMKM lokal', 'Modal kerja cair dari skor usaha yang nyata', 'Harga dan ekonomi kecamatan terbaca lebih awal'],
      story: [
        'Pemda ingin belanjanya berputar di daerah sendiri, tetapi sulit menemukan UMKM lokal yang siap dan terverifikasi. UMKM pun sulit mendapat modal kerja.',
        'Di Pasar Daerah, kebutuhan pemda dicocokkan ke UMKM berlencana, skor usaha membuka akses modal, dan sinyal harga terbaca beberapa hari lebih awal.',
        'Hasilnya, pemda bisa mengukur dampak kebijakannya per kecamatan, dari operasi pasar sampai belanja darurat.',
      ],
      buyers: [
        { who: 'Dinas Koperasi dan UMKM', benefit: 'Etalase UMKM lokal yang terverifikasi dan skor kesehatan usaha binaan.' },
        { who: 'Disperindag', benefit: 'Peringatan harga bahan pokok dan rekomendasi operasi pasar.' },
        { who: 'Bappeda', benefit: 'Indikator ekonomi setiap kecamatan dan dampak kebijakan yang terukur.' },
        { who: 'Bank daerah', benefit: 'Calon debitur UMKM dengan skor usaha dan verifikasi yang sudah rapi.' },
      ],
    },
  },
  inti: {
    short: 'Satu akun, satu data, satu jejak audit. Produk mana pun yang Anda pakai, semuanya berdiri di atas fondasi yang sama.',
    story: [
      'Satu akun: setiap orang masuk sekali, lalu memegang peran yang berbeda di produk yang berbeda.',
      'Satu data: aduan, peringatan, belanja, dan harga yang sama terlihat oleh produk yang membutuhkannya, tanpa diketik ulang.',
      'Satu jejak: setiap tindakan tercatat, sehingga satu aduan warga bisa ditelusuri melintasi enam produk.',
    ],
    modulesTitle: 'Empat modul Inti',
    modulesLead: 'Bagian yang dipakai bersama oleh semua produk. Semuanya bisa dicoba di demo GAMADA Inti.',
    modules: [
      { name: 'Inti ID', body: 'Satu akun, banyak peran. Matriks hak akses per produk berubah saat peran berganti.' },
      { name: 'Inti Agen', body: 'Jejak berpikir agen AI untuk setiap permintaan: maksud, alat, data, lalu jawaban.' },
      { name: 'Inti Kanal', body: 'Kotak masuk gabungan WhatsApp, web, dan telepon dari semua produk.' },
      { name: 'Inti Data + Audit Log', body: 'Graf jejak data satu kejadian lintas produk, dan log audit yang bisa disaring.' },
    ],
    trail: 'Lihat jejak data',
    trailTour: 'Penutupan hari di tur, bab {n}',
    getsTitle: 'Yang didapat setiap produk',
    getsLead: 'Karena berdiri di atas Inti, produk yang Anda pilih langsung membawa empat hal ini.',
    gets: [
      { title: 'Masuk sekali, peran jelas', body: 'Satu akun untuk semua produk, dengan hak akses per peran.' },
      { title: 'Jejak audit', body: 'Siapa, kapan, dan apa yang berubah, tercatat di satu tempat.' },
      { title: 'Agen AI bersama', body: 'Asisten yang bisa membaca data lintas produk sesuai hak akses.' },
      { title: 'Kanal bersama', body: 'Pesan WhatsApp, web, dan telepon masuk ke satu kotak.' },
    ],
  },
  detail: {
    storyEyebrow: 'Cerita',
    storyTitle: 'Dari masalah sehari-hari ke sistem yang saling terhubung',
    flowEyebrow: 'Alur antarproduk',
    flowLead: 'Urutan kejadian dalam tur "Satu Hari di {region}". Setiap langkah bisa diputar sebagai satu bab.',
    play: 'Putar bab {n}',
    productsEyebrow: 'Produk',
    tryDemo: 'Coba demo',
    buyersEyebrow: 'Untuk siapa',
    buyersTitle: 'Manfaat per jenis pembeli',
    buyersLead: 'Siapa yang paling merasakan manfaatnya, dan produk mana yang melayaninya.',
    connectsEyebrow: 'Lintas ekosistem',
    othersEyebrow: 'Jelajahi',
    glyph: 'Gugus {name} dalam konstelasi',
  },
  lab: {
    preview: 'Pratinjau langsung',
    previewHint: 'Arahkan kursor ke kartu untuk memutar pratinjau.',
  },
}

export type EcoPagesCopy = typeof id
export const ecoPagesId: EcoPagesCopy = id

/* ------------------------------------------------------------------ loader */

let enCache: EcoPagesCopy | null = null
let enPending: Promise<EcoPagesCopy> | null = null
function loadEn(): Promise<EcoPagesCopy> {
  if (enCache) return Promise.resolve(enCache)
  enPending ??= import('./ecoPages.en').then(
    (m) => (enCache = m.en),
    (e: unknown) => {
      enPending = null
      throw e
    },
  )
  return enPending
}

/**
 * The page words for `lang`. EN loads lazily: null until it arrives (the page renders its body only then, so no
 * ID text flashes and SplitText headings never get patched in place).
 */
export function useEcoPages(lang: Lang): EcoPagesCopy | null {
  const [en, setEn] = useState<EcoPagesCopy | null>(enCache)
  useEffect(() => {
    if (lang !== 'en' || en) return
    let alive = true
    loadEn().then(
      (c) => alive && setEn(c),
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [lang, en])
  return lang === 'en' ? en : id
}
