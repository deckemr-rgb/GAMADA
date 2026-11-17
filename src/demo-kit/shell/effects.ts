/**
 * shell/effects.ts — detects when an event produced by THIS product causes an effect in ANOTHER product
 * (spec §6.3 EventToast). Pure logic, testable without React:
 *
 *   world/reactions.ts creates follow-up events with `causeId` + `depth`. We remember recent events, walk a
 *   follow-up's chain back to its root, and report an effect when the root's source is this product and the
 *   follow-up lands in another product (its `source`, or EFFECT_TARGET for follow-ups that keep the source
 *   but are consumed elsewhere, e.g. a Sapa Warga complaint cluster that goes to Meja Pimpinan).
 */
import { PRODUCT_BY_SLUG, isProductSlug, type Bi, type ProductSlug } from '../../content/products'
import type { AuditEntry, EventType, WorldEvent, WorldState } from '../world'
import { DEMO_ID, demoStringsIfLoaded, type DemoDict } from '../i18n'
import { SHELL } from './constants'

/** Follow-ups whose `source` is the producer but whose consumer is another product. */
export const EFFECT_TARGET: Partial<Record<EventType, ProductSlug>> = {
  'complaint.clustered': 'meja-pimpinan',
  'briefing.generated': 'meja-pimpinan',
}

export interface CrossEffect {
  /** dedupe key: root event + target product */
  key: string
  rootId: string
  target: ProductSlug
  title: Bi
  body: Bi
  /** entity to open in the target product (`?focus=`) */
  focus: string | null
}

/** The toast is shown in the language current at push time, and EN is in memory whenever the site is in EN
 *  (demo-kit/i18n); an Indonesian session that never loaded EN gets ID text in both slots, which it never shows. */
const dict = (lang: 'id' | 'en'): DemoDict => demoStringsIfLoaded(lang) ?? DEMO_ID

type Recent = Pick<WorldEvent, 'id' | 'type' | 'source' | 'causeId' | 'depth' | 'payload'>

function rootLabel(e: Recent, lang: 'id' | 'en', summary: string | null): string {
  const L = dict(lang).rootLabel
  const p = e.payload as Record<string, unknown>
  switch (e.type) {
    case 'complaint.created':
      return L.complaint(String(p.code ?? p.id ?? ''))
    case 'complaint.clustered':
      return L.cluster
    case 'flood.alert':
    case 'rain.forecast':
      return L.flood
    case 'price.anomaly':
      return L.price
    case 'instruction.issued':
      return L.instruction
    case 'sale.created':
      return L.sale(String(p.code ?? p.id ?? ''))
    case 'hoax.detected':
      return L.hoax
    case 'procurement.created':
    case 'procurement.flagged':
      return L.procurement
    case 'need.created':
      return L.need
    case 'score.updated':
      return L.score
    case 'meeting.transcribed':
      return L.meeting
    default:
      return summary
        ? summary.length > 48
          ? `${summary.slice(0, 47)}…`
          : summary
        : dict(lang).eventFrom(isProductSlug(e.source) ? PRODUCT_BY_SLUG[e.source].name : e.source)
  }
}

function auditOf(s: WorldState, eventId: string): AuditEntry | undefined {
  const ids = s.auditLog.ids
  const n = Math.min(ids.length, SHELL.auditScan)
  for (let i = 0; i < n; i++) {
    const a = s.auditLog.byId[ids[i]!]
    if (a?.eventId === eventId) return a
  }
  return undefined
}

const refId = (r: string | undefined): string | null => {
  if (!r) return null
  const i = r.indexOf(':')
  const id = i >= 0 ? r.slice(i + 1) : r
  return id || null
}

/** Stateful tracker for one product. Feed it every processed event (onEvent('*')). */
export function createEffectTracker(product: ProductSlug) {
  const recent = new Map<string, Recent>()
  const seen = new Set<string>()

  function remember(e: WorldEvent) {
    recent.set(e.id, {
      id: e.id,
      type: e.type,
      source: e.source,
      causeId: e.causeId ?? null,
      depth: e.depth ?? 0,
      payload: e.payload,
    })
    if (recent.size > SHELL.recentEvents) {
      const first = recent.keys().next().value
      if (first !== undefined) recent.delete(first)
    }
  }

  function rootOf(e: Recent): Recent | null {
    let cur: Recent | undefined = e
    for (let guard = 0; cur && guard < 16; guard++) {
      if (!cur.causeId) return cur
      cur = recent.get(cur.causeId)
    }
    return null
  }

  return {
    /** returns the effect to announce, or null */
    feed(e: WorldEvent, s: WorldState): CrossEffect | null {
      remember(e)
      if (!e.depth || !e.causeId) return null
      const root = rootOf(recent.get(e.id)!)
      if (!root || root.id === e.id || root.source !== product) return null
      const target: ProductSlug | undefined = isProductSlug(e.source) && e.source !== product ? e.source : EFFECT_TARGET[e.type]
      if (!target || target === product) return null
      const k = `${root.id}>${target}`
      if (seen.has(k)) return null
      seen.add(k)
      const row = auditOf(s, e.id)
      const rootRow = auditOf(s, root.id)
      const name = PRODUCT_BY_SLUG[target].name
      return {
        key: k,
        rootId: root.id,
        target,
        title: {
          id: dict('id').forwardedTo(rootLabel(root, 'id', rootRow?.summary.id ?? null), name),
          en: dict('en').forwardedTo(rootLabel(root, 'en', rootRow?.summary.en ?? null), name),
        },
        body: row?.summary ?? {
          id: dict('id').openIn(name),
          en: dict('en').openIn(name),
        },
        focus: refId(row?.entityRefs[0]),
      }
    },
    /** forget everything (world reset) */
    clear() {
      recent.clear()
      seen.clear()
    },
  }
}
