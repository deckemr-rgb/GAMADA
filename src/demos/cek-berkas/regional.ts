/**
 * Tahap 8 · the specimen gallery in the ACTIVE region. The kit's specimens (docs/samples) are Bojonegoro documents
 * (Provinsi Jawa Timur, Kalitidu / Trucuk / Kanor, NIK 35.22.xx). For another region pack this module rewrites a copy
 * of each specimen: province, kabupaten / kota, kecamatan, desa / kelurahan ("Kepala Desa" → "Lurah" for a kelurahan),
 * NIK + No. KK area codes (Kemendagri codes of the pack), postcode prefix and the house photo's geotag. The people stay
 * the same fictional specimen people. Text runs that change width push the run after them on the same line (the
 * birth date after the birth place, the issue date after the village name) and the field boxes are re-measured, so
 * the OCR boxes still land on the glyphs. Bojonegoro (the specimens' own region) gets the originals back untouched.
 * Pure + cached per pack (one rewrite per document per region).
 */
import { runBox, unionBox } from '../../demo-kit/docs/measure'
import type { Box, Run, SampleDoc, Shape } from '../../demo-kit/docs/types'
import type { Extracted } from '../../demo-kit/ai/types'
import { floodAnchor } from '../../demo-kit/region/anchor'
import type { RegionPack } from '../../demo-kit/region/types'

type Kec = RegionPack['kecamatan'][number]
type Desa = Kec['desa'][number]

export interface Swap {
  /** whole-string replacement map (longest first in `re`) */
  re: RegExp
  map: Map<string, string>
  /** the house photo geotag [lng, lat] */
  lngLat: [number, number] | null
  /** the NIB's "Kecamatan: BOJONEGORO" (the town kecamatan, not the kabupaten) → the market kecamatan's name */
  townKec: string
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
/** postcode prefix per province (Kemendagri province digits); unknown → kept */
const POST: Record<string, string> = { '32': '40', '13': '25', '35': '62' }

/** the shortest real desa / kelurahan name of a kecamatan (fits every card line), skipping `not` */
function pickDesa(k: Kec, not?: string): Desa | undefined {
  return [...k.desa].filter((d) => d.name !== not && !/\bxx\b/i.test(d.name)).sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))[0] ?? k.desa[0]
}

const cache = new WeakMap<RegionPack, Swap | null>()

/** the replacement table for a pack (null for the specimens' own region) */
export function swapFor(pack: RegionPack | null | undefined): Swap | null {
  if (!pack || pack.id === 'bojonegoro') return null
  const hit = cache.get(pack)
  if (hit !== undefined) return hit
  const ks = pack.kecamatan
  const byId = (id: string | undefined) => ks.find((k) => k.id === id)
  const flood = pack.scenario.floodKecamatanIds
  const A = byId(floodAnchor(pack).kecamatanId) ?? ks[0]
  if (!A) {
    cache.set(pack, null)
    return null
  }
  const B = byId(flood.find((id) => id !== A.id)) ?? A
  const C = ks.find((k) => !flood.includes(k.id) && k.id !== A.id && k.id !== B.id) ?? B
  const market = pack.markets.find((m) => m.id === pack.scenario.shopMarketId)
  const D = byId(market?.kecamatanId) ?? A
  const a = pickDesa(A)
  const b = pickDesa(B, a?.name)
  const c = pickDesa(C, b?.name)
  const d = pickDesa(D, a?.name)
  const kota = pack.type === 'kota'
  const S = pack.shortName

  const pairs: [string, string][] = []
  const add = (from: string, to: string) => {
    pairs.push([from, to])
    pairs.push([from.toUpperCase(), to.toUpperCase()])
  }
  const kel = (x: Desa | undefined) => x?.kind === 'kelurahan'
  add('Kabupaten Bojonegoro', `${kota ? 'Kota' : 'Kabupaten'} ${S}`)
  add('Kab. Bojonegoro', `${kota ? 'Kota' : 'Kab.'} ${S}`)
  add('Jawa Timur', pack.province)
  for (const [from, x] of [['Mojosari', a], ['Sranak', b], ['Sedeng', c]] as const) {
    if (!x) continue
    add(`Pemerintah Desa ${from}`, `${kel(x) ? 'Kelurahan' : 'Pemerintah Desa'} ${x.name}`)
    add(`Kepala Desa ${from}`, `${kel(x) ? 'Lurah' : 'Kepala Desa'} ${x.name}`)
    add(`Desa ${from}`, `${kel(x) ? 'Kelurahan' : 'Desa'} ${x.name}`)
    pairs.push([`${from} village`, `${x.name} ${kel(x) ? 'urban village' : 'village'}`])
    add(from, x.name)
  }
  if (d) add('Kel. Ledok Kulon', `${kel(d) ? 'Kel.' : 'Desa'} ${d.name}`)
  if (d) add('Ledok Kulon', d.name)
  add('Kalitidu', A.name)
  add('Trucuk', B.name)
  add('Kanor', C.name)
  add('Bojonegoro', S)
  // a city has no dusun
  if (kota) pairs.push(['DSN. KRAJAN', 'GG. MAWAR NO. 3'])
  // NIK / No. KK area codes: Kalitidu 16 → A, Trucuk 23 → B, Kanor 11 → C, kecamatan Bojonegoro 15 → D
  const code = (k: Kec) => digits(k.kemendagri)
  const nik: [string, Kec][] = [['352216', A], ['352223', B], ['352211', C], ['352215', D]]
  const prov = code(A).slice(0, 2)
  if (POST[prov]) pairs.push(['62152', `${POST[prov]}152`])

  const map = new Map<string, string>()
  for (const [f, t] of pairs) if (!map.has(f)) map.set(f, t)
  const nikRe: string[] = []
  for (const [old, k] of nik) {
    const to = code(k)
    if (to.length === 6) {
      map.set(old, to)
      nikRe.push(old)
    }
  }
  // geotag: the house's desa / kelurahan centroid (else its kecamatan centroid)
  const ll = (b?.centroid ?? B.centroid) as [number, number]
  const lngLat: [number, number] = [Number(ll[0].toFixed(4)), Number(ll[1].toFixed(4))]
  map.set('-7.1342, 111.8716', `${lngLat[1]}, ${lngLat[0]}`)

  const words = [...map.keys()].filter((k) => !nikRe.includes(k)).sort((x, y) => y.length - x.length)
  // a NIK code only at the start of a 16-digit number; a word only as a whole word
  const re = new RegExp(`(?:\\b(?:${nikRe.join('|') || 'x^'})(?=\\d{10}\\b))|(?:(?<![\\w-])(?:${words.map(esc).join('|')})(?![\\w]))`, 'g')
  const out: Swap = { re, map, lngLat, townKec: D.name.toUpperCase() }
  cache.set(pack, out)
  return out
}

export const swapText = (s: string, w: Swap | null): string => (w ? s.replace(w.re, (m) => w.map.get(m) ?? m) : s)

const docCache = new WeakMap<Swap, Map<string, SampleDoc>>()

/** the specimen as a document of the active region (a cached copy; the original for Bojonegoro) */
export function regionalDoc(doc: SampleDoc, w: Swap | null): SampleDoc
export function regionalDoc(doc: SampleDoc | undefined, w: Swap | null): SampleDoc | undefined
export function regionalDoc(doc: SampleDoc | undefined, w: Swap | null): SampleDoc | undefined {
  if (!doc || !w) return doc
  let m = docCache.get(w)
  if (!m) docCache.set(w, (m = new Map()))
  const hit = m.get(doc.id)
  if (hit) return hit
  const out = rewrite(doc, w)
  m.set(doc.id, out)
  return out
}

const bi = <T extends { id: string; en: string }>(b: T, w: Swap): T => ({ ...b, id: swapText(b.id, w), en: swapText(b.en, w) })

function rewrite(doc: SampleDoc, w: Swap): SampleDoc {
  const tx = (s: string) => swapText(s, w)
  const runs: Run[] = doc.runs.map((r) => ({ ...r }))
  const shapes: Shape[] = doc.shapes.map((s) => ({ ...s }))
  const overlays: Shape[] = doc.overlays.map((s) => (s.t === 'seal' ? { ...s, top: tx(s.top), center: tx(s.center) } : s))
  const tamper = doc.tamper?.map((t) => ({ ...t, box: { ...t.box }, reason: bi(t.reason, w) }))
  const touched = new Set<string>()
  // left-aligned runs that changed width push what follows them on the same line
  const shifts: { y: number; from: number; dx: number }[] = []
  const town = (key: string | undefined, s: string) => (key === 'kecamatan' && s === 'BOJONEGORO' ? w.townKec : null)
  for (const r of runs) {
    const next = town(r.field, r.text) ?? tx(r.text)
    if (next === r.text) continue
    const before = runBox(r, 0)
    r.text = next
    if (r.field) touched.add(r.field)
    if (!r.anchor || r.anchor === 'start') {
      const dx = runBox(r, 0).w - before.w
      if (Math.abs(dx) > 0.5) shifts.push({ y: r.y, from: before.x + before.w - 10, dx })
    }
  }
  // a patch / tamper box belongs to the line when its middle sits on it (the photo's tall box does not)
  const onLine = (y0: number, y1: number, y: number) => Math.abs((y0 + y1) / 2 - y) < 16
  for (const s of shifts) {
    for (const r of runs) {
      if (Math.abs(r.y - s.y) < 2.5 && r.x > s.from) {
        r.x += s.dx
        if (r.field) touched.add(r.field)
      }
    }
    for (const p of shapes) if (p.t === 'patch' && onLine(p.y, p.y + p.h, s.y) && p.x > s.from) p.x += s.dx
    for (const t of tamper ?? []) if (onLine(t.box.y, t.box.y + t.box.h, s.y) && t.box.x > s.from) t.box.x += s.dx
  }
  const fields = doc.fields.map((f) => {
    const value = town(f.key, f.value) ?? tx(f.value)
    const own = runs.filter((r) => r.field === f.key)
    const box: Box = touched.has(f.key) && own.length ? unionBox(own.map((r) => runBox(r))) : f.box
    return value === f.value && box === f.box ? f : { ...f, value, box }
  })
  const meta = { ...doc.meta } as SampleDoc['meta'] & Record<string, unknown>
  for (const k of ['nik', 'noKk', 'desa'] as const) if (typeof meta[k] === 'string') meta[k] = tx(meta[k] as string)
  if (meta.kind === 'kk' && meta.members) meta.members = meta.members.map((x) => ({ ...x, nik: tx(x.nik) }))
  if (meta.kind === 'house' && w.lngLat) meta.lngLat = w.lngLat
  return {
    ...doc,
    title: bi(doc.title, w),
    caption: bi(doc.caption, w),
    runs,
    shapes,
    overlays,
    fields,
    ...(tamper ? { tamper } : {}),
    meta,
  }
}

/** the check notes name places too ("Sranak, Kec. Trucuk"): same swap */
export function regionalExtract(x: Extracted, w: Swap | null): Extracted {
  if (!w || !x.checks?.length) return x
  return { ...x, checks: x.checks.map((c) => ({ ...c, label: bi(c.label, w), ...(c.note !== undefined ? { note: swapText(c.note, w) } : {}) })) }
}
