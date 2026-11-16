# Region packs

One folder per region: `pack.json` (`RegionPack`, every demo) and `geo.json` (`RegionGeo`, map demos only).
Both are **build output**. Do not edit them by hand. Rebuild them from public data:

```sh
node tools/region/fetch-bojonegoro.mjs     # raw downloads → tools/region/.cache/bojonegoro/ (git-ignored)
node tools/region/build-bojonegoro.mjs     # → packs/bojonegoro/{pack,geo}.json (deterministic)
npx tsx tools/region/validate.mjs          # zod schemas from region/types.ts + content rules
```

`src/demo-kit/region/loader.ts` lazy-loads each file as its own chunk and zod-parses it once.

## bojonegoro: Kabupaten Bojonegoro, Jawa Timur

| Layer | Source | Licence | Year |
|---|---|---|---|
| Kecamatan (28) + desa/kelurahan (430) boundaries | [HDX COD-AB Indonesia](https://data.humdata.org/dataset/cod-ab-idn) (BPS / OCHA ROAP), admin3 + admin4. The script streams only those two entries out of the remote ZIP with HTTP Range requests. | CC BY-IGO | 2020 (valid_on) |
| Kelurahan status (11, Kec. Bojonegoro) | id.wikipedia.org/wiki/Bojonegoro,_Bojonegoro | CC BY-SA (facts) | 2026 |
| Population per kecamatan (2025), area, altitude, KK holders, GRDP distribution | [BPS Kabupaten Bojonegoro, *Kabupaten Bojonegoro Dalam Angka 2026*](https://bojonegorokab.bps.go.id/id/publication/2026/02/27/2c966ce987c74364e80b2bad/kabupaten-bojonegoro-dalam-angka-2026.html), Tabel 1.1.1, 1.1.2, 3.1.1, 3.1.2, 12.3 | BPS terms: free use with attribution | 2026 (data 2025) |
| Rivers, reservoirs, main roads, markets, landmarks | OpenStreetMap via the Overpass API | ODbL 1.0, © OpenStreetMap contributors | 2026 |
| Staple base prices | [Panel Harga Pangan, Badan Pangan Nasional](https://panelharga.badanpangan.go.id/) (consumer level; Kab. Bojonegoro where reported, otherwise the Jawa Timur average) | Public information, no explicit open licence | 2026 |
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
  and re-used, so neighbours stay gap-free) and rounded to 5 decimals.
- TODO: `economy.umkmCount` is left empty because no readable public source was found.
- OSM gaps: few tributaries are named inside the kabupaten. Unnamed streams are shipped as one `sungai-kecil`
  feature, and no Mal Pelayanan Publik node exists in OSM, so the pack has no `mpp` landmark.
