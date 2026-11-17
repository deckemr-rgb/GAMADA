/**
 * region/wire.ts — the compact on-the-wire form of a RegionPack (packs/<id>/pack.min.json), zod-free.
 *
 * pack.json is the canonical, schema-shaped file (tools, tests and the lab read it). The browser fetches
 * pack.min.json instead: identical content, except that each kecamatan's desa list is packed into three
 * columns, which takes about 3 KB gzip off every demo:
 *   desa: "Name A|Name B|…"            names in order ('|' never occurs in a name; the builder asserts it)
 *   dc:   [dx0, dy0, dx1, dy1, …]      desa centroid in 1e-4° steps relative to the kecamatan centroid (4 decimals)
 *   kel:  [i, …]                       indices of kelurahan (everything else is a desa)
 *   ids:  { "i": "custom-id" }         only for ids that are not `${kecamatanId}-${slug(name)}`
 * expandPack() restores the exact canonical object; tools/region/validate.mjs deep-compares the two.
 * Both directions live here so the builder (via validate) and the loader share one implementation.
 */
import type { RegionPack } from './types'

type Kec = RegionPack['kecamatan'][number]
type Desa = Kec['desa'][number]

export type WireKecamatan = Omit<Kec, 'desa'> & { desa: string; dc?: number[]; kel?: number[]; ids?: Record<string, string> }
export type PackWire = Omit<RegionPack, 'kecamatan'> & { wire: 1; kecamatan: WireKecamatan[] }

/** Same slug as tools/region/build-*.mjs. */
export const slug = (s: string): string =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const step = (v: number): number => Math.round(v * 1e4)

export function isPackWire(v: unknown): v is PackWire {
  return typeof v === 'object' && v !== null && (v as { wire?: unknown }).wire === 1
}

/** Canonical → wire. Throws when the pack cannot round-trip (a desa without centroid, a '|' in a name). */
export function compactPack(pack: RegionPack): PackWire {
  const kecamatan = pack.kecamatan.map((k): WireKecamatan => {
    const { desa, ...rest } = k
    const out: WireKecamatan = { ...rest, desa: desa.map((d) => d.name).join('|') }
    const ref = [step(k.centroid[0]), step(k.centroid[1])] as const
    if (desa.length) {
      out.dc = desa.flatMap((d) => {
        if (!d.centroid) throw new Error(`wire: desa ${d.id} has no centroid`)
        if (d.name.includes('|')) throw new Error(`wire: desa name "${d.name}" contains "|"`)
        return [step(d.centroid[0]) - ref[0], step(d.centroid[1]) - ref[1]]
      })
    }
    const kel = desa.flatMap((d, i) => (d.kind === 'kelurahan' ? [i] : []))
    if (kel.length) out.kel = kel
    const ids: Record<string, string> = {}
    desa.forEach((d, i) => {
      if (d.id !== `${k.id}-${slug(d.name)}`) ids[i] = d.id
    })
    if (Object.keys(ids).length) out.ids = ids
    return out
  })
  return { wire: 1, ...pack, kecamatan }
}

/** Wire → canonical RegionPack. A canonical pack passes through untouched. */
export function expandPack(v: unknown): RegionPack {
  if (!isPackWire(v)) return v as RegionPack
  const { wire: _wire, kecamatan, ...rest } = v
  void _wire
  return {
    ...rest,
    kecamatan: kecamatan.map((k): Kec => {
      const { desa, dc, kel, ids, ...kr } = k
      const names = desa ? desa.split('|') : []
      const kelSet = new Set(kel ?? [])
      const ref = [step(k.centroid[0]), step(k.centroid[1])] as const
      return {
        ...kr,
        desa: names.map((name, i): Desa => {
          const d: Desa = { id: ids?.[i] ?? `${k.id}-${slug(name)}`, name, kind: kelSet.has(i) ? 'kelurahan' : 'desa' }
          if (dc) d.centroid = [(ref[0] + dc[2 * i]!) / 1e4, (ref[1] + dc[2 * i + 1]!) / 1e4]
          return d
        }),
      }
    }),
  }
}
