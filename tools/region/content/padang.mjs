/**
 * Hand-written content for the Kota Padang pack — NOT official data.
 *  - opd: common Indonesian local-government nomenclature for a kota (Permendagri 90/2019 style), not a copy of
 *    the Pemkot Padang SOTK; officials are never named (titles only: Wali Kota, Camat, Lurah, Kepala BPBD).
 *  - services: the same "ringkasan umum" of national requirements as Bojonegoro (UU 24/2013 Adminduk, PP 5/2021
 *    OSS-RBA, PP 16/2021 PBG …), reworded for a kota: kelurahan instead of desa. A demo must say "ringkasan umum,
 *    cek ketentuan resmi".
 *  - languages.samples: CONTOH written by the GAMADA team in Baso Minang (dialek Padang, register sehari-hari),
 *    with ID + EN translations, not yet checked by a native speaker (tahap7-plan §7 Q1). Fictional complaints;
 *    place names are real (HDX kelurahan, OSM rivers).
 */
import { SERVICES as BASE_SERVICES } from './bojonegoro.mjs'

export const OPD = [
  { id: 'bappeda', name: 'Badan Perencanaan Pembangunan Daerah', short: 'Bappeda' },
  { id: 'inspektorat', name: 'Inspektorat Daerah', short: 'Inspektorat' },
  { id: 'pupr', name: 'Dinas Pekerjaan Umum dan Penataan Ruang', short: 'Dinas PUPR' },
  { id: 'perkim', name: 'Dinas Perumahan Rakyat dan Kawasan Permukiman', short: 'Disperkim' },
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
  { id: 'disperdag', name: 'Dinas Perdagangan', short: 'Disdag' },
  { id: 'diskopumkm', name: 'Dinas Koperasi dan Usaha Mikro', short: 'Dinas Koperasi & UMKM' },
  { id: 'dkp', name: 'Dinas Kelautan dan Perikanan', short: 'DKP' },
  { id: 'distan', name: 'Dinas Pertanian', short: 'Distan' },
  { id: 'satpolpp', name: 'Satuan Polisi Pamong Praja', short: 'Satpol PP' },
  { id: 'ukpbj', name: 'Bagian Pengadaan Barang/Jasa (UKPBJ) Sekretariat Daerah', short: 'Bagian PBJ' },
  { id: 'perumda-am', name: 'Perusahaan Umum Daerah Air Minum', short: 'Perumda Air Minum' },
  { id: 'kecamatan', name: 'Kecamatan (Pelayanan Administrasi Terpadu Kecamatan)', short: 'PATEN Kecamatan' },
]

const b = (id, en) => ({ id, en })

/** kota wording: a kota has kelurahan, not desa (ID + EN replacements, applied to every requirement / name) */
const KOTA_WORDS = [
  [/dari desa \/ rumah sakit/g, 'dari kelurahan / rumah sakit'],
  [/rekomendasi desa/g, 'rekomendasi kelurahan'],
  [/dari desa \(bila diminta\)/g, 'dari kelurahan (bila diminta)'],
  [/Pengantar desa \/ kelurahan/g, 'Pengantar kelurahan'],
  [/Pengantar RT\/RW dan desa/g, 'Pengantar RT/RW dan kelurahan'],
  [/the village \/ hospital/g, 'the kelurahan office / hospital'],
  [/village recommendation/g, 'kelurahan recommendation'],
  [/Village business letter/g, 'Kelurahan business letter'],
  [/Village \/ kelurahan cover letter/g, 'Kelurahan cover letter'],
  [/Neighbourhood and village cover letters/g, 'Neighbourhood (RT/RW) and kelurahan cover letters'],
]
const kota = (s) => KOTA_WORDS.reduce((acc, [re, to]) => acc.replace(re, to), s)
const kotaBi = (x) => b(kota(x.id), kota(x.en))

/** Padang-specific services on top of the national list (coastal city: fishers, port area) */
const EXTRA = [
  {
    id: 'kartu-nelayan', name: b('Kartu pelaku usaha kelautan dan perikanan (Kusuka) untuk nelayan', 'Marine and fisheries business card (Kusuka) for fishers'),
    requirements: [b('KTP-el dan KK', 'ID card and family card'), b('Pas foto terbaru', 'Recent photo'), b('Surat keterangan nelayan dari kelurahan / kelompok nelayan', 'Fisher letter from the kelurahan / fishers\' group')],
    slaDays: 7, channel: 'dinas', opdId: 'dkp', fee: b('Gratis (tidak dipungut biaya)', 'Free of charge'),
  },
]

/** ≥ 14 services. `hasMpp`: a Mal Pelayanan Publik is mapped in OSM inside the city; otherwise the `mpp`
 *  channel falls back to the counter of the dinas (no MPP is claimed that the data does not show). */
export function servicesFor({ hasMpp }) {
  return [...BASE_SERVICES, ...EXTRA].map((s) => ({
    ...s,
    name: kotaBi(s.name),
    requirements: s.requirements.map(kotaBi),
    fee: kotaBi(s.fee),
    channel: s.channel === 'mpp' && !hasMpp ? 'dinas' : s.channel,
  }))
}

const g = (text, id, en) => ({ lang: 'min', text, id, en })
export const GREETINGS = [
  g('Assalamualaikum, Sanak. Baa kaba? Ado nan bisa awak bantu?', 'Assalamualaikum, Saudara. Apa kabar? Ada yang bisa kami bantu?', 'Peace be upon you. How are you? Is there anything we can help with?'),
  g('Mohon maaf, Da. Ambo nio malapor.', 'Permisi, Bang. Saya mau melapor.', 'Excuse me, I would like to file a report.'),
  g('Salamaik pagi, Uni. Ado nan bisa dibantu?', 'Selamat pagi, Kak. Ada yang bisa dibantu?', 'Good morning. Is there anything we can help with?'),
  g('Tarimo kasih banyak, laporan Sanak alah tacatat.', 'Terima kasih banyak, laporan Saudara sudah tercatat.', 'Thank you very much, your report has been recorded.'),
  g('Salamaik datang di layanan warga Kota Padang.', 'Selamat datang di layanan warga Kota Padang.', 'Welcome to the Kota Padang citizen service.'),
]

const t = (id, category, urgency, text, tid, ten) => ({ id, lang: 'min', category, text, translation: { id: tid, en: ten }, urgency })
export const COMPLAINTS = [
  t('banjir-kalumbuk', 'banjir', 'tinggi',
    'Da, aia Batang Kuranji alah masuak rumah di Kalumbuk, tingginyo alah sapinggang. Urang gaek jo anak-anak harus diungsian kini, tolong kirim parahu karet.',
    'Bang, air Batang Kuranji sudah masuk rumah di Kalumbuk, tingginya sudah sepinggang. Lansia dan anak-anak harus diungsikan sekarang, tolong kirim perahu karet.',
    'The Batang Kuranji has flooded homes in Kalumbuk and the water is waist-high. The elderly and children must be evacuated now, please send a rubber boat.'),
  t('banjir-kandis', 'banjir', 'sedang',
    'Mohon maaf, aia Batang Kandis alah naiak, sawah jo jalan di Batang Kabung alah tagenang. Kok hujan baliak malam ko, rumah warga bisa kamasuakan aia. Tolong dipantau.',
    'Mohon maaf, air Batang Kandis sudah naik, sawah dan jalan di Batang Kabung sudah tergenang. Kalau hujan lagi malam ini, rumah warga bisa kemasukan air. Mohon dipantau.',
    'Excuse me, the Batang Kandis is rising and the rice fields and road in Batang Kabung are flooded. If it rains again tonight, water could enter people\'s homes. Please monitor it.'),
  t('banjir-tanggua', 'banjir', 'tinggi',
    'Tanggua batang aia di balakang musajik bocor, aianyo marembeh taruih. Kok indak capek ditambal, sakampuang bisa kabanjiran malam ko.',
    'Tanggul sungai di belakang masjid bocor, airnya merembes terus. Kalau tidak segera ditambal, satu kampung bisa kebanjiran malam ini.',
    'The river embankment behind the mosque is leaking and water keeps seeping through. If it is not patched soon, the whole neighbourhood could flood tonight.'),
  t('banjir-banda', 'banjir', 'sedang',
    'Banda di Ulak Karang sumbek, satiok hujan labek jalan tagenang sampai ka lutuik. Tolong dikuruak bandanyo.',
    'Selokan di Ulak Karang tersumbat, setiap hujan lebat jalan tergenang sampai lutut. Tolong selokannya dikeruk.',
    'The drain in Ulak Karang is blocked; every heavy rain floods the road knee-deep. Please dredge the drain.'),
  t('banjir-pasca', 'banjir', 'sedang',
    'Banjia alah tigo hari alun suruik, sumua warga karuah sadonyo. Paralu aia barasiah jo ubek-ubek, utamonyo untuak anak-anak jo urang gaek.',
    'Banjir sudah tiga hari belum surut, sumur warga keruh semua. Butuh air bersih dan obat-obatan, terutama untuk anak-anak dan lansia.',
    'The flood has not receded for three days and all the wells are muddy. We need clean water and medicine, especially for children and the elderly.'),
  t('jalan-indarung', 'jalan-rusak', 'sedang',
    'Jalan ka Lubuk Kilangan baluang-baluang gadang, alah banyak urang jatuah dari onda. Kok hujan, lubangnyo tatutuik aia jadi indak nampak. Tolong capek diparbaiki.',
    'Jalan ke Lubuk Kilangan berlubang-lubang besar, sudah banyak pengendara motor yang jatuh. Kalau hujan, lubangnya tertutup air jadi tidak kelihatan. Tolong segera diperbaiki.',
    'The road to Lubuk Kilangan is full of big potholes and many motorcyclists have fallen. When it rains the holes fill with water and cannot be seen. Please repair it soon.'),
  t('jalan-pauh', 'jalan-rusak', 'rendah',
    'Ambo nio manyampaikan, jalan di Pauh alah rusak barek, truk pangangkuik pasia acok tasangkuik. Mohon diparbaiki sabalum musim hujan.',
    'Saya ingin menyampaikan, jalan di Pauh sudah rusak berat, truk pengangkut pasir sering terjebak. Mohon diperbaiki sebelum musim hujan.',
    'I would like to report that the road in Pauh is badly damaged and sand trucks often get stuck. Please repair it before the rainy season.'),
  t('sarok-pasa', 'sampah', 'sedang',
    'Sarok di tapi jalan dakek pasa alah batumpuak saminggu indak diangkuik, baunyo indak karuan jo banyak langau. Kok hujan, saroknyo hanyuik masuak banda.',
    'Sampah di pinggir jalan dekat pasar sudah menumpuk seminggu tidak diangkut, baunya tidak karuan dan banyak lalat. Kalau hujan, sampahnya hanyut masuk selokan.',
    'Rubbish by the road near the market has piled up for a week without collection; it stinks and draws flies. When it rains it washes into the drains.'),
  t('pju-mati', 'pju', 'rendah',
    'Lampu jalan di simpang ampek kampuang alah mati duo minggu, malam kalam bana. Banyak urang takuik lewat, cameh ado maliang.',
    'Lampu jalan di perempatan kampung sudah mati dua minggu, malam gelap sekali. Banyak orang takut lewat, khawatir ada pencuri.',
    'The street light at the neighbourhood crossroads has been out for two weeks and it is very dark at night. People are afraid to pass, worried about thieves.'),
  t('aia-pdam', 'air-bersih', 'sedang',
    'Aia PDAM di rumah ambo alah tigo hari indak mangalia, kok mangalia pun hanyo malam hari jo karuah. Tolong dicek pipanyo.',
    'Air PDAM di rumah saya sudah tiga hari tidak mengalir, kalaupun mengalir hanya malam hari dan keruh. Tolong dicek pipanya.',
    'The piped water at my house has not run for three days; when it does, only at night and muddy. Please check the pipes.'),
  t('kayu-tumbang', 'pohon-tumbang', 'tinggi',
    'Batang kayu gadang di tapi jalan tumbang dek angin, manutuik jalan jo kabel listrik putuih. Oto indak bisa lewat samo sakali.',
    'Pohon besar di pinggir jalan tumbang diterjang angin, menutup jalan dan kabel listrik putus. Kendaraan sama sekali tidak bisa lewat.',
    'A big tree by the road was blown down, blocking the road and snapping the power line. Vehicles cannot get through at all.'),
  t('pungli-kelurahan', 'pungli', 'sedang',
    'Mohon batanyo, Pak. Wakatu maurus surek pindah di kantua lurah, ambo dimintak pitih saratuih limo puluah ribu tanpa kuitansi. Apo memang ado biayonyo?',
    'Mohon tanya, Pak. Waktu mengurus surat pindah di kantor kelurahan, saya dimintai uang seratus lima puluh ribu tanpa kuitansi. Apakah memang ada biayanya?',
    'May I ask, Sir: when I processed a moving letter at the kelurahan office I was asked for 150,000 rupiah without a receipt. Is there really a fee?'),
  t('puskesmas-antri', 'kesehatan', 'sedang',
    'Antrian di puskesmas panjang bana, doktornyo hanyo surang. Anak ambo alah tigo hari damam, dari pagi sampai siang alun dapek giliran.',
    'Antrean di puskesmas panjang sekali, dokternya hanya satu. Anak saya demam sudah tiga hari, dari pagi sampai siang belum dapat giliran.',
    'The queue at the health centre is very long and there is only one doctor. My child has had a fever for three days and has waited from morning to noon without being seen.'),
  t('dbd-rt', 'kesehatan', 'tinggi',
    'Di RT kami alah ado tigo anak kanai damam badarah minggu ko. Tolong di-fogging jo diparikso jentiknyo.',
    'Di RT kami sudah ada tiga anak kena demam berdarah minggu ini. Tolong dilakukan fogging dan pemeriksaan jentik.',
    'Three children in our neighbourhood have caught dengue this week. Please carry out fogging and a larva check.'),
  t('ktp-alun-jadi', 'adminduk', 'rendah',
    'Ambo alah maurus KTP-el sajak duo bulan nan lalu, sampai kini alun juo jadi, kecek urang blankonyo habih. Bilo bisa diambiak?',
    'Saya sudah mengurus KTP-el sejak dua bulan lalu, sampai sekarang belum jadi, katanya blankonya habis. Kapan bisa diambil?',
    'I applied for my e-ID two months ago and it is still not ready; they say the blank cards ran out. When can I collect it?'),
  t('bansos-ilang', 'bansos', 'sedang',
    'Nenek ambo alah gaek jo hiduik surang, a sabab namonyo ilang dari daftar bansos bulan ko? Padohal bulan lalu masih dapek. Tolong dicek, Da.',
    'Nenek saya sudah tua dan hidup sendiri, kenapa namanya hilang dari daftar bansos bulan ini? Padahal bulan lalu masih dapat. Tolong dicek, Bang.',
    'My grandmother is old and lives alone, so why has her name disappeared from this month\'s social-assistance list? She received it last month. Please check.'),
  t('sakolah-atok', 'sekolah', 'tinggi',
    'Atok kelas SD di kampuang ambo bocor jo kayunyo alah lapuak, anak-anak takuik kok hujan labek. Tolong capek diparbaiki sabalum runtuah.',
    'Atap kelas SD di kampung saya bocor dan kayunya sudah lapuk, anak-anak takut kalau hujan lebat. Tolong segera diperbaiki sebelum roboh.',
    'The primary-school classroom roof in my neighbourhood leaks and the timber is rotten; the children are scared in heavy rain. Please fix it before it collapses.'),
]
