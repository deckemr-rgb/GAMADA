/**
 * demos/cek-berkas/batch.ts — the bansos batch with every finding kept, the reference zone and the CSV. Kept out of
 * model.ts because it pulls the kit's satu-daerah module: only Massal and the assistant (both lazy) load it.
 */
import { activeAlerts, rows, type Bi, type WorldState } from '../../demo-kit/world'
import { bansosBatch } from '../../demo-kit/world/satu-daerah'
import { pad2, zoneKey, type CekBatch, type CekRow, type Finding, type ZoneSource } from './model'

/** deterministic 0..1 per id (same FNV hash as the kit's satu-daerah `unit`) */
function unit(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}
const MISSING: Bi[] = [
  { id: 'Foto rumah belum dilampirkan', en: 'House photo not attached' },
  { id: 'Fotokopi KK belum dilampirkan', en: 'Family card copy not attached' },
  { id: 'Surat keterangan domisili belum ada', en: 'Domicile letter missing' },
]

const bansosProgram = (s: WorldState) => rows(s.programs).find((p) => p.open && p.kind === 'bansos-banjir')
export function zoneOf(s: WorldState): { zone: string[]; warnZone: string[] | null; source: ZoneSource } {
  const prog = bansosProgram(s)
  const alert = activeAlerts(s).find((a) => a.kind === 'banjir')
  const warn = prog?.kecamatanIds ?? alert?.kecamatanIds ?? null
  const risk = s.region.floodKecamatanIds
  // flood victims are checked against the disaster map: the warned kecamatan plus the scenario flood-risk area, so a
  // warning that names only part of the area never turns the other flooded kecamatan into "luar zona"
  const zone = [...new Set([...(warn ?? []), ...risk])]
  return { zone, warnZone: warn, source: prog ? 'program' : alert ? 'alert' : 'scenario' }
}

let memo: { key: string; docs: unknown; b: CekBatch } | null = null
/** The 50 flood-aid applicant files with every finding kept (product view over the kit's bansosBatch). */
export function cekBatch(s: WorldState): CekBatch {
  return cekBatchFor(s, zoneOf(s))
}
/** the same batch checked against a given reference zone (a restored earlier run keeps the zone it used) */
export function cekBatchFor(s: WorldState, z: { zone: string[]; warnZone: string[] | null; source: ZoneSource }): CekBatch {
  const key = `${zoneKey(z.zone)}|${z.warnZone?.join(',') ?? ''}|${z.source}`
  if (memo && memo.key === key && memo.docs === s.documents) return memo.b
  const kb = bansosBatch(s, z.zone)
  const byName = new Map<string, number[]>()
  kb.rows.forEach((r, i) => {
    const k = r.doc.ownerName.trim().toLowerCase()
    byName.set(k, [...(byName.get(k) ?? []), i])
  })
  const pos = new Map(kb.rows.map((r, i) => [r.doc.id, i + 1]))
  const out: CekRow[] = kb.rows.map((r) => {
    const u = unit(r.doc.id)
    // ~8% of files lack one attachment, whatever else is found on them
    const missing = u < 0.08 ? MISSING[Math.floor(u * 100) % MISSING.length]! : null
    const findings: Finding[] = []
    if (r.duplicateOf.length) findings.push('ganda')
    if (r.outsideZone) findings.push('luar-zona')
    if (missing) findings.push('kurang')
    const pairNos = r.duplicateOf.map((id) => pos.get(id) ?? 0).filter((n) => n > 0)
    // same full name, different NIK (a NIK pair is already a finding): an indication for a field check, never a verdict
    const sameName = (byName.get(r.doc.ownerName.trim().toLowerCase()) ?? []).map((j) => j + 1).filter((n) => n !== (pos.get(r.doc.id) ?? 0) && !pairNos.includes(n))
    return { ...r, missing, findings, result: findings[0] ?? 'lolos', pairNos, sameName }
  })
  const b: CekBatch = { rows: out, zone: kb.zone, warnZone: z.warnZone, source: z.source, duplicateGroups: kb.duplicateGroups }
  memo = { key, docs: s.documents, b }
  return b
}


/** CSV of a finished run: SIMULASI header lines, #nn + DK id, display names, every finding with its reason */
export function cekCsv(
  b: CekBatch,
  o: { lang: 'id' | 'en'; at: string; role: string; kecName: (id: string) => string; desaName: (k: string, d: string) => string; resultLabel: Record<string, string>; zoneLabel: string },
): string {
  const { lang } = o
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`
  const zoneNames = b.zone.map(o.kecName).join(', ')
  const head =
    lang === 'id'
      ? [
          `# DATA SIMULASI · SPESIMEN FIKTIF · bukan data resmi. Cek Berkas (demo GAMADA), diperiksa ${o.at} WIB (jam dunia demo).`,
          `# Zona acuan: ${o.zoneLabel}: ${zoneNames}.`,
          '# NIK disamarkan (6 digit terakhir). Nomor berkas DK mengikuti penomoran loket bersama; nomor yang tidak muncul adalah berkas perizinan.',
          'no,berkas,nama,nik,kecamatan,desa,hasil,temuan,catatan,zona_acuan,diperiksa_pada,peran,sumber',
        ]
      : [
          `# SIMULATED DATA · FICTIONAL SPECIMENS · not official data. Cek Berkas (GAMADA demo), checked ${o.at} WIB (demo world clock).`,
          `# Reference zone: ${o.zoneLabel}: ${zoneNames}.`,
          '# NIK masked (last 6 digits). DK file numbers follow the shared desk numbering; missing numbers are licensing files.',
          'no,file,name,nik,district,village,result,findings,notes,reference_zone,checked_at,role,source',
        ]
  const byId = new Map(b.rows.map((r, i) => [r.doc.id, { r, n: i + 1 }]))
  const lines = b.rows.map((r, i) => {
    const notes: string[] = []
    for (const f of r.findings) {
      if (f === 'ganda')
        notes.push(
          r.duplicateOf
            .map((id) => {
              const p = byId.get(id)
              const who = p ? ` (#${pad2(p.n)} ${p.r.doc.ownerName})` : ''
              return lang === 'id' ? `NIK sama dengan ${id}${who}` : `Same NIK as ${id}${who}`
            })
            .join('; '),
        )
      if (f === 'luar-zona') notes.push(lang === 'id' ? `Alamat di Kec. ${o.kecName(r.doc.kecamatanId)}, di luar zona acuan` : `Address in ${o.kecName(r.doc.kecamatanId)} district, outside the reference zone`)
      if (f === 'kurang' && r.missing) notes.push(r.missing[lang])
    }
    for (const n of r.sameName) {
      const o2 = b.rows[n - 1]
      notes.push(lang === 'id' ? `Catatan: nama sama dengan #${pad2(n)} (NIK beda, Kec. ${o2 ? o.kecName(o2.doc.kecamatanId) : ''}); cek lapangan, bukan temuan` : `Note: same name as #${pad2(n)} (different NIK, ${o2 ? o.kecName(o2.doc.kecamatanId) : ''} district); field check, not a finding`)
    }
    return [
      `#${pad2(i + 1)}`,
      r.doc.id,
      r.doc.ownerName,
      r.doc.nik ? `**********${r.doc.nik.slice(-6)}` : '',
      o.kecName(r.doc.kecamatanId),
      o.desaName(r.doc.kecamatanId, r.doc.desaId),
      o.resultLabel[r.result] ?? r.result,
      r.findings.map((f) => o.resultLabel[f] ?? f).join(' + ') || (o.resultLabel.lolos ?? 'lolos'),
      notes.join('; '),
      zoneNames,
      o.at,
      o.role,
      lang === 'id' ? 'SIMULASI' : 'SIMULATED',
    ]
      .map(q)
      .join(',')
  })
  return [...head, ...lines].join('\n')
}
