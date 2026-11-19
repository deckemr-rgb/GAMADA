/** tour/narration.id.ts — narasi bab 1–20 (≤ 60 kata per bab). {placeholder} diisi dari dunia (world-steps.ts chapterFacts). */
import type { Narration } from './types'

const N: Narration = {
  1: {
    title: 'Sel hujan masuk dari hulu',
    body: 'Pukul enam pagi, sel hujan bergerak masuk dari hulu. Siaga Wilayah menjalankan prakiraan enam jam ke depan: {n} kecamatan di jalur hujan ({kecs}) masuk zona waspada genangan, puncak curah hujan {mm} mm/jam.',
    happened: ['Prakiraan hujan +6 jam dijalankan', '{n} kecamatan masuk zona waspada'],
    caps: ['Mulai dari prakiraan cuaca', 'Prakiraan +6 jam berjalan di peta', 'Lapisan peta: hujan, sungai, desa'],
  },
  2: {
    title: 'Peringatan dini terkirim',
    body: 'Pukul 06.20 peringatan banjir Kec. {kec} terbit. Siaga Wilayah mengirimnya ke {camat} camat dan {k} kepala desa/lurah; {w} warga di zona menerima pesan di HP mereka. Total {r} penerima, semua tercatat di jejak data.',
    happened: ['Peringatan banjir level siaga terbit', '{r} penerima: camat, kepala desa, warga', 'Sapa Warga menampilkan pesan di HP warga'],
    caps: ['Peringatan banjir Kec. {kec} terbit', 'Penerima: camat dan kepala desa di zona', 'Kirim ke {r} penerima', 'Pesan peringatan di HP warga'],
  },
  3: {
    title: 'Briefing pagi tersusun sendiri',
    body: 'Pukul tujuh, Meja Pimpinan menyusun briefing pagi sendiri: {items} butir dari {products} produk, masing-masing bertaut ke sumbernya. Pimpinan bertanya desa mana paling berisiko; jawabannya menunjuk Kec. {kec}, lengkap dengan sumbernya.',
    happened: ['Briefing {items} butir tersusun', 'Pertanyaan data dijawab dengan sumber'],
    caps: ['Susun briefing pagi', 'Dengarkan briefing', 'Tanya data: desa mana paling berisiko?'],
  },
  4: {
    title: 'Pesan suara Ibu Siti',
    body: 'Ibu Siti Aminah dari Desa {desa} mengirim pesan suara dalam bahasa daerah. Sapa Warga menerjemahkan, membuat tiket {code}, lalu mengelompokkan {k} aduan banjir di sekitarnya menjadi satu klaster yang langsung terhubung ke peringatan banjir.',
    happened: ['Tiket {code} dibuat dari pesan suara', 'Klaster {k} aduan banjir terbentuk', 'Banjir terkonfirmasi warga'],
    caps: ['Pesan suara dalam bahasa daerah', 'Konsol petugas: tiket {code}', 'Klaster {k} aduan di sekitar Desa {desa}'],
  },
  5: {
    title: 'Rapat koordinasi dan disposisi',
    body: 'Rapat koordinasi banjir berjalan; notulen dan {tasks} tindak lanjut tersusun saat rapat. Instruksi Kepala Daerah dari klaster aduan tadi menjadi surat dan disposisi yang langsung masuk ke {opd1} dan {opd2}.',
    happened: ['Notulen dan {tasks} tindak lanjut tersusun', 'Disposisi ke {opd1} dan {opd2}'],
    caps: ['Putar rekaman rapat', 'Notulen menulis sendiri', 'Tindak lanjut dibagi ke OPD'],
  },
  6: {
    title: 'Hoaks bendungan jebol',
    body: 'Pukul sepuluh, kabar "bendungan jebol" menyebar: {posts} unggahan dalam beberapa menit. Radar Isu menandainya hoaks berdasarkan data pos duga air, dan klarifikasi resmi terbit {m} menit setelah isu terdeteksi.',
    happened: ['{posts} unggahan isu terdeteksi', 'Klarifikasi resmi terbit dalam {m} menit'],
    caps: ['Lonjakan unggahan "bendungan jebol"', 'Klarifikasi resmi terbit', 'Sentimen mulai pulih'],
  },
  7: {
    title: 'Paket darurat pompa air diperiksa',
    body: 'Paket darurat pompa air diperiksa Awas Belanja: HPS {gap}% di atas harga pasar (selisih {overpay}, simulasi) dan {aff} peserta terafiliasi. Rekomendasinya: koreksi HPS dan undang UMKM lokal lewat Katalog Lokal.',
    happened: ['HPS {gap}% di atas harga pasar', '{aff} peserta terafiliasi', 'UMKM lokal diundang'],
    caps: ['Selisih HPS dan harga pasar', 'Jalankan analisis paket', 'Rekomendasi: undang UMKM lokal'],
  },
  8: {
    title: 'Kebutuhan dicocokkan ke UMKM lokal',
    body: 'Kebutuhan {bags} karung pasir dan {tarps} terpal dicocokkan ke UMKM lokal yang sudah berlencana Terverifikasi dan Pajak Rapi: {matches} kecocokan. Pesanan dikirim ke {biz}.',
    happened: ['{matches} UMKM cocok', 'Pesanan dikirim ke {biz}'],
    caps: ['Papan pencocokan UMKM', 'Pesanan terkirim ke {biz}'],
  },
  9: {
    title: 'UMKM baru lolos verifikasi',
    body: 'Usaha milik {owner}, {biz}, diverifikasi Kenal Mitra: dokumen, lokasi, dan pemilik cocok. Lencana Terverifikasi langsung muncul di Katalog Lokal; kini {verified} usaha terverifikasi.',
    happened: ['KYB {biz} lolos', 'Lencana muncul di Katalog Lokal'],
    caps: ['Mulai verifikasi KYB', 'Cek lokasi usaha', 'Setujui mitra'],
  },
  10: {
    title: 'Tender darurat, penawaran terkirim',
    body: 'Toko bangunan menerima notifikasi tender darurat karung dan terpal senilai {hps} (simulasi). Skor peluang menangnya {p}%; dokumen penawaran tersusun dan terkirim tanpa mengetik ulang data usaha.',
    happened: ['Skor peluang {p}%', 'Penawaran terkirim'],
    caps: ['Skor peluang menang {p}%', 'Penawaran terkirim'],
  },
  11: {
    title: 'Prediksi melonjak, PO otomatis',
    body: 'Prediksi permintaan {item} melonjak {x}% karena banjir. Toko Autopilot menyiapkan PO {po}; PO dikirim ke {supplier}, dan pemasok membalas dengan jadwal kirim.',
    happened: ['Permintaan {item} +{x}%', 'PO {po} terkirim', 'Pemasok membalas'],
    caps: ['Banner banjir: permintaan naik', 'Grafik prediksi permintaan', 'Kirim PO ke pemasok', 'Balasan pemasok masuk'],
  },
  12: {
    title: 'Coaching untuk kasir baru',
    body: 'Percakapan penjualan dinilai otomatis per kriteria. {agent}, kasir baru, mendapat coaching tepat pada momen yang terlewat, lengkap dengan contoh kalimat.',
    happened: ['Momen bermasalah ditandai', 'Coaching ditugaskan ke {agent}'],
    caps: ['Momen bermasalah di rekaman', 'Coaching ditugaskan'],
  },
  13: {
    title: 'Nota jadi jurnal, pajak siap',
    body: 'Nota pembelian stok dari PO tadi berubah jadi jurnal yang seimbang. Pajak Beres menghitung PPh dan menandai status pajak bulan ini: siap lapor.',
    happened: ['Nota diproses menjadi jurnal', 'Status pajak: siap lapor'],
    caps: ['Proses nota pembelian', 'Pajak bulan ini siap lapor'],
  },
  14: {
    title: 'Skor usaha naik, modal disetujui',
    body: 'Data pembukuan dan pajak yang rapi menaikkan skor usaha ke {score} ({band}). Pemilik membagikan datanya; {lender} melihatnya dan menyetujui modal kerja {plafon} (simulasi).',
    happened: ['Skor usaha {score} ({band})', 'Modal kerja {plafon} disetujui'],
    caps: ['Skor usaha naik', 'Koperasi menyetujui modal kerja'],
  },
  15: {
    title: 'Balasan massal untuk keluhan',
    body: 'Keluhan "pengiriman lambat" naik {x}% sejak banjir. Pantau Merek mengelompokkannya; {n} balasan empatik dikirim sekaligus, masing-masing menyebut pesanan pelanggannya.',
    happened: ['Lonjakan keluhan +{x}%', '{n} balasan terkirim'],
    caps: ['Klaster keluhan "pengiriman lambat"', '{n} balasan empatik terkirim'],
  },
  16: {
    title: 'Verifikasi massal bansos',
    body: '{n} berkas pendaftar bansos banjir diperiksa dalam hitungan detik; {d} pasang NIK ganda ditahan sebelum dana cair.',
    happened: ['{n} berkas diperiksa', '{d} pasang NIK ganda ditahan'],
    caps: ['Mode massal', 'Proses {n} berkas', '{d} pasang NIK ganda ditemukan'],
  },
  17: {
    title: 'Harga mulai naik, operasi pasar',
    body: 'Harga {komoditas} di {pasar} mulai naik; peringatan dini sudah terbit {days} hari sebelum puncak. Operasi pasar direkomendasikan, disetujui, dan berjalan; puncak lonjakan harganya ditekan sekitar {y}% (simulasi).',
    happened: ['Peringatan dini harga {komoditas}', 'Operasi pasar berjalan'],
    caps: ['Peringatan dini harga', 'Operasi pasar berjalan'],
  },
  18: {
    title: 'Dampak di ekonomi kecamatan',
    body: 'Banjir menurunkan indeks ekonomi Kec. {kec} sekitar {d} poin; operasi pasar menahan penurunannya. Angka kecamatan dengan usaha terlalu sedikit disembunyikan demi anonimitas.',
    happened: ['Indeks Kec. {kec} turun {d} poin', 'Efek operasi pasar tercatat'],
    caps: ['Peta indeks ekonomi kecamatan', 'Dampak banjir dan program tercatat'],
  },
  19: {
    title: 'Penutupan hari dan jejak data',
    body: 'Hari ditutup di Meja Pimpinan. GAMADA Inti menelusuri aduan Ibu Siti melintasi enam produk, dari pesan suara sampai pesanan ke UMKM lokal; {events} peristiwa tercatat hari ini.',
    happened: ['Jejak aduan melintasi {lanes} produk', '{events} peristiwa tercatat'],
    caps: ['Ringkasan hari di Meja Pimpinan', 'Putar jejak data aduan Ibu Siti', 'Setiap simpul = satu baris Audit Log'],
  },
  20: {
    title: 'Hari ini di {region}',
    body: 'Satu hari, satu dunia data: aduan warga, peringatan banjir, pengadaan, UMKM, dan harga pasar saling menyambung. Bawa pulang ringkasannya atau coba sendiri produknya.',
    happened: [],
    caps: [],
  },
}
export default N
