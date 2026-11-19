/** naskah-pintar — /produk/naskah-pintar page copy (Tahap 6 plan §3.1). Sources: spec §11 P3, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Notulen dan tindak lanjut tersusun selama rapat berjalan, dan surat masuk yang miring hasil scan menjadi draf disposisi rapi.',
    en: 'Minutes and follow-ups take shape while the meeting runs, and a crooked scanned letter becomes a tidy draft disposition.',
  },
  problems: [
    {
      title: { id: 'Notulen selesai berhari-hari kemudian', en: 'Minutes are finished days later' },
      body: { id: 'Notulis mendengarkan ulang rekaman dan mengetik dari awal. Keputusan rapat menunggu dokumen resmi.', en: 'The minute-taker replays the recording and types from scratch. Decisions wait for the official document.' },
    },
    {
      title: { id: 'Surat menumpuk di meja', en: 'Letters pile up on desks' },
      body: { id: 'Setiap surat masuk dibaca, diklasifikasi, dan didisposisikan manual, satu per satu.', en: 'Every incoming letter is read, classified and dispositioned by hand, one at a time.' },
    },
    {
      title: { id: 'Tindak lanjut terlupa', en: 'Follow-ups are forgotten' },
      body: { id: 'PIC dan tenggat tercatat di notulen, tetapi tidak ada yang mengingatkan saat tenggat lewat.', en: 'Owners and deadlines are in the minutes, but nobody gives a reminder when a deadline passes.' },
    },
  ],
  steps: [
    {
      title: { id: 'Rekam atau putar rapat', en: 'Record or play the meeting' },
      body: { id: 'Transkrip mengalir dengan warna per pembicara: Sekda, Kadis PUPR, Kalaksa BPBD, Kadinsos, Camat.', en: 'The transcript flows with a colour per speaker: Regional Secretary, Public Works, Disaster Agency, Social Affairs, District Head.' },
    },
    {
      title: { id: 'Notulen menulis dirinya sendiri', en: 'The minutes write themselves' },
      body: { id: 'Peserta, agenda, keputusan, dan tabel tindak lanjut dengan PIC dan tenggat terisi selama rapat, lalu siap dalam format naskah dinas.', en: 'Attendees, agenda, decisions and a follow-up table with owners and deadlines fill in during the meeting, then format as an official document.' },
    },
    {
      title: { id: 'Disposisi dan pengingat', en: 'Dispositions and reminders' },
      body: { id: 'Surat masuk diringkas dan diberi draf disposisi. Tindak lanjut yang lewat tenggat mendapat pengingat ke PIC.', en: 'Incoming letters are summarised with a draft disposition. Overdue follow-ups get a reminder to their owner.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Notulen live', en: 'Live minutes' },
      body: { id: 'Saat Kadis PUPR menyebut tenggat, baris tindak lanjut baru muncul di tabel dengan PIC dan tanggalnya.', en: 'When the Head of Public Works names a deadline, a new follow-up row appears with its owner and date.' },
      frame: 'notulen',
    },
    {
      title: { id: 'Cap disposisi digital', en: 'Digital disposition stamp' },
      body: { id: 'Surat hasil scan menjadi ringkasan tiga baris, klasifikasi, sifat, dan draf disposisi yang tinggal disetujui.', en: 'A scanned letter becomes a three-line summary, a class, a priority and a draft disposition ready to approve.' },
      frame: 'disposisi',
    },
  ],
  roles: {
    sekretariat: { id: 'Menyelesaikan notulen dan disposisi dalam hitungan menit, bukan hari.', en: 'Finishes minutes and dispositions in minutes, not days.' },
    'kepala-daerah': { id: 'Menyetujui disposisi dengan satu klik dan melihat tindak lanjut yang terlambat.', en: 'Approves dispositions in one click and sees late follow-ups.' },
    'kepala-opd': { id: 'Menerima tugas yang jelas: apa, siapa, dan kapan tenggatnya.', en: 'Receives clear tasks: what, who and when it is due.' },
  },
  relations: {
    'meja-pimpinan': { id: 'Instruksi pimpinan masuk sebagai disposisi; tindak lanjut terlambat kembali ke briefing.', en: "The head's instructions arrive as dispositions; late follow-ups return to the briefing." },
    'awas-belanja': { id: 'Keputusan rapat soal belanja darurat diteruskan untuk diperiksa.', en: 'Meeting decisions on emergency purchases are passed on for checking.' },
  },
  dataNote: {
    id: 'Nama jabatan dan OPD mengikuti struktur pemda {region}. Rapat, rekaman, surat, nomor, dan tanda tangan adalah simulasi.',
    en: 'Job titles and agencies follow the {region} government structure. Meetings, recordings, letters, numbers and signatures are simulated.',
  },
  faq: [
    {
      q: { id: 'Apakah notulen mengikuti tata naskah dinas?', en: 'Do the minutes follow official document rules?' },
      a: { id: 'Demo menampilkan pratinjau notulen resmi dengan kop dan penomoran generik. Format daerah Anda disesuaikan saat pemasangan.', en: 'The demo shows an official-minutes preview with a generic letterhead and numbering. Your regional format is set up during installation.' },
    },
    {
      q: { id: 'Bagaimana dengan rapat yang bersifat rahasia?', en: 'What about confidential meetings?' },
      a: { id: 'Akses diatur per peran di Inti ID. Lokasi penyimpanan dibahas saat konsultasi, termasuk opsi on-premise.', en: 'Access is set per role in Inti ID. Storage location is discussed during consultation, including on-premise.' },
    },
    {
      q: { id: 'Apakah disposisi langsung terkirim?', en: 'Are dispositions sent automatically?' },
      a: { id: 'Tidak. AI hanya menyiapkan draf; pejabat tetap menyetujui atau mengubahnya.', en: 'No. The AI only prepares a draft; the official still approves or edits it.' },
    },
    {
      q: { id: 'Bisakah dicetak?', en: 'Can it be printed?' },
      a: { id: 'Bisa. Notulen resmi bisa dicetak atau disimpan sebagai PDF dari browser.', en: 'Yes. The official minutes can be printed or saved as PDF from the browser.' },
    },
  ],
  miniCaption: [
    { id: 'Rapat koordinasi banjir diputar', en: 'The flood coordination meeting plays' },
    { id: 'Notulen terisi selama rapat', en: 'Minutes fill in during the meeting' },
    { id: 'Tindak lanjut dengan PIC dan tenggat', en: 'Follow-ups with owners and deadlines' },
    { id: 'Surat masuk menjadi disposisi', en: 'An incoming letter becomes a disposition' },
  ],
}
