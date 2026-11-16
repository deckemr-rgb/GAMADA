/** Home section copy: about (ID + EN). `en` must have exactly the shape of `id`. */
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

const en: typeof id = {
  eyebrow: 'GAMADA at a glance',
  title: 'We build digital tools that people actually use.',
  lead: 'GAMADA is a software and automation studio for Indonesian businesses. We design point-of-sale systems, dashboards, mobile apps and small robots that take over repetitive work, so your team has time for the work that actually pays.',
  body: 'The way we work is simple. We listen to the problem first, then put a clickable prototype in front of you as early as we can. From there the system grows step by step, and you always know where things stand.',
  facts: [
    { title: 'Try it before you decide', text: 'The demos on this site run right in your browser. They are not just pictures.' },
    { title: 'Made for local business', text: 'Indonesian, rupiah and WhatsApp flows are part of the plan from day one.' },
    { title: 'Replies within {h} hours', text: 'Tell us what you need on WhatsApp and we will help you map out the first step.' },
  ],
  figureLabel: 'Illustration of three interfaces: a POS dashboard, a 20-device panel and an automation queue.',
  caption: 'Interface illustrations, not real data.',
  mock: {
    pos: {
      url: 'pos-dashboard · illustration',
      title: "Today's summary",
      today: 'Today',
      kpis: [
        { label: 'Orders', value: '128' },
        { label: 'Revenue', value: 'Rp 4.2M' },
        { label: 'Out of stock', value: '3' },
      ],
      chart: 'Sales, last 7 days',
      days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    },
    farm: {
      url: 'device-panel · illustration',
      title: 'Devices',
      online: 'online',
      busy: 'busy',
      idle: 'idle',
    },
    queue: {
      url: 'automation-queue · illustration',
      title: 'Task queue',
      jobs: [
        { name: 'Sync warehouse stock', status: 'Done' },
        { name: 'Pull marketplace orders', status: 'Running' },
        { name: 'Send daily report', status: 'Queued' },
        { name: 'Reply to customer chats', status: 'Queued' },
      ],
    },
  },
}

export const about = { id, en }
