/** cek-berkas — /produk/cek-berkas page copy (Tahap 6 plan §3.1). Sources: spec §11 P7, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Berkas spesimen dibaca, dicentang, dan dicocokkan dalam hitungan detik. Yang kurang, ganda, atau diedit langsung ditandai dengan alasannya.',
    en: 'Specimen documents are read, ticked and cross-checked in seconds. Anything missing, duplicated or edited is flagged with a reason.',
  },
  problems: [
    {
      title: { id: 'Antrean loket yang panjang', en: 'Long queues at the desk' },
      body: { id: 'Petugas memeriksa KTP, KK, dan NIB lembar demi lembar, dan warga baru tahu berkasnya kurang setelah menunggu.', en: 'Officers check ID cards, family cards and business IDs page by page, and citizens learn something is missing after waiting.' },
    },
    {
      title: { id: 'Pendaftar ganda lolos', en: 'Duplicate applicants slip through' },
      body: { id: 'Saat bantuan bencana dibuka, NIK yang sama bisa muncul di beberapa pendaftaran.', en: 'When disaster aid opens, the same ID number can appear in several applications.' },
    },
    {
      title: { id: 'Dokumen yang diedit sulit dikenali', en: 'Edited documents are hard to spot' },
      body: { id: 'Perubahan kecil pada foto dokumen tidak terlihat oleh mata yang lelah.', en: 'Small changes to a document photo go unseen by tired eyes.' },
    },
  ],
  steps: [
    {
      title: { id: 'Unggah atau pilih spesimen', en: 'Upload or pick a specimen' },
      body: { id: 'KTP, KK, NIB, surat domisili, atau foto rumah; semua spesimen fiktif bertanda air SPESIMEN.', en: 'ID card, family card, business ID, domicile letter or house photo; all fictional specimens watermarked SPESIMEN.' },
    },
    {
      title: { id: 'Dibaca dan dicek', en: 'Read and checked' },
      body: { id: 'Kotak OCR muncul berurutan, field terekstrak dengan tingkat keyakinan, lalu cek konsistensi: format NIK, tanggal lahir, nama di KK vs KTP.', en: 'OCR boxes appear in order, fields are extracted with confidence, then consistency checks run: ID format, birth date, name on family card vs ID.' },
    },
    {
      title: { id: 'Hasil yang jelas', en: 'A clear result' },
      body: { id: 'Lengkap, Kurang, atau Perlu Cek Manual dengan alasannya. Mode Massal memproses 50 berkas sekaligus dan menghubungkan NIK ganda.', en: 'Complete, Missing or Needs Manual Check, with reasons. Bulk mode processes 50 files at once and links duplicate IDs.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Checklist yang terisi sendiri', en: 'A checklist that fills itself' },
      body: { id: 'Setiap syarat dicentang begitu field-nya terbaca, jadi petugas tinggal melihat yang belum.', en: 'Each requirement is ticked as soon as its field is read, so officers only look at what is left.' },
      frame: 'centang',
    },
    {
      title: { id: 'Satu ketidakcocokan, langsung terlihat', en: 'One mismatch, seen at once' },
      body: { id: 'Nama di KK berbeda dengan KTP: ditandai merah, dan berkas masuk "Perlu Cek Manual".', en: 'The name on the family card differs from the ID card: flagged red, and the file goes to "Needs Manual Check".' },
      frame: 'beda',
    },
    {
      title: { id: '50 pendaftar bansos banjir', en: '50 flood-aid applicants' },
      body: { id: 'Mode Massal menemukan NIK ganda (3 di data simulasi) dan alamat di luar zona terdampak Siaga Wilayah.', en: 'Bulk mode finds duplicate IDs (3 in the simulated data) and addresses outside the Siaga Wilayah affected zone.' },
    },
  ],
  roles: {
    perizinan: { id: 'Memeriksa kelengkapan berkas dalam hitungan detik dan memberi alasan yang jelas ke warga.', en: 'Checks files in seconds and gives citizens a clear reason.' },
    dinsos: { id: 'Menyaring pendaftar bantuan dari NIK ganda dan alamat di luar zona.', en: 'Screens aid applicants for duplicate IDs and out-of-zone addresses.' },
  },
  relations: {
    'siaga-wilayah': { id: 'Alamat pendaftar dicek terhadap zona banjir.', en: 'Applicant addresses are checked against the flood zone.' },
    'kenal-mitra': { id: 'Mesin dokumen yang sama memverifikasi nasabah dan mitra usaha.', en: 'The same document engine verifies customers and business partners.' },
  },
  dataNote: {
    id: 'Kelurahan dan zona terdampak memakai geografi {region}. Semua dokumen adalah spesimen fiktif bertanda air; NIK dan nama tidak milik siapa pun.',
    en: 'Neighbourhoods and affected zones use {region} geography. Every document is a watermarked fictional specimen; IDs and names belong to nobody.',
  },
  faq: [
    {
      q: { id: 'Apakah dokumen saya disimpan?', en: 'Are my documents stored?' },
      a: { id: 'Demo memakai spesimen. Unggahan sendiri hanya di mode Live setelah konfirmasi, diproses lalu tidak disimpan.', en: 'The demo uses specimens. Your own upload is only in Live mode after confirming, processed and not stored.' },
    },
    {
      q: { id: 'Apakah keputusan akhir dibuat AI?', en: 'Does the AI make the final decision?' },
      a: { id: 'Tidak. Cek Berkas memberi status dan alasan; petugas yang memutuskan.', en: 'No. Cek Berkas gives a status and reasons; the officer decides.' },
    },
    {
      q: { id: 'Jenis dokumen apa yang bisa diperiksa?', en: 'Which document types can be checked?' },
      a: { id: 'Demo memuat KTP, KK, NIB, surat domisili, dan foto rumah. Jenis lain disesuaikan dengan layanan Anda.', en: 'The demo holds ID cards, family cards, business IDs, domicile letters and house photos. Other types are fitted to your services.' },
    },
    {
      q: { id: 'Bisakah hasilnya diekspor?', en: 'Can results be exported?' },
      a: { id: 'Bisa. Hasil mode Massal bisa diekspor sebagai CSV.', en: 'Yes. Bulk-mode results can be exported as CSV.' },
    },
  ],
  miniCaption: [
    { id: 'Berkas spesimen diunggah', en: 'A specimen file is uploaded' },
    { id: 'Field dibaca dengan OCR', en: 'Fields are read with OCR' },
    { id: 'Syarat dicentang satu per satu', en: 'Requirements ticked one by one' },
    { id: 'Satu ketidakcocokan ditemukan', en: 'One mismatch found' },
  ],
}
