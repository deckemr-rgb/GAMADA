/** Home section copy: portfolio (ID + EN). `en` must have exactly the shape of `id`. */
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

const en: typeof id = {
  eyebrow: 'Featured work',
  title: 'Selected work you can open and test yourself.',
  lead: 'Two real GAMADA projects and a set of mobile app demos. You can browse all {n} pieces on the Work page.',
  tags: {
    real: 'Real project',
    automation: 'Automation',
    live: 'Live demo',
    ai: 'AI',
    mobile: 'Mobile',
  },
  phonefarm: {
    title: 'PhoneFarm',
    desc: 'One panel that runs many Android phones at once: task queue, device status and logs on a single screen.',
    cta: 'View demo',
  },
  automation: {
    title: 'Automation System',
    desc: 'Work that used to be retyped every day now runs on its own. AI reads the incoming data and the system handles the rest.',
    cta: 'View case study',
  },
  mobile: {
    title: '{n} Mobile App Demos',
    desc: 'App concepts, from street snacks to fitness, that you can try right in the browser without installing anything.',
    cta: 'View demo',
  },
  all: 'See all work',
}

export const portfolio = { id, en }
