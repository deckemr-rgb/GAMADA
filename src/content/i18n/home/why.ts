/**
 * Home: "Kenapa GAMADA" (#fondasi). Six principles in a bento grid + the second stat strip
 * (values come from content/site.ts → SITE.stats).
 */
type WhyKey = 'ecosystem' | 'security' | 'ops' | 'insight' | 'scale' | 'local'

interface WhyFeature {
  key: WhyKey
  title: string
  text: string
}

const id = {
  eyebrow: 'Kenapa GAMADA',
  title: 'Fondasi yang membuat sistem Anda tetap jalan.',
  lead: 'Tampilan bagus itu awalnya saja. Ini enam prinsip yang kami pegang di setiap proyek, dari demo kecil sampai sistem yang dipakai setiap hari.',
  features: [
    {
      key: 'ecosystem',
      title: 'Ekosistem yang terhubung',
      text: 'Website, aplikasi, kasir, dan laporan saling terhubung. Data cukup dimasukkan sekali, lalu muncul di tempat yang membutuhkannya.',
    },
    {
      key: 'security',
      title: 'Keamanan & kepatuhan',
      text: 'Akses berbasis peran, enkripsi, dan cadangan rutin. Data pelanggan ditangani dengan memperhatikan UU Pelindungan Data Pribadi.',
    },
    {
      key: 'ops',
      title: 'Operasional lebih ringan',
      text: 'Pekerjaan manual yang berulang dipindah ke sistem, supaya tim bisa fokus melayani pelanggan.',
    },
    {
      key: 'insight',
      title: 'Keputusan dari data',
      text: 'Dasbor yang menjawab pertanyaan nyata: produk mana yang laku, kapan ramai, stok mana yang menipis.',
    },
    {
      key: 'scale',
      title: 'Siap tumbuh bersama usaha',
      text: 'Mulai dari satu outlet, lalu tambah cabang, pengguna, dan fitur tanpa harus membangun ulang dari nol.',
    },
    {
      key: 'local',
      title: 'Dekat & berbasis lokal',
      text: 'Tim di Indonesia, dukungan lewat WhatsApp dalam bahasa sehari-hari, dan pembayaran lokal seperti QRIS sejak hari pertama.',
    },
  ] as WhyFeature[],
  ecoNodes: ['Web', 'Aplikasi', 'Kasir', 'Laporan'] as [string, string, string, string],
  ecoCenter: 'Data',
  localChips: ['Tim Indonesia', 'Dukungan WhatsApp', 'QRIS & transfer bank', 'WIB · WITA · WIT'],
  statsTitle: 'Bukti yang bisa dicoba, bukan sekadar janji.',
  webDemos: 'Demo website',
  mobileApps: 'Demo aplikasi',
  caseStudies: 'Studi kasus proyek asli',
  responseHours: 'Waktu balas maksimal',
  hoursSuffix: ' jam',
}

export const why = id
