/**
 * samples/cv.ts — deterministic generator for 200 fictional CVs (Kenal Mitra "Saring 200 CV") + a renderer that
 * turns one CV into a SampleDoc. Names come from the world name generator (weighted by the region's languages);
 * employers are fictional; e-mail uses the reserved .test TLD; phone numbers are masked.
 */
import { hashString } from '../../world/prng'
import type { CvRecord, SampleDoc } from '../types'
import { DocBuilder, INK, MUTED } from './builder'

export { CV, generateCvs, cvFit, type CvCriteria } from './cv-data'

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
  b.text(40, 360, `Kec. ${cv.kecamatan}`, { size: 13 })
  b.text(40, 410, 'KEAHLIAN', { size: 12, weight: 700, ls: 0.12, fill: MUTED })
  const skillRuns = cv.skills.map((s, i) => b.text(40, 436 + i * 22, `• ${s}`, { size: 13 }))
  b.fieldRuns('keahlian', { id: 'Keahlian', en: 'Skills' }, cv.skills.join(', '), skillRuns)

  b.field('nama', { id: 'Nama', en: 'Name' }, cv.name, 290, 100, { size: 30, weight: 700 })
  b.field('posisi', { id: 'Posisi dilamar', en: 'Position applied' }, cv.role, 290, 132, { size: 16, fill: '#0b6a59', weight: 600 })
  b.para(290, 176, `Pelamar dengan ${cv.years} tahun pengalaman kerja, berdomisili di Kecamatan ${cv.kecamatan}. Terbiasa bekerja teliti, rapi, dan tepat waktu.`, 500, { lh: 22, size: 14, fill: MUTED })

  b.text(290, 268, 'PENDIDIKAN', { size: 12, weight: 700, ls: 0.12, fill: MUTED })
  b.field('pendidikan', { id: 'Pendidikan', en: 'Education' }, `${cv.education} · ${cv.major}`, 290, 294, { weight: 600 }, { shown: cv.major })
  b.text(290, 316, cv.education === 'SMA/SMK' ? 'Sekolah menengah' : 'Perguruan tinggi', { size: 13, fill: MUTED })

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
