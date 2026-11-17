/**
 * demos/cek-berkas/model.ts — shared, React-free pieces of Cek Berkas: roles → gallery and default mode, the
 * session verification log (module store, survives mode switches, cleared by the shell's Reset through the canvas
 * epoch remount), bulk result → document status, and the compact context the AI assistant reads.
 */
import type { DocumentRec, WorldState } from '../../demo-kit/world'
import type { Verdict } from '../../demo-kit/docs'
import type { BansosBatch } from '../../demo-kit/world/satu-daerah'

export type Mode = 'single' | 'bulk'
export type CekRole = 'perizinan' | 'dinsos'

export const asRole = (r: string): CekRole => (r === 'dinsos' ? 'dinsos' : 'perizinan')

/** module constants (report: none added to motion.ts) */
export const CEK = {
  /** bulk: delay between two cards (s) → 50 cards ≈ 7.6 s + settle ≈ 8 s (spec "±8 detik") */
  bulkStagger: 0.15,
  /** bulk: first card starts after (s) */
  bulkLead: 0.25,
  /** heatmap opacity once an edited document is found */
  heatOn: 0.7,
  /** upload limit (bytes) — proxy limit */
  uploadMax: 8 * 1024 * 1024,
} as const

/** Gallery per role: the Licensing Desk sees permit files, Social Affairs sees aid files (house photos, no NIB). */
export const GALLERY: Record<CekRole, readonly string[]> = {
  perizinan: ['ktp-siti', 'kk-mojosari', 'nib-warung-tini', 'domisili-sranak', 'ktp-joko', 'ktp-siti-edit', 'domisili-sranak-edit'],
  dinsos: ['ktp-siti', 'kk-mojosari', 'domisili-sranak', 'foto-rumah-sranak', 'foto-rumah-lama', 'ktp-siti-edit', 'domisili-sranak-edit'],
}
export const DEFAULT_MODE: Record<CekRole, Mode> = { perizinan: 'single', dinsos: 'bulk' }

/* ------------------------------------------------------------------ session log (single-file checks) */

export interface LogRow {
  docId: string
  verdict: Verdict
  /** read time in ms (click → verdict) */
  ms: number
  /** world minutes */
  at: number
  tampered: boolean
}

let log: LogRow[] = []
const subs = new Set<() => void>()
export const sessionLog = {
  get: (): readonly LogRow[] => log,
  add(row: LogRow): void {
    log = [row, ...log].slice(0, 30)
    subs.forEach((f) => f())
  },
  clear(): void {
    if (!log.length) return
    log = []
    subs.forEach((f) => f())
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => void subs.delete(fn)
  },
}

/* ------------------------------------------------------------------ bulk */

export type BulkResult = 'lolos' | 'kurang' | 'ganda' | 'luar-zona'
export const STATUS_OF: Record<BulkResult, DocumentRec['status']> = { lolos: 'lengkap', kurang: 'kurang', ganda: 'cek-manual', 'luar-zona': 'cek-manual' }

/** the bansos applicant files have all been verified once (world-persisted) */
export function bulkProcessed(s: WorldState): boolean {
  let n = 0
  for (const id of s.documents.ids) {
    const d = s.documents.byId[id]
    if (!d || d.program !== 'bansos-banjir' || d.kind !== 'ktp') continue
    if (d.status === 'baru') return false
    n++
  }
  return n > 0
}

/** Chip counts, mutually exclusive (Σ = total): a duplicate NIK outside the zone counts as NIK ganda only;
 *  `outside` = every address outside the zone (map, AI), `outsideGanda` = the overlap shown as a sub-label. */
export interface BulkSummary {
  total: number
  lolos: number
  kurang: number
  ganda: number
  gandaPairs: number
  luarZona: number
  outside: number
  outsideGanda: number
}
export function summarize(b: BansosBatch, upTo = b.rows.length): BulkSummary {
  const rows = b.rows.slice(0, upTo)
  const n = (r: BulkResult) => rows.filter((x) => x.result === r).length
  const done = new Set(rows.map((r) => r.doc.id))
  return {
    total: b.rows.length,
    lolos: n('lolos'),
    kurang: n('kurang'),
    ganda: n('ganda'),
    gandaPairs: b.duplicateGroups.filter((g) => g.every((id) => done.has(id))).length,
    luarZona: n('luar-zona'),
    outside: rows.filter((x) => x.outsideZone).length,
    outsideGanda: rows.filter((x) => x.outsideZone && x.result === 'ganda').length,
  }
}
export const zoneKey = (zone: readonly string[]): string => [...zone].sort().join(',')

/** The last bulk run of this session: what was emitted to the world (KPI strip, AI context). Cleared with the log. */
export interface BulkRun {
  summary: BulkSummary
  zone: string[]
  /** wall time of the run (ms) */
  ms: number
  /** files sent to manual review (NIK ganda + luar zona) */
  manual: number
}
let bulk: BulkRun | null = null
const bulkSubs = new Set<() => void>()
export const bulkLog = {
  get: (): BulkRun | null => bulk,
  set(r: BulkRun | null): void {
    bulk = r
    bulkSubs.forEach((f) => f())
  },
  subscribe(fn: () => void): () => void {
    bulkSubs.add(fn)
    return () => void bulkSubs.delete(fn)
  },
}

/* ------------------------------------------------------------------ gallery sample → world document */

/**
 * A gallery SPESIMEN is a picture; the world keeps the desk's records. Each sample stands for one perizinan desk
 * record so `document.verified` always names a document that exists (status, verification row, audit refs, the
 * "files waiting" KPI): the edited KTP is the seeded tampered record (facts.tamperedDocumentId); every other sample
 * gets its own record, preferring one still waiting ('baru') and of the same kind. Fixed per world seed.
 */
const SAMPLE_ORDER: readonly string[] = [...new Set([...GALLERY.perizinan, ...GALLERY.dinsos])]
let docMap: { seed: number; size: number; map: Map<string, string> } | null = null
export function worldDocFor(s: WorldState, sampleId: string): string | null {
  if (!docMap || docMap.seed !== s.seed || docMap.size !== s.documents.ids.length) docMap = { seed: s.seed, size: s.documents.ids.length, map: buildDocMap(s) }
  return docMap.map.get(sampleId) ?? null
}
function buildDocMap(s: WorldState): Map<string, string> {
  const out = new Map<string, string>()
  const tampered = s.meta.facts.tamperedDocumentId
  if (tampered && s.documents.byId[tampered]) out.set('ktp-siti-edit', tampered)
  const pool = s.documents.ids.map((id) => s.documents.byId[id]).filter((d): d is DocumentRec => !!d && d.program === 'perizinan' && !d.tampered && d.id !== tampered)
  const used = new Set<string>()
  const kindOf = (sample: string) => sample.split('-')[0] ?? ''
  const take = (pred: (d: DocumentRec) => boolean) => pool.find((d) => !used.has(d.id) && pred(d))
  for (const sample of SAMPLE_ORDER) {
    if (out.has(sample)) continue
    const k = kindOf(sample)
    const d = take((x) => x.kind === k && x.status === 'baru') ?? take((x) => x.status === 'baru') ?? take((x) => x.kind === k) ?? take(() => true)
    if (!d) continue
    used.add(d.id)
    out.set(sample, d.id)
  }
  return out
}

/** "************1234" */
export const maskNik = (nik: string | null): string => (nik ? `•••• •••• •••• ${nik.slice(-4)}` : '—')

/* ------------------------------------------------------------------ AI context */

/** What the assistant (simulation and Live) reads: compact (< 2 KB), only what the screen shows. */
export interface CekContext {
  role: CekRole
  mode: Mode
  doc: null | {
    id: string
    title: string
    kind: string
    verdict: Verdict | null
    reasons: string[]
    checks: { id: string; label: string; status: 'ok' | 'warn' | 'fail'; note?: string }[]
    fields: { key: string; label: string; value: string; confidence: number }[]
    tamperTop: number
    tamperReasons: string[]
  }
  /** luarZona = files whose result is "luar zona" (chips, Σ = total); outside = every address outside the zone */
  batch: { total: number; lolos: number; kurang: number; ganda: number; gandaPairs: number; luarZona: number; outside: number; processed: boolean; zone: string[] }
  program: null | { quota: number; kecamatan: string[]; openedAt: string }
  session: { verified: number; manual: number }
  region: string
}
