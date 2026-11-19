/** siaga-wilayah — /produk/siaga-wilayah page copy (Tahap 6 plan §3.1). Sources: spec §11 P5, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Sel hujan bergerak di peta {region}, genangan diprediksi sampai enam jam ke depan, dan peringatan sampai ke camat serta kepala desa yang tepat.',
    en: 'Rain cells move across the map of {region}, flooding is forecast six hours ahead, and warnings reach the right district and village heads.',
  },
  problems: [
    {
      title: { id: 'Peringatan datang terlambat', en: 'Warnings come too late' },
      body: { id: 'Informasi hujan diteruskan berantai lewat telepon, dan desa terdampak tahu setelah air sudah naik.', en: 'Rain information is passed down by phone calls, and affected villages learn after the water has risen.' },
    },
    {
      title: { id: 'Peta dan data terpisah', en: 'Maps and data are separate' },
      body: { id: 'Zona risiko, sungai, fasilitas penting, dan jumlah penduduk ada di dokumen berbeda saat keputusan harus cepat.', en: 'Risk zones, rivers, key facilities and population sit in different documents when decisions must be fast.' },
    },
    {
      title: { id: 'Dampak lanjutan tidak terbaca', en: 'Knock-on effects go unseen' },
      body: { id: 'Banjir merusak panen dan menggerakkan harga, tetapi dinas pertanian dan perdagangan baru tahu belakangan.', en: 'Floods damage harvests and move prices, but the agriculture and trade offices find out later.' },
    },
  ],
  steps: [
    {
      title: { id: 'Hujan masuk ke peta', en: 'Rain enters the map' },
      body: { id: 'Sel hujan bergerak di atas batas kecamatan dan desa, sungai, serta zona risiko.', en: 'Rain cells move over district and village boundaries, rivers and risk zones.' },
    },
    {
      title: { id: 'Genangan diprediksi', en: 'Flooding is forecast' },
      body: { id: 'Geser waktu +1 sampai +6 jam: poligon genangan tumbuh, dan desa terdampak menyala lengkap dengan jumlah penduduknya.', en: 'Slide time from +1 to +6 hours: flood polygons grow and affected villages light up with their population.' },
    },
    {
      title: { id: 'Peringatan dini terkirim', en: 'The early warning goes out' },
      body: { id: 'Pilih level dan wilayah, tinjau pesannya, lalu kirim. Tanda terkirim dan terbaca bergulir, dan warga di zona itu menerimanya di Sapa Warga.', en: 'Pick a level and area, review the message, then send. Delivered and read ticks roll in, and residents in the zone receive it in Sapa Warga.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Genangan yang tumbuh', en: 'Flooding that grows' },
      body: { id: 'Prediksi genangan digambar di peta daerah nyata, mengikuti scrubber waktu.', en: 'The flood forecast is drawn on the real regional map, following the time scrubber.' },
      frame: 'genangan',
    },
    {
      title: { id: 'Peringatan massal berantai', en: 'A chain-reaction mass warning' },
      body: { id: 'Satu peringatan menggerakkan Sapa Warga, Meja Pimpinan, Cek Berkas, dan Sinyal Pasar.', en: 'One warning moves Sapa Warga, Meja Pimpinan, Cek Berkas and Sinyal Pasar.' },
      frame: 'terkirim',
    },
    {
      title: { id: 'Sebelum dan sesudah', en: 'Before and after' },
      body: { id: 'Slider citra memperlihatkan lahan sebelum dan sesudah banjir, dan estimasi panen per kecamatan ikut berubah.', en: 'An image slider shows land before and after the flood, and the harvest estimate per district changes with it.' },
    },
  ],
  roles: {
    bpbd: { id: 'Melihat hujan, genangan, dan desa terdampak di satu peta, lalu mengirim peringatan dalam satu alur.', en: 'Sees rain, flooding and affected villages on one map, then sends warnings in one flow.' },
    pertanian: { id: 'Membaca dampak banjir pada lahan dan perkiraan panen per kecamatan.', en: 'Reads the flood impact on farmland and the harvest estimate per district.' },
    'kepala-daerah': { id: 'Tahu wilayah mana yang paling berisiko sebelum rapat dimulai.', en: 'Knows which areas are most at risk before the meeting starts.' },
  },
  relations: {
    'sapa-warga': { id: 'Peringatan sampai ke ponsel warga; aduan banjir mengonfirmasi prediksi.', en: "Warnings reach citizens' phones; flood complaints confirm the forecast." },
    'meja-pimpinan': { id: 'Prakiraan dan peringatan aktif masuk ke briefing pagi.', en: 'Forecasts and active warnings go into the morning briefing.' },
    'cek-berkas': { id: 'Alamat pendaftar bansos dicek terhadap zona terdampak.', en: 'Aid applicant addresses are checked against the affected zone.' },
    'sinyal-pasar': { id: 'Panen yang turun memicu sinyal pasokan beras dan cabai.', en: 'A lower harvest triggers rice and chilli supply signals.' },
    'indeks-ekonomi': { id: 'Dampak banjir tercatat di ekonomi kecamatan.', en: 'Flood impact shows up in district economies.' },
    'toko-autopilot': { id: 'Toko di daerah menyesuaikan prediksi stok saat ada peringatan.', en: 'Local shops adjust their stock forecast when a warning is issued.' },
  },
  dataNote: {
    id: 'Batas kecamatan dan desa, sungai, dan jumlah penduduk memakai data {region} yang sebenarnya. Hujan, genangan, peringatan, dan penerima pesan adalah simulasi.',
    en: 'District and village boundaries, rivers and population use real {region} data. Rain, flooding, warnings and message recipients are simulated.',
  },
  faq: [
    {
      q: { id: 'Apakah prediksinya memakai data cuaca nyata?', en: 'Does the forecast use real weather data?' },
      a: { id: 'Skenario banjir di demo adalah simulasi. Sumber data cuaca untuk pemasangan dibahas saat konsultasi.', en: 'The flood scenario in the demo is simulated. Weather data sources for an installation are discussed during consultation.' },
    },
    {
      q: { id: 'Siapa yang menerima peringatan?', en: 'Who receives the warning?' },
      a: { id: 'Di demo, camat, kepala desa, dan warga di zona terpilih (semuanya fiktif). Daftar penerima nyata disusun bersama instansi Anda.', en: 'In the demo, district heads, village heads and residents in the chosen zone (all fictional). The real list is built with your agency.' },
    },
    {
      q: { id: 'Bisakah dipakai untuk longsor?', en: 'Can it be used for landslides?' },
      a: { id: 'Peta demo sudah memuat zona risiko banjir dan longsor. Skenario lain dibahas sesuai kebutuhan daerah.', en: 'The demo map already holds flood and landslide risk zones. Other scenarios are discussed for your region.' },
    },
    {
      q: { id: 'Apakah peta berat dibuka di ponsel?', en: 'Is the map heavy on phones?' },
      a: { id: 'Demo menyesuaikan animasi dengan kemampuan perangkat, dan peta tetap bisa dipakai di ponsel.', en: 'The demo adapts its animation to the device, and the map stays usable on phones.' },
    },
  ],
  miniCaption: [
    { id: 'Awan hujan mendekat', en: 'Rain clouds approach' },
    { id: 'Sel hujan di atas kecamatan', en: 'Rain cells over the districts' },
    { id: 'Prediksi genangan +6 jam', en: 'Flooding forecast +6 h' },
    { id: 'Peringatan dini disiapkan', en: 'Early warning prepared' },
    { id: 'Terkirim ke penerima di zona', en: 'Delivered to recipients in the zone' },
  ],
}
