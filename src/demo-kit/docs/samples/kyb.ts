/**
 * samples/kyb.ts — KYB SPECIMENS of a (fictional) business for Kenal Mitra: NIB, NPWP card, deed of establishment
 * (CV / PT only) and a storefront location photo with its GPS stamp. Every page carries the SPESIMEN watermark and the
 * "data fiktif" footer; numbers come from world/usaha-pintar vendorProfile (masked NPWP, specimen NIB).
 * `mismatch: 'nama'` prints a shortened name on the NPWP; `'alamat'` moves the photo GPS to `photoCoord`.
 */
import { longDate } from '../nik'
import type { Bi, BusinessMeta, SampleDoc } from '../types'
import { DocBuilder, INK, MUTED } from './builder'

export interface KybSubject {
  id: string
  name: string
  owner: string
  legal: 'perorangan' | 'UD' | 'CV' | 'PT'
  /** "Desa X, Kec. Y" */
  address: string
  kecamatan: string
  kbli: string
  nib: string
  /** masked "0000 •••• •••• 0000" */
  npwp: string
  since: number
  coord: [number, number]
  /** the location photo's GPS (default: 0,2 km from the address) */
  photoCoord?: [number, number]
  akta?: { number: string; date: string } | null
}
const W = 840
const H = 1188
const foot = (b: DocBuilder, w: number, h: number) => {
  b.over({ t: 'watermark', text: 'SPESIMEN', cx: w / 2, cy: h / 2, size: Math.min(150, w / 5), angle: -28, opacity: 0.16, fill: '#b3261e' })
  b.text(w / 2, h - 18, 'SPESIMEN · data fiktif untuk demo GAMADA · bukan dokumen resmi', { anchor: 'middle', size: 10, fill: '#8c88a0' })
}
const meta = (kind: BusinessMeta['kind'], s: KybSubject, extra: Partial<BusinessMeta> = {}): BusinessMeta => ({ kind, nib: s.nib, name: s.name.toUpperCase(), owner: s.owner.toUpperCase(), kbli: s.kbli, edited: false, ...extra })
const fmt = (c: [number, number]) => `${c[1].toFixed(5)}, ${c[0].toFixed(5)}`

function nibDoc(s: KybSubject): SampleDoc {
  const b = new DocBuilder(W, H, { font: 'sans', size: 15, fill: INK })
  b.shape({ t: 'emblem', x: W / 2 - 40, y: 54, size: 80, tone: '#2f4a8a' })
  b.text(W / 2, 182, 'PERIZINAN BERUSAHA BERBASIS RISIKO', { size: 20, weight: 700, anchor: 'middle', ls: 0.03 })
  b.text(W / 2, 214, 'NOMOR INDUK BERUSAHA', { size: 16, weight: 600, anchor: 'middle', ls: 0.06, fill: MUTED })
  b.field('nib', { id: 'NIB', en: 'Business ID (NIB)' }, s.nib, W / 2, 262, { size: 34, weight: 700, anchor: 'middle', font: 'mono', ls: 0.08 })
  const rows: [string, string, string, Bi][] = [
    ['Nama Pelaku Usaha', s.owner.toUpperCase(), 'pemilik', { id: 'Nama pemilik', en: 'Owner name' }],
    ['Nama Usaha', s.name.toUpperCase(), 'nama_usaha', { id: 'Nama usaha', en: 'Business name' }],
    ['Alamat Usaha', s.address, 'alamat', { id: 'Alamat', en: 'Address' }],
    ['KBLI', s.kbli, 'kbli', { id: 'KBLI', en: 'Business classification (KBLI)' }],
    ['Bentuk Usaha', s.legal === 'perorangan' ? 'Perorangan' : s.legal, 'bentuk', { id: 'Bentuk usaha', en: 'Legal form' }],
  ]
  let y = 360
  for (const [k, v, key, lab] of rows) {
    b.text(84, y, k)
    b.text(300, y, ':')
    b.field(key, lab, v, 314, y, { weight: 600, size: v.length > 34 ? 13 : 15 })
    y += 34
  }
  b.text(560, 820, 'Tanggal terbit:', { size: 14 })
  const issued = `${Math.max(2019, s.since)}-03-04`
  b.field('tanggal_terbit', { id: 'Tanggal terbit', en: 'Issue date' }, issued, 560 + b.width('Tanggal terbit: ', { size: 14 }), 820, { size: 14, weight: 600 }, { shown: longDate(issued) })
  b.shape({ t: 'qr', x: 560, y: 844, size: 108, seed: s.nib.length + Number(s.nib.slice(-3)) })
  b.fieldBox('ttd', { id: 'Tanda tangan elektronik', en: 'Electronic signature' }, 'ada', { x: 552, y: 836, w: 124, h: 124 })
  foot(b, W, H)
  return b.build({ id: `nib-${s.id}`, kind: 'nib', extractKind: 'document', title: { id: `NIB spesimen · ${s.name}`, en: `Business ID specimen · ${s.name}` }, caption: { id: s.address, en: s.address }, bg: 'nib', specimen: true, meta: meta('nib', s) })
}

function npwpDoc(s: KybSubject, mismatch: boolean): SampleDoc {
  const CW = 856
  const CH = 540
  const b = new DocBuilder(CW, CH, { font: 'sans', size: 17, fill: INK })
  const printed = mismatch ? s.name.replace(/\s+\S+$/, '').toUpperCase() : s.name.toUpperCase()
  b.shape({ t: 'rect', x: 0, y: 0, w: CW, h: 90, fill: '#2f3f6f' })
  b.text(36, 56, 'KARTU NPWP', { size: 28, weight: 700, fill: '#ffffff', ls: 0.05 })
  b.text(CW - 36, 56, 'spesimen · bukan kartu resmi', { size: 14, anchor: 'end', fill: '#c9d2f0' })
  b.field('npwp', { id: 'NPWP', en: 'Tax ID (NPWP)' }, s.npwp, 36, 170, { size: 34, weight: 700, font: 'mono', ls: 0.06 })
  b.field('nama_wp', { id: 'Nama wajib pajak', en: 'Taxpayer name' }, printed, 36, 240, { size: 24, weight: 700 })
  b.field('alamat', { id: 'Alamat', en: 'Address' }, s.address, 36, 290, { size: 17 })
  b.text(36, 340, `Terdaftar: ${s.since}`, { size: 15, fill: MUTED })
  foot(b, CW, CH)
  return b.build({ id: `npwp-${s.id}`, kind: 'npwp', extractKind: 'document', title: { id: `NPWP spesimen · ${s.name}`, en: `Tax ID specimen · ${s.name}` }, caption: mismatch ? { id: 'Nama berbeda dari NIB', en: 'Name differs from the NIB' } : { id: 'Kartu NPWP (tersamar)', en: 'Tax ID card (masked)' }, bg: 'card', specimen: true, meta: meta('npwp', s, { npwp: s.npwp, name: printed }) })
}

function aktaDoc(s: KybSubject): SampleDoc {
  const b = new DocBuilder(W, H, { font: 'serif', size: 16, fill: INK })
  const no = s.akta?.number ?? '12'
  const date = s.akta?.date ?? `${s.since}-02-11`
  b.text(W / 2, 140, 'SALINAN', { size: 18, anchor: 'middle', ls: 0.2, fill: MUTED })
  b.text(W / 2, 200, `AKTA PENDIRIAN ${s.legal}`, { size: 26, weight: 700, anchor: 'middle' })
  b.field('nama_usaha', { id: 'Nama usaha', en: 'Business name' }, s.name.toUpperCase(), W / 2, 244, { size: 22, weight: 700, anchor: 'middle' })
  b.field('nomor_akta', { id: 'Nomor akta', en: 'Deed number' }, `Nomor ${no}`, W / 2, 290, { size: 18, anchor: 'middle' })
  b.field('tanggal', { id: 'Tanggal', en: 'Date' }, date, W / 2, 318, { size: 16, anchor: 'middle' }, { shown: longDate(date) })
  b.para(96, 400, `Pada hari ini menghadap kepada Notaris (fiktif) para pendiri untuk mendirikan persekutuan komanditer dengan nama ${s.name}, berkedudukan di ${s.kecamatan}.`, 648, { lh: 28 })
  b.text(96, 540, 'Persero pengurus (direktur):')
  b.field('direktur', { id: 'Direktur', en: 'Director' }, s.owner.toUpperCase(), 330, 540, { weight: 700 })
  b.text(96, 576, 'Maksud dan tujuan:')
  b.field('kbli', { id: 'KBLI', en: 'KBLI' }, `Perdagangan bahan bangunan (KBLI ${s.kbli})`, 280, 576, { size: 15 })
  b.shape({ t: 'seal', cx: W - 200, cy: 900, r: 70, top: 'NOTARIS', center: 'FIKTIF', tone: '#2a3f9a', rotate: -10, opacity: 0.8 })
  b.fieldBox('ttd', { id: 'Tanda tangan notaris', en: 'Notary signature' }, 'ada', { x: W - 280, y: 820, w: 160, h: 160 }, { hard: true })
  foot(b, W, H)
  return b.build({ id: `akta-${s.id}`, kind: 'akta', extractKind: 'document', title: { id: `Akta pendirian spesimen · ${s.name}`, en: `Deed of establishment specimen · ${s.name}` }, caption: { id: `Nomor ${no}`, en: `No. ${no}` }, bg: 'paper', specimen: true, meta: meta('akta', s, { akta: no }) })
}

function lokasiDoc(s: KybSubject, at: [number, number]): SampleDoc {
  const PW = 900
  const PH = 640
  const b = new DocBuilder(PW, PH, { font: 'sans', size: 16, fill: '#ffffff' })
  b.shape({ t: 'rect', x: 0, y: 0, w: PW, h: PH, fill: '#6f8297' })
  b.shape({ t: 'house', x: 150, y: 120, w: 600, h: 380, flood: 0 })
  b.shape({ t: 'rect', x: 230, y: 150, w: 440, h: 54, fill: '#f2efe6', r: 4 })
  b.text(PW / 2, 186, s.name.toUpperCase(), { size: s.name.length > 24 ? 20 : 26, weight: 700, anchor: 'middle', fill: '#2a2833' })
  b.shape({ t: 'rect', x: 0, y: PH - 92, w: PW, h: 92, fill: '#000000', opacity: 0.55 })
  b.field('gps', { id: 'Koordinat GPS', en: 'GPS coordinates' }, fmt(at), 24, PH - 56, { size: 20, weight: 700, font: 'mono' })
  b.field('waktu', { id: 'Waktu foto', en: 'Photo time' }, '2026-11-16 10:21', 24, PH - 26, { size: 15 }, { shown: '16/11/2026 10.21 WIB' })
  b.text(PW - 24, PH - 26, 'foto ilustrasi · bukan lokasi nyata', { size: 13, anchor: 'end', fill: '#d8d3c4' })
  foot(b, PW, PH)
  return b.build({ id: `lokasi-${s.id}`, kind: 'lokasi', extractKind: 'document', title: { id: `Foto lokasi · ${s.name}`, en: `Location photo · ${s.name}` }, caption: { id: `GPS ${fmt(at)}`, en: `GPS ${fmt(at)}` }, bg: 'photo', specimen: true, meta: meta('lokasi', s, { gps: at, address: s.address }) })
}

/** the KYB document set of a business (akta only for CV / PT) */
export function kybSpecimens(s: KybSubject, opts: { mismatch?: 'alamat' | 'nama' } = {}): { nib: SampleDoc; npwp: SampleDoc; akta: SampleDoc | null; lokasi: SampleDoc } {
  const near: [number, number] = [Math.round((s.coord[0] + 0.2 / (111.32 * Math.cos((s.coord[1] * Math.PI) / 180))) * 1e5) / 1e5, s.coord[1]]
  const photo = s.photoCoord ?? near
  return {
    nib: nibDoc(s),
    npwp: npwpDoc(s, opts.mismatch === 'nama'),
    akta: s.legal === 'CV' || s.legal === 'PT' ? aktaDoc(s) : null,
    lokasi: lokasiDoc(s, photo),
  }
}
