/**
 * demos/cek-berkas/model.ts — shared, React-free pieces of Cek Berkas: roles → gallery and default mode, the
 * session verification log (module store, survives mode switches, cleared by the shell's Reset through the canvas
 * epoch remount), bulk result → document status, and the compact context the AI assistant reads.
 */
import type { DocumentRec, WorldState } from '../../demo-kit/world'
import { flushPersist } from '../../demo-kit/world/persist'
import type { Verdict } from '../../demo-kit/docs'
import type { BansosRow } from '../../demo-kit/world/satu-daerah'

export type Mode = 'single' | 'bulk'

/** the shell's "start here" ring (index.tsx `hotspot.id`); a gallery pick retires it via dismissHotspot */
export const HOTSPOT_ID = 'cek-berkas:start'
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
    save()
    subs.forEach((f) => f())
  },
  clear(): void {
    if (!log.length) return
    log = []
    save()
    subs.forEach((f) => f())
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => void subs.delete(fn)
  },
}

/* ------------------------------------------------------------------ bulk */

export type BulkResult = 'lolos' | 'kurang' | 'ganda' | 'luar-zona'
/** one finding on a file; a file can carry several (a missing attachment never hides behind "luar zona") */
export type Finding = Exclude<BulkResult, 'lolos'>
export const STATUS_OF: Record<BulkResult, DocumentRec['status']> = { lolos: 'lengkap', kurang: 'kurang', ganda: 'cek-manual', 'luar-zona': 'cek-manual' }
export type ZoneSource = 'program' | 'alert' | 'scenario'

export interface CekRow extends Omit<BansosRow, 'result'> {
  /** primary status (card colour, world status): NIK ganda → luar zona → kurang → lolos */
  result: BulkResult
  /** every finding on the file, primary first */
  findings: Finding[]
  /** 1-based positions (#nn) of the files sharing this NIK */
  pairNos: number[]
  /** 1-based positions (#nn) of other files with the same full name but a different NIK: a note, not a finding */
  sameName: number[]
}
export interface CekBatch {
  rows: CekRow[]
  /** kecamatan the addresses are checked against: the warning / programme kecamatan + the scenario flood-risk map */
  zone: string[]
  /** the kecamatan named by the warning / programme (null before any warning) */
  warnZone: string[] | null
  source: ZoneSource
  duplicateGroups: string[][]
}

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

/** Chip counts per finding (a file with two findings counts in both chips; lolos = no finding at all). */
export interface BulkSummary {
  total: number
  /** files checked so far */
  done: number
  lolos: number
  kurang: number
  /** kurang files that also carry another finding */
  kurangAlso: number
  ganda: number
  gandaPairs: number
  luarZona: number
  /** luar-zona files that are also NIK ganda */
  luarGanda: number
  /** files for manual review: NIK ganda or outside the zone (each file once) */
  manual: number
}
export function summarize(b: CekBatch, upTo = b.rows.length): BulkSummary {
  const rs = b.rows.slice(0, upTo)
  const has = (r: CekRow, f: Finding) => r.findings.includes(f)
  const done = new Set(rs.map((r) => r.doc.id))
  return {
    total: b.rows.length,
    done: rs.length,
    lolos: rs.filter((r) => !r.findings.length).length,
    kurang: rs.filter((r) => has(r, 'kurang')).length,
    kurangAlso: rs.filter((r) => has(r, 'kurang') && r.findings.length > 1).length,
    ganda: rs.filter((r) => has(r, 'ganda')).length,
    gandaPairs: b.duplicateGroups.filter((g) => g.every((id) => done.has(id))).length,
    luarZona: rs.filter((r) => has(r, 'luar-zona')).length,
    luarGanda: rs.filter((r) => has(r, 'luar-zona') && has(r, 'ganda')).length,
    manual: rs.filter((r) => has(r, 'ganda') || has(r, 'luar-zona')).length,
  }
}
export const zoneKey = (zone: readonly string[]): string => [...zone].sort().join(',')

/** one file of the last bulk run, as the audit drawer names it (#nn, findings, NIK pair / namesake numbers) */
export interface BulkFile {
  n: number
  name: string
  findings: Finding[]
  pairNos: number[]
}
/** The last bulk run of this session: what was emitted to the world (KPI strip, AI context, audit labels).
 *  Kept with the session (sessionStorage) so a hop to Siaga Wilayah and back keeps the result on screen. */
export interface BulkRun {
  summary: BulkSummary
  zone: string[]
  warnZone: string[] | null
  source: ZoneSource
  /** world minutes of the run */
  at: number
  /** wall time of the run (ms) */
  ms: number
  /** files sent to manual review (NIK ganda or luar zona, each file once) */
  manual: number
  files: Record<string, BulkFile>
}
let bulk: BulkRun | null = null
const bulkSubs = new Set<() => void>()
export const bulkLog = {
  get: (): BulkRun | null => bulk,
  set(r: BulkRun | null): void {
    bulk = r
    save()
    bulkSubs.forEach((f) => f())
  },
  subscribe(fn: () => void): () => void {
    bulkSubs.add(fn)
    return () => void bulkSubs.delete(fn)
  },
}

/* ------------------------------------------------------------------ session persistence (per tab, per world) */

/** Save the world now instead of after the kit's debounce: a verification is followed at once by a hop to another
 *  product (a full page load), and a world saved before the hop keeps the audit entries the screen counts. */
export function saveWorldSoon(): void {
  setTimeout(() => flushPersist(), 60)
}
/** a cross-product link: start the save before the page goes */
export const saveWorldNow = (): void => flushPersist()

const STORE_KEY = 'gamada:cb:session'
let worldKey = ''
function save(): void {
  if (!worldKey) return
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ world: worldKey, log, bulk }))
  } catch {
    /* storage blocked: the session lives in memory only */
  }
}
const cekVerifies = (s: WorldState) => {
  let n = 0
  for (const id of s.auditLog.ids) {
    const e = s.auditLog.byId[id]
    if (e && e.source === 'cek-berkas' && e.type === 'document.verified') n++
  }
  return n
}
/**
 * A canvas mount: keep (or restore from this tab's sessionStorage) the session's checks while the world still holds
 * their audit entries, so a hop to another product and back never zeroes the KPI strip or drops the bulk result;
 * a reset / new world (no Cek Berkas entries in its audit log) starts a fresh session.
 */
export function resumeSession(s: WorldState): void {
  const key = `${s.region.id}:${s.seed}`
  const known = cekVerifies(s)
  if (worldKey !== key || (!log.length && !bulk)) {
    worldKey = key
    log = []
    bulk = null
    try {
      const raw = window.sessionStorage.getItem(STORE_KEY)
      const o = raw ? (JSON.parse(raw) as { world?: string; log?: LogRow[]; bulk?: BulkRun | null }) : null
      if (o && o.world === key) {
        log = Array.isArray(o.log) ? o.log : []
        bulk = o.bulk && o.bulk.files && Array.isArray(o.bulk.zone) ? o.bulk : null
      }
    } catch {
      /* nothing to restore */
    }
  }
  // a world without any Cek Berkas entry (reset, new seed) never shows an older session's numbers
  if (!known) {
    log = []
    bulk = null
  }
  save()
  subs.forEach((f) => f())
  bulkSubs.forEach((f) => f())
}

export const pad2 = (n: number): string => String(n).padStart(2, '0')

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

/** 16 digits → "•••• •••• ••12 3456": the last 6 stay visible, so two different NIKs never look alike */
export const maskNik = (nik: string | null): string => (nik ? `•••• •••• ••${nik.slice(10, 12)} ${nik.slice(12)}` : '—')
/** card corner: "…12 3456" */
export const nikTail = (nik: string | null): string => (nik ? `…${nik.slice(10, 12)}\u2009${nik.slice(12)}` : '')

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
  /** chip counts: a file with two findings counts in both; manual = NIK ganda or luar zona (each file once) */
  batch: { total: number; lolos: number; kurang: number; ganda: number; gandaPairs: number; luarZona: number; manual: number; processed: boolean; zone: string[]; warnZone: string[] | null }
  program: null | { quota: number; kecamatan: string[]; openedAt: string }
  session: { verified: number; manual: number }
  region: string
}
