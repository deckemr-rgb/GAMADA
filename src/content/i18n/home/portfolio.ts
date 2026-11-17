/** Home section copy: portfolio (ID). The English copy lives in ./portfolio.en.ts
 * (a separate module so the EN dictionary can load lazily, spec §14) and must have exactly this shape. */
const id = {
  eyebrow: 'Portofolio unggulan',
  title: 'Karya pilihan yang bisa Anda buka dan uji sendiri.',
  lead: 'Dua proyek asli GAMADA dan satu paket demo aplikasi mobile. Seluruh {n} karya kami bisa Anda jelajahi di halaman Karya.',
  tags: {
    real: 'Proyek Asli',
    automation: 'Otomasi',
    live: 'Live Demo',
    ai: 'AI',
    mobile: 'Mobile',
  },
  phonefarm: {
    title: 'PhoneFarm',
    desc: 'Satu panel untuk menjalankan banyak ponsel Android sekaligus: antrean tugas, status perangkat, dan log dalam satu layar.',
    cta: 'Lihat demo',
  },
  automation: {
    title: 'Sistem Automasi',
    desc: 'Pekerjaan yang dulu diketik ulang setiap hari kini jalan sendiri. AI membaca data yang masuk, sistem mengerjakan sisanya.',
    cta: 'Lihat studi kasus',
  },
  mobile: {
    title: '{n} Demo Aplikasi Mobile',
    desc: 'Konsep aplikasi dari jajanan sampai kebugaran yang bisa langsung dicoba di browser, tanpa perlu memasang apa pun.',
    cta: 'Lihat demo',
  },
  all: 'Lihat semua karya',
}

export const portfolio = id
