/**
 * Home: "Layanan & Produk" (#layanan). Three ecosystem cards (names, audience, counts and example products come
 * from content/ecoNav.ts, so the copy never retypes a product name or a number), a slim GAMADA Inti line, the
 * custom-work sentence and the WhatsApp strip. `{n}` / `{name}` are filled by the section.
 */
type CardEco = 'satu-daerah' | 'usaha-pintar' | 'pasar-daerah'

const id = {
  eyebrow: 'Layanan & Produk',
  title: 'Tiga ekosistem, satu fondasi.',
  lead: 'Produk yang saling terhubung untuk pemda, bisnis, dan jembatan di antara keduanya. Setiap produk punya demo interaktif di browser.',
  pitch: {
    'satu-daerah': 'Aduan warga, arahan pimpinan, dan peringatan dini bergerak dalam satu alur, dari kecamatan sampai meja kepala daerah.',
    'usaha-pintar': 'Kasir, pembukuan, tim penjualan, dan reputasi berjalan sendiri, lalu ikut membaca kejadian di daerah.',
    'pasar-daerah': 'Belanja pemda mengalir ke UMKM lokal yang terverifikasi, dan harga serta ekonomi daerah terbaca setiap hari.',
  } satisfies Record<CardEco, string>,
  count: '{n} produk',
  examples: 'Contoh produk',
  cta: 'Lihat ekosistem',
  inti: 'Semua produk berdiri di atas {name}: satu akun, satu data, satu jejak audit.',
  intiCta: 'Kenali {name}',
  custom: 'Juga: website & aplikasi custom untuk kebutuhan di luar ekosistem.',
  customCta: 'Lihat karya studio',
  ctaTitle: 'Belum yakin harus mulai dari mana?',
  ctaText: 'Ceritakan masalahnya. Kami bantu memilih langkah yang paling masuk akal untuk skala Anda.',
  ctaButton: 'Konsultasi via WhatsApp',
  waText: 'Halo GAMADA, saya ingin konsultasi soal produk ekosistem yang cocok untuk kami.',
}

export const services = id
