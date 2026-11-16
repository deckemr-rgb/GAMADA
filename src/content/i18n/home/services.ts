/**
 * Home: "Layanan & Produk" (#layanan). Four service cards; the demo counts are computed from
 * content/work.ts and passed to the `count` formatters, so the copy never hard-codes a number.
 */
type ServiceKey = 'web' | 'apk' | 'ml' | 'pos'

interface ServiceCopy {
  key: ServiceKey
  title: string
  desc: string
  bullets: [string, string, string]
  count: (n: number) => string
  cta: string
}

const id = {
  eyebrow: 'Layanan & Produk',
  title: 'Empat hal yang kami kerjakan setiap hari.',
  lead: 'Dari situs pertama sampai sistem yang menyambungkan kasir, stok, dan laporan. Setiap layanan punya contoh yang bisa Anda coba langsung di browser sebelum kita bicara anggaran.',
  includedLabel: 'Sudah termasuk',
  items: [
    {
      key: 'web',
      title: 'Website & Web App',
      desc: 'Profil usaha, toko online, sampai dasbor internal. Tetap ringan di sinyal pas-pasan.',
      bullets: ['Desain responsif & SEO dasar', 'Panel admin untuk ubah konten', 'Tombol WhatsApp & pembayaran'],
      count: (n: number) => `${n} demo`,
      cta: 'Lihat demo web',
    },
    {
      key: 'apk',
      title: 'Aplikasi Mobile',
      desc: 'Aplikasi Android dan iOS untuk pelanggan atau tim lapangan Anda.',
      bullets: ['Android & iOS dari satu kode', 'Notifikasi & mode offline', 'Dibantu sampai rilis di toko aplikasi'],
      count: (n: number) => `${n} demo`,
      cta: 'Coba demo aplikasi',
    },
    {
      key: 'ml',
      title: 'Machine Learning & AI',
      desc: 'Otomasi kerja berulang dan model yang belajar dari data usaha Anda sendiri.',
      bullets: ['Scraping & pengolahan data', 'Bot & otomasi alur kerja', 'Dasbor untuk memantau hasil'],
      count: (n: number) => `${n} proyek asli`,
      cta: 'Lihat proyek asli',
    },
    {
      key: 'pos',
      title: 'POS & Sistem Bisnis',
      desc: 'Kasir, stok, dan laporan dalam satu sistem. Siap pakai, atau dirakit sesuai cara kerja Anda.',
      bullets: ['Kasir dengan QRIS & struk', 'Stok & laporan harian otomatis', 'Hak akses per karyawan'],
      count: (n: number) => `${n} demo POS + sistem custom`,
      cta: 'Coba demo kasir',
    },
  ] as ServiceCopy[],
  ctaTitle: 'Belum yakin harus mulai dari mana?',
  ctaText: 'Ceritakan masalahnya. Kami bantu memilih langkah yang paling masuk akal untuk skala usaha Anda.',
  ctaButton: 'Konsultasi via WhatsApp',
  waText: 'Halo GAMADA, saya ingin konsultasi soal layanan yang cocok untuk usaha saya.',
}

const en: typeof id = {
  eyebrow: 'Services & Products',
  title: 'Four things we build every day.',
  lead: 'From a first website to a system that ties your till, stock and reports together. Every service comes with a working example you can try in your browser before we talk budget.',
  includedLabel: 'What you get',
  items: [
    {
      key: 'web',
      title: 'Websites & Web Apps',
      desc: 'Company profiles, online shops and internal dashboards. Still fast on a patchy connection.',
      bullets: ['Responsive design & basic SEO', 'Admin panel to edit your content', 'WhatsApp & payment buttons'],
      count: (n: number) => `${n} demos`,
      cta: 'See the web demos',
    },
    {
      key: 'apk',
      title: 'Mobile Apps',
      desc: 'Android and iOS apps for your customers or your field team.',
      bullets: ['Android & iOS from one codebase', 'Push notifications & offline mode', 'Help all the way to store release'],
      count: (n: number) => `${n} demos`,
      cta: 'Try the app demos',
    },
    {
      key: 'ml',
      title: 'Machine Learning & AI',
      desc: 'Automate repetitive work and train models on the data your business already has.',
      bullets: ['Data scraping & processing', 'Bots & workflow automation', 'Dashboards to monitor results'],
      count: (n: number) => `${n} real projects`,
      cta: 'See the real projects',
    },
    {
      key: 'pos',
      title: 'POS & Business Systems',
      desc: 'Checkout, stock and reports in one system. Ready to use, or built around how you work.',
      bullets: ['Checkout with QRIS & receipts', 'Automatic stock & daily reports', 'Per-employee access rights'],
      count: (n: number) => `${n} POS demo + custom systems`,
      cta: 'Try the POS demo',
    },
  ],
  ctaTitle: 'Not sure where to start?',
  ctaText: 'Tell us what is slowing you down. We will help you pick the step that makes sense for the size of your business.',
  ctaButton: 'Chat with us on WhatsApp',
  waText: 'Hi GAMADA, I would like some advice on which service fits my business.',
}

export const services = { id, en }
