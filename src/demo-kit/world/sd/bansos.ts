/**
 * world/sd/bansos.ts — Cek Berkas: the flood-aid applicant batch.
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { Bi, Citizen, DocumentRec, WorldState } from '../types'
import { createParamSelector, activeAlerts } from '../selectors'
import { rows } from '../util'
import { unit } from './base'

/* ================================================================== Cek Berkas */

export interface BansosRow {
  doc: DocumentRec
  citizen: Citizen | undefined
  /** other applicant documents sharing this NIK */
  duplicateOf: string[]
  /** address outside the zone checked against (Siaga Wilayah) */
  outsideZone: boolean
  /** deterministic per document: a required attachment is missing */
  missing: Bi | null
  result: 'lolos' | 'kurang' | 'ganda' | 'luar-zona'
}
export interface BansosBatch {
  rows: BansosRow[]
  /** kecamatan the addresses were checked against */
  zone: string[]
  /** NIK-sharing groups (doc ids) — draw the connecting lines between these cards */
  duplicateGroups: string[][]
  /** ganda = files in a NIK-sharing group, gandaPairs = groups (= facts.bansosDuplicatePairs), luarZona = every file outside the zone */
  summary: { total: number; lolos: number; kurang: number; ganda: number; gandaPairs: number; luarZona: number }
}
const MISSING: Bi[] = [
  { id: 'Foto rumah belum dilampirkan', en: 'House photo not attached' },
  { id: 'Fotokopi KK belum dilampirkan', en: 'Family card copy not attached' },
  { id: 'Surat keterangan domisili belum ada', en: 'Domicile letter missing' },
]
/**
 * The 50 flood-aid applicant files (spec P7 "Massal"). Zone = the open bansos programme's kecamatan, else the active
 * flood alert's, else the scenario flood kecamatan. With the scenario alert, ganda pairs = facts.bansosDuplicatePairs
 * and luar-zona = facts.bansosOutsideZone.
 */
const bansosSel = /*#__PURE__*/ createParamSelector((s) => [s.documents, s.programs, s.alerts, s.citizens, s.region], (zone: string, documents, programs, alerts, citizens, region): BansosBatch =>
  batch({ documents, programs, alerts, citizens, region } as WorldState, zone ? zone.split(',') : undefined),
)
export function bansosBatch(s: WorldState, zone?: string[]): BansosBatch {
  return bansosSel(s, zone?.join(',') ?? '')
}
function batch(s: WorldState, zone?: string[]): BansosBatch {
  const prog = rows(s.programs).find((p) => p.open && p.kind === 'bansos-banjir')
  const alert = activeAlerts(s).find((a) => a.kind === 'banjir')
  const z = zone ?? prog?.kecamatanIds ?? alert?.kecamatanIds ?? s.region.floodKecamatanIds
  const zs = new Set(z)
  const docs = rows(s.documents).filter((d) => d.program === 'bansos-banjir' && d.kind === 'ktp').sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  const byNik = new Map<string, string[]>()
  for (const d of docs) if (d.nik) byNik.set(d.nik, [...(byNik.get(d.nik) ?? []), d.id])
  const groups = [...byNik.values()].filter((g) => g.length > 1)
  const out: BansosRow[] = docs.map((doc) => {
    const dup = doc.nik ? (byNik.get(doc.nik) ?? []).filter((id) => id !== doc.id) : []
    const outsideZone = !zs.has(doc.kecamatanId)
    const u = unit(doc.id)
    const missing = !dup.length && !outsideZone && u < 0.12 ? MISSING[Math.floor(u * 100) % MISSING.length]! : null
    return { doc, citizen: doc.citizenId ? s.citizens.byId[doc.citizenId] : undefined, duplicateOf: dup, outsideZone, missing, result: dup.length ? 'ganda' : outsideZone ? 'luar-zona' : missing ? 'kurang' : 'lolos' }
  })
  const n = (r: BansosRow['result']) => out.filter((x) => x.result === r).length
  return {
    rows: out, zone: z, duplicateGroups: groups,
    summary: { total: out.length, lolos: n('lolos'), kurang: n('kurang'), ganda: n('ganda'), gandaPairs: groups.length, luarZona: out.filter((x) => x.outsideZone).length },
  }
}

/** CSV of a batch (Ekspor CSV) — fictional specimen data; NIK masked except the last 4 digits */
export function bansosCsv(b: BansosBatch, lang: 'id' | 'en'): string {
  const head = lang === 'id' ? ['berkas', 'nama', 'nik', 'kecamatan', 'hasil', 'catatan'] : ['file', 'name', 'nik', 'district', 'result', 'note']
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = b.rows.map((r) => [r.doc.id, r.doc.ownerName, r.doc.nik ? `************${r.doc.nik.slice(-4)}` : '', r.doc.kecamatanId, r.result, r.missing?.[lang] ?? (r.duplicateOf.length ? r.duplicateOf.join(' ') : '')].map(q).join(','))
  return [head.join(','), ...lines].join('\n')
}
