/**
 * data-ext.ts — Meja Pimpinan helpers used only by the views that load on intent (instruction dialog, "Tanya data",
 * the hoax banner): kept out of the first screen's chunk.
 */
import { rows, type PricePoint, type Procurement, type WorldState } from '../../demo-kit/world'
import { devOf, weekChange } from './data'

/** OPD id by a hint (id or short name contains it), as the kit's instructionIdeas does */
export function findOpd(s: WorldState, hint: string): string | undefined {
  const h = hint.toLowerCase()
  return s.region.opd.find((o) => o.id === h)?.id ?? s.region.opd.find((o) => `${o.id} ${o.short} ${o.name}`.toLowerCase().includes(h))?.id
}

/** OPD ids named in free text ("BPBD dan Dinas PUPR", "the public works office") */
export function opdsInText(s: WorldState, text: string): string[] {
  const t = ` ${text.toLowerCase()} `
  const alias: Record<string, string[]> = {
    bpbd: ['bpbd', 'bencana', 'disaster'],
    pupr: ['pupr', 'pekerjaan umum', 'public works', 'bina marga'],
    diskominfo: ['kominfo', 'diskominfo', 'humas', 'communication'],
    disperindag: ['disperindag', 'perdagangan', 'trade'],
    inspektorat: ['inspektorat', 'inspectorate', 'audit'],
    dinsos: ['dinsos', 'sosial', 'social'],
    dinkes: ['dinkes', 'kesehatan', 'health'],
    dlh: ['dlh', 'lingkungan hidup', 'environment', 'sampah', 'waste'],
    dishub: ['dishub', 'perhubungan', 'transport'],
    distan: ['distan', 'pertanian', 'agricultur'],
    satpolpp: ['satpol', 'public order'],
    ukpbj: ['pbj', 'ukpbj', 'pengadaan', 'procurement'],
    disdukcapil: ['dukcapil', 'civil registry'],
  }
  const out = new Set<string>()
  for (const o of s.region.opd) {
    const keys = [o.short.toLowerCase(), o.id, ...(alias[o.id] ?? [])]
    if (keys.some((k) => k.length > 2 && t.includes(k))) out.add(o.id)
  }
  return [...out]
}

/** the single market x commodity with the largest 7-day rise (briefing, map, suggestions and chat all name this one) */
export function topRiser(s: WorldState): { p: PricePoint; d: number } | null {
  let best: { p: PricePoint; d: number } | null = null
  for (const p of rows(s.prices)) {
    const d = weekChange(p.price, p.history)
    if (!best || d > best.d) best = { p, d }
  }
  return best
}
/** the riskiest active package, in the kit briefing's order: flagged by risk score, else an emergency one, else the
 *  highest mark-up over market. Briefing, suggestions and chat name the same package. */
export function riskiestProcurement(s: WorldState): Procurement | null {
  const procs = rows(s.procurements).filter((p) => p.status !== 'selesai')
  return procs.filter((p) => p.flagged).sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))[0] ?? procs.find((p) => p.emergency) ?? [...procs].sort((a, b) => devOf(b) - devOf(a))[0] ?? null
}
/** sort key for a package list that starts with riskiestProcurement's choice */
export function riskRank(p: Procurement): number {
  return p.flagged ? 2000 + (p.riskScore ?? 0) : p.emergency ? 1000 : devOf(p)
}
