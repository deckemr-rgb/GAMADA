/** sapa-warga — /produk/sapa-warga page copy (Tahap 6 plan §3.1). Sources: spec §11 P1, products.ts, the demo. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Pesan suara berbahasa Jawa menjadi tiket rapi di konsol petugas, dan aduan yang mirip berkumpul menjadi klaster di peta.',
    en: "A voice note in Javanese becomes a tidy ticket in the officer's console, and similar complaints gather into a cluster on the map.",
  },
  problems: [
    {
      title: { id: 'Warga tidak tahu harus ke mana', en: 'Citizens do not know where to go' },
      body: { id: 'Syarat KTP-el, NIB, atau bansos tersebar di banyak situs. Warga bolak-balik ke kantor hanya untuk bertanya.', en: 'Requirements for ID cards, business IDs or aid are spread over many sites. Citizens travel to the office just to ask.' },
    },
    {
      title: { id: 'Aduan datang berantakan', en: 'Complaints arrive messy' },
      body: { id: 'Pesan suara, foto tanpa lokasi, bahasa daerah. Petugas menyalin ulang ke formulir sebelum bisa meneruskan.', en: 'Voice notes, photos without a location, local languages. Officers retype everything into a form before they can pass it on.' },
    },
    {
      title: { id: 'Pola baru terlihat terlambat', en: 'Patterns show up too late' },
      body: { id: 'Dua belas aduan genangan dari satu kelurahan dibaca satu per satu, bukan sebagai satu masalah yang perlu pompa.', en: 'Twelve flooding complaints from one neighbourhood are read one by one, not as one problem that needs a pump.' },
    },
  ],
  steps: [
    {
      title: { id: 'Warga menulis atau bicara di WhatsApp', en: 'Citizens type or talk on WhatsApp' },
      body: { id: 'Bertanya syarat layanan, mengirim pesan suara, foto, dan lokasi. AI menjawab dengan kartu checklist dan tombol "Ambil antrean".', en: 'They ask about requirements, send voice notes, photos and a location. The AI answers with a checklist card and a "Take a queue number" button.' },
    },
    {
      title: { id: 'Aduan menjadi tiket', en: 'Complaints become tickets' },
      body: { id: 'AI mengekstrak kategori, kelurahan, dan urgensi, lalu membuat tiket SW dengan estimasi SLA. Tiket langsung muncul di Konsol Petugas.', en: 'The AI extracts category, neighbourhood and urgency, then creates an SW ticket with an SLA estimate. It appears at once in the Officer Console.' },
    },
    {
      title: { id: 'Petugas meneruskan, warga mendapat kabar', en: 'Officers forward, citizens get updates' },
      body: { id: 'Petugas memverifikasi dan meneruskan ke OPD. Status di ponsel warga ikut berubah, sampai tiket selesai dan diberi rating.', en: "Officers verify and forward to the right agency. The status on the citizen's phone follows, until the ticket is closed and rated." },
    },
  ],
  highlights: [
    {
      title: { id: 'Pesan suara bahasa daerah dipahami', en: 'Local-language voice notes understood' },
      body: { id: 'Ibu Siti mengirim pesan suara berbahasa Jawa. Transkrip muncul kata demi kata dengan terjemahan, dan balasan dikirim dalam bahasanya.', en: 'Ibu Siti sends a voice note in Javanese. The transcript appears word by word with a translation, and the reply comes back in her language.' },
      frame: 'transkrip',
    },
    {
      title: { id: 'Aduan menjadi klaster di peta', en: 'Complaints become a cluster on the map' },
      body: { id: 'Saat aduan serupa menumpuk di satu wilayah, klaster terbentuk dan diteruskan ke Meja Pimpinan dan Siaga Wilayah.', en: 'When similar complaints pile up in one area, a cluster forms and is passed to Meja Pimpinan and Siaga Wilayah.' },
      frame: 'klaster',
    },
  ],
  roles: {
    warga: { id: 'Bertanya dan melapor dari WhatsApp, dalam bahasa sehari-hari, dan selalu tahu status laporannya.', en: 'Asks and reports from WhatsApp in everyday language, and always knows where the report stands.' },
    petugas: { id: 'Menerima tiket yang sudah rapi, lengkap dengan transkrip, foto, lokasi, dan draf balasan.', en: 'Receives tidy tickets with transcript, photo, location and a draft reply.' },
    'kepala-daerah': { id: 'Melihat ringkasan aduan dan klaster yang perlu tindakan hari ini.', en: 'Sees a summary of complaints and the clusters that need action today.' },
  },
  relations: {
    'meja-pimpinan': { id: 'Klaster aduan masuk ke briefing pagi pimpinan.', en: "Complaint clusters go into the head's morning briefing." },
    'siaga-wilayah': { id: 'Peringatan dini sampai ke warga di zona risiko; aduan banjir mengonfirmasi prediksi.', en: 'Early warnings reach residents in the risk zone; flood complaints confirm the forecast.' },
    'radar-isu': { id: 'Lonjakan aduan menjadi topik yang dipantau Humas.', en: 'A spike in complaints becomes a topic watched by Public Relations.' },
    'naskah-pintar': { id: 'Tindak lanjut aduan bisa menjadi disposisi resmi.', en: 'Complaint follow-ups can become official dispositions.' },
  },
  dataNote: {
    id: 'Kelurahan, kecamatan, dan layanan memakai data {region} yang sebenarnya. Warga, pesan, tiket, nomor antrean, dan QR adalah simulasi.',
    en: 'Neighbourhoods, districts and services follow real {region} data. Citizens, messages, tickets, queue numbers and QR codes are simulated.',
  },
  faq: [
    {
      q: { id: 'Apakah ini memakai nomor WhatsApp resmi pemda?', en: "Does it use the government's official WhatsApp number?" },
      a: { id: 'Di demo, tampilan WhatsApp adalah simulasi. Untuk pemasangan, kanal dan nomor resmi dibahas saat konsultasi.', en: 'In the demo the WhatsApp screen is simulated. For an installation, the channel and official number are discussed during consultation.' },
    },
    {
      q: { id: 'Bahasa daerah apa saja yang bisa dipahami?', en: 'Which local languages can it understand?' },
      a: { id: 'Demo menunjukkan Basa Jawa. Bahasa lain disesuaikan dengan daerah Anda dan diuji bersama sebelum dipakai.', en: 'The demo shows Javanese. Other languages are tuned to your region and tested together before use.' },
    },
    {
      q: { id: 'Bagaimana jika AI tidak tahu jawabannya?', en: 'What if the AI does not know the answer?' },
      a: { id: 'Percakapan diteruskan ke petugas dengan ringkasannya, jadi warga tidak perlu mengulang cerita.', en: 'The conversation is handed to an officer with a summary, so the citizen does not have to repeat the story.' },
    },
    {
      q: { id: 'Apakah aduan bisa diteruskan ke OPD yang berbeda?', en: 'Can complaints go to different agencies?' },
      a: { id: 'Bisa. Petugas memilih OPD tujuan, dan setiap perubahan status tercatat di Inti Audit.', en: 'Yes. The officer picks the target agency, and every status change is recorded in Inti Audit.' },
    },
    {
      q: { id: 'Bisakah saya mencobanya sekarang?', en: 'Can I try it now?' },
      a: { id: 'Bisa. Buka demo penuh, pilih persona Ibu Siti, lalu kirim pesan suara contoh.', en: 'Yes. Open the full demo, pick the Ibu Siti persona and send the sample voice note.' },
    },
  ],
  miniCaption: [
    { id: 'Ibu Siti merekam pesan suara', en: 'Ibu Siti records a voice note' },
    { id: 'Transkrip Basa Jawa diterjemahkan', en: 'The Javanese transcript is translated' },
    { id: 'Tiket SW masuk ke Konsol Petugas', en: 'An SW ticket lands in the Officer Console' },
    { id: 'Aduan serupa menjadi klaster', en: 'Similar complaints form a cluster' },
  ],
}
