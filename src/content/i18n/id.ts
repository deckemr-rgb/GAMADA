/**
 * id.ts — Indonesian copy (source of truth for the dictionary shape; en.ts must match it).
 * Phase 1: global shell (nav, footer, WhatsApp, page shells). Later phases add their sections.
 */
import { scenes } from './home/scenes'
import { stats } from './home/stats'
import { about } from './home/about'
import { services } from './home/services'
import { portfolio } from './home/portfolio'
import { ecosystem } from './home/ecosystem'
import { security } from './home/security'
import { why } from './home/why'
import { testimonials } from './home/testimonials'
import { faqPreview } from './home/faqPreview'
import { contact } from './home/contact'

export const id = {
  langName: 'Bahasa Indonesia',
  meta: {
    siteTitle: 'GAMADA — Studio software & otomasi',
    description:
      'GAMADA membangun website, aplikasi mobile, machine learning, dan sistem bisnis untuk usaha di Indonesia. Demo interaktif, bisa dicoba langsung di browser.',
  },
  a11y: {
    skip: 'Lewati ke konten utama',
    home: 'GAMADA, ke beranda',
    mainNav: 'Navigasi utama',
    openMenu: 'Buka menu',
    closeMenu: 'Tutup menu',
    menu: 'Menu',
    language: 'Bahasa',
    readingProgress: 'Progres membaca',
    loading: 'Memuat halaman',
    sound: 'Suara',
    soundOn: '(menyala)',
    soundOff: '(mati)',
    sceneNav: 'Navigasi adegan',
    goToScene: 'Ke adegan',
    langFailed: 'Versi bahasa Inggris belum bisa dimuat. Periksa koneksi, lalu coba lagi.',
  },
  error: {
    title: 'Ups, halaman gagal dimuat.',
    body: 'Mungkin koneksi terputus atau situs baru saja diperbarui. Coba muat ulang halaman ini.',
    reload: 'Muat ulang',
    home: 'Ke beranda',
  },
  preloader: {
    caption: 'Studio software & otomasi',
    loading: 'Memuat GAMADA',
    skip: 'Klik untuk melewati',
  },
  nav: {
    services: 'Layanan & Produk',
    work: 'Karya',
    process: 'Proses',
    faq: 'FAQ',
    cta: 'Konsultasi Gratis',
    workMenu: [
      { hash: 'apk', title: '{n} Demo Aplikasi Mobile', desc: 'Coba langsung dalam bingkai ponsel' },
      { hash: 'web', title: '{n} Demo Web Live', desc: 'Podcast, kantin, kedai kopi, tiket, sewa kamera' },
      { hash: 'proyek', title: 'Proyek Asli ML & Otomasi', desc: 'PhoneFarm, Sistem Automasi' },
    ],
    workAll: 'Lihat semua karya',
    menuNote: 'Indonesia · remote friendly',
  },
  wa: {
    tooltip: 'Chat kami',
    label: 'Chat dengan GAMADA lewat WhatsApp (tab baru)',
    prefill: 'Halo GAMADA, saya mau konsultasi soal project saya.',
  },
  footer: {
    blurb:
      'Studio software & otomasi untuk bisnis Indonesia. Kami merancang, membangun, dan merawat produk digital: dari website sampai mesin otomasi, dengan proses yang tenang dan transparan.',
    servicesTitle: 'Layanan',
    services: [
      { label: 'Website & Web App', to: '/#layanan' },
      { label: 'Aplikasi Mobile', to: '/#layanan' },
      { label: 'Machine Learning & AI', to: '/#layanan' },
      { label: 'POS & Sistem Bisnis', to: '/#layanan' },
    ],
    portfolioTitle: 'Portofolio',
    allWork: 'Semua Karya',
    nowPartOf: 'kini bagian dari {name}',
    github: 'GitHub',
    contactTitle: 'Kontak',
    whatsapp: 'WhatsApp',
    location: 'Indonesia — remote friendly',
    rights: 'Seluruh hak cipta dilindungi.',
    ecosystem: 'Bagian dari ekosistem',
    sceneLabel: 'Ilustrasi malam: siluet bukit dan kunang-kunang',
  },
  home: {
    scenes,
    stats,
    about,
    services,
    portfolio,
    ecosystem,
    security,
    why,
    testimonials,
    faqPreview,
    contact,
  },
  pages: {
    building: 'Halaman ini sedang dibangun. Isinya menyusul di fase berikutnya.',
    backHome: 'Kembali ke beranda',
    karya: {
      title: 'Semua karya',
      eyebrow: 'Portofolio',
      lead: 'Demo web, aplikasi mobile, dan proyek asli GAMADA. Semuanya bisa dicoba langsung di browser.',
    },
    detail: {
      eyebrow: 'Karya',
      back: 'Kembali ke Karya',
      byline: 'Demo oleh GAMADA',
      caseByline: 'Studi kasus · proyek asli GAMADA',
    },
    proses: {
      title: 'Dari ide sampai live, tanpa drama',
      eyebrow: 'Proses',
      lead: 'Empat langkah kerja yang jelas: konsultasi, rancang, bangun, lalu launch dengan garansi.',
    },
    faq: {
      title: 'Pertanyaan yang sering ditanyakan',
      eyebrow: 'FAQ',
      lead: 'Biaya, durasi, keamanan data, dan apa yang terjadi setelah launching.',
    },
    phonefarm: {
      title: 'Panel PhoneFarm',
      eyebrow: 'Panel · Demo UI',
      lead: 'Dua puluh perangkat dalam satu panel kendali.',
    },
    notFound: {
      title: 'Jalurnya hilang di gelap',
      eyebrow: '404',
      lead: 'Halaman yang Anda cari tidak ada atau sudah dipindah. Ikuti kunang-kunang untuk pulang.',
      cta: 'Pulang ke beranda',
    },
  },
}

/** Widened copy of the Indonesian dictionary: every other language must provide the same keys. */
export type Dict = typeof id
