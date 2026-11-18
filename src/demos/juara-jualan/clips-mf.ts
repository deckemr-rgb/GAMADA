/**
 * demos/juara-jualan/clips-mf.ts — multifinance transcripts (loaded on intent): 5 phone calls + 1 WA chat. The weak
 * "keberatan" call is the kit's recorded SALES_CALL (Rina Wulandari); its names follow the call's agent and customer.
 */
import { SALES_CALL } from '../../demo-kit/media'
import type { ClipLib, Line } from './clips'

/** SALES_CALL with its people swapped for slots, and tagged per line */
const SALES_TAGS: readonly (readonly [string?, string?, string?])[] = [
  ['salam+'],
  [],
  ['penawaran+ gali-', 'Seharusnya: tanyakan pola penghasilan {Hon} (harian, mingguan) sebelum menyebut angka, lalu cocokkan tenornya.', 'Should have: ask how {Hon} earns (daily, weekly) before quoting, then match the tenor.'],
  [],
  ['keberatan- kepatuhan-', 'Seharusnya: jawab pertanyaan tenor dulu, misalnya “Tenor 36 bulan angsurannya sekitar Rp 870 ribu”, tanpa menekan dengan batas promo.', 'Should have: answer the tenor question first, e.g. “On 36 months it is about Rp 870 thousand”, without pressing with a promo deadline.'],
  [],
  ['closing-', 'Seharusnya: tawarkan langkah kecil yang pasti, misalnya kirim simulasi tenor 36 bulan lewat WA dan telepon lagi Kamis pagi.', 'Should have: offer a small, definite step, e.g. send a 36-month simulation by WA and call back on Thursday morning.'],
]
const swap = (t: string, lang: 'id' | 'en') =>
  lang === 'id'
    ? t.replace('Bapak Darmaji', '{Hon} {cust}').replace(/Rina/g, '{agent}').replace('Arta Kencana Finance', '{org}').replace(/\bPak\b/g, '{hon}')
    : t.replace('Mr Darmaji', '{Hon} {cust}').replace(/Rina/g, '{agent}').replace('Arta Kencana Finance', '{org}').replace(/\bsir\b/g, '{hon}')
const salesLines: Line[] = SALES_CALL.segments.map((s, i) => {
  const [tags, fid, fen] = SALES_TAGS[i] ?? []
  return [s.speaker === 'agent' ? 'a' : 'c', swap(s.text, 'id'), swap(s.en ?? s.text, 'en'), tags, fid, fen] as Line
})

const MF: ClipLib = {
  'mf-tel-keberatan': { lines: salesLines },
  'mf-tel-salam': {
    lines: [
      ['a', 'Halo, ini dengan {cust}? Mau lanjut pengajuan dana tunai jaminan BPKB?', 'Hello, is this {cust}? Do you want to go ahead with the BPKB-backed cash loan?', 'salam-',
        'Seharusnya: ucapkan salam, sebut nama {agent} dan {org}, lalu minta izin bicara tiga menit sebelum masuk ke pengajuan.',
        'Should have: greet, give the name {agent} and {org}, and ask for three minutes before getting to the application.'],
      ['c', 'Iya, ini siapa ya?', 'Yes, who is this?'],
      ['a', 'Dari {org}, {hon}. Dananya untuk keperluan apa kalau boleh tahu?', 'From {org}, {hon}. May I ask what the money is for?', 'gali+'],
      ['c', 'Buat tambah modal warung, sekitar sepuluh juta.', 'To add capital to my stall, about ten million.'],
      ['a', 'Untuk sepuluh juta tenor 12 bulan, angsurannya sekitar Rp 1.010.000 per bulan.', 'For ten million over 12 months the instalment is about Rp 1,010,000 a month.', 'penawaran+'],
      ['c', 'Waduh, bunganya tinggi juga.', 'Wow, the interest is quite high.'],
      ['a', 'Bisa tenor 18 bulan supaya lebih ringan, sekitar Rp 720.000; total biayanya saya kirim tertulis lewat WA.', 'An 18-month tenor makes it lighter, about Rp 720,000; I will send the total cost in writing by WA.', 'keberatan+ kepatuhan+'],
      ['c', 'Boleh, kirim saja rinciannya.', 'Fine, send me the details.'],
      ['a', 'Saya kirim sekarang, lalu survei ke warung {hon} besok jam 10, bisa?', 'I am sending them now; can we survey your stall tomorrow at 10?', 'closing+'],
    ],
  },
  'mf-tel-gali': {
    lines: [
      ['a', 'Selamat pagi {Hon} {cust}, saya {agent} dari {org}. Boleh minta waktu dua menit?', 'Good morning {Hon} {cust}, this is {agent} from {org}. May I have two minutes?', 'salam+'],
      ['c', 'Boleh, ada apa?', 'Sure, what is it?'],
      ['a', 'Kami ada promo kredit mobil bekas, uang muka mulai 20 persen.', 'We have a used-car loan promo, down payment from 20 percent.', 'gali-',
        'Seharusnya: tanya dulu kendaraan apa yang dicari dan untuk siapa, baru pilih produk yang cocok.',
        'Should have: first ask what vehicle is wanted and for whom, then pick a product that fits.'],
      ['c', 'Saya sebenarnya cari motor buat anak kuliah, bukan mobil.', 'Actually I am looking for a motorbike for my child at college, not a car.'],
      ['a', 'Untuk motor baru angsurannya mulai Rp 780.000 per bulan, tenor 30 bulan.', 'For a new motorbike instalments start at Rp 780,000 a month over 30 months.', 'penawaran+'],
      ['c', 'Anak saya belum kerja, saya takut telat bayar.', 'My child does not work yet, I am afraid of paying late.'],
      ['a', 'Bisa atas nama {hon} dengan jatuh tempo menyesuaikan tanggal gajian, jadi tidak bentrok.', 'It can be in your name, {hon}, with the due date matched to your payday, so nothing clashes.', 'keberatan+'],
      ['a', 'Semua biaya tertulis di perjanjian, tidak ada biaya tersembunyi.', 'Every cost is written in the agreement, no hidden fees.', 'kepatuhan+'],
      ['c', 'Ya sudah, kirim brosurnya dulu.', 'All right, send the brochure first.'],
      ['a', 'Brosur dan simulasinya saya kirim siang ini, lalu saya telepon Kamis pagi untuk jawabannya.', 'I will send the brochure and the simulation this afternoon and call you on Thursday morning for your answer.', 'closing+'],
    ],
  },
  'mf-tel-penawaran': {
    lines: [
      ['a', 'Selamat siang {Hon} {cust}, saya {agent} dari {org}, menindaklanjuti pengajuan kredit motor kemarin.', 'Good afternoon {Hon} {cust}, this is {agent} from {org}, following up on yesterday’s motorbike loan application.', 'salam+'],
      ['c', 'Iya, jadi berapa cicilannya?', 'Yes, so what is the instalment?'],
      ['a', 'Motornya untuk kerja harian atau usaha, {hon}? Biar saya hitung tenor yang pas.', 'Is the bike for daily work or a business, {hon}? So I can work out the right tenor.', 'gali+'],
      ['c', 'Untuk ojek, penghasilan saya harian.', 'For motorbike taxi work, I earn daily.'],
      ['a', 'Nanti tergantung, ada beberapa paket, angsurannya bisa macam-macam.', 'It depends, there are several packages, the instalments vary.', 'penawaran-',
        'Seharusnya: sebut satu angka yang jelas (uang muka, angsuran, tenor), lalu tawarkan bayar mingguan untuk penghasilan harian.',
        'Should have: give one clear figure (down payment, instalment, tenor), then offer weekly payments for a daily income.'],
      ['c', 'Lho, jadi berapa? Saya perlu angka pasti.', 'So how much? I need an exact figure.'],
      ['a', 'Mohon maaf, {hon}; tabel lengkapnya saya kirim lewat WA supaya jelas dan bisa dibandingkan.', 'Apologies, {hon}; I will send the full table by WA so it is clear and you can compare.', 'keberatan+ kepatuhan+'],
      ['c', 'Oke, saya tunggu.', 'OK, I will wait.'],
      ['a', 'Saya kirim jam 2 siang ini; kita jadwalkan tanda tangan di kantor cabang hari Jumat?', 'I will send it at 2 pm today; shall we book the signing at the branch on Friday?', 'closing+'],
    ],
  },
  'mf-tel-closing': {
    lines: [
      ['a', 'Pagi {Hon} {cust}, saya {agent} dari {org}, mau konfirmasi pengajuan dana renovasi rumah.', 'Morning {Hon} {cust}, this is {agent} from {org}, confirming your home renovation loan application.', 'salam+'],
      ['c', 'Iya, saya masih bandingkan dengan tempat lain.', 'Yes, I am still comparing with other lenders.'],
      ['a', 'Yang paling penting buat {hon}: angsuran kecil atau proses cepat?', 'What matters most to you, {hon}: a small instalment or a fast process?', 'gali+'],
      ['c', 'Proses cepat, tukangnya mulai minggu depan.', 'A fast process, the builders start next week.'],
      ['a', 'Kalau berkas lengkap hari ini, dana cair dua hari kerja; angsuran Rp 1,4 juta, tenor 24 bulan.', 'If the papers are complete today, funds are out in two working days; Rp 1.4 million a month over 24 months.', 'penawaran+'],
      ['c', 'Di tempat lain katanya lebih murah.', 'They say it is cheaper elsewhere.'],
      ['a', 'Boleh dibandingkan total biayanya, bukan hanya angsuran; rincian kami tertulis dan tanpa biaya tambahan.', 'Compare the total cost, not just the instalment; ours is in writing with no extra fees.', 'keberatan+ kepatuhan+'],
      ['c', 'Iya, nanti saya pikir lagi.', 'Yes, I will think about it.'],
      ['a', 'Oh begitu, ya sudah, {hon}, ditunggu kabarnya.', 'I see, all right, {hon}, I will wait to hear from you.', 'closing-',
        'Seharusnya: ajak langkah kecil yang pasti, misalnya “Berkasnya saya ambil besok jam 9, supaya dana cair sebelum tukang mulai?”',
        'Should have: propose a small, definite step, e.g. “Shall I collect the papers tomorrow at 9 so the funds are out before the builders start?”'],
    ],
  },
  'mf-wa-kepatuhan': {
    lines: [
      ['c', 'Saya pernah telat bayar kartu kredit. Masih bisa ajukan kredit motor?', 'I once paid a credit card late. Can I still apply for a motorbike loan?'],
      ['a', 'Selamat sore {Hon} {cust}, saya {agent} dari {org}. Telatnya kapan dan sudah lunas?', 'Good afternoon {Hon} {cust}, this is {agent} from {org}. When was it, and is it paid off?', 'salam+ gali+'],
      ['c', 'Dua tahun lalu, sudah lunas. Tapi saya takut ditolak.', 'Two years ago, it is paid off. But I am afraid of being rejected.'],
      ['a', 'Tenang, {hon}, pasti disetujui, saya jamin 100 persen.', 'Don’t worry, {hon}, it will definitely be approved, I guarantee it 100 percent.', 'kepatuhan-',
        'Seharusnya: jangan menjanjikan persetujuan; jelaskan keputusan ada di analis kredit setelah cek riwayat, dan tunggakan yang sudah lunas membantu.',
        'Should have: not promise approval; explain the credit analyst decides after the history check, and a settled arrear helps.'],
      ['a', 'Angsuran motor pilihan {hon} Rp 860.000 per bulan, tenor 24 bulan.', 'The bike you chose is Rp 860,000 a month over 24 months.', 'penawaran+'],
      ['c', 'Oke. Tapi uang mukanya berat.', 'OK. But the down payment is heavy.'],
      ['a', 'Ada pilihan uang muka 15 persen, angsurannya jadi Rp 940.000; dua pilihannya saya kirim.', 'There is a 15 percent down-payment option, then it is Rp 940,000 a month; I will send both options.', 'keberatan+'],
      ['a', 'Survei rumahnya saya jadwalkan Sabtu jam 9 pagi, ya {hon}?', 'Shall I book the home survey for Saturday at 9 am, {hon}?', 'closing+'],
    ],
  },
}
export default MF
