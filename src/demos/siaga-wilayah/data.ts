/**
 * siaga-wilayah/data.ts — memoised world reads of this product (pure; safe inside useWorld) and the small scenario
 * helpers the eager screen needs. Everything numeric here is SIMULATED (seeded world) and labelled so in the UI.
 */
import { rows, type Alert, type Complaint, type DemoSession, type Facility, type WorldState, type WaterGauge } from '../../demo-kit/world'
import { demoHref } from '../../demo-kit/shell'
import type { ProductSlug, RoleId } from '../../content/products'

/** this product's roles: BPBD (default) sends warnings, Kepala Daerah approves + sends, Dinas Pertanian reads */
export const ROLES_OF = ['bpbd', 'pertanian', 'kepala-daerah'] as const satisfies readonly RoleId[]
export type SwRole = (typeof ROLES_OF)[number]
export const swRole = (r: RoleId | string): SwRole => ((ROLES_OF as readonly string[]).includes(r) ? (r as SwRole) : 'bpbd')
export const canSend = (r: SwRole): boolean => r !== 'pertanian'

/** today's window for "reports this morning": since 18:00 yesterday */
const SINCE = -6 * 60

function memo1<A, R>(fn: (a: A) => R): (a: A) => R {
  let la: A | undefined
  let lr: R | undefined
  let has = false
  return (a: A) => {
    if (has && a === la) return lr as R
    la = a
    lr = fn(a)
    has = true
    return lr
  }
}

const reportsOf = memo1((t: WorldState['complaints']): Complaint[] => rows(t).filter((c) => c.category === 'banjir' && c.at >= SINCE))
/** flood complaints since last evening, newest first */
export const floodReports = (s: WorldState): Complaint[] => reportsOf(s.complaints)

const activeOf = memo1((t: WorldState['alerts']): Alert[] => rows(t).filter((a) => a.status === 'aktif' && a.kind === 'banjir'))
/** active flood alerts, newest first */
export const floodAlerts = (s: WorldState): Alert[] => activeOf(s.alerts)

const confirmedOf = memo1((t: WorldState['alerts']): ReadonlySet<string> => {
  const out = new Set<string>()
  for (const a of rows(t)) for (const id of a.confirmedBy ?? []) out.add(id)
  return out
})
/** complaint ids that confirmed any alert ("Terkonfirmasi warga") */
export const confirmedIds = (s: WorldState): ReadonlySet<string> => confirmedOf(s.alerts)

const sheltersOf = memo1((t: WorldState['facilities']): Facility[] => rows(t).filter((f) => f.kind === 'pengungsian'))
export const shelters = (s: WorldState): Facility[] => sheltersOf(s.facilities)

const keyFacOf = memo1((t: WorldState['facilities']): Facility[] => rows(t).filter((f) => f.kind === 'rs' || f.kind === 'puskesmas' || f.kind === 'sekolah' || f.kind === 'pengungsian'))
export const keyFacilities = (s: WorldState): Facility[] => keyFacOf(s.facilities)

const riverOf = memo1((t: WorldState['gauges']): WaterGauge | null => rows(t).find((g) => g.kind === 'sungai') ?? null)
/** the flood river gauge (simulated readings at a real place) */
export const riverGauge = (s: WorldState): WaterGauge | null => riverOf(s.gauges)

const phonesOf = memo1((t: WorldState['messages']): number => rows(t).reduce((n, m) => (m.kind === 'peringatan' ? n + m.to.length : n), 0))
/** citizen phones reached by warnings today */
export const phonesReached = (s: WorldState): number => phonesOf(s.messages)

const pascaOf = memo1((t: WorldState['harvests']): boolean => rows(t).some((h) => h.scenario === 'pasca-banjir'))
export const harvestPasca = (s: WorldState): boolean => pascaOf(s.harvests)

const clusterOf = memo1((t: WorldState['clusters']): number => rows(t).filter((c) => c.category === 'banjir').reduce((n, c) => Math.max(n, c.complaintIds.length), 0))
/** size of the largest flood cluster (0 = none) */
export const floodClusterSize = (s: WorldState): number => clusterOf(s.clusters)

/** hh.mm (ID) / hh:mm (EN) of a world minute */
export function clockText(min: number, lang: 'id' | 'en'): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return lang === 'id' ? `${hh}.${mm}` : `${hh}:${mm}`
}

/** link to another product's demo with this session (keeps ?controls=all while products are not DEMO_READY yet) */
export function productHref(slug: ProductSlug, s: DemoSession, focus?: string | null): string {
  const h = demoHref(slug, s, focus)
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all' ? `${h}&controls=all` : h
}
