#!/usr/bin/env node
/**
 * fetch-padang.mjs — download the PUBLIC raw data for the Kota Padang region pack into
 * tools/region/.cache/padang/ (git-ignored; override with REGION_CACHE=<dir> or --cache=<dir>). Re-runnable;
 * skips files already present unless --force. Then run build-padang.mjs (same cache dir) to produce the pack.
 *
 *   node tools/region/fetch-padang.mjs [--force] [--only=hdx|osm|wiki] [--cache=<dir>]
 *
 * Sources (see src/demo-kit/region/packs/README.md for licences):
 *   - HDX COD-AB Indonesia (BPS / OCHA, CC BY-IGO): admin3 (kecamatan) + admin4 (kelurahan) polygons, read
 *     straight out of the remote ZIP with HTTP Range requests (same archive as Bojonegoro), filtered to ID1371.
 *   - OpenStreetMap via Overpass API (ODbL): rivers, roads, markets, landmarks, inside the bbox of the HDX
 *     kecamatan (so run hdx first; --only=osm reads the cached adm3 file).
 *   - Wikipedia (CC BY-SA, facts): "Daftar kecamatan dan kelurahan di Kota Padang" (table citing Permendagri
 *     72/2019), read only for the Kemendagri kecamatan codes 13.71.xx and the kelurahan spelling cross-check.
 * Statistics, prices and altitude are NOT fetched: they are simulated figures in data/sim-padang.mjs.
 * No tsunami data is fetched or derived (owner decision 2026-11-19, tahap7-plan §7 Q2).
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve as resolveZip, listEntries, streamEntry } from './lib/zip-range.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const cacheArg = argv.find((a) => a.startsWith('--cache='))?.slice(8)
export const CACHE = resolve(cacheArg ?? process.env.REGION_CACHE ?? join(HERE, '.cache', 'padang'))
const args = new Set(argv)
const FORCE = args.has('--force')
const ONLY = [...args].find((a) => a.startsWith('--only='))?.slice(7)

export const HDX_URL =
  'https://data.humdata.org/dataset/84a1d98a-790b-4d66-9d14-bbfa48500802/resource/e1421da4-8f48-47d2-ac49-79ff5bfa4d24/download/idn_admin_boundaries.geojson.zip'
/** BPS code of Kota Padang (Sumatera Barat 13, Padang 71) */
const ADM2_PCODE = 'ID1371'
export const OVERPASS = 'https://overpass-api.de/api/interpreter'

mkdirSync(CACHE, { recursive: true })
const out = (f) => join(CACHE, f)
const need = (f) => FORCE || !existsSync(out(f))
const log = (...a) => console.log('[fetch]', ...a)

async function hdx() {
  const wanted = [
    ['idn_admin3.geojson', 'hdx-adm3.geojson'],
    ['idn_admin4.geojson', 'hdx-adm4.geojson'],
  ].filter(([, f]) => need(f))
  if (!wanted.length) return log('hdx: cached')
  for (const [name, file] of wanted) {
    // resolve the signed download URL once per entry: it expires after a few minutes, and one entry can take
    // longer than that on a slow line (the open stream itself keeps going)
    const { url, size } = await resolveZip(HDX_URL)
    const entries = await listEntries(url, size)
    const e = entries.find((x) => x.name === name)
    if (!e) throw new Error(`HDX archive has no ${name}`)
    log(`hdx: streaming ${name} (${(e.compSize / 1e6).toFixed(0)} MB compressed), keeping ${ADM2_PCODE} …`)
    // GDAL writes one feature per line → filter lines without parsing 300–650 MB of JSON.
    const keep = []
    let rest = ''
    const tag = `"adm2_pcode":"${ADM2_PCODE}"`
    for await (const chunk of streamEntry(url, e)) {
      const s = rest + chunk.toString('utf8')
      const lines = s.split('\n')
      rest = lines.pop() ?? ''
      for (const l of lines) if (l.includes(tag)) keep.push(JSON.parse(l.replace(/,\s*$/, '')))
    }
    if (rest.includes(tag)) keep.push(JSON.parse(rest.replace(/,\s*$/, '')))
    writeFileSync(out(file), JSON.stringify({ type: 'FeatureCollection', source: HDX_URL, fetched: new Date().toISOString(), features: keep }))
    log(`hdx: ${name} → ${keep.length} features`)
  }
}

/** [south, west, north, east] of the HDX kecamatan + a small margin (islands included) */
function bboxFromHdx() {
  const fc = JSON.parse(readFileSync(out('hdx-adm3.geojson'), 'utf8'))
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1])
    } else for (const x of c) walk(x)
  }
  for (const f of fc.features) walk(f.geometry.coordinates)
  const m = 0.03
  return [s - m, w - m, n + m, e + m].map((v) => v.toFixed(3)).join(',')
}

async function overpass(file, query) {
  if (!need(file)) return log(`osm: ${file} cached`)
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'region-pack-builder/1.0 (open-data script)',
        Accept: 'application/json',
      },
      body: 'data=' + encodeURIComponent(query),
    })
    const text = await res.text()
    if (res.ok && text.startsWith('{')) {
      const j = JSON.parse(text)
      j.fetched = new Date().toISOString()
      writeFileSync(out(file), JSON.stringify(j))
      return log(`osm: ${file} → ${j.elements.length} elements`)
    }
    log(`osm: ${file} HTTP ${res.status}, retry ${attempt}`)
    await new Promise((r) => setTimeout(r, 15000 * 2 ** (attempt - 1)))
  }
  throw new Error(`overpass failed: ${file}`)
}

async function osm() {
  const b = `(${bboxFromHdx()})`
  log('osm bbox', b)
  await overpass('osm-rivers.json', `[out:json][timeout:180];
(
  way["waterway"~"^(river|canal)$"]${b};
  relation["waterway"="river"]${b};
  way["natural"="water"]["water"~"reservoir|lake"]${b};
  relation["natural"="water"]["water"~"reservoir|lake"]${b};
);
out geom;`)
  await overpass('osm-roads.json', `[out:json][timeout:180];
way["highway"~"^(trunk|primary|secondary)$"]${b};
out geom;`)
  await overpass('osm-pois.json', `[out:json][timeout:180];
(
  nwr["amenity"="marketplace"]${b};
  nwr["amenity"="townhall"]${b};
  nwr["office"="government"]${b};
  nwr["amenity"="hospital"]${b};
  nwr["amenity"="clinic"]${b};
  nwr["healthcare"="centre"]${b};
  nwr["amenity"="school"]["name"~"^(SMA|SMK|SMP)"]${b};
  nwr["waterway"="dam"]${b};
  nwr["waterway"="weir"]${b};
  nwr["man_made"="dam"]${b};
  nwr["harbour"]${b};
  nwr["industrial"="port"]${b};
  nwr["landuse"="port"]${b};
  nwr["amenity"="ferry_terminal"]${b};
  nwr["emergency"="assembly_point"]${b};
);
out tags center;`)
  // Named anchors that the generic tag queries miss (Balai Kota, ports, MPP, puskesmas, the Gunung Nago weir)
  await overpass('osm-named.json', `[out:json][timeout:180];
nwr["name"~"Balai Kota Padang|Balaikota Padang|Pemerintah Kota Padang|Pemko Padang|Teluk Bayur|Muaro|Muara Padang|Mal Pelayanan|Mall Pelayanan|MPP|Puskesmas|Gunung Nago|Pasar"]${b};
out tags center;`)
}

/** id.wikipedia raw wikitext of the kecamatan + kelurahan list: the Kemendagri code per kecamatan (Permendagri
 *  72/2019, NIK / No. KK digits) and kelurahan spelling (cross-check only). */
export const WIKI_RAW = 'https://id.wikipedia.org/w/index.php?title=Daftar_kecamatan_dan_kelurahan_di_Kota_Padang&action=raw'
async function wiki() {
  if (!need('wiki-padang.txt')) return log('wiki: cached')
  const t = await (await fetch(WIKI_RAW, { headers: { 'User-Agent': 'region-pack-builder/1.0' } })).text()
  writeFileSync(out('wiki-padang.txt'), t)
  log(`wiki: kecamatan table → ${t.length} B`)
}

const steps = { hdx, wiki, osm }
for (const [k, fn] of Object.entries(steps)) if (!ONLY || ONLY === k) await fn()
log('done →', CACHE)
