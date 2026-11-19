#!/usr/bin/env node
/**
 * build-bandung.mjs — turn the raw public geography in tools/region/.cache/bandung/ (see fetch-bandung.mjs; override
 * the folder with REGION_CACHE=<dir>), the simulated statistics + base prices in tools/region/data/sim-bandung.mjs and
 * the hand-written content in tools/region/content/bandung.mjs into the six files of
 * src/demo-kit/region/packs/bandung/ (pack, geo, desa + their .min twins; see packs/README.md).
 * Deterministic: same cache in → byte-identical files out. Works offline from the cache. At the end it runs
 * tools/region/validate.mjs bandung (schema, content rules, wire round trip, gzip budgets) and fails on any error.
 * Copied from build-bojonegoro.mjs; the differences are a kota (only kelurahan), the Cikapundung as scenario river,
 * a finer hazard grid (the city is 15 × 10 km) and a derived landslide layer for the northern slopes.
 *
 *   node tools/region/fetch-bandung.mjs && node tools/region/build-bandung.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  simplifyTopology, douglasPeucker, roundLine, roundPt, round, centroid, pointInGeom, areaKm2, distToLine, bboxOf, ringArea, projector, quantizeFC,
} from './lib/geo.mjs'
import { SIM, KECAMATAN as SIM_KEC, TOTALS, SECTORS, PRICES } from './data/sim-bandung.mjs'
import { encodePack } from './encode-geo.mjs'
import { OPD, SERVICES, GREETINGS, COMPLAINTS, MAIN_SECTOR } from './content/bandung.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = process.env.REGION_CACHE ? resolve(process.env.REGION_CACHE) : join(HERE, '.cache', 'bandung')
const ID = 'bandung'
const OUT = join(HERE, '..', '..', 'src', 'demo-kit', 'region', 'packs', ID)

/* ---------------------------------------------------------------- tunables (one block) */
const CFG = {
  /** Douglas-Peucker tolerance (m) per layer; shared borders use the smaller one */
  tolKecamatan: 25,
  tolDesa: 35,
  tolRiver: 30,
  tolRoad: 45,
  tolHazard: 90,
  decimals: 5,
  geoDecimals: 4,
  marketMergeM: 150,
  /** hazard grid cell (degrees, ≈ 165 m) and distance decay (m) from the scenario river */
  gridDeg: 0.0015,
  floodDecayM: 700,
  /** other named rivers add urban runoff (cileuncang) with this weight */
  otherRiverWeight: 0.55,
  floodHigh: 0.55,
  floodMid: 0.28,
  landslideHigh: 0.55,
  landslideMid: 0.33,
  /** rivers kept when at least this many km run inside the kota */
  riverMinKm: 3,
  schoolSample: 14,
  hospitalSample: 8,
  evacuationSample: 3,
  zoom: 11.6,
  primaryHue: 205,
}
const SCENARIO_RIVER = 'Cikapundung'

const rd = (f) => JSON.parse(readFileSync(join(CACHE, f), 'utf8'))
for (const f of ['hdx-adm3.geojson', 'hdx-adm4.geojson', 'osm-rivers.json', 'osm-roads.json', 'osm-pois.json', 'osm-named.json', 'wiki-bandung.txt']) {
  if (!existsSync(join(CACHE, f))) throw new Error(`missing ${f} in ${CACHE} — run: node tools/region/fetch-bandung.mjs`)
}
const log = (...a) => console.log('[build]', ...a)
const slug = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const squash = (s) => s.toLowerCase().replace(/[^a-z]/g, '')

/* ---------------------------------------------------------------- 1. admin boundaries (HDX COD-AB) */
const adm3 = rd('hdx-adm3.geojson')
const adm4 = rd('hdx-adm4.geojson')
/** HDX spelling → the spelling used in data/sim-bandung.mjs */
const KEC_ALIAS = { 'Ujung Berung': 'Ujungberung' }
const kecName = (n) => KEC_ALIAS[n] ?? n
const kecFeats = adm3.features
if (kecFeats.length !== 30) throw new Error(`expected 30 kecamatan, got ${kecFeats.length}`)
const simNames = new Set(SIM_KEC.map((r) => r[0]))
for (const f of kecFeats) if (!simNames.has(kecName(f.properties.adm3_name))) throw new Error(`unknown kecamatan ${f.properties.adm3_name}`)
log('kecamatan: 30 ✓')

const desaFeats = adm4.features
const realDesa = desaFeats.filter((f) => !f.properties.adm4_pcode.endsWith('999'))
log(`kelurahan: ${realDesa.length} (+ ${desaFeats.length - realDesa.length} non-administrative units)`)
if (realDesa.length < 140 || realDesa.length > 160) throw new Error(`expected ≈ 151 kelurahan, got ${realDesa.length}`)

const lat0 = -6.92
const allKecGeoms = kecFeats.map((f) => f.geometry)
const insideKota = (p) => allKecGeoms.some((g) => pointInGeom(p, g))
const kecOf = (p) => {
  const i = kecFeats.findIndex((f) => pointInGeom(p, f.geometry))
  return i < 0 ? undefined : slug(kecName(kecFeats[i].properties.adm3_name))
}

/* ---------------------------------------------------------------- 2. Kemendagri kecamatan codes (Wikipedia table) */
const KEMENDAGRI = {}
{
  const lines = readFileSync(join(CACHE, 'wiki-bandung.txt'), 'utf8').split('\n')
  // row: "|32.73.xx" then "|[[Name, Bandung|Name]]"
  const W_ALIAS = { 'Astana Anyar': 'Astanaanyar', 'Buah Batu': 'Buahbatu', 'Ujung Berung': 'Ujungberung', Babakanciparay: 'Babakan Ciparay' }
  for (let i = 0; i < lines.length - 1; i++) {
    const m = lines[i].match(/^\|\s*(32\.73\.\d{2})\s*$/)
    if (!m) continue
    const n = (lines[i + 1].match(/\|([^\]|]+)\]\]/) ?? [])[1]?.trim()
    const name = W_ALIAS[n] ?? n
    if (!simNames.has(name)) throw new Error(`wiki row ${n} is not a known kecamatan`)
    KEMENDAGRI[name] = m[1]
  }
  const codes = Object.values(KEMENDAGRI)
  if (codes.length !== 30 || new Set(codes).size !== 30 || !codes.every((c) => /^32\.73\.\d{2}$/.test(c))) throw new Error(`kemendagri codes: expected 30 unique 32.73.xx, got ${codes.join(', ')}`)
  for (const [n, c] of [['Sukasari', '32.73.01'], ['Andir', '32.73.05'], ['Sumur Bandung', '32.73.19'], ['Ujungberung', '32.73.26'], ['Astanaanyar', '32.73.10']]) {
    if (KEMENDAGRI[n] !== c) throw new Error(`kemendagri spot check ${n}: ${KEMENDAGRI[n]} ≠ ${c}`)
  }
  log('Kemendagri kecamatan codes: 30 unique 32.73.xx ✓')
}

/* ---------------------------------------------------------------- 3. topology-preserving simplification */
const kecInput = kecFeats.map((f) => ({ type: 'Feature', properties: f.properties, geometry: f.geometry }))
const desaInput = desaFeats.map((f) => ({ type: 'Feature', properties: f.properties, geometry: f.geometry }))
const topo = simplifyTopology(
  { kec: kecInput, desa: desaInput },
  { tol: { kec: CFG.tolKecamatan, desa: CFG.tolDesa }, lat0, decimals: CFG.decimals, minAreaKm2: 0.005 },
)
log(`topology: ${topo.stats.arcs} arcs, ${topo.stats.junctions} junctions, ${topo.stats.ringsDropped} tiny rings dropped`)

const SIM_BY = Object.fromEntries(SIM_KEC.map((r) => [r[0], r]))
const kecGeoOut = []
const kecPack = []
topo.layers.kec.forEach((f) => {
  const p = f.properties
  const name = kecName(p.adm3_name)
  const id = slug(name)
  const c = roundPt(centroid(f.geometry), CFG.decimals)
  kecGeoOut.push({ type: 'Feature', id, properties: { id, name, code: p.adm3_pcode.slice(2) }, geometry: f.geometry })
  kecPack.push({ id, name, code: p.adm3_pcode.slice(2), centroid: c, _geom: kecFeats.find((k) => k.properties.adm3_pcode === p.adm3_pcode).geometry })
})

const desaGeoOut = topo.layers.desa
  .filter((f) => f.geometry.coordinates.length && !f.properties.adm4_pcode.endsWith('999'))
  .map((f) => {
    const p = f.properties
    const kecId = slug(kecName(p.adm3_name))
    const id = `${kecId}-${slug(p.adm4_name)}`
    return { type: 'Feature', id, properties: { id, name: p.adm4_name, kecamatanId: kecId, kind: 'kelurahan' }, geometry: f.geometry }
  })
const desaByKec = {}
for (const f of realDesa) {
  const p = f.properties
  const kecId = slug(kecName(p.adm3_name))
  ;(desaByKec[kecId] ??= []).push({
    id: `${kecId}-${slug(p.adm4_name)}`,
    name: p.adm4_name,
    kind: 'kelurahan',
    centroid: [round(p.center_lon, 4), round(p.center_lat, 4)],
  })
}
for (const list of Object.values(desaByKec)) list.sort((a, b) => a.name.localeCompare(b.name, 'id'))

/* ---------------------------------------------------------------- 4. OSM rivers */
const osmRivers = rd('osm-rivers.json')
const kotaBbox = bboxOf(kecFeats.flatMap((f) => (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates.flatMap((p) => p[0]))))
const M = 0.01
const inBox = (p) => p[0] >= kotaBbox[0] - M && p[0] <= kotaBbox[2] + M && p[1] >= kotaBbox[1] - M && p[1] <= kotaBbox[3] + M
const lineKm = (pts) => {
  const { kx, ky } = projector(lat0)
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot((pts[i][0] - pts[i - 1][0]) * kx, (pts[i][1] - pts[i - 1][1]) * ky)
  return s / 1000
}
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
/** OSM writes Sundanese river names split ("Ci Kapundung"); the city and the news write "Cikapundung".
 *  Names that are descriptions ("Sungai RW 11", "Sungai di gang …") count as unnamed streams. */
const riverName = (n) => {
  if (!n) return null
  let s = n.trim().replace(/^Sungai\s+/i, '')
  s = s.replace(/^Ci ([A-Z])([a-z]+)/, (_, a, b) => `Ci${a.toLowerCase()}${b}`)
  return /^Ci[a-z]+( (Kolot|Hilir|Hulu))?$/.test(s) ? s : null
}
const MINOR = 'Sungai kecil (tanpa nama di OSM)'
const riverGroups = new Map()
const usedWays = new Set()
const riverPieces = []
for (const e of osmRivers.elements) {
  if (e.type !== 'way' || !/^(river|stream)$/.test(e.tags?.waterway ?? '') || !e.geometry) continue
  usedWays.add(e.id)
  const name = riverName(e.tags.name)
  if (!name && e.tags.waterway === 'stream') continue
  riverPieces.push({ name: name ?? MINOR, geometry: e.geometry })
}
for (const e of osmRivers.elements) {
  if (e.type !== 'relation' || e.tags?.waterway !== 'river' || !e.members) continue
  for (const m of e.members) if (m.type === 'way' && m.geometry && !usedWays.has(m.ref)) riverPieces.push({ name: riverName(e.tags.name) ?? MINOR, geometry: m.geometry })
}
for (const e of riverPieces) {
  const pts = e.geometry.map((g) => [g.lon, g.lat])
  const g = riverGroups.get(e.name) ?? { name: e.name, lines: [], insideKm: 0 }
  for (const run of clipRuns(pts)) g.lines.push(run)
  const ins = pts.map(insideKota)
  for (let i = 1; i < pts.length; i++) if (ins[i] && ins[i - 1]) g.insideKm += lineKm([pts[i - 1], pts[i]])
  riverGroups.set(e.name, g)
}
const scenarioRiver = riverGroups.get(SCENARIO_RIVER)
if (!scenarioRiver) throw new Error(`${SCENARIO_RIVER} not found in OSM extract`)
if (process.env.DEBUG) for (const g of riverGroups.values()) log('  river group', g.name, g.insideKm.toFixed(1), 'km inside')
const minor = riverGroups.get(MINOR)
riverGroups.delete(MINOR)
const rivers = [...riverGroups.values()].filter((g) => g.name === SCENARIO_RIVER || g.insideKm >= CFG.riverMinKm)
rivers.sort((a, b) => (a.name === SCENARIO_RIVER ? -1 : b.name === SCENARIO_RIVER ? 1 : b.insideKm - a.insideKm))
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
function splitInside(pts) {
  const runs = []
  let cur = []
  for (const p of pts) {
    if (insideKota(p)) cur.push(p)
    else if (cur.length) { if (cur.length > 1) runs.push(cur); cur = [] }
  }
  if (cur.length > 1) runs.push(cur)
  return runs
}
const riverFeatures = [...rivers, ...(minor ? [minor] : [])].map((g) => {
  const isMinor = g === minor
  const id = isMinor ? 'sungai-kecil' : slug(g.name)
  const src = joinLines(isMinor ? g.lines.flatMap((l) => splitInside(l)) : g.lines)
  const lines = src.map((l) => roundLine(douglasPeucker(l, isMinor ? CFG.tolRiver * 2 : CFG.tolRiver, lat0), CFG.decimals)).filter((l) => l.length > 1 && lineKm(l) > 0.2)
  return { type: 'Feature', id, properties: { id, name: g.name, kind: isMinor ? 'stream' : 'river', main: g.name === SCENARIO_RIVER }, geometry: { type: 'MultiLineString', coordinates: lines } }
})
log(`rivers: ${rivers.map((r) => `${r.name} (${r.insideKm.toFixed(1)} km)`).join(', ')}`)

/* ---------------------------------------------------------------- 5. OSM roads (motorway / trunk / primary / secondary) */
const osmRoads = rd('osm-roads.json')
const roadGroups = new Map()
for (const e of osmRoads.elements) {
  if (e.type !== 'way' || !e.geometry) continue
  const pts = e.geometry.map((g) => [g.lon, g.lat])
  if (!pts.some(insideKota)) continue
  const cls = e.tags.highway
  const label = e.tags.ref || e.tags.name || ''
  const key = `${cls}|${label}`
  const g = roadGroups.get(key) ?? { cls, name: e.tags.name || null, ref: e.tags.ref || null, lines: [] }
  for (const run of splitInside(pts)) g.lines.push(run)
  roadGroups.set(key, g)
}
const RANK = { motorway: 0, trunk: 1, primary: 2, secondary: 3 }
const roadFeatures = [...roadGroups.values()]
  .sort((a, b) => RANK[a.cls] - RANK[b.cls] || String(a.ref ?? a.name).localeCompare(String(b.ref ?? b.name)))
  .map((g, i) => {
    // dual carriageways are two ways a few metres apart: keep them (the map draws thin lines), but simplify hard
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
  if (!c || !insideKota(c)) continue
  poiList.push({ tags: e.tags ?? {}, name: (e.tags?.name ?? '').trim(), coord: roundPt(c, CFG.decimals), osm: key })
}
poiList.sort((a, b) => a.osm.localeCompare(b.osm))
const distM = (a, b) => Math.hypot((a[0] - b[0]) * projector(lat0).kx, (a[1] - b[1]) * projector(lat0).ky)
const fixCaps = (s) => s.split(' ').map((w) => (/^(SMA|SMK|SMP|SMAN|SMKN|SMPN|SD|SDN|MI|MTs|MA)$/.test(w) || !/^[A-Z]{3,}$/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).join(' ')
const titleCase = (s) => s.replace(/\s+/g, ' ').replace(/(^|\s)([a-z])/g, (_, a, b) => a + b.toUpperCase())
const unCaps = (s) => (/[a-z]/.test(s) ? s : s.toLowerCase())
const specificity = (n) => n.split(' ').length * 100 + n.length

/* markets: OSM amenity=marketplace only (bus stops and junctions named "Pasar X" are not markets). Speciality
   markets (books, flowers, second-hand clothes, food courts, trade centres, modern malls) are left out: the demos use
   markets for staple prices. "Cicadas market" (an English name in OSM) is shipped as "Pasar Cicadas". */
const NOT_STAPLE = /trade cent|square|modern|buku|bunga|kembang|makanan|kreatif|cimol|ulekan|car boot|bazaar|business|market$/i
const markets = []
const marketNames = new Set()
for (const p of poiList.slice().sort((a, b) => a.name.localeCompare(b.name) || a.osm.localeCompare(b.osm))) {
  if (p.tags.amenity !== 'marketplace' || !p.name) continue
  let raw = p.name.replace(/,.*$/, '').replace(/\s*(Kota )?Bandung$/i, '')
  const en = raw.match(/^([A-Z][a-z]+) market$/)
  if (en) raw = `Pasar ${en[1]}`
  if (!/^pasar\b/i.test(raw) || NOT_STAPLE.test(raw)) continue
  const name = titleCase(unCaps(raw))
  if (marketNames.has(name.toLowerCase())) continue
  marketNames.add(name.toLowerCase())
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
const kecById = Object.fromEntries(kecPack.map((k) => [k.id, k]))
{
  const balai = findPoi(/^Balai Kota Bandung$/, (p) => p.tags.amenity === 'townhall')
  if (balai) addLm('balai-kota-bandung', 'Balai Kota Bandung', 'kantor', balai.coord)
  // hospitals: the two public ones first, then a sample of named hospitals (one per kecamatan)
  const hs = poiList.filter((p) => p.tags.amenity === 'hospital' && /^(RS|RSU|RSUD|RSUP|RSIA|Rumah Sakit)\b/i.test(p.name))
  const rshs = hs.find((p) => /hasan sadikin/i.test(p.name))
  if (rshs) addLm('rsup-hasan-sadikin', 'RSUP Dr. Hasan Sadikin', 'rs', rshs.coord)
  const kiwari = hs.find((p) => /kiwari/i.test(p.name))
  if (kiwari) addLm('rsud-bandung-kiwari', 'RSUD Bandung Kiwari', 'rs', kiwari.coord)
  const rsKec = new Set(landmarks.filter((l) => l.kind === 'rs').map((l) => l.kecamatanId))
  for (const p of hs.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    if (landmarks.filter((l) => l.kind === 'rs').length >= CFG.hospitalSample) break
    const k = kecOf(p.coord)
    if (!k || rsKec.has(k) || /hasan sadikin|kiwari|gigi|mata|jiwa|bersalin|\bibu\b|rsia/i.test(p.name)) continue
    rsKec.add(k)
    const name = titleCase(p.name.replace(/^RS\.\s*/, 'RS ').replace(/\s+TK\.?\s*II\b/i, ''))
    addLm(slug(name), name, 'rs', p.coord)
  }
  // puskesmas: one per kecamatan
  const pkKec = new Set()
  for (const p of poiList.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    if (!/^(UPTD )?Puskesmas\b/i.test(p.name) || /pembantu|keliling|^puskesmas$/i.test(p.name)) continue
    const k = kecOf(p.coord)
    if (!k || pkKec.has(k)) continue
    pkKec.add(k)
    const name = titleCase(p.name.replace(/^UPTD /, '').replace(/\s+/g, ' '))
    addLm(slug(name), name, 'puskesmas', p.coord)
  }
  // kantor kecamatan: OSM "Kantor Camat X" / "Kantor Kecamatan X" / "Kecamatan X", only when X is the kecamatan the
  // point lies in
  for (const p of poiList) {
    if (!(p.tags.amenity === 'townhall' || p.tags.office === 'government')) continue
    const m = p.name.match(/^(?:Kantor )?(?:Kecamatan|Camat) (.+)$/i)
    const k = kecOf(p.coord)
    if (!m || !k || squash(m[1]) !== squash(kecById[k].name)) continue
    addLm(`kantor-kecamatan-${k}`, `Kantor Kecamatan ${kecById[k].name}`, 'kantor', p.coord)
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
    // "SMAN 12" / "SMA Negeri 1" → "SMA Negeri 12 Bandung" (one spelling; numbered state schools are per city)
    const base = fixCaps(p.name.replace(/,.*$/, '').replace(/\s+(Kota )?Bandung$/i, '').replace(/\s+/g, ' '))
      .replace(/^(SMA|SMK|SMP)\s*N(?:egeri)?\s*(\d+)$/i, (_, a, d) => `${a.toUpperCase()} Negeri ${d}`)
    const name = /\d$/.test(base) ? `${base} Bandung` : base
    addLm(slug(name), name, 'sekolah', p.coord)
  }
}

/* ---------------------------------------------------------------- 7. derived flood + landslide zones (simulation) */
/** approx. max altitude per kecamatan (simulated, rounded to 5 m) */
const altByKec = Object.fromEntries(SIM_KEC.map((r) => [slug(r[0]), r[2]]))
/** the basin floor in the south-east is low, the north sits on the slopes of the volcanic ring */
const lowFactor = (kecId) => {
  const a = altByKec[kecId]
  if (a == null) return 0.5
  return a <= 680 ? 1 : a <= 695 ? 0.8 : a <= 720 ? 0.55 : a <= 780 ? 0.3 : 0.15
}
const scenLines = scenarioRiver.lines
const otherLines = rivers.filter((r) => r !== scenarioRiver).flatMap((r) => r.lines)
const distScen = (p) => Math.min(...scenLines.map((l) => distToLine(p, l, lat0)))
const distOther = (p) => (otherLines.length ? Math.min(...otherLines.map((l) => distToLine(p, l, lat0))) : Infinity)
const g = CFG.gridDeg
const W = Math.ceil((kotaBbox[2] - kotaBbox[0]) / g) + 1
const H = Math.ceil((kotaBbox[3] - kotaBbox[1]) / g) + 1
const floodScore = new Float32Array(W * H).fill(-1)
const slideScore = new Float32Array(W * H).fill(-1)
const kecScores = {}
const kecMinDist = {}
const riskLandslide = {}
for (const k of kecPack) {
  const a = altByKec[k.id]
  riskLandslide[k.id] = round(0.05 + Math.max(0, Math.min(1, (a - 700) / 350)) * 0.8, 2)
}
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const p = [kotaBbox[0] + (i + 0.5) * g, kotaBbox[1] + (j + 0.5) * g]
    const kid = kecOf(p)
    if (!kid) continue
    const d = distScen(p)
    const s = Math.max(Math.exp(-d / CFG.floodDecayM), CFG.otherRiverWeight * Math.exp(-distOther(p) / CFG.floodDecayM)) * lowFactor(kid)
    floodScore[j * W + i] = s
    slideScore[j * W + i] = riskLandslide[kid]
    ;(kecScores[kid] ??= []).push(s)
    kecMinDist[kid] = Math.min(kecMinDist[kid] ?? Infinity, d)
  }
}
function polygonize(score, pred) {
  const on = (i, j) => i >= 0 && j >= 0 && i < W && j < H && pred(score[j * W + i])
  const edges = new Map()
  const add = (a, b) => {
    const k = `${a[0]},${a[1]}`
    if (!edges.has(k)) edges.set(k, [])
    edges.get(k).push(b)
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!on(i, j)) continue
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
      if (ring.length >= 4) rings.push(ring.map(([x, y]) => [kotaBbox[0] + x * g, kotaBbox[1] + y * g]))
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
  return { type: 'MultiPolygon', coordinates: polys.filter((p) => areaKm2({ type: 'Polygon', coordinates: [p[0]] }) > 0.08) }
}
const DERIVED_NOTE = 'zona risiko turunan (simulasi), bukan peta resmi BNPB'
const floodFeatures = [
  { level: 'sedang', pred: (s) => s >= CFG.floodMid },
  { level: 'tinggi', pred: (s) => s >= CFG.floodHigh },
].map(({ level, pred }) => ({
  type: 'Feature',
  id: `flood-${level}`,
  properties: { id: `flood-${level}`, level, derived: true, note: DERIVED_NOTE },
  geometry: polygonize(floodScore, pred),
}))
const landslideFeatures = [
  { level: 'sedang', pred: (s) => s >= CFG.landslideMid },
  { level: 'tinggi', pred: (s) => s >= CFG.landslideHigh },
].map(({ level, pred }) => ({
  type: 'Feature',
  id: `landslide-${level}`,
  properties: { id: `landslide-${level}`, level, derived: true, note: DERIVED_NOTE },
  geometry: polygonize(slideScore, pred),
}))

const riskFlood = {}
for (const k of kecPack) {
  const arr = kecScores[k.id] ?? [0]
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  riskFlood[k.id] = round(Math.min(0.95, 0.05 + mean * 1.1), 2)
}
/** flood kecamatan: the Cikapundung runs through them (≤ 300 m), ranked by the derived risk */
const floodRanked = kecPack
  .filter((k) => (kecMinDist[k.id] ?? Infinity) < 300)
  .sort((a, b) => riskFlood[b.id] - riskFlood[a.id] || a.id.localeCompare(b.id))
log(`flood candidates (derived, along the ${SCENARIO_RIVER}): ${floodRanked.map((k) => `${k.id} ${riskFlood[k.id]}`).join(', ')}`)
const floodKecamatanIds = floodRanked.filter((k) => riskFlood[k.id] >= 0.25).slice(0, 4).map((k) => k.id)
log(`flood-prone (derived): ${floodKecamatanIds.join(', ')}`)
log(`landslide (derived, top): ${Object.entries(riskLandslide).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(', ')}`)

/* evacuation points: OSM emergency=assembly_point (unnamed in OSM) inside the flood kecamatan, named after it */
{
  let n = 0
  for (const kid of floodKecamatanIds) {
    const pts = poiList.filter((p) => p.tags.emergency === 'assembly_point' && kecOf(p.coord) === kid)
    if (!pts.length || n >= CFG.evacuationSample) continue
    n++
    addLm(`titik-kumpul-${kid}`, `Titik Kumpul Evakuasi ${kecById[kid].name}`, 'pengungsian', pts[0].coord)
  }
}
log(`markets: ${markets.length} (${markets.map((m) => m.name).join(', ')})`)
log(`landmarks: ${landmarks.length} (${Object.entries(landmarks.reduce((a, l) => ((a[l.kind] = (a[l.kind] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')})`)

/* shop market: the market inside the first flood kecamatan that has one, else the market nearest to the flood
   kecamatan centroids */
const shopMarket = (() => {
  for (const kid of floodKecamatanIds) {
    const inK = markets.filter((m) => m.kecamatanId === kid)
    if (inK.length) return inK.sort((a, b) => distM(a.coord, kecById[kid].centroid) - distM(b.coord, kecById[kid].centroid))[0]
  }
  const d = (m) => Math.min(...floodKecamatanIds.map((k) => distM(m.coord, kecById[k].centroid)))
  return markets.slice().sort((a, b) => d(a) - d(b))[0]
})()
log(`shop market: ${shopMarket.name} (${shopMarket.kecamatanId})`)

/* ---------------------------------------------------------------- 8. prices + sectors (simulated) */
const commodities = PRICES.map(([id, nid, nen, unit, price]) => {
  if (!(price > 0) || price % 50) throw new Error(`price ${id}: ${price} must be > 0 and a multiple of Rp 50`)
  return { id, name: { id: nid, en: nen }, unit, basePrice: price }
})
const sectors = SECTORS.map(([nid, nen, share]) => ({ name: { id: nid, en: nen }, share })).sort((a, b) => b.share - a.share)
const sectorSum = sectors.reduce((a, x) => a + x.share, 0)
if (!sectors.every((x) => Number.isInteger(x.share)) || sectorSum > 100) throw new Error(`sector shares must be whole percent with Σ ≤ 100 (got ${sectorSum})`)
sectors.push({ name: { id: 'Lainnya', en: 'Other' }, share: 100 - sectorSum })

/* ---------------------------------------------------------------- 9. assemble */
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

const SIM_URL = 'tools/region/data/sim-bandung.mjs'
const SIM_LICENSE = 'Angka simulasi GAMADA (bukan statistik resmi)'
const HDX = 'https://data.humdata.org/dataset/cod-ab-idn'
const OSM = 'https://www.openstreetmap.org/copyright'
const WIKI = 'https://id.wikipedia.org/wiki/Daftar_kecamatan_dan_kelurahan_di_Kota_Bandung'
const kecamatan = kecPack
  .map((k) => ({
    id: k.id,
    name: k.name,
    code: k.code,
    kemendagri: KEMENDAGRI[k.name],
    population: SIM_BY[k.name][1],
    centroid: k.centroid,
    riskFlood: riskFlood[k.id],
    riskLandslide: riskLandslide[k.id],
    mainSector: MAIN_SECTOR[k.id] ?? 'Perdagangan dan jasa',
    desa: desaByKec[k.id] ?? [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'id'))
const kelCount = kecamatan.reduce((a, k) => a + k.desa.length, 0)

const pack = {
  id: ID,
  name: 'Kota Bandung',
  shortName: 'Bandung',
  type: 'kota',
  province: 'Jawa Barat',
  slogan: null,
  center,
  zoom: CFG.zoom,
  bbox,
  stats: {
    population: TOTALS.population,
    households: TOTALS.households,
    area_km2: TOTALS.area_km2,
    year: SIM.year,
    source: `${SIM.label}. Rumah tangga = pemilik Kartu Keluarga. Skala mengacu ke publikasi BPS Kota Bandung (dikutip, dibulatkan).`,
  },
  kecamatan,
  rivers: rivers.map((r) => ({ id: slug(r.name), name: r.name })),
  landmarks,
  markets,
  economy: {
    sectors,
    commodities,
    source: 'Struktur sektor (persen bulat) dan harga dasar: angka simulasi untuk demo, berskala wajar untuk kota besar di Jawa Barat tahun 2026; bukan statistik atau harga resmi.',
  },
  opd: OPD,
  services: SERVICES,
  languages: {
    primary: 'id',
    regional: ['su'],
    speechCodes: ['su-ID', 'id-ID'],
    samples: { greetings: GREETINGS, complaintTemplates: COMPLAINTS },
  },
  weather: {},
  branding: { emblem: 'generic', primaryHue: CFG.primaryHue },
  scenario: {
    floodRiverId: slug(SCENARIO_RIVER),
    floodKecamatanIds,
    shopMarketId: shopMarket.id,
  },
  sources: [
    { layer: 'kecamatan', name: 'HDX COD-AB Indonesia — batas kecamatan (adm3)', url: HDX, license: 'CC BY-IGO', year: 2020, note: `BPS / OCHA ROAP; disederhanakan (Douglas-Peucker topologis, 4 desimal) oleh tools/region/build-bandung.mjs. Kode Kemendagri per kecamatan: ${WIKI} (Permendagri 72/2019)` },
    { layer: 'desa', name: 'HDX COD-AB Indonesia — batas kelurahan (adm4)', url: HDX, license: 'CC BY-IGO', year: 2020, note: `${kelCount} kelurahan (kota: tidak ada desa)` },
    { layer: 'stats', name: 'Angka simulasi berskala realistis: penduduk per kecamatan, KK, luas, ketinggian', url: SIM_URL, license: SIM_LICENSE, year: SIM.year, note: `${SIM.label}. Penduduk dibulatkan ke 100 (kecamatan) / 1.000 (total), KK ke 1.000, luas ke km² bulat, ketinggian maksimum ke 5 m; ${SIM.attribution}.` },
    { layer: 'economy', name: 'Struktur ekonomi simulasi (persen bulat, Σ 100)', url: SIM_URL, license: SIM_LICENSE, year: SIM.year, note: `${SIM.label}` },
    { layer: 'prices', name: 'Harga dasar simulasi', url: SIM_URL, license: SIM_LICENSE, year: 2026, note: 'harga dasar simulasi untuk demo, dipilih tim GAMADA agar wajar untuk kota besar di Jawa Barat tahun 2026, dibulatkan ke Rp 50/100; bukan harga resmi. Dunia simulasi menambah selisih per pasar dan fluktuasi harian.' },
    { layer: 'rivers', name: 'OpenStreetMap — sungai', url: OSM, license: 'ODbL 1.0 · © OpenStreetMap contributors', year: 2026, note: 'nama "Ci X" di OSM ditulis "CiX" (Cikapundung)' },
    { layer: 'roads', name: 'OpenStreetMap — jalan tol/trunk/primary/secondary', url: OSM, license: 'ODbL 1.0 · © OpenStreetMap contributors', year: 2026 },
    { layer: 'landmarks', name: 'OpenStreetMap — pasar, balai kota, kantor kecamatan, RS, puskesmas, sekolah, titik kumpul', url: OSM, license: 'ODbL 1.0 · © OpenStreetMap contributors', year: 2026, note: 'sampel: satu puskesmas per kecamatan, satu SMP/SMA/SMK negeri per kecamatan (maks. 14), RS maks. 8; titik kumpul = emergency=assembly_point di OSM (tanpa nama), dinamai menurut kecamatannya' },
    { layer: 'hazards.flood', name: 'Zona risiko banjir turunan (banjir cileuncang + luapan Cikapundung)', url: 'tools/region/build-bandung.mjs', license: 'Turunan dari HDX (CC BY-IGO) dan OSM (ODbL)', year: 2026, note: `${DERIVED_NOTE}. Jarak ke Cikapundung (dan sungai lain, bobot ${CFG.otherRiverWeight}) × faktor dataran rendah (ketinggian maksimum simulasi per kecamatan); riskFlood per kecamatan dari derivasi yang sama` },
    { layer: 'hazards.landslide', name: 'Zona risiko longsor turunan (lereng utara)', url: 'tools/region/build-bandung.mjs', license: 'Turunan dari HDX (CC BY-IGO)', year: 2026, note: `${DERIVED_NOTE}. riskLandslide per kecamatan dari ketinggian maksimum simulasi` },
    { layer: 'mainSector', name: 'Sektor utama per kecamatan', url: 'tools/region/content/bandung.mjs', license: 'Konten editorial GAMADA', note: 'ringkasan editorial (simulasi), bukan statistik per kecamatan' },
    { layer: 'opd', name: 'Daftar OPD (nomenklatur umum)', url: 'tools/region/content/bandung.mjs', license: 'Konten editorial GAMADA', note: 'nomenklatur umum perangkat daerah, bukan SOTK resmi Pemkot Bandung' },
    { layer: 'services', name: 'Layanan & persyaratan', url: 'tools/region/content/bandung.mjs', license: 'Konten editorial GAMADA', note: 'ringkasan umum persyaratan nasional; cek ketentuan resmi sebelum dipakai' },
    { layer: 'languages', name: 'Sapaan & template aduan Basa Sunda (contoh)', url: 'tools/region/content/bandung.mjs', license: 'Konten editorial GAMADA', note: 'contoh fiktif untuk demo, ditulis tim GAMADA, belum diperiksa penutur asli; nama tempat nyata' },
    { layer: 'umkmCount', name: 'TODO: jumlah UMKM belum diisi', url: 'tools/region/build-bandung.mjs', license: '-', note: 'field economy.umkmCount sengaja dikosongkan; bila dibutuhkan, isi dengan angka simulasi' },
  ],
}

const Q = (features) => quantizeFC({ type: 'FeatureCollection', features }, CFG.geoDecimals)
const geo = {
  kecamatan: Q(kecGeoOut.sort((a, b) => a.id.localeCompare(b.id))),
  rivers: Q(riverFeatures),
  roads: Q(roadFeatures),
  hazards: { flood: Q(floodFeatures), landslide: Q(landslideFeatures) },
}
const desaFC = Q(desaGeoOut.sort((a, b) => a.id.localeCompare(b.id)))

/* compact wire form of the pack: mirrors compactPack() in src/demo-kit/region/wire.ts (see build-bojonegoro.mjs) */
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
for (const line of encodePack(ID)) log(line)
log(`pack.json ${kb(packStr)} · pack.min.json ${kb(minStr)} · geo.json ${kb(geoStr)} (kecamatan ${part(geo.kecamatan)}, rivers ${part(geo.rivers)}, roads ${part(geo.roads)}, hazards ${part(geo.hazards)}) · desa.json ${kb(desaStr)}`)

if (!process.env.SKIP_VALIDATE) {
  const v = spawnSync('npx', ['tsx', join(HERE, 'validate.mjs'), ID], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (v.status !== 0) {
    console.error('[build] validate.mjs failed')
    process.exit(1)
  }
}
