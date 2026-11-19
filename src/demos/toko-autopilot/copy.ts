/** toko-autopilot — /produk/toko-autopilot page copy (Tahap 6 plan §3.1). Sources: spec §11 P8, products.ts, docs/products/kasirku.md (#kasir). */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Setiap transaksi di kasir menggerakkan stok, prediksi permintaan, dan PO ke supplier, dan prediksinya ikut membaca kejadian di daerah.',
    en: 'Every sale at the till moves stock, the demand forecast and supplier POs, and the forecast also reads what happens in the region.',
  },
  problems: [
    {
      title: { id: 'Stok habis di saat ramai', en: 'Out of stock when it gets busy' },
      body: { id: 'Saat banjir, permintaan terpal dan karung pasir naik mendadak, dan toko baru sadar ketika rak sudah kosong.', en: 'During a flood, demand for tarpaulins and sandbags jumps, and the shop notices when the shelf is already empty.' },
    },
    {
      title: { id: 'PO lewat telepon dan catatan', en: 'Orders by phone and notebook' },
      body: { id: 'Pemilik menghitung kebutuhan sendiri, lalu menelepon supplier satu per satu.', en: 'The owner works out what to order, then calls suppliers one by one.' },
    },
    {
      title: { id: 'Kasir, stok, dan laporan terpisah', en: 'Till, stock and reports apart' },
      body: { id: 'Data penjualan direkap manual sebelum bisa dibaca sebagai margin atau perbandingan outlet.', en: 'Sales data is tallied by hand before it can be read as margin or an outlet comparison.' },
    },
  ],
  steps: [
    {
      title: { id: 'Kasir mencatat transaksi', en: 'The till records the sale' },
      body: { id: 'Grid produk, scan barcode, diskon, dan QRIS simulasi. Stok dan dasbor langsung berubah.', en: 'Product grid, barcode scan, discounts and simulated QRIS. Stock and the dashboard update at once.' },
    },
    {
      title: { id: 'Prediksi stok membaca daerah', en: 'The stock forecast reads the region' },
      body: { id: 'Prediksi 14 hari memperhitungkan musim, hari gajian, promo, dan peringatan banjir dari Siaga Wilayah.', en: 'The 14-day forecast weighs season, payday, promos and flood warnings from Siaga Wilayah.' },
    },
    {
      title: { id: 'PO otomatis ke supplier', en: 'Automatic POs to suppliers' },
      body: { id: 'Draf PO dikelompokkan per supplier. Setelah disetujui, pesan terkirim dan balasan supplier masuk ke status PO.', en: 'Draft POs are grouped per supplier. Once approved, the message goes out and the supplier reply updates the PO status.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Prediksi yang bereaksi', en: 'A forecast that reacts' },
      body: { id: 'Begitu peringatan banjir keluar, prediksi terpal dan karung pasir naik, dan alasannya tertulis.', en: 'As soon as the flood warning is issued, the tarpaulin and sandbag forecast rises, with the reason written down.' },
      frame: 'banjir',
    },
    {
      title: { id: 'PO yang dibalas supplier', en: 'POs that suppliers answer' },
      body: { id: '"Siap, kirim besok pagi": balasan supplier mengubah status PO tanpa telepon.', en: '"Ready, delivering tomorrow morning": the supplier reply updates the PO with no phone call.' },
      frame: 'po',
    },
    {
      title: { id: 'Jadwal shift otomatis', en: 'Automatic shift schedules' },
      body: { id: 'Kalender minggu disusun dari pola keramaian per jam, dan tetap bisa digeser manual.', en: 'The weekly calendar is built from hourly crowd patterns, and can still be adjusted by hand.' },
    },
  ],
  roles: {
    'pemilik-toko': { id: 'Melihat stok, margin, dan PO semua outlet dari satu dasbor.', en: 'Sees stock, margin and POs for every outlet from one dashboard.' },
    kasir: { id: 'Melayani lebih cepat dengan scan, QRIS, dan tutup shift yang rapi.', en: 'Serves faster with scanning, QRIS and a tidy shift close.' },
    supplier: { id: 'Menerima PO yang jelas dan membalasnya dari chat.', en: 'Receives clear POs and answers them from chat.' },
  },
  relations: {
    'pajak-beres': { id: 'Penjualan kasir otomatis menjadi jurnal pembukuan.', en: 'Till sales become bookkeeping entries automatically.' },
    'rapor-usaha': { id: 'Omzet dan ketepatan bayar supplier menaikkan skor usaha.', en: 'Revenue and paying suppliers on time raise the business score.' },
    'sinyal-pasar': { id: 'Peringatan harga membantu menentukan harga jual dan stok.', en: 'Price alerts help set selling prices and stock.' },
    'katalog-lokal': { id: 'Pesanan pemda masuk ke toko sebagai permintaan baru.', en: 'Government orders reach the shop as new demand.' },
    'juara-jualan': { id: 'Chat penjualan dan PO ikut dinilai untuk coaching.', en: 'Sales chats and POs are scored for coaching.' },
    'siaga-wilayah': { id: 'Peringatan banjir menggerakkan prediksi stok.', en: 'Flood warnings move the stock forecast.' },
  },
  dataNote: {
    id: 'Nama pasar mengikuti {region}. Toko, SKU, transaksi, supplier, dan semua angka penjualan adalah simulasi.',
    en: 'Market names follow {region}. Shops, SKUs, sales, suppliers and every sales figure are simulated.',
  },
  faq: [
    {
      q: { id: 'Ke mana KasirKu?', en: 'Where did KasirKu go?' },
      a: { id: 'KasirKu kini menjadi modul Kasir di Toko Autopilot, tersambung ke stok, PO, dan pembukuan.', en: 'KasirKu is now the Checkout module of Toko Autopilot, connected to stock, POs and bookkeeping.' },
    },
    {
      q: { id: 'Apakah cocok untuk usaha makanan dan minuman?', en: 'Does it suit food and beverage businesses?' },
      a: { id: 'Demo memuat toko bangunan dan dua outlet F&B yang bisa dipilih. Kebutuhan usaha Anda dibahas saat konsultasi.', en: 'The demo has a hardware store and two F&B outlets to switch between. Your needs are discussed during consultation.' },
    },
    {
      q: { id: 'Apakah pembayaran QRIS-nya sungguhan?', en: 'Is the QRIS payment real?' },
      a: { id: 'Tidak. QR di demo adalah contoh dan pembayarannya disimulasikan.', en: 'No. The QR in the demo is a sample and the payment is simulated.' },
    },
    {
      q: { id: 'Bisakah supplier membalas lewat WhatsApp?', en: 'Can suppliers reply over WhatsApp?' },
      a: { id: 'Di demo, chat supplier adalah simulasi. Kanal untuk pemasangan dibahas saat konsultasi.', en: 'In the demo the supplier chat is simulated. Channels for an installation are discussed during consultation.' },
    },
  ],
  miniCaption: [
    { id: 'Kasir memindai barang', en: 'The cashier scans an item' },
    { id: 'Stok turun di dasbor', en: 'Stock drops on the dashboard' },
    { id: 'Draf PO ke supplier', en: 'A draft PO to the supplier' },
    { id: 'Supplier membalas', en: 'The supplier replies' },
  ],
}
