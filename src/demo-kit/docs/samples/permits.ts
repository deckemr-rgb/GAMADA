/**
 * samples/permits.ts — NIB (business ID) specimen and "surat keterangan domisili" (village residence letter),
 * plus an edited domisili variant. Fictional people and businesses; village heads by title only.
 */
import { runBox, unionBox } from '../measure'
import { longDate, makeNik } from '../nik'
import type { Bi, BusinessMeta, PersonMeta, SampleDoc, ScanLook } from '../types'
import { DocBuilder, INK, L, MUTED, SEAL } from './builder'

const W = 840
const H = 1188

/* ------------------------------------------------------------------ NIB */

function makeNib(): SampleDoc {
  const b = new DocBuilder(W, H, { font: 'sans', size: 15, fill: INK })
  const nib = '1711260099017'
  b.shape({ t: 'emblem', x: W / 2 - 40, y: 54, size: 80, tone: '#2f4a8a' })
  b.text(W / 2, 182, 'PERIZINAN BERUSAHA BERBASIS RISIKO', { size: 20, weight: 700, anchor: 'middle', ls: 0.03 })
  b.text(W / 2, 214, 'NOMOR INDUK BERUSAHA', { size: 16, weight: 600, anchor: 'middle', ls: 0.06, fill: MUTED })
  b.field('nib', { id: 'NIB', en: 'Business ID (NIB)' }, nib, W / 2, 262, { size: 34, weight: 700, anchor: 'middle', font: 'mono', ls: 0.08 })
  b.shape({ t: 'line', x1: 84, y1: 292, x2: 756, y2: 292, stroke: INK, sw: 1.2 })
  b.para(84, 330, 'Berdasarkan ketentuan perizinan berusaha berbasis risiko, Pemerintah menerbitkan Nomor Induk Berusaha kepada pelaku usaha berikut:', 672, { lh: 23 })

  const rows: [string, string, string, Bi][] = [
    ['Nama Pelaku Usaha', 'TINI RAHAYU', 'pemilik', { id: 'Nama pemilik', en: 'Owner name' }],
    ['Nama Usaha', 'WARUNG MAKAN BU TINI', 'nama_usaha', { id: 'Nama usaha', en: 'Business name' }],
    ['Alamat Usaha', 'Jl. Panglima Polim No. 7, Kel. Ledok Kulon', 'alamat', L.alamat],
    ['Kecamatan', 'BOJONEGORO', 'kecamatan', L.kecamatan],
    ['KBLI', '56102 · Rumah/Warung Makan', 'kbli', { id: 'KBLI', en: 'Business classification (KBLI)' }],
    ['Skala Usaha', 'Usaha Mikro', 'skala', { id: 'Skala usaha', en: 'Business scale' }],
    ['Status Penanaman Modal', 'PMDN', 'modal', { id: 'Status modal', en: 'Investment status' }],
  ]
  let y = 410
  for (const [k, v, key, lab] of rows) {
    b.text(84, y, k)
    b.text(300, y, ':')
    b.field(key, lab, v, 314, y, { weight: 600 })
    y += 32
  }
  b.para(84, y + 20, 'NIB ini berlaku sebagai identitas berusaha selama pelaku usaha menjalankan kegiatan usahanya dan wajib dimutakhirkan bila terjadi perubahan data.', 672, { lh: 23, size: 14, fill: MUTED })

  b.text(560, 820, 'Diterbitkan di Bojonegoro', { size: 14 })
  b.text(560, 842, 'Tanggal terbit:', { size: 14 })
  b.field('tanggal_terbit', { id: 'Tanggal terbit', en: 'Issue date' }, '2026-03-04', 560 + b.width('Tanggal terbit: ', { size: 14 }), 842, { size: 14, weight: 600 }, { shown: longDate('2026-03-04') })
  b.shape({ t: 'qr', x: 560, y: 864, size: 108, seed: 77 })
  b.fieldBox('ttd', { id: 'Tanda tangan elektronik', en: 'Electronic signature' }, 'ada', { x: 552, y: 856, w: 124, h: 124 })
  b.text(560, 1000, 'Dokumen ditandatangani secara elektronik (dummy)', { size: 11, fill: MUTED, italic: true })

  b.over({ t: 'watermark', text: 'SPESIMEN', cx: W / 2, cy: 640, size: 150, angle: -32, opacity: 0.16, fill: '#b3261e' })
  b.text(W / 2, H - 22, 'SPESIMEN · data fiktif untuk demo GAMADA · bukan dokumen resmi', { anchor: 'middle', size: 10, fill: '#8c88a0' })
  const meta: BusinessMeta = { kind: 'nib', nib, name: 'WARUNG MAKAN BU TINI', owner: 'TINI RAHAYU', kbli: '56102', edited: false }
  return b.build({
    id: 'nib-warung-tini',
    kind: 'nib',
    extractKind: 'document',
    title: { id: 'NIB spesimen · Warung Makan Bu Tini', en: 'Business ID specimen · Warung Makan Bu Tini' },
    caption: { id: 'Usaha mikro · Ledok Kulon', en: 'Micro business · Ledok Kulon' },
    bg: 'nib',
    specimen: true,
    meta,
  })
}

/* ------------------------------------------------------------------ Domisili */

interface DomOpts {
  id: string
  title: Bi
  caption: Bi
  edit?: boolean
  scan?: ScanLook
}

const RIZAL = { name: 'MUHAMMAD RIZAL', gender: 'L' as const, birth: '1991-07-09', serial: 9055, desa: 'SRANAK', kec: 'trucuk' }

function makeDomisili({ id, title, caption, edit, scan }: DomOpts): SampleDoc {
  const b = new DocBuilder(W, H, { font: 'serif', size: 15, fill: INK })
  const nik = makeNik(RIZAL.kec, RIZAL.birth, RIZAL.gender, RIZAL.serial)
  const issued = '2026-11-09'
  const shownIssued = edit ? '2026-11-16' : issued

  b.shape({ t: 'emblem', x: 84, y: 44, size: 92 })
  b.text(470, 78, 'PEMERINTAH KABUPATEN BOJONEGORO', { size: 19, weight: 700, anchor: 'middle' })
  b.text(470, 104, 'KECAMATAN TRUCUK', { size: 19, weight: 700, anchor: 'middle' })
  b.text(470, 132, 'DESA SRANAK', { size: 25, weight: 700, anchor: 'middle', ls: 0.04 })
  b.shape({ t: 'line', x1: 84, y1: 156, x2: 756, y2: 156, stroke: INK, sw: 3 })
  b.shape({ t: 'line', x1: 84, y1: 161, x2: 756, y2: 161, stroke: INK, sw: 1 })

  b.text(W / 2, 222, 'SURAT KETERANGAN DOMISILI', { size: 20, weight: 700, anchor: 'middle', ls: 0.04 })
  b.shape({ t: 'line', x1: W / 2 - 150, y1: 228, x2: W / 2 + 150, y2: 228, stroke: INK, sw: 1.2 })
  b.text(W / 2 - 110, 252, 'Nomor :')
  b.field('nomor', L.nomor, '474/112/412.418.05/2026', W / 2 - 50, 252)

  b.para(84, 304, 'Yang bertanda tangan di bawah ini Kepala Desa Sranak, Kecamatan Trucuk, Kabupaten Bojonegoro, menerangkan dengan sebenarnya bahwa:', 672, { lh: 24, indent: 44 })
  const rows: [string, string, string, Bi, string?][] = [
    ['Nama', RIZAL.name, 'nama', L.nama],
    ['NIK', nik, 'nik', L.nik],
    ['Tempat/Tgl Lahir', `Bojonegoro, ${longDate(RIZAL.birth)}`, 'ttl', { id: 'Tempat/tanggal lahir', en: 'Place/date of birth' }],
    ['Jenis Kelamin', 'Laki-laki', 'jenis_kelamin', L.jk],
    ['Pekerjaan', 'Buruh Harian Lepas', 'pekerjaan', L.pekerjaan],
    ['Alamat', 'RT 002/RW 001, Desa Sranak, Kec. Trucuk', 'alamat', L.alamat],
  ]
  let y = 382
  for (const [k, v, key, lab] of rows) {
    b.text(128, y, k)
    b.text(290, y, ':')
    b.field(key, lab, v, 302, y, key === 'nik' ? { font: 'mono', size: 15 } : {})
    y += 28
  }
  y += 14
  const p2 = b.para(84, y, 'Orang tersebut benar-benar berdomisili di alamat di atas sejak tahun 2014. Surat keterangan ini dibuat untuk keperluan:', 672, { lh: 24, indent: 44 })
  y = (p2[p2.length - 1]?.y ?? y) + 32
  b.field('keperluan', { id: 'Keperluan', en: 'Purpose' }, 'Pendaftaran bantuan sosial korban banjir', W / 2, y, { weight: 700, anchor: 'middle' })
  y += 40
  const p3 = b.para(84, y, 'Surat keterangan ini berlaku 6 (enam) bulan sejak tanggal dikeluarkan. Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.', 672, { lh: 24, indent: 44 })
  y = (p3[p3.length - 1]?.y ?? y) + 60

  const sx = 590
  b.text(sx - 90, y, 'Sranak,')
  if (edit) b.shape({ t: 'patch', x: sx - 34, y: y - 17, w: b.width(longDate(shownIssued)) + 12, h: 23, fill: '#f1eee4' })
  const dateRun = b.field('tanggal', { id: 'Tanggal dikeluarkan', en: 'Issue date' }, shownIssued, sx - 28, y + (edit ? 1 : 0), edit ? { size: 15.6 } : {}, { shown: longDate(shownIssued) })
  b.text(sx, y + 26, 'KEPALA DESA SRANAK', { anchor: 'middle', weight: 700 })
  b.shape({ t: 'signature', x: sx - 70, y: y + 40, w: 150, h: 64, seed: 91 })
  const sealCx = edit ? sx - 40 : sx - 80
  const sealCy = edit ? y + 64 : y + 70
  b.over({ t: 'seal', cx: sealCx, cy: sealCy, r: 52, top: 'PEMERINTAH DESA SRANAK', center: 'TRUCUK', tone: SEAL, rotate: edit ? 4 : -14, opacity: edit ? 0.95 : 0.75 })
  b.fieldBox('ttd', L.ttd, 'ada', { x: sx - 86, y: y + 34, w: 182, h: 78 }, { hard: true })
  b.fieldBox('cap', L.cap, 'ada', { x: sealCx - 56, y: sealCy - 56, w: 112, h: 112 }, { hard: true })
  b.text(sx, y + 128, '( tanda tangan dummy )', { anchor: 'middle', size: 12, fill: MUTED, italic: true })

  b.over({ t: 'watermark', text: 'SPESIMEN', cx: W / 2, cy: 640, size: 150, angle: -32, opacity: 0.15, fill: '#b3261e' })
  b.text(W / 2, H - 22, 'SPESIMEN · data fiktif untuk demo GAMADA · bukan dokumen resmi', { anchor: 'middle', size: 10, font: 'sans', fill: '#8c88a0' })

  if (edit) {
    b.tamper.push({
      box: unionBox([runBox(dateRun, 0.5)]),
      score: 0.88,
      field: 'tanggal',
      reason: { id: 'Tanggal dikeluarkan diketik ulang (huruf dan latar berbeda)', en: 'Issue date re-typed (different glyphs and background)' },
    })
    b.tamper.push({
      box: { x: sealCx - 60, y: sealCy - 60, w: 120, h: 120 },
      score: 0.79,
      field: 'cap',
      reason: { id: 'Cap terlalu tajam dan menutup tanda tangan: kemungkinan ditempel digital', en: 'Stamp too crisp and covering the signature: likely pasted digitally' },
    })
  }

  const meta: PersonMeta = {
    kind: 'domisili',
    nik,
    name: RIZAL.name,
    gender: RIZAL.gender,
    birthDate: RIZAL.birth,
    kecamatanId: RIZAL.kec,
    desa: RIZAL.desa,
    edited: !!edit,
  }

  return b.build({ id, kind: 'domisili', extractKind: 'document', title, caption, bg: 'paper', ...(scan ? { scan } : {}), specimen: true, meta })
}

export const PERMITS: SampleDoc[] = [
  makeNib(),
  makeDomisili({
    id: 'domisili-sranak',
    title: { id: 'Surat keterangan domisili', en: 'Residence certificate' },
    caption: { id: 'Desa Sranak, Trucuk · pindaian', en: 'Sranak village, Trucuk · scan' },
    scan: { rotate: 1.2, scale: 0.98, noise: 0.22, shade: 0.2 },
  }),
  makeDomisili({
    id: 'domisili-sranak-edit',
    title: { id: 'Domisili · sengaja diedit', en: 'Residence certificate · edited' },
    caption: { id: 'Tanggal diubah · cap ditempel', en: 'Date changed · stamp pasted' },
    edit: true,
  }),
]

export const DOMISILI_ISSUED = '2026-11-09'

