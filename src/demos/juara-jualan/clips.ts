/**
 * demos/juara-jualan/clips.ts — the transcript model. The kit owns the clip KEYS (`CALL_CLIPS`); this product owns the
 * TEXT: per key a list of lines `[speaker, id, en, tags?, fixId?, fixEn?]`. Tags are `<criterion>+` (done well) or
 * `<criterion>-` (missed); a missed line carries its own "Seharusnya" fix, so no suggestion repeats across clips.
 * Slots ({agent} {org} {Hon} {hon} {cust} {item} {price} {unit} {item2} {price2} {unit2} {poCode} {eta} {desa}) are
 * filled from the world, never typed. Toko Bangunan texts ship with the page; multifinance / asuransi load on intent.
 */
import { useEffect, useState } from 'react'
import { peaksForClip, timeline, type ClipSegment } from '../../demo-kit/media'
import { DAY_MIN, fmtRp, hashString, hhmm, type Bi, type Call, type Criteria, type CriterionKey, type Industry, type WorldState } from '../../demo-kit/world'
import { CALL_CRITERIA, CALL_FLAG, CRITERIA_KEYS, FLAG_OF, clipOf } from '../../demo-kit/world/usaha-pintar'
import { TB } from './clips-tb'
import { clockText, customerParts } from './strings'

export type Line = readonly [sp: 'a' | 'c', id: string, en: string, tags?: string, fixId?: string, fixEn?: string]
export interface ClipText {
  /** shop products quoted by the clip: [category, name prefix] → {item}/{price}/{unit}, then {item2}… */
  items?: readonly (readonly [string, string])[]
  lines: readonly Line[]
}
export type ClipLib = Record<string, ClipText>

/* ------------------------------------------------------------------ libraries (tb with the page, mf / asr on intent) */

const libs: Partial<Record<Industry, ClipLib>> = { 'toko-bangunan': TB }
const pending: Partial<Record<Industry, Promise<ClipLib>>> = {}
const subs = new Set<() => void>()
export const loadMf = () => import('./clips-mf')
export const loadAsr = () => import('./clips-asr')

export function loadClips(ind: Industry): Promise<ClipLib> {
  const have = libs[ind]
  if (have) return Promise.resolve(have)
  pending[ind] ??= (ind === 'multifinance' ? loadMf() : loadAsr())
    .then((m) => {
      libs[ind] = m.default
      subs.forEach((f) => f())
      return m.default
    })
    .catch((e: unknown) => {
      delete pending[ind]
      throw e
    })
  return pending[ind]!
}
export const clipLibNow = (ind: Industry): ClipLib | null => libs[ind] ?? null

/** the clip library of an industry (null while its chunk downloads) */
export function useClipLib(ind: Industry): ClipLib | null {
  const [, bump] = useState(0)
  useEffect(() => {
    const f = () => bump((n) => n + 1)
    subs.add(f)
    if (!libs[ind]) void loadClips(ind).catch(() => undefined)
    return () => void subs.delete(f)
  }, [ind])
  return libs[ind] ?? null
}

/* ------------------------------------------------------------------ slots */

type Slots = Record<string, Bi>
const same = (v: string): Bi => ({ id: v, en: v })

function etaText(eta: number | null | undefined): Bi | null {
  if (eta == null) return null
  const t = hhmm(eta)
  return eta >= DAY_MIN ? { id: `besok pukul ${clockText(t, 'id')}`, en: `tomorrow at ${t}` } : { id: `hari ini pukul ${clockText(t, 'id')}`, en: `today at ${t}` }
}

function slotsFor(s: WorldState, call: Call, text: ClipText): Slots {
  const agent = s.agentsSales.byId[call.agentId]
  const org = (agent?.org ?? '').split(' · ')[0] ?? ''
  const ci = customerParts(call.customer, 'id')
  const ce = customerParts(call.customer, 'en')
  const out: Slots = {
    agent: same((agent?.name ?? '').split(' ')[0] ?? ''),
    org: same(org),
    cust: same(ci.name),
    Hon: { id: ci.female ? 'Ibu' : 'Bapak', en: ce.female ? 'Ms' : 'Mr' },
    hon: { id: ci.female ? 'Bu' : 'Pak', en: ce.female ? "ma'am" : 'sir' },
  }
  const shop = s.meta.shopId
  const prods: { name: string; price: number; unit: string }[] = []
  const po = call.refId ? s.purchaseOrders.byId[call.refId] : undefined
  if (po) {
    const list = po.items.map((i) => s.products.byId[i.productId]).filter((p) => !!p)
    list.sort((a, b) => Number(b!.tags.includes('flood')) - Number(a!.tags.includes('flood')))
    for (const p of list.slice(0, 2)) prods.push({ name: p!.name, price: p!.price, unit: p!.unit })
    out.poCode = same(po.code)
    out.eta = etaText(po.reply?.eta) ?? { id: 'menunggu balasan pemasok', en: 'waiting for the supplier reply' }
    const desa = /Desa (.+)$/.exec(call.customer)?.[1] ?? ''
    out.desa = same(desa)
  } else if (text.items?.length) {
    const own = s.products.ids.map((x) => s.products.byId[x]!).filter((p) => p.businessId === shop)
    for (const [cat, pre] of text.items) {
      const inCat = own.filter((p) => p.category === cat)
      const p = inCat.find((x) => x.name.toLowerCase().startsWith(pre.toLowerCase())) ?? inCat[0]
      if (p) prods.push({ name: p.name, price: p.price, unit: p.unit })
    }
  }
  prods.forEach((p, i) => {
    const n = i ? String(i + 1) : ''
    out[`item${n}`] = same(p.name)
    out[`price${n}`] = same(fmtRp(p.price))
    out[`unit${n}`] = { id: p.unit, en: p.unit }
  })
  return out
}

const fill = (txt: string, slots: Slots, lang: 'id' | 'en'): string => txt.replace(/\{(\w+)\}/g, (m, k: string) => slots[k]?.[lang] ?? m)

/* ------------------------------------------------------------------ built clip */

export interface Tag { k: CriterionKey; ok: boolean }
export interface BuiltLine { sp: 'a' | 'c'; tags: Tag[]; fix: Bi | null }
export interface Moment { id: string; k: CriterionKey; t: number; line: number; tone: 'ok' | 'warn' | 'danger'; label: Bi }
export interface BuiltClip {
  key: string
  weak: CriterionKey
  segments: ClipSegment[]
  lines: BuiltLine[]
  /** one per criterion that has a tagged line, in time order */
  moments: Moment[]
  /** line index quoted as evidence per criterion (null: the clip never touches it) */
  evidence: Record<CriterionKey, number | null>
  duration: number
  peaks: number[]
}

const parseTags = (t?: string): Tag[] =>
  (t ?? '')
    .split(' ')
    .filter(Boolean)
    .map((x) => ({ k: x.slice(0, -1) as CriterionKey, ok: x.endsWith('+') }))

/** the transcript of a call with its slots filled, timeline, moments and evidence lines (null: clip text missing) */
export function buildClip(s: WorldState, call: Call, lib: ClipLib): BuiltClip | null {
  const text = lib[call.transcript]
  const def = clipOf(call.transcript)
  if (!text || !def) return null
  const slots = slotsFor(s, call, text)
  const raw = text.lines.map((l) => ({ speaker: l[0] === 'a' ? 'agent' : 'customer', text: fill(l[1], slots, 'id'), en: fill(l[2], slots, 'en') }))
  const segments = timeline(raw, { wps: 2.9, gap: 0.5 })
  const lines: BuiltLine[] = text.lines.map((l) => ({ sp: l[0], tags: parseTags(l[3]), fix: l[4] ? { id: fill(l[4], slots, 'id'), en: fill(l[5] ?? l[4], slots, 'en') } : null }))
  const evidence = {} as Record<CriterionKey, number | null>
  const byLine = new Map<number, Moment>()
  const rank = { ok: 0, warn: 1, danger: 2 } as const
  for (const k of CRITERIA_KEYS) {
    const miss = lines.findIndex((l) => l.tags.some((g) => g.k === k && !g.ok))
    const any = lines.findIndex((l) => l.tags.some((g) => g.k === k))
    const i = miss >= 0 ? miss : any
    evidence[k] = i >= 0 ? i : null
    if (i < 0) continue
    const tone = miss < 0 ? 'ok' : k === def.weak ? 'danger' : 'warn'
    const label = tone === 'danger' ? (CALL_FLAG[FLAG_OF[k]] ?? CALL_CRITERIA[k]) : CALL_CRITERIA[k]
    // one marker per line (two criteria on one line would stack two buttons on the same spot)
    const have = byLine.get(i)
    if (!have) byLine.set(i, { id: k, k, t: segments[i]!.start, line: i, tone, label })
    else {
      const worse = rank[tone] > rank[have.tone]
      const lb = worse ? { id: `${label.id} · ${have.label.id}`, en: `${label.en} · ${have.label.en}` } : { id: `${have.label.id} · ${label.id}`, en: `${have.label.en} · ${label.en}` }
      byLine.set(i, worse ? { ...have, id: k, k, tone, label: lb } : { ...have, label: lb })
    }
  }
  const moments = [...byLine.values()].sort((a, b) => a.t - b.t)
  const duration = segments[segments.length - 1]?.end ?? 0
  return { key: call.transcript, weak: def.weak, segments, lines, moments, evidence, duration, peaks: peaksForClip(segments, 96, hashString(call.transcript) % 997) }
}

/** "Nilai sekarang": criteria from the clip's ok / miss tags (small per-call variation), weak criterion lowest */
export function criteriaFromTags(clip: BuiltClip, callId: string): Criteria {
  const c = {} as Criteria
  for (const k of CRITERIA_KEYS) {
    let ok = 0
    let miss = 0
    for (const l of clip.lines) for (const g of l.tags) if (g.k === k) (g.ok ? ok++ : miss++)
    const base = !ok && !miss ? 70 : !miss ? 88 : !ok ? 42 : 64
    const jitter = (hashString(`${callId}|${k}`) % 11) - 5
    c[k] = Math.max(10, Math.min(100, base + jitter))
  }
  let low = Infinity
  for (const k of CRITERIA_KEYS) if (k !== clip.weak) low = Math.min(low, c[k])
  c[clip.weak] = Math.max(10, Math.min(c[clip.weak], low - 8))
  return c
}
/** the flags a set of criteria raises (each criterion below 60) */
export const flagsFor = (c: Criteria): string[] => CRITERIA_KEYS.filter((k) => c[k] < 60).map((k) => FLAG_OF[k])
