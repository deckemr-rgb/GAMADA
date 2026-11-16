/**
 * samples/letters.ts — incoming letters for Naskah Pintar (P3) and the tour. All senders are institutions by title
 * or fictional companies; signatories appear by title only (officials are never named). Three letters are
 * "scans" (skewed, noisy) that the viewer can straighten.
 */
import { longDate } from '../nik'
import type { Bi, LetterClass, LetterMeta, Run, SampleDoc, ScanLook } from '../types'
import { DocBuilder, INK, L, MUTED, SEAL } from './builder'

const W = 840
const H = 1188
const ML = 84
const MR = 756

type BodyPart = string | { table: [string, string, string?][] }

interface LetterSpec {
  id: string
  title: Bi
  caption: Bi
  kop: { l1: string; l2: string; addr: string; company?: boolean }
  place: string
  date: string
  number: string
  sifat: LetterMeta['sifat']
  lampiran: string
  hal: string
  to: string[]
  body: BodyPart[]
  sign: string[]
  seal: { top: string; center: string }
  tembusan?: string[]
  scan?: ScanLook
  cls: LetterClass
  due: string | null
  summary: [Bi, Bi, Bi]
  disposition: LetterMeta['disposition']
  subject: Bi
  from: string
}

const SIFAT_LABEL: Record<LetterMeta['sifat'], string> = { segera: 'Segera', biasa: 'Biasa', rahasia: 'Rahasia' }

function makeLetter(s: LetterSpec): SampleDoc {
  const b = new DocBuilder(W, H, { font: 'serif', size: 15, fill: INK })

  /* kop */
  b.shape({ t: 'emblem', x: ML, y: 44, size: 96 })
  const cx = (ML + 110 + MR) / 2
  b.field('pengirim', L.pengirim, s.from, cx, 78, { size: s.kop.company ? 26 : 20, weight: 700, anchor: 'middle', ls: 0.02 }, { shown: s.kop.l1 })
  b.text(cx, 108, s.kop.l2, { size: s.kop.company ? 14 : 25, weight: 700, anchor: 'middle', ls: 0.03 })
  b.text(cx, 134, s.kop.addr, { size: 12.5, anchor: 'middle', fill: MUTED })
  b.shape({ t: 'line', x1: ML, y1: 156, x2: MR, y2: 156, stroke: INK, sw: 3 })
  b.shape({ t: 'line', x1: ML, y1: 161, x2: MR, y2: 161, stroke: INK, sw: 1 })

  /* place + date (right) */
  const dateText = longDate(s.date)
  b.field('tanggal', L.tanggal, s.date, MR, 204, { anchor: 'end' }, { shown: dateText })
  b.text(MR - b.width(dateText) - 6, 204, `${s.place},`, { anchor: 'end' })

  /* number block */
  const rows: [string, string, string][] = [
    ['Nomor', s.number, 'nomor'],
    ['Sifat', SIFAT_LABEL[s.sifat], 'sifat'],
    ['Lampiran', s.lampiran, 'lampiran'],
  ]
  let y = 244
  for (const [k, v, key] of rows) {
    b.text(ML, y, k)
    b.text(ML + 82, y, ':')
    const label = key === 'nomor' ? L.nomor : key === 'sifat' ? L.sifat : L.lampiran
    b.field(key, label, v, ML + 94, y)
    y += 24
  }
  b.text(ML, y, 'Hal')
  b.text(ML + 82, y, ':')
  const halRuns = b.para(ML + 94, y, s.hal, 300, { weight: 700, lh: 21 })
  b.fieldRuns('perihal', L.perihal, s.hal, halRuns)

  /* addressee (right) */
  let ty = 244
  const toRuns: Run[] = []
  b.text(500, ty, 'Kepada')
  ty += 24
  s.to.forEach((line, i) => {
    toRuns.push(b.text(i === 0 ? 500 : 528, ty, i === 0 ? `Yth. ${line}` : line))
    ty += 22
  })
  b.fieldRuns('tujuan', L.tujuan, s.to.join(' '), toRuns)
  b.text(528, ty + 2, 'di -')
  b.text(552, ty + 26, 'BOJONEGORO', { weight: 700, ls: 0.04 })

  /* body */
  y = Math.max(y + halRuns.length * 21, ty + 26) + 46
  for (const part of s.body) {
    if (typeof part === 'string') {
      const runs = b.para(ML, y, part, MR - ML, { lh: 24, indent: 44 })
      y = (runs[runs.length - 1]?.y ?? y) + 34
    } else {
      for (const [k, v, key] of part.table) {
        b.text(ML + 44, y, k)
        b.text(ML + 170, y, ':')
        if (key) b.field(key, key === 'acara' ? L.acara : L.tenggat, s.due ?? v, ML + 182, y, {}, { shown: v })
        else b.text(ML + 182, y, v)
        y += 24
      }
      y += 12
    }
  }

  /* signature block (title only) */
  const sx = 590
  y = y + 28
  s.sign.forEach((line, i) => b.text(sx, y + i * 21, line, { anchor: 'middle', weight: i === s.sign.length - 1 ? 700 : 400 }))
  const sigY = y + s.sign.length * 21 + 4
  b.shape({ t: 'signature', x: sx - 70, y: sigY, w: 150, h: 64, seed: s.id.length * 7 + s.date.charCodeAt(9) })
  b.over({ t: 'seal', cx: sx - 78, cy: sigY + 30, r: 50, top: s.seal.top, center: s.seal.center, tone: SEAL, rotate: -12, opacity: 0.78 })
  b.fieldBox('ttd', L.ttd, 'ada', { x: sx - 132, y: sigY - 22, w: 220, h: 108 }, { hard: true })
  const titleY = sigY + 92
  b.text(sx, titleY, s.sign[s.sign.length - 1] === '' ? '' : `( ${s.kop.company ? 'Direktur Utama' : 'tanda tangan elektronik dummy'} )`, {
    anchor: 'middle',
    size: 12,
    fill: MUTED,
    italic: true,
  })

  if (s.tembusan?.length) {
    let ty2 = Math.max(titleY + 44, 1040)
    b.text(ML, ty2, 'Tembusan:', { size: 13, weight: 700 })
    s.tembusan.forEach((t, i) => b.text(ML, (ty2 += 19), `${i + 1}. ${t}`, { size: 13 }))
  }
  b.text(W / 2, H - 22, 'Dokumen simulasi GAMADA · bukan dokumen resmi', { anchor: 'middle', size: 10, font: 'sans', fill: '#8c88a0' })

  return b.build({
    id: s.id,
    kind: 'letter',
    extractKind: 'document',
    title: s.title,
    caption: s.caption,
    bg: 'paper',
    ...(s.scan ? { scan: s.scan } : {}),
    specimen: false,
    meta: {
      kind: 'letter',
      number: s.number,
      date: s.date,
      from: s.from,
      to: s.to.join(' '),
      subject: s.subject,
      cls: s.cls,
      sifat: s.sifat,
      due: s.due,
      summary: s.summary,
      disposition: s.disposition,
    },
  })
}

export const LETTERS: SampleDoc[] = [
  makeLetter({
    id: 'surat-undangan-kalitidu',
    title: { id: 'Undangan rapat kesiapsiagaan banjir', en: 'Invitation: flood preparedness meeting' },
    caption: { id: 'Camat Kalitidu · pindaian miring', en: 'Head of Kalitidu district · skewed scan' },
    kop: { l1: 'PEMERINTAH KABUPATEN BOJONEGORO', l2: 'KECAMATAN KALITIDU', addr: 'Jalan Raya Kalitidu · Kalitidu, Bojonegoro, Jawa Timur' },
    place: 'Kalitidu',
    date: '2026-11-12',
    number: '005/214/412.416/2026',
    sifat: 'segera',
    lampiran: '1 (satu) berkas',
    hal: 'Undangan Rapat Koordinasi Kesiapsiagaan Banjir',
    to: ['Bupati Bojonegoro'],
    body: [
      'Menindaklanjuti peringatan dini kenaikan debit Bengawan Solo dan prakiraan hujan lebat pada pekan ketiga November, kami mengundang Bapak/Ibu untuk hadir pada rapat koordinasi yang akan dilaksanakan pada:',
      { table: [['Hari/tanggal', 'Kamis, 19 November 2026', 'acara'], ['Pukul', '09.00 WIB s.d. selesai'], ['Tempat', 'Pendopo Kecamatan Kalitidu'], ['Acara', 'Kesiapsiagaan banjir & titik evakuasi']] },
      'Mengingat pentingnya acara tersebut, kami mohon kehadiran Bapak/Ibu tepat waktu. Daftar titik rawan genangan per desa kami lampirkan. Atas perhatian dan kehadirannya kami sampaikan terima kasih.',
    ],
    sign: ['CAMAT KALITIDU'],
    seal: { top: 'KECAMATAN KALITIDU', center: 'BOJONEGORO' },
    tembusan: ['Kepala Pelaksana BPBD Kabupaten Bojonegoro', 'Kepala Dinas PUPR Kabupaten Bojonegoro'],
    scan: { rotate: -2.4, skewX: 0.8, rotX: 6, scale: 0.97, noise: 0.35, shade: 0.4 },
    cls: 'undangan',
    due: '2026-11-19',
    subject: { id: 'Undangan rapat koordinasi kesiapsiagaan banjir', en: 'Invitation to a flood-preparedness coordination meeting' },
    from: 'Camat Kalitidu',
    summary: [
      { id: 'Camat Kalitidu mengundang Bupati ke rapat koordinasi kesiapsiagaan banjir.', en: 'The Head of Kalitidu district invites the Regent to a flood-preparedness meeting.' },
      { id: 'Kamis, 19 November 2026 pukul 09.00 di Pendopo Kecamatan Kalitidu.', en: 'Thursday 19 November 2026, 09:00, at the Kalitidu district hall.' },
      { id: 'Lampiran berisi titik rawan genangan per desa; mohon hadir tepat waktu.', en: 'Attachment lists flood-prone points per village; punctual attendance requested.' },
    ],
    disposition: {
      to: ['bpbd', 'pupr'],
      instruction: { id: 'Hadiri dan bawa data titik rawan genangan serta kesiapan pompa.', en: 'Attend and bring flood-point data and pump readiness.' },
      note: { id: 'Laporkan hasil rapat ke Sekda paling lambat Jumat.', en: 'Report the outcome to the Regional Secretary by Friday.' },
    },
  }),
  makeLetter({
    id: 'surat-permohonan-ngujo',
    title: { id: 'Permohonan karung pasir & perbaikan tanggul', en: 'Request: sandbags & embankment repair' },
    caption: { id: 'Kepala Desa Ngujo · foto HP, kusut', en: 'Head of Ngujo village · phone photo, creased' },
    kop: { l1: 'PEMERINTAH KABUPATEN BOJONEGORO', l2: 'DESA NGUJO', addr: 'Kecamatan Kalitidu · Kabupaten Bojonegoro' },
    place: 'Ngujo',
    date: '2026-11-15',
    number: '140/087/412.416.12/2026',
    sifat: 'segera',
    lampiran: '3 (tiga) lembar foto',
    hal: 'Permohonan Bantuan Karung Pasir dan Perbaikan Tanggul',
    to: ['Bupati Bojonegoro', 'melalui Kepala Pelaksana BPBD'],
    body: [
      'Dengan hormat, kami laporkan bahwa tanggul sungai di belakang balai desa mengalami rembesan sepanjang ±60 meter sejak hujan deras Sabtu malam. Air sudah menggenangi 2 RT dan 14 rumah warga.',
      'Sehubungan dengan hal tersebut, kami mohon bantuan 1.500 karung pasir dan penanganan darurat tanggul paling lambat tanggal 20 November 2026 sebelum puncak hujan.',
      { table: [['Tenggat', '20 November 2026', 'tenggat']] },
      'Demikian permohonan ini kami sampaikan. Atas perhatian dan bantuannya kami ucapkan terima kasih.',
    ],
    sign: ['KEPALA DESA NGUJO'],
    seal: { top: 'PEMERINTAH DESA NGUJO', center: 'KALITIDU' },
    scan: { rotate: 3.2, skewX: -1.2, rotX: 10, rotY: -6, scale: 0.94, noise: 0.55, shade: 0.6 },
    cls: 'permohonan',
    due: '2026-11-20',
    subject: { id: 'Permohonan karung pasir dan perbaikan tanggul', en: 'Request for sandbags and embankment repair' },
    from: 'Kepala Desa Ngujo',
    summary: [
      { id: 'Tanggul di belakang balai Desa Ngujo merembes ±60 m; 14 rumah tergenang.', en: 'The embankment behind Ngujo village hall is seeping (~60 m); 14 homes flooded.' },
      { id: 'Desa meminta 1.500 karung pasir dan perbaikan darurat tanggul.', en: 'The village asks for 1,500 sandbags and emergency embankment repair.' },
      { id: 'Tenggat 20 November 2026, sebelum puncak hujan.', en: 'Deadline 20 November 2026, before peak rainfall.' },
    ],
    disposition: {
      to: ['bpbd', 'pupr'],
      instruction: { id: 'Kirim karung pasir hari ini dan tinjau tanggul bersama Dinas PUPR.', en: 'Send sandbags today and inspect the embankment with Public Works.' },
      note: { id: 'Prioritas: lewat tenggat berisiko banjir permukiman.', en: 'Priority: missing the deadline risks flooding homes.' },
    },
  }),
  makeLetter({
    id: 'surat-laporan-bpbd',
    title: { id: 'Laporan kaji cepat genangan', en: 'Rapid flood assessment report' },
    caption: { id: 'BPBD · dokumen digital', en: 'Disaster agency · digital document' },
    kop: { l1: 'PEMERINTAH KABUPATEN BOJONEGORO', l2: 'BADAN PENANGGULANGAN BENCANA DAERAH', addr: 'Bojonegoro, Jawa Timur · Pusdalops siaga 24 jam' },
    place: 'Bojonegoro',
    date: '2026-11-16',
    number: '360/431/412.208/2026',
    sifat: 'biasa',
    lampiran: '1 (satu) berkas',
    hal: 'Laporan Kaji Cepat Genangan Bengawan Solo',
    to: ['Bupati Bojonegoro'],
    body: [
      'Bersama ini kami laporkan hasil kaji cepat genangan per 16 November 2026 pukul 06.00 WIB. Tinggi muka air di pos pantau kota berada pada status Siaga II dan cenderung naik.',
      'Genangan tercatat di 4 kecamatan (Trucuk, Kalitidu, Bojonegoro, Kanor) dengan 312 rumah terdampak. Belum ada pengungsian; 3 dapur umum disiapkan.',
      'Kami merekomendasikan penyiapan logistik bansos dan layanan kesehatan di titik terdampak dalam 2 × 24 jam.',
    ],
    sign: ['KEPALA PELAKSANA BPBD'],
    seal: { top: 'BPBD KAB. BOJONEGORO', center: 'PUSDALOPS' },
    cls: 'laporan',
    due: null,
    subject: { id: 'Laporan kaji cepat genangan Bengawan Solo', en: 'Rapid assessment of Bengawan Solo flooding' },
    from: 'Kepala Pelaksana BPBD',
    summary: [
      { id: 'Status Siaga II di pos pantau kota, muka air cenderung naik.', en: 'Alert level II at the city gauge, water level rising.' },
      { id: '312 rumah terdampak di 4 kecamatan; belum ada pengungsian.', en: '312 homes affected in 4 districts; no evacuation yet.' },
      { id: 'Rekomendasi: logistik bansos dan layanan kesehatan dalam 48 jam.', en: 'Recommendation: aid logistics and health services within 48 hours.' },
    ],
    disposition: {
      to: ['dinsos', 'dinkes'],
      instruction: { id: 'Siapkan logistik bansos dan pos kesehatan di 4 kecamatan terdampak.', en: 'Prepare aid logistics and health posts in the 4 affected districts.' },
      note: { id: 'Koordinasikan data penerima dengan Cek Berkas.', en: 'Coordinate beneficiary data with Cek Berkas.' },
    },
  }),
  makeLetter({
    id: 'surat-audiensi-agro',
    title: { id: 'Permohonan audiensi kemitraan petani', en: 'Request: farmer partnership audience' },
    caption: { id: 'Perusahaan fiktif · pindaian', en: 'Fictional company · scan' },
    kop: { l1: 'PT AGRO TANI BENGAWAN', l2: 'Perusahaan fiktif untuk demo · pengolahan hasil pertanian', addr: 'Kawasan Industri Kecil Kapas · Bojonegoro', company: true },
    place: 'Bojonegoro',
    date: '2026-11-10',
    number: 'ATB/EXT/2026/1147',
    sifat: 'biasa',
    lampiran: '1 (satu) proposal',
    hal: 'Permohonan Audiensi Kemitraan Petani Jagung',
    to: ['Bupati Bojonegoro'],
    body: [
      'Dengan hormat, PT Agro Tani Bengawan bermaksud menjalin kemitraan pembelian jagung pipil dengan kelompok tani di Kecamatan Kapas, Balen, dan Sumberrejo untuk musim tanam 2027.',
      'Kami mohon kesempatan beraudiensi untuk memaparkan skema harga, pendampingan budidaya, dan rencana gudang pengering. Proposal ringkas kami lampirkan.',
      'Kami menyesuaikan waktu dengan agenda Bapak/Ibu, sebaiknya sebelum akhir November 2026.',
    ],
    sign: ['PT AGRO TANI BENGAWAN', 'HENDRA WIJAYA'],
    seal: { top: 'PT AGRO TANI BENGAWAN', center: 'BOJONEGORO' },
    scan: { rotate: 1.6, skewX: 0.6, scale: 0.98, noise: 0.28, shade: 0.25 },
    cls: 'permohonan',
    due: '2026-11-30',
    subject: { id: 'Permohonan audiensi kemitraan petani jagung', en: 'Request for an audience on a maize-farmer partnership' },
    from: 'PT Agro Tani Bengawan',
    summary: [
      { id: 'Perusahaan meminta audiensi soal kemitraan jagung dengan kelompok tani.', en: 'A company requests an audience on a maize partnership with farmer groups.' },
      { id: 'Cakupan: Kapas, Balen, Sumberrejo; musim tanam 2027.', en: 'Scope: Kapas, Balen, Sumberrejo; 2027 planting season.' },
      { id: 'Waktu fleksibel, diharapkan sebelum akhir November.', en: 'Flexible timing, preferably before the end of November.' },
    ],
    disposition: {
      to: ['distan', 'dpmptsp'],
      instruction: { id: 'Telaah proposal dan jadwalkan audiensi bersama Dinas Pertanian.', en: 'Review the proposal and schedule the audience with Agriculture.' },
      note: { id: 'Pastikan harga beli tidak merugikan petani.', en: 'Make sure the buying price is fair to farmers.' },
    },
  }),
  makeLetter({
    id: 'surat-edaran-siaga',
    title: { id: 'Edaran kesiapsiagaan musim hujan', en: 'Circular: rainy-season preparedness' },
    caption: { id: 'Instansi provinsi · dokumen digital', en: 'Provincial agency · digital document' },
    kop: { l1: 'PEMERINTAH PROVINSI JAWA TIMUR', l2: 'BADAN PENANGGULANGAN BENCANA DAERAH', addr: 'Surabaya · Jawa Timur' },
    place: 'Surabaya',
    date: '2026-11-09',
    number: '360/2291/207.4/2026',
    sifat: 'biasa',
    lampiran: '-',
    hal: 'Peningkatan Kesiapsiagaan Menghadapi Puncak Musim Hujan',
    to: ['Bupati/Wali Kota se-Jawa Timur'],
    body: [
      'Memperhatikan prakiraan cuaca puncak musim hujan pada November 2026 sampai Februari 2027, kabupaten/kota diminta meningkatkan kesiapsiagaan penanggulangan banjir dan tanah longsor.',
      'Langkah yang perlu dilakukan antara lain: memastikan posko siaga aktif 24 jam, memutakhirkan peta rawan bencana, menyiapkan logistik, dan menyebarluaskan informasi peringatan dini kepada masyarakat.',
      'Laporan kesiapsiagaan agar disampaikan paling lambat 30 November 2026.',
    ],
    sign: ['KEPALA PELAKSANA'],
    seal: { top: 'BPBD PROVINSI', center: 'JAWA TIMUR' },
    cls: 'edaran',
    due: '2026-11-30',
    subject: { id: 'Peningkatan kesiapsiagaan menghadapi puncak musim hujan', en: 'Heightened preparedness for the peak rainy season' },
    from: 'Kepala Pelaksana BPBD Provinsi',
    summary: [
      { id: 'Provinsi meminta kesiapsiagaan banjir dan longsor ditingkatkan.', en: 'The province asks for heightened flood and landslide preparedness.' },
      { id: 'Posko 24 jam, peta rawan, logistik, dan penyebaran peringatan dini.', en: '24-hour posts, hazard maps, logistics and early-warning outreach.' },
      { id: 'Laporan kesiapsiagaan paling lambat 30 November 2026.', en: 'Preparedness report due 30 November 2026.' },
    ],
    disposition: {
      to: ['bpbd', 'diskominfo'],
      instruction: { id: 'Susun laporan kesiapsiagaan dan siarkan peringatan dini lewat kanal resmi.', en: 'Compile the preparedness report and broadcast early warnings on official channels.' },
      note: { id: 'Tenggat laporan 30 November.', en: 'Report due 30 November.' },
    },
  }),
  makeLetter({
    id: 'surat-nodin-pupr',
    title: { id: 'Nota dinas kebutuhan pompa air', en: 'Memo: portable pump needs' },
    caption: { id: 'Dinas PUPR · dokumen digital', en: 'Public Works · digital document' },
    kop: { l1: 'PEMERINTAH KABUPATEN BOJONEGORO', l2: 'DINAS PEKERJAAN UMUM DAN PENATAAN RUANG', addr: 'Bojonegoro, Jawa Timur' },
    place: 'Bojonegoro',
    date: '2026-11-16',
    number: '600/1189/412.205/2026',
    sifat: 'segera',
    lampiran: '1 (satu) lembar',
    hal: 'Kebutuhan Pompa Air Portabel Tambahan',
    to: ['Bupati Bojonegoro', 'melalui Sekretaris Daerah'],
    body: [
      'Berdasarkan pemantauan genangan dua hari terakhir, kapasitas pompa yang tersedia (6 unit) belum mencukupi untuk titik genangan di Trucuk, Kalitidu, dan Kanor.',
      'Kami mengusulkan penambahan 4 unit pompa air portabel kapasitas 50 L/detik melalui pinjam pakai dari balai wilayah sungai, dengan dukungan BBM dari belanja tidak terduga.',
      { table: [['Dibutuhkan', 'paling lambat 18 November 2026', 'tenggat']] },
    ],
    sign: ['KEPALA DINAS PUPR'],
    seal: { top: 'DINAS PUPR', center: 'BOJONEGORO' },
    cls: 'nota-dinas',
    due: '2026-11-18',
    subject: { id: 'Kebutuhan pompa air portabel tambahan', en: 'Additional portable water pumps needed' },
    from: 'Kepala Dinas PUPR',
    summary: [
      { id: 'Enam pompa yang ada tidak cukup untuk genangan di Trucuk, Kalitidu, Kanor.', en: 'The six available pumps cannot cover flooding in Trucuk, Kalitidu and Kanor.' },
      { id: 'Usul: pinjam 4 pompa 50 L/detik dari balai wilayah sungai.', en: 'Proposal: borrow 4 pumps (50 L/s) from the river basin office.' },
      { id: 'BBM dari belanja tidak terduga; dibutuhkan paling lambat 18 November.', en: 'Fuel from contingency funds; needed by 18 November.' },
    ],
    disposition: {
      to: ['pupr', 'bappeda'],
      instruction: { id: 'Setujui pinjam pakai pompa; Bappeda siapkan dukungan anggaran BBM.', en: 'Approve the pump loan; Planning prepares fuel budget support.' },
      note: { id: 'Batas 18 November.', en: 'Due 18 November.' },
    },
  }),
]
