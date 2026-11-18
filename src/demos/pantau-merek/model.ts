/**
 * demos/pantau-merek/model.ts — world reads shared by the first screen and the lazy parts. Every number comes from the
 * kit selectors in world/usaha-pintar (one source for card, KPI, Kompetitor, owner band and missions); this file only
 * memoises them against the tables they read and the world minute.
 */
import { useMemo, useSyncExternalStore } from 'react'
import { clock, rows, useWorld, world, type BrandAlert, type BrandAnnouncement, type BrandMention, type WorldState } from '../../demo-kit/world'
import { UP_SCENARIO, activeBrandAlert, activeFloodAlert, brandAlertsAt, kecName, reputationAt } from '../../demo-kit/world/usaha-pintar'

export const SLUG = 'pantau-merek' as const

const nowOf = () => clock.get().minutes
/** the world minute (re-renders once per minute) */
export const useNow = (): number => useSyncExternalStore(clock.subscribe, nowOf, nowOf)
const runOf = () => clock.get().running
export const useRunning = (): boolean => useSyncExternalStore(clock.subscribe, runOf, runOf)

const selMentions = (s: WorldState) => s.brandMentions
const selAlerts = (s: WorldState) => s.brandAlerts
const selAnns = (s: WorldState) => s.brandAnnouncements
const selFloods = (s: WorldState) => s.alerts
const selShop = (s: WorldState) => s.meta.shopId

/** the brand tables (stable refs: a component re-renders only when one of them changes) */
export function useBrandTables() {
  const mentions = useWorld(selMentions)
  const alerts = useWorld(selAlerts)
  const anns = useWorld(selAnns)
  const floods = useWorld(selFloods)
  const shopId = useWorld(selShop)
  return { mentions, alerts, anns, floods, shopId }
}

/** run a selector over the current world, memoised on the brand tables + `now` */
export function useBrand<T>(fn: (s: WorldState, now: number) => T, now: number, extra: unknown[] = []): T {
  const { mentions, alerts, anns, floods } = useBrandTables()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fn(world.get(), now), [mentions, alerts, anns, floods, now, ...extra])
}

export interface Shop { id: string; name: string; owner: string; ownerFirst: string; market: string }
export function shopOf(s: WorldState): Shop {
  const b = s.businesses.byId[s.meta.shopId]
  const owner = b?.ownerName ?? ''
  return { id: s.meta.shopId, name: b?.name ?? '', owner, ownerFirst: owner.split(' ')[0] ?? owner, market: (b?.marketId && s.markets.byId[b.marketId]?.name) || s.region.shortName }
}

/** the stored alert of today (also when its crossing minute is still ahead) — "Lompat ke lonjakan" goes there */
export const storedAlert = (s: WorldState): BrandAlert | null => rows(s.brandAlerts).filter((a) => a.businessId === s.meta.shopId).sort((a, b) => b.at - a.at)[0] ?? null

/** where "Lompat ke lonjakan" sets the clock */
export function spikeTarget(s: WorldState, now: number): number {
  const a = storedAlert(s)
  if (a) return Math.max(now, a.at + 1)
  return Math.max(now, UP_SCENARIO.floodAt + 7)
}

/** the alert the card shows: active, else the newest handled one visible at `now` */
export function cardAlert(s: WorldState, now: number): { alert: BrandAlert | null; ann: BrandAnnouncement | null } {
  const alert = activeBrandAlert(s, now) ?? brandAlertsAt(s, now)[0] ?? null
  const ann = alert ? (rows(s.brandAnnouncements).filter((x) => x.alertId === alert.id).sort((a, b) => b.at - a.at)[0] ?? null) : null
  return { alert, ann }
}

/** flood notice: the active flood alert's level + kecamatan names */
export function floodNotice(s: WorldState): { id: string; level: number; kec: string } | null {
  const a = activeFloodAlert(s)
  if (!a) return null
  return { id: a.id, level: a.level, kec: a.kecamatanIds.map((k) => kecName(s, k)).join(', ') }
}

/** mission 4: the lowest shop reputation since the alert crossed (at each shop mention), and whether a reply or an
 *  announcement happened since */
export function recovery(s: WorldState, now: number): { low: number; score: number; acted: boolean } | null {
  const a = brandAlertsAt(s, now).find((x) => x.businessId === s.meta.shopId)
  if (!a) return null
  const shopId = s.meta.shopId
  const ms = rows(s.brandMentions).filter((m) => m.brand === shopId && m.at >= a.at && m.at <= now)
  let low = reputationAt(s, a.at, shopId)
  for (const m of ms) low = Math.min(low, reputationAt(s, m.at, shopId))
  const acted = rows(s.brandAnnouncements).some((x) => x.alertId === a.id) || ms.some((m) => m.repliedAt != null) || rows(s.brandMentions).some((m) => m.brand === shopId && m.repliedAt != null && m.repliedAt >= a.at)
  return { low, score: reputationAt(s, now, shopId), acted }
}

/** hourly negative delivery complaints of the shop over the last `hours` (pre-signal sparkline) */
export function deliveryHourly(s: WorldState, now: number, hours = 8): number[] {
  const shopId = s.meta.shopId
  const end = Math.floor(now / 60) * 60 + 60
  const out = new Array<number>(hours).fill(0)
  for (const m of rows(s.brandMentions)) {
    if (m.brand !== shopId || m.topic !== 'pengiriman' || m.sentiment !== 'negatif' || m.at > now) continue
    const i = hours - 1 - Math.floor((end - 1 - m.at) / 60)
    if (i >= 0 && i < hours) out[i]! += 1
  }
  return out
}

export const isShopMention = (s: WorldState, m: BrandMention): boolean => m.brand === s.meta.shopId

/** focus id kind */
export const focusKind = (id: string): 'alert' | 'mention' | 'ann' | null => (/^BA-/.test(id) ? 'alert' : /^BM-/.test(id) ? 'mention' : /^BN-/.test(id) ? 'ann' : null)

/** module store: an announcement draft waiting for the owner's approval (survives the role switch) */
export interface PendingDraft { alertId: string; offer: BrandAnnouncement['offer']; channels: BrandAnnouncement['channels']; text: { id: string; en: string } }
let pending: PendingDraft | null = null
const pendSubs = new Set<() => void>()
export const pendingDraft = {
  get: () => pending,
  set(d: PendingDraft | null) {
    pending = d
    for (const f of [...pendSubs]) f()
  },
  subscribe(f: () => void) {
    pendSubs.add(f)
    return () => void pendSubs.delete(f)
  },
}
export const usePendingDraft = (): PendingDraft | null => useSyncExternalStore(pendingDraft.subscribe, pendingDraft.get, pendingDraft.get)

/** module store: the review selection (kept across tabs and role switches) */
let selection: readonly string[] = []
const selSubs = new Set<() => void>()
export const reviewSelection = {
  get: () => selection,
  set(ids: readonly string[]) {
    selection = ids
    for (const f of [...selSubs]) f()
  },
  subscribe(f: () => void) {
    selSubs.add(f)
    return () => void selSubs.delete(f)
  },
}
export const useSelection = (): readonly string[] => useSyncExternalStore(reviewSelection.subscribe, reviewSelection.get, reviewSelection.get)
