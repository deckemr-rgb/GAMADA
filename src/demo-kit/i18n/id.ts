/**
 * demo-kit/i18n/id.ts — shared demo strings (DemoShell + anything every sandbox repeats). Indonesian is the
 * reference dictionary: en.ts must have the same shape (checked by the `DemoDict` type).
 */
export const id = {
  /* top bar */
  ecosystem: 'Ekosistem',
  breadcrumb: 'Jejak navigasi',
  demoMode: 'Mode Demo',
  demoModeHint: 'Semua data di sandbox ini simulasi. Orang, usaha, dan transaksi fiktif.',
  backToProduct: 'Kembali ke produk',
  topBar: 'Kontrol demo',
  more: 'Kontrol lainnya',
  moreTitle: 'Kontrol demo',
  /* region */
  region: 'Wilayah',
  regionPick: 'Pilih wilayah',
  regionOnly: (name: string) => `Wilayah demo: ${name}`,
  /* role */
  role: 'Peran',
  rolePick: 'Ganti peran',
  roleAs: (r: string) => `Masuk sebagai ${r}`,
  roleHint: 'Satu akun, banyak peran (Inti ID)',
  roleChanged: (r: string) => `Peran diganti ke ${r}`,
  /* clock */
  clock: 'Jam dunia',
  clockNow: (t: string) => `Jam dunia ${t} WIB`,
  play: 'Jalankan jam',
  pause: 'Jeda jam',
  speed: 'Kecepatan jam',
  speedX: (n: number) => `×${n}`,
  speedLabel: (n: number) => `${n}× lebih cepat`,
  jump: 'Lompat ke…',
  jumpTo: (t: string) => `Lompat ke ${t}`,
  /* ai */
  aiMode: 'Mode AI',
  aiSim: 'Simulasi',
  aiLive: 'Live',
  aiLiveOff: 'AI Live belum tersedia: server AI tidak aktif. Demo tetap berjalan penuh dengan Simulasi.',
  aiLiveChecking: 'Memeriksa server AI…',
  aiLiveOn: 'AI Live aktif',
  /* language */
  language: 'Bahasa',
  langName: { id: 'Bahasa Indonesia', en: 'English' },
  /* reset */
  reset: 'Reset',
  resetTitle: 'Reset dunia demo?',
  resetBody: 'Semua aduan, transaksi, dan perubahan yang Anda buat di browser ini dihapus. Dunia kembali ke kondisi awal, jam kembali ke 07.00.',
  resetConfirm: 'Ya, reset',
  cancel: 'Batal',
  rewinding: 'Memutar balik jam…',
  resetDone: 'Dunia demo kembali ke awal',
  /* fullscreen */
  fullscreen: 'Layar penuh',
  exitFullscreen: 'Keluar layar penuh',
  /* guide */
  guide: 'Panduan',
  guideOpen: 'Buka panduan "Coba ini"',
  guideClose: 'Tutup panduan',
  tryThis: 'Coba ini',
  guideIntro: 'Langkah tercentang sendiri saat Anda melakukannya.',
  progress: (a: number, b: number) => `${a} dari ${b} selesai`,
  missionDone: 'Selesai',
  missionTodo: 'Belum',
  missionNext: 'Berikutnya',
  allDone: 'Semua misi selesai',
  allDoneBody: 'Anda sudah melihat inti produk ini. Lihat bagaimana datanya mengalir ke produk lain.',
  nextProduct: 'Lanjut ke produk terkait',
  restartMissions: 'Ulangi misi',
  missionTicked: (m: string) => `Misi selesai: ${m}`,
  /* toasts */
  toasts: 'Kejadian lintas produk',
  forwardedTo: (what: string, product: string) => `${what} diteruskan ke ${product}`,
  openIn: (product: string) => `Buka di ${product}`,
  eventFrom: (product: string) => `Kejadian dari ${product}`,
  rootLabel: {
    complaint: (code: string) => `Aduan #${code}`,
    cluster: 'Klaster aduan',
    flood: 'Peringatan banjir',
    price: 'Anomali harga',
    instruction: 'Instruksi pimpinan',
    sale: (code: string) => `Transaksi ${code}`,
    hoax: 'Temuan hoaks',
    procurement: 'Paket pengadaan',
    need: 'Kebutuhan pemda',
    score: 'Skor usaha',
    meeting: 'Notulen rapat',
  },
  /* command palette */
  palette: 'Palet perintah',
  paletteTitle: 'Lompat ke…',
  paletteHint: 'Ketik nama produk, peran, jam, atau wilayah',
  palettePlaceholder: 'Cari produk, peran, jam…',
  paletteEmpty: 'Tidak ada yang cocok.',
  paletteResults: (n: number) => `${n} hasil`,
  groupProducts: 'Produk',
  groupRoles: 'Peran',
  groupTimes: 'Jam dunia',
  groupRegions: 'Wilayah',
  groupActions: 'Tindakan',
  openDemo: 'Buka demo',
  current: 'saat ini',
  actGuide: 'Tampilkan/sembunyikan panduan',
  actLang: 'Ganti bahasa ke English',
  actReset: 'Reset dunia demo',
  actFullscreen: 'Layar penuh',
  actPlay: 'Jalankan/jeda jam',
  kbdOpen: 'Ctrl K',
  /* split stage */
  splitPhone: 'HP Warga',
  splitConsole: 'Konsol Petugas',
  splitViews: 'Tampilan',
  /* boot */
  loading: 'Menyiapkan dunia demo…',
  loadError: 'Dunia demo gagal dimuat.',
  retry: 'Coba lagi',
  /* hotspot / coach */
  hotspotHint: 'Mulai dari sini',
  coachNext: 'Lanjut',
  coachDone: 'Mengerti',
  coachClose: 'Tutup tip',
  coachStep: (a: number, b: number) => `${a}/${b}`,
  /* presenter */
  presenter: 'Mode presenter',
  /* regional language helper */
  regionalLanguage: 'Bahasa daerah',
}

type Widen<T> = T extends string ? string : T extends (...a: infer A) => infer R ? (...a: A) => Widen<R> : T extends object ? { [K in keyof T]: Widen<T[K]> } : T
export type DemoDict = Widen<typeof id>
