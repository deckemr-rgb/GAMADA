/**
 * shell/effects.ts — detects when an event produced by THIS product causes an effect in ANOTHER product
 * (spec §6.3 EventToast). Pure logic, testable without React:
 *
 *   world/reactions.ts creates follow-up events with `causeId` + `depth`. We remember recent events, walk a
 *   follow-up's chain back to its root, and report an effect when the root's source is this product and the
 *   follow-up lands in another product (its `source`, or EFFECT_TARGET for follow-ups that keep the source
 *   but are consumed elsewhere, e.g. a Sapa Warga complaint cluster that goes to Meja Pimpinan).
 *
 * Tahap 2:
 *   - ONE toast per root: every further product the same root reaches is added to that toast (same key, so the
 *     shell's queue replaces it): "Peringatan banjir diteruskan ke Awas Belanja, Cek Berkas +3".
 *   - Background roots (source 'clock') are announced only when THIS product itself reacted to them and the
 *     follow-up is consumed elsewhere (EFFECT_TARGET): e.g. the 10:00 rumor burst → Radar Isu detects the hoax →
 *     "… diteruskan ke Meja Pimpinan" on the Radar Isu page.
 */
import { PRODUCT_BY_SLUG, isProductSlug, type Bi, type ProductSlug } from '../../content/products'
import type { AuditEntry, EventType, WorldEvent, WorldState } from '../world'
import { DEMO_ID, demoStringsIfLoaded, type DemoDict } from '../i18n'
import { DEMO_READY, DEMO_STAGE } from '../../demos/registry'
import { SHELL } from './constants'

/** Follow-ups whose `source` is the producer but whose consumer is another product. */
export const EFFECT_TARGET: Partial<Record<EventType, ProductSlug>> = {
  'complaint.clustered': 'meja-pimpinan',
  'briefing.generated': 'meja-pimpinan',
  'hoax.detected': 'meja-pimpinan',
}

export interface CrossEffect {
  /** one toast per root event: the key stays the same while more targets are added */
  key: string
  rootId: string
  /** the first product reached whose demo is open (the toast opens it); null when none is built yet */
  target: ProductSlug | null
  /** every product this root reached so far, in order */
  targets: ProductSlug[]
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
      // a title is a whole short sentence, never cut mid-word: a long summary stays in the body
      return summary && summary.length <= 48
        ? summary
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

/** follow-ups that name the toast themselves (they are the news, not the root that caused them) */
const HEADLINE = new Set<EventType>(['complaint.clustered', 'hoax.detected'])

/** "Klaster banjir X: 5 aduan → Meja Pimpinan, Siaga Wilayah & Radar Isu" → "Klaster banjir X: 5 aduan" */
const stripTargets = (s: string): string => s.replace(/\s+→\s+[^→]*$/, '')

/** "A", "A & B", "A, B & C", "A, B +2" */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`
  return `${names[0]}, ${names[1]} +${names.length - 2}`
}

/** Stateful tracker for one product. Feed it every processed event (onEvent('*')). */
export function createEffectTracker(product: ProductSlug) {
  const recent = new Map<string, Recent>()
  const seen = new Set<string>()
  const byRoot = new Map<string, { targets: ProductSlug[]; body: Bi; focus: string | null; what: Bi }>()

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
      if (!root || root.id === e.id) return null
      let target: ProductSlug | undefined
      if (root.source === product) target = isProductSlug(e.source) && e.source !== product ? e.source : EFFECT_TARGET[e.type]
      // a background root this product reacted to (e.g. the clock's rumor burst → Radar Isu detects the hoax)
      else if (root.source === 'clock' && e.source === product) target = EFFECT_TARGET[e.type]
      if (!target || target === product) return null
      const k = `${root.id}>${target}`
      if (seen.has(k)) return null
      seen.add(k)
      const row = auditOf(s, e.id)
      let acc = byRoot.get(root.id)
      if (!acc) {
        const name = PRODUCT_BY_SLUG[target].name
        // a headline follow-up names the toast itself ("Klaster aduan …", "Indikasi hoaks …"), else the root does
        const lead = HEADLINE.has(e.type) ? (recent.get(e.id) ?? root) : root
        const leadRow = auditOf(s, lead.id)
        // the title names the receiving products, so a body that lists receivers itself ("… → Meja Pimpinan, …",
        // the cluster audit row) drops that tail: the toast never names a product twice or names this one
        const body = row?.summary ? { id: stripTargets(row.summary.id), en: stripTargets(row.summary.en) } : null
        acc = {
          targets: [], body: body ?? { id: dict('id').openIn(name), en: dict('en').openIn(name) }, focus: refId(row?.entityRefs[0]),
          what: { id: rootLabel(lead, 'id', leadRow?.summary.id ?? null), en: rootLabel(lead, 'en', leadRow?.summary.en ?? null) },
        }
        byRoot.set(root.id, acc)
        if (byRoot.size > SHELL.recentEvents) {
          const first = byRoot.keys().next().value
          if (first !== undefined) byRoot.delete(first)
        }
      }
      acc.targets.push(target)
      // a product whose demo is not built yet is never linked: its toast says the need was recorded for it
      const ready = acc.targets.filter((t) => DEMO_READY[t])
      const pending = acc.targets.filter((t) => !DEMO_READY[t])
      const title = (l: 'id' | 'en'): string => {
        const d = dict(l)
        if (ready.length) return d.forwardedTo(acc.what[l], joinNames(ready.map((t) => PRODUCT_BY_SLUG[t].name)))
        const p0 = PRODUCT_BY_SLUG[pending[0]!]
        return d.recordedFor(acc.what[l], joinNames(pending.map((t) => PRODUCT_BY_SLUG[t].name)), DEMO_STAGE[p0.eco])
      }
      return {
        key: root.id,
        rootId: root.id,
        target: ready[0] ?? null,
        targets: [...acc.targets],
        title: { id: title('id'), en: title('en') },
        body: acc.body,
        focus: acc.focus,
      }
    },
    /** forget everything (world reset) */
    clear() {
      recent.clear()
      seen.clear()
      byRoot.clear()
    },
  }
}
