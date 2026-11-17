# Region packs

One folder per region, all **build output** (do not edit by hand):

| File | Content | Who reads it |
|---|---|---|
| `pack.json` | `RegionPack`, canonical shape | tools, tests, the lab |
| `pack.min.json` | the same pack with compact desa columns (`region/wire.ts`) | the browser, every demo (~16 KB gzip) |
| `geo.json` | `RegionGeo` without desa: kecamatan, rivers, roads, hazards (canonical GeoJSON) | tools, tests, the lab |
| `geo.min.json` | the same geometry as shared arcs (`region/topo.ts`), decodes to exactly `geo.json` | map demos (~14 KB gzip; was 40 as GeoJSON) |
| `desa.json` | desa/kelurahan polygons (`FeatureCollection`, canonical GeoJSON) | tools, tests, the lab |
| `desa.min.json` | the same polygons as shared arcs, decodes to exactly `desa.json` | only when the desa layer is needed (~22 KB gzip; was 57) |

Rebuild them from public geography plus the simulated figures in `tools/region/data/` (the build works offline from
the cache; fetch only when the cache is missing):

```sh
node tools/region/fetch-bojonegoro.mjs     # raw downloads → tools/region/.cache/bojonegoro/ (git-ignored)
node tools/region/build-bojonegoro.mjs     # → packs/bojonegoro/*.json (deterministic), then runs validate.mjs
node tools/region/encode-geo.mjs           # only the .min geometry twins, from geo.json / desa.json (the build runs it)
npx tsx tools/region/validate.mjs          # zod schemas + content rules + wire/topo round trips + gzip budgets
```

`src/demo-kit/region/loader.ts` fetches each file as a static asset (`import.meta.glob` with `?url`, hashed in
`dist/assets/`), so geometry is never bundled as JavaScript. `loadRegionGeo(id)` returns geometry with desa as
before; `loadRegionGeo(id, { desa: false })` skips the desa file, and `loadRegionDesa(id)` fetches it later. Only the
`.min` files are fetched (and emitted to `dist/`); the canonical GeoJSON stays in the repo for tools and review.

Geometry wire form (`*.min.json`, encoder `tools/region/lib/topo.mjs`, decoder `src/demo-kit/region/topo.ts`): borders
shared by two kecamatan/desa are stored once as an arc (TopoJSON style), coordinates are integers on the 1e-4° grid
the canonical files already use, delta + zig-zag coded 5 bits per character, properties as columns. It is lossless:
validate.mjs fails unless every `.min` file decodes to a deep-equal copy of its canonical file, so the map draws
exactly the same shapes at every zoom.

Packs are validated at build time; the loader zod-parses only in dev, so zod is not loaded for a pack in production.

## bojonegoro: Kabupaten Bojonegoro, Jawa Timur

| Layer | Source | Licence | Year |
|---|---|---|---|
| Kecamatan (28) + desa/kelurahan (430) boundaries | [HDX COD-AB Indonesia](https://data.humdata.org/dataset/cod-ab-idn) (BPS / OCHA ROAP), admin3 + admin4. The script streams only those two entries out of the remote ZIP with HTTP Range requests. | CC BY-IGO | 2020 (valid_on) |
| Kelurahan status (11, Kec. Bojonegoro) | id.wikipedia.org/wiki/Bojonegoro,_Bojonegoro | CC BY-SA (facts) | 2026 |
| Kemendagri (Dukcapil) code per kecamatan (`kecamatan[].kemendagri`, e.g. Kalitidu `35.22.16`; used for NIK / No. KK digits, not the BPS `code`) | id.wikipedia.org/wiki/Kabupaten_Bojonegoro (table citing Permendagri 72/2019), spot-checked in the build | CC BY-SA (facts) | 2026 |
| Population per kecamatan, total population, households (KK holders), land area, max altitude per kecamatan, economic sector shares | **Simulated figures** in `tools/region/data/sim-bojonegoro.mjs` (*angka simulasi berskala realistis*): populations rounded to 100 per kecamatan / 1,000 in total, households to 1,000, area to whole km², altitude to 5 m, sector shares to whole percent summing to 100. Labelled in the pack and the UI as *"Angka simulasi untuk demo, dibulatkan dari skala data publik; bukan statistik resmi"*; skala mengacu ke publikasi BPS Kab. Bojonegoro (dikutip, dibulatkan). | GAMADA simulation, not official statistics | 2026 (stands for 2025) |
| Rivers, reservoirs, main roads, markets, landmarks | OpenStreetMap via the Overpass API | ODbL 1.0, © OpenStreetMap contributors | 2026 |
| Staple base prices, shown as **harga dasar simulasi** | **Simulated** in `tools/region/data/sim-bojonegoro.mjs`: plausible consumer prices for a Javanese regency in 2026, chosen by GAMADA and rounded to Rp 50/100. The world simulation adds market offsets and daily noise on top. Not official prices and not market observations. | GAMADA simulation | 2026 |
| Flood zone + `riskFlood` / `riskLandslide` | **Derived by `build-bojonegoro.mjs`**: distance to the Bengawan Solo × a low-lying factor (simulated max altitude per kecamatan). This is a simulated risk zone, **not an official BNPB map**. | Derived from the sources above | 2026 |
| `opd`, `services`, `languages.samples`, `mainSector` | Editorial content in `tools/region/content/bojonegoro.mjs`: common nomenclature, a *general summary* of national requirements, and fictional Basa Jawa complaints | GAMADA editorial | — |

Notes
- Owner decision 2026-11-17: every demo is a simulation that shows what the AI can do, so statistics and prices
  only have to be relevant, not real. Real geography and names stay real: HDX COD-AB boundaries (CC BY-IGO),
  OSM features (ODbL) and the Kemendagri kecamatan codes (needed for specimen NIK / No. KK digits).
- The simulated kecamatan populations are rounded one by one, so their sum (1,368,200) differs from the rounded
  total (1,368,000) by 200 people. `validate.mjs` allows 0.5 %.
- `stats.households` stands for family-card (KK) holders.
- `validate.mjs` fails when the stats, economy or prices sources are not labelled *simulasi*.
- Geometry is simplified with a topology-aware Douglas-Peucker (shared kecamatan/desa borders are simplified once
  and re-used, so neighbours stay gap-free), then quantised to 4 decimals (≈ 11 m). Rounding maps equal vertices
  to equal vertices, so shared borders stay identical (validate: same count of shared edges as before).
- Markets: OSM sometimes maps one pasar twice (node + area). Markets closer than 150 m are merged, keeping the
  more specific name ("Pasar Tradisional Gayam" over "Pasar Gayam", "Pasar Kota Bojonegoro" over "Pasar
  Bojonegoro"); names typed in all caps are title-cased.
- TODO: `economy.umkmCount` is left empty because no readable public source was found.
- OSM gaps: few tributaries are named inside the kabupaten. Unnamed streams are shipped as one `sungai-kecil`
  feature, and no Mal Pelayanan Publik node exists in OSM, so the pack has no `mpp` landmark.
