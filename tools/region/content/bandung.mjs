/**
 * Hand-written content for the Kota Bandung pack — NOT official data.
 *  - opd: common Indonesian local-government nomenclature for a kota (Permendagri 90/2019 style), not a copy of the
 *    Pemkot Bandung SOTK; officials are never named. The ids are the same as in the Bojonegoro pack, because the
 *    world simulation and the demos look OPD and services up by id.
 *  - services: the same "ringkasan umum" of national requirements as Bojonegoro (UU 24/2013 Adminduk, PP 5/2021
 *    OSS-RBA, PP 16/2021 PBG …), reworded for a kota (kelurahan instead of desa). OSM has no Mal Pelayanan Publik
 *    for Kota Bandung, so no service uses the `mpp` channel (they go to `dinas`).
 *  - languages.samples: CONTOH texts written by the GAMADA team in Basa Sunda (loma register, as warga write in a
 *    chat), with ID + EN translations. Not reviewed by a native speaker (owner decision Q1, 2026-11-19). Fictional
 *    complaints; place names are real.
 */
import { SERVICES as BASE_SERVICES } from './bojonegoro.mjs'

export const OPD = [
  { id: 'bappeda', name: 'Badan Perencanaan Pembangunan Daerah', short: 'Bappeda' },
  { id: 'inspektorat', name: 'Inspektorat Daerah', short: 'Inspektorat' },
  { id: 'pupr', name: 'Dinas Pekerjaan Umum dan Penataan Ruang', short: 'Dinas PUPR' },
  { id: 'perkim', name: 'Dinas Perumahan dan Kawasan Permukiman', short: 'Disperkim' },
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
  { id: 'disperindag', name: 'Dinas Perdagangan dan Perindustrian', short: 'Disdagin' },
  { id: 'diskopumkm', name: 'Dinas Koperasi dan Usaha Kecil Menengah', short: 'Dinas Koperasi & UKM' },
  { id: 'distan', name: 'Dinas Ketahanan Pangan dan Pertanian', short: 'DKPP' },
  { id: 'satpolpp', name: 'Satuan Polisi Pamong Praja', short: 'Satpol PP' },
  { id: 'ukpbj', name: 'Bagian Pengadaan Barang/Jasa (UKPBJ) Sekretariat Daerah', short: 'Bagian PBJ' },
  { id: 'perumda-am', name: 'Perusahaan Umum Daerah Air Minum', short: 'Perumda Air Minum' },
  { id: 'kecamatan', name: 'Kecamatan (Pelayanan Administrasi Terpadu Kecamatan)', short: 'PATEN Kecamatan' },
]

/** desa → kelurahan wording (a kota has no desa) */
const kotaId = (s) => s.replace(/desa \/ kelurahan/g, 'kelurahan').replace(/\bdesa\b/g, 'kelurahan')
const kotaEn = (s) => s.replace(/[Vv]illage \/ kelurahan/g, 'Kelurahan').replace(/\bvillage\b/g, 'kelurahan').replace(/\bVillage\b/g, 'Kelurahan')
const bi = (x) => ({ id: kotaId(x.id), en: kotaEn(x.en) })

export const SERVICES = BASE_SERVICES.map((s) => ({
  ...s,
  name: bi(s.name),
  requirements: s.requirements.map(bi),
  channel: s.channel === 'mpp' ? 'dinas' : s.channel,
  fee: bi(s.fee),
}))

const g = (text, id, en) => ({ lang: 'su', text, id, en })
export const GREETINGS = [
  g('Wilujeng enjing, Akang, Teteh. Aya nu tiasa dibantos?', 'Selamat pagi, Bapak/Ibu. Ada yang bisa dibantu?', 'Good morning. How can we help you?'),
  g('Punten, abdi bade lapor.', 'Permisi, saya mau melapor.', 'Excuse me, I would like to file a report.'),
  g('Kumaha damang? Aya nu tiasa dibantos?', 'Apa kabar? Ada yang bisa dibantu?', 'How are you? Is there anything we can help with?'),
  g('Hatur nuhun pisan, laporan Akang/Teteh parantos kacatet.', 'Terima kasih banyak, laporan Anda sudah tercatat.', 'Thank you very much, your report has been recorded.'),
  g('Wilujeng sumping di layanan warga Kota Bandung.', 'Selamat datang di layanan warga Kota Bandung.', 'Welcome to the Bandung city citizen service.'),
]

const t = (id, category, urgency, text, tid, ten) => ({ id, lang: 'su', category, text, translation: { id: tid, en: ten }, urgency })
export const COMPLAINTS = [
  t('banjir-cileuncang', 'banjir', 'tinggi',
    'Kang, cileuncang di Bandung Kidul geus asup ka imah, jerona geus sabeuteung. Kolot jeung barudak kudu diungsikeun ayeuna, tulung kirim bantuan.',
    'Kang, genangan air (cileuncang) di Bandung Kidul sudah masuk rumah, dalamnya sudah sepinggang. Lansia dan anak-anak harus diungsikan sekarang, tolong kirim bantuan.',
    'Kang, the street flooding (cileuncang) in Bandung Kidul has entered homes and is waist-deep. The elderly and children must be evacuated now, please send help.'),
  t('banjir-cikapundung', 'banjir', 'sedang',
    'Punten, cai Cikapundung geus naek, jalan di sisi walungan di Regol geus kakeueum. Upami engke wengi hujan deui, imah warga tiasa kalebetan cai. Nyuhunkeun dipantau.',
    'Permisi, air Sungai Cikapundung sudah naik, jalan di tepi sungai di Regol sudah tergenang. Kalau nanti malam hujan lagi, rumah warga bisa kemasukan air. Mohon dipantau.',
    'Excuse me, the Cikapundung is rising and the riverside road in Regol is under water. If it rains again tonight, water could enter people\'s homes. Please monitor it.'),
  t('banjir-gorong', 'banjir', 'tinggi',
    'Gorong-gorong di hareupeun pasar mampet ku runtah, unggal hujan gede cileuncang nepi ka tuur. Lamun teu gancang dibersihan, peuting ieu bisa caah deui.',
    'Gorong-gorong di depan pasar tersumbat sampah, setiap hujan deras genangan sampai selutut. Kalau tidak segera dibersihkan, malam ini bisa banjir lagi.',
    'The culvert in front of the market is blocked with rubbish and every heavy rain floods the street knee-deep. If it is not cleared soon, it could flood again tonight.'),
  t('banjir-pasca', 'banjir', 'sedang',
    'Caah geus tilu poe can saat, sumur warga kiruh kabeh. Butuh cai beresih jeung ubar, utamana keur barudak jeung kolot.',
    'Banjir sudah tiga hari belum surut, sumur warga keruh semua. Butuh air bersih dan obat-obatan, terutama untuk anak-anak dan lansia.',
    'The flood has not receded for three days and all the wells are muddy. We need clean water and medicine, especially for children and the elderly.'),
  t('jalan-gedebage', 'jalan-rusak', 'sedang',
    'Jalan di Gedebage loba nu bolong gede, geus loba nu tikusruk naek motor. Mun hujan, liangna katutupan cai jadi teu katempo. Tulung gancang dioméan.',
    'Jalan di Gedebage banyak lubang besar, sudah banyak pengendara motor yang jatuh. Kalau hujan, lubangnya tertutup air jadi tidak kelihatan. Tolong segera diperbaiki.',
    'The road in Gedebage is full of big potholes and many motorcyclists have fallen. When it rains the holes fill with water and cannot be seen. Please repair it soon.'),
  t('jalan-ambles', 'jalan-rusak', 'tinggi',
    'Jalan di sisi walungan Cikapundung di Coblong amblas satengahna, rekahna beuki lega. Mun aya mobil gede ngaliwat bisa runtuh. Tulung gancang dipasangan tanda bahaya.',
    'Jalan di tepi Sungai Cikapundung di Coblong amblas separuh, retakannya makin lebar. Kalau ada kendaraan besar lewat bisa runtuh. Tolong segera dipasang tanda bahaya.',
    'The road along the Cikapundung in Coblong has half subsided and the crack keeps widening; it could collapse under a heavy vehicle. Please put up warning signs urgently.'),
  t('sampah-pasar', 'sampah', 'sedang',
    'Runtah di sisi jalan deukeut pasar geus numpuk saminggu teu diangkut, bauna teu kaampeuh jeung loba laleur. Mun hujan, runtahna palid ka solokan.',
    'Sampah di pinggir jalan dekat pasar sudah menumpuk seminggu tidak diangkut, baunya tidak tertahankan dan banyak lalat. Kalau hujan, sampahnya hanyut ke selokan.',
    'Rubbish by the road near the market has piled up for a week without collection; it stinks and draws flies. When it rains it washes into the drains.'),
  t('pju-mati', 'pju', 'rendah',
    'Lampu jalan di parapatan gang geus paeh dua minggu, peuting poek mongkleng. Loba nu sieun ngaliwat, hariwang aya maling.',
    'Lampu jalan di perempatan gang sudah mati dua minggu, malam gelap gulita. Banyak yang takut lewat, khawatir ada pencuri.',
    'The street light at the alley crossing has been out for two weeks and it is pitch dark at night. People are afraid to pass, worried about thieves.'),
  t('air-pdam', 'air-bersih', 'sedang',
    'Cai PDAM di imah abdi geus tilu poe teu ngocor, sakalina ngocor ngan peuting jeung kiruh. Tulung pipana dipariksa.',
    'Air PDAM di rumah saya sudah tiga hari tidak mengalir, sekalinya mengalir hanya malam hari dan keruh. Tolong pipanya dicek.',
    'The piped water at my house has not run for three days; when it does, only at night and muddy. Please check the pipes.'),
  t('pohon-tumbang', 'pohon-tumbang', 'tinggi',
    'Tangkal gede di sisi jalan rubuh katebak angin, nutupan jalan jeung kabel listrik pegat. Kendaraan teu bisa ngaliwat pisan.',
    'Pohon besar di pinggir jalan tumbang diterjang angin, menutup jalan dan kabel listrik putus. Kendaraan sama sekali tidak bisa lewat.',
    'A big tree by the road was blown down, blocking the road and snapping the power line. Vehicles cannot get through at all.'),
  t('pungli-kelurahan', 'pungli', 'sedang',
    'Punten, Pak. Waktu ngurus surat pindah di kantor kelurahan, abdi dipenta duit saratus lima puluh rebu tanpa kuitansi. Naha leres aya biayana?',
    'Permisi, Pak. Waktu mengurus surat pindah di kantor kelurahan, saya dimintai uang seratus lima puluh ribu tanpa kuitansi. Apakah memang ada biayanya?',
    'Excuse me, Sir: when I processed a moving letter at the kelurahan office I was asked for 150,000 rupiah without a receipt. Is there really a fee?'),
  t('puskesmas-antre', 'kesehatan', 'sedang',
    'Antrian di puskesmas panjang pisan, dokterna ngan hiji. Budak abdi geus tilu poe panas, ti isuk nepi ka beurang can kabagean.',
    'Antrean di puskesmas panjang sekali, dokternya hanya satu. Anak saya demam sudah tiga hari, dari pagi sampai siang belum dapat giliran.',
    'The queue at the health centre is very long and there is only one doctor. My child has had a fever for three days and has waited from morning to noon without being seen.'),
  t('dbd-rt', 'kesehatan', 'tinggi',
    'Di RT dieu geus aya tilu budak katerap demam berdarah minggu ieu. Tulung di-fogging jeung dipariksa jentikna.',
    'Di RT sini sudah ada tiga anak kena demam berdarah minggu ini. Tolong dilakukan fogging dan pemeriksaan jentik.',
    'Three children in our neighbourhood have caught dengue this week. Please carry out fogging and a larva check.'),
  t('ktp-belum-jadi', 'adminduk', 'rendah',
    'Abdi parantos ngurus KTP-el ti dua bulan kapengker, dugi ka ayeuna teu acan réngsé, saurna blangkona seep. Iraha tiasa dicandak?',
    'Saya sudah mengurus KTP-el sejak dua bulan lalu, sampai sekarang belum jadi, katanya blankonya habis. Kapan bisa diambil?',
    'I applied for my e-ID two months ago and it is still not ready; they say the blank cards ran out. When can I collect it?'),
  t('bansos-hilang', 'bansos', 'sedang',
    'Nini abdi geus kolot jeung hirup nyorangan, naha ngaranna leungit tina daftar bansos bulan ieu? Padahal bulan kamari masih meunang. Tulung dipariksa.',
    'Nenek saya sudah tua dan hidup sendiri, kenapa namanya hilang dari daftar bansos bulan ini? Padahal bulan lalu masih dapat. Tolong dicek.',
    'My grandmother is old and lives alone, so why has her name disappeared from this month\'s social-assistance list? She received it last month. Please check.'),
  t('sekolah-atap', 'sekolah', 'tinggi',
    'Hateup kelas SD di lingkungan abdi bocor jeung kaina geus rapuh, barudak sieun mun hujan gede. Tulung gancang dioméan samemeh rubuh.',
    'Atap kelas SD di lingkungan saya bocor dan kayunya sudah rapuh, anak-anak takut kalau hujan deras. Tolong segera diperbaiki sebelum roboh.',
    'The primary-school classroom roof in my neighbourhood leaks and the timber is rotten; the children are scared in heavy rain. Please fix it before it collapses.'),
]

/** main sector per kecamatan (editorial summary, simulated; not statistics per kecamatan) */
export const MAIN_SECTOR = {
  'sumur-bandung': 'Perdagangan dan jasa',
  'bandung-wetan': 'Jasa dan perkantoran',
  regol: 'Perdagangan dan jasa',
  lengkong: 'Perdagangan dan kuliner',
  coblong: 'Pendidikan dan jasa digital',
  sukasari: 'Pendidikan dan jasa',
  cidadap: 'Pariwisata dan kuliner',
  andir: 'Perdagangan (pasar dan grosir)',
  astanaanyar: 'Perdagangan',
  cicendo: 'Industri dan transportasi',
  'babakan-ciparay': 'Industri garmen dan tekstil',
  'bandung-kulon': 'Industri garmen dan tekstil',
  'bojongloa-kaler': 'Industri rumahan dan perdagangan',
  'bojongloa-kidul': 'Industri sepatu dan garmen',
  kiaracondong: 'Industri dan perdagangan',
  batununggal: 'Industri dan perdagangan',
  gedebage: 'Perdagangan grosir (pasar induk)',
  ujungberung: 'Perdagangan dan industri kecil',
}
