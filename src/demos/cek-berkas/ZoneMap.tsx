/**
 * ZoneMap (lazy, after a finished bulk run) — "validasi silang dengan peta bencana": the real kecamatan boundaries
 * (region geo.min.json, no desa, no MapLibre) as a small SVG, the affected zone from Siaga Wilayah shaded, every
 * applicant as a dot (inside / outside the zone), duplicate-NIK pairs joined, plus a per-kecamatan table.
 * Applicants are fictional; their dots sit at their (fictional) address coordinates in real desa.
 */
import { useEffect, useMemo, useState } from 'react'
import { loadRegionGeo } from '../../demo-kit/region/loader'
import type { RegionGeo } from '../../demo-kit/region/loader'
import { Button, Icon } from '../../demo-kit/ui'
import { useSession, useWorld, type WorldState } from '../../demo-kit/world'
import type { BansosBatch } from '../../demo-kit/world/satu-daerah'
import type { Lang } from '../../lib/i18n'
import type { CekRole } from './model'
import { STR } from './strings'

const W = 560
const PAD = 10
type Ring = number[][]
type Geom = { type: string; coordinates: unknown }

function rings(g: Geom): Ring[] {
  if (g.type === 'Polygon') return g.coordinates as Ring[]
  if (g.type === 'MultiPolygon') return (g.coordinates as Ring[][]).flat()
  return []
}

const seedOf = (s: WorldState) => s.seed

export default function ZoneMap({ batch, lang, kecName, role }: { batch: BansosBatch; lang: Lang; kecName: (id: string) => string; role: CekRole }) {
  const t = STR[lang]
  const { regionId } = useSession()
  const seed = useWorld(seedOf)
  const [geo, setGeo] = useState<RegionGeo | null>(null)
  const [err, setErr] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setErr(false)
    loadRegionGeo(regionId, { desa: false }).then(
      (g) => alive && setGeo(g),
      () => alive && setErr(true),
    )
    return () => {
      alive = false
    }
  }, [regionId, attempt])

  const zone = useMemo(() => new Set(batch.zone), [batch.zone])

  const map = useMemo(() => {
    if (!geo) return null
    const feats = (geo.kecamatan.features as unknown as { properties: { id?: string } | null; geometry: Geom }[]).filter((f) => f.geometry)
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const f of feats) for (const r of rings(f.geometry)) for (const p of r) {
      const [x, y] = p as [number, number]
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    const kx = Math.cos((((y0 + y1) / 2) * Math.PI) / 180)
    const sx = (W - PAD * 2) / ((x1 - x0) * kx)
    const H = Math.round((y1 - y0) * sx + PAD * 2)
    const pr = (x: number, y: number): [number, number] => [PAD + (x - x0) * kx * sx, PAD + (y1 - y) * sx]
    const paths = feats.map((f) => ({
      id: f.properties?.id ?? '',
      d: rings(f.geometry)
        .map((r) => r.map((p, i) => {
          const [a, b] = pr(p[0]!, p[1]!)
          return `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`
        }).join('') + 'Z')
        .join(''),
    }))
    const dots = batch.rows
      .filter((r) => r.citizen)
      .map((r) => {
        const [x, y] = pr(r.citizen!.coord[0], r.citizen!.coord[1])
        return { id: r.doc.id, x, y, out: r.outsideZone, dup: r.duplicateOf.length > 0 }
      })
    const pos = new Map(dots.map((d) => [d.id, d]))
    const pairs = batch.duplicateGroups.flatMap((g) => g.slice(1).map((b) => [pos.get(g[0]!), pos.get(b)] as const)).filter((p): p is readonly [NonNullable<(typeof p)[0]>, NonNullable<(typeof p)[1]>] => !!p[0] && !!p[1])
    return { paths, dots, pairs, H }
  }, [geo, batch])

  const perKec = useMemo(() => {
    const m = new Map<string, { id: string; n: number; out: number }>()
    for (const r of batch.rows) {
      const k = m.get(r.doc.kecamatanId) ?? { id: r.doc.kecamatanId, n: 0, out: 0 }
      k.n++
      if (r.outsideZone) k.out++
      m.set(k.id, k)
    }
    return [...m.values()].sort((a, b) => Number(zone.has(b.id)) - Number(zone.has(a.id)) || b.n - a.n)
  }, [batch, zone])

  const maxN = Math.max(1, ...perKec.map((k) => k.n))
  const inside = batch.rows.filter((r) => !r.outsideZone).length
  const outside = batch.rows.length - inside
  const summary =
    lang === 'id'
      ? `${inside} pendaftar di dalam zona terdampak, ${outside} di luar zona (${perKec.filter((k) => k.out).map((k) => kecName(k.id)).join(', ')}).`
      : `${inside} applicants inside the affected zone, ${outside} outside it (${perKec.filter((k) => k.out).map((k) => kecName(k.id)).join(', ')}).`

  return (
    <section className="dk-cb-cross" aria-label={t.crossTitle}>
      <header>
        <h3>{t.crossTitle}</h3>
        <p>{t.crossLead}</p>
      </header>
      <div className="dk-cb-cross-body">
        <figure className="dk-cb-map">
          {err ? (
            <div className="dk-cb-map-msg">
              <span>{t.crossError}</span>
              <Button size="sm" icon="refresh" onClick={() => setAttempt((a) => a + 1)}>
                {t.retry}
              </Button>
            </div>
          ) : !map ? (
            <div className="dk-cb-map-msg">{t.crossLoading}</div>
          ) : (
            <svg viewBox={`0 0 ${W} ${map.H}`} role="img" aria-label={summary}>
              <g className="dk-cb-kec">
                {map.paths.map((p) => (
                  <path key={p.id} d={p.d} className={zone.has(p.id) ? 'is-zone' : ''} />
                ))}
              </g>
              <g className="dk-cb-pairs">
                {map.pairs.map(([a, b]) => (
                  <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                ))}
              </g>
              <g className="dk-cb-dots">
                {map.dots.map((d) => (
                  <circle key={d.id} cx={d.x} cy={d.y} r={d.dup ? 4.5 : 3.6} className={`${d.out ? 'is-out' : 'is-in'}${d.dup ? ' is-dup' : ''}`} />
                ))}
              </g>
            </svg>
          )}
          <figcaption>
            <span className="dk-cb-leg">
              <i className="is-zone" aria-hidden="true" />
              {t.crossZone}
            </span>
            <span className="dk-cb-leg">
              <i className="is-in" aria-hidden="true" />
              {t.crossIn} <b className="dk-num">{inside}</b>
            </span>
            <span className="dk-cb-leg">
              <i className="is-out" aria-hidden="true" />
              {t.crossOut} <b className="dk-num">{outside}</b>
            </span>
            <span className="dk-cb-src">
              {t.simLabel} · seed {seed} · {t.boundarySrc}
            </span>
          </figcaption>
        </figure>
        <div className="dk-cb-kectab">
          <h4>{t.perKec}</h4>
          <ul>
            {perKec.map((k) => (
              <li key={k.id} className={zone.has(k.id) ? 'is-zone' : 'is-out'}>
                <span className="dk-cb-kn">
                  <Icon name={zone.has(k.id) ? 'water' : 'pin'} size={13} />
                  {kecName(k.id)}
                </span>
                <span className="dk-cb-kb" aria-hidden="true">
                  <i style={{ transform: `scaleX(${k.n / maxN})` }} />
                </span>
                <b className="dk-num">{k.n}</b>
              </li>
            ))}
          </ul>
          <p className="dk-cb-kfoot">{role === 'dinsos' ? (lang === 'id' ? 'Pendaftar luar zona perlu verifikasi lapangan sebelum ditetapkan.' : 'Applicants outside the zone need a field check before approval.') : lang === 'id' ? 'Dinsos menetapkan penerima; loket hanya melihat ringkasan.' : 'Social Affairs approves recipients; the desk sees the summary only.'}</p>
        </div>
      </div>
    </section>
  )
}
