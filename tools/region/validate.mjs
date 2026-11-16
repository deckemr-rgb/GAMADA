#!/usr/bin/env node
/**
 * validate.mjs — validate every region pack against the zod schemas in src/demo-kit/region/types.ts
 * plus the content rules of spec §7. Exit code 1 on any failure.
 *
 *   npx tsx tools/region/validate.mjs [packId …]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RegionPack, RegionGeo } from '../../src/demo-kit/region/types.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKS = join(HERE, '..', '..', 'src', 'demo-kit', 'region', 'packs')
const LIMITS = { packKB: 150, geoKB: 700 }

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(PACKS).filter((d) => statSync(join(PACKS, d)).isDirectory())

let failed = 0
for (const id of ids) {
  const errors = []
  const warn = []
  const err = (m) => errors.push(m)
  const packPath = join(PACKS, id, 'pack.json')
  const geoPath = join(PACKS, id, 'geo.json')
  const packRaw = readFileSync(packPath, 'utf8')
  const geoRaw = readFileSync(geoPath, 'utf8')

  const p = RegionPack.safeParse(JSON.parse(packRaw))
  const g = RegionGeo.safeParse(JSON.parse(geoRaw))
  if (!p.success) err('pack.json schema: ' + p.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  if (!g.success) err('geo.json schema: ' + g.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))

  if (p.success && g.success) {
    const pack = p.data
    const geo = g.data
    if (pack.id !== id) err(`pack.id "${pack.id}" ≠ folder "${id}"`)
    const kb = (s) => Buffer.byteLength(s) / 1024
    if (kb(packRaw) > LIMITS.packKB) warn.push(`pack.json ${kb(packRaw).toFixed(0)} KB > ${LIMITS.packKB} KB`)
    if (kb(geoRaw) > LIMITS.geoKB) warn.push(`geo.json ${kb(geoRaw).toFixed(0)} KB > ${LIMITS.geoKB} KB`)

    const uniq = (arr, what) => {
      const s = new Set()
      for (const x of arr) {
        if (s.has(x)) err(`duplicate ${what} id "${x}"`)
        s.add(x)
      }
      return s
    }
    const kecIds = uniq(pack.kecamatan.map((k) => k.id), 'kecamatan')
    uniq(pack.kecamatan.flatMap((k) => k.desa.map((d) => d.id)), 'desa')
    const lmIds = uniq(pack.landmarks.map((l) => l.id), 'landmark')
    const mkIds = uniq(pack.markets.map((m) => m.id), 'market')
    const rvIds = uniq(pack.rivers.map((r) => r.id), 'river')
    const opdIds = uniq(pack.opd.map((o) => o.id), 'opd')
    uniq(pack.services.map((s) => s.id), 'service')
    uniq(pack.languages.samples.complaintTemplates.map((t) => t.id), 'complaint template')

    if (id === 'bojonegoro' && pack.kecamatan.length !== 28) err(`Bojonegoro must have 28 kecamatan, has ${pack.kecamatan.length}`)
    const tpl = pack.languages.samples.complaintTemplates
    if (tpl.length < 12) err(`≥ 12 complaint templates required, has ${tpl.length}`)
    if (tpl.filter((t) => t.category === 'banjir').length < 3) err('≥ 3 banjir templates required')
    if (pack.languages.samples.greetings.length < 4) err('≥ 4 greetings required')
    for (const t of tpl) if (!pack.languages.regional.includes(t.lang)) err(`template ${t.id}: lang ${t.lang} not in languages.regional`)
    if (pack.services.length < 14) err(`≥ 14 services required, has ${pack.services.length}`)
    for (const s of pack.services) if (!opdIds.has(s.opdId)) err(`service ${s.id}: unknown opdId ${s.opdId}`)

    const sc = pack.scenario
    if (!rvIds.has(sc.floodRiverId)) err(`scenario.floodRiverId ${sc.floodRiverId} not in rivers`)
    if (sc.damLandmarkId && !lmIds.has(sc.damLandmarkId)) err(`scenario.damLandmarkId ${sc.damLandmarkId} not in landmarks`)
    if (!mkIds.has(sc.shopMarketId)) err(`scenario.shopMarketId ${sc.shopMarketId} not in markets`)
    for (const k of sc.floodKecamatanIds) if (!kecIds.has(k)) err(`scenario.floodKecamatanIds: unknown ${k}`)
    for (const x of [...pack.landmarks, ...pack.markets]) if (x.kecamatanId && !kecIds.has(x.kecamatanId)) err(`${x.id}: unknown kecamatanId ${x.kecamatanId}`)

    const [w, s, e, n] = pack.bbox
    const inBbox = ([x, y]) => x >= w - 0.01 && x <= e + 0.01 && y >= s - 0.01 && y <= n + 0.01
    if (!inBbox(pack.center)) err('center outside bbox')
    for (const k of pack.kecamatan) if (!inBbox(k.centroid)) err(`kecamatan ${k.id} centroid outside bbox`)
    for (const x of [...pack.landmarks, ...pack.markets]) if (!inBbox(x.coord)) err(`${x.id} outside bbox`)

    const sumPop = pack.kecamatan.reduce((a, k) => a + k.population, 0)
    if (Math.abs(sumPop - pack.stats.population) / pack.stats.population > 0.005) err(`Σ kecamatan population ${sumPop} vs stats ${pack.stats.population}`)
    const sumShare = pack.economy.sectors.reduce((a, x) => a + x.share, 0)
    if (Math.abs(sumShare - 100) > 0.5) err(`Σ sector shares = ${sumShare.toFixed(2)}`)
    for (const c of pack.economy.commodities) if (!(c.basePrice > 0)) err(`commodity ${c.id}: basePrice ${c.basePrice}`)

    const geoKec = new Set(geo.kecamatan.features.map((f) => f.properties?.id))
    for (const k of kecIds) if (!geoKec.has(k)) err(`geo.kecamatan has no feature for ${k}`)
    if (geoKec.size !== kecIds.size) err(`geo.kecamatan has ${geoKec.size} features, pack has ${kecIds.size}`)
    const geoRivers = new Set(geo.rivers.features.map((f) => f.properties?.id))
    for (const r of rvIds) if (!geoRivers.has(r)) err(`geo.rivers has no feature for river ${r}`)
    // coordinates: ≤ 5 decimals
    const bad = geoRaw.match(/-?\d+\.\d{6,}/g)
    if (bad) err(`geo.json has ${bad.length} coordinates with > 5 decimals (e.g. ${bad[0]})`)
    // every layer attributed
    const layers = new Set(pack.sources.map((x) => x.layer))
    for (const l of ['kecamatan', 'stats', 'rivers', 'landmarks', 'hazards.flood', 'prices']) if (!layers.has(l)) err(`sources: missing layer "${l}"`)
    for (const f of geo.hazards.flood.features) if (f.properties?.derived && !String(f.properties.note ?? '').includes('bukan peta resmi')) err('derived flood feature must say "bukan peta resmi"')

    console.log(
      `${errors.length ? '✗' : '✓'} ${id}: ${pack.kecamatan.length} kecamatan, ${pack.kecamatan.reduce((a, k) => a + k.desa.length, 0)} desa, ` +
        `${pack.markets.length} markets, ${pack.landmarks.length} landmarks, ${tpl.length} templates, ${pack.services.length} services · ` +
        `pack ${kb(packRaw).toFixed(1)} KB, geo ${kb(geoRaw).toFixed(1)} KB`,
    )
  }
  for (const w of warn) console.log(`  ! ${w}`)
  for (const m of errors) console.log(`  ✗ ${m}`)
  if (errors.length) failed++
}
process.exit(failed ? 1 : 0)
