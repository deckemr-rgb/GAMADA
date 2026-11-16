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

const en: typeof id = {
  eyebrow: 'Why GAMADA',
  title: 'The groundwork that keeps your systems running.',
  lead: 'A good-looking screen is only the start. These are the six principles we hold to on every project, from a small demo to a system people use every day.',
  features: [
    {
      key: 'ecosystem',
      title: 'One connected ecosystem',
      text: 'Your website, app, till and reports talk to each other. Enter data once and it shows up wherever it is needed.',
    },
    {
      key: 'security',
      title: 'Security & compliance',
      text: 'Role-based access, encryption and regular backups. Customer data is handled with Indonesia’s Personal Data Protection Law in mind.',
    },
    {
      key: 'ops',
      title: 'Lighter day-to-day work',
      text: 'Repetitive manual tasks move into the system, so your team can focus on serving customers.',
    },
    {
      key: 'insight',
      title: 'Decisions backed by data',
      text: 'Dashboards that answer real questions: what sells, when it gets busy, which stock is running low.',
    },
    {
      key: 'scale',
      title: 'Built to grow with you',
      text: 'Start with one outlet, then add branches, users and features without rebuilding from scratch.',
    },
    {
      key: 'local',
      title: 'Close by & locally rooted',
      text: 'A team based in Indonesia, support over WhatsApp in plain language, and local payments like QRIS from day one.',
    },
  ],
  ecoNodes: ['Web', 'App', 'POS', 'Reports'],
  ecoCenter: 'Data',
  localChips: ['Indonesian team', 'WhatsApp support', 'QRIS & bank transfer', 'WIB · WITA · WIT'],
  statsTitle: 'Proof you can try, not just promises.',
  webDemos: 'Website demos',
  mobileApps: 'App demos',
  caseStudies: 'Real-project case studies',
  responseHours: 'Maximum reply time',
  hoursSuffix: ' h',
}

export const why = { id, en }
