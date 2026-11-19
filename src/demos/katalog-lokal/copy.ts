/** katalog-lokal — /produk/katalog-lokal page copy (Tahap 6 plan §3.1). Sources: spec §11 P14, products.ts, tour ch. 8. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Pemda menulis kebutuhan dengan bahasa biasa, lalu UMKM lokal yang terverifikasi dan dekat lokasi muncul berurutan, lengkap dengan lencananya.',
    en: 'The government writes its need in plain words, then verified local SMEs near the site appear in order, with their badges.',
  },
  problems: [
    {
      title: { id: 'Belanja pemda jarang sampai ke UMKM lokal', en: 'Government spending rarely reaches local SMEs' },
      body: { id: 'OPD sulit menemukan UMKM di daerahnya sendiri yang sanggup memenuhi kebutuhan.', en: 'Agencies struggle to find SMEs in their own region who can meet the need.' },
    },
    {
      title: { id: 'Kepercayaan sulit dibangun', en: 'Trust is hard to build' },
      body: { id: 'Tanpa verifikasi dan rekam jejak, pembeli memilih penyedia yang sudah biasa.', en: 'Without verification and a track record, buyers stick to the usual suppliers.' },
    },
    {
      title: { id: 'Kebutuhan mendadak', en: 'Sudden needs' },
      body: { id: 'Karung pasir dan terpal dibutuhkan dalam dua hari, bukan dua minggu.', en: 'Sandbags and tarpaulins are needed in two days, not two weeks.' },
    },
  ],
  steps: [
    {
      title: { id: 'Buat kebutuhan', en: 'Create a need' },
      body: { id: '"Butuh karung pasir dan terpal untuk satu kecamatan, kirim 2 hari" diubah AI menjadi spesifikasi terstruktur.', en: '"Need sandbags and tarpaulins for one district, delivered in 2 days" is turned into a structured spec by the AI.' },
    },
    {
      title: { id: 'Pencocokan', en: 'Matching' },
      body: { id: 'Garis dari kebutuhan ke kartu UMKM lokal menyala; shortlist menampilkan lencana, jarak di peta, dan kapasitas.', en: 'Lines from the need to local SME cards light up; the shortlist shows badges, map distance and capacity.' },
    },
    {
      title: { id: 'Pesanan di dua sisi', en: 'Orders on both sides' },
      body: { id: 'Pemda memilih dan memesan; satu klik berpindah ke Sisi UMKM yang menerima pesanan dan mengonfirmasi kapasitas.', en: 'The government picks and orders; one click flips to the SME side, which receives the order and confirms capacity.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Tiga UMKM lokal yang cocok', en: 'Three matching local SMEs' },
      body: { id: 'Shortlist berlencana Terverifikasi, Pajak Rapi, dan Skor Usaha dari produk lain.', en: 'A shortlist badged Verified, Tidy Tax and Business Score from other products.' },
      frame: 'cocok',
    },
    {
      title: { id: 'Satu klik berpindah sisi', en: 'One click to switch sides' },
      body: { id: 'Kartu berbalik antara Sisi Pemda dan Sisi UMKM, jadi kedua pihak terlihat dalam satu demo.', en: 'The card flips between the Government side and the SME side, so both parties show in one demo.' },
      frame: 'konfirmasi',
    },
  ],
  roles: {
    ukpbj: { id: 'Menemukan UMKM lokal yang terverifikasi dalam hitungan detik untuk kebutuhan mendesak.', en: 'Finds verified local SMEs in seconds for urgent needs.' },
    'pemilik-toko': { id: 'Menerima pesanan pemda dan mengonfirmasi kapasitas dari etalase sendiri.', en: 'Receives government orders and confirms capacity from its own storefront.' },
  },
  relations: {
    'kenal-mitra': { id: 'Lencana Terverifikasi berasal dari KYB.', en: 'The Verified badge comes from KYB.' },
    'pajak-beres': { id: 'Lencana Pajak Rapi berasal dari pembukuan yang lengkap.', en: 'The Tidy Tax badge comes from complete books.' },
    'rapor-usaha': { id: 'Skor Usaha tampil di kartu UMKM.', en: 'The Business Score shows on the SME card.' },
    tenderpilot: { id: 'Kebutuhan pemda menjadi peluang bagi vendor.', en: 'Government needs become opportunities for vendors.' },
    'awas-belanja': { id: 'Harga UMKM lokal menjadi pembanding pengadaan.', en: 'Local SME prices become the procurement benchmark.' },
  },
  dataNote: {
    id: 'Kecamatan dan jarak memakai peta {region} yang sebenarnya. UMKM, produk, kapasitas, dan pesanan adalah fiktif dan simulasi.',
    en: 'Districts and distances use the real map of {region}. SMEs, products, capacity and orders are fictional and simulated.',
  },
  faq: [
    {
      q: { id: 'Apakah Katalog Lokal menggantikan sistem pengadaan resmi?', en: 'Does Katalog Lokal replace the official procurement system?' },
      a: { id: 'Tidak. Ia membantu menemukan dan menilai UMKM lokal. Kaitannya dengan proses pengadaan Anda dibahas saat konsultasi.', en: 'No. It helps find and assess local SMEs. How it ties into your procurement process is discussed during consultation.' },
    },
    {
      q: { id: 'Bagaimana UMKM masuk ke katalog?', en: 'How do SMEs get into the catalogue?' },
      a: { id: 'Lewat verifikasi Kenal Mitra; setelah lolos, lencananya tampil di etalase.', en: 'Through Kenal Mitra verification; once passed, the badge shows in the storefront.' },
    },
    {
      q: { id: 'Apakah pembayarannya sungguhan?', en: 'Are the payments real?' },
      a: { id: 'Tidak. Pesanan dan pembayaran di demo disimulasikan.', en: 'No. Orders and payments in the demo are simulated.' },
    },
    {
      q: { id: 'Bisakah dicoba dari sisi UMKM?', en: 'Can I try the SME side?' },
      a: { id: 'Bisa. Tekan tombol sisi di demo untuk berpindah ke Sisi UMKM.', en: 'Yes. Press the side toggle in the demo to switch to the SME side.' },
    },
  ],
  miniCaption: [
    { id: 'Kebutuhan pemda ditulis', en: 'The government writes its need' },
    { id: 'Dicocokkan ke UMKM lokal', en: 'Matched to local SMEs' },
    { id: 'Tiga UMKM berlencana', en: 'Three badged SMEs' },
    { id: 'Pesanan dibuat', en: 'The order is placed' },
  ],
}
