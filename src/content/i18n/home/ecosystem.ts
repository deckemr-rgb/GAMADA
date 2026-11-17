/** Home section copy: ecosystem (ID). The English copy lives in ./ecosystem.en.ts
 * (a separate module so the EN dictionary can load lazily, spec §14) and must have exactly this shape. */
const id = {
  eyebrow: 'Ekosistem terhubung',
  title: 'Satu panel untuk semua perangkat dan layanan.',
  lead: 'Website, aplikasi, bot otomasi, AI, dan server Anda tidak perlu berjalan sendiri-sendiri. Semuanya melapor ke satu dasbor, jadi cukup satu tempat untuk tahu apa yang sedang terjadi.',
  hint: 'Arahkan kursor, ketuk, atau tekan Tab pada tiap simpul untuk melihat perannya.',
  diagramLabel: 'Diagram ekosistem: Panel GAMADA di tengah, terhubung ke website, aplikasi, otomasi, AI, dan infrastruktur.',
  nodes: {
    hub: {
      label: 'Panel GAMADA',
      sub: 'Dasbor',
      kicker: 'Pusat kendali',
      title: 'Satu dasbor untuk semuanya',
      body: 'Pesanan dari website, pengguna aplikasi, jadwal bot, dan kondisi server tampil di satu layar. Hak akses diatur per peran, jadi setiap orang hanya melihat yang memang perlu ia lihat.',
      points: ['Data dari semua kanal di satu tempat', 'Hak akses per peran dan riwayat perubahan', 'Notifikasi penting ke WhatsApp atau email'],
      cta: 'Lihat demo panel',
    },
    web: {
      label: 'Website',
      sub: '',
      kicker: 'Pintu depan',
      title: 'Website yang mengirim data, bukan sekadar brosur',
      body: 'Formulir, katalog, dan pemesanan langsung masuk ke panel. Tidak ada lagi menyalin pesanan dari kotak masuk ke spreadsheet satu per satu.',
      points: ['Formulir dan pesanan tercatat otomatis', 'Katalog dan harga diubah dari panel', 'Statistik kunjungan di layar yang sama'],
      cta: 'Lihat demo website',
    },
    app: {
      label: 'Aplikasi',
      sub: '',
      kicker: 'Di genggaman pelanggan',
      title: 'Aplikasi mobile yang berbagi akun dan data',
      body: 'Aplikasi memakai akun, stok, dan riwayat yang sama dengan website. Ubah sekali di panel, semua kanal ikut berubah tanpa sinkronisasi manual.',
      points: ['Satu akun untuk web dan aplikasi', 'Notifikasi push dikirim dari panel', 'Data tetap rapi walau kanalnya bertambah'],
      cta: 'Lihat demo aplikasi',
    },
    auto: {
      label: 'Otomasi',
      sub: '',
      kicker: 'Bekerja di luar jam kantor',
      title: 'Pekerjaan berulang dijalankan oleh bot',
      body: 'Laporan harian, pengingat tagihan, unggahan terjadwal, dan pengecekan data berjalan sendiri. Setiap hasil dan kegagalan tercatat di panel, bukan hilang di log.',
      points: ['Jadwal tugas yang bisa dijeda kapan saja', 'Riwayat jalan dan pesan error yang jelas', 'Pemicu dari pesanan, formulir, atau jam tertentu'],
      cta: 'Lihat studi kasus otomasi',
    },
    ai: {
      label: 'AI',
      sub: '',
      kicker: 'Asisten yang membaca data Anda',
      title: 'AI yang menyatu dengan alur kerja',
      body: 'Meringkas percakapan pelanggan, mengelompokkan sentimen, dan menyiapkan draf jawaban dari data Anda sendiri. Keputusan akhir tetap di tangan tim.',
      points: ['Ringkasan dan klasifikasi otomatis', 'Draf balasan untuk pertanyaan umum', 'Hasilnya bisa diperiksa sebelum dipakai'],
      cta: 'Coba ScrapPulse',
    },
    infra: {
      label: 'Infrastruktur',
      sub: '',
      kicker: 'Fondasi yang tidak terlihat',
      title: 'Server, cadangan, dan pemantauan',
      body: 'Semua layanan berjalan di server yang kami siapkan dan awasi: backup terjadwal, sertifikat SSL yang memperpanjang diri, dan peringatan dini kalau ada yang tidak beres.',
      points: ['Backup terjadwal ke lokasi terpisah', 'Pemantauan uptime dan peringatan', 'Standar keamanan yang sama di setiap server'],
      cta: 'Lihat standar keamanan',
    },
  },
}

export const ecosystem = id
