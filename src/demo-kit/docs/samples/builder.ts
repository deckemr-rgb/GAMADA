/**
 * samples/builder.ts — tiny scene-graph builder: text runs + shapes + ground-truth fields with boxes measured from
 * the very runs that are drawn.
 */
import { runBox, textWidth, unionBox, wrap } from '../measure'
import type { Bi, Box, Run, SampleDoc, Shape, TamperTruth, TruthField } from '../types'

export const INK = '#1f1d2b'
export const MUTED = '#4d4a60'
export const SEAL = '#2a3f9a'
export const SEAL_RED = '#b3261e'

type Base = Omit<SampleDoc, 'shapes' | 'runs' | 'overlays' | 'fields' | 'tamper' | 'w' | 'h'>

export class DocBuilder {
  shapes: Shape[] = []
  runs: Run[] = []
  overlays: Shape[] = []
  fields: TruthField[] = []
  tamper: TamperTruth[] = []
  constructor(
    public w: number,
    public h: number,
    private defaults: Partial<Run> = {},
  ) {}

  text(x: number, y: number, text: string, o: Partial<Run> = {}): Run {
    const r: Run = { size: 16, fill: INK, ...this.defaults, ...o, x, y, text }
    this.runs.push(r)
    return r
  }

  /** Width of a would-be run with the builder defaults. */
  width(text: string, o: Partial<Run> = {}): number {
    const r = { size: 16, ...this.defaults, ...o }
    return textWidth(text, r.size, r.font, r.weight, r.ls)
  }

  /** A ground-truth field drawn as one run (value === drawn text unless `shown` differs). */
  field(key: string, label: Bi, value: string, x: number, y: number, o: Partial<Run> = {}, extra: { hard?: boolean; shown?: string } = {}): Run {
    const r = this.text(x, y, extra.shown ?? value, { ...o, field: key })
    this.fields.push({ key, label, value, box: runBox(r), ...(extra.hard ? { hard: true } : {}) })
    return r
  }

  /** A field spanning several runs (multi-line address, wrapped subject …). */
  fieldRuns(key: string, label: Bi, value: string, runs: Run[], extra: { hard?: boolean } = {}): void {
    for (const r of runs) r.field = key
    this.fields.push({ key, label, value, box: unionBox(runs.map((r) => runBox(r))), ...(extra.hard ? { hard: true } : {}) })
  }

  /** A field whose box is given explicitly (signature, stamp, photo region). */
  fieldBox(key: string, label: Bi, value: string, box: Box, extra: { hard?: boolean } = {}): void {
    this.fields.push({ key, label, value, box, ...(extra.hard ? { hard: true } : {}) })
  }

  /** Wrapped paragraph; returns the runs (baseline of the last line = runs.at(-1).y). */
  para(x: number, y: number, text: string, maxW: number, o: Partial<Run> & { lh?: number; indent?: number } = {}): Run[] {
    const { lh, indent = 0, ...ro } = o
    const size = ro.size ?? this.defaults.size ?? 16
    const font = ro.font ?? this.defaults.font
    const weight = ro.weight ?? this.defaults.weight
    const lines = wrap(text, maxW - indent, size, font, weight)
    const step = lh ?? size * 1.5
    return lines.map((line, i) => this.text(x + (i === 0 ? indent : 0), y + i * step, line, ro))
  }

  shape(s: Shape): void {
    this.shapes.push(s)
  }
  over(s: Shape): void {
    this.overlays.push(s)
  }

  build(base: Base): SampleDoc {
    return {
      ...base,
      w: this.w,
      h: this.h,
      shapes: this.shapes,
      runs: this.runs,
      overlays: this.overlays,
      fields: this.fields,
      ...(this.tamper.length ? { tamper: this.tamper } : {}),
    }
  }
}

/** Same label in both languages (proper nouns / official terms). */
export const same = (s: string): Bi => ({ id: s, en: s })

export const L = {
  nomor: { id: 'Nomor surat', en: 'Letter number' },
  tanggal: { id: 'Tanggal', en: 'Date' },
  sifat: { id: 'Sifat', en: 'Priority' },
  lampiran: { id: 'Lampiran', en: 'Attachments' },
  perihal: { id: 'Perihal', en: 'Subject' },
  pengirim: { id: 'Pengirim', en: 'Sender' },
  tujuan: { id: 'Ditujukan kepada', en: 'Addressed to' },
  acara: { id: 'Waktu acara', en: 'Event time' },
  tenggat: { id: 'Tenggat', en: 'Deadline' },
  penandatangan: { id: 'Penanda tangan', en: 'Signed by' },
  nik: { id: 'NIK', en: 'NIK (ID number)' },
  nama: { id: 'Nama', en: 'Name' },
  tempatLahir: { id: 'Tempat lahir', en: 'Place of birth' },
  tglLahir: { id: 'Tanggal lahir', en: 'Date of birth' },
  jk: { id: 'Jenis kelamin', en: 'Sex' },
  gol: { id: 'Golongan darah', en: 'Blood type' },
  alamat: { id: 'Alamat', en: 'Address' },
  rtrw: { id: 'RT/RW', en: 'RT/RW' },
  desa: { id: 'Kelurahan/Desa', en: 'Village' },
  kecamatan: { id: 'Kecamatan', en: 'District' },
  agama: { id: 'Agama', en: 'Religion' },
  kawin: { id: 'Status perkawinan', en: 'Marital status' },
  pekerjaan: { id: 'Pekerjaan', en: 'Occupation' },
  wn: { id: 'Kewarganegaraan', en: 'Citizenship' },
  berlaku: { id: 'Berlaku hingga', en: 'Valid until' },
  ttd: { id: 'Tanda tangan', en: 'Signature' },
  cap: { id: 'Cap/stempel', en: 'Stamp' },
  foto: { id: 'Pas foto', en: 'Photo' },
} satisfies Record<string, Bi>
