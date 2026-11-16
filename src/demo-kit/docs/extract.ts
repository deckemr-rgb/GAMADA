/**
 * docs/extract.ts — simulated extraction for every bundled sample. Values are the ground truth (exact), confidences
 * are deterministic and realistic (lower for scans, handwriting, stamps and edited areas), consistency checks are
 * computed from the data, tamper cells from the ground-truth tamper regions.
 *
 * Products register it with their scenario:  registerScenario({ product: 'cek-berkas', …, extract: docsExtract })
 */
import type { ExtractRequest, Extracted, ExtractedField } from '../ai/types'
import { hashString } from '../world/rng'
import { pct } from './measure'
import { dmy, longDate, nikMatchesBirth, parseNik, SPECIMEN_KEC } from './nik'
import { getSample, idr } from './samples'
import type { Bi, Box, SampleDoc } from './types'

export type Lang = 'id' | 'en'
export type Verdict = 'lengkap' | 'kurang' | 'cek-manual'
type Check = NonNullable<Extracted['checks']>[number]

export const EXTRACT = {
  /** demo day (owner decision) — validity / recency checks are relative to it */
  today: '2026-11-17',
  /** heat grid columns (rows follow the aspect ratio) */
  heatCols: 28,
  /** cells under this score are dropped from Extracted.tamper */
  heatMin: 0.12,
  /** a tamper check fails at or above this */
  tamperFail: 0.5,
  /** confidence under this is flagged "periksa" in ExtractPanel */
  lowConfidence: 0.85,
  /** flood-affected kecamatan (region pack scenario.floodKecamatanIds, Bojonegoro) */
  floodKecamatan: ['trucuk', 'kalitidu', 'bojonegoro', 'kanor'],
  /** region bbox (pack bojonegoro): west, south, east, north */
  bbox: [111.4236, -7.4696, 112.1657, -6.986] as [number, number, number, number],
} as const

/** Checks whose failure means "something is missing" (→ Kurang) rather than "something is off" (→ Cek Manual). */
const MISSING = new Set(['signature', 'stamp', 'validity', 'required', 'kk-attached', 'recent'])

const rand = (seed: string) => (hashString(seed) % 10000) / 10000
const r2 = (n: number) => Math.round(n * 100) / 100

function confidenceOf(doc: SampleDoc, key: string, hard: boolean): number {
  const noise = doc.scan?.noise ?? 0
  const tampered = doc.tamper?.some((t) => t.field === key)
  if (tampered) return r2(0.55 + rand(`${doc.id}|${key}|t`) * 0.14)
  let c = 0.993 - noise * 0.11 - (hard ? 0.09 : 0) - rand(`${doc.id}|${key}`) * 0.045
  if (doc.scan?.rotX) c -= 0.015
  return r2(Math.max(0.6, Math.min(0.995, c)))
}

/* ---------------------------------------------------------------- tamper heat */

function overlap(a: Box, b: Box): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return x * y
}

/** Edit-likelihood cells (in % of the page) for the TamperHeatmap. */
export function tamperCells(doc: SampleDoc): NonNullable<Extracted['tamper']> {
  const cols = EXTRACT.heatCols
  const rows = Math.max(4, Math.round((cols * doc.h) / doc.w))
  const cw = doc.w / cols
  const ch = doc.h / rows
  const regions = doc.tamper ?? []
  const base = doc.scan ? 0.135 : 0.1
  const out: NonNullable<Extracted['tamper']> = []
  const grid: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = { x: c * cw, y: r * ch, w: cw, h: ch }
      let s = rand(`${doc.id}|heat|${r}|${c}`) * base
      for (const t of regions) {
        const o = overlap(cell, t.box) / (cw * ch)
        if (o > 0) s = Math.max(s, t.score * (0.5 + 0.5 * Math.min(1, o * 1.4)))
      }
      grid.push(s)
    }
  }
  // soft bleed into the 4-neighbourhood (looks like a real model output)
  const bled = grid.map((s, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const n = [grid[i - cols], grid[i + cols], c > 0 ? grid[i - 1] : undefined, c < cols - 1 ? grid[i + 1] : undefined]
    const m = Math.max(...n.map((v) => v ?? 0))
    void r
    return Math.max(s, m * 0.28)
  })
  bled.forEach((s, i) => {
    if (s < EXTRACT.heatMin) return
    const r = Math.floor(i / cols)
    const c = i % cols
    out.push({ ...pct({ x: c * cw, y: r * ch, w: cw, h: ch }, doc.w, doc.h), score: r2(s) })
  })
  return out
}

/* ---------------------------------------------------------------- checks */

const T = (lang: Lang, b: Bi) => b[lang]

function check(id: string, label: Bi, status: Check['status'], note: Bi | undefined, lang: Lang): Check {
  return { id, label, status, ...(note ? { note: T(lang, note) } : {}) }
}

function tamperCheck(doc: SampleDoc, lang: Lang): Check {
  const worst = [...(doc.tamper ?? [])].sort((a, b) => b.score - a.score)[0]
  if (worst && worst.score >= EXTRACT.tamperFail) {
    const n = doc.tamper?.length ?? 1
    return check('tamper', { id: 'Indikasi edit digital', en: 'Signs of digital editing' }, 'fail', {
      id: `${worst.reason.id}${n > 1 ? ` (+${n - 1} area lain)` : ''}`,
      en: `${worst.reason.en}${n > 1 ? ` (+${n - 1} more area${n > 2 ? 's' : ''})` : ''}`,
    }, lang)
  }
  return check('tamper', { id: 'Indikasi edit digital', en: 'Signs of digital editing' }, 'ok', { id: 'Tidak ada area mencurigakan', en: 'No suspicious area' }, lang)
}

const fieldOf = (doc: SampleDoc, key: string) => doc.fields.find((f) => f.key === key)
const has = (doc: SampleDoc, key: string) => !!fieldOf(doc, key)

function sigCheck(doc: SampleDoc, lang: Lang): Check {
  const ok = has(doc, 'ttd')
  return check('signature', { id: 'Tanda tangan ada', en: 'Signature present' }, ok ? 'ok' : 'fail', ok ? undefined : { id: 'Tanda tangan tidak ditemukan', en: 'No signature found' }, lang)
}

function nikCheck(nik: string, lang: Lang): Check {
  const p = parseNik(nik)
  const kec = Object.values(SPECIMEN_KEC).find((k) => k.code === nik.slice(4, 6))
  return p.ok
    ? check('nik-format', { id: 'Format NIK', en: 'NIK format' }, 'ok', { id: `16 digit · kode wilayah 35.22.${nik.slice(4, 6)} (${kec?.name ?? '?'})`, en: `16 digits · area code 35.22.${nik.slice(4, 6)} (${kec?.name ?? '?'})` }, lang)
    : check('nik-format', { id: 'Format NIK', en: 'NIK format' }, 'fail', { id: `NIK tidak valid (${p.problem})`, en: `Invalid NIK (${p.problem})` }, lang)
}

function addMonths(iso: string, m: number): string {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, mo - 1 + m, d))
  return t.toISOString().slice(0, 10)
}

function checksFor(doc: SampleDoc, lang: Lang): Check[] {
  const meta = doc.meta
  const out: Check[] = []
  switch (meta.kind) {
    case 'ktp': {
      out.push(nikCheck(meta.nik, lang))
      const match = nikMatchesBirth(meta.nik, meta.birthDate, meta.gender)
      const p = parseNik(meta.nik)
      out.push(
        check('nik-dob', { id: 'Tanggal lahir di NIK vs field', en: 'Birth date in NIK vs field' }, match ? 'ok' : 'fail', match
          ? { id: `Sama: ${dmy(meta.birthDate)}${meta.gender === 'P' ? ' (perempuan, tanggal +40)' : ''}`, en: `Match: ${dmy(meta.birthDate)}${meta.gender === 'P' ? ' (female, day +40)' : ''}` }
          : { id: `NIK menunjuk ${String(p.day).padStart(2, '0')}-${String(p.month).padStart(2, '0')}-xx${String(p.yy).padStart(2, '0')}, field tertulis ${dmy(meta.birthDate)}`, en: `NIK says ${String(p.day).padStart(2, '0')}-${String(p.month).padStart(2, '0')}-xx${String(p.yy).padStart(2, '0')}, field shows ${dmy(meta.birthDate)}` }, lang),
      )
      if (meta.kkRef) {
        const kk = getSample(meta.kkRef)
        const members = kk?.meta.kind === 'kk' ? (kk.meta.members ?? []) : []
        const hit = members.find((m) => m.name === meta.name)
        out.push(
          check('name-kk', { id: 'Nama di KK vs KTP', en: 'Name on family card vs ID card' }, hit ? 'ok' : 'fail', hit
            ? { id: `Cocok · anggota KK (${hit.relation.toLowerCase()})`, en: `Match · family-card member (${hit.relation.toLowerCase()})` }
            : { id: 'Nama tidak ditemukan di KK', en: 'Name not found on the family card' }, lang),
        )
      } else {
        out.push(check('kk-attached', { id: 'Nama di KK vs KTP', en: 'Name on family card vs ID card' }, 'fail', { id: 'KK belum dilampirkan, cek nama belum bisa dilakukan', en: 'Family card not attached, name check pending' }, lang))
      }
      out.push(check('validity', { id: 'Masa berlaku', en: 'Validity' }, 'ok', { id: 'Seumur hidup', en: 'Lifetime' }, lang))
      out.push(sigCheck(doc, lang))
      break
    }
    case 'kk': {
      const bad = (meta.members ?? []).filter((m) => !parseNik(m.nik).ok)
      out.push(
        check('nik-format', { id: 'Format NIK anggota', en: 'Members’ NIK format' }, bad.length ? 'fail' : 'ok', bad.length
          ? { id: `${bad.length} NIK tidak valid`, en: `${bad.length} invalid NIK` }
          : { id: `${meta.members?.length ?? 0} NIK valid · No. KK 16 digit`, en: `${meta.members?.length ?? 0} valid NIKs · 16-digit card number` }, lang),
      )
      const head = meta.members?.find((m) => m.relation === 'KEPALA KELUARGA')
      out.push(check('name-kk', { id: 'Kepala keluarga tercantum', en: 'Head of family listed' }, head?.name === meta.name ? 'ok' : 'fail', { id: `Kepala keluarga: ${meta.name}`, en: `Head of family: ${meta.name}` }, lang))
      out.push(check('signature', { id: 'Tanda tangan elektronik ada', en: 'Electronic signature present' }, 'ok', { id: 'Kode QR terbaca (dummy)', en: 'QR code read (dummy)' }, lang))
      break
    }
    case 'nib': {
      const ok = /^\d{13}$/.test(meta.nib)
      out.push(check('nib-format', { id: 'Format NIB', en: 'NIB format' }, ok ? 'ok' : 'fail', { id: '13 digit', en: '13 digits' }, lang))
      out.push(check('kbli', { id: 'Kode KBLI', en: 'KBLI code' }, /^\d{5}$/.test(meta.kbli) ? 'ok' : 'fail', { id: `${meta.kbli} · 5 digit`, en: `${meta.kbli} · 5 digits` }, lang))
      out.push(check('signature', { id: 'Tanda tangan elektronik ada', en: 'Electronic signature present' }, 'ok', { id: 'Kode QR terbaca (dummy)', en: 'QR code read (dummy)' }, lang))
      break
    }
    case 'domisili': {
      out.push(nikCheck(meta.nik, lang))
      const issued = fieldOf(doc, 'tanggal')?.value ?? EXTRACT.today
      const until = addMonths(issued, 6)
      const valid = until >= EXTRACT.today
      out.push(check('validity', { id: 'Masa berlaku', en: 'Validity' }, valid ? 'ok' : 'fail', { id: `Berlaku s.d. ${longDate(until, 'id')}`, en: `Valid until ${longDate(until, 'en')}` }, lang))
      out.push(sigCheck(doc, lang))
      out.push(check('stamp', { id: 'Cap desa ada', en: 'Village stamp present' }, has(doc, 'cap') ? 'ok' : 'fail', undefined, lang))
      break
    }
    case 'house': {
      const [lng, lat] = meta.lngLat
      const [w, s, e, n] = EXTRACT.bbox
      const inside = lng >= w && lng <= e && lat >= s && lat <= n
      out.push(check('geotag', { id: 'Geotag di wilayah', en: 'Geotag inside the region' }, inside ? 'ok' : 'fail', { id: `${meta.desa}, Kec. ${SPECIMEN_KEC[meta.kecamatanId]?.name ?? ''}`, en: `${meta.desa}, ${SPECIMEN_KEC[meta.kecamatanId]?.name ?? ''} district` }, lang))
      const zone = (EXTRACT.floodKecamatan as readonly string[]).includes(meta.kecamatanId)
      out.push(check('flood-zone', { id: 'Di zona terdampak banjir', en: 'Inside the flood-affected zone' }, zone ? 'ok' : 'warn', { id: zone ? 'Cocok dengan peta Siaga Wilayah' : 'Di luar zona terdampak', en: zone ? 'Matches the Siaga Wilayah map' : 'Outside the affected zone' }, lang))
      const days = (Date.parse(EXTRACT.today) - Date.parse(meta.takenAt.slice(0, 10))) / 864e5
      const recent = days <= 7
      out.push(check('recent', { id: 'Foto terbaru (≤ 7 hari)', en: 'Recent photo (≤ 7 days)' }, recent ? 'ok' : 'fail', { id: `Diambil ${longDate(meta.takenAt.slice(0, 10), 'id')}`, en: `Taken ${longDate(meta.takenAt.slice(0, 10), 'en')}` }, lang))
      break
    }
    case 'nota':
    case 'faktur': {
      const sum = meta.items.reduce((a, i) => a + i.qty * i.price, 0)
      const ok = sum === meta.printedTotal
      out.push(
        check('total-sum', { id: 'Total = jumlah item', en: 'Total = sum of items' }, ok ? 'ok' : 'fail', ok
          ? { id: `Rp ${idr(sum)}`, en: `Rp ${idr(sum)}` }
          : { id: `Jumlah item Rp ${idr(sum)} ≠ total tertulis Rp ${idr(meta.printedTotal)}`, en: `Items add up to Rp ${idr(sum)} ≠ printed total Rp ${idr(meta.printedTotal)}` }, lang),
      )
      if (meta.kind === 'nota') {
        const paid = Number(fieldOf(doc, 'bayar')?.value ?? 0)
        const change = Number(fieldOf(doc, 'kembali')?.value ?? 0)
        const okc = paid - change === meta.printedTotal
        out.push(check('cash', { id: 'Bayar − kembalian = total', en: 'Paid − change = total' }, okc ? 'ok' : 'fail', { id: `${idr(paid)} − ${idr(change)} = ${idr(paid - change)}`, en: `${idr(paid)} − ${idr(change)} = ${idr(paid - change)}` }, lang))
      } else {
        out.push(sigCheck(doc, lang))
      }
      out.push(check('date', { id: 'Tanggal terbaca', en: 'Date readable' }, 'ok', { id: longDate(meta.date, 'id'), en: longDate(meta.date, 'en') }, lang))
      break
    }
    case 'mutasi': {
      const flow = meta.rows.reduce((a, r) => a + r.credit - r.debit, 0)
      const ok = meta.opening + flow === meta.closing
      out.push(check('rows', { id: 'Baris terbaca', en: 'Rows parsed' }, 'ok', { id: `${meta.rows.length} transaksi`, en: `${meta.rows.length} transactions` }, lang))
      out.push(check('balance', { id: 'Saldo berkesinambungan', en: 'Balance continuity' }, ok ? 'ok' : 'fail', { id: `Rp ${idr(meta.opening)} + mutasi = Rp ${idr(meta.closing)}`, en: `Rp ${idr(meta.opening)} + movements = Rp ${idr(meta.closing)}` }, lang))
      const rev = meta.rows.filter((r) => r.review).length
      out.push(check('review', { id: 'Kategori otomatis', en: 'Auto-categorised' }, rev ? 'warn' : 'ok', { id: rev ? `${meta.rows.length - rev} terkategori · ${rev} perlu tinjauan` : 'Semua terkategori', en: rev ? `${meta.rows.length - rev} categorised · ${rev} need review` : 'All categorised' }, lang))
      break
    }
    case 'cv': {
      const c = meta.cv
      out.push(check('required', { id: 'Data wajib lengkap', en: 'Required data complete' }, 'ok', { id: 'Nama, kontak, pendidikan', en: 'Name, contact, education' }, lang))
      out.push(check('email', { id: 'Format e-mail', en: 'E-mail format' }, /^[^@\s]+@[^@\s]+\.[a-z]+$/.test(c.email) ? 'ok' : 'fail', { id: c.email, en: c.email }, lang))
      out.push(check('experience', { id: 'Pengalaman dihitung', en: 'Experience computed' }, 'ok', { id: `${c.years} tahun dari ${c.experience.length} riwayat`, en: `${c.years} years from ${c.experience.length} entries` }, lang))
      break
    }
    case 'letter': {
      out.push(check('number', { id: 'Nomor surat terbaca', en: 'Letter number readable' }, /\//.test(meta.number) ? 'ok' : 'warn', { id: meta.number, en: meta.number }, lang))
      out.push(check('date', { id: 'Tanggal surat', en: 'Letter date' }, 'ok', { id: longDate(meta.date, 'id'), en: longDate(meta.date, 'en') }, lang))
      out.push(sigCheck(doc, lang))
      if (meta.due) out.push(check('deadline', { id: 'Tenggat terdeteksi', en: 'Deadline detected' }, 'ok', { id: longDate(meta.due, 'id'), en: longDate(meta.due, 'en') }, lang))
      break
    }
  }
  if (doc.specimen || doc.tamper || doc.kind === 'nota' || doc.kind === 'house') out.push(tamperCheck(doc, lang))
  return out
}

/* ---------------------------------------------------------------- public API */

export interface SimulateOptions {
  lang?: Lang
}

/** Exact simulated extraction for a sample document (or its id). */
export function simulateExtract(docOrId: SampleDoc | string, opts: SimulateOptions = {}): Extracted {
  const doc = typeof docOrId === 'string' ? getSample(docOrId) : docOrId
  if (!doc) throw new Error(`unknown sample document "${String(docOrId)}"`)
  const lang = opts.lang ?? currentLang()
  const fields: ExtractedField[] = doc.fields.map((f) => ({
    key: f.key,
    label: f.label,
    value: f.value,
    confidence: confidenceOf(doc, f.key, !!f.hard),
    box: pct(f.box, doc.w, doc.h),
  }))
  const tamper = doc.specimen || doc.tamper || doc.kind === 'nota' || doc.kind === 'house' ? tamperCells(doc) : undefined
  return { kind: doc.extractKind, fields, checks: checksFor(doc, lang), ...(tamper ? { tamper } : {}), mode: 'sim' }
}

/** Drop-in for `Scenario.extract`: resolves `req.sampleId`. */
export function docsExtract(req: ExtractRequest): Extracted {
  if (!req.sampleId) throw new Error('docsExtract needs a sampleId in simulation mode')
  return simulateExtract(req.sampleId)
}

export interface VerdictResult {
  verdict: Verdict
  reasons: string[]
}

/** Lengkap / Kurang / Perlu Cek Manual from the checks (integrity problems win over missing items). */
export function verdictOf(ex: Pick<Extracted, 'checks'>): VerdictResult {
  const checks = ex.checks ?? []
  const integrity = checks.filter((c) => c.status !== 'ok' && !MISSING.has(c.id))
  if (integrity.length) return { verdict: 'cek-manual', reasons: integrity.map((c) => c.note ?? '') .filter(Boolean) }
  const missing = checks.filter((c) => c.status !== 'ok' && MISSING.has(c.id))
  if (missing.length) return { verdict: 'kurang', reasons: missing.map((c) => c.note ?? '').filter(Boolean) }
  return { verdict: 'lengkap', reasons: [] }
}

export function fieldValue(ex: Extracted, key: string): string | undefined {
  return ex.fields.find((f) => f.key === key)?.value
}

function currentLang(): Lang {
  if (typeof document === 'undefined') return 'id'
  return document.documentElement.lang === 'en' ? 'en' : 'id'
}
