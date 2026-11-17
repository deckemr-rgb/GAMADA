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

export const services = id
