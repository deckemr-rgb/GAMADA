/**
 * samples/cv-data.ts — deterministic generator for the fictional CVs (Kenal Mitra "Saring 200 CV") and the screening
 * rule, WITHOUT the document renderer (cv.ts), so the world extension can build its 200 candidates cheaply.
 * Names come from the world name generator; employers are fictional; e-mail uses the reserved .test TLD.
 */
import { hashString, makeRng, type Rng } from '../../world/prng'
import { makeNamer } from '../../world/names'
import { SPECIMEN_KEC } from '../nik'
import type { Bi, CvRecord } from '../types'

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
/** default domicile list: the Bojonegoro specimen kecamatan */
const KEC_DEFAULT: { id: string; name: string }[] = Object.keys(SPECIMEN_KEC).map((id) => ({ id, name: SPECIMEN_KEC[id]?.name ?? id }))

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.')
}

function makeCv(rng: Rng, namer: ReturnType<typeof makeNamer>, i: number, kecs: { id: string; name: string }[]): CvRecord {
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
  const kec = rng.pick(kecs)
  const kecamatanId = kec.id
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
    kecamatan: kec.name,
    phone: `0812-xxxx-${tail}`,
    email: `${slug(person.name)}${i % 7 === 0 ? i : ''}@pelamar.test`,
    experience: exp,
    fit,
    reasons: reasons.slice(0, 3),
  }
}

const cache = new Map<string, CvRecord[]>()
/**
 * Deterministic list of `count` CVs (default 200, seed 42). `kecamatan` = the domicile list (the world passes its
 * region's kecamatan; default the Bojonegoro specimen list). Cached.
 */
export function generateCvs(count: number = CV.count, seed: number = CV.seed, kecamatan: { id: string; name: string }[] = KEC_DEFAULT): CvRecord[] {
  const key = `${count}|${seed}|${kecamatan.map((k) => k.id).join(',')}`
  const hit = cache.get(key)
  if (hit) return hit
  const rng = makeRng(hashString(`cv|${seed}`))
  const namer = makeNamer(rng, ['jv'])
  const kecs = kecamatan.length ? kecamatan : KEC_DEFAULT
  const list = Array.from({ length: count }, (_, i) => makeCv(rng, namer, i, kecs))
  cache.set(key, list)
  return list
}


/* ------------------------------------------------------------------ screening rule (Kenal Mitra) */

export interface CvCriteria {
  /** minimum education */
  education?: CvRecord['education']
  minYears?: number
  /** required skills (all) */
  skills?: string[]
  /** max km from the shop; `distanceKm(kecamatanId)` gives the distance of a domicile */
  maxKm?: number
  distanceKm?: (kecamatanId: string) => number
}
const EDU_RANK: Record<CvRecord['education'], number> = { 'SMA/SMK': 0, D3: 1, S1: 2, S2: 3 }
/**
 * Does the CV pass the criteria, and how well does it fit (0..100)? Name, gender, age and the kecamatan NAME are never
 * inputs (blind screening gives the same ranking); ties are broken by id by the caller.
 */
export function cvFit(cv: CvRecord, c: CvCriteria): { pass: boolean; fit: number; reasons: Bi[] } {
  const fails: Bi[] = []
  if (c.education && EDU_RANK[cv.education] < EDU_RANK[c.education]) fails.push({ id: `Pendidikan di bawah ${c.education}`, en: `Education below ${c.education}` })
  if (c.minYears != null && cv.years < c.minYears) fails.push({ id: `Pengalaman < ${c.minYears} tahun`, en: `Experience < ${c.minYears} years` })
  const missing = (c.skills ?? []).filter((s) => !cv.skills.includes(s))
  if (missing.length) fails.push({ id: `Belum punya keahlian ${missing.join(', ')}`, en: `Missing skills: ${missing.join(', ')}` })
  const km = c.distanceKm ? c.distanceKm(cv.kecamatanId) : null
  if (c.maxKm != null && km != null && km > c.maxKm) fails.push({ id: `Domisili > ${c.maxKm} km`, en: `Lives > ${c.maxKm} km away` })
  const bonus = (c.skills?.length ? 2 : 0) + (km != null && c.maxKm != null ? Math.round(3 * (1 - km / Math.max(1, c.maxKm))) : 0)
  return { pass: !fails.length, fit: Math.max(0, Math.min(100, cv.fit + bonus)), reasons: fails.length ? fails : cv.reasons }
}
