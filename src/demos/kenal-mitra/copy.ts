/** kenal-mitra — /produk/kenal-mitra page copy (Tahap 6 plan §3.1). Sources: spec §11 P11, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Nasabah, UMKM mitra, dan kandidat diverifikasi dalam satu alur, dan UMKM yang lolos langsung tampil berlencana di etalase pemda.',
    en: 'Customers, partner SMEs and candidates are verified in one flow, and SMEs that pass show up badged in the government storefront.',
  },
  problems: [
    {
      title: { id: 'Verifikasi butuh berhari-hari', en: 'Verification takes days' },
      body: { id: 'Dokumen dicek manual, alamat usaha disurvei, dan calon nasabah menunggu.', en: 'Documents are checked by hand, business addresses are visited, and applicants wait.' },
    },
    {
      title: { id: 'Data tidak saling cocok', en: 'Data does not match' },
      body: { id: 'Nama di NIB, NPWP, dan akta berbeda sedikit, dan perbedaan itu baru ketahuan belakangan.', en: 'Names on the business ID, tax ID and deed differ slightly, and it shows up late.' },
    },
    {
      title: { id: 'Ratusan CV untuk satu posisi', en: 'Hundreds of CVs for one job' },
      body: { id: 'Tim HR menyaring berkas satu per satu tanpa alasan yang tercatat.', en: 'HR screens files one by one with no recorded reasons.' },
    },
  ],
  steps: [
    {
      title: { id: 'Pilih pipeline', en: 'Pick a pipeline' },
      body: { id: 'Nasabah (KYC), Mitra/Supplier (KYB), atau Kandidat (CV), dengan mesin dokumen yang sama dengan Cek Berkas.', en: 'Customer (KYC), Partner/Supplier (KYB) or Candidate (CV), on the same document engine as Cek Berkas.' },
    },
    {
      title: { id: 'Cek dokumen dan lokasi', en: 'Check documents and location' },
      body: { id: 'Konsistensi nama dan alamat diperiksa, dan alamat usaha dicocokkan di peta daerah.', en: 'Name and address consistency is checked, and the business address is matched on the regional map.' },
    },
    {
      title: { id: 'Keputusan dengan alasan', en: 'A decision with reasons' },
      body: { id: 'Skor risiko dan rekomendasi untuk nasabah; lencana Terverifikasi untuk UMKM; shortlist berurutan untuk kandidat.', en: 'A risk score and recommendation for customers; a Verified badge for SMEs; a ranked shortlist for candidates.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Lencana di etalase pemda', en: 'A badge in the government storefront' },
      body: { id: 'UMKM baru lolos KYB, dan lencana Terverifikasi langsung tampil di Katalog Lokal.', en: 'A new SME passes KYB and the Verified badge appears in Katalog Lokal at once.' },
      frame: 'lencana',
    },
    {
      title: { id: 'Penilaian buta untuk kandidat', en: 'Blind screening for candidates' },
      body: { id: 'Sembunyikan nama dan foto, lalu lihat 10 kandidat teratas dengan alasan per orang.', en: 'Hide names and photos, then see the top 10 candidates with a reason for each.' },
      frame: 'cv',
    },
  ],
  roles: {
    'analis-kyc': { id: 'Memverifikasi nasabah, mitra, dan kandidat dari satu layar dengan alasan yang tercatat.', en: 'Verifies customers, partners and candidates from one screen with recorded reasons.' },
    'bank-mitra': { id: 'Menerima calon nasabah yang sudah terverifikasi dan skor risikonya.', en: 'Receives verified applicants with their risk score.' },
  },
  relations: {
    'katalog-lokal': { id: 'Lencana Terverifikasi tampil di etalase UMKM.', en: 'The Verified badge shows in the SME storefront.' },
    'rapor-usaha': { id: 'Status KYB ikut menaikkan skor usaha.', en: 'KYB status raises the business score.' },
    tenderpilot: { id: 'Verifikasi mencentang syarat tender vendor.', en: 'Verification ticks a vendor tender requirement.' },
    'cek-berkas': { id: 'Mesin pembaca dokumennya sama.', en: 'They share the same document reader.' },
  },
  dataNote: {
    id: 'Alamat dicocokkan di peta {region} yang sebenarnya. Semua orang, usaha, dokumen spesimen, swafoto, dan CV adalah fiktif.',
    en: 'Addresses are matched on the real map of {region}. Every person, business, specimen document, selfie and CV is fictional.',
  },
  faq: [
    {
      q: { id: 'Apakah uji liveness-nya sungguhan?', en: 'Is the liveness check real?' },
      a: { id: 'Di demo, uji liveness disimulasikan dengan instruksi dan indikator. Kamera bersifat opsional.', en: 'In the demo the liveness check is simulated with instructions and an indicator. The camera is optional.' },
    },
    {
      q: { id: 'Apakah keputusan akhir dibuat AI?', en: 'Does the AI make the final decision?' },
      a: { id: 'Tidak. Kenal Mitra memberi skor dan alasan; analis yang memutuskan.', en: 'No. Kenal Mitra gives a score and reasons; the analyst decides.' },
    },
    {
      q: { id: 'Bagaimana penilaian buta bekerja?', en: 'How does blind screening work?' },
      a: { id: 'Nama dan foto disembunyikan saat penilaian, sehingga urutan hanya berdasar kriteria yang dipilih.', en: 'Names and photos are hidden during screening, so ranking rests only on the chosen criteria.' },
    },
    {
      q: { id: 'Di mana dokumen nasabah disimpan?', en: 'Where are customer documents stored?' },
      a: { id: 'Demo hanya memakai spesimen. Penyimpanan dan server untuk pemasangan dibahas saat konsultasi.', en: 'The demo uses specimens only. Storage and servers for an installation are discussed during consultation.' },
    },
  ],
  miniCaption: [
    { id: 'Dokumen KTP dan NIB', en: 'ID card and business ID' },
    { id: 'Data dicocokkan', en: 'Data is matched' },
    { id: 'Skor kecocokan', en: 'Match score' },
    { id: 'Lencana Terverifikasi', en: 'Verified badge' },
  ],
}
