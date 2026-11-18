/**
 * demos/juara-jualan/clips-asr.ts — insurance transcripts (loaded on intent): 5 phone calls + 1 WA chat.
 */
import type { ClipLib } from './clips'

const ASR: ClipLib = {
  'asr-tel-salam': {
    lines: [
      ['a', 'Ya, halo. Ini soal polis kesehatan yang kemarin.', 'Yes, hello. This is about the health policy from yesterday.', 'salam-',
        'Seharusnya: “Selamat pagi {Hon} {cust}, saya {agent} dari {org}, menelepon soal polis kesehatan keluarga yang {Hon} tanyakan kemarin.”',
        'Should have: “Good morning {Hon} {cust}, this is {agent} from {org}, calling about the family health policy you asked about yesterday.”'],
      ['c', 'Maaf, ini dari mana?', 'Sorry, who is calling?'],
      ['a', 'Dari {org}, {hon}. Keluarga yang mau dilindungi ada berapa orang?', 'From {org}, {hon}. How many family members would be covered?', 'gali+'],
      ['c', 'Saya, istri, dan dua anak.', 'Me, my wife and two children.'],
      ['a', 'Untuk empat orang, paket rawat inap kamar kelas 1 premi Rp 650.000 per bulan.', 'For four people, the first-class inpatient plan is Rp 650,000 a month.', 'penawaran+'],
      ['c', 'Kalau sudah punya BPJS, perlu juga?', 'If I already have BPJS, do I need it?'],
      ['a', 'BPJS tetap jalan, {hon}; polis ini menanggung selisih kamar dan biaya di luar BPJS sesuai ketentuan polis.', 'BPJS stays, {hon}; this policy covers the room upgrade and costs outside BPJS, as the policy terms say.', 'keberatan+ kepatuhan+'],
      ['a', 'Ringkasan manfaatnya saya kirim, lalu kita isi formulir Rabu sore, bagaimana?', 'I will send the benefit summary; shall we fill in the form on Wednesday afternoon?', 'closing+'],
    ],
  },
  'asr-tel-gali': {
    lines: [
      ['a', 'Selamat sore {Hon} {cust}, saya {agent} dari {org}. Ada waktu sebentar?', 'Good afternoon {Hon} {cust}, this is {agent} from {org}. Do you have a moment?', 'salam+'],
      ['c', 'Boleh, lima menit ya.', 'Sure, five minutes.'],
      ['a', 'Kami punya produk unit link dengan hasil investasi yang menarik.', 'We have a unit-linked product with attractive investment returns.', 'gali-',
        'Seharusnya: tanyakan tujuan {Hon} lebih dulu (biaya sekolah anak, pensiun, atau kesehatan) sebelum menyebut produk.',
        'Should have: ask about {Hon}’s goal first (school fees, retirement or health) before naming a product.'],
      ['c', 'Saya sebenarnya cuma mau perlindungan kalau sakit.', 'Actually I only want cover in case I fall ill.'],
      ['a', 'Kalau begitu paket kesehatan murni lebih cocok: premi Rp 280.000 per bulan, rawat inap sampai Rp 500.000 per malam.', 'Then a pure health plan fits better: Rp 280,000 a month, inpatient up to Rp 500,000 a night.', 'penawaran+'],
      ['c', 'Ada masa tunggunya?', 'Is there a waiting period?'],
      ['a', 'Ada, 30 hari untuk penyakit umum dan 12 bulan untuk penyakit tertentu; semuanya tertulis di ringkasan polis.', 'Yes, 30 days for common illness and 12 months for specific conditions; it is all in the policy summary.', 'keberatan+ kepatuhan+'],
      ['a', 'Ringkasannya saya kirim sekarang dan saya telepon lagi besok jam 4 sore?', 'I am sending the summary now; may I call again tomorrow at 4 pm?', 'closing+'],
    ],
  },
  'asr-tel-keberatan': {
    lines: [
      ['a', 'Selamat pagi {Hon} {cust}, saya {agent} dari {org}, soal perpanjangan polis motor {hon}.', 'Good morning {Hon} {cust}, this is {agent} from {org}, about renewing your motorbike policy.', 'salam+'],
      ['a', 'Motornya masih dipakai harian untuk kerja, {hon}?', 'Is the bike still used daily for work, {hon}?', 'gali+'],
      ['c', 'Masih. Tapi premi tahun ini naik, saya keberatan.', 'Yes. But this year’s premium went up, I object to that.'],
      ['a', 'Iya, {hon}, memang naik. Jadi mau diperpanjang?', 'Yes, {hon}, it did go up. So do you want to renew?', 'keberatan-',
        'Seharusnya: akui keberatannya, jelaskan sebabnya (nilai motor dan klaim di wilayah), lalu tawarkan opsi risiko sendiri Rp 300.000 agar premi turun.',
        'Should have: acknowledge the objection, explain why (bike value and local claims), then offer a Rp 300,000 own-risk option to lower the premium.'],
      ['c', 'Ya kalau tetap segini, saya pikir-pikir dulu.', 'If it stays like this, I will think it over.'],
      ['a', 'Premi perpanjangan Rp 1.150.000 per tahun, sudah termasuk tanggungan banjir.', 'The renewal is Rp 1,150,000 a year, flood cover included.', 'penawaran+'],
      ['a', 'Klaim tetap mengikuti syarat polis dan survei kerusakan, {hon}.', 'Claims still follow the policy terms and a damage survey, {hon}.', 'kepatuhan+'],
      ['a', 'Tagihan perpanjangannya saya kirim, jatuh tempo Jumat; bisa dibayar lewat transfer?', 'I will send the renewal bill, due Friday; can you pay by transfer?', 'closing+'],
    ],
  },
  'asr-tel-penawaran': {
    lines: [
      ['a', 'Selamat siang {Hon} {cust}, saya {agent} dari {org}.', 'Good afternoon {Hon} {cust}, this is {agent} from {org}.', 'salam+'],
      ['a', 'Kemarin {hon} isi formulir minat asuransi pendidikan. Anaknya sekarang kelas berapa?', 'Yesterday you filled in an interest form for education insurance. What grade is your child in?', 'gali+'],
      ['c', 'Kelas 3 SD. Saya mau dana kuliahnya aman.', 'Grade 3. I want the college fund to be safe.'],
      ['a', 'Manfaatnya banyak, pokoknya lengkap, nanti bisa disesuaikan.', 'There are lots of benefits, it is complete, we can adjust it later.', 'penawaran-',
        'Seharusnya: sebut satu rencana konkret, misalnya premi Rp 500.000 per bulan selama 10 tahun dengan dana tahap kuliah yang tertulis di ilustrasi.',
        'Should have: name one concrete plan, e.g. Rp 500,000 a month for 10 years with the college payout written in the illustration.'],
      ['c', 'Lengkap itu maksudnya apa? Berapa preminya?', 'What does complete mean? What is the premium?'],
      ['a', 'Mohon maaf kurang jelas, {hon}; ilustrasi tertulis dengan angka pasti saya siapkan supaya bisa dibandingkan.', 'Sorry that was unclear, {hon}; I will prepare a written illustration with exact figures so you can compare.', 'keberatan+ kepatuhan+'],
      ['c', 'Iya, tolong kirim.', 'Yes, please send it.'],
      ['a', 'Ilustrasinya saya kirim hari ini; kita bahas Sabtu pagi di kantor atau lewat video, mana yang lebih nyaman?', 'I will send the illustration today; shall we go through it on Saturday morning at the office or by video?', 'closing+'],
    ],
  },
  'asr-tel-kepatuhan': {
    lines: [
      ['a', 'Selamat pagi {Hon} {cust}, saya {agent} dari {org}, terima kasih sudah mengisi formulir kesehatan.', 'Good morning {Hon} {cust}, this is {agent} from {org}, thank you for filling in the health form.', 'salam+'],
      ['a', 'Ada riwayat penyakit yang sedang dirawat, {hon}?', 'Is there any condition being treated, {hon}?', 'gali+'],
      ['c', 'Saya ada darah tinggi, rutin minum obat.', 'I have high blood pressure and take medicine regularly.'],
      ['a', 'Tidak usah ditulis, {hon}, nanti klaimnya pasti cair semua.', 'No need to write it down, {hon}, your claims will surely all be paid.', 'kepatuhan-',
        'Seharusnya: minta riwayat ditulis jujur di formulir; jelaskan bahwa kondisi yang tidak diungkap bisa membuat klaim ditolak.',
        'Should have: ask for the history to be written honestly; explain that an undisclosed condition can get a claim rejected.'],
      ['c', 'Oh begitu. Preminya berapa?', 'I see. What is the premium?'],
      ['a', 'Premi Rp 420.000 per bulan, rawat inap kelas 1 dan rawat jalan.', 'Rp 420,000 a month, first-class inpatient and outpatient.', 'penawaran+'],
      ['c', 'Lumayan mahal ya.', 'That is rather expensive.'],
      ['a', 'Bisa tanpa rawat jalan, preminya jadi Rp 310.000; manfaat rawat inap tetap.', 'Without outpatient it is Rp 310,000; the inpatient benefit stays the same.', 'keberatan+'],
      ['a', 'Formulirnya saya bantu isi Kamis jam 10, ya {hon}?', 'Shall I help you fill in the form on Thursday at 10, {hon}?', 'closing+'],
    ],
  },
  'asr-wa-closing': {
    lines: [
      ['c', 'Sore, saya lihat iklan asuransi jiwa. Ini untuk siapa saja?', 'Afternoon, I saw an ad for life insurance. Who is it for?'],
      ['a', 'Selamat sore {Hon} {cust}, saya {agent} dari {org}. Tanggungan {hon} ada berapa orang?', 'Good afternoon {Hon} {cust}, this is {agent} from {org}. How many dependants do you have?', 'salam+ gali+'],
      ['c', 'Istri dan satu anak. Saya kerja di lapangan.', 'My wife and one child. I work in the field.'],
      ['a', 'Untuk pekerja lapangan, uang pertanggungan Rp 300 juta dengan premi Rp 210.000 per bulan.', 'For field workers, Rp 300 million of cover at Rp 210,000 a month.', 'penawaran+'],
      ['c', 'Kalau kecelakaan kerja, ditanggung?', 'Is a work accident covered?'],
      ['a', 'Ditanggung sesuai ketentuan polis; daftar pengecualiannya saya kirim tertulis.', 'Covered as the policy terms say; I will send the list of exclusions in writing.', 'keberatan+ kepatuhan+'],
      ['c', 'Oke, nanti saya kabari.', 'OK, I will let you know.'],
      ['a', 'Siap, {hon}, terima kasih.', 'Sure, {hon}, thank you.', 'closing-',
        'Seharusnya: minta satu langkah pasti, misalnya kirim tautan formulir sekarang dan janji telepon Jumat jam 7 malam saat {Hon} sudah di rumah.',
        'Should have: ask for one definite step, e.g. send the form link now and agree a call on Friday at 7 pm when {Hon} is home.'],
    ],
  },
}
export default ASR
