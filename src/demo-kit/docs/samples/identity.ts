/**
 * samples/identity.ts — KTP and KK SPECIMENS. Fictional people, generic emblem (never a real coat of arms), a big
 * "SPESIMEN" watermark, NIK = Kemendagri kecamatan code (35.22.xx) + valid date + serial ≥ 9001 (see nik.ts).
 * The layout is a simplified, original card — not a copy of the official design.
 */
import { runBox, unionBox } from '../measure'
import { dmy, makeNik, makeNoKk, SPECIMEN_KEC } from '../nik'
import type { Bi, PersonMeta, SampleDoc, ScanLook } from '../types'
import { DocBuilder, INK, L, MUTED } from './builder'

export interface KtpPerson {
  name: string
  gender: 'L' | 'P'
  birthPlace: string
  birth: string
  blood: string
  street: string
  rtrw: string
  kecamatanId: string
  desa: string
  religion: string
  marital: string
  job: string
  serial: number
  issued: string
  kkRef?: string
  noKk?: string
}

/* ------------------------------------------------------------------ people */

export const SITI: KtpPerson = {
  name: 'SITI NURJANAH',
  gender: 'P',
  birthPlace: 'BOJONEGORO',
  birth: '1988-03-14',
  blood: 'O',
  street: 'JL. MASJID NO. 12',
  rtrw: '003/002',
  kecamatanId: 'kalitidu',
  desa: 'MOJOSARI',
  religion: 'ISLAM',
  marital: 'KAWIN',
  job: 'PEDAGANG',
  serial: 9017,
  issued: '2019-06-12',
  kkRef: 'kk-mojosari',
}

export const BAMBANG: KtpPerson = {
  ...SITI,
  name: 'BAMBANG SUTRISNO',
  gender: 'L',
  birth: '1985-08-02',
  blood: 'A',
  job: 'PETANI/PEKEBUN',
  serial: 9016,
}

export const JOKO: KtpPerson = {
  name: 'JOKO PRASETYO',
  gender: 'L',
  birthPlace: 'BOJONEGORO',
  birth: '1979-11-27',
  blood: 'B',
  street: 'DSN. KRAJAN',
  rtrw: '001/004',
  kecamatanId: 'kanor',
  desa: 'SEDENG',
  religion: 'ISLAM',
  marital: 'KAWIN',
  job: 'WIRASWASTA',
  serial: 9042,
  issued: '2018-02-03',
}

const KK_NO = makeNoKk('kalitidu', '2019-06-10', 9003)

/* ------------------------------------------------------------------ KTP */

const KW = 856
const KH = 540

interface KtpOpts {
  id: string
  title: Bi
  caption: Bi
  p: KtpPerson
  /** edited variant: printed birth date differs from the NIK, photo area pasted */
  edit?: { birth: string }
  scan?: ScanLook
}

function makeKtp({ id, title, caption, p, edit, scan }: KtpOpts): SampleDoc {
  const b = new DocBuilder(KW, KH, { font: 'sans', size: 17, fill: INK })
  const nik = makeNik(p.kecamatanId, p.birth, p.gender, p.serial)
  const kec = SPECIMEN_KEC[p.kecamatanId]?.name.toUpperCase() ?? ''
  const shownBirth = edit?.birth ?? p.birth

  b.shape({ t: 'emblem', x: 30, y: 18, size: 66, tone: '#2f4a8a' })
  b.text(KW / 2 + 20, 50, 'PROVINSI JAWA TIMUR', { size: 24, weight: 700, anchor: 'middle', ls: 0.02 })
  b.text(KW / 2 + 20, 82, 'KABUPATEN BOJONEGORO', { size: 24, weight: 700, anchor: 'middle', ls: 0.02 })

  b.text(36, 136, 'NIK', { size: 25, weight: 700 })
  b.text(150, 136, ':', { size: 25, weight: 700 })
  b.field('nik', L.nik, nik, 168, 136, { size: 28, weight: 700, ls: 0.04, font: 'mono' })

  const LX = 36
  const CX = 214
  const VX = 228
  let y = 176
  const step = 27.5
  const row = (label: string, key: string, lab: Bi, value: string, shown?: string) => {
    b.text(LX, y, label)
    b.text(CX, y, ':')
    const r = b.field(key, lab, value, VX, y, {}, shown ? { shown } : {})
    y += step
    return r
  }
  row('Nama', 'nama', L.nama, p.name)
  // place + date as two runs so the date has its own box (tamper target)
  b.text(LX, y, 'Tempat/Tgl Lahir')
  b.text(CX, y, ':')
  const placeRun = b.field('tempat_lahir', L.tempatLahir, p.birthPlace, VX, y, {}, { shown: `${p.birthPlace},` })
  const dateX = VX + b.width(`${p.birthPlace}, `)
  if (edit) {
    // an edited date: re-typed on an off-tone patch, a hair larger and 1 px low (classic paste artefact)
    const w = b.width(dmy(shownBirth)) + 10
    b.shape({ t: 'patch', x: dateX - 5, y: y - 17, w, h: 23, fill: '#e3edf6' })
  }
  const dateRun = b.field('tanggal_lahir', L.tglLahir, shownBirth, dateX, y + (edit ? 1.2 : 0), edit ? { size: 17.6, fill: '#26283a' } : {}, { shown: dmy(shownBirth) })
  void placeRun
  y += step
  b.text(LX, y, 'Jenis Kelamin')
  b.text(CX, y, ':')
  b.field('jenis_kelamin', L.jk, p.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN', VX, y)
  b.text(470, y, 'Gol. Darah :')
  b.field('gol_darah', L.gol, p.blood, 470 + b.width('Gol. Darah : '), y)
  y += step
  row('Alamat', 'alamat', L.alamat, p.street)
  b.text(LX + 22, y, 'RT/RW')
  b.text(CX, y, ':')
  b.field('rt_rw', L.rtrw, p.rtrw, VX, y)
  y += step
  b.text(LX + 22, y, 'Kel/Desa')
  b.text(CX, y, ':')
  b.field('kel_desa', L.desa, p.desa, VX, y)
  y += step
  b.text(LX + 22, y, 'Kecamatan')
  b.text(CX, y, ':')
  b.field('kecamatan', L.kecamatan, kec, VX, y)
  y += step
  row('Agama', 'agama', L.agama, p.religion)
  row('Status Perkawinan', 'status_perkawinan', L.kawin, p.marital)
  row('Pekerjaan', 'pekerjaan', L.pekerjaan, p.job)
  row('Kewarganegaraan', 'kewarganegaraan', L.wn, 'WNI')
  row('Berlaku Hingga', 'berlaku_hingga', L.berlaku, 'SEUMUR HIDUP')

  /* photo + issue place/date + signature */
  b.shape({ t: 'portrait', x: 640, y: 112, w: 172, h: 222, seed: p.serial, gender: p.gender, bg: edit ? '#c84a3c' : '#b8433a' })
  b.fieldBox('foto', L.foto, 'ada', { x: 636, y: 108, w: 180, h: 230 })
  b.text(726, 362, 'BOJONEGORO', { size: 15, anchor: 'middle' })
  b.text(726, 382, dmy(p.issued), { size: 15, anchor: 'middle' })
  b.shape({ t: 'signature', x: 664, y: 392, w: 128, h: 52, seed: p.serial + 3 })
  b.fieldBox('ttd', L.ttd, 'ada', { x: 656, y: 388, w: 144, h: 60 }, { hard: true })

  /* specimen */
  b.over({ t: 'watermark', text: 'SPESIMEN', cx: KW / 2, cy: KH / 2 + 30, size: 132, angle: -18, opacity: 0.2, fill: '#b3261e' })
  b.text(36, KH - 18, 'SPESIMEN · data fiktif untuk demo GAMADA · bukan dokumen resmi', { size: 11, fill: MUTED })

  if (edit) {
    b.tamper.push({
      box: unionBox([runBox(dateRun, 0.5)]),
      score: 0.91,
      field: 'tanggal_lahir',
      reason: { id: 'Tanggal lahir diketik ulang di atas tambalan warna berbeda', en: 'Birth date re-typed over an off-tone patch' },
    })
    b.tamper.push({
      box: { x: 630, y: 104, w: 192, h: 238 },
      score: 0.66,
      field: 'foto',
      reason: { id: 'Tepi foto tidak menyatu dengan latar kartu', en: 'Photo edges do not blend with the card background' },
    })
  }

  const meta: PersonMeta = {
    kind: 'ktp',
    nik,
    name: p.name,
    gender: p.gender,
    birthDate: shownBirth,
    kecamatanId: p.kecamatanId,
    desa: p.desa,
    ...(p.kkRef ? { kkRef: p.kkRef } : {}),
    edited: !!edit,
  }
  return b.build({ id, kind: 'ktp', extractKind: 'ktp-specimen', title, caption, bg: 'card', ...(scan ? { scan } : {}), specimen: true, meta })
}

/* ------------------------------------------------------------------ KK */

const KKW = 1188
const KKH = 840

interface Member {
  name: string
  gender: 'L' | 'P'
  birthPlace: string
  birth: string
  religion: string
  edu: string
  job: string
  rel: string
  serial: number
}

function makeKk(): SampleDoc {
  const b = new DocBuilder(KKW, KKH, { font: 'sans', size: 15, fill: INK })
  const head = BAMBANG
  const members: Member[] = [
    { name: head.name, gender: 'L', birthPlace: 'BOJONEGORO', birth: head.birth, religion: 'ISLAM', edu: 'SLTA/SEDERAJAT', job: head.job, rel: 'KEPALA KELUARGA', serial: head.serial },
    { name: SITI.name, gender: 'P', birthPlace: 'BOJONEGORO', birth: SITI.birth, religion: 'ISLAM', edu: 'SLTA/SEDERAJAT', job: SITI.job, rel: 'ISTRI', serial: SITI.serial },
    { name: 'AHMAD FAJAR SUTRISNO', gender: 'L', birthPlace: 'BOJONEGORO', birth: '2010-01-21', religion: 'ISLAM', edu: 'SLTP/SEDERAJAT', job: 'PELAJAR/MAHASISWA', rel: 'ANAK', serial: 9021 },
    { name: 'NUR AINI', gender: 'P', birthPlace: 'BOJONEGORO', birth: '2015-09-05', religion: 'ISLAM', edu: 'TAMAT SD/SEDERAJAT', job: 'PELAJAR/MAHASISWA', rel: 'ANAK', serial: 9022 },
  ]

  b.shape({ t: 'emblem', x: KKW / 2 - 32, y: 20, size: 64, tone: '#2f4a8a' })
  b.text(KKW / 2, 116, 'KARTU KELUARGA', { size: 30, weight: 700, anchor: 'middle', ls: 0.06 })
  b.text(KKW / 2 - 118, 148, 'No.', { size: 20, weight: 700 })
  b.field('no_kk', { id: 'Nomor KK', en: 'Family card number' }, KK_NO, KKW / 2 - 78, 148, { size: 20, weight: 700, font: 'mono', ls: 0.04 })

  const info: [string, string, string, Bi][] = [
    ['Nama Kepala Keluarga', head.name, 'kepala_keluarga', { id: 'Kepala keluarga', en: 'Head of family' }],
    ['Alamat', head.street, 'alamat', L.alamat],
    ['RT/RW', head.rtrw, 'rt_rw', L.rtrw],
    ['Kode Pos', '62152', 'kode_pos', { id: 'Kode pos', en: 'Postcode' }],
  ]
  const info2: [string, string, string, Bi][] = [
    ['Desa/Kelurahan', head.desa, 'kel_desa', L.desa],
    ['Kecamatan', 'KALITIDU', 'kecamatan', L.kecamatan],
    ['Kabupaten/Kota', 'BOJONEGORO', 'kabupaten', { id: 'Kabupaten/kota', en: 'Regency/city' }],
    ['Provinsi', 'JAWA TIMUR', 'provinsi', { id: 'Provinsi', en: 'Province' }],
  ]
  info.forEach(([k, v, key, lab], i) => {
    const y = 192 + i * 24
    b.text(40, y, k)
    b.text(220, y, ':')
    b.field(key, lab, v, 234, y, { weight: 600 })
  })
  info2.forEach(([k, v, key, lab], i) => {
    const y = 192 + i * 24
    b.text(700, y, k)
    b.text(850, y, ':')
    b.field(key, lab, v, 864, y, { weight: 600 })
  })

  /* member table */
  const cols: [string, number][] = [
    ['No', 40],
    ['Nama Lengkap', 84],
    ['NIK', 320],
    ['Jenis Kelamin', 520],
    ['Tempat Lahir', 630],
    ['Tanggal Lahir', 748],
    ['Agama', 860],
    ['Pendidikan', 930],
    ['Status Hubungan', 1060],
  ]
  const tTop = 300
  const rowH = 40
  b.shape({ t: 'rect', x: 32, y: tTop, w: KKW - 64, h: rowH, fill: '#e6e2d6' })
  b.shape({ t: 'rect', x: 32, y: tTop, w: KKW - 64, h: rowH * (members.length + 1), stroke: INK, sw: 1 })
  cols.forEach(([c, x]) => b.text(x, tTop + 25, c, { size: 13, weight: 700 }))
  cols.slice(1).forEach(([, x]) => b.shape({ t: 'line', x1: x - 8, y1: tTop, x2: x - 8, y2: tTop + rowH * (members.length + 1), stroke: INK, sw: 0.6 }))
  members.forEach((m, i) => {
    const y = tTop + rowH * (i + 1) + 25
    b.shape({ t: 'line', x1: 32, y1: tTop + rowH * (i + 1), x2: KKW - 32, y2: tTop + rowH * (i + 1), stroke: INK, sw: 0.6 })
    const n = i + 1
    b.text(44, y, String(n), { size: 13 })
    b.field(`anggota_${n}_nama`, { id: `Anggota ${n} · nama`, en: `Member ${n} · name` }, m.name, 84, y, { size: 13 })
    b.field(`anggota_${n}_nik`, { id: `Anggota ${n} · NIK`, en: `Member ${n} · NIK` }, makeNik('kalitidu', m.birth, m.gender, m.serial), 320, y, { size: 13, font: 'mono' })
    b.text(520, y, m.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN', { size: 13 })
    b.text(630, y, m.birthPlace, { size: 13 })
    b.text(748, y, dmy(m.birth), { size: 13 })
    b.text(860, y, m.religion, { size: 13 })
    b.text(930, y, m.edu.split('/')[0] ?? m.edu, { size: 12 })
    b.field(`anggota_${n}_hubungan`, { id: `Anggota ${n} · hubungan`, en: `Member ${n} · relation` }, m.rel, 1060, y, { size: 12 })
  })

  /* footer: issue date, signature, decorative QR (encodes nothing) */
  const fy = 560
  b.text(40, fy, 'Dikeluarkan Tanggal :', { size: 14 })
  b.field('tanggal_terbit', { id: 'Tanggal terbit', en: 'Issue date' }, '2019-06-10', 200, fy, { size: 14, weight: 600 }, { shown: dmy('2019-06-10') })
  b.text(40, fy + 26, 'LEMBAR KE-1 · KEPALA KELUARGA', { size: 12, fill: MUTED })
  b.text(880, fy, 'KEPALA DINAS KEPENDUDUKAN DAN', { size: 13, anchor: 'middle', weight: 600 })
  b.text(880, fy + 20, 'PENCATATAN SIPIL KAB. BOJONEGORO', { size: 13, anchor: 'middle', weight: 600 })
  b.shape({ t: 'qr', x: 816, y: fy + 34, size: 92, seed: 41 })
  b.fieldBox('ttd', { id: 'Tanda tangan elektronik', en: 'Electronic signature' }, 'ada', { x: 806, y: fy + 26, w: 112, h: 110 })
  b.text(880, fy + 152, '( ditandatangani secara elektronik · dummy )', { size: 11, anchor: 'middle', fill: MUTED, italic: true })

  b.over({ t: 'watermark', text: 'SPESIMEN', cx: KKW / 2, cy: 470, size: 170, angle: -14, opacity: 0.17, fill: '#b3261e' })
  b.text(40, KKH - 20, 'SPESIMEN · data fiktif untuk demo GAMADA · bukan dokumen resmi', { size: 11, fill: MUTED })

  const meta: PersonMeta = {
    kind: 'kk',
    nik: makeNik('kalitidu', head.birth, 'L', head.serial),
    name: head.name,
    gender: 'L',
    birthDate: head.birth,
    kecamatanId: 'kalitidu',
    desa: head.desa,
    noKk: KK_NO,
    members: members.map((m) => ({ name: m.name, nik: makeNik('kalitidu', m.birth, m.gender, m.serial), relation: m.rel })),
    edited: false,
  }
  return b.build({
    id: 'kk-mojosari',
    kind: 'kk',
    extractKind: 'document',
    title: { id: 'Kartu Keluarga (spesimen)', en: 'Family card (specimen)' },
    caption: { id: 'Keluarga Bambang Sutrisno · Mojosari, Kalitidu', en: 'Bambang Sutrisno family · Mojosari, Kalitidu' },
    bg: 'sheet',
    specimen: true,
    meta,
  })
}

/** a KTP SPECIMEN for any fictional person (Kenal Mitra KYC subjects): clean, phone-photo look */
export function ktpSpecimen(p: KtpPerson, opts: { id?: string; tilted?: boolean; edit?: { birth: string } } = {}): SampleDoc {
  const name = p.name.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ')
  return makeKtp({
    id: opts.id ?? `ktp-${p.name.split(' ')[0]!.toLowerCase()}`,
    title: { id: `KTP spesimen · ${name}`, en: `ID card specimen · ${name}` },
    caption: opts.edit ? { id: 'Tanggal lahir diubah · foto ditempel', en: 'Birth date changed · photo pasted' } : opts.tilted ? { id: 'Foto HP, sedikit miring', en: 'Phone photo, slightly tilted' } : { id: 'Foto HP', en: 'Phone photo' },
    p,
    ...(opts.edit ? { edit: opts.edit } : {}),
    ...(opts.tilted ? { scan: { rotate: -4.5, rotX: 12, rotY: 8, scale: 0.92, noise: 0.3, shade: 0.45 } } : {}),
  })
}

export const IDENTITY: SampleDoc[] = [
  makeKtp({
    id: 'ktp-siti',
    title: { id: 'KTP spesimen · Siti Nurjanah', en: 'ID card specimen · Siti Nurjanah' },
    caption: { id: 'Bersih · cocok dengan KK', en: 'Clean · matches the family card' },
    p: SITI,
  }),
  makeKtp({
    id: 'ktp-joko',
    title: { id: 'KTP spesimen · Joko Prasetyo', en: 'ID card specimen · Joko Prasetyo' },
    caption: { id: 'Foto HP, sedikit miring', en: 'Phone photo, slightly tilted' },
    p: JOKO,
    scan: { rotate: -4.5, rotX: 12, rotY: 8, scale: 0.92, noise: 0.3, shade: 0.45 },
  }),
  makeKtp({
    id: 'ktp-siti-edit',
    title: { id: 'KTP spesimen · sengaja diedit', en: 'ID card specimen · deliberately edited' },
    caption: { id: 'Tanggal lahir diubah · foto ditempel', en: 'Birth date changed · photo pasted' },
    p: SITI,
    edit: { birth: '1986-03-14' },
  }),
  makeKk(),
  makeKtp({
    id: 'ktp-bambang',
    title: { id: 'KTP spesimen · Bambang Sutrisno', en: 'ID card specimen · Bambang Sutrisno' },
    caption: { id: 'Bersih · cocok dengan KK', en: 'Clean · matches the family card' },
    p: { ...BAMBANG, kkRef: 'kk-mojosari' },
  }),
]

export { KK_NO }

