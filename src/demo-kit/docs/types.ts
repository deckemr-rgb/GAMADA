/**
 * docs/types.ts — sample documents as data. Every sample is a small scene graph (shapes + text runs) in its own
 * viewBox units, so the SAME data renders the SVG (DocArt) and yields the ground-truth OCR boxes (extract.ts).
 * No external images: everything is generated from code, all people / companies / banks are fictional.
 */
import type { ExtractKind } from '../ai/types'

export type Bi = { id: string; en: string }

/** Box in document units (viewBox). Extracted boxes are the same box in % of the page. */
export type Box = { x: number; y: number; w: number; h: number }

export type SampleKind = 'letter' | 'ktp' | 'kk' | 'nib' | 'domisili' | 'house' | 'nota' | 'faktur' | 'mutasi' | 'cv' | 'npwp' | 'akta' | 'lokasi'

export type FontKind = 'sans' | 'serif' | 'mono' | 'hand'

export interface Run {
  x: number
  /** baseline */
  y: number
  text: string
  size: number
  weight?: 400 | 500 | 600 | 700
  font?: FontKind
  anchor?: 'start' | 'middle' | 'end'
  fill?: string
  italic?: boolean
  /** letter-spacing in em */
  ls?: number
  opacity?: number
  /** rotation (deg) around (x, y) — handwriting, stamps */
  rotate?: number
  /** this run belongs to a ground-truth field */
  field?: string
}

export type Shape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; r?: number; opacity?: number; dash?: string }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: string; sw?: number; dash?: string; opacity?: number }
  | { t: 'path'; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number }
  /** generic emblem (shield + star + rice/cotton strokes) — never a real coat of arms */
  | { t: 'emblem'; x: number; y: number; size: number; tone?: string }
  /** generic portrait illustration (no real face) */
  | { t: 'portrait'; x: number; y: number; w: number; h: number; seed: number; gender: 'L' | 'P'; bg?: string }
  /** handwritten-looking signature stroke */
  | { t: 'signature'; x: number; y: number; w: number; h: number; seed: number; tone?: string }
  /** round rubber stamp */
  | { t: 'seal'; cx: number; cy: number; r: number; top: string; center: string; tone?: string; rotate?: number; opacity?: number }
  /** diagonal watermark */
  | { t: 'watermark'; text: string; cx: number; cy: number; size: number; angle: number; opacity?: number; fill?: string }
  /** QR-like square (decorative, encodes nothing) */
  | { t: 'qr'; x: number; y: number; size: number; seed: number }
  /** house photo illustration */
  | { t: 'house'; x: number; y: number; w: number; h: number; flood: number }
  /** crumple creases (receipt) */
  | { t: 'creases'; seed: number; count: number }
  /** tamper artefact: a slightly off-tone patch behind an edited value */
  | { t: 'patch'; x: number; y: number; w: number; h: number; fill: string }

export type Background = 'paper' | 'card' | 'photo' | 'thermal' | 'sheet' | 'nib'

/** How a "scan" looks before the deskew animation ("luruskan"). */
export interface ScanLook {
  /** rotation (deg) */
  rotate: number
  skewX?: number
  /** 3D perspective tilt (deg) for photographed paper */
  rotX?: number
  rotY?: number
  scale?: number
  /** static noise texture opacity 0..1 */
  noise: number
  /** uneven lighting 0..1 */
  shade?: number
}

export interface TruthField {
  key: string
  label: Bi
  value: string
  box: Box
  /** handwritten / stamped / low-contrast source → lower OCR confidence */
  hard?: boolean
}

export interface TamperTruth {
  box: Box
  /** 0..1 */
  score: number
  /** which field was edited (if any) */
  field?: string
  reason: Bi
}

/* ---------------------------------------------------------------- per-kind metadata */

export type LetterClass = 'undangan' | 'permohonan' | 'laporan' | 'edaran' | 'nota-dinas'
export interface LetterMeta {
  kind: 'letter'
  number: string
  /** ISO date */
  date: string
  from: string
  to: string
  subject: Bi
  cls: LetterClass
  sifat: 'segera' | 'biasa' | 'rahasia'
  /** ISO date of the event / requested deadline, if any */
  due: string | null
  /** 3-line AI summary */
  summary: [Bi, Bi, Bi]
  /** disposition draft: OPD ids from the region pack + instruction */
  disposition: { to: string[]; instruction: Bi; note: Bi }
}

export interface PersonMeta {
  kind: 'ktp' | 'kk' | 'domisili'
  nik: string
  name: string
  gender: 'L' | 'P'
  /** ISO */
  birthDate: string
  kecamatanId: string
  desa: string
  /** KK sample holding this person (name check) */
  kkRef?: string
  noKk?: string
  members?: { name: string; nik: string; relation: string }[]
  edited: boolean
}

export interface BusinessMeta {
  /** 'npwp' / 'akta' / 'lokasi': the KYB specimens of samples/kyb.ts */
  kind: 'nib' | 'npwp' | 'akta' | 'lokasi'
  nib: string
  name: string
  owner: string
  kbli: string
  edited: boolean
  npwp?: string
  akta?: string
  address?: string
  /** [lng, lat] of the location photo */
  gps?: [number, number]
}

export interface HouseMeta {
  kind: 'house'
  lngLat: [number, number]
  kecamatanId: string
  desa: string
  takenAt: string
  floodCm: number
  reused: boolean
}

export interface LineItem {
  name: string
  qty: number
  unit: string
  price: number
}
export interface ReceiptMeta {
  kind: 'nota' | 'faktur'
  merchant: string
  number: string
  date: string
  items: LineItem[]
  total: number
  /** the printed total (differs from the item sum on edited variants) */
  printedTotal: number
  /** suggested journal entry (Pajak Beres) */
  journal: { debit: string; credit: string; amount: number; memo: Bi }
  edited: boolean
}

export interface MutasiRow {
  date: string
  desc: string
  debit: number
  credit: number
  balance: number
  /** ground-truth category (Pajak Beres auto-categorisation) */
  category: string
  /** flagged for review */
  review: boolean
  reviewReason?: Bi
}
export interface MutasiMeta {
  kind: 'mutasi'
  bank: string
  account: string
  holder: string
  period: string
  opening: number
  closing: number
  rows: MutasiRow[]
  csv: string
}

export interface CvRecord {
  id: string
  name: string
  gender: 'L' | 'P'
  role: string
  years: number
  education: 'SMA/SMK' | 'D3' | 'S1' | 'S2'
  major: string
  skills: string[]
  kecamatanId: string
  kecamatan: string
  phone: string
  email: string
  experience: { org: string; title: string; from: number; to: number | null }[]
  /** ground-truth fit (0..100) for the default "Staf Administrasi Keuangan" opening */
  fit: number
  reasons: Bi[]
}
export interface CvMeta {
  kind: 'cv'
  cv: CvRecord
}

export type SampleMeta = LetterMeta | PersonMeta | BusinessMeta | HouseMeta | ReceiptMeta | MutasiMeta | CvMeta

export interface SampleDoc {
  id: string
  kind: SampleKind
  extractKind: ExtractKind
  title: Bi
  /** one-line description for galleries */
  caption: Bi
  w: number
  h: number
  bg: Background
  shapes: Shape[]
  runs: Run[]
  /** drawn after the text (watermark, stamps, creases) */
  overlays: Shape[]
  scan?: ScanLook
  fields: TruthField[]
  tamper?: TamperTruth[]
  /** identity documents carry the SPESIMEN watermark */
  specimen: boolean
  meta: SampleMeta
}
