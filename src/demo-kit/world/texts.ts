/**
 * world/texts.ts — the small part of the catalog the RUNNING world needs (reducers, audit lines, reactions and
 * natural events): category labels and SLA, natural complaint/mention texts, media names, the emergency pump
 * package. Everything else the generator draws from lives in catalog.ts (loaded only when a world is generated).
 * All names here are FICTIONAL.
 */
import type { Bi, ComplaintCategory } from './types'

export const MEDIA_OUTLETS = ['Warta Senja Raya', 'Kabar Simpang Kota', 'Lensa Kalangan', 'Gema Pelita Daerah', 'Rona Kabar', 'Ruang Warta 24', 'Titik Temu News', 'Jurnal Pinggir Kali']
export const SOCIAL_HANDLES = ['@infowarga.kini', '@kabar.sekitar.id', '@sobat.lintas', '@jalan.kampung', '@ceritawarga', '@pantau.desa', '@suara.pinggiran', '@warung.diskusi', '@relawan.kali', '@anak.pasar']

/**
 * Fallback complaint texts (Indonesian original + English) when the pack has no template for a category. Slots:
 * {d} desa name, {rt} neighbourhood unit ("RT 04"), {l} a nearby landmark, {dur} a duration. Fill with
 * fillComplaint(); several variants per category so the inbox never reads like one form letter.
 */
export const COMPLAINT_TEXT: Record<ComplaintCategory, Bi[]> = {
  banjir: [
    { id: 'Air mulai masuk rumah warga {rt} {d}, sudah sebetis. Mohon bantuan pompa.', en: 'Water is entering homes in {rt}, {d}, already calf-deep. Please send pumps.' },
    { id: 'Jalan utama {d} dekat {l} tergenang, motor tidak bisa lewat.', en: 'The main road in {d} near {l} is flooded, motorbikes cannot pass.' },
    { id: 'Saluran air di {rt} {d} meluap sejak subuh, air sudah sampai teras.', en: 'The drain in {rt}, {d} has overflowed since dawn, water has reached the porches.' },
    { id: 'Tanggul kecil di belakang {l} {d} rembes, warga khawatir jebol kalau hujan lagi.', en: 'The small embankment behind {l} in {d} is seeping; residents fear it will breach if it rains again.' },
    { id: 'Mohon info posko terdekat. Air di {rt} {d} naik terus sejak tengah malam.', en: 'Where is the nearest relief post? Water in {rt}, {d} has kept rising since midnight.' },
    { id: 'Ada lansia di {rt} {d} yang perlu dievakuasi, air sudah selutut di dalam rumah.', en: 'An elderly resident in {rt}, {d} needs evacuating, water is knee-deep inside the house.' },
    { id: 'Gorong-gorong dekat {l} {d} tersumbat sampah, genangan tidak surut-surut.', en: 'The culvert near {l} in {d} is blocked with rubbish and the flooding will not recede.' },
    { id: 'Sawah di pinggir {d} terendam, padi yang baru ditanam bisa busuk.', en: 'Rice fields on the edge of {d} are under water; the newly planted rice may rot.' },
    { id: 'Akses ke {l} {d} terputus genangan, anak sekolah tidak bisa lewat.', en: 'Access to {l} in {d} is cut off by floodwater, schoolchildren cannot get through.' },
    { id: 'Banjir lagi di {rt} {d}. Tiap hujan deras selalu begini, tolong drainasenya dibenahi.', en: 'Flooding again in {rt}, {d}. It happens every heavy rain, please fix the drainage.' },
    { id: 'Sumur warga {rt} {d} tercampur air banjir, kami butuh air bersih.', en: 'The wells in {rt}, {d} are contaminated by floodwater, we need clean water.' },
    { id: 'Air sungai sudah sampai bibir tanggul di {d}, mohon dipantau petugas.', en: 'The river has reached the top of the embankment in {d}, please have it monitored.' },
  ],
  'jalan-rusak': [
    { id: 'Jalan berlubang besar dekat {l} {d}, sudah ada pengendara yang jatuh.', en: 'Big pothole near {l} in {d}; a rider has already fallen.' },
    { id: 'Aspal jalan poros {d} mengelupas sepanjang kira-kira 200 meter.', en: 'Asphalt on the {d} main road is peeling for about 200 metres.' },
    { id: 'Jalan cor di pinggir sungai {d} amblas, retakannya makin lebar.', en: 'The concrete road by the river in {d} has subsided and the crack keeps widening.' },
    { id: 'Lubang di jalan {rt} {d} tertutup genangan, tidak kelihatan kalau malam.', en: 'A pothole on the road in {rt}, {d} is hidden under a puddle and invisible at night.' },
    { id: 'Papan jembatan kecil di {d} sudah lapuk, motor harus jalan pelan sekali.', en: 'The planks of the small bridge in {d} are rotten, motorbikes have to crawl across.' },
    { id: 'Sudah {dur} jalan depan {l} {d} rusak dan belum ada perbaikan.', en: 'The road in front of {l} in {d} has been broken for {dur} with no repair yet.' },
    { id: 'Truk material lewat terus, jalan desa {d} jadi bergelombang.', en: 'Material trucks keep passing and the {d} village road has become rutted.' },
    { id: 'Bahu jalan di {d} longsor sebagian, rawan untuk pengendara.', en: 'Part of the road shoulder in {d} has slid away, dangerous for riders.' },
    { id: 'Mohon lubang di jalan {rt} {d} ditambal, anak-anak sering jatuh naik sepeda.', en: 'Please patch the pothole on the road in {rt}, {d}; children keep falling off their bikes.' },
    { id: 'Jalan makadam ke {l} {d} berlumpur kalau hujan, ambulans susah masuk.', en: 'The gravel road to {l} in {d} turns to mud when it rains; ambulances struggle to get in.' },
    { id: 'Paving di gang {rt} {d} banyak yang lepas dan berserakan.', en: 'Many paving blocks in the alley in {rt}, {d} have come loose.' },
    { id: 'Retakan memanjang di ruas jalan kabupaten {d} makin parah setelah hujan.', en: 'A long crack on the regency road through {d} got worse after the rain.' },
    { id: 'Saya lapor ulang: lubang di jalan {d} dekat {l} belum ditambal juga.', en: 'Reporting again: the pothole on the {d} road near {l} still has not been patched.' },
  ],
  sampah: [
    { id: 'Sampah di TPS {d} belum diangkut {dur}, bau sekali.', en: 'Rubbish at the {d} collection point has not been picked up for {dur}, it smells terrible.' },
    { id: 'Ada pembuangan sampah liar di pinggir sungai {d}.', en: 'Illegal dumping on the riverbank in {d}.' },
    { id: 'Kontainer sampah dekat {l} {d} penuh dan meluber ke jalan.', en: 'The rubbish container near {l} in {d} is full and spilling onto the road.' },
    { id: 'Ada warga {rt} {d} yang membakar sampah tiap sore, asapnya masuk rumah.', en: 'Someone in {rt}, {d} burns rubbish every evening and the smoke gets into homes.' },
    { id: 'Jadwal angkut sampah di {d} tidak jelas, mohon diumumkan.', en: 'The rubbish collection schedule in {d} is unclear, please announce it.' },
    { id: 'Sampah menyumbat saluran di {rt} {d}, airnya jadi meluap.', en: 'Rubbish is clogging the drain in {rt}, {d} and it overflows.' },
    { id: 'Banyak lalat di sekitar TPS {d} yang dekat {l}.', en: 'Lots of flies around the {d} collection point near {l}.' },
    { id: 'Gerobak sampah {rt} {d} rusak, petugas tidak bisa mengangkut.', en: 'The rubbish cart for {rt}, {d} is broken, so the crew cannot collect.' },
    { id: 'Tumpukan sampah pasar di {d} dibiarkan sampai malam.', en: 'Market rubbish in {d} is left piled up until night.' },
    { id: 'Tolong pasang papan larangan buang sampah di dekat {l} {d}.', en: 'Please put up a no-dumping sign near {l} in {d}.' },
  ],
  pju: [
    { id: 'Lampu jalan di perempatan {d} mati sudah {dur}.', en: 'The street light at the {d} crossroads has been out for {dur}.' },
    { id: 'Tiga tiang PJU di {d} tidak menyala, rawan kecelakaan.', en: 'Three street lights in {d} are off, accident-prone.' },
    { id: 'Lampu PJU depan {l} {d} berkedip terus sejak kemarin.', en: 'The street light in front of {l} in {d} has been flickering since yesterday.' },
    { id: 'Jalan di {rt} {d} gelap total sudah {dur}, warga takut lewat malam.', en: 'The road in {rt}, {d} has been pitch dark for {dur}; residents are afraid to walk at night.' },
    { id: 'Kabel lampu jalan di {d} menjuntai rendah, bahaya untuk truk.', en: 'A street-light cable in {d} is hanging low, dangerous for trucks.' },
    { id: 'Tiang lampu dekat {l} {d} miring setelah tersenggol truk.', en: 'The lamp post near {l} in {d} is leaning after a truck clipped it.' },
    { id: 'Lampu jalan di {d} malah menyala siang hari dan mati waktu malam.', en: 'The street lights in {d} are on during the day and off at night.' },
    { id: 'Mohon tambah lampu di tikungan dekat {l} {d}, sering hampir tabrakan.', en: 'Please add a light at the bend near {l} in {d}; there are near-misses all the time.' },
    { id: 'PJU di jembatan {d} padam, padahal jalurnya ramai.', en: 'The lights on the {d} bridge are out, though the route is busy.' },
    { id: 'Sudah lapor ke desa soal lampu mati di {rt} {d}, belum ada tindakan.', en: 'I told the village office about the dead light in {rt}, {d}, but nothing has happened.' },
  ],
  'air-bersih': [
    { id: 'Air PDAM di {d} keruh sejak kemarin.', en: 'Tap water in {d} has been murky since yesterday.' },
    { id: 'Distribusi air bersih ke {d} berhenti {dur}.', en: 'Clean-water supply to {d} has been off for {dur}.' },
    { id: 'Air di {rt} {d} hanya mengalir tengah malam, itu pun kecil.', en: 'Water in {rt}, {d} only runs at midnight, and only a trickle.' },
    { id: 'Pipa PDAM bocor di depan {l} {d}, airnya terbuang ke jalan.', en: 'A water main is leaking in front of {l} in {d}, wasting water onto the road.' },
    { id: 'Air keran di {d} berbau kaporit sangat kuat.', en: 'Tap water in {d} smells very strongly of chlorine.' },
    { id: 'Tagihan air naik, tapi alirannya sering mati di {rt} {d}.', en: 'The water bill went up, yet the supply in {rt}, {d} keeps cutting out.' },
    { id: 'Pompa sumur bor komunal di {d} rusak sudah {dur}.', en: 'The pump of the communal borehole in {d} has been broken for {dur}.' },
    { id: 'Mohon kiriman tangki air untuk {rt} {d}, sumur mulai kering.', en: 'Please send a water tanker to {rt}, {d}; the wells are drying up.' },
    { id: 'Air PDAM di {d} berwarna kuning kecokelatan.', en: 'Tap water in {d} is a yellowish brown.' },
    { id: 'Meteran air di {rt} {d} bocor, sudah dilaporkan tapi belum diganti.', en: 'A water meter in {rt}, {d} is leaking; it was reported but not replaced.' },
  ],
  'pohon-tumbang': [
    { id: 'Pohon tumbang menutup jalan di {d} setelah hujan deras.', en: 'A fallen tree blocks the road in {d} after heavy rain.' },
    { id: 'Dahan besar patah dan menimpa kabel listrik dekat {l} {d}.', en: 'A large branch snapped and fell on power lines near {l} in {d}.' },
    { id: 'Pohon trembesi di depan {l} {d} miring, takut roboh.', en: 'The rain tree in front of {l} in {d} is leaning and may fall.' },
    { id: 'Pohon tumbang di {rt} {d} menimpa pagar rumah warga.', en: 'A fallen tree in {rt}, {d} has crushed a resident\'s fence.' },
    { id: 'Batang pohon melintang di jalan ke {l} {d}, motor harus putar balik.', en: 'A trunk lies across the road to {l} in {d}; motorbikes have to turn back.' },
    { id: 'Mohon pemangkasan pohon di sepanjang jalan {d}, dahannya rapuh.', en: 'Please prune the trees along the {d} road, the branches are brittle.' },
    { id: 'Akar pohon besar di {d} mengangkat paving dan pohonnya mulai condong.', en: 'Roots of a big tree in {d} are lifting the paving and the tree is starting to lean.' },
    { id: 'Rumpun bambu roboh ke saluran di {rt} {d}, air tersumbat.', en: 'A clump of bamboo fell into the drain in {rt}, {d}, blocking the water.' },
    { id: 'Ada pohon tumbang di tepi sungai {d} yang menghalangi aliran.', en: 'A fallen tree on the {d} riverbank is blocking the flow.' },
    { id: 'Pohon mangga tua dekat {l} {d} keropos, sudah ada cabang yang jatuh.', en: 'An old mango tree near {l} in {d} is hollow; a branch has already fallen.' },
  ],
  pungli: [
    { id: 'Ada yang minta uang tambahan saat urus surat di {d}.', en: 'Someone asked for an extra payment when processing a letter in {d}.' },
    { id: 'Saat urus KK di kantor desa {d} diminta "uang administrasi" tanpa kuitansi.', en: 'When updating my family card at the {d} village office I was asked for an "admin fee" with no receipt.' },
    { id: 'Juru parkir di {l} {d} menarik tarif dua kali lipat tanpa karcis.', en: 'The parking attendant at {l} in {d} charges double with no ticket.' },
    { id: 'Untuk dapat giliran bantuan di {d} warga diminta setor Rp 50 ribu.', en: 'Residents of {d} were told to pay Rp 50,000 to get their turn for aid.' },
    { id: 'Katanya surat pindah di {d} bisa cepat kalau bayar lebih.', en: 'In {d} we were told a moving certificate is faster if we pay extra.' },
    { id: 'Ada pungutan "uang kebersihan" di pasar {d} yang tidak jelas dasarnya.', en: 'There is a "cleaning fee" at the {d} market with no clear basis.' },
    { id: 'Saya dimintai "uang rokok" oleh oknum saat urus izin usaha di {d}.', en: 'An official asked me for "cigarette money" when I applied for a business permit in {d}.' },
    { id: 'Pendaftaran sekolah di {d} ada iuran tidak resmi untuk seragam.', en: 'School enrolment in {d} comes with an unofficial uniform fee.' },
    { id: 'Di jalan masuk {d} ada pungutan dari orang tak dikenal untuk truk.', en: 'Unknown people are charging trucks at the entrance road to {d}.' },
    { id: 'Pengurusan sertifikat tanah di {d} dimintai biaya di luar ketentuan.', en: 'Fees outside the rules were demanded for a land certificate in {d}.' },
  ],
  kesehatan: [
    { id: 'Antrean puskesmas dekat {d} sangat panjang, obat habis.', en: 'The health-centre queue near {d} is very long and medicine has run out.' },
    { id: 'Posyandu di {rt} {d} sudah {dur} tidak buka.', en: 'The child-health post in {rt}, {d} has been closed for {dur}.' },
    { id: 'Ambulans desa {d} rusak, warga kesulitan ke rumah sakit.', en: 'The {d} village ambulance is broken; residents struggle to reach hospital.' },
    { id: 'Banyak warga {rt} {d} diare setelah banjir, mohon ada pemeriksaan.', en: 'Many residents of {rt}, {d} have diarrhoea after the flood; please send a check-up team.' },
    { id: 'Jam layanan pustu {d} tidak sesuai papan pengumuman.', en: 'The {d} health post is not open at the hours on its notice board.' },
    { id: 'Bidan desa {d} sudah pindah, belum ada penggantinya.', en: 'The {d} village midwife has moved away and there is no replacement yet.' },
    { id: 'Ada kasus DBD di {rt} {d} tapi belum ada fogging.', en: 'There is a dengue case in {rt}, {d} but no fogging yet.' },
    { id: 'Stok vaksin di puskesmas dekat {d} kosong saat jadwal imunisasi.', en: 'The health centre near {d} ran out of vaccine on immunisation day.' },
    { id: 'Mohon cek jentik nyamuk di sekitar {l} {d}, banyak genangan.', en: 'Please check for mosquito larvae around {l} in {d}; there are many puddles.' },
    { id: 'Di puskesmas dekat {d} pasien BPJS diminta fotokopi berulang kali.', en: 'At the health centre near {d}, insured patients are asked for photocopies again and again.' },
  ],
  sekolah: [
    { id: 'Atap ruang kelas SD di {d} bocor, murid dipindah.', en: 'The roof of a primary-school classroom in {d} is leaking, pupils were moved.' },
    { id: 'Toilet SD dekat {l} {d} rusak sudah {dur}.', en: 'The toilets at the primary school near {l} in {d} have been broken for {dur}.' },
    { id: 'Pagar sekolah di {d} roboh, anak-anak bisa lari ke jalan raya.', en: 'The school fence in {d} has collapsed; children can run out onto the main road.' },
    { id: 'Banyak meja dan kursi kelas di SD {d} yang patah.', en: 'Many desks and chairs at the {d} primary school are broken.' },
    { id: 'Halaman sekolah di {d} tergenang setiap hujan.', en: 'The schoolyard in {d} floods every time it rains.' },
    { id: 'Plafon kelas SMP dekat {d} retak, orang tua khawatir.', en: 'A classroom ceiling at the junior high near {d} is cracked; parents are worried.' },
    { id: 'Sekolah di {d} kekurangan guru, satu guru memegang dua kelas.', en: 'The school in {d} is short of teachers; one teacher covers two classes.' },
    { id: 'Jalan ke sekolah di {rt} {d} becek, murid sering terlambat.', en: 'The path to school in {rt}, {d} is muddy and pupils are often late.' },
    { id: 'Bantuan buku untuk SD di {d} belum datang, padahal semester sudah jalan.', en: 'Book aid for the {d} primary school has not arrived though the term has started.' },
    { id: 'Listrik di SD {d} sering padam, komputer untuk ujian tidak bisa dipakai.', en: 'Power at the {d} primary school keeps cutting out, so the exam computers cannot be used.' },
  ],
  adminduk: [
    { id: 'KTP-el saya rusak, bagaimana cara ganti? Saya di {d}.', en: 'My e-ID card is damaged, how do I replace it? I live in {d}.' },
    { id: 'Akta kelahiran anak saya di {d} belum jadi sejak sebulan lalu.', en: "My child's birth certificate in {d} is still not issued after a month." },
    { id: 'Blanko KTP-el di kecamatan habis, warga {d} disuruh kembali minggu depan.', en: 'The district office has run out of e-ID blanks; {d} residents were told to come back next week.' },
    { id: 'Nama di KK saya salah ketik, mohon dibantu perbaikannya. Warga {rt} {d}.', en: 'My name is misspelt on the family card, please help me correct it. Resident of {rt}, {d}.' },
    { id: 'Sudah {dur} menunggu KIA anak, belum ada kabar. Warga {d}.', en: 'I have waited {dur} for my child\'s ID card with no news. Resident of {d}.' },
    { id: 'Apakah perekaman KTP-el untuk lansia di {d} bisa jemput bola?', en: 'Can e-ID registration for the elderly in {d} be done at home?' },
    { id: 'Data saya di Dukcapil masih alamat lama, padahal sudah pindah ke {d}.', en: 'My civil-registry record still has my old address though I moved to {d}.' },
    { id: 'Antrean online Dukcapil selalu penuh, warga {d} susah dapat slot.', en: 'The online civil-registry queue is always full; {d} residents cannot get a slot.' },
    { id: 'Akta kematian ayah saya belum terbit, padahal berkas lengkap. Warga {d}.', en: "My father's death certificate has not been issued though the file is complete. Resident of {d}." },
    { id: 'Bagaimana cara cetak ulang KK yang rusak kena banjir? Saya di {rt} {d}.', en: 'How do I reprint a family card damaged in the flood? I live in {rt}, {d}.' },
  ],
  bansos: [
    { id: 'Saya terdaftar penerima bansos tapi bantuan belum cair. Warga {d}.', en: 'I am registered for social aid but have not received it. Resident of {d}.' },
    { id: 'Tetangga yang mampu dapat bansos, yang lebih butuh di {rt} {d} malah tidak.', en: 'Well-off neighbours get social aid while needier families in {rt}, {d} do not.' },
    { id: 'Nama saya hilang dari daftar penerima PKH tahun ini. Warga {d}.', en: 'My name disappeared from this year\'s family-hope programme list. Resident of {d}.' },
    { id: 'Kartu bansos saya tidak bisa dipakai di agen {d}.', en: 'My social-aid card does not work at the {d} agent.' },
    { id: 'Beras bantuan yang diterima warga {rt} {d} berkutu.', en: 'The aid rice given to residents of {rt}, {d} has weevils.' },
    { id: 'Jadwal pencairan BLT di {d} berubah-ubah, warga jadi bolak-balik.', en: 'The cash-aid payout date in {d} keeps changing and people make wasted trips.' },
    { id: 'Lansia di {rt} {d} belum masuk DTKS, mohon dibantu.', en: 'Elderly residents in {rt}, {d} are not yet in the welfare database, please help.' },
    { id: 'Bantuan untuk korban banjir di {d} belum sampai ke {rt}.', en: 'Flood aid in {d} has not reached {rt} yet.' },
    { id: 'Penyaluran bansos di {l} {d} antre sampai sore tanpa tempat duduk.', en: 'The aid handout at {l} in {d} had people queuing till evening with no seating.' },
    { id: 'Bagaimana cara mengusulkan warga miskin baru di {d}?', en: 'How do we nominate newly poor households in {d}?' },
  ],
  lainnya: [
    { id: 'Ada anjing liar berkeliaran di sekitar {d}.', en: 'Stray dogs are roaming around {d}.' },
    { id: 'Musik hajatan di {rt} {d} sampai lewat tengah malam.', en: 'Party music in {rt}, {d} went on past midnight.' },
    { id: 'Baliho roboh di dekat {l} {d}, menutup trotoar.', en: 'A billboard has collapsed near {l} in {d}, blocking the pavement.' },
    { id: 'Banyak monyet masuk permukiman {d}, merusak genteng.', en: 'Monkeys are coming into homes in {d} and breaking roof tiles.' },
    { id: 'Lapak PKL di depan {l} {d} memakan badan jalan.', en: 'Street stalls in front of {l} in {d} take up half the road.' },
    { id: 'Mohon info jadwal layanan keliling di {d}.', en: 'Please share the mobile-service schedule for {d}.' },
    { id: 'Bangunan kosong di {rt} {d} jadi tempat nongkrong sampai pagi.', en: 'An empty building in {rt}, {d} has become an all-night hangout.' },
    { id: 'Sungai di {d} berbau limbah, warna airnya berubah.', en: 'The river in {d} smells of waste and its colour has changed.' },
    { id: 'Taman desa {d} tidak terawat, mainan anak rusak.', en: 'The {d} village park is neglected and the play equipment is broken.' },
    { id: 'Saluran irigasi di {d} dipenuhi eceng gondok.', en: 'The irrigation channel in {d} is choked with water hyacinth.' },
  ],
}

const LANDMARKS: Bi[] = [
  { id: 'masjid', en: 'the mosque' }, { id: 'balai desa', en: 'the village hall' }, { id: 'SDN 2', en: 'primary school no. 2' }, { id: 'pasar desa', en: 'the village market' },
  { id: 'makam umum', en: 'the public cemetery' }, { id: 'pos kamling', en: 'the night-watch post' }, { id: 'lapangan', en: 'the sports field' }, { id: 'musala', en: 'the prayer house' },
  { id: 'kantor desa', en: 'the village office' }, { id: 'pertigaan', en: 'the T-junction' },
]
const DURATIONS: Bi[] = [
  { id: 'tiga hari', en: 'three days' }, { id: 'seminggu', en: 'a week' }, { id: 'lima hari', en: 'five days' }, { id: 'dua minggu', en: 'two weeks' }, { id: 'lebih dari seminggu', en: 'over a week' },
]
/** fill a COMPLAINT_TEXT template; `pick` draws the detail slots (a separate rng, so the caller's stream is unchanged) */
export function fillComplaint(t: Bi, desa: string, rnd: { int(a: number, b: number): number }): Bi {
  const rt = `RT ${String(rnd.int(1, 12)).padStart(2, '0')}`
  const l = LANDMARKS[rnd.int(0, LANDMARKS.length - 1)]!
  const dur = DURATIONS[rnd.int(0, DURATIONS.length - 1)]!
  const fill = (s: string, lang: 'id' | 'en') => s.replace(/\{d\}/g, desa).replace(/\{rt\}/g, rt).replace(/\{l\}/g, lang === 'id' ? l.id : l.en).replace(/\{dur\}/g, lang === 'id' ? dur.id : dur.en)
  return { id: fill(t.id, 'id'), en: fill(t.en, 'en') }
}
const tplRe = new Map<string, RegExp>()
/** does an (Indonesian) complaint text come from template `t`? */
export function fromComplaintTemplate(t: Bi, text: string): boolean {
  let re = tplRe.get(t.id)
  if (!re) {
    re = new RegExp('^' + t.id.split(/\{[a-z]+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$')
    tplRe.set(t.id, re)
  }
  return re.test(text)
}

export const COMPLAINT_WEIGHTS: [ComplaintCategory, number][] = [
  ['jalan-rusak', 22], ['banjir', 12], ['sampah', 12], ['pju', 10], ['air-bersih', 10], ['adminduk', 10], ['bansos', 8], ['pohon-tumbang', 5], ['kesehatan', 4], ['sekolah', 3], ['pungli', 2], ['lainnya', 2],
]

export const CATEGORY_SLA_DAYS: Record<ComplaintCategory, number> = {
  banjir: 1, 'jalan-rusak': 7, sampah: 2, pju: 3, 'air-bersih': 2, 'pohon-tumbang': 1, pungli: 5, kesehatan: 3, sekolah: 7, adminduk: 3, bansos: 5, lainnya: 5,
}
/**
 * Life-safety flood reports (someone to evacuate, trapped, a rubber boat asked for) go straight to the disaster agency
 * (BPBD) with a short SLA, whatever the category's usual agency is.
 */
export const LIFE_SAFETY_RE = /evakuasi|dievakuasi|mengungsi|perahu karet|terjebak|terseret|hanyut|evacuat|trapped|rubber boat/i
/** SLA of a life-safety report, minutes */
export const LIFE_SAFETY_SLA_MIN = 60
/** the agency and SLA (minutes) a new complaint gets: life-safety flood reports → BPBD in 60 min */
export function complaintRouting(region: { categoryOpd: Record<ComplaintCategory, string>; opd: { id: string }[] }, category: ComplaintCategory, text: string): { opdId: string; slaMin: number } {
  if ((category === 'banjir' || category === 'pohon-tumbang') && LIFE_SAFETY_RE.test(text) && region.opd.some((o) => o.id === 'bpbd')) return { opdId: 'bpbd', slaMin: LIFE_SAFETY_SLA_MIN }
  return { opdId: region.categoryOpd[category], slaMin: CATEGORY_SLA_DAYS[category] * 24 * 60 }
}
export { CATEGORY_LABEL } from './labels'

/** news / social mention templates ({k} = kecamatan, {r} = region short name); `v` = other phrasings of the same story */
export const MENTION_TEXT: { topic: string; s: number; t: Bi; v?: Bi[] }[] = [
  { topic: 'layanan', s: 0.6, t: { id: 'Urus KTP-el di MPP {r} sekarang cepat, 30 menit selesai.', en: 'Getting an e-ID at the {r} public service mall is now fast, done in 30 minutes.' }, v: [
    { id: 'Baru dari MPP {r}, cetak KTP-el cuma setengah jam. Mantap.', en: 'Just back from the {r} service mall: e-ID printed in half an hour. Great.' },
    { id: 'Pelayanan MPP {r} makin cepat, antrean tertib dan petugas ramah.', en: 'The {r} service mall is getting faster, with orderly queues and friendly staff.' },
    { id: 'Salut untuk petugas MPP {r}, berkas saya beres sebelum jam istirahat.', en: 'Hats off to the {r} service mall staff, my papers were done before the lunch break.' },
  ] },
  { topic: 'layanan', s: -0.5, t: { id: 'Antrean layanan di Kec. {k} masih mengular sejak pagi.', en: 'Service queues in {k} district have been long since morning.' }, v: [
    { id: 'Sudah dua jam antre di kantor Kec. {k}, nomor belum dipanggil juga.', en: 'Two hours in the queue at the {k} district office and my number still has not been called.' },
    { id: 'Loket layanan Kec. {k} cuma buka satu, warga menumpuk di luar.', en: 'Only one service counter is open in {k}; people are piling up outside.' },
    { id: 'Warga Kec. {k} keluhkan sistem antrean yang sering gangguan.', en: 'Residents of {k} complain the queue system keeps breaking down.' },
  ] },
  { topic: 'jalan', s: -0.7, t: { id: 'Warga Kec. {k} keluhkan jalan rusak yang tak kunjung diperbaiki.', en: 'Residents of {k} complain about a road that never gets fixed.' }, v: [
    { id: 'Jalan penghubung desa di Kec. {k} makin parah, warga tanam pisang di lubang.', en: 'A village link road in {k} keeps getting worse; residents planted banana trees in the potholes.' },
    { id: 'Lagi-lagi jalan di Kec. {k} berlubang, kapan diperbaiki?', en: 'Potholes again on the {k} road, when will it be fixed?' },
    { id: 'Pengendara di Kec. {k} terpaksa zig-zag hindari lubang jalan.', en: 'Riders in {k} have to zig-zag around potholes.' },
  ] },
  { topic: 'jalan', s: 0.4, t: { id: 'Perbaikan jalan poros Kec. {k} mulai dikerjakan pekan ini.', en: 'Repairs to the main road in {k} start this week.' }, v: [
    { id: 'Alat berat sudah datang, jalan poros Kec. {k} akhirnya diperbaiki.', en: 'Heavy machinery has arrived; the {k} main road is finally being repaired.' },
    { id: 'Pengaspalan ulang ruas jalan di Kec. {k} ditargetkan rampung bulan depan.', en: 'Resurfacing of the {k} road is due to finish next month.' },
  ] },
  { topic: 'banjir', s: -0.6, t: { id: 'Hujan semalam bikin was-was warga bantaran sungai di Kec. {k}.', en: 'Overnight rain worries riverbank residents in {k}.' }, v: [
    { id: 'Air sungai naik lagi, warga bantaran di Kec. {k} mulai angkat barang.', en: 'The river is rising again; riverbank residents in {k} are moving their belongings up.' },
    { id: 'Warga Kec. {k} berjaga semalaman pantau debit sungai.', en: 'Residents of {k} stayed up all night watching the river.' },
    { id: 'Genangan mulai masuk permukiman di Kec. {k} setelah hujan deras.', en: 'Floodwater has started entering homes in {k} after heavy rain.' },
  ] },
  { topic: 'banjir', s: 0.3, t: { id: 'BPBD {r} siagakan pompa dan perahu di titik rawan.', en: '{r} disaster agency puts pumps and boats on standby at vulnerable spots.' }, v: [
    { id: 'Relawan dan BPBD {r} siapkan posko di Kec. {k}.', en: 'Volunteers and the {r} disaster agency set up a relief post in {k}.' },
    { id: 'Petugas {r} bersihkan gorong-gorong di Kec. {k} jelang puncak hujan.', en: '{r} crews clear culverts in {k} ahead of peak rain.' },
  ] },
  { topic: 'harga', s: -0.5, t: { id: 'Harga cabai di pasar Kec. {k} mulai merangkak naik.', en: 'Chilli prices at the {k} market are starting to creep up.' }, v: [
    { id: 'Pedagang pasar Kec. {k}: pasokan cabai berkurang, harga naik.', en: '{k} market traders: chilli supply is down and prices are up.' },
    { id: 'Ibu-ibu di Kec. {k} mengeluh harga bumbu dapur naik pekan ini.', en: 'Households in {k} complain kitchen staples went up this week.' },
  ] },
  { topic: 'harga', s: 0.2, t: { id: 'Stok beras di pasar {r} dipastikan aman jelang akhir tahun.', en: 'Rice stocks in {r} markets are confirmed safe ahead of year-end.' }, v: [
    { id: 'Operasi pasar di Kec. {k} bantu warga dapat beras lebih murah.', en: 'A market operation in {k} helps residents buy cheaper rice.' },
    { id: 'Harga beras di pasar {r} stabil dalam dua pekan terakhir.', en: 'Rice prices in {r} markets have been stable for two weeks.' },
  ] },
  { topic: 'umkm', s: 0.7, t: { id: 'UMKM {r} ramai pesanan dari pameran produk lokal.', en: '{r} small businesses busy with orders from a local product fair.' }, v: [
    { id: 'Batik dan olahan pangan dari Kec. {k} laris di pameran {r}.', en: 'Batik and food products from {k} sold well at the {r} fair.' },
    { id: 'Pelaku usaha Kec. {k} panen pesanan setelah ikut bazar daring.', en: 'Business owners in {k} got a wave of orders after joining an online bazaar.' },
    { id: 'Produk keripik dari Kec. {k} mulai masuk toko oleh-oleh di {r}.', en: 'Crisps made in {k} are now stocked by souvenir shops in {r}.' },
    { id: 'Stan UMKM {r} jadi yang paling ramai dikunjungi di pameran pekan ini.', en: 'The {r} small-business stands were the busiest at this week\'s fair.' },
  ] },
  { topic: 'umkm', s: 0.4, t: { id: 'Pelatihan pembukuan digital untuk pelaku usaha Kec. {k}.', en: 'Digital bookkeeping training for business owners in {k}.' }, v: [
    { id: 'Puluhan pedagang Kec. {k} ikut kelas foto produk untuk jualan daring.', en: 'Dozens of traders in {k} joined a product-photo class for online selling.' },
    { id: 'Pendampingan izin usaha gratis dibuka untuk warga Kec. {k}.', en: 'Free business-permit assistance opens for residents of {k}.' },
  ] },
  { topic: 'sampah', s: -0.4, t: { id: 'Tumpukan sampah di pinggir jalan Kec. {k} dikeluhkan pengendara.', en: 'Rubbish piles along the road in {k} annoy commuters.' }, v: [
    { id: 'TPS di Kec. {k} penuh, sampah meluber sampai bahu jalan.', en: 'The collection point in {k} is full and rubbish spills onto the road shoulder.' },
    { id: 'Bau sampah di dekat pasar Kec. {k} bikin pembeli enggan mampir.', en: 'The smell of rubbish near the {k} market is putting shoppers off.' },
  ] },
  { topic: 'kesehatan', s: 0.3, t: { id: 'Puskesmas Kec. {k} buka layanan sore untuk pekerja.', en: 'The {k} health centre opens an evening service for workers.' }, v: [
    { id: 'Posyandu lansia di Kec. {k} ramai, cek tensi dan gula darah gratis.', en: 'The elderly health post in {k} is busy with free blood-pressure and sugar checks.' },
    { id: 'Vaksinasi anak di Kec. {k} berjalan lancar pekan ini.', en: 'Child vaccinations in {k} went smoothly this week.' },
  ] },
  { topic: 'pendidikan', s: 0.5, t: { id: 'Sekolah di Kec. {k} raih juara lomba sains tingkat provinsi.', en: 'A school in {k} wins a provincial science contest.' }, v: [
    { id: 'Siswa dari Kec. {k} lolos ke final olimpiade matematika provinsi.', en: 'A pupil from {k} reached the provincial maths olympiad final.' },
    { id: 'Perpustakaan desa di Kec. {k} ramai dikunjungi anak sepulang sekolah.', en: 'The village library in {k} is busy with children after school.' },
  ] },
  { topic: 'bansos', s: -0.3, t: { id: 'Sebagian warga Kec. {k} tanyakan jadwal pencairan bansos.', en: 'Some residents of {k} ask about the social-aid payment schedule.' }, v: [
    { id: 'Warga Kec. {k} bingung, nama hilang dari daftar penerima bantuan.', en: 'Residents of {k} are confused after names disappeared from the aid list.' },
    { id: 'Antrean pencairan bantuan di Kec. {k} sampai siang.', en: 'The aid payout queue in {k} lasted until midday.' },
  ] },
  { topic: 'layanan', s: 0.0, t: { id: 'Pemkab {r} umumkan jadwal layanan keliling bulan ini.', en: '{r} government announces this month\'s mobile service schedule.' }, v: [
    { id: 'Mobil layanan keliling {r} singgah di Kec. {k} pekan depan.', en: 'The {r} mobile service van stops in {k} next week.' },
    { id: 'Jadwal layanan adminduk keliling di Kec. {k} sudah diumumkan.', en: 'The mobile civil-registry schedule for {k} has been announced.' },
  ] },
]
/** one phrasing of a mention template, chosen by `key` (deterministic, no rng draw) */
export function mentionText(tpl: { t: Bi; v?: Bi[] }, key: number): Bi {
  const all = tpl.v?.length ? [tpl.t, ...tpl.v] : [tpl.t]
  return all[Math.abs(Math.floor(key)) % all.length]!
}

/** the emergency pump package created by the flood.alert reaction (Awas Belanja analyses it later) */
export const PUMP_PACKAGE = {
  key: 'pompa-darurat',
  name: { id: 'Pengadaan Pompa Air Darurat', en: 'Emergency Water Pump Procurement' },
  items: [
    { name: { id: 'Pompa air portabel 6 inci (diesel)', en: '6-inch portable water pump (diesel)' }, qty: 12, unit: 'unit', hpsPrice: 48_500_000, marketPrice: 31_800_000 },
    { name: { id: 'Selang hisap & buang 6 inci', en: '6-inch suction & discharge hose' }, qty: 24, unit: 'rol', hpsPrice: 6_900_000, marketPrice: 4_650_000 },
    { name: { id: 'Genset 10 kVA', en: '10 kVA generator' }, qty: 4, unit: 'unit', hpsPrice: 62_000_000, marketPrice: 47_500_000 },
    { name: { id: 'Bahan bakar solar (7 hari)', en: 'Diesel fuel (7 days)' }, qty: 3000, unit: 'liter', hpsPrice: 13_900, marketPrice: 12_900 },
  ],
  /** announcement → deadline (days): short for its size (jadwal-singkat) */
  scheduleDays: 3,
  /** brand-locked spec without "atau setara" (spesifikasi-merek); "Hidroflo" is a FICTIONAL brand */
  spec: {
    id: 'Pompa wajib merek Hidroflo seri HX-600 (tidak menerima merek lain), mesin diesel 4 tak, debit minimal 3.000 liter/menit, garansi 1 tahun.',
    en: 'Pumps must be Hidroflo HX-600 series (no other brand accepted), 4-stroke diesel engine, at least 3,000 litres/minute, 1-year warranty.',
  },
  /** bid price as a share of HPS: ring members nearly identical (harga-seragam), independents spread */
  ringBid: [0.9641, 0.9652, 0.9660, 0.9671],
  independentBid: [0.874, 1.012],
}
