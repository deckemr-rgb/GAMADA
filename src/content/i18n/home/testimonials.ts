/**
 * Home section copy: testimonials (ID). The English copy lives in ./testimonials.en.ts
 * (a separate module so the EN dictionary can load lazily, spec §14) and must have exactly this shape.
 * Every quote is an ILLUSTRATION (no real client, no names): role-based attributions only.
 */
const id = {
  eyebrow: 'Gambaran pengalaman',
  title: 'Seperti apa rasanya bekerja bareng kami.',
  lead: 'Tiga cerita di bawah ini adalah ilustrasi yang kami tulis untuk menggambarkan hasil yang kami kejar. Semuanya bukan ulasan klien asli.',
  label: 'Ilustrasi, bukan ulasan klien asli',
  carouselLabel: 'Ilustrasi testimoni',
  slideOf: (n: number, total: number) => `${n} dari ${total}`,
  prev: 'Testimoni sebelumnya',
  next: 'Testimoni berikutnya',
  goTo: (n: number) => `Tampilkan testimoni ${n}`,
  pause: 'Jeda putar otomatis',
  play: 'Lanjutkan putar otomatis',
  hint: 'Geser, atau pakai tombol panah',
  status: (n: number, total: number, who: string) => `Testimoni ${n} dari ${total}: ${who}`,
  items: [
    {
      icon: 'cup',
      service: 'POS & Sistem Bisnis',
      quote:
        'Dulu stok biji kopi dicatat di buku dan hampir tiap minggu selisih. Sekarang kasir dan stok saling nyambung, jadi laporan harian tinggal saya buka dari HP sebelum tutup kedai.',
      role: 'Pemilik kedai kopi',
      place: 'Yogyakarta',
    },
    {
      icon: 'bag',
      service: 'Website & Otomasi',
      quote:
        'Pesanan yang masuk lewat chat dulu saya salin satu per satu ke spreadsheet. Sekarang semuanya terkumpul di satu dasbor, dan pelanggan dapat konfirmasi otomatis. Malam saya jadi jauh lebih tenang.',
      role: 'Pengelola toko daring',
      place: 'Surabaya',
    },
    {
      icon: 'phone',
      service: 'Aplikasi Mobile',
      quote:
        'Anggota tidak perlu antre di kantor cuma untuk tanya sisa angsuran. Mereka cek sendiri di aplikasi, dan pengurus bisa fokus melayani hal yang memang perlu tatap muka.',
      role: 'Pengurus koperasi simpan pinjam',
      place: 'Makassar',
    },
  ],
}

export const testimonials = id
