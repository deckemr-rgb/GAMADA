/**
 * Home section copy: testimonials (ID + EN). `en` must have exactly the shape of `id`.
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

const en: typeof id = {
  eyebrow: 'What it feels like',
  title: 'What working with us feels like.',
  lead: 'The three stories below are illustrations we wrote to show the outcomes we aim for. None of them is a real client review.',
  label: 'Illustration, not a real client review',
  carouselLabel: 'Illustrative testimonials',
  slideOf: (n: number, total: number) => `${n} of ${total}`,
  prev: 'Previous testimonial',
  next: 'Next testimonial',
  goTo: (n: number) => `Show testimonial ${n}`,
  pause: 'Pause autoplay',
  play: 'Resume autoplay',
  hint: 'Swipe, or use the arrow keys',
  status: (n: number, total: number, who: string) => `Testimonial ${n} of ${total}: ${who}`,
  items: [
    {
      icon: 'cup',
      service: 'POS & Business Systems',
      quote:
        'I used to log coffee bean stock in a notebook and it was off almost every week. Now the till and the stock talk to each other, so I check the daily report on my phone before closing up.',
      role: 'Coffee shop owner',
      place: 'Yogyakarta',
    },
    {
      icon: 'bag',
      service: 'Website & Automation',
      quote:
        'Orders that came in over chat used to be copied into a spreadsheet one by one. Now they all land in one dashboard and customers get an automatic confirmation. My evenings are a lot calmer.',
      role: 'Online store manager',
      place: 'Surabaya',
    },
    {
      icon: 'phone',
      service: 'Mobile App',
      quote:
        'Members no longer queue at the office just to ask what they still owe. They check it in the app, and the board can focus on the things that really need a face-to-face talk.',
      role: 'Savings & loan cooperative board member',
      place: 'Makassar',
    },
  ],
}

export const testimonials = { id, en }
