/**
 * Hand-written content for the Bojonegoro pack — NOT official data.
 *  - opd: common Indonesian local-government nomenclature (Permendagri 90/2019 style), not a copy of the
 *    Pemkab Bojonegoro SOTK; officials are never named.
 *  - services: "ringkasan umum" of typical national requirements (UU 24/2013 Adminduk, PP 5/2021 OSS-RBA,
 *    PP 16/2021 PBG …). A demo must say "ringkasan umum, cek ketentuan resmi".
 *  - languages.samples: written for the demo in Basa Jawa (dialek Bojonegoroan/Jawa Timuran, ngoko + krama),
 *    with ID + EN translations. Fictional complaints; place names are real.
 */

export const KELURAHAN = new Set(
  // Kec. Bojonegoro: 11 kelurahan (the other 7 are desa) — id.wikipedia.org/wiki/Bojonegoro,_Bojonegoro
  ['Banjarejo', 'Jetak', 'Kadipaten', 'Karang Pacar', 'Kepatihan', 'Klangon', 'Ledok Kulon', 'Ledok Wetan', 'Mojo Kampung', 'Ngrowo', 'Sumbang'],
)

export const OPD = [
  { id: 'bappeda', name: 'Badan Perencanaan Pembangunan Daerah', short: 'Bappeda' },
  { id: 'inspektorat', name: 'Inspektorat Daerah', short: 'Inspektorat' },
  { id: 'pupr', name: 'Dinas Pekerjaan Umum dan Penataan Ruang', short: 'Dinas PUPR' },
  { id: 'perkim', name: 'Dinas Perumahan, Kawasan Permukiman dan Pertanahan', short: 'Disperkim' },
  { id: 'bpbd', name: 'Badan Penanggulangan Bencana Daerah', short: 'BPBD' },
  { id: 'disdukcapil', name: 'Dinas Kependudukan dan Pencatatan Sipil', short: 'Disdukcapil' },
  { id: 'dpmptsp', name: 'Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu', short: 'DPMPTSP' },
  { id: 'bapenda', name: 'Badan Pendapatan Daerah', short: 'Bapenda' },
  { id: 'dinsos', name: 'Dinas Sosial', short: 'Dinsos' },
  { id: 'dinkes', name: 'Dinas Kesehatan', short: 'Dinkes' },
  { id: 'disdik', name: 'Dinas Pendidikan', short: 'Disdik' },
  { id: 'dlh', name: 'Dinas Lingkungan Hidup', short: 'DLH' },
  { id: 'dishub', name: 'Dinas Perhubungan', short: 'Dishub' },
  { id: 'diskominfo', name: 'Dinas Komunikasi dan Informatika', short: 'Diskominfo' },
  { id: 'disperindag', name: 'Dinas Perdagangan dan Perindustrian', short: 'Disperindag' },
  { id: 'diskopumkm', name: 'Dinas Koperasi dan Usaha Mikro', short: 'Dinas Koperasi & UMKM' },
  { id: 'distan', name: 'Dinas Pertanian', short: 'Distan' },
  { id: 'satpolpp', name: 'Satuan Polisi Pamong Praja', short: 'Satpol PP' },
  { id: 'ukpbj', name: 'Bagian Pengadaan Barang/Jasa (UKPBJ) Sekretariat Daerah', short: 'Bagian PBJ' },
  { id: 'perumda-am', name: 'Perusahaan Umum Daerah Air Minum', short: 'Perumda Air Minum' },
  { id: 'kecamatan', name: 'Kecamatan (Pelayanan Administrasi Terpadu Kecamatan)', short: 'PATEN Kecamatan' },
]

const b = (id, en) => ({ id, en })
const FREE = b('Gratis (tidak dipungut biaya)', 'Free of charge')

export const SERVICES = [
  {
    id: 'ktp-el', name: b('KTP elektronik (baru / rusak / hilang)', 'Electronic ID card (new / damaged / lost)'),
    requirements: [b('Fotokopi Kartu Keluarga', 'Copy of the family card (KK)'), b('Berusia 17 tahun / sudah atau pernah kawin', 'Aged 17 or married / previously married'), b('KTP-el rusak, atau surat kehilangan dari kepolisian', 'Damaged card, or a police loss report'), b('Perekaman biometrik bila belum pernah', 'Biometric capture if never recorded')],
    slaDays: 1, channel: 'mpp', opdId: 'disdukcapil', fee: FREE,
  },
  {
    id: 'kk', name: b('Kartu Keluarga (baru / perubahan data)', 'Family card (new / data change)'),
    requirements: [b('Buku nikah / akta perkawinan atau akta cerai', 'Marriage or divorce certificate'), b('KK lama bila perubahan', 'Old family card for changes'), b('Surat keterangan pindah bila pendatang', 'Moving-out letter for newcomers'), b('Formulir F-1.01 biodata keluarga', 'Form F-1.01 family biodata')],
    slaDays: 1, channel: 'online', opdId: 'disdukcapil', fee: FREE,
  },
  {
    id: 'akta-lahir', name: b('Akta kelahiran', 'Birth certificate'),
    requirements: [b('Surat keterangan lahir dari bidan / rumah sakit', 'Birth note from midwife / hospital'), b('KK dan KTP-el orang tua', 'Parents\' family card and ID cards'), b('Buku nikah orang tua (atau SPTJM)', 'Parents\' marriage book (or a signed statement, SPTJM)'), b('KTP-el dua orang saksi', 'ID cards of two witnesses')],
    slaDays: 1, channel: 'online', opdId: 'disdukcapil', fee: FREE,
  },
  {
    id: 'akta-kematian', name: b('Akta kematian', 'Death certificate'),
    requirements: [b('Surat keterangan kematian dari desa / rumah sakit', 'Death note from the village / hospital'), b('KK dan KTP-el almarhum', 'Family card and ID card of the deceased'), b('KTP-el pelapor', 'Reporter\'s ID card')],
    slaDays: 1, channel: 'kecamatan', opdId: 'disdukcapil', fee: FREE,
  },
  {
    id: 'pindah-datang', name: b('Surat pindah datang (SKPWNI)', 'Change-of-residence letter (SKPWNI)'),
    requirements: [b('KK dan KTP-el', 'Family card and ID card'), b('Alamat tujuan lengkap', 'Full destination address'), b('Formulir F-1.03 pindah datang', 'Form F-1.03 relocation')],
    slaDays: 1, channel: 'online', opdId: 'disdukcapil', fee: FREE,
  },
  {
    id: 'nib-oss', name: b('Nomor Induk Berusaha (NIB) lewat OSS', 'Business ID number (NIB) via OSS'),
    requirements: [b('NIK / KTP-el pemilik', 'Owner\'s ID number'), b('NPWP (bila ada)', 'Tax ID (if any)'), b('Alamat dan bidang usaha (KBLI)', 'Business address and line of business (KBLI)'), b('Akun OSS RBA', 'OSS RBA account')],
    slaDays: 1, channel: 'online', opdId: 'dpmptsp', fee: FREE,
  },
  {
    id: 'izin-usaha-mikro', name: b('Pendampingan izin usaha mikro (NIB + sertifikat standar)', 'Micro-business licence assistance (NIB + standard certificate)'),
    requirements: [b('KTP-el pemilik', 'Owner\'s ID card'), b('Foto tempat usaha', 'Photo of the business premises'), b('Surat keterangan usaha dari desa (bila diminta)', 'Village business letter (if requested)')],
    slaDays: 3, channel: 'mpp', opdId: 'diskopumkm', fee: FREE,
  },
  {
    id: 'pbg', name: b('Persetujuan Bangunan Gedung (PBG)', 'Building approval (PBG)'),
    requirements: [b('Bukti kepemilikan tanah (sertifikat)', 'Proof of land ownership'), b('Gambar arsitektur dan struktur', 'Architectural and structural drawings'), b('KKPR / informasi tata ruang', 'Spatial-planning conformity (KKPR)'), b('Pengajuan lewat SIMBG', 'Submission via SIMBG')],
    slaDays: 28, channel: 'online', opdId: 'pupr', fee: b('Retribusi PBG sesuai perda', 'PBG levy per local regulation'),
  },
  {
    id: 'pbb', name: b('Layanan PBB-P2 (cetak SPPT, keberatan, mutasi)', 'Land & building tax (SPPT print, objection, transfer)'),
    requirements: [b('SPPT tahun terakhir', 'Latest tax notice (SPPT)'), b('KTP-el wajib pajak', 'Taxpayer\'s ID card'), b('Bukti kepemilikan / jual beli untuk mutasi', 'Ownership / sale deed for a transfer')],
    slaDays: 5, channel: 'mpp', opdId: 'bapenda', fee: b('Sesuai ketetapan pajak', 'As assessed'),
  },
  {
    id: 'pbi-jkn', name: b('Pendaftaran JKN PBI daerah (BPJS ditanggung pemda)', 'Regionally funded JKN (BPJS) enrolment'),
    requirements: [b('KK dan KTP-el', 'Family card and ID card'), b('Terdata di DTSEN / rekomendasi desa', 'Listed in the social registry / village recommendation'), b('Surat keterangan tidak mampu bila diminta', 'Low-income letter if requested')],
    slaDays: 14, channel: 'dinas', opdId: 'dinsos', fee: FREE,
  },
  {
    id: 'cek-bansos', name: b('Cek status penerima bansos', 'Social-assistance status check'),
    requirements: [b('NIK dan nama sesuai KTP-el', 'ID number and name as on the ID card'), b('Wilayah domisili', 'Area of residence')],
    slaDays: 1, channel: 'online', opdId: 'dinsos', fee: FREE,
  },
  {
    id: 'reklame', name: b('Izin & pajak reklame', 'Billboard permit & tax'),
    requirements: [b('Desain dan ukuran reklame', 'Billboard design and size'), b('Titik lokasi dan izin pemilik lahan', 'Location and landowner consent'), b('NIB / identitas pemohon', 'Business ID / applicant ID')],
    slaDays: 5, channel: 'mpp', opdId: 'dpmptsp', fee: b('Pajak reklame sesuai perda', 'Billboard tax per local regulation'),
  },
  {
    id: 'rekom-keramaian', name: b('Rekomendasi izin keramaian (pengantar ke Polres)', 'Public-event recommendation (for the police permit)'),
    requirements: [b('Surat permohonan dan susunan acara', 'Request letter and event programme'), b('Pengantar desa / kelurahan', 'Village / kelurahan cover letter'), b('KTP-el penanggung jawab', 'ID card of the person in charge')],
    slaDays: 3, channel: 'kecamatan', opdId: 'kecamatan', fee: FREE,
  },
  {
    id: 'pengantar-skck', name: b('Surat pengantar SKCK', 'Cover letter for a police clearance (SKCK)'),
    requirements: [b('Pengantar RT/RW dan desa', 'Neighbourhood and village cover letters'), b('KTP-el dan KK', 'ID card and family card'), b('Pas foto 4×6 latar merah', '4×6 photo, red background')],
    slaDays: 1, channel: 'kecamatan', opdId: 'kecamatan', fee: FREE,
  },
  {
    id: 'sambungan-air', name: b('Pasang baru sambungan air minum', 'New piped-water connection'),
    requirements: [b('KTP-el dan KK', 'ID card and family card'), b('Denah lokasi rumah', 'House location sketch'), b('Rekening listrik / bukti alamat', 'Utility bill / proof of address')],
    slaDays: 14, channel: 'dinas', opdId: 'perumda-am', fee: b('Biaya pasang sesuai tarif Perumda', 'Connection fee per utility tariff'),
  },
  {
    id: 'aduan-pju', name: b('Perbaikan penerangan jalan umum (PJU)', 'Street-light repair'),
    requirements: [b('Lokasi titik lampu (foto + peta)', 'Light-pole location (photo + map)'), b('Kontak pelapor', 'Reporter contact')],
    slaDays: 7, channel: 'online', opdId: 'dishub', fee: FREE,
  },
]

const g = (text, id, en) => ({ lang: 'jv', text, id, en })
export const GREETINGS = [
  g('Sugeng enjing, Lur. Wonten ingkang saged kula biyantu?', 'Selamat pagi, Saudara. Ada yang bisa saya bantu?', 'Good morning. How can I help you?'),
  g('Kulanuwun, kula badhe lapor.', 'Permisi, saya mau melapor.', 'Excuse me, I would like to file a report.'),
  g('Piye kabare, Lur? Ana sing isa dibantu?', 'Apa kabar, Saudara? Ada yang bisa dibantu?', 'How are you? Is there anything we can help with?'),
  g('Matur nuwun sanget, laporan panjenengan sampun kacathet.', 'Terima kasih banyak, laporan Anda sudah tercatat.', 'Thank you very much, your report has been recorded.'),
  g('Sugeng rawuh ing layanan warga Bojonegoro.', 'Selamat datang di layanan warga Bojonegoro.', 'Welcome to the Bojonegoro citizen service.'),
]

const t = (id, category, urgency, text, tid, ten) => ({ id, lang: 'jv', category, text, translation: { id: tid, en: ten }, urgency })
export const COMPLAINTS = [
  t('banjir-ledok', 'banjir', 'tinggi',
    'Lur, banyu Bengawan wis mlebu omah nang Ledok Kulon, dhuwure wis sepinggang. Wong tuwa karo bocah cilik kudu dievakuasi saiki, tulung kirim perahu karet.',
    'Saudara, air Bengawan Solo sudah masuk rumah di Ledok Kulon, tingginya sudah sepinggang. Lansia dan anak kecil harus dievakuasi sekarang, tolong kirim perahu karet.',
    'The Bengawan Solo has flooded homes in Ledok Kulon, water is waist-high. The elderly and small children must be evacuated now, please send a rubber boat.'),
  t('banjir-kanor', 'banjir', 'sedang',
    'Nyuwun sewu, toya Bengawan Solo sampun minggah, sabin kaliyan margi desa ing Kanor sampun kebanjiran. Menawi mangke dalu jawah malih, griyanipun warga saged kelebetan toya. Nyuwun dipun pantau.',
    'Mohon maaf, air Bengawan Solo sudah naik, sawah dan jalan desa di Kanor sudah tergenang. Kalau nanti malam hujan lagi, rumah warga bisa kemasukan air. Mohon dipantau.',
    'Excuse me, the Bengawan Solo is rising and the rice fields and village road in Kanor are flooded. If it rains again tonight, water could enter people\'s homes. Please monitor it.'),
  t('banjir-tanggul', 'banjir', 'tinggi',
    'Tanggule kali nang mburi balai desa bocor, banyune mrembes terus. Yen ora ndang ditambal, sak kampung isa kebanjiran bengi iki.',
    'Tanggul sungai di belakang balai desa bocor, airnya merembes terus. Kalau tidak segera ditambal, satu kampung bisa kebanjiran malam ini.',
    'The river embankment behind the village hall is leaking and water keeps seeping through. If it is not patched soon, the whole hamlet could flood tonight.'),
  t('banjir-pasca', 'banjir', 'sedang',
    'Banjir wis telung dina durung asat, sumure warga butheg kabeh. Butuh banyu resik karo obat-obatan, utamane kanggo bocah lan wong tuwa.',
    'Banjir sudah tiga hari belum surut, sumur warga keruh semua. Butuh air bersih dan obat-obatan, terutama untuk anak-anak dan lansia.',
    'The flood has not receded for three days and all the wells are muddy. We need clean water and medicine, especially for children and the elderly.'),
  t('jalan-dander', 'jalan-rusak', 'sedang',
    'Dalan saka Dander menyang kutha bolong-bolong gedhe, wis akeh sing tiba montore. Nek udan, bolongane ketutup banyu dadi ora ketok. Tulung ndang didandani.',
    'Jalan dari Dander ke kota berlubang-lubang besar, sudah banyak pengendara motor yang jatuh. Kalau hujan, lubangnya tertutup air jadi tidak kelihatan. Tolong segera diperbaiki.',
    'The road from Dander into town is full of big potholes and many motorcyclists have fallen. When it rains the holes fill with water and cannot be seen. Please repair it soon.'),
  t('jalan-kedungadem', 'jalan-rusak', 'rendah',
    'Kula badhe matur, margi wonten Kedungadem sampun rusak awrat, truk ingkang ngangkut tebu asring kandheg. Nyuwun dipun dandosi saderengipun mangsa rendheng.',
    'Saya ingin menyampaikan, jalan di Kedungadem sudah rusak berat, truk pengangkut tebu sering terhenti. Mohon diperbaiki sebelum musim hujan.',
    'I would like to report that the road in Kedungadem is badly damaged and sugar-cane trucks often get stuck. Please repair it before the rainy season.'),
  t('sampah-pasar', 'sampah', 'sedang',
    'Sampah nang pinggir dalan cedhak pasar wis numpuk seminggu ora diangkut, ambune ora karuan lan akeh laler. Nek udan, sampahe keli mlebu got.',
    'Sampah di pinggir jalan dekat pasar sudah menumpuk seminggu tidak diangkut, baunya tidak karuan dan banyak lalat. Kalau hujan, sampahnya hanyut masuk selokan.',
    'Rubbish by the road near the market has piled up for a week without collection; it stinks and draws flies. When it rains it washes into the drains.'),
  t('pju-mati', 'pju', 'rendah',
    'Lampu dalan nang prapatan desa mati wis rong minggu, bengi peteng ndhedhet. Akeh sing wedi liwat, kuwatir ana maling.',
    'Lampu jalan di perempatan desa mati sudah dua minggu, malam gelap gulita. Banyak yang takut lewat, khawatir ada pencuri.',
    'The street light at the village crossroads has been out for two weeks and it is pitch dark at night. People are afraid to pass, worried about thieves.'),
  t('air-pdam', 'air-bersih', 'sedang',
    'Banyu PDAM nang omahku wis telung dina ora mili, nek mili ya mung bengi lan butheg. Tulung dicek pipane.',
    'Air PDAM di rumah saya sudah tiga hari tidak mengalir, kalaupun mengalir hanya malam hari dan keruh. Tolong dicek pipanya.',
    'The piped water at my house has not run for three days; when it does, only at night and muddy. Please check the pipes.'),
  t('pohon-tumbang', 'pohon-tumbang', 'tinggi',
    'Wit asem gedhe nang pinggir dalan ambruk kena angin, nutupi dalan lan kabel listrik pedhot. Montor ora isa liwat babar pisan.',
    'Pohon asam besar di pinggir jalan tumbang diterjang angin, menutup jalan dan kabel listrik putus. Kendaraan sama sekali tidak bisa lewat.',
    'A big tamarind tree by the road was blown down, blocking the road and snapping the power line. Vehicles cannot get through at all.'),
  t('pungli-desa', 'pungli', 'sedang',
    'Nyuwun pirsa, Pak. Nalika ngurus surat pindah wonten kantor desa, kula dipunsuwuni arta satus seket ewu tanpa kuitansi. Menapa pancen wonten biayanipun?',
    'Mohon tanya, Pak. Waktu mengurus surat pindah di kantor desa, saya dimintai uang seratus lima puluh ribu tanpa kuitansi. Apakah memang ada biayanya?',
    'May I ask, Sir: when I processed a moving letter at the village office I was asked for 150,000 rupiah without a receipt. Is there really a fee?'),
  t('puskesmas-antre', 'kesehatan', 'sedang',
    'Puskesmas nang kecamatan antrine dawa banget, dokter mung siji. Anakku panas wis telung dina, esuk nganti awan durung kebagian.',
    'Puskesmas di kecamatan antreannya panjang sekali, dokternya hanya satu. Anak saya demam sudah tiga hari, dari pagi sampai siang belum dapat giliran.',
    'The queue at the sub-district health centre is very long and there is only one doctor. My child has had a fever for three days and has waited from morning to noon without being seen.'),
  t('dbd-rt', 'kesehatan', 'tinggi',
    'Nang RT kene wis ana bocah telu kena demam berdarah sak minggu iki. Tulung difogging lan dipriksa jentike.',
    'Di RT sini sudah ada tiga anak kena demam berdarah minggu ini. Tolong dilakukan fogging dan pemeriksaan jentik.',
    'Three children in our neighbourhood have caught dengue this week. Please carry out fogging and a larva check.'),
  t('ktp-belum-jadi', 'adminduk', 'rendah',
    'Kula sampun ngurus KTP-el wiwit kalih wulan kepengker, ngantos sakmenika dereng dados, jarene blangkonipun telas. Nyuwun pirsa kapan saged dipundhut?',
    'Saya sudah mengurus KTP-el sejak dua bulan lalu, sampai sekarang belum jadi, katanya blankonya habis. Mohon info kapan bisa diambil?',
    'I applied for my e-ID two months ago and it is still not ready; they say the blank cards ran out. When can I collect it?'),
  t('bansos-hilang', 'bansos', 'sedang',
    'Mbahku wis tuwa lan urip dhewe, kok jenenge ilang saka daftar bansos sasi iki. Padahal sasi wingi isih entuk. Tulung dicek, Lur.',
    'Nenek saya sudah tua dan hidup sendiri, kok namanya hilang dari daftar bansos bulan ini. Padahal bulan lalu masih dapat. Tolong dicek, Saudara.',
    'My grandmother is old and lives alone, yet her name has disappeared from this month\'s social-assistance list although she received it last month. Please check.'),
  t('sekolah-atap', 'sekolah', 'tinggi',
    'Atap kelas SD nang desaku bocor lan kayune wis growong, bocah-bocah wedi nek udan deres. Mbok ndang didandani sadurunge ambruk.',
    'Atap kelas SD di desa saya bocor dan kayunya sudah keropos, anak-anak takut kalau hujan deras. Tolong segera diperbaiki sebelum roboh.',
    'The primary-school classroom roof in my village leaks and the timber is rotten; the children are scared in heavy rain. Please fix it before it collapses.'),
  t('jalan-ambles', 'jalan-rusak', 'tinggi',
    'Dalan cor nang pinggir kali ambles separo, retake saya amba. Nek ana truk liwat isa ambrol. Nyuwun enggal dipasangi tandha bahaya.',
    'Jalan cor di pinggir sungai amblas separuh, retakannya makin lebar. Kalau ada truk lewat bisa ambrol. Mohon segera dipasang tanda bahaya.',
    'The concrete road along the river has half subsided and the crack keeps widening; it could collapse under a truck. Please put up warning signs urgently.'),
]
