#!/usr/bin/env node
/**
 * build-bojonegoro.mjs — turn the raw public data in tools/region/.cache/bojonegoro/ (see fetch-bojonegoro.mjs)
 * plus the hand-written content in tools/region/content/ into
 *   src/demo-kit/region/packs/bojonegoro/pack.json      (RegionPack, canonical: tools, tests, lab)
 *   src/demo-kit/region/packs/bojonegoro/pack.min.json  (same pack, compact desa columns: what the browser fetches)
 *   src/demo-kit/region/packs/bojonegoro/geo.json       (RegionGeo without desa: kecamatan, rivers, roads, hazards)
 *   src/demo-kit/region/packs/bojonegoro/desa.json      (desa/kelurahan FeatureCollection, loaded only when needed)
 *   src/demo-kit/region/packs/bojonegoro/geo.min.json + desa.min.json  (compact shared-arc twins the browser
 *                                                        fetches; tools/region/encode-geo.mjs, region/topo.ts)
 * Deterministic: same cache in → byte-identical files out. Works offline from the cache. At the end it runs
 * tools/region/validate.mjs (schema, content rules, wire round trip, gzip budgets) and fails on any error.
 *
 *   node tools/region/fetch-bojonegoro.mjs && node tools/region/build-bojonegoro.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  simplifyTopology, douglasPeucker, roundLine, roundPt, round, centroid, pointInGeom, areaKm2, distToLine, bboxOf, ringArea, projector, quantizeFC,
} from './lib/geo.mjs'
import { DDA, KECAMATAN as BPS_KEC, TOTALS, PDRB_2025 } from './data/bps-bojonegoro-dda2026.mjs'
import { encodePack } from './encode-geo.mjs'
import { KELURAHAN, OPD, SERVICES, GREETINGS, COMPLAINTS } from './content/bojonegoro.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache', 'bojonegoro')
const OUT = join(HERE, '..', '..', 'src', 'demo-kit', 'region', 'packs', 'bojonegoro')

/* ---------------------------------------------------------------- tunables (one block) */
const CFG = {
  /** Douglas-Peucker tolerance (m) per layer; shared borders use the smaller one */
  tolKecamatan: 40,
  tolDesa: 90,
  tolRiver: 45,
  tolRoad: 60,
  tolHazard: 240,
  /** working precision (simplification, pack centroids/coords) */
  decimals: 5,
  /** shipping precision of geo.json / desa.json (4 decimals ≈ 11 m; applied after topology simplification) */
  geoDecimals: 4,
  /** markets closer than this (m) are one market (OSM often has a node + an area for the same pasar) */
  marketMergeM: 150,
  /** hazard grid cell (degrees, ≈ 440 m) and distance decay (m) from the Bengawan Solo */
  gridDeg: 0.0025,
  floodDecayM: 2200,
  floodHigh: 0.55,
  floodMid: 0.25,
  /** rivers kept when at least this many km run inside the kabupaten */
  riverMinKm: 2,
  /** max schools in the sample (one per kecamatan) */
  schoolSample: 14,
  zoom: 9.4,
  primaryHue: 32,
}

const rd = (f) => JSON.parse(readFileSync(join(CACHE, f), 'utf8'))
for (const f of ['hdx-adm3.geojson', 'hdx-adm4.geojson', 'osm-rivers.json', 'osm-roads.json', 'osm-pois.json', 'osm-named.json', 'prices.json', 'wiki-bojonegoro.txt']) {
  if (!existsSync(join(CACHE, f))) throw new Error(`missing ${f} — run: node tools/region/fetch-bojonegoro.mjs`)
}
const log = (...a) => console.log('[build]', ...a)
const slug = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* ---------------------------------------------------------------- 1. admin boundaries (HDX COD-AB) */
const adm3 = rd('hdx-adm3.geojson')
const adm4 = rd('hdx-adm4.geojson')
/** HDX spelling → BPS (Dalam Angka) spelling */
const KEC_ALIAS = { 'Kepoh Baru': 'Kepohbaru', Sumberejo: 'Sumberrejo' }
const kecName = (n) => KEC_ALIAS[n] ?? n
const kecFeats = adm3.features.filter((f) => f.properties.adm3_name !== 'Perairan')
const waterFeat = adm3.features.find((f) => f.properties.adm3_name === 'Perairan')
if (kecFeats.length !== 28) throw new Error(`expected 28 kecamatan, got ${kecFeats.length}`)
const bpsNames = new Set(BPS_KEC.map((r) => r[0]))
for (const f of kecFeats) if (!bpsNames.has(kecName(f.properties.adm3_name))) throw new Error(`unknown kecamatan ${f.properties.adm3_name}`)
log(`kecamatan: 28 ✓ (+ "Perairan" water unit)`)

const desaFeats = adm4.features.filter((f) => f.properties.adm4_name !== 'Perairan')
const realDesa = desaFeats.filter((f) => !f.properties.adm4_pcode.endsWith('999'))
if (realDesa.length !== 430) throw new Error(`expected 430 desa/kelurahan, got ${realDesa.length}`)
log(`desa/kelurahan: ${realDesa.length} ✓ (+ ${desaFeats.length - realDesa.length} forest units "Hutan")`)

const lat0 = -7.2
const allKecGeoms = kecFeats.map((f) => f.geometry)
const insideKab = (p) => allKecGeoms.some((g) => pointInGeom(p, g)) || (waterFeat && pointInGeom(p, waterFeat.geometry))
const kecOf = (p) => {
  const i = kecFeats.findIndex((f) => pointInGeom(p, f.geometry))
  return i < 0 ? undefined : slug(kecName(kecFeats[i].properties.adm3_name))
}

/* ---------------------------------------------------------------- 2. cross-check BPS transcription vs Wikipedia */
/** kecamatan name (BPS spelling) → Kemendagri code "35.22.xx", filled from the wiki table below */
const KEMENDAGRI = {}
{
  const wiki = readFileSync(join(CACHE, 'wiki-bojonegoro.txt'), 'utf8')
  // row: | 35.22.xx || [[X, Bojonegoro|X]] ||align="right"| area || pop2010 || pop2020 || pop2025 || seat || villages || post
  const cell = (c) => c.replace(/^[^|]*\|(?!\|)/, '').trim()
  const rows = wiki
    .split('\n')
    .filter((l) => /^\|\s*35\.22\.\d+\s*\|\|/.test(l))
    .map((l) => l.split('||'))
    .map((c) => [c[0].replace(/^\|/, '').trim(), (c[1].match(/\|([^\]]+)\]\]/) ?? [])[1], cell(c[2]), cell(c[5])])
  const W_ALIAS = { Kadewan: 'Kedewan' }
  let checked = 0
  for (const [code, n, area, pop] of rows) {
    const name = W_ALIAS[n] ?? n
    KEMENDAGRI[name] = code
    const b = BPS_KEC.find((r) => r[0] === name || (name === 'Sumberrejo' && r[0] === 'Sumberrejo'))
    if (!b) throw new Error(`wiki row ${n} not in transcription`)
    if (Math.abs(b[1] - Number(area)) > 0.005) throw new Error(`area mismatch ${name}: ${b[1]} vs wiki ${area}`)
    if (Math.abs(b[4] * 1000 - Number(pop.replace(/,/g, ''))) > 5) throw new Error(`population mismatch ${name}: ${b[4]} vs wiki ${pop}`)
    checked++
  }
  if (checked !== 28) throw new Error(`wiki cross-check matched ${checked}/28 rows (table layout changed?)`)
  log('BPS transcription cross-checked against Wikipedia (28/28 rows) ✓')
  // Kemendagri (Dukcapil) codes: the first column of the same table (Permendagri 72/2019). They differ from the
  // BPS codes (Kalitidu = 35.22.16 vs BPS 3522200) and are what NIK / No. KK digits 1-6 use.
  const codes = Object.values(KEMENDAGRI)
  if (codes.length !== 28 || new Set(codes).size !== 28 || !codes.every((c) => /^35\.22\.\d{2}$/.test(c))) throw new Error(`kemendagri codes: expected 28 unique 35.22.xx, got ${codes.join(', ')}`)
  // spot checks against the published list (Kalitidu, Bojonegoro, Trucuk, Kasiman, Malo)
  for (const [n, c] of [['Kalitidu', '35.22.16'], ['Bojonegoro', '35.22.15'], ['Trucuk', '35.22.23'], ['Kasiman', '35.22.20'], ['Malo', '35.22.17']]) {
    if (KEMENDAGRI[n] !== c) throw new Error(`kemendagri spot check ${n}: ${KEMENDAGRI[n]} ≠ ${c}`)
  }
  log('Kemendagri kecamatan codes: 28 unique 35.22.xx ✓')
}

/* ---------------------------------------------------------------- 3. topology-preserving simplification */
const kecInput = [...kecFeats, waterFeat].map((f) => ({ type: 'Feature', properties: f.properties, geometry: f.geometry }))
const desaInput = desaFeats.map((f) => ({ type: 'Feature', properties: f.properties, geometry: f.geometry }))
const topo = simplifyTopology(
  { kec: kecInput, desa: desaInput },
  { tol: { kec: CFG.tolKecamatan, desa: CFG.tolDesa }, lat0, decimals: CFG.decimals, minAreaKm2: 0.02 },
)
log(`topology: ${topo.stats.arcs} arcs, ${topo.stats.junctions} junctions, ${topo.stats.ringsDropped} tiny rings dropped`)

const BPS_BY = Object.fromEntries(BPS_KEC.map((r) => [r[0], r]))
const kecGeoOut = []
const kecPack = []
topo.layers.kec.forEach((f) => {
  const p = f.properties
  if (p.adm3_name === 'Perairan') return
  const name = kecName(p.adm3_name)
  const id = slug(name)
  const c = roundPt(centroid(f.geometry), CFG.decimals)
  kecGeoOut.push({ type: 'Feature', id, properties: { id, name, code: p.adm3_pcode.slice(2) }, geometry: f.geometry })
  kecPack.push({ id, name, code: p.adm3_pcode.slice(2), centroid: c, _geom: kecFeats.find((k) => k.properties.adm3_pcode === p.adm3_pcode).geometry })
})
const waterOut = topo.layers.kec.find((f) => f.properties.adm3_name === 'Perairan')

const desaGeoOut = topo.layers.desa
  .filter((f) => f.geometry.coordinates.length)
  .map((f) => {
    const p = f.properties
    const hutan = p.adm4_pcode.endsWith('999')
    const kecId = slug(kecName(p.adm3_name))
    const id = hutan ? `${kecId}-hutan` : `${kecId}-${slug(p.adm4_name)}`
    return { type: 'Feature', id, properties: { id, name: hutan ? 'Kawasan hutan' : p.adm4_name, kecamatanId: kecId, kind: hutan ? 'hutan' : KELURAHAN.has(p.adm4_name) && p.adm3_name === 'Bojonegoro' ? 'kelurahan' : 'desa' }, geometry: f.geometry }
  })
const desaByKec = {}
for (const f of realDesa) {
  const p = f.properties
  const kecId = slug(kecName(p.adm3_name))
  ;(desaByKec[kecId] ??= []).push({
    id: `${kecId}-${slug(p.adm4_name)}`,
    name: p.adm4_name,
    kind: p.adm3_name === 'Bojonegoro' && KELURAHAN.has(p.adm4_name) ? 'kelurahan' : 'desa',
    centroid: [round(p.center_lon, 4), round(p.center_lat, 4)],
  })
}
for (const list of Object.values(desaByKec)) list.sort((a, b) => a.name.localeCompare(b.name, 'id'))
const kelCount = Object.values(desaByKec).flat().filter((d) => d.kind === 'kelurahan').length
if (kelCount !== 11) throw new Error(`expected 11 kelurahan, got ${kelCount}`)

/* ---------------------------------------------------------------- 4. OSM rivers + reservoirs */
const osmRivers = rd('osm-rivers.json')
const kabBbox = bboxOf(kecFeats.flatMap((f) => (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates.flatMap((p) => p[0]))))
const M = 0.02
const inBox = (p) => p[0] >= kabBbox[0] - M && p[0] <= kabBbox[2] + M && p[1] >= kabBbox[1] - M && p[1] <= kabBbox[3] + M
const lineKm = (pts) => {
  const { kx, ky } = projector(lat0)
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot((pts[i][0] - pts[i - 1][0]) * kx, (pts[i][1] - pts[i - 1][1]) * ky)
  return s / 1000
}
/** split a polyline into runs that stay inside the (padded) kabupaten bbox */
const clipRuns = (pts) => {
  const runs = []
  let cur = []
  for (const p of pts) {
    if (inBox(p)) cur.push(p)
    else if (cur.length) { if (cur.length > 1) runs.push(cur); cur = [] }
  }
  if (cur.length > 1) runs.push(cur)
  return runs
}
const riverName = (n) => {
  if (!n) return null
  if (/kanal/i.test(n)) return null
  if (/bengawan\s*solo/i.test(n)) return 'Bengawan Solo'
  if (/^(selokan|drainase|sungai desa)$/i.test(n)) return null
  return n.replace(/^Sungai /, 'Sungai ').trim()
}
const riverGroups = new Map()
const MINOR = 'Sungai kecil (tanpa nama di OSM)'
const usedWays = new Set()
const riverPieces = []
for (const e of osmRivers.elements) {
  if (e.type !== 'way' || e.tags?.waterway !== 'river' || !e.geometry) continue
  usedWays.add(e.id)
  riverPieces.push({ name: e.tags.name ? riverName(e.tags.name) : MINOR, geometry: e.geometry })
}
// river relations: members that are not already present as tagged ways carry the relation's name
for (const e of osmRivers.elements) {
  if (e.type !== 'relation' || e.tags?.waterway !== 'river' || !e.members) continue
  for (const m of e.members) if (m.type === 'way' && m.geometry && !usedWays.has(m.ref)) riverPieces.push({ name: riverName(e.tags.name), geometry: m.geometry })
}
for (const e of riverPieces) {
  const name = e.name
  if (!name) continue
  const pts = e.geometry.map((g) => [g.lon, g.lat])
  const g = riverGroups.get(name) ?? { name, lines: [], insideKm: 0 }
  for (const run of clipRuns(pts)) g.lines.push(run)
  const ins = pts.map(insideKab)
  for (let i = 1; i < pts.length; i++) if (ins[i] && ins[i - 1]) g.insideKm += lineKm([pts[i - 1], pts[i]])
  riverGroups.set(name, g)
}
const bengawan = riverGroups.get('Bengawan Solo')
if (!bengawan) throw new Error('Bengawan Solo not found in OSM extract')
if (process.env.DEBUG) for (const g of riverGroups.values()) log('  river group', g.name, g.insideKm.toFixed(1), 'km inside')
const minor = riverGroups.get(MINOR)
riverGroups.delete(MINOR)
const rivers = [...riverGroups.values()].filter((g) => g.name === 'Bengawan Solo' || g.insideKm >= CFG.riverMinKm)
rivers.sort((a, b) => (a.name === 'Bengawan Solo' ? -1 : b.name === 'Bengawan Solo' ? 1 : b.insideKm - a.insideKm))
const riverFeatures = [...rivers, ...(minor ? [minor] : [])].map((g) => {
  const isMinor = g === minor
  const id = isMinor ? 'sungai-kecil' : slug(g.name)
  // minor streams: keep only the runs inside the kabupaten, coarser tolerance
  const src = isMinor ? g.lines.flatMap((l) => splitInside(l)) : g.lines
  const lines = src.map((l) => roundLine(douglasPeucker(l, isMinor ? CFG.tolRiver * 2 : CFG.tolRiver, lat0), CFG.decimals)).filter((l) => l.length > 1 && lineKm(l) > 0.3)
  return { type: 'Feature', id, properties: { id, name: g.name, kind: isMinor ? 'stream' : 'river', main: g.name === 'Bengawan Solo' }, geometry: { type: 'MultiLineString', coordinates: lines } }
})
function splitInside(pts) {
  const runs = []
  let cur = []
  for (const p of pts) {
    if (insideKab(p)) cur.push(p)
    else if (cur.length) { if (cur.length > 1) runs.push(cur); cur = [] }
  }
  if (cur.length > 1) runs.push(cur)
  return joinLines(runs)
}
log(`rivers: ${rivers.map((r) => `${r.name} (${r.insideKm.toFixed(0)} km)`).join(', ')}`)

/** assemble closed rings from multipolygon member ways */
function assembleRings(ways) {
  const segs = ways.map((w) => w.slice())
  const rings = []
  const k = (p) => `${p[0]},${p[1]}`
  while (segs.length) {
    let ring = segs.shift()
    let guard = 0
    while (k(ring[0]) !== k(ring[ring.length - 1]) && guard++ < 1000) {
      const end = k(ring[ring.length - 1])
      const i = segs.findIndex((s) => k(s[0]) === end || k(s[s.length - 1]) === end)
      if (i < 0) break
      const s = segs.splice(i, 1)[0]
      ring = ring.concat((k(s[0]) === end ? s : s.slice().reverse()).slice(1))
    }
    if (ring.length >= 4 && k(ring[0]) === k(ring[ring.length - 1])) rings.push(ring)
  }
  return rings
}
const reservoirFeatures = []
for (const e of osmRivers.elements) {
  const t = e.tags ?? {}
  if (!(t.natural === 'water' || t.landuse === 'reservoir') || !t.name) continue
  let outers = []
  if (e.type === 'way' && e.geometry) outers = [e.geometry.map((g) => [g.lon, g.lat])]
  else if (e.type === 'relation') outers = assembleRings(e.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry.map((g) => [g.lon, g.lat])))
  outers = outers.filter((r) => r.length >= 4 && insideKab(centroid({ type: 'Polygon', coordinates: [r] })))
  if (!outers.length) continue
  const polys = outers
    .map((r) => {
      const s = roundLine(douglasPeucker(r, CFG.tolRiver / 2, lat0), CFG.decimals)
      if (s[0][0] !== s[s.length - 1][0] || s[0][1] !== s[s.length - 1][1]) s.push(s[0])
      return s.length >= 4 ? [ringArea(s) > 0 ? s : s.slice().reverse()] : null
    })
    .filter(Boolean)
  if (!polys.length) continue
  const geom = polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys }
  if (areaKm2(geom) < 0.05) continue
  const id = slug(t.name)
  if (reservoirFeatures.some((f) => f.id === id)) continue
  reservoirFeatures.push({ type: 'Feature', id, properties: { id, name: t.name.replace(/^waduk/, 'Waduk'), kind: 'reservoir' }, geometry: geom })
}
log(`reservoirs: ${reservoirFeatures.map((f) => f.properties.name).join(', ')}`)
const waterBodyFeature = waterOut && waterOut.geometry.coordinates.length
  ? [{ type: 'Feature', id: 'bengawan-solo-alur', properties: { id: 'bengawan-solo-alur', name: 'Bengawan Solo (alur sungai)', kind: 'river-area', riverId: 'bengawan-solo' }, geometry: waterOut.geometry }]
  : []

/* ---------------------------------------------------------------- 5. OSM roads */
const osmRoads = rd('osm-roads.json')
const roadGroups = new Map()
for (const e of osmRoads.elements) {
  if (e.type !== 'way' || !e.geometry) continue
  const pts = e.geometry.map((g) => [g.lon, g.lat])
  if (!pts.some(insideKab)) continue
  const cls = e.tags.highway
  const label = e.tags.ref || e.tags.name || ''
  const key = `${cls}|${label}`
  const g = roadGroups.get(key) ?? { cls, name: e.tags.name || null, ref: e.tags.ref || null, lines: [] }
  for (const run of clipRuns(pts)) g.lines.push(run)
  roadGroups.set(key, g)
}
/** join line pieces that share endpoints (fewer, longer lines simplify better) */
function joinLines(lines) {
  const k = (p) => `${p[0]},${p[1]}`
  const rest = lines.map((l) => l.slice())
  const out = []
  while (rest.length) {
    let cur = rest.shift()
    let grew = true
    while (grew) {
      grew = false
      for (let i = 0; i < rest.length; i++) {
        const s = rest[i]
        const a = k(cur[0]), b = k(cur[cur.length - 1]), c = k(s[0]), d = k(s[s.length - 1])
        if (b === c) cur = cur.concat(s.slice(1))
        else if (b === d) cur = cur.concat(s.slice().reverse().slice(1))
        else if (a === d) cur = s.concat(cur.slice(1))
        else if (a === c) cur = s.slice().reverse().concat(cur.slice(1))
        else continue
        rest.splice(i, 1)
        grew = true
        break
      }
    }
    out.push(cur)
  }
  return out
}
const RANK = { trunk: 0, primary: 1, secondary: 2 }
const roadFeatures = [...roadGroups.values()]
  .sort((a, b) => RANK[a.cls] - RANK[b.cls] || String(a.ref ?? a.name).localeCompare(String(b.ref ?? b.name)))
  .map((g, i) => {
    const lines = joinLines(g.lines).map((l) => roundLine(douglasPeucker(l, CFG.tolRoad, lat0), CFG.decimals)).filter((l) => l.length > 1 && lineKm(l) > 0.15)
    const id = `road-${g.cls}-${i}`
    return { type: 'Feature', id, properties: { id, class: g.cls, name: g.name, ref: g.ref }, geometry: { type: 'MultiLineString', coordinates: lines } }
  })
  .filter((f) => f.geometry.coordinates.length)
log(`roads: ${roadFeatures.length} features`)

/* ---------------------------------------------------------------- 6. landmarks + markets (OSM) */
const pois = [...rd('osm-pois.json').elements, ...rd('osm-named.json').elements]
const seen = new Set()
const poiList = []
for (const e of pois) {
  const key = `${e.type}/${e.id}`
  if (seen.has(key)) continue
  seen.add(key)
  const c = e.center ? [e.center.lon, e.center.lat] : e.lat != null ? [e.lon, e.lat] : null
  if (!c || !e.tags?.name) continue
  if (!insideKab(c)) continue
  poiList.push({ tags: e.tags, name: e.tags.name.trim(), coord: roundPt(c, CFG.decimals), osm: key })
}
const distM = (a, b) => Math.hypot((a[0] - b[0]) * projector(lat0).kx, (a[1] - b[1]) * projector(lat0).ky)
/** "SMAN 1 GONDANG" → "SMAN 1 Gondang" (keeps school acronyms) */
const fixCaps = (s) => s.split(' ').map((w) => (/^(SMA|SMK|SMP|SMAN|SMKN|SMPN|SD|SDN|MI|MTs|MA)$/.test(w) || !/^[A-Z]{3,}$/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).join(' ')
const titleCase = (s) => s.replace(/\s+/g, ' ').replace(/(^|\s)([a-z])/g, (_, a, b) => a + b.toUpperCase())
/** "PASAR SUMBERREJO" → "Pasar Sumberrejo" (names typed in all caps in OSM) */
const unCaps = (s) => (/[a-z]/.test(s) ? s : s.toLowerCase())
/** more specific = more words, then longer ("Pasar Tradisional Gayam" over "Pasar Gayam") */
const specificity = (n) => n.split(' ').length * 100 + n.length
const markets = []
const marketNames = new Set()
for (const p of poiList) {
  if (p.tags.amenity !== 'marketplace' || !/^pasar\b/i.test(p.name)) continue
  const name = titleCase(unCaps(p.name.replace(/,.*$/, '').replace(/\s*Kabupaten Bojonegoro$/i, '')))
  if (marketNames.has(name.toLowerCase())) continue
  marketNames.add(name.toLowerCase())
  // one market mapped twice (node + area, or two editors) a few metres apart: keep the more specific name
  const near = markets.find((m) => distM(m.coord, p.coord) < CFG.marketMergeM)
  if (near) {
    const keep = specificity(name) > specificity(near.name) ? { name, coord: p.coord } : null
    log(`  market merge: "${near.name}" + "${name}" (${distM(near.coord, p.coord).toFixed(0)} m) → "${keep?.name ?? near.name}"`)
    if (keep) Object.assign(near, { id: slug(keep.name), name: keep.name, coord: keep.coord, kecamatanId: kecOf(keep.coord) })
    continue
  }
  markets.push({ id: slug(name), name, coord: p.coord, kecamatanId: kecOf(p.coord) })
}
markets.sort((a, b) => a.name.localeCompare(b.name, 'id'))
const landmarks = []
const addLm = (id, name, kind, coord) => {
  if (landmarks.some((l) => l.id === id)) return
  landmarks.push({ id, name, kind, coord, kecamatanId: kecOf(coord) })
}
const findPoi = (re, pred = () => true) => poiList.find((p) => re.test(p.name) && pred(p))
{
  const pemkab = findPoi(/^Gedung Pemkab Bojonegoro$/) ?? findPoi(/^Pemkab Bojonegoro$/)
  if (pemkab) addLm('kantor-pemkab', 'Kantor Pemerintah Kabupaten Bojonegoro', 'kantor', pemkab.coord)
  const rsud = findPoi(/Sosodoro/i)
  if (rsud) addLm('rsud-sosodoro', rsud.name, 'rs', rsud.coord)
  const pacal = findPoi(/^Bendungan Pacal$/)
  if (pacal) addLm('bendungan-pacal', 'Bendungan Pacal', 'bendungan', pacal.coord)
  const gongseng = findPoi(/^Bendungan Gongseng$/)
  if (gongseng) addLm('bendungan-gongseng', 'Bendungan Gongseng', 'bendungan', gongseng.coord)
  for (const p of poiList) {
    if (p.tags.amenity === 'hospital' && /^(RS|RSU|RSUD|Rumah Sakit)\b/i.test(p.name) && !/sosodoro/i.test(p.name))
      if (!landmarks.some((l) => l.kind === 'rs' && distM(l.coord, p.coord) < 200)) addLm(slug(p.name), titleCase(p.name.replace(/^RS\.\s*/, 'RS ')), 'rs', p.coord)
  }
  for (const p of poiList) {
    if (!/^(UPTD )?Puskesmas\b/i.test(p.name) || /pembantu|bekas|^puskesmas$/i.test(p.name)) continue
    addLm(slug(p.name.replace(/^UPTD /, '')), titleCase(p.name.replace(/^UPTD /, '')), 'puskesmas', p.coord)
  }
  for (const p of poiList) {
    if (!(p.tags.amenity === 'townhall' || p.tags.office === 'government')) continue
    const m = p.name.match(/^Kantor (?:Kecamatan|Camat) ([A-Za-z]+)/i)
    if (m) addLm(`kantor-kecamatan-${slug(m[1])}`, `Kantor Kecamatan ${titleCase(m[1].toLowerCase())}`, 'kantor', p.coord)
  }
  const perKec = new Set()
  const schools = poiList
    .filter((p) => p.tags.amenity === 'school' && /^(SMA|SMK|SMP)\s*N(egeri)?\b/i.test(p.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  let n = 0
  for (const p of schools) {
    const k = kecOf(p.coord)
    if (!k || perKec.has(k) || n >= CFG.schoolSample) continue
    perKec.add(k)
    n++
    const name = fixCaps(p.name.replace(/,.*$/, '').replace(/([A-Za-z]{3,})\s+Bojonegoro$/i, '$1').replace(/\s+/g, ' '))
    addLm(slug(name), name, 'sekolah', p.coord)
  }
}
log(`markets: ${markets.length}, landmarks: ${landmarks.length} (${Object.entries(landmarks.reduce((a, l) => ((a[l.kind] = (a[l.kind] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')})`)

/* ---------------------------------------------------------------- 7. derived flood zone (simulation) */
const bengawanLines = bengawan.lines
const altByKec = Object.fromEntries(BPS_KEC.map((r) => [slug(r[0]), { min: r[2], max: r[3] }]))
const lowFactor = (kecId) => {
  const a = altByKec[kecId]
  if (!a) return 0.5
  return a.max <= 50 ? 1 : a.max <= 120 ? 0.7 : a.max <= 300 ? 0.4 : 0.2
}
const distBengawan = (p) => Math.min(...bengawanLines.map((l) => distToLine(p, l, lat0)))
const g = CFG.gridDeg
const W = Math.ceil((kabBbox[2] - kabBbox[0]) / g) + 1
const H = Math.ceil((kabBbox[3] - kabBbox[1]) / g) + 1
const score = new Float32Array(W * H).fill(-1)
const kecScores = {}
const kecMinDist = {}
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const p = [kabBbox[0] + (i + 0.5) * g, kabBbox[1] + (j + 0.5) * g]
    const kid = kecOf(p)
    const inWater = !kid && waterFeat && pointInGeom(p, waterFeat.geometry)
    if (!kid && !inWater) continue
    const d = distBengawan(p)
    const s = Math.exp(-d / CFG.floodDecayM) * (kid ? lowFactor(kid) : 1)
    score[j * W + i] = s
    if (kid) {
      ;(kecScores[kid] ??= []).push(s)
      kecMinDist[kid] = Math.min(kecMinDist[kid] ?? Infinity, d)
    }
  }
}
/** binary grid → polygon rings (cell-edge tracing), then simplified */
function polygonize(pred) {
  const on = (i, j) => i >= 0 && j >= 0 && i < W && j < H && pred(score[j * W + i])
  const edges = new Map() // start "x,y" → [[x2,y2], …]
  const add = (a, b) => {
    const k = `${a[0]},${a[1]}`
    if (!edges.has(k)) edges.set(k, [])
    edges.get(k).push(b)
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!on(i, j)) continue
    // CCW around the cell in (i,j) grid space (y up)
    if (!on(i, j - 1)) add([i, j], [i + 1, j])
    if (!on(i + 1, j)) add([i + 1, j], [i + 1, j + 1])
    if (!on(i, j + 1)) add([i + 1, j + 1], [i, j + 1])
    if (!on(i - 1, j)) add([i, j + 1], [i, j])
  }
  const rings = []
  for (const [startK, list] of edges) {
    while (list.length) {
      const ring = [startK.split(',').map(Number)]
      let next = list.pop()
      let guard = 0
      while (guard++ < 1e6) {
        ring.push(next)
        const k = `${next[0]},${next[1]}`
        if (k === startK) break
        const l = edges.get(k)
        if (!l || !l.length) break
        next = l.pop()
      }
      if (ring.length >= 4) rings.push(ring.map(([x, y]) => [kabBbox[0] + x * g, kabBbox[1] + y * g]))
    }
  }
  const outers = [], holes = []
  for (const r of rings) {
    const s = roundLine(douglasPeucker(r, CFG.tolHazard, lat0), CFG.decimals)
    if (s.length < 4) continue
    if (s[0][0] !== s[s.length - 1][0] || s[0][1] !== s[s.length - 1][1]) s.push(s[0])
    ;(ringArea(s) > 0 ? outers : holes).push(s)
  }
  const polys = outers.map((o) => [o])
  for (const h of holes) {
    const target = polys.find((p) => pointInGeom(h[0], { type: 'Polygon', coordinates: [p[0]] }))
    if (target) target.push(h)
  }
  return { type: 'MultiPolygon', coordinates: polys.filter((p) => areaKm2({ type: 'Polygon', coordinates: [p[0]] }) > 0.3) }
}
const DERIVED_NOTE = 'zona risiko turunan (simulasi), bukan peta resmi BNPB'
const floodFeatures = [
  { level: 'sedang', pred: (s) => s >= CFG.floodMid },
  { level: 'tinggi', pred: (s) => s >= CFG.floodHigh },
].map(({ level, pred }) => ({
  type: 'Feature',
  id: `flood-${level}`,
  properties: { id: `flood-${level}`, level, derived: true, note: DERIVED_NOTE },
  geometry: polygonize(pred),
}))

/* risk per kecamatan from the same derivation */
const riskFlood = {}
for (const k of kecPack) {
  const arr = kecScores[k.id] ?? [0]
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  riskFlood[k.id] = round(Math.min(0.95, 0.05 + mean * 1.1), 2)
}
const riskLandslide = {}
for (const k of kecPack) {
  const a = altByKec[k.id]
  const v = 0.05 + Math.max(0, Math.min(1, (a.max - 50) / 850)) * 0.8
  riskLandslide[k.id] = round(v, 2)
}
const floodKecamatanIds = kecPack
  .filter((k) => (kecMinDist[k.id] ?? Infinity) < 1500)
  .sort((a, b) => riskFlood[b.id] - riskFlood[a.id])
  .slice(0, 4)
  .map((k) => k.id)
log(`flood-prone (derived): ${floodKecamatanIds.join(', ')}`)

/* ---------------------------------------------------------------- 8. prices (Panel Harga Badan Pangan) */
const prices = rd('prices.json')
const COMMODITIES = [
  ['beras-medium', 'Beras medium', 'Medium rice', 'kg', 'Beras Medium'],
  ['cabai-rawit', 'Cabai rawit merah', 'Red bird\'s-eye chilli', 'kg', 'Cabai Rawit Merah'],
  ['cabai-merah', 'Cabai merah keriting', 'Curly red chilli', 'kg', 'Cabai Merah Keriting'],
  ['bawang-merah', 'Bawang merah', 'Shallot', 'kg', 'Bawang Merah'],
  ['bawang-putih', 'Bawang putih bonggol', 'Garlic', 'kg', 'Bawang Putih Bonggol'],
  ['minyak-goreng', 'Minyak goreng kemasan', 'Packaged cooking oil', 'liter', 'Minyak Goreng Kemasan'],
  ['gula-pasir', 'Gula pasir', 'Granulated sugar', 'kg', 'Gula Konsumsi'],
  ['telur-ayam', 'Telur ayam ras', 'Chicken eggs', 'kg', 'Telur Ayam Ras'],
  ['daging-ayam', 'Daging ayam ras', 'Broiler chicken meat', 'kg', 'Daging Ayam Ras'],
]
const priceOf = (rows, name) => {
  const r = (rows ?? []).find((x) => x.name === name)
  if (!r) return null
  const v = r.today || r.yesterday
  return v > 0 ? { v, date: r.today ? 'today' : r.yesterday_date } : null
}
let priceDate = null
const priceLevel = { city: 0, province: 0, missing: 0 }
const commodities = COMMODITIES.map(([id, nid, nen, unit, panel]) => {
  const c = priceOf(prices.city?.data, panel)
  const p = c ?? priceOf(prices.province?.data, panel)
  if (c) priceLevel.city++
  else if (p) priceLevel.province++
  else priceLevel.missing++
  if (p?.date && p.date !== 'today') priceDate = p.date
  return { id, name: { id: nid, en: nen }, unit, basePrice: p ? Math.round(p.v / 50) * 50 : 0 }
})
if (priceLevel.missing) throw new Error(`no price for ${priceLevel.missing} commodities — panel unreachable? use "harga dasar simulasi"`)
log(`prices: ${priceLevel.city} kabupaten-level, ${priceLevel.province} Jawa Timur-level (${priceDate})`)

/* ---------------------------------------------------------------- 9. economy sectors (BPS Tabel 12.3) */
const BIG = PDRB_2025.filter((r) => r[3] >= 3)
const sectors = BIG.map((r) => ({ name: { id: r[1], en: r[2] }, share: r[3] })).sort((a, b) => b.share - a.share)
sectors.push({ name: { id: 'Lainnya', en: 'Other' }, share: round(100 - BIG.reduce((a, r) => a + r[3], 0), 2) })

/* ---------------------------------------------------------------- 10. main sector per kecamatan (editorial) */
const MAIN_SECTOR = {
  gayam: 'Pertambangan migas',
  kedewan: 'Pertambangan minyak (sumur tua)',
  ngasem: 'Pertanian dan migas',
  bojonegoro: 'Perdagangan dan jasa',
  margomulyo: 'Pertanian dan kehutanan',
  ngambon: 'Pertanian dan kehutanan',
  sekar: 'Pertanian dan kehutanan',
  gondang: 'Pertanian dan kehutanan',
  bubulan: 'Pertanian dan kehutanan',
  temayang: 'Pertanian dan kehutanan',
  tambakrejo: 'Pertanian dan kehutanan',
}

/* ---------------------------------------------------------------- 11. assemble */
const allCoords = kecGeoOut.flatMap((f) => (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates.flatMap((p) => p[0])))
const bbox = bboxOf(allCoords).map((v) => round(v, 4))
let cx = 0, cy = 0, ca = 0
for (const k of kecPack) {
  const a = areaKm2(k._geom)
  cx += k.centroid[0] * a
  cy += k.centroid[1] * a
  ca += a
}
const center = [round(cx / ca, 4), round(cy / ca, 4)]

const BPS_URL = DDA.url
/**
 * The publication's own notice (page 3 of the PDF): "Dilarang mereproduksi dan/atau menggandakan sebagian atau
 * seluruh isi buku ini untuk tujuan komersial tanpa izin tertulis dari Badan Pusat Statistik Kabupaten Bojonegoro."
 * GAMADA only cites individual figures (facts) with attribution and reproduces no table or page.
 * OPEN QUESTION for the owner: ask BPS Bojonegoro for written permission, or keep citing single figures only.
 */
const BPS_LICENSE = 'Ketentuan BPS: boleh dikutip dengan menyebut sumber; dilarang mereproduksi/menggandakan untuk tujuan komersial tanpa izin tertulis BPS Kabupaten Bojonegoro'
const BPS_USE = 'Dipakai sebagai kutipan angka individual, bukan reproduksi tabel; izin tertulis BPS menunggu keputusan pemilik.'
const HDX = 'https://data.humdata.org/dataset/cod-ab-idn'
const OSM = 'https://www.openstreetmap.org/copyright'
const kecamatan = kecPack
  .map((k) => {
    const b = BPS_BY[k.name]
    return {
      id: k.id,
      name: k.name,
      code: k.code,
      kemendagri: KEMENDAGRI[k.name],
      population: Math.round(b[4] * 1000),
      centroid: k.centroid,
      riskFlood: riskFlood[k.id],
      riskLandslide: riskLandslide[k.id],
      mainSector: MAIN_SECTOR[k.id] ?? 'Pertanian',
      desa: desaByKec[k.id] ?? [],
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'id'))

const pack = {
  id: 'bojonegoro',
  name: 'Kabupaten Bojonegoro',
  shortName: 'Bojonegoro',
  type: 'kabupaten',
  province: 'Jawa Timur',
  slogan: null,
  center,
  zoom: CFG.zoom,
  bbox,
  stats: {
    population: Math.round(TOTALS.population_thousand * 1000),
    households: TOTALS.kk,
    area_km2: TOTALS.area_km2,
    year: DDA.dataYear,
    source: `BPS Kabupaten Bojonegoro, ${DDA.title} (data ${DDA.dataYear}; Tabel 1.1.1, 3.1.1, 3.1.2). Rumah tangga = jumlah pemilik Kartu Keluarga (Disdukcapil).`,
  },
  kecamatan,
  rivers: rivers.map((r) => ({ id: slug(r.name), name: r.name })),
  landmarks,
  markets,
  economy: {
    sectors,
    commodities,
    source: `Sektor: BPS, ${DDA.title} Tabel 12.3 (distribusi PDRB ADHB ${DDA.dataYear}, angka sangat sementara). Harga dasar simulasi, mengacu ke Panel Harga Badan Pangan, tingkat konsumen ${priceDate ?? ''} (Kab. Bojonegoro bila tersedia, selain itu rata-rata Jawa Timur); acuan publik, lisensi menunggu konfirmasi pemilik.`,
  },
  opd: OPD,
  services: SERVICES,
  languages: {
    primary: 'id',
    regional: ['jv'],
    speechCodes: ['jv-ID', 'id-ID'],
    samples: { greetings: GREETINGS, complaintTemplates: COMPLAINTS },
  },
  weather: {},
  branding: { emblem: 'generic', primaryHue: CFG.primaryHue },
  scenario: {
    floodRiverId: 'bengawan-solo',
    damLandmarkId: landmarks.some((l) => l.id === 'bendungan-pacal') ? 'bendungan-pacal' : undefined,
    floodKecamatanIds,
    shopMarketId: markets.find((m) => m.id === 'pasar-kota-bojonegoro')?.id ?? markets.find((m) => m.kecamatanId === 'bojonegoro')?.id ?? markets[0].id,
  },
  sources: [
    { layer: 'kecamatan', name: 'HDX COD-AB Indonesia — batas kecamatan (adm3)', url: HDX, license: 'CC BY-IGO', year: 2020, note: 'BPS / OCHA ROAP; disederhanakan (Douglas-Peucker topologis, 4 desimal) oleh tools/region/build-bojonegoro.mjs. Kode Kemendagri per kecamatan: id.wikipedia.org/wiki/Kabupaten_Bojonegoro (Permendagri 72/2019)' },
    { layer: 'desa', name: 'HDX COD-AB Indonesia — batas desa/kelurahan (adm4)', url: HDX, license: 'CC BY-IGO', year: 2020, note: '430 desa/kelurahan + kawasan hutan; status kelurahan dari id.wikipedia.org/wiki/Bojonegoro,_Bojonegoro' },
    { layer: 'stats', name: `BPS Kabupaten Bojonegoro — ${DDA.title}`, url: BPS_URL, license: BPS_LICENSE, year: DDA.year, note: `Luas, penduduk per kecamatan (proyeksi 2025), pemilik KK, ketinggian wilayah, distribusi PDRB. ${BPS_USE}` },
    { layer: 'economy', name: 'BPS — distribusi PDRB ADHB menurut lapangan usaha 2025', url: BPS_URL, license: BPS_LICENSE, year: DDA.dataYear, note: `angka sangat sementara. ${BPS_USE}` },
    { layer: 'prices', name: 'Harga dasar simulasi — acuan publik: Panel Harga Pangan, Badan Pangan Nasional', url: 'https://panelharga.badanpangan.go.id/', license: 'Acuan publik, lisensi menunggu konfirmasi pemilik', year: 2026, note: `harga dasar simulasi untuk demo, bukan harga resmi; acuan harga konsumen ${priceDate}; ${priceLevel.city} komoditas tingkat kabupaten, ${priceLevel.province} rata-rata Jawa Timur; dibulatkan ke Rp 50` },
    { layer: 'rivers', name: 'OpenStreetMap — sungai & waduk', url: OSM, license: 'ODbL 1.0 · © OpenStreetMap contributors', year: 2026 },
    { layer: 'roads', name: 'OpenStreetMap — jalan trunk/primary/secondary', url: OSM, license: 'ODbL 1.0 · © OpenStreetMap contributors', year: 2026 },
    { layer: 'landmarks', name: 'OpenStreetMap — pasar, kantor, RS, puskesmas, sekolah, bendungan', url: OSM, license: 'ODbL 1.0 · © OpenStreetMap contributors', year: 2026, note: 'sampel sekolah: satu SMP/SMA/SMK negeri per kecamatan' },
    { layer: 'hazards.flood', name: 'Zona risiko banjir turunan', url: 'tools/region/build-bojonegoro.mjs', license: 'Turunan dari HDX (CC BY-IGO), OSM (ODbL), BPS', year: 2026, note: `${DERIVED_NOTE}. Jarak ke Bengawan Solo × faktor dataran rendah (ketinggian BPS Tabel 1.1.2); riskFlood/riskLandslide per kecamatan dari derivasi yang sama` },
    { layer: 'mainSector', name: 'Sektor utama per kecamatan', url: 'tools/region/build-bojonegoro.mjs', license: 'Konten editorial GAMADA', note: 'ringkasan editorial, bukan data BPS per kecamatan' },
    { layer: 'opd', name: 'Daftar OPD (nomenklatur umum)', url: 'tools/region/content/bojonegoro.mjs', license: 'Konten editorial GAMADA', note: 'nomenklatur umum perangkat daerah, bukan SOTK resmi Pemkab Bojonegoro' },
    { layer: 'services', name: 'Layanan & persyaratan', url: 'tools/region/content/bojonegoro.mjs', license: 'Konten editorial GAMADA', note: 'ringkasan umum persyaratan nasional; cek ketentuan resmi sebelum dipakai' },
    { layer: 'languages', name: 'Sapaan & template aduan Basa Jawa (Bojonegoroan)', url: 'tools/region/content/bojonegoro.mjs', license: 'Konten editorial GAMADA', note: 'contoh fiktif untuk demo; nama tempat nyata' },
    { layer: 'umkmCount', name: 'TODO: jumlah UMKM belum ditemukan di sumber publik yang terbaca', url: 'https://bojonegorokab.bps.go.id', license: '-', note: 'field economy.umkmCount sengaja dikosongkan' },
  ],
}
if (!pack.scenario.damLandmarkId) delete pack.scenario.damLandmarkId

/* shipping precision: quantised AFTER the topology step, so shared borders stay identical (see quantizeGeom) */
const Q = (features) => quantizeFC({ type: 'FeatureCollection', features }, CFG.geoDecimals)
const geo = {
  kecamatan: Q(kecGeoOut.sort((a, b) => a.id.localeCompare(b.id))),
  rivers: Q([...riverFeatures, ...waterBodyFeature, ...reservoirFeatures]),
  roads: Q(roadFeatures),
  hazards: { flood: Q(floodFeatures) },
}
const desaFC = Q(desaGeoOut.sort((a, b) => a.id.localeCompare(b.id)))

/* compact wire form of the pack: mirrors compactPack() in src/demo-kit/region/wire.ts (the loader's expandPack
   is the inverse); validate.mjs checks expandPack(pack.min.json) deep-equals pack.json */
function compactPack(p) {
  const step = (v) => Math.round(v * 1e4)
  return {
    wire: 1,
    ...p,
    kecamatan: p.kecamatan.map(({ desa, ...k }) => {
      const ref = [step(k.centroid[0]), step(k.centroid[1])]
      for (const d of desa) if (d.name.includes('|') || !d.centroid) throw new Error(`wire: desa ${d.id} cannot be packed`)
      const out = { ...k, desa: desa.map((d) => d.name).join('|') }
      if (desa.length) out.dc = desa.flatMap((d) => [step(d.centroid[0]) - ref[0], step(d.centroid[1]) - ref[1]])
      const kel = desa.flatMap((d, i) => (d.kind === 'kelurahan' ? [i] : []))
      if (kel.length) out.kel = kel
      const ids = {}
      desa.forEach((d, i) => { if (d.id !== `${k.id}-${slug(d.name)}`) ids[i] = d.id })
      if (Object.keys(ids).length) out.ids = ids
      return out
    }),
  }
}

mkdirSync(OUT, { recursive: true })
const packStr = JSON.stringify(pack)
const minStr = JSON.stringify(compactPack(pack))
const geoStr = JSON.stringify(geo)
const desaStr = JSON.stringify(desaFC)
writeFileSync(join(OUT, 'pack.json'), packStr + '\n')
writeFileSync(join(OUT, 'pack.min.json'), minStr + '\n')
writeFileSync(join(OUT, 'geo.json'), geoStr + '\n')
writeFileSync(join(OUT, 'desa.json'), desaStr + '\n')
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB'
const part = (o) => kb(JSON.stringify(o))
for (const line of encodePack('bojonegoro')) log(line)
log(`pack.json ${kb(packStr)} · pack.min.json ${kb(minStr)} · geo.json ${kb(geoStr)} (kecamatan ${part(geo.kecamatan)}, rivers ${part(geo.rivers)}, roads ${part(geo.roads)}, flood ${part(geo.hazards)}) · desa.json ${kb(desaStr)}`)

/* build-time validation (schema + content rules + wire round trip + gzip budgets) */
if (!process.env.SKIP_VALIDATE) {
  const v = spawnSync('npx', ['tsx', join(HERE, 'validate.mjs'), 'bojonegoro'], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (v.status !== 0) {
    console.error('[build] validate.mjs failed')
    process.exit(1)
  }
}
