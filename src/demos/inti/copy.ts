/** inti — /produk/inti page copy (Tahap 6 plan §3.1; the page itself lives at /ekosistem/inti). Sources: spec §11 P0, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Satu akun untuk semua peran, satu lapisan data, dan satu jejak audit yang dipakai bersama oleh setiap produk GAMADA.',
    en: 'One account for every role, one data layer and one audit trail, shared by every GAMADA product.',
  },
  problems: [
    {
      title: { id: 'Setiap aplikasi punya akun sendiri', en: 'Every app has its own login' },
      body: { id: 'Pegawai menghafal banyak kata sandi, dan hak akses diatur ulang di setiap sistem. Saat orang pindah jabatan, aksesnya tertinggal.', en: 'Staff juggle many passwords and access is set up again in every system. When someone changes jobs, their access stays behind.' },
    },
    {
      title: { id: 'Data berhenti di batas aplikasi', en: 'Data stops at the app boundary' },
      body: { id: 'Aduan warga tercatat di satu sistem, rapat di sistem lain, belanja di sistem ketiga. Tidak ada yang bisa menelusuri satu kejadian dari awal sampai akhir.', en: 'A complaint lives in one system, the meeting in another, the purchase in a third. Nobody can follow one event from start to finish.' },
    },
    {
      title: { id: 'Sulit menjawab "siapa mengubah apa"', en: 'Hard to answer "who changed what"' },
      body: { id: 'Ketika pemeriksa bertanya, jejaknya tersebar di banyak log yang formatnya berbeda.', en: 'When auditors ask, the trail is scattered across many logs in different formats.' },
    },
  ],
  steps: [
    {
      title: { id: 'Inti ID: satu akun, banyak peran', en: 'Inti ID: one account, many roles' },
      body: { id: 'Satu orang bisa menjadi Kepala Daerah di Meja Pimpinan dan penyetuju di Naskah Pintar. Matriks hak akses berubah saat peran berganti.', en: 'One person can be Regional Head in Meja Pimpinan and approver in Naskah Pintar. The access matrix changes as the role switches.' },
    },
    {
      title: { id: 'Inti Data: kejadian yang mengalir', en: 'Inti Data: events that flow' },
      body: { id: 'Setiap produk mengirim dan menerima kejadian lewat lapisan yang sama, jadi aduan banjir bisa menggerakkan peringatan, briefing, dan belanja darurat.', en: 'Every product sends and receives events through the same layer, so a flood complaint can drive a warning, a briefing and an emergency purchase.' },
    },
    {
      title: { id: 'Audit Log: semuanya tercatat', en: 'Audit Log: everything is recorded' },
      body: { id: 'Setiap kejadian tersimpan dengan pelaku, waktu, dan sebabnya. Bisa disaring per produk dan diekspor.', en: 'Every event is stored with its actor, time and cause. Filter it by product and export it.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Lihat jejak data', en: 'See the data trail' },
      body: { id: 'Pilih aduan SW-0142 lalu ikuti perjalanannya: Sapa Warga, Siaga Wilayah, Meja Pimpinan, Naskah Pintar, Awas Belanja, Katalog Lokal.', en: 'Pick complaint SW-0142 and follow its path: Sapa Warga, Siaga Wilayah, Meja Pimpinan, Naskah Pintar, Awas Belanja, Katalog Lokal.' },
      frame: 'jejak',
    },
    {
      title: { id: 'Kejadian yang menyambung', en: 'Events that connect' },
      body: { id: 'Satu aduan menjadi bahan briefing pagi pimpinan tanpa ada yang mengetik ulang.', en: "One complaint becomes part of the head's morning briefing without anyone retyping it." },
      frame: 'meja',
    },
    {
      title: { id: 'Inti Agen: jejak berpikir AI', en: 'Inti Agen: the AI reasoning trail' },
      body: { id: 'Untuk permintaan terakhir di produk mana pun, terlihat urutannya: maksud, alat, data, jawaban, lengkap dengan durasi tiap langkah.', en: 'For the latest request in any product, see the sequence: intent, tool, data, answer, with the duration of each step.' },
    },
  ],
  roles: {
    'kepala-daerah': { id: 'Melihat satu kejadian dari hulu ke hilir, dan tahu siapa yang menangani di setiap langkah.', en: 'Sees one event end to end, and knows who handled each step.' },
    sekretariat: { id: 'Mengatur peran dan hak akses pegawai dari satu tempat.', en: 'Manages staff roles and access rights from one place.' },
    'pemilik-toko': { id: 'Memakai akun yang sama untuk kasir, pembukuan, dan etalase pemda.', en: 'Uses the same account for checkout, bookkeeping and the government storefront.' },
  },
  relations: {
    'sapa-warga': { id: 'Aduan warga menjadi awal jejak data.', en: 'Citizen complaints start the data trail.' },
    'meja-pimpinan': { id: 'Briefing pimpinan membaca kejadian dari lapisan data yang sama.', en: "The head's briefing reads events from the same data layer." },
    'naskah-pintar': { id: 'Disposisi dan tindak lanjut tercatat di Audit Log.', en: 'Dispositions and follow-ups are recorded in the Audit Log.' },
    'siaga-wilayah': { id: 'Peringatan dini menyambung ke aduan warga di zona yang sama.', en: 'Early warnings link to citizen complaints in the same zone.' },
    'awas-belanja': { id: 'Paket belanja darurat lahir dari kejadian banjir yang sama.', en: 'Emergency purchases are born from the same flood event.' },
    'katalog-lokal': { id: 'Ujung jejak: kebutuhan pemda dipenuhi UMKM lokal.', en: 'The end of the trail: government needs met by local SMEs.' },
  },
  dataNote: {
    id: 'Nama kecamatan dan desa memakai geografi {region} yang sebenarnya. Orang, akun, aduan, dan semua angka di demo adalah simulasi.',
    en: 'District and village names follow the real geography of {region}. People, accounts, complaints and every number in the demo are simulated.',
  },
  faq: [
    {
      q: { id: 'Apakah GAMADA Inti dijual terpisah?', en: 'Is GAMADA Inti sold separately?' },
      a: { id: 'Inti adalah fondasi yang ikut terpasang bersama produk pertama Anda. Cakupannya dibahas saat konsultasi.', en: 'Inti is the foundation installed with your first product. Its scope is discussed during consultation.' },
    },
    {
      q: { id: 'Bisakah Inti tersambung ke sistem yang sudah kami pakai?', en: 'Can Inti connect to systems we already use?' },
      a: { id: 'Bisa dirancang lewat integrasi data. Sistem mana dan caranya kami bahas bersama tim teknis Anda.', en: 'It can be designed through data integration. Which systems and how are discussed with your technical team.' },
    },
    {
      q: { id: 'Di mana data disimpan?', en: 'Where is the data stored?' },
      a: { id: 'Dapat dipasang di server dalam negeri atau on-premise di instansi Anda. Pilihannya dibahas saat konsultasi.', en: 'It can be installed on servers in Indonesia or on-premise at your agency. The options are discussed during consultation.' },
    },
    {
      q: { id: 'Apa yang terjadi saat pegawai pindah jabatan?', en: 'What happens when an employee changes jobs?' },
      a: { id: 'Perannya diganti di Inti ID, dan hak aksesnya di semua produk ikut berubah. Perubahan itu sendiri tercatat di Audit Log.', en: 'Their role is changed in Inti ID and their access in every product follows. The change itself is recorded in the Audit Log.' },
    },
  ],
  miniCaption: [
    { id: 'Aduan SW-0142 masuk lewat Sapa Warga', en: 'Complaint SW-0142 arrives through Sapa Warga' },
    { id: 'Siaga Wilayah mengonfirmasi zona banjir', en: 'Siaga Wilayah confirms the flood zone' },
    { id: 'Masuk ke briefing Meja Pimpinan', en: 'It enters the Meja Pimpinan briefing' },
    { id: 'Naskah Pintar membuat disposisi', en: 'Naskah Pintar issues a disposition' },
    { id: 'Awas Belanja memeriksa paket darurat', en: 'Awas Belanja checks the emergency package' },
    { id: 'Jejak lengkap melintasi 6 produk', en: 'The full trail across 6 products' },
  ],
}
