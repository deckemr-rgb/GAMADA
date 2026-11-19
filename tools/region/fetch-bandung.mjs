#!/usr/bin/env node
/**
 * fetch-bandung.mjs — download the PUBLIC raw data for the Kota Bandung region pack into
 * tools/region/.cache/bandung/ (git-ignored; override with REGION_CACHE=<dir>). Re-runnable; skips files already
 * present unless --force. Then run build-bandung.mjs (same REGION_CACHE) to produce the pack.
 *
 *   node tools/region/fetch-bandung.mjs [--force] [--only=hdx|osm|wiki]
 *
 * Sources (see src/demo-kit/region/packs/README.md for licences):
 *   - HDX COD-AB Indonesia (BPS / OCHA, CC BY-IGO): admin3 (kecamatan) + admin4 (kelurahan) polygons, read straight
 *     out of the remote ZIP with HTTP Range requests (only the needed entries are streamed). Same ZIP as Bojonegoro.
 *   - OpenStreetMap via Overpass API (ODbL): rivers, roads, markets, landmarks.
 *   - Wikipedia (CC BY-SA, facts): the kecamatan table of id.wikipedia.org/wiki/Kota_Bandung, read only for the
 *     Kemendagri codes (NIK digits; the article transcludes "Daftar kecamatan dan kelurahan di Kota Bandung").
 * Statistics and staple prices are NOT fetched: they are simulated figures in data/sim-bandung.mjs.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve as resolveZip, listEntries, streamEntry } from './lib/zip-range.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const CACHE = process.env.REGION_CACHE ? resolve(process.env.REGION_CACHE) : join(HERE, '.cache', 'bandung')
const args = new Set(process.argv.slice(2))
const FORCE = args.has('--force')
const ONLY = [...args].find((a) => a.startsWith('--only='))?.slice(7)

export const HDX_URL =
  'https://data.humdata.org/dataset/84a1d98a-790b-4d66-9d14-bbfa48500802/resource/e1421da4-8f48-47d2-ac49-79ff5bfa4d24/download/idn_admin_boundaries.geojson.zip'
/** BPS code of Kota Bandung (Jawa Barat 32, Kota Bandung 73) */
const ADM2_PCODE = 'ID3273'
export const OVERPASS = 'https://overpass-api.de/api/interpreter'
/** [south, west, north, east] with a small margin around the kota */
const BBOX = '-6.99,107.52,-6.82,107.76'

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
  const { url, size } = await resolveZip(HDX_URL)
  const entries = await listEntries(url, size)
  for (const [name, file] of wanted) {
    const e = entries.find((x) => x.name === name)
    if (!e) throw new Error(`HDX archive has no ${name}`)
    log(`hdx: streaming ${name} (${(e.compSize / 1e6).toFixed(0)} MB compressed), keeping ${ADM2_PCODE} …`)
    // GDAL writes one feature per line → filter lines without parsing the whole national file.
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
  const b = `(${BBOX})`
  await overpass('osm-rivers.json', `[out:json][timeout:180];
(
  way["waterway"="river"]${b};
  relation["waterway"="river"]${b};
  way["waterway"="stream"]["name"~"^(Sungai|Kali|Ci)"]${b};
  way["natural"="water"]["water"~"reservoir|lake"]${b};
  relation["natural"="water"]["water"~"reservoir|lake"]${b};
);
out geom;`)
  await overpass('osm-roads.json', `[out:json][timeout:180];
way["highway"~"^(motorway|trunk|primary|secondary)$"]${b};
out geom;`)
  await overpass('osm-pois.json', `[out:json][timeout:180];
(
  nwr["amenity"="marketplace"]${b};
  nwr["amenity"="townhall"]${b};
  nwr["office"="government"]${b};
  nwr["amenity"="hospital"]${b};
  nwr["healthcare"="centre"]${b};
  nwr["amenity"="clinic"]["name"~"Puskesmas",i]${b};
  nwr["amenity"="school"]["name"~"^(SMA|SMK|SMP)",i]${b};
  nwr["emergency"="assembly_point"]${b};
  nwr["waterway"~"^(dam|weir)$"]${b};
);
out tags center;`)
  // Named anchors that the generic tag queries miss (city hall, MPP, puskesmas without amenity, markets as shops)
  await overpass('osm-named.json', `[out:json][timeout:180];
nwr["name"~"Balai Kota Bandung|Pemerintah Kota Bandung|Pemkot Bandung|Mal Pelayanan|Mall Pelayanan|MPP|Puskesmas|Hasan Sadikin|^Pasar ",i]${b};
out tags center;`)
}

/** Wikipedia raw wikitext of the kecamatan list that id.wikipedia.org/wiki/Kota_Bandung transcludes: its table
 *  carries the Kemendagri code per kecamatan (Permendagri 72/2019), which build-bandung.mjs reads for NIK / No. KK
 *  digits. */
export const WIKI_RAW = 'https://id.wikipedia.org/w/index.php?title=Daftar_kecamatan_dan_kelurahan_di_Kota_Bandung&action=raw'
async function wiki() {
  if (!need('wiki-bandung.txt')) return log('wiki: cached')
  const t = await (await fetch(WIKI_RAW, { headers: { 'User-Agent': 'region-pack-builder/1.0' } })).text()
  writeFileSync(out('wiki-bandung.txt'), t)
  log(`wiki: kota article → ${t.length} B`)
}

const steps = { hdx, osm, wiki }
for (const [k, fn] of Object.entries(steps)) if (!ONLY || ONLY === k) await fn()
log('done →', CACHE)
