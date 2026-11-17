#!/usr/bin/env node
/**
 * validate.mjs — validate every region pack against the zod schemas in src/demo-kit/region/types.ts
 * plus the content rules of spec §7. Exit code 1 on any failure. This is the BUILD-TIME check: the browser
 * loader skips zod in production (dev still parses), so a pack that passes here is trusted at runtime.
 *
 * Files per pack: pack.json (canonical), pack.min.json (wire form, must expand to exactly pack.json),
 * geo.json (no desa) and desa.json (desa FeatureCollection), plus their compact twins geo.min.json / desa.min.json
 * (what the browser fetches; must decode to exactly the canonical files, region/topo.ts). Shipping budgets
 * (gzip -9, of the files the browser fetches) are errors.
 *
 *   npx tsx tools/region/validate.mjs [packId …]
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { gzipSync } from 'node:zlib'
import { RegionPack, RegionGeo } from '../../src/demo-kit/region/types.ts'
import { expandPack } from '../../src/demo-kit/region/wire.ts'
import { decodeTopo } from '../../src/demo-kit/region/topo.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKS = join(HERE, '..', '..', 'src', 'demo-kit', 'region', 'packs')
/** gzip -9 budgets of what the browser fetches (spec §14: ≤ 180 KB gzip per demo excluding MapLibre, JS AND data;
 *  owner 2026-11-17). Map demo kit floor target ≤ 130 KB, so geometry has to stay small. */
const GZ_BUDGET_KB = { 'pack.min.json': 16.5, 'geo.min.json': 16, 'desa.min.json': 24 }

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(PACKS).filter((d) => statSync(join(PACKS, d)).isDirectory())

let failed = 0
for (const id of ids) {
  const errors = []
  const warn = []
  const err = (m) => errors.push(m)
  const rd = (f) => readFileSync(join(PACKS, id, f), 'utf8')
  const packRaw = rd('pack.json')
  const geoRaw = rd('geo.json')
  const hasDesa = existsSync(join(PACKS, id, 'desa.json'))
  const desaRaw = hasDesa ? rd('desa.json') : null
  const minRaw = existsSync(join(PACKS, id, 'pack.min.json')) ? rd('pack.min.json') : null
  if (!minRaw) err('pack.min.json missing (the browser loads it; rebuild with tools/region/build-*.mjs)')
  const geoMinRaw = existsSync(join(PACKS, id, 'geo.min.json')) ? rd('geo.min.json') : null
  const desaMinRaw = hasDesa && existsSync(join(PACKS, id, 'desa.min.json')) ? rd('desa.min.json') : null
  if (!geoMinRaw) err('geo.min.json missing (the browser loads it; run node tools/region/encode-geo.mjs)')
  if (hasDesa && !desaMinRaw) err('desa.min.json missing (the browser loads it; run node tools/region/encode-geo.mjs)')
  if (geoMinRaw && !isDeepStrictEqual(decodeTopo(JSON.parse(geoMinRaw)), JSON.parse(geoRaw))) err('geo.min.json does not decode to geo.json (stale? run node tools/region/encode-geo.mjs)')
  if (desaMinRaw && !isDeepStrictEqual(decodeTopo(JSON.parse(desaMinRaw)), JSON.parse(desaRaw))) err('desa.min.json does not decode to desa.json (stale? run node tools/region/encode-geo.mjs)')
  if (JSON.parse(geoRaw).desa) err('geo.json must not contain desa (it lives in desa.json)')

  const packJson = JSON.parse(packRaw)
  if (minRaw && !isDeepStrictEqual(expandPack(JSON.parse(minRaw)), packJson)) err('pack.min.json does not expand to pack.json (wire round trip)')
  const p = RegionPack.safeParse(packJson)
  const g = RegionGeo.safeParse({ ...JSON.parse(geoRaw), ...(desaRaw ? { desa: JSON.parse(desaRaw) } : {}) })
  if (!p.success) err('pack.json schema: ' + p.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  if (!g.success) err('geo.json schema: ' + g.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))

  if (p.success && g.success) {
    const pack = p.data
    const geo = g.data
    if (pack.id !== id) err(`pack.id "${pack.id}" ≠ folder "${id}"`)
    const kb = (s) => Buffer.byteLength(s) / 1024
    const gz = (s) => gzipSync(s, { level: 9 }).length / 1024
    const sizes = []
    for (const [f, raw] of [['pack.min.json', minRaw], ['geo.min.json', geoMinRaw], ['desa.min.json', desaMinRaw]]) {
      if (!raw) continue
      sizes.push(`${f} ${kb(raw).toFixed(1)} KB / ${gz(raw).toFixed(1)} KB gz`)
      if (gz(raw) > GZ_BUDGET_KB[f]) err(`${f} ${gz(raw).toFixed(1)} KB gzip > budget ${GZ_BUDGET_KB[f]} KB`)
    }

    const uniq = (arr, what) => {
      const s = new Set()
      for (const x of arr) {
        if (s.has(x)) err(`duplicate ${what} id "${x}"`)
        s.add(x)
      }
      return s
    }
    const kecIds = uniq(pack.kecamatan.map((k) => k.id), 'kecamatan')
    // Kemendagri codes (NIK digits): optional, but when present all kecamatan have one, unique, inside the kabupaten code
    const kmd = pack.kecamatan.map((k) => k.kemendagri).filter(Boolean)
    if (kmd.length && kmd.length !== pack.kecamatan.length) err(`kemendagri code on ${kmd.length}/${pack.kecamatan.length} kecamatan`)
    uniq(kmd, 'kemendagri code')
    if (kmd.length && new Set(kmd.map((c) => c.slice(0, 5))).size !== 1) err(`kemendagri codes span several kabupaten: ${[...new Set(kmd.map((c) => c.slice(0, 5)))]}`)
    if (id === 'bojonegoro') for (const [k, c] of [['kalitidu', '35.22.16'], ['bojonegoro', '35.22.15'], ['trucuk', '35.22.23'], ['kasiman', '35.22.20']]) {
      const got = pack.kecamatan.find((x) => x.id === k)?.kemendagri
      if (got !== c) err(`kemendagri ${k}: ${got} ≠ ${c}`)
    }
    // markets: no two within 150 m (one market mapped twice), no ALL-CAPS names
    for (let i = 0; i < pack.markets.length; i++) for (let j = i + 1; j < pack.markets.length; j++) {
      const a = pack.markets[i].coord, b = pack.markets[j].coord
      const m = Math.hypot((a[0] - b[0]) * 110540 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110574)
      if (m < 150) err(`markets ${pack.markets[i].id} / ${pack.markets[j].id} only ${m.toFixed(0)} m apart`)
    }
    for (const x of pack.markets) if (!/[a-z]/.test(x.name)) err(`market name in all caps: ${x.name}`)
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

    if (hasDesa) {
      const desaIds = new Set(pack.kecamatan.flatMap((k) => k.desa.map((d) => d.id)))
      const geoDesa = new Set((geo.desa?.features ?? []).map((f) => f.properties?.id))
      for (const d of desaIds) if (!geoDesa.has(d)) err(`desa.json has no feature for ${d}`)
    }
    const geoKec = new Set(geo.kecamatan.features.map((f) => f.properties?.id))
    for (const k of kecIds) if (!geoKec.has(k)) err(`geo.kecamatan has no feature for ${k}`)
    if (geoKec.size !== kecIds.size) err(`geo.kecamatan has ${geoKec.size} features, pack has ${kecIds.size}`)
    const geoRivers = new Set(geo.rivers.features.map((f) => f.properties?.id))
    for (const r of rvIds) if (!geoRivers.has(r)) err(`geo.rivers has no feature for river ${r}`)
    // shipped geometry: ≤ 4 decimals (≈ 11 m)
    for (const [f, raw] of [['geo.json', geoRaw], ['desa.json', desaRaw]]) {
      const bad = raw?.match(/-?\d+\.\d{5,}/g)
      if (bad) err(`${f} has ${bad.length} coordinates with > 4 decimals (e.g. ${bad[0]})`)
    }
    // licence wording must quote the actual BPS notice, not "free use"
    for (const x of pack.sources) if (/BPS/.test(x.license) && /bebas dipakai/i.test(x.license)) err(`sources.${x.layer}: BPS licence misquoted ("bebas dipakai")`)
    // every layer attributed
    const layers = new Set(pack.sources.map((x) => x.layer))
    for (const l of ['kecamatan', 'stats', 'rivers', 'landmarks', 'hazards.flood', 'prices']) if (!layers.has(l)) err(`sources: missing layer "${l}"`)
    for (const f of geo.hazards.flood.features) if (f.properties?.derived && !String(f.properties.note ?? '').includes('bukan peta resmi')) err('derived flood feature must say "bukan peta resmi"')

    console.log(
      `${errors.length ? '✗' : '✓'} ${id}: ${pack.kecamatan.length} kecamatan, ${pack.kecamatan.reduce((a, k) => a + k.desa.length, 0)} desa, ` +
        `${pack.markets.length} markets, ${pack.landmarks.length} landmarks, ${tpl.length} templates, ${pack.services.length} services · ` +
        `pack.json ${kb(packRaw).toFixed(1)} KB · ${sizes.join(' · ')}`,
    )
  }
  for (const w of warn) console.log(`  ! ${w}`)
  for (const m of errors) console.log(`  ✗ ${m}`)
  if (errors.length) failed++
}
process.exit(failed ? 1 : 0)
