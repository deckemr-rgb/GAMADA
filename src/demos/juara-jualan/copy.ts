/** juara-jualan — /produk/juara-jualan page copy (Tahap 6 plan §3.1). Sources: spec §11 P10, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Setiap telepon dan chat penjualan diberi skor per kriteria, momen masalahnya ditandai, dan agen mendapat latihan tepat di titik lemahnya.',
    en: 'Every sales call and chat is scored per criterion, the problem moment is marked, and agents practise exactly where they are weak.',
  },
  problems: [
    {
      title: { id: 'Hanya sedikit percakapan yang didengar', en: 'Only a few conversations get heard' },
      body: { id: 'Supervisor mengambil sampel beberapa rekaman per minggu, sisanya tidak pernah dinilai.', en: 'Supervisors sample a few recordings a week; the rest are never reviewed.' },
    },
    {
      title: { id: 'Umpan balik terlalu umum', en: 'Feedback is too general' },
      body: { id: '"Tingkatkan closing" tidak memberi tahu agen kalimat mana yang perlu diubah.', en: '"Improve your closing" does not tell an agent which sentence to change.' },
    },
    {
      title: { id: 'Latihan butuh waktu orang lain', en: 'Practice takes someone else’s time' },
      body: { id: 'Roleplay menunggu jadwal supervisor, jadi jarang dilakukan.', en: 'Roleplay waits for the supervisor’s calendar, so it rarely happens.' },
    },
  ],
  steps: [
    {
      title: { id: 'Percakapan dinilai', en: 'Conversations are scored' },
      body: { id: 'Rekaman dan chat diberi skor per kriteria: salam, gali kebutuhan, keberatan, penawaran, closing.', en: 'Recordings and chats are scored per criterion: greeting, discovery, objections, offer, closing.' },
    },
    {
      title: { id: 'Loncat ke momen masalah', en: 'Jump to the problem moment' },
      body: { id: 'Penanda di gelombang audio membawa supervisor langsung ke detik yang perlu diperbaiki, dengan kutipan buktinya.', en: 'Markers on the waveform take the supervisor straight to the second that needs work, with the quote as evidence.' },
    },
    {
      title: { id: 'Coaching dan latihan', en: 'Coaching and practice' },
      body: { id: 'Kartu coaching mingguan berisi 3 fokus dan contoh kalimat; agen berlatih dengan pelanggan AI.', en: 'Weekly coaching cards hold 3 focus points and sample lines; agents practise with an AI customer.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Skor dan tip coaching', en: 'Score and coaching tip' },
      body: { id: 'Transkrip panggilan menjadi skor per kriteria dan satu tip yang bisa langsung dipakai besok.', en: 'A call transcript becomes a per-criterion score and one tip to use tomorrow.' },
      frame: 'coaching',
    },
    {
      title: { id: 'Roleplay dengan pelanggan AI', en: 'Roleplay with an AI customer' },
      body: { id: 'Persona ragu harga, buru-buru, atau banyak tanya. Di akhir latihan agen mendapat skor dan umpan balik.', en: 'Personas who doubt the price, are in a hurry or ask a lot. At the end the agent gets a score and feedback.' },
    },
  ],
  roles: {
    'supervisor-sales': { id: 'Melihat semua percakapan, bukan sampel, dan tahu siapa perlu dilatih soal apa.', en: 'Sees every conversation, not a sample, and knows who needs coaching on what.' },
    'agen-sales': { id: 'Mendapat umpan balik konkret dan tempat berlatih kapan saja.', en: 'Gets concrete feedback and a place to practise anytime.' },
  },
  relations: {
    'toko-autopilot': { id: 'Chat penjualan dan PO toko bangunan ikut dinilai.', en: 'Hardware store sales chats and POs are scored too.' },
  },
  dataNote: {
    id: 'Semua agen, pelanggan, rekaman suara sintetis, chat, dan skor adalah simulasi.',
    en: 'All agents, customers, synthetic voice recordings, chats and scores are simulated.',
  },
  faq: [
    {
      q: { id: 'Industri apa yang didukung?', en: 'Which industries are supported?' },
      a: { id: 'Demo memuat multifinance, asuransi, dan toko bangunan. Kriteria penilaian disesuaikan dengan naskah penjualan Anda.', en: 'The demo has multifinance, insurance and a hardware store. Scoring criteria are fitted to your sales script.' },
    },
    {
      q: { id: 'Apakah agen bisa melihat skornya sendiri?', en: 'Can agents see their own score?' },
      a: { id: 'Bisa, sesuai peran. Agen melihat percakapan dan coaching miliknya; supervisor melihat tim.', en: 'Yes, by role. Agents see their own conversations and coaching; supervisors see the team.' },
    },
    {
      q: { id: 'Apakah rekaman disimpan?', en: 'Are recordings stored?' },
      a: { id: 'Di demo, rekaman adalah audio sintetis. Penyimpanan untuk pemasangan dibahas saat konsultasi.', en: 'In the demo, recordings are synthetic audio. Storage for an installation is discussed during consultation.' },
    },
    {
      q: { id: 'Apakah roleplay butuh koneksi AI sungguhan?', en: 'Does roleplay need a real AI connection?' },
      a: { id: 'Mode simulasi berjalan tanpa koneksi luar. Mode Live terasa paling hidup bila diaktifkan.', en: 'Simulated mode runs with no outside connection. Live mode feels most natural when enabled.' },
    },
  ],
  miniCaption: [
    { id: 'Transkrip panggilan', en: 'Call transcript' },
    { id: 'Momen masalah ditandai', en: 'Problem moment marked' },
    { id: 'Skor per kriteria', en: 'Score per criterion' },
    { id: 'Tip coaching untuk agen', en: 'Coaching tip for the agent' },
  ],
}
