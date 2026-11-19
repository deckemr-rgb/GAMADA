/** meja-pimpinan — /produk/meja-pimpinan page copy (Tahap 6 plan §3.1). Sources: spec §11 P2, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Pukul 07.00 briefing sudah tersusun dari enam produk lain. Pimpinan bertanya dengan bahasa biasa dan mendapat grafik serta peta.',
    en: 'At 07:00 the briefing is already assembled from six other products. The head asks in plain words and gets a chart and a map.',
  },
  problems: [
    {
      title: { id: 'Laporan pagi disusun manual', en: 'Morning reports are put together by hand' },
      body: { id: 'Staf mengumpulkan angka dari banyak dinas sejak subuh. Saat sampai di meja pimpinan, datanya sudah tertinggal beberapa jam.', en: 'Staff collect numbers from many agencies at dawn. By the time it reaches the head, the data is hours old.' },
    },
    {
      title: { id: 'Pertanyaan butuh hari untuk dijawab', en: 'Questions take days to answer' },
      body: { id: '"Kenapa aduan jalan naik minggu ini?" berubah menjadi surat permintaan data ke beberapa OPD.', en: '"Why did road complaints rise this week?" turns into data requests to several agencies.' },
    },
    {
      title: { id: 'Instruksi hilang di jalan', en: 'Instructions get lost on the way' },
      body: { id: 'Arahan lisan di rapat tidak selalu menjadi tugas yang tercatat dan bisa dipantau.', en: 'Spoken directions in meetings do not always become tasks that are recorded and tracked.' },
    },
  ],
  steps: [
    {
      title: { id: 'Briefing menyusun dirinya sendiri', en: 'The briefing assembles itself' },
      body: { id: 'Aduan terbanyak, klaster banjir, prakiraan hujan, isu viral, paket berisiko, anomali harga, dan tindak lanjut terlambat muncul berurutan.', en: 'Top complaints, flood clusters, rain forecast, viral issues, risky packages, price anomalies and late follow-ups appear in order.' },
    },
    {
      title: { id: 'Tanya data', en: 'Ask the data' },
      body: { id: 'Ketik pertanyaan dengan bahasa biasa. Jawabannya berupa teks, grafik mini, dan peta yang terbang ke kecamatan teratas.', en: 'Type a question in plain words. The answer comes as text, a small chart and a map that flies to the top district.' },
    },
    {
      title: { id: 'Beri instruksi', en: 'Give an instruction' },
      body: { id: 'Instruksi seperti "Kerahkan pompa ke Kel. X" langsung menjadi disposisi di Naskah Pintar dan tugas di OPD terkait.', en: 'An instruction such as "Send pumps to Kel. X" becomes a disposition in Naskah Pintar and a task for the agency at once.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Briefing dari enam produk', en: 'A briefing from six products' },
      body: { id: 'Setiap butir briefing tertaut ke produk sumbernya, jadi pimpinan bisa langsung membuka detailnya.', en: 'Every briefing item links to its source product, so the head can open the detail right away.' },
      frame: 'briefing',
    },
    {
      title: { id: 'Pertanyaan menjadi grafik', en: 'A question becomes a chart' },
      body: { id: '"Desa mana paling berisiko?" dijawab dengan peringkat desa dan grafik, bukan tumpukan tabel.', en: '"Which village is most at risk?" is answered with a ranking and a chart, not a pile of tables.' },
      frame: 'jawab',
    },
    {
      title: { id: 'Mode rapat', en: 'Meeting mode' },
      body: { id: 'Layar penuh dengan huruf besar dan panel yang berganti sendiri, siap dipasang di layar dinding ruang rapat.', en: 'Full screen with large type and panels that rotate on their own, ready for the meeting-room wall screen.' },
    },
  ],
  roles: {
    'kepala-daerah': { id: 'Memulai hari dengan gambaran lengkap daerah dan memberi instruksi yang langsung tercatat.', en: 'Starts the day with a full picture of the region and gives instructions that are recorded at once.' },
    sekretariat: { id: 'Tidak lagi menyusun laporan pagi manual; tinggal memeriksa dan melengkapi.', en: 'No more hand-built morning reports; just review and complete.' },
    'kepala-opd': { id: 'Melihat scorecard OPD-nya: SLA, tiket terbuka, dan tindak lanjut.', en: "Sees the agency's scorecard: SLA, open tickets and follow-ups." },
  },
  relations: {
    'sapa-warga': { id: 'Aduan dan klaster warga menjadi butir briefing.', en: 'Citizen complaints and clusters become briefing items.' },
    'siaga-wilayah': { id: 'Prakiraan hujan dan peringatan aktif tampil di peta pimpinan.', en: "Rain forecasts and active warnings show on the head's map." },
    'radar-isu': { id: 'Isu viral dan hoaks masuk ke briefing.', en: 'Viral issues and hoaxes enter the briefing.' },
    'awas-belanja': { id: 'Paket pengadaan berisiko ikut dilaporkan.', en: 'Risky procurement packages are reported too.' },
    'naskah-pintar': { id: 'Instruksi pimpinan menjadi disposisi dan tindak lanjut.', en: "The head's instructions become dispositions and follow-ups." },
    'sinyal-pasar': { id: 'Anomali harga bahan pokok tampil sebagai peringatan.', en: 'Staple price anomalies show up as warnings.' },
  },
  dataNote: {
    id: 'Peta memakai batas kecamatan dan desa {region} yang sebenarnya. Semua KPI, aduan, dan peringkat OPD adalah simulasi.',
    en: 'The map uses the real district and village boundaries of {region}. All KPIs, complaints and agency rankings are simulated.',
  },
  faq: [
    {
      q: { id: 'Dari mana data briefing berasal?', en: 'Where does the briefing data come from?' },
      a: { id: 'Di demo, dari produk GAMADA lain di dunia simulasi. Untuk pemasangan, sumber data dari sistem Anda dipetakan saat konsultasi.', en: 'In the demo, from the other GAMADA products in the simulated world. For an installation, data sources from your systems are mapped during consultation.' },
    },
    {
      q: { id: 'Apakah pertanyaan bisa menebak-nebak angka?', en: 'Can questions make up numbers?' },
      a: { id: 'Jawaban dihitung dari data yang tersedia, dan grafiknya menunjukkan angka yang dipakai.', en: 'Answers are computed from the available data, and the chart shows the numbers used.' },
    },
    {
      q: { id: 'Bisakah dipakai dari ponsel?', en: 'Can it be used from a phone?' },
      a: { id: 'Bisa. Tombol "Lihat di HP" menampilkan briefing dalam format obrolan.', en: 'Yes. The "View on phone" button shows the briefing as a chat.' },
    },
    {
      q: { id: 'Siapa yang bisa melihat layar ini?', en: 'Who can see this screen?' },
      a: { id: 'Hanya peran yang diberi akses di Inti ID. Setiap instruksi tercatat di Inti Audit.', en: 'Only roles granted access in Inti ID. Every instruction is recorded in Inti Audit.' },
    },
  ],
  miniCaption: [
    { id: 'Pukul 07.00, briefing mulai disusun', en: '07:00, the briefing starts to assemble' },
    { id: 'Butir briefing dari enam produk', en: 'Briefing items from six products' },
    { id: 'Pimpinan bertanya dengan bahasa biasa', en: 'The head asks in plain words' },
    { id: 'Jawaban berupa grafik dan peringkat', en: 'The answer comes as a chart and ranking' },
    { id: 'Instruksi menjadi tugas OPD', en: 'The instruction becomes an agency task' },
  ],
}
