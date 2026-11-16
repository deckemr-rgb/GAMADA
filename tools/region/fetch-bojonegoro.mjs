#!/usr/bin/env node
/**
 * fetch-bojonegoro.mjs — download the PUBLIC raw data for the Bojonegoro region pack into
 * tools/region/.cache/bojonegoro/ (git-ignored). Re-runnable; skips files already present
 * unless --force. Then run build-bojonegoro.mjs to produce pack.json + geo.json.
 *
 *   node tools/region/fetch-bojonegoro.mjs [--force] [--only=hdx|osm|prices|bps]
 *
 * Sources (see src/demo-kit/region/packs/README.md for licences):
 *   - HDX COD-AB Indonesia (BPS / OCHA, CC BY-IGO): admin3 (kecamatan) + admin4 (desa/kelurahan) polygons,
 *     read straight out of the remote ZIP with HTTP Range requests (only the needed entries are streamed).
 *   - OpenStreetMap via Overpass API (ODbL): rivers, roads, markets, landmarks.
 *   - Panel Harga Badan Pangan (prices) and BPS Kabupaten Bojonegoro (statistics): best effort.
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve as resolveZip, listEntries, streamEntry } from './lib/zip-range.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const CACHE = join(HERE, '.cache', 'bojonegoro')
const args = new Set(process.argv.slice(2))
const FORCE = args.has('--force')
const ONLY = [...args].find((a) => a.startsWith('--only='))?.slice(7)

export const HDX_URL =
  'https://data.humdata.org/dataset/84a1d98a-790b-4d66-9d14-bbfa48500802/resource/e1421da4-8f48-47d2-ac49-79ff5bfa4d24/download/idn_admin_boundaries.geojson.zip'
/** BPS code of Kabupaten Bojonegoro (Jawa Timur 35, Bojonegoro 22) */
const ADM2_PCODE = 'ID3522'
export const OVERPASS = 'https://overpass-api.de/api/interpreter'
/** [south, west, north, east] with a small margin around the kabupaten */
const BBOX = '-7.48,111.40,-6.92,112.18'

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
  way["natural"="water"]["water"~"reservoir|lake"]${b};
  relation["natural"="water"]["water"~"reservoir|lake"]${b};
  way["natural"="water"]["name"~"^(Waduk|Bendungan)"]${b};
  relation["natural"="water"]["name"~"^(Waduk|Bendungan)"]${b};
  way["landuse"="reservoir"]${b};
);
out geom;`)
  await overpass('osm-roads.json', `[out:json][timeout:180];
way["highway"~"^(trunk|primary|secondary)$"]${b};
out geom;`)
  await overpass('osm-pois.json', `[out:json][timeout:180];
(
  nwr["amenity"="marketplace"]${b};
  nwr["shop"="mall"]${b};
  nwr["amenity"="townhall"]${b};
  nwr["office"="government"]${b};
  nwr["amenity"="hospital"]${b};
  nwr["amenity"="clinic"]${b};
  nwr["healthcare"="centre"]${b};
  nwr["amenity"="school"]${b};
  nwr["waterway"="dam"]${b};
  nwr["waterway"="weir"]${b};
  nwr["man_made"="dam"]${b};
  nwr["amenity"="police"]${b};
  nwr["railway"="station"]${b};
);
out tags center;`)
  // Named anchors that the generic tag queries miss (dam bodies without water=*, office buildings, MPP …)
  await overpass('osm-named.json', `[out:json][timeout:180];
nwr["name"~"Pacal|Gongseng|Pemkab Bojonegoro|Pemerintah Kabupaten Bojonegoro|Alun-Alun Bojonegoro|Mal Pelayanan|Mall Pelayanan|MPP|Dukcapil|Kependudukan|Puskesmas|Sosodoro|Terminal Rajekwesi"]${b};
out tags center;`)
}

/** Panel Harga Badan Pangan — public JSON behind panelharga.badanpangan.go.id (consumer level = 3).
 *  Kab. Bojonegoro = city_id 247 in province_id 15 (Jawa Timur); province-level answer is the fallback
 *  for commodities the kabupaten enumerator did not report that day. */
export const PANGAN_API = 'https://api-panelhargav2.badanpangan.go.id/api/front/harga-pangan-informasi'
async function prices() {
  if (!need('prices.json')) return log('prices: cached')
  const urls = {
    city: `${PANGAN_API}?province_id=15&city_id=247&level_harga_id=3`,
    province: `${PANGAN_API}?province_id=15&city_id=&level_harga_id=3`,
  }
  const got = { fetched: new Date().toISOString() }
  for (const [k, u] of Object.entries(urls)) {
    const res = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': 'region-pack-builder/1.0' } })
    const j = await res.json()
    got[k] = { url: u, status: res.status, data: j.data ?? null }
    log(`prices: ${k} → HTTP ${res.status}, ${(j.data ?? []).length} rows`)
  }
  writeFileSync(out('prices.json'), JSON.stringify(got))
}

/** BPS "Kabupaten Bojonegoro Dalam Angka 2026" (Katalog 1102001.3522). The PDF's text is outlined (vector
 *  glyphs), so the figures the pack uses were transcribed by hand into data/bps-bojonegoro-dda2026.mjs;
 *  this step keeps the PDF for audit and fetches the Wikipedia table (which cites the same publication)
 *  as a machine-readable cross-check that build-bojonegoro.mjs verifies against the transcription. */
export const BPS_DDA_PAGE =
  'https://bojonegorokab.bps.go.id/id/publication/2026/02/27/2c966ce987c74364e80b2bad/kabupaten-bojonegoro-dalam-angka-2026.html'
export const WIKI_RAW = 'https://en.wikipedia.org/w/index.php?title=Bojonegoro_Regency&action=raw'
async function bps() {
  if (need('bps-dda2026.pdf')) {
    const html = await (await fetch(BPS_DDA_PAGE, { headers: { 'User-Agent': 'Mozilla/5.0 region-pack-builder/1.0' } })).text()
    const m = html.match(/https:\/\/webapi\.bps\.go\.id\/download\.php\?f=[A-Za-z0-9_=-]+/)
    if (!m) log('bps: no download link on the publication page (layout changed?) — skip PDF')
    else {
      const res = await fetch(m[0], { headers: { 'User-Agent': 'Mozilla/5.0 region-pack-builder/1.0' } })
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(out('bps-dda2026.pdf'), buf)
      log(`bps: DDA 2026 PDF → ${(buf.length / 1e6).toFixed(1)} MB`)
    }
  } else log('bps: PDF cached')
  if (need('wiki-bojonegoro.txt')) {
    const t = await (await fetch(WIKI_RAW, { headers: { 'User-Agent': 'region-pack-builder/1.0' } })).text()
    writeFileSync(out('wiki-bojonegoro.txt'), t)
    log(`bps: wikipedia cross-check table → ${t.length} B`)
  } else log('bps: wikipedia cached')
}

const steps = { hdx, osm, prices, bps }
for (const [k, fn] of Object.entries(steps)) if (!ONLY || ONLY === k) await fn()
log('done →', CACHE)
