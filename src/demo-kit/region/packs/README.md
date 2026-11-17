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

Rebuild them from public data (the build works offline from the cache; fetch only when the cache is missing):

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
| Population per kecamatan (2025), area, altitude, KK holders, GRDP distribution | [BPS Kabupaten Bojonegoro, *Kabupaten Bojonegoro Dalam Angka 2026*](https://bojonegorokab.bps.go.id/id/publication/2026/02/27/2c966ce987c74364e80b2bad/kabupaten-bojonegoro-dalam-angka-2026.html), Tabel 1.1.1, 1.1.2, 3.1.1, 3.1.2, 12.3 | BPS notice (p. 3 of the PDF): may be cited with attribution; *"Dilarang mereproduksi dan/atau menggandakan sebagian atau seluruh isi buku ini untuk tujuan komersial tanpa izin tertulis dari Badan Pusat Statistik Kabupaten Bojonegoro."* GAMADA cites single figures only. **Owner question:** ask BPS Bojonegoro for written permission, or keep citing single figures. | 2026 (data 2025) |
| Rivers, reservoirs, main roads, markets, landmarks | OpenStreetMap via the Overpass API | ODbL 1.0, © OpenStreetMap contributors | 2026 |
| Staple base prices, shown as **harga dasar simulasi** | Reference: [Panel Harga Pangan, Badan Pangan Nasional](https://panelharga.badanpangan.go.id/) (consumer level; Kab. Bojonegoro where reported, otherwise the Jawa Timur average) | *Acuan publik, lisensi menunggu konfirmasi pemilik.* **Owner question:** confirm Panel Harga may be used as the reference; if not, replace them with purely simulated base prices. | 2026 |
| Flood zone + `riskFlood` / `riskLandslide` | **Derived by `build-bojonegoro.mjs`**: distance to the Bengawan Solo × a low-lying factor (BPS altitude). This is a simulated risk zone, **not an official BNPB map**. | Derived from the sources above | 2026 |
| `opd`, `services`, `languages.samples`, `mainSector` | Editorial content in `tools/region/content/bojonegoro.mjs`: common nomenclature, a *general summary* of national requirements, and fictional Basa Jawa complaints | GAMADA editorial | — |

Notes
- The BPS PDF has outlined glyphs, so there is no extractable text. The figures were transcribed into
  `tools/region/data/bps-bojonegoro-dda2026.mjs` by reading the rendered pages. The build cross-checks area and
  population against the Wikipedia table that cites the same publication, and fails on any mismatch.
- Population per kecamatan is published in thousands (2 decimals), so their sum differs from the published
  total (1.367,98 thousand) by about 40 people.
- `stats.households` is the number of family-card (KK) holders (Disdukcapil). BPS does not publish a household
  count in this edition.
- Geometry is simplified with a topology-aware Douglas-Peucker (shared kecamatan/desa borders are simplified once
  and re-used, so neighbours stay gap-free), then quantised to 4 decimals (≈ 11 m). Rounding maps equal vertices
  to equal vertices, so shared borders stay identical (validate: same count of shared edges as before).
- Markets: OSM sometimes maps one pasar twice (node + area). Markets closer than 150 m are merged, keeping the
  more specific name ("Pasar Tradisional Gayam" over "Pasar Gayam", "Pasar Kota Bojonegoro" over "Pasar
  Bojonegoro"); names typed in all caps are title-cased.
- TODO: `economy.umkmCount` is left empty because no readable public source was found.
- OSM gaps: few tributaries are named inside the kabupaten. Unnamed streams are shipped as one `sungai-kecil`
  feature, and no Mal Pelayanan Publik node exists in OSM, so the pack has no `mpp` landmark.
