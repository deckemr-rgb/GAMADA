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

## bandung: Kota Bandung, Jawa Barat

| Layer | Source | Licence | Year |
|---|---|---|---|
| Kecamatan (30) + kelurahan (151) boundaries | [HDX COD-AB Indonesia](https://data.humdata.org/dataset/cod-ab-idn) (BPS / OCHA ROAP), admin3 + admin4, ADM2 `ID3273`, streamed with HTTP Range requests from the same ZIP as Bojonegoro. HDX (valid_on 2020) and Wikipedia agree on 30 kecamatan / 151 kelurahan; HDX spelling `Ujung Berung` is shipped as `Ujungberung`. | CC BY-IGO | 2020 (valid_on) |
| Kemendagri (Dukcapil) code per kecamatan (`kecamatan[].kemendagri`, e.g. Sukasari `32.73.01`, Sumur Bandung `32.73.19`; NIK / No. KK digits) | id.wikipedia.org/wiki/Daftar_kecamatan_dan_kelurahan_di_Kota_Bandung (the table transcluded into id.wikipedia.org/wiki/Kota_Bandung, citing Permendagri 72/2019), spot-checked in the build | CC BY-SA (facts) | 2026 |
| Population per kecamatan, total population, households (KK holders), land area, max altitude per kecamatan, economic sector shares | **Simulated figures** in `tools/region/data/sim-bandung.mjs` (*angka simulasi berskala realistis*, rounded like Bojonegoro); skala mengacu ke publikasi BPS Kota Bandung (dikutip, dibulatkan). | GAMADA simulation, not official statistics | 2026 (stands for 2025) |
| Rivers, main roads (tol/trunk/primary/secondary), markets, landmarks | OpenStreetMap via the Overpass API. OSM writes Sundanese river names split (`Ci Kapundung`); the pack writes `Cikapundung`. | ODbL 1.0, © OpenStreetMap contributors | 2026 |
| Staple base prices, shown as **harga dasar simulasi** | **Simulated** in `tools/region/data/sim-bandung.mjs`: plausible 2026 prices for a large West Java city, rounded to Rp 50/100. Not official prices. | GAMADA simulation | 2026 |
| Flood zone + `riskFlood`, landslide zone + `riskLandslide` | **Derived by `build-bandung.mjs`**: flood = distance to the Cikapundung (other named rivers at weight 0.55, for *banjir cileuncang*) × a low-lying factor from the simulated max altitude; landslide = simulated altitude (northern slopes). Simulated risk zones, **not an official BNPB map**. | Derived from the sources above | 2026 |
| `opd`, `services`, `languages.samples`, `mainSector` | Editorial content in `tools/region/content/bandung.mjs`: common nomenclature (same OPD/service ids as Bojonegoro), a *general summary* of national requirements, and **contoh** Basa Sunda complaints and greetings written by the GAMADA team with ID + EN, not reviewed by a native speaker | GAMADA editorial | — |

Notes
- Build: `node tools/region/fetch-bandung.mjs && node tools/region/build-bandung.mjs` (both take `REGION_CACHE=<dir>`
  to move the raw cache; the fetch streams HDX admin3 + admin4, about 5 minutes).
- A kota has no desa: all 151 units are `kind: 'kelurahan'`.
- Markets: only OSM `amenity=marketplace` named "Pasar …" (bus stops named after a pasar are not markets, so Pasar
  Kosambi is absent). Speciality markets (books, flowers, second-hand clothes, trade centres, modern markets) are left
  out because the demos use markets for staple prices. "Cicadas market" (English name in OSM) is shipped as "Pasar
  Cicadas". Markets closer than 150 m are merged, as for Bojonegoro.
- Landmarks are samples: Balai Kota, kantor kecamatan found in OSM (14), RSUP Dr. Hasan Sadikin, RSUD Bandung Kiwari
  and up to 6 more hospitals, one puskesmas and one SMP/SMA/SMK negeri per kecamatan (max. 14). The one evacuation
  point is an unnamed OSM `emergency=assembly_point` in Lengkong, named after its kecamatan.
- No Mal Pelayanan Publik in OSM, so no service uses the `mpp` channel. No dam or weir inside the city (Bendung
  Bantar Awi lies outside the boundary), so `scenario.damLandmarkId` is empty and the hoax uses the no-dam variant.
- Rivers need at least 3 km inside the city: the Cinambo (0.7 km inside) is not listed but still feeds the flood score.
- Scenario (derived, printed by the build): river Cikapundung; flood kecamatan Bandung Kidul, Regol, Lengkong (the
  Cikapundung runs through each; derived riskFlood ≥ 0.25); shop market Pasar Kordon (Bandung Kidul).
- `hazards.landslide` is filled (Bojonegoro has none); Siaga Wilayah draws landslide as a kecamatan choropleth.
- TODO: `economy.umkmCount` left empty, as for Bojonegoro.

## padang: Kota Padang, Sumatera Barat

| Layer | Source | Licence | Year |
|---|---|---|---|
| Kecamatan (11) + kelurahan (104) boundaries | [HDX COD-AB Indonesia](https://data.humdata.org/dataset/cod-ab-idn) (BPS / OCHA ROAP), admin3 + admin4, ADM2 `ID1371`, streamed out of the same remote ZIP as Bojonegoro with HTTP Range requests. Small islands are kept; rings under 0.02 km² are dropped by the simplification. | CC BY-IGO | 2020 (valid_on) |
| Kemendagri (Dukcapil) code per kecamatan (`kecamatan[].kemendagri`, e.g. Kuranji `13.71.09`, Koto Tangah `13.71.11`; used for NIK / No. KK digits, not the BPS `code`) | [id.wikipedia.org/wiki/Daftar_kecamatan_dan_kelurahan_di_Kota_Padang](https://id.wikipedia.org/wiki/Daftar_kecamatan_dan_kelurahan_di_Kota_Padang) (table citing Permendagri 72/2019), spot-checked in the build | CC BY-SA (facts) | 2026 |
| Kelurahan names (cross-check only) | HDX admin4 names (kept); the same Wikipedia list is used only to print spelling differences | CC BY-IGO / CC BY-SA | 2026 |
| Population per kecamatan, total population, households (KK holders), land area, max altitude per kecamatan, simulated terrain (coastal plain + rise inland), economic sector shares | **Simulated figures** in `tools/region/data/sim-padang.mjs` (*angka simulasi berskala realistis*), rounded like Bojonegoro; skala mengacu ke publikasi BPS Kota Padang (dikutip, dibulatkan) | GAMADA simulation, not official statistics | 2026 (stands for 2025) |
| Rivers, Banjir Kanal, main roads, markets, landmarks (Balai Kota, Pelabuhan Teluk Bayur, Bendung Batang Kuranji, RS, puskesmas, kantor kecamatan, one SMP/SMA/SMK negeri per kecamatan) | OpenStreetMap via the Overpass API | ODbL 1.0, © OpenStreetMap contributors | 2026 |
| Staple base prices (beras, cabai merah keriting, cabai rawit, bawang merah, ikan tongkol, telur, daging ayam, minyak goreng, gula pasir, kelapa), shown as **harga dasar simulasi** | **Simulated** in `tools/region/data/sim-padang.mjs`, rounded to Rp 50/100. Not official prices. | GAMADA simulation | 2026 |
| Flood zone + `riskFlood` / `riskLandslide` | **Derived by `build-padang.mjs`**: distance to Batang Kuranji and Batang Kandis × a low-lying factor from the simulated terrain; landslide index from the simulated max altitude. A simulated risk zone, **not an official BNPB map**. **No tsunami layer** (owner decision 2026-11-19). | Derived from the sources above | 2026 |
| `opd`, `services`, `languages.samples`, `mainSector` | Editorial content in `tools/region/content/padang.mjs`: kota nomenclature (incl. DKP), the national requirements summary with kelurahan wording plus a Kusuka card for fishers, and fictional Baso Minang complaints and greetings, labelled *contoh*, not yet checked by a native speaker | GAMADA editorial | — |

Notes
- Rebuild: `node tools/region/fetch-padang.mjs && node tools/region/build-padang.mjs` (the cache folder can be
  changed with `REGION_CACHE=<dir>`).
- The flood zone uses a simulated terrain model in `sim-padang.mjs`, not a DEM: a coastal plain about 4.5 km wide
  rising inland from a reference shoreline. A kecamatan's `riskFlood` is the mean of its top 40 % of grid cells, so
  large kecamatan that run up into the hills are not diluted.
- Batang Air Dingin has no named way in OSM inside the city, so the second flood river is Batang Kandis (same
  northern plain, Koto Tangah).
- No Mal Pelayanan Publik and no Muaro harbour are mapped in OSM, so the pack has no `mpp` or Muaro landmark, and
  services that would use the `mpp` channel use `dinas`.
- `damLandmarkId` is "Bendung Batang Kuranji" (OSM `waterway=weir`, named), so the dam-hoax path runs on Padang.
- Markets: Pasar Siteba is not named in OSM; the shop scenario uses Pasar Nanggalo, the market in a flood kecamatan
  nearest the scenario river.
- Scenario: river Batang Kuranji; flood kecamatan Nanggalo, Padang Utara, Koto Tangah, Kuranji; shop market Pasar
  Nanggalo.
- `hazards.landslide` geometry is not built (the landslide view is a choropleth from `riskLandslide`).
- Landmarks keep real OSM hospital names, as for Bojonegoro (public facilities).
- HDX vs Wikipedia kelurahan spelling (HDX kept): Batang Kabung / Batang Kabung Ganting; Batuang Taba, Pagambiran
  Ampulu, Tanjuang Aur Nan XX / Batung Taba, Pagambiran Ampalu, Tanjung Aur Nan XX; Kampung Lapai Baru / Kampung
  Lapai; Tabiang Banda Gadang / Tabing Banda Gadang; Bukik Gado Gado / Bukit Gado-Gado; Taluak Bayua / Teluk Bayur;
  Kubu Parak Karakah / Kubu Dalam Parak Karakah; Binuang Kampung Dalam / Binuang Kampuang Dalam; Kapala Koto /
  Kapalo Koto.
- TODO: `economy.umkmCount` is left empty, as for Bojonegoro.

## Adding a fourth region

Copy the four scripts of an existing pack (`fetch-<id>.mjs`, `build-<id>.mjs`, `data/sim-<id>.mjs`,
`content/<id>.mjs`), change the ADM2 code, the Kemendagri table and the editorial content, build, run
`npx tsx tools/region/validate.mjs <id>`, add a section here, and add one entry (`id`, `name`, `shortName`, `type`,
`province`) to `REGIONS` in `src/demo-kit/region/loader.ts`. Pack files are fetched lazily, so only that entry (a few
bytes) reaches a demo's first load.
