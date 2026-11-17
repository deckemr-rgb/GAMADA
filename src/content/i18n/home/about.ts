/** Home section copy: about (ID). The English copy lives in ./about.en.ts
 * (a separate module so the EN dictionary can load lazily, spec §14) and must have exactly this shape. */
const id = {
  eyebrow: 'Sekilas tentang GAMADA',
  title: 'Kami membangun alat kerja digital yang benar-benar dipakai.',
  lead: 'GAMADA adalah studio software dan otomasi untuk usaha di Indonesia. Kami merancang sistem kasir, dasbor, aplikasi mobile, sampai robot kecil yang mengerjakan tugas berulang, supaya tim Anda punya waktu untuk pekerjaan yang benar-benar menghasilkan.',
  body: 'Cara kerja kami sederhana. Kami dengarkan dulu masalahnya, lalu tunjukkan prototipe yang bisa diklik secepat mungkin. Setelah itu sistemnya dibangun bertahap, dan Anda selalu tahu sampai mana pekerjaannya.',
  facts: [
    { title: 'Coba dulu, baru putuskan', text: 'Demo di situs ini berjalan langsung di browser Anda, bukan sekadar gambar.' },
    { title: 'Dibuat untuk usaha lokal', text: 'Bahasa Indonesia, Rupiah, dan alur WhatsApp sudah dipikirkan sejak awal.' },
    { title: 'Respons maksimal {h} jam', text: 'Ceritakan kebutuhan Anda lewat WhatsApp, lalu kami bantu memetakan langkah pertamanya.' },
  ],
  figureLabel: 'Ilustrasi tiga antarmuka: dasbor kasir, panel 20 perangkat, dan antrean otomasi.',
  caption: 'Ilustrasi antarmuka, bukan data asli.',
  mock: {
    pos: {
      url: 'dasbor-kasir · ilustrasi',
      title: 'Ringkasan hari ini',
      today: 'Hari ini',
      kpis: [
        { label: 'Transaksi', value: '128' },
        { label: 'Omzet', value: 'Rp 4,2 jt' },
        { label: 'Produk habis', value: '3' },
      ],
      chart: 'Penjualan 7 hari',
      days: ['S', 'S', 'R', 'K', 'J', 'S', 'M'],
    },
    farm: {
      url: 'panel-perangkat · ilustrasi',
      title: 'Perangkat',
      online: 'online',
      busy: 'sibuk',
      idle: 'diam',
    },
    queue: {
      url: 'antrean-otomasi · ilustrasi',
      title: 'Antrean tugas',
      jobs: [
        { name: 'Sinkron stok gudang', status: 'Selesai' },
        { name: 'Tarik pesanan marketplace', status: 'Berjalan' },
        { name: 'Kirim laporan harian', status: 'Antre' },
        { name: 'Balas chat pelanggan', status: 'Antre' },
      ],
    },
  },
}

export const about = id
