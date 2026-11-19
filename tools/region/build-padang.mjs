#!/usr/bin/env node
/**
 * build-padang.mjs — turn the raw public geography in tools/region/.cache/padang/ (see fetch-padang.mjs; override
 * the folder with REGION_CACHE=<dir> or --cache=<dir>), the simulated statistics + base prices + terrain in
 * tools/region/data/sim-padang.mjs and the hand-written content in tools/region/content/padang.mjs into
 *   src/demo-kit/region/packs/padang/{pack,pack.min,geo,geo.min,desa,desa.min}.json
 * (same six files and shapes as build-bojonegoro.mjs). Deterministic: same cache in → byte-identical files out.
 * Works offline from the cache. At the end it runs tools/region/validate.mjs padang and fails on any error.
 *
 * Kota Padang: 11 kecamatan, 104 kelurahan (a kota has no desa). Flood zone and risk indices are a DERIVED
 * SIMULATION (distance to Batang Kuranji / Batang Kandis × a low-lying factor from the simulated terrain in
 * sim-padang.mjs), not a BNPB map. No tsunami layer (owner decision 2026-11-19, tahap7-plan §7 Q2).
 *
 *   node tools/region/fetch-padang.mjs && node tools/region/build-padang.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  simplifyTopology, douglasPeucker, roundLine, roundPt, round, centroid, pointInGeom, areaKm2, distToLine, bboxOf, ringArea, projector, quantizeFC,
} from './lib/geo.mjs'
import { SIM, KECAMATAN as SIM_KEC, TOTALS, SECTORS, PRICES, TERRAIN } from './data/sim-padang.mjs'
import { encodePack } from './encode-geo.mjs'
import { OPD, servicesFor, GREETINGS, COMPLAINTS } from './content/padang.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const cacheArg = process.argv.slice(2).find((a) => a.startsWith('--cache='))?.slice(8)
const CACHE = resolve(cacheArg ?? process.env.REGION_CACHE ?? join(HERE, '.cache', 'padang'))
const OUT = join(HERE, '..', '..', 'src', 'demo-kit', 'region', 'packs', 'padang')
const ID = 'padang'

/* ---------------------------------------------------------------- tunables (one block) */
const CFG = {
  /** Douglas-Peucker tolerance (m) per layer; shared borders use the smaller one */
  tolKecamatan: 30,
  tolDesa: 45,
  tolRiver: 35,
  tolRoad: 45,
  tolHazard: 150,
  decimals: 5,
  geoDecimals: 4,
  marketMergeM: 150,
  /** hazard grid cell (degrees, ≈ 220 m) and distance decay (m) from the scenario rivers */
  gridDeg: 0.002,
  floodDecayM: 900,
  floodHigh: 0.55,
  floodMid: 0.25,
  /** a kecamatan is flood-prone when the scenario rivers pass within this distance (m) */
  floodTouchM: 1000,
  riverMinKm: 2,
  schoolSample: 11,
  /** the islands make the bbox wide; the camera opens on the mainland city */
  zoom: 10.3,
  primaryHue: 186,
}
/** scenario rivers (OSM names after normalisation): the first one is `scenario.floodRiverId`. The plan named
 *  Batang Air Dingin as the second river, but OSM has no named way for it inside the city (2026-11-20 extract);
 *  Batang Kandis, the named river of the same northern plain (Koto Tangah), takes its place. */
const FLOOD_RIVERS = ['Batang Kuranji', 'Batang Kandis']
const EXPECT_KEC = 11
const EXPECT_KEL = 104

const rd = (f) => JSON.parse(readFileSync(join(CACHE, f), 'utf8'))
for (const f of ['hdx-adm3.geojson', 'hdx-adm4.geojson', 'osm-rivers.json', 'osm-roads.json', 'osm-pois.json', 'osm-named.json', 'wiki-padang.txt']) {
  if (!existsSync(join(CACHE, f))) throw new Error(`missing ${f} in ${CACHE} — run: node tools/region/fetch-padang.mjs`)
}
const log = (...a) => console.log('[build]', ...a)
const slug = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* ---------------------------------------------------------------- 1. admin boundaries (HDX COD-AB) */
const adm3 = rd('hdx-adm3.geojson')
const adm4 = rd('hdx-adm4.geojson')
/** HDX spelling → the spelling used in data/sim-padang.mjs */
const KEC_ALIAS = { 'Koto Tengah': 'Koto Tangah', Kototangah: 'Koto Tangah', 'Lubuk Kilangan ': 'Lubuk Kilangan' }
const kecName = (n) => KEC_ALIAS[n] ?? n
const isWater = (n) => /^perairan/i.test(n)
const kecFeats = adm3.features.filter((f) => !isWater(f.properties.adm3_name))
const waterFeat = adm3.features.find((f) => isWater(f.properties.adm3_name))
if (kecFeats.length !== EXPECT_KEC) throw new Error(`expected ${EXPECT_KEC} kecamatan, got ${kecFeats.length}: ${kecFeats.map((f) => f.properties.adm3_name)}`)
const simNames = new Set(SIM_KEC.map((r) => r[0]))
for (const f of kecFeats) if (!simNames.has(kecName(f.properties.adm3_name))) throw new Error(`unknown kecamatan ${f.properties.adm3_name}`)
log(`kecamatan: ${EXPECT_KEC} ✓${waterFeat ? ' (+ water unit)' : ''}`)

const desaFeats = adm4.features.filter((f) => !isWater(f.properties.adm4_name))
const realDesa = desaFeats.filter((f) => !f.properties.adm4_pcode.endsWith('999'))
if (realDesa.length !== EXPECT_KEL) throw new Error(`expected ${EXPECT_KEL} kelurahan, got ${realDesa.length}`)
log(`kelurahan: ${realDesa.length} ✓ (+ ${desaFeats.length - realDesa.length} non-administrative units)`)

const lat0 = -0.9
const allKecGeoms = kecFeats.map((f) => f.geometry)
const insideCity = (p) => allKecGeoms.some((g) => pointInGeom(p, g))
const kecOf = (p) => {
  const i = kecFeats.findIndex((f) => pointInGeom(p, f.geometry))
  return i < 0 ? undefined : slug(kecName(kecFeats[i].properties.adm3_name))
}

/* ---------------------------------------------------------------- 2. Kemendagri codes + kelurahan cross-check (Wikipedia) */
const KEMENDAGRI = {}
const WIKI_KEL = {}
{
  const wiki = readFileSync(join(CACHE, 'wiki-padang.txt'), 'utf8').split('\n')
  // row: |13.71.xx  /  |[[X, Padang|X]]  /  |align="center"| n||{{Flatlist|  /  * [[Kel, X, Padang|Kel]] …
  let cur = null
  for (let i = 0; i < wiki.length; i++) {
    const m = wiki[i].match(/^\|\s*(13\.71\.\d{2})\s*$/)
    if (m) {
      const n = (wiki[i + 1].match(/\|([^\]|]+)\]\]/) ?? [])[1]?.trim()
      if (!n || !simNames.has(n)) throw new Error(`wiki row ${m[1]}: unknown kecamatan "${n}"`)
      KEMENDAGRI[n] = m[1]
      cur = n
      WIKI_KEL[n] = []
      continue
    }
    const k = wiki[i].match(/^\*\s*\[\[[^\]|]+\|([^\]]+)\]\]/)
    if (k && cur) WIKI_KEL[cur].push(k[1].trim())
    if (/^\|-/.test(wiki[i]) && cur && WIKI_KEL[cur].length) cur = null
  }
  const codes = Object.values(KEMENDAGRI)
  if (codes.length !== EXPECT_KEC || new Set(codes).size !== EXPECT_KEC || !codes.every((c) => /^13\.71\.\d{2}$/.test(c))) throw new Error(`kemendagri codes: expected ${EXPECT_KEC} unique 13.71.xx, got ${codes.join(', ')}`)
  for (const [n, c] of [['Padang Selatan', '13.71.01'], ['Padang Barat', '13.71.03'], ['Bungus Teluk Kabung', '13.71.05'], ['Kuranji', '13.71.09'], ['Koto Tangah', '13.71.11']]) {
    if (KEMENDAGRI[n] !== c) throw new Error(`kemendagri spot check ${n}: ${KEMENDAGRI[n]} ≠ ${c}`)
  }
  log(`Kemendagri kecamatan codes: ${EXPECT_KEC} unique 13.71.xx ✓`)
}

/* ---------------------------------------------------------------- 3. topology-preserving simplification */
const kecInput = [...kecFeats, ...(waterFeat ? [waterFeat] : [])].map((f) => ({ type: 'Feature', properties: f.properties, geometry: f.geometry }))
const desaInput = desaFeats.map((f) => ({ type: 'Feature', properties: f.properties, geometry: f.geometry }))
const topo = simplifyTopology(
  { kec: kecInput, desa: desaInput },
  { tol: { kec: CFG.tolKecamatan, desa: CFG.tolDesa }, lat0, decimals: CFG.decimals, minAreaKm2: 0.02 },
)
log(`topology: ${topo.stats.arcs} arcs, ${topo.stats.junctions} junctions, ${topo.stats.ringsDropped} tiny rings dropped`)

const SIM_BY = Object.fromEntries(SIM_KEC.map((r) => [r[0], r]))
const kecGeoOut = []
const kecPack = []
topo.layers.kec.forEach((f) => {
  const p = f.properties
  if (isWater(p.adm3_name)) return
  const name = kecName(p.adm3_name)
  const id = slug(name)
  const src = kecFeats.find((k) => k.properties.adm3_pcode === p.adm3_pcode).geometry
  // centroid of the largest polygon: islands must not pull a kecamatan label into the sea
  const main = src.type === 'MultiPolygon' ? { type: 'Polygon', coordinates: src.coordinates.slice().sort((a, b) => areaKm2({ type: 'Polygon', coordinates: b }) - areaKm2({ type: 'Polygon', coordinates: a }))[0] } : src
  let c = centroid(main)
  if (!pointInGeom(c, main)) c = centroid(f.geometry)
  kecGeoOut.push({ type: 'Feature', id, properties: { id, name, code: p.adm3_pcode.slice(2) }, geometry: f.geometry })
  kecPack.push({ id, name, code: p.adm3_pcode.slice(2), centroid: roundPt(c, CFG.decimals), _geom: src, _main: main })
})

const desaGeoOut = topo.layers.desa
  .filter((f) => f.geometry.coordinates.length)
  .map((f) => {
    const p = f.properties
    const other = p.adm4_pcode.endsWith('999')
    const kecId = slug(kecName(p.adm3_name))
    const id = other ? `${kecId}-hutan` : `${kecId}-${slug(p.adm4_name)}`
    return { type: 'Feature', id, properties: { id, name: other ? 'Kawasan hutan' : p.adm4_name, kecamatanId: kecId, kind: other ? 'hutan' : 'kelurahan' }, geometry: f.geometry }
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
{
  // spelling cross-check against the Wikipedia list (HDX wins; differences are printed for the README)
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const diffs = []
  for (const k of kecPack) {
    const hdx = new Set((desaByKec[k.id] ?? []).map((d) => norm(d.name)))
    const wk = new Set((WIKI_KEL[k.name] ?? []).map(norm))
    const onlyH = (desaByKec[k.id] ?? []).filter((d) => !wk.has(norm(d.name))).map((d) => d.name)
    const onlyW = (WIKI_KEL[k.name] ?? []).filter((n) => !hdx.has(norm(n)))
    if (onlyH.length || onlyW.length) diffs.push(`${k.name}: HDX [${onlyH.join(', ')}] vs Wikipedia [${onlyW.join(', ')}]`)
  }
  log(diffs.length ? `kelurahan spelling HDX ≠ Wikipedia (HDX kept):\n    ${diffs.join('\n    ')}` : 'kelurahan names: HDX = Wikipedia ✓')
}

/* ---------------------------------------------------------------- 4. OSM rivers */
const osmRivers = rd('osm-rivers.json')
const cityBbox = bboxOf(kecFeats.flatMap((f) => (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates.flatMap((p) => p[0]))))
/** mainland bbox (largest polygon of every kecamatan): rivers / roads are clipped to it */
const mainBbox = bboxOf(kecPack.flatMap((k) => k._main.coordinates[0]))
const M = 0.02
const inBox = (p) => p[0] >= mainBbox[0] - M && p[0] <= mainBbox[2] + M && p[1] >= mainBbox[1] - M && p[1] <= mainBbox[3] + M
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
/** OSM river names → one spelling ("Sungai Batang Kuranji", "Batang Kuranji" → "Batang Kuranji";
 *  Minang "Aia" → Indonesian "Air" so ids stay stable: batang-air-dingin) */
const riverName = (n, waterway) => {
  if (!n) return null
  let s = n.trim().replace(/\s+/g, ' ')
  if (/banjir\s*kanal|banda\s*bakali/i.test(s)) return 'Banjir Kanal'
  if (waterway === 'canal') return null
  if (/^(selokan|drainase|saluran|parit|banda)\b/i.test(s)) return null
  s = s.replace(/^Sungai\s+(?=Batang\b)/i, '').replace(/^Btg\.?\s+/i, 'Batang ').replace(/\bAia\b/g, 'Air')
  return s
}
const riverGroups = new Map()
const MINOR = 'Sungai kecil (tanpa nama di OSM)'
const usedWays = new Set()
const riverPieces = []
for (const e of osmRivers.elements) {
  const ww = e.tags?.waterway
  if (e.type !== 'way' || !(ww === 'river' || ww === 'canal') || !e.geometry) continue
  usedWays.add(e.id)
  const name = e.tags.name ? riverName(e.tags.name, ww) : ww === 'river' ? MINOR : null
  riverPieces.push({ name, geometry: e.geometry })
}
for (const e of osmRivers.elements) {
  if (e.type !== 'relation' || e.tags?.waterway !== 'river' || !e.members) continue
  for (const m of e.members) if (m.type === 'way' && m.geometry && !usedWays.has(m.ref)) riverPieces.push({ name: riverName(e.tags.name, 'river'), geometry: m.geometry })
}
for (const e of riverPieces) {
  const name = e.name
  if (!name) continue
  const pts = e.geometry.map((g) => [g.lon, g.lat])
  const g = riverGroups.get(name) ?? { name, lines: [], insideKm: 0 }
  for (const run of clipRuns(pts)) g.lines.push(run)
  const ins = pts.map(insideCity)
  for (let i = 1; i < pts.length; i++) if (ins[i] && ins[i - 1]) g.insideKm += lineKm([pts[i - 1], pts[i]])
  riverGroups.set(name, g)
}
if (process.env.DEBUG) for (const g of riverGroups.values()) log('  river group', g.name, g.insideKm.toFixed(1), 'km inside')
for (const n of FLOOD_RIVERS) if (!riverGroups.get(n)) throw new Error(`${n} not found in OSM extract (groups: ${[...riverGroups.keys()].join(', ')})`)
const minor = riverGroups.get(MINOR)
riverGroups.delete(MINOR)
const rivers = [...riverGroups.values()].filter((g) => FLOOD_RIVERS.includes(g.name) || g.name === 'Banjir Kanal' || g.insideKm >= CFG.riverMinKm)
const rank = (n) => (FLOOD_RIVERS.includes(n) ? FLOOD_RIVERS.indexOf(n) : 9)
rivers.sort((a, b) => rank(a.name) - rank(b.name) || b.insideKm - a.insideKm || a.name.localeCompare(b.name))
const riverFeatures = [...rivers, ...(minor ? [minor] : [])].map((g) => {
  const isMinor = g === minor
  const id = isMinor ? 'sungai-kecil' : slug(g.name)
  const src = isMinor ? g.lines.flatMap((l) => splitInside(l)) : joinLines(g.lines)
  const lines = src.map((l) => roundLine(douglasPeucker(l, isMinor ? CFG.tolRiver * 2 : CFG.tolRiver, lat0), CFG.decimals)).filter((l) => l.length > 1 && lineKm(l) > (isMinor ? 0.6 : 0.3))
  return { type: 'Feature', id, properties: { id, name: g.name, kind: isMinor ? 'stream' : 'river', main: g.name === FLOOD_RIVERS[0] }, geometry: { type: 'MultiLineString', coordinates: lines } }
}).filter((f) => f.geometry.coordinates.length)
function splitInside(pts) {
  const runs = []
  let cur = []
  for (const p of pts) {
    if (insideCity(p)) cur.push(p)
    else if (cur.length) { if (cur.length > 1) runs.push(cur); cur = [] }
  }
  if (cur.length > 1) runs.push(cur)
  return joinLines(runs)
}
log(`rivers: ${rivers.map((r) => `${r.name} (${r.insideKm.toFixed(0)} km)`).join(', ')}`)

/* ---------------------------------------------------------------- 5. OSM roads */
const osmRoads = rd('osm-roads.json')
const roadGroups = new Map()
for (const e of osmRoads.elements) {
  if (e.type !== 'way' || !e.geometry) continue
  const pts = e.geometry.map((g) => [g.lon, g.lat])
  if (!pts.some(insideCity)) continue
  const cls = e.tags.highway
  const label = e.tags.ref || e.tags.name || ''
  const key = `${cls}|${label}`
  const g = roadGroups.get(key) ?? { cls, name: e.tags.name || null, ref: e.tags.ref || null, lines: [] }
  for (const run of clipRuns(pts)) g.lines.push(run)
  roadGroups.set(key, g)
}
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
  if (!insideCity(c)) continue
  poiList.push({ type: e.type, tags: e.tags, name: e.tags.name.trim().replace(/\s+/g, ' '), coord: roundPt(c, CFG.decimals), osm: key })
}
poiList.sort((a, b) => a.osm.localeCompare(b.osm))
const distM = (a, b) => Math.hypot((a[0] - b[0]) * projector(lat0).kx, (a[1] - b[1]) * projector(lat0).ky)
const fixCaps = (s) => s.trim().split(' ').map((w) => (/^(SMA|SMK|SMP|SMAN|SMKN|SMPN|SD|SDN|MI|MTs|MA|MTsN|MAN|RS|RSU|RSUD|RSUP|RSI|BMC)$/.test(w) || !/^[A-Z]{3,}$/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).join(' ')
const titleCase = (s) => s.replace(/\s+/g, ' ').replace(/(^|\s)([a-z])/g, (_, a, b) => a + b.toUpperCase())
const unCaps = (s) => (/[a-z]/.test(s) ? s : s.toLowerCase())
const specificity = (n) => n.split(' ').length * 100 + n.length
const markets = []
const marketNames = new Set()
for (const p of poiList) {
  if (p.tags.amenity !== 'marketplace' || !/^pasar\b/i.test(p.name)) continue
  const name = titleCase(unCaps(p.name.replace(/,.*$/, '').replace(/\s*\(.*\)$/, '').replace(/\s+UPTD(?= )/, '')))
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
let damId
{
  const balai = findPoi(/^Balai ?Kota Padang$/i) ?? findPoi(/^(Kantor )?(Pemerintah Kota|Pemko) Padang$/i) ?? findPoi(/Balai ?Kota Padang/i)
  if (balai) addLm('balai-kota-padang', 'Balai Kota Padang', 'kantor', balai.coord)
  const mpp = findPoi(/^Mal{1,2} Pelayanan Publik/i)
  if (mpp) addLm('mpp-kota-padang', 'Mal Pelayanan Publik Kota Padang', 'mpp', mpp.coord)
  const isPort = (p) => p.tags.harbour || p.tags.industrial === 'port' || p.tags.landuse === 'port' || p.tags.amenity === 'ferry_terminal'
  const tb = findPoi(/^Pelabuhan Teluk Bayur$/i) ?? findPoi(/^(Port of )?Teluk Bayur$/i, isPort) ?? findPoi(/Teluk Bayur/i, isPort)
  if (tb) addLm('pelabuhan-teluk-bayur', 'Pelabuhan Teluk Bayur', 'pelabuhan', tb.coord)
  const muaro = findPoi(/^Pelabuhan Muara?o?( Padang)?$/i) ?? findPoi(/^(Pelabuhan )?Muaro( Padang)?$/i, isPort)
  if (muaro) addLm('pelabuhan-muaro', 'Pelabuhan Muaro', 'pelabuhan', muaro.coord)
  // the weir on Batang Kuranji, only when OSM tags it weir/dam WITH a name (Gunung Nago or "Bendung Batang Kuranji")
  const isDam = (p) => ['weir', 'dam'].includes(p.tags.waterway) || p.tags.man_made === 'dam'
  const nago = findPoi(/Gunung Nago/i, isDam) ?? findPoi(/^Bendung(an)? Batang Kuranji$/i, isDam)
  if (nago) {
    damId = slug(/^bendung/i.test(nago.name) ? nago.name : `Bendung ${nago.name}`)
    addLm(damId, /^bendung/i.test(nago.name) ? titleCase(nago.name) : `Bendung ${nago.name}`, 'bendungan', nago.coord)
  }
  for (const p of poiList) {
    if (p.tags.amenity === 'hospital' && /^(RS|RSU|RSUD|RSUP|RSI|Rumah Sakit)\b/i.test(p.name))
      if (!landmarks.some((l) => l.kind === 'rs' && distM(l.coord, p.coord) < 200)) addLm(slug(p.name), fixCaps(titleCase(p.name.replace(/^RS\.\s*/, 'RS '))), 'rs', p.coord)
  }
  for (const p of poiList) {
    if (!/^(UPTD )?Puskesmas\b/i.test(p.name) || /pembantu|bekas|keliling|^puskesmas$/i.test(p.name)) continue
    if (landmarks.some((l) => l.kind === 'puskesmas' && distM(l.coord, p.coord) < 150)) continue
    addLm(slug(p.name.replace(/^UPTD /, '')), titleCase(unCaps(p.name.replace(/^UPTD /, ''))), 'puskesmas', p.coord)
  }
  for (const p of poiList) {
    if (!(p.tags.amenity === 'townhall' || p.tags.office === 'government')) continue
    const m = p.name.match(/^Kantor (?:Kecamatan|Camat) ([A-Za-z ]+?)\s*$/i)
    if (m && kecPack.some((k) => k.name.toLowerCase() === m[1].toLowerCase())) addLm(`kantor-kecamatan-${slug(m[1])}`, `Kantor Kecamatan ${titleCase(m[1].toLowerCase())}`, 'kantor', p.coord)
  }
  const perKec = new Set()
  const schools = poiList
    .filter((p) => p.tags.amenity === 'school' && /^(SMA|SMK|SMP)\s*N(egeri)?\b/i.test(p.name))
    .sort((a, b) => a.name.localeCompare(b.name) || a.osm.localeCompare(b.osm))
  for (const p of schools) {
    const k = kecOf(p.coord)
    if (!k || perKec.has(k) || perKec.size >= CFG.schoolSample) continue
    const name = fixCaps(p.name.replace(/,.*$/, '').replace(/\s+(Kota\s+)?Padang$/i, '').replace(/\s+/g, ' '))
    if (landmarks.some((l) => l.id === slug(name))) continue
    perKec.add(k)
    addLm(slug(name), name, 'sekolah', p.coord)
  }
}
log(`markets: ${markets.length} (${markets.map((m) => m.name).join(', ')})`)
log(`landmarks: ${landmarks.length} (${Object.entries(landmarks.reduce((a, l) => ((a[l.kind] = (a[l.kind] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')})`)

/* ---------------------------------------------------------------- 7. derived flood zone (simulation) */
const floodLines = FLOOD_RIVERS.flatMap((n) => riverGroups.get(n).lines)
const altByKec = Object.fromEntries(SIM_KEC.map((r) => [slug(r[0]), r[2]]))
/** simulated altitude (m) at p: flat coastal plain, then a rise inland from the reference shoreline (sim-padang.mjs) */
const simAltitude = (p, kecId) => {
  const dKm = distToLine(p, TERRAIN.shoreline, lat0) / 1000
  const rise = Math.max(0, dKm - TERRAIN.plainKm) ** TERRAIN.exp * TERRAIN.riseMPerKm
  return Math.min(altByKec[kecId] ?? 1000, TERRAIN.base + rise)
}
const lowFactor = (alt) => (alt <= 10 ? 1 : alt <= 25 ? 0.75 : alt <= 60 ? 0.4 : alt <= 150 ? 0.15 : 0.03)
const distTo = (p, lines) => Math.min(...lines.map((l) => distToLine(p, l, lat0)))
const g = CFG.gridDeg
const box = mainBbox
const W = Math.ceil((box[2] - box[0]) / g) + 1
const H = Math.ceil((box[3] - box[1]) / g) + 1
const score = new Float32Array(W * H).fill(-1)
const kecScores = {}
const kecMinDist = {}
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const p = [box[0] + (i + 0.5) * g, box[1] + (j + 0.5) * g]
    const kid = kecOf(p)
    if (!kid) continue
    const d = distTo(p, floodLines)
    const s = Math.exp(-d / CFG.floodDecayM) * lowFactor(simAltitude(p, kid))
    score[j * W + i] = s
    ;(kecScores[kid] ??= []).push(s)
    kecMinDist[kid] = Math.min(kecMinDist[kid] ?? Infinity, d)
  }
}
function polygonize(pred) {
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
      if (ring.length >= 4) rings.push(ring.map(([x, y]) => [box[0] + x * g, box[1] + y * g]))
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
  return { type: 'MultiPolygon', coordinates: polys.filter((p) => areaKm2({ type: 'Polygon', coordinates: [p[0]] }) > 0.15) }
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

/* risk per kecamatan: mean of the upper 40 % of its cells (big kecamatan reach far into the hills; the mean of
   all cells would hide the flooded plain) */
const riskFlood = {}
for (const k of kecPack) {
  const arr = (kecScores[k.id] ?? [0]).slice().sort((a, b) => b - a)
  const top = arr.slice(0, Math.max(1, Math.ceil(arr.length * 0.4)))
  const mean = top.reduce((a, b) => a + b, 0) / top.length
  riskFlood[k.id] = round(Math.min(0.95, 0.05 + mean * 1.1), 2)
}
const riskLandslide = {}
for (const k of kecPack) {
  const v = 0.05 + Math.max(0, Math.min(1, (altByKec[k.id] - 50) / 950)) * 0.8
  riskLandslide[k.id] = round(v, 2)
}
const floodRanked = kecPack
  .filter((k) => (kecMinDist[k.id] ?? Infinity) < CFG.floodTouchM)
  .sort((a, b) => riskFlood[b.id] - riskFlood[a.id] || a.id.localeCompare(b.id))
log(`flood candidates (derived): ${floodRanked.map((k) => `${k.id} ${riskFlood[k.id]} (${(kecMinDist[k.id] / 1000).toFixed(1)} km)`).join(', ')}`)
const floodKecamatanIds = floodRanked.slice(0, 4).map((k) => k.id)
log(`flood-prone (derived): ${floodKecamatanIds.join(', ')} · landslide: ${kecPack.map((k) => `${k.id} ${riskLandslide[k.id]}`).join(', ')}`)

/* ---------------------------------------------------------------- 8. prices + 9. sectors (simulated) */
const commodities = PRICES.map(([id, nid, nen, unit, price]) => {
  if (!(price > 0) || price % 50) throw new Error(`price ${id}: ${price} must be > 0 and a multiple of Rp 50`)
  return { id, name: { id: nid, en: nen }, unit, basePrice: price }
})
const sectors = SECTORS.map(([nid, nen, share]) => ({ name: { id: nid, en: nen }, share })).sort((a, b) => b.share - a.share)
const sectorSum = sectors.reduce((a, x) => a + x.share, 0)
if (!sectors.every((x) => Number.isInteger(x.share)) || sectorSum > 100) throw new Error(`sector shares must be whole percent with Σ ≤ 100 (got ${sectorSum})`)
sectors.push({ name: { id: 'Lainnya', en: 'Other' }, share: 100 - sectorSum })

/* ---------------------------------------------------------------- 10. main sector per kecamatan (editorial) */
const MAIN_SECTOR = {
  'bungus-teluk-kabung': 'Perikanan dan pariwisata pantai',
  'koto-tangah': 'Perdagangan, pertanian dan perikanan',
  kuranji: 'Perdagangan dan permukiman',
  'lubuk-begalung': 'Perdagangan dan industri kecil',
  'lubuk-kilangan': 'Industri pengolahan (semen)',
  nanggalo: 'Perdagangan dan jasa',
  'padang-barat': 'Perdagangan dan jasa',
  'padang-selatan': 'Pelabuhan, perdagangan dan pariwisata',
  'padang-timur': 'Perdagangan dan jasa',
  'padang-utara': 'Pendidikan dan jasa',
  pauh: 'Pendidikan tinggi dan pertanian',
}

/* ---------------------------------------------------------------- 11. assemble */
const allCoords = kecGeoOut.flatMap((f) => (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates.flatMap((p) => p[0])))
const bbox = bboxOf(allCoords).map((v) => round(v, 4))
let cx = 0, cy = 0, ca = 0
for (const k of kecPack) {
  const a = areaKm2(k._main)
  cx += k.centroid[0] * a
  cy += k.centroid[1] * a
  ca += a
}
const center = [round(cx / ca, 4), round(cy / ca, 4)]

// shop scenario: the market nearest to the scenario river among the markets of the flood kecamatan
const shopMarket =
  markets
    .filter((m) => floodKecamatanIds.includes(m.kecamatanId))
    .map((m) => ({ m, d: distTo(m.coord, floodLines) }))
    .sort((a, b) => a.d - b.d || a.m.id.localeCompare(b.m.id))[0]?.m ??
  markets.map((m) => ({ m, d: distM(m.coord, kecPack.find((k) => k.id === floodKecamatanIds[0]).centroid) })).sort((a, b) => a.d - b.d)[0].m
log(`shop market: ${shopMarket.name} (${shopMarket.kecamatanId})`)

const SIM_URL = 'tools/region/data/sim-padang.mjs'
const SIM_LICENSE = 'Angka simulasi GAMADA (bukan statistik resmi)'
const HDX = 'https://data.humdata.org/dataset/cod-ab-idn'
const OSM = 'https://www.openstreetmap.org/copyright'
const WIKI = 'https://id.wikipedia.org/wiki/Daftar_kecamatan_dan_kelurahan_di_Kota_Padang'
const hasMpp = landmarks.some((l) => l.kind === 'mpp')
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

const pack = {
  id: ID,
  name: 'Kota Padang',
  shortName: 'Padang',
  type: 'kota',
  province: 'Sumatera Barat',
  slogan: null,
  center,
  zoom: CFG.zoom,
  bbox,
  stats: {
    population: TOTALS.population,
    households: TOTALS.households,
    area_km2: TOTALS.area_km2,
    year: SIM.year,
    source: `${SIM.label}. Rumah tangga = pemilik Kartu Keluarga. Skala mengacu ke publikasi BPS Kota Padang (dikutip, dibulatkan).`,
  },
  kecamatan,
  rivers: rivers.map((r) => ({ id: slug(r.name), name: r.name })),
  landmarks,
  markets,
  economy: {
    sectors,
    commodities,
    source: 'Struktur sektor (persen bulat) dan harga dasar: angka simulasi untuk demo, berskala wajar untuk kota pelabuhan di Sumatra tahun 2026; bukan statistik atau harga resmi.',
  },
  opd: OPD,
  services: servicesFor({ hasMpp }),
  languages: {
    primary: 'id',
    regional: ['min'],
    speechCodes: ['id-ID'],
    samples: { greetings: GREETINGS, complaintTemplates: COMPLAINTS },
  },
  weather: {},
  branding: { emblem: 'generic', primaryHue: CFG.primaryHue },
  scenario: {
    floodRiverId: slug(FLOOD_RIVERS[0]),
    damLandmarkId: damId,
    floodKecamatanIds,
    shopMarketId: shopMarket.id,
  },
  sources: [
    { layer: 'kecamatan', name: 'HDX COD-AB Indonesia — batas kecamatan (adm3)', url: HDX, license: 'CC BY-IGO', year: 2020, note: `BPS / OCHA ROAP; disederhanakan (Douglas-Peucker topologis, 4 desimal) oleh tools/region/build-padang.mjs. Kode Kemendagri per kecamatan: ${WIKI} (Permendagri 72/2019)` },
    { layer: 'desa', name: 'HDX COD-AB Indonesia — batas kelurahan (adm4)', url: HDX, license: 'CC BY-IGO', year: 2020, note: `${EXPECT_KEL} kelurahan (kota: tidak ada desa); ejaan dicek silang dengan ${WIKI} (CC BY-SA), ejaan HDX dipakai` },
    { layer: 'stats', name: 'Angka simulasi berskala realistis: penduduk per kecamatan, KK, luas, ketinggian', url: SIM_URL, license: SIM_LICENSE, year: SIM.year, note: `${SIM.label}. Penduduk dibulatkan ke 100 (kecamatan) / 1.000 (total), KK ke 1.000, luas ke km² bulat, ketinggian maksimum ke 5 m; ${SIM.attribution}.` },
    { layer: 'economy', name: 'Struktur ekonomi simulasi (persen bulat, Σ 100)', url: SIM_URL, license: SIM_LICENSE, year: SIM.year, note: `${SIM.label}` },
    { layer: 'prices', name: 'Harga dasar simulasi', url: SIM_URL, license: SIM_LICENSE, year: 2026, note: 'harga dasar simulasi untuk demo, dipilih tim GAMADA agar wajar untuk ibu kota provinsi di Sumatra tahun 2026, dibulatkan ke Rp 50/100; bukan harga resmi. Dunia simulasi menambah selisih per pasar dan fluktuasi harian.' },
    { layer: 'rivers', name: 'OpenStreetMap — sungai & banjir kanal', url: OSM, license: 'ODbL 1.0 · © OpenStreetMap contributors', year: 2026 },
    { layer: 'roads', name: 'OpenStreetMap — jalan trunk/primary/secondary', url: OSM, license: 'ODbL 1.0 · © OpenStreetMap contributors', year: 2026 },
    { layer: 'landmarks', name: 'OpenStreetMap — pasar, balai kota, pelabuhan, RS, puskesmas, sekolah', url: OSM, license: 'ODbL 1.0 · © OpenStreetMap contributors', year: 2026, note: 'sampel sekolah: satu SMP/SMA/SMK negeri per kecamatan' },
    { layer: 'hazards.flood', name: 'Zona risiko banjir turunan', url: 'tools/region/build-padang.mjs', license: 'Turunan dari HDX (CC BY-IGO) dan OSM (ODbL)', year: 2026, note: `${DERIVED_NOTE}. Jarak ke Batang Kuranji dan Batang Kandis × faktor dataran rendah dari medan simulasi (sim-padang.mjs, bukan DEM); riskFlood/riskLandslide per kecamatan dari derivasi yang sama. Tanpa lapisan tsunami.` },
    { layer: 'mainSector', name: 'Sektor utama per kecamatan', url: 'tools/region/build-padang.mjs', license: 'Konten editorial GAMADA', note: 'ringkasan editorial (simulasi), bukan statistik per kecamatan' },
    { layer: 'opd', name: 'Daftar OPD (nomenklatur umum)', url: 'tools/region/content/padang.mjs', license: 'Konten editorial GAMADA', note: 'nomenklatur umum perangkat daerah kota, bukan SOTK resmi Pemkot Padang' },
    { layer: 'services', name: 'Layanan & persyaratan', url: 'tools/region/content/padang.mjs', license: 'Konten editorial GAMADA', note: 'ringkasan umum persyaratan nasional; cek ketentuan resmi sebelum dipakai' },
    { layer: 'languages', name: 'Sapaan & template aduan Baso Minang (contoh)', url: 'tools/region/content/padang.mjs', license: 'Konten editorial GAMADA', note: 'contoh fiktif ditulis tim GAMADA, belum diperiksa penutur asli; nama tempat nyata' },
    { layer: 'umkmCount', name: 'TODO: jumlah UMKM belum diisi', url: 'tools/region/build-padang.mjs', license: '-', note: 'field economy.umkmCount sengaja dikosongkan; bila dibutuhkan, isi dengan angka simulasi' },
  ],
}
if (!pack.scenario.damLandmarkId) delete pack.scenario.damLandmarkId

const Q = (features) => quantizeFC({ type: 'FeatureCollection', features }, CFG.geoDecimals)
const geo = {
  kecamatan: Q(kecGeoOut.sort((a, b) => a.id.localeCompare(b.id))),
  rivers: Q(riverFeatures),
  roads: Q(roadFeatures),
  hazards: { flood: Q(floodFeatures) },
}
const desaFC = Q(desaGeoOut.sort((a, b) => a.id.localeCompare(b.id)))

/* compact wire form of the pack: mirrors compactPack() in src/demo-kit/region/wire.ts */
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
log(`pack.json ${kb(packStr)} · pack.min.json ${kb(minStr)} · geo.json ${kb(geoStr)} (kecamatan ${part(geo.kecamatan)}, rivers ${part(geo.rivers)}, roads ${part(geo.roads)}, flood ${part(geo.hazards)}) · desa.json ${kb(desaStr)}`)

if (!process.env.SKIP_VALIDATE) {
  const v = spawnSync('npx', ['tsx', join(HERE, 'validate.mjs'), ID], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (v.status !== 0) {
    console.error('[build] validate.mjs failed')
    process.exit(1)
  }
}
