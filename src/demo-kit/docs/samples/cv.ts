/**
 * samples/cv.ts — deterministic generator for 200 fictional CVs (Kenal Mitra "Saring 200 CV") + a renderer that
 * turns one CV into a SampleDoc. Names come from the world name generator (weighted by the region's languages);
 * employers are fictional; e-mail uses the reserved .test TLD; phone numbers are masked.
 */
import { hashString, makeNamer, makeRng, type Rng } from '../../world/rng'
import { SPECIMEN_KEC } from '../nik'
import type { Bi, CvRecord, SampleDoc } from '../types'
import { DocBuilder, INK, MUTED } from './builder'

export const CV = {
  count: 200,
  seed: 42,
  /** default opening the ground-truth fit is computed for */
  opening: { id: 'Staf Administrasi Keuangan', en: 'Finance Administration Staff' } as Bi,
} as const

const ORGS = [
  'Koperasi Sido Makmur',
  'Toko Bangunan Sido Rukun',
  'CV Karya Tirta Sentosa',
  'Warung Makan Bu Tini',
  'PT Agro Tani Bengawan',
  'Klinik Pratama Sehat Sentosa',
  'UD Sayur Segar Ledok',
  'Percetakan Cahaya Ilmu',
  'Minimarket Lumbung Rejeki',
  'Bengkel Motor Jaya Abadi',
  'Katering Rasa Ibu',
  'Konveksi Batik Jonegoroan Asri',
]
const ROLES_PREV = ['Kasir', 'Admin gudang', 'Staf administrasi', 'Staf keuangan', 'Pramuniaga', 'Admin penjualan', 'Operator data', 'Asisten pembukuan', 'Sopir pengiriman', 'Customer service']
const MAJORS: Record<CvRecord['education'], string[]> = {
  'SMA/SMK': ['SMK Akuntansi', 'SMK Perkantoran', 'SMA IPS', 'SMK Pemasaran', 'SMA IPA', 'SMK Teknik Otomotif'],
  D3: ['D3 Akuntansi', 'D3 Administrasi Bisnis', 'D3 Manajemen Informatika', 'D3 Perpajakan'],
  S1: ['S1 Akuntansi', 'S1 Manajemen', 'S1 Ekonomi Pembangunan', 'S1 Sistem Informasi', 'S1 Pendidikan Ekonomi', 'S1 Agroteknologi'],
  S2: ['S2 Manajemen', 'S2 Akuntansi'],
}
const SKILLS = ['Spreadsheet', 'Pembukuan', 'Perpajakan dasar', 'Rekonsiliasi bank', 'Pelayanan pelanggan', 'Komunikasi', 'Administrasi arsip', 'Penjualan', 'Gudang & stok', 'Desain grafis', 'Mengemudi', 'Bahasa Inggris', 'Aplikasi kasir', 'Laporan keuangan']
const RELEVANT = new Set(['Spreadsheet', 'Pembukuan', 'Perpajakan dasar', 'Rekonsiliasi bank', 'Laporan keuangan', 'Administrasi arsip', 'Aplikasi kasir'])
const KEC_IDS = Object.keys(SPECIMEN_KEC)

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.')
}

function makeCv(rng: Rng, namer: ReturnType<typeof makeNamer>, i: number): CvRecord {
  const person = namer()
  const education = rng.weighted<CvRecord['education']>([
    ['SMA/SMK', 0.38],
    ['D3', 0.22],
    ['S1', 0.36],
    ['S2', 0.04],
  ])
  const major = rng.pick(MAJORS[education])
  const years = Math.max(0, Math.round(rng.normal(3.2, 2.4)))
  const skills = rng.sample(SKILLS, rng.int(3, 6))
  const kecamatanId = rng.pick(KEC_IDS)
  const exp: CvRecord['experience'] = []
  let end: number | null = null
  let left = years
  let to = 2026
  while (left > 0 && exp.length < 3) {
    const span = Math.min(left, rng.int(1, 4))
    exp.push({ org: rng.pick(ORGS), title: rng.pick(ROLES_PREV), from: to - span, to: end })
    end = to - span
    to = end
    left -= span
  }
  /* ground-truth fit for "Staf Administrasi Keuangan" */
  const finMajor = /Akuntansi|Perpajakan|Perkantoran|Manajemen|Ekonomi|Administrasi/.test(major)
  const relSkills = skills.filter((s) => RELEVANT.has(s)).length
  const finRole = exp.some((e) => /keuangan|pembukuan|administrasi|Kasir|Admin/i.test(e.title))
  let fit = 10
  fit += { 'SMA/SMK': 3, D3: 10, S1: 13, S2: 11 }[education]
  fit += finMajor ? 14 : 0
  fit += Math.min(relSkills, 4) * 6
  fit += Math.min(years, 6) * 2.5 - (years > 9 ? 4 : 0)
  fit += finRole ? 7 : 0
  fit = Math.round(Math.max(8, Math.min(97, fit + rng.int(-2, 9))))
  const reasons: Bi[] = []
  if (finMajor) reasons.push({ id: `Latar ${major} sesuai posisi`, en: `${major} background fits the role` })
  if (relSkills >= 2) reasons.push({ id: `${relSkills} keahlian relevan (${skills.filter((s) => RELEVANT.has(s)).slice(0, 2).join(', ')})`, en: `${relSkills} relevant skills (${skills.filter((s) => RELEVANT.has(s)).slice(0, 2).join(', ')})` })
  if (years >= 2) reasons.push({ id: `${years} tahun pengalaman kerja`, en: `${years} years of work experience` })
  if (finRole) reasons.push({ id: 'Pernah memegang peran administrasi/keuangan', en: 'Has held an admin/finance role' })
  if (!reasons.length) reasons.push({ id: 'Pengalaman dan keahlian belum sesuai posisi', en: 'Experience and skills do not match the role yet' })
  const tail = String(1000 + ((i * 7919) % 9000)).padStart(4, '0')
  return {
    id: `cv-${String(i + 1).padStart(4, '0')}`,
    name: person.name,
    gender: person.gender,
    role: CV.opening.id,
    years,
    education,
    major,
    skills,
    kecamatanId,
    kecamatan: SPECIMEN_KEC[kecamatanId]?.name ?? kecamatanId,
    phone: `0812-xxxx-${tail}`,
    email: `${slug(person.name)}${i % 7 === 0 ? i : ''}@pelamar.test`,
    experience: exp,
    fit,
    reasons: reasons.slice(0, 3),
  }
}

const cache = new Map<string, CvRecord[]>()
/** Deterministic list of `count` CVs (default 200, seed 42). Cached. */
export function generateCvs(count: number = CV.count, seed: number = CV.seed): CvRecord[] {
  const key = `${count}|${seed}`
  const hit = cache.get(key)
  if (hit) return hit
  const rng = makeRng(hashString(`cv|${seed}`))
  const namer = makeNamer(rng, ['jv'])
  const list = Array.from({ length: count }, (_, i) => makeCv(rng, namer, i))
  cache.set(key, list)
  return list
}

/** Render one CV as a printable document. */
export function cvDoc(cv: CvRecord): SampleDoc {
  const W = 840
  const H = 1188
  const b = new DocBuilder(W, H, { font: 'sans', size: 14.5, fill: INK })
  b.shape({ t: 'rect', x: 0, y: 0, w: 250, h: H, fill: '#ece8dd' })
  b.shape({ t: 'portrait', x: 50, y: 60, w: 150, h: 180, seed: hashString(cv.id), gender: cv.gender, bg: '#c9c3b2' })
  b.text(40, 290, 'KONTAK', { size: 12, weight: 700, ls: 0.12, fill: MUTED })
  b.field('telepon', { id: 'Telepon', en: 'Phone' }, cv.phone, 40, 316, { size: 13 })
  b.field('email', { id: 'E-mail', en: 'E-mail' }, cv.email, 40, 338, { size: 12 })
  b.text(40, 360, `Kec. ${cv.kecamatan}, Bojonegoro`, { size: 13 })
  b.text(40, 410, 'KEAHLIAN', { size: 12, weight: 700, ls: 0.12, fill: MUTED })
  const skillRuns = cv.skills.map((s, i) => b.text(40, 436 + i * 22, `• ${s}`, { size: 13 }))
  b.fieldRuns('keahlian', { id: 'Keahlian', en: 'Skills' }, cv.skills.join(', '), skillRuns)

  b.field('nama', { id: 'Nama', en: 'Name' }, cv.name, 290, 100, { size: 30, weight: 700 })
  b.field('posisi', { id: 'Posisi dilamar', en: 'Position applied' }, cv.role, 290, 132, { size: 16, fill: '#0b6a59', weight: 600 })
  b.para(290, 176, `Pelamar dengan ${cv.years} tahun pengalaman kerja, berdomisili di Kecamatan ${cv.kecamatan}. Terbiasa bekerja teliti, rapi, dan tepat waktu.`, 500, { lh: 22, size: 14, fill: MUTED })

  b.text(290, 268, 'PENDIDIKAN', { size: 12, weight: 700, ls: 0.12, fill: MUTED })
  b.field('pendidikan', { id: 'Pendidikan', en: 'Education' }, `${cv.education} · ${cv.major}`, 290, 294, { weight: 600 }, { shown: cv.major })
  b.text(290, 316, cv.education === 'SMA/SMK' ? 'Sekolah menengah di Bojonegoro' : 'Perguruan tinggi di Jawa Timur', { size: 13, fill: MUTED })

  b.text(290, 370, 'PENGALAMAN', { size: 12, weight: 700, ls: 0.12, fill: MUTED })
  let y = 396
  const expRuns = []
  for (const e of cv.experience) {
    expRuns.push(b.text(290, y, `${e.title} · ${e.org}`, { weight: 600 }))
    b.text(290, y + 20, `${e.from} – ${e.to ?? 'sekarang'}`, { size: 13, fill: MUTED })
    y += 54
  }
  if (!cv.experience.length) expRuns.push(b.text(290, y, 'Lulusan baru · belum ada pengalaman kerja', { size: 14, fill: MUTED }))
  b.fieldRuns('pengalaman', { id: 'Pengalaman', en: 'Experience' }, `${cv.years} tahun`, expRuns)
  b.text(W / 2, H - 22, 'CV fiktif · dibangkitkan untuk demo GAMADA', { anchor: 'middle', size: 10, fill: '#8c88a0' })
  return b.build({
    id: cv.id,
    kind: 'cv',
    extractKind: 'cv',
    title: { id: `CV · ${cv.name}`, en: `CV · ${cv.name}` },
    caption: { id: `${cv.education} · ${cv.years} th pengalaman`, en: `${cv.education} · ${cv.years} yrs experience` },
    bg: 'paper',
    specimen: false,
    meta: { kind: 'cv', cv },
  })
}
