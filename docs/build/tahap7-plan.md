# Tahap 7 · Region packs Bandung + Padang, polish pass, final proof: plan

Written 2026-11-19 by the Tahap 7 planner, while Tahap 4 is still being built in `src/`. Sources read: spec
`docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` §2, §7, §14, §15, §16 (row 7), §17; `src/demo-kit/region/` (types, loader,
`packs/README.md`, `packs/bojonegoro/`); `tools/region/*`; `src/demo-kit/CONTRACTS.md`;
`docs/shots/demo/tahap-3/INDEX.md`; plans `tahap3-plan.md` §0 + §7, `tahap4-plan.md` §0 + §7,
`tahap5-plan.md` §6–7, `tahap6-plan.md` §6–8; owner decisions in memory (regions = **Kab. Bojonegoro** (main, tour),
**Kota Bandung**, **Kota Padang**; data policy 2026-11-17: simulated is fine when relevant, real only with an open
licence).

**Shape (owner speed preference):** Wave A in parallel (2 pack builders + kit owner + measurer) → Wave B in parallel
(3 polish owners by file area) → integration → gate → final screenshots → final report. **One round.** No 4-lens
review, no wow re-score loop (§7 Q4). Spec §16 row 7 says "loop until 2 clean rounds"; this plan replaces that with
one fix pass plus the automated checks in §6, unless the owner answers Q4 differently.

Where this file and an older plan differ, this file wins for Tahap 7.

---

## 0 · Rules for every Tahap 7 agent

### 0.1 Binding rules (unchanged from Tahap 2–6)
- **Data.** Real only with an open licence: place names, HDX COD-AB boundaries, OSM features, Kemendagri codes.
  Every real dataset in a pack gets a `sources[]` entry (layer, name, url, licence, year) and a row in
  `packs/README.md`. Everything else (population, households, area, sector shares, prices, risk scores, gauge
  readings, hazard zones) is **simulated** and labelled *simulasi* (validate.mjs enforces this for stats, economy and
  prices). No official BNPB/InaRISK hazard map, no BPS table copied verbatim.
- **People.** People, companies, media, accounts and vendors are fictional. Officials are named by title only ("Wali
  Kota", "Camat Coblong", "Kepala BPBD"). Generic GAMADA emblem, never a city's coat of arms.
- **ID + EN** for every visible string. Regional-language text (Basa Sunda, Baso Minang) appears only in complaint
  templates, greetings and scenario synonyms, always with ID + EN translations.
- **Batas ukuran.** ≤ 180 KB gzip -9 per demo first load (JS + JSON beyond home, MapLibre excluded; internal target
  ≤ 175 in ID and EN). Home initial JS ≤ 253.6 KB. **A new pack must not raise any demo's first load:** packs are
  fetched lazily by `loader.ts` (`import.meta.glob` `?url`), so only the selected region's `pack.min.json` is fetched.
  Adding entries to `REGIONS` costs bytes in the first load; keep it ≤ 0.3 KB and measure it.
- **No dead controls.** Once there are 3 packs the region label in the TopBar becomes a real picker. Every option
  works in every demo. A control that does nothing is not rendered.
- **Mobile + a11y.** Hit targets 44 px; phones 360–430 px; `prefers-reduced-motion`, `?off=` and `?degrade` honoured;
  `aria-live="polite"` for new events and AI answers.
- **Off limits without a reason in your report:** files outside your ownership row (§5). Never `import()` a kit
  barrel dynamically (CONTRACTS, Tahap 3 notes). `useEffect` bodies with `scrollIntoView` use a block body.
- No push, no deploy. Small commits per agent, then the integrator's `tahap7:` commit.

### 0.2 Self-check before every handover (paste the ticked list in your report)
- [ ] `npm run typecheck` and `npm run region:validate` pass (pack builders: `npx tsx tools/region/validate.mjs <id>`).
- [ ] Your e2e specs pass locally against `vite preview`.
- [ ] No console errors in the demos you touched, in ID and EN, at 1440 and 390.
- [ ] Size table for the demos you touched (ID + EN) is no higher than at the start of Tahap 7.
- [ ] Every new string has ID + EN; no new real person or company name; numbers that could pass for real say *simulasi*.
- [ ] No Bojonegoro-only text in the files you own (grep list in §1.6) unless it is the Bojonegoro pack itself.
- [ ] Region switch Bojonegoro → Bandung → Padang → Bojonegoro in the demos you own: no crash, names follow the pack.

---

## 1 · Region packs: Kota Bandung and Kota Padang

### 1.1 What a pack must contain (spec §7 + `region/types.ts` + the Bojonegoro pack)
Six build outputs per folder `src/demo-kit/region/packs/<id>/`: `pack.json`, `pack.min.json`, `geo.json`,
`geo.min.json`, `desa.json`, `desa.min.json` (see `packs/README.md`). Never edited by hand. They are built by:

| File | Role |
|---|---|
| `tools/region/fetch-<id>.mjs` | raw downloads into `tools/region/.cache/<id>/` (git-ignored): HDX admin3/admin4 via range requests, Overpass, Wikipedia kecamatan table |
| `tools/region/data/sim-<id>.mjs` | simulated figures: population per kecamatan, total, households, area, max altitude, sector shares, base prices |
| `tools/region/content/<id>.mjs` | editorial: `opd`, `services` (≥ 14), `languages.samples` (≥ 4 greetings, ≥ 12 complaint templates, ≥ 3 `banjir`), `mainSector`, `scenario` anchors |
| `tools/region/build-<id>.mjs` | deterministic build → 6 files, runs `encode-geo.mjs` and `validate.mjs <id>` |

Copy the Bojonegoro scripts and change constants (ADM2 pcode, bbox, names). **Do not edit `tools/region/lib/*`,
`encode-geo.mjs` or `validate.mjs`** (shared, owned by the integrator). If one of them really blocks you, say so in
your report with the exact change.

Pack content checklist (validated):
- `id`, `name`, `shortName`, `type: 'kota'`, `province`, `center`, `zoom`, `bbox`.
- `stats` simulated and labelled; `year: 2026`.
- `kecamatan[]`: every kecamatan with `id` (kebab-case of the name), `name`, BPS `code` when in HDX, **`kemendagri`**
  (`32.73.xx` / `13.71.xx`, from Wikipedia citing Permendagri 72/2019; needed for specimen NIK / No. KK digits),
  `population`, `centroid`, `riskFlood`, `riskLandslide`, `mainSector`, `desa[]` (all `kind: 'kelurahan'`: a kota has
  no desa).
- `rivers`, `landmarks` (kinds from `LandmarkKind`), `markets` (real pasar from OSM, merged within 150 m like
  Bojonegoro), `economy` (sectors + ≥ 8 commodities with simulated `basePrice`), `opd`, `services`, `languages`,
  `weather.bmkgAreaCode` (optional, leave empty unless found on an open page), `branding` (`emblem: 'generic'`,
  its own `primaryHue`), `scenario`, `sources`.
- Geometry: kecamatan + kelurahan polygons, rivers, main roads, `hazards.flood`, `hazards.landslide`.
- Gzip budgets (validate.mjs): `pack.min.json` ≤ 16.5 KB, `geo.min.json` ≤ 16, `desa.min.json` ≤ 24. Raise the
  Douglas-Peucker tolerance before anything else if a city file is over.

### 1.2 Kota Bandung (`bandung`), Jawa Barat
- **Admin:** HDX ADM2 pcode `ID3273`; Kemendagri `32.73`. 30 kecamatan (Andir, Antapani, Arcamanik, Astanaanyar,
  Babakan Ciparay, Bandung Kidul, Bandung Kulon, Bandung Wetan, Batununggal, Bojongloa Kaler, Bojongloa Kidul,
  Buahbatu, Cibeunying Kaler, Cibeunying Kidul, Cibiru, Cicendo, Cidadap, Cinambo, Coblong, Gedebage, Kiaracondong,
  Lengkong, Mandalajati, Panyileukan, Rancasari, Regol, Sukajadi, Sukasari, Sumur Bandung, Ujungberung) and
  ≈ 151 kelurahan. If HDX (valid_on 2020) differs from Wikipedia, HDX geometry wins, and the README notes the
  difference.
- **Rivers (OSM):** Cikapundung (scenario river), Citepus, Cidurian, Cinambo, Cipamokolan, Cikapundung Kolot;
  unnamed streams as one `sungai-kecil` feature.
- **Markets (OSM, real names only if OSM has them):** expected Pasar Kosambi, Pasar Baru, Pasar Andir, Pasar
  Ciroyom, Pasar Kiaracondong, Pasar Cicadas, Pasar Palasari, Pasar Sederhana, Pasar Induk Gedebage.
  `shopMarketId`: the OSM market nearest to a flood kecamatan (expected Pasar Kiaracondong or Pasar Cicadas).
- **Landmarks:** kantor (Balai Kota), rs, sekolah, puskesmas, pengungsian (only if OSM tags an evacuation point;
  never invent one). No `bendungan` is expected inside the city: `damLandmarkId` stays empty (see §1.6, hoax).
- **Economy (simulated):** sectors trade, processing industry (garmen/tekstil), accommodation & food, information &
  communication, services, construction; commodities beras, cabai merah keriting, cabai rawit, bawang merah,
  bawang putih, tomat, telur ayam, daging ayam, minyak goreng, gula pasir.
- **Hazard scenario (simulated):** heavy afternoon rain → *banjir cileuncang* (urban runoff) plus the Cikapundung
  rising downstream. Flood zone derived like Bojonegoro (distance to the scenario river × a low-lying factor from the
  simulated altitude: the south is lower than the north). `floodKecamatanIds` = 3–4 kecamatan the geometry places on
  the lower Cikapundung / low south-east (candidates: Bandung Kidul, Batununggal, Regol, Kiaracondong; Gedebage /
  Rancasari if the low-lying factor picks them). The builder prints the derived list and picks from it.
  `riskLandslide` high on the northern slopes (candidates: Cidadap, Coblong, Cibeunying Kaler, Sukasari), derived
  from simulated altitude, labelled simulated.
- **Language:** `regional: ['su']`, `speechCodes: ['su-ID', 'id-ID']` (browser fallback to id-ID). Greetings and
  12+ complaint templates in Basa Sunda (loma register for warga), with ID + EN.
- **OPD / services:** common nomenclature for a kota (Dinas PUPR → "Dinas Sumber Daya Air dan Bina Marga" only if
  the builder is sure; otherwise the generic "Dinas PUPR"), DPMPTSP, Disdukcapil, BPBD, Diskominfo, Dinkes, Dishub,
  DLH, Disdagin, Dinsos, Inspektorat, UKPBJ. ≥ 14 services copied in structure from Bojonegoro (same general national
  requirements), channel `mpp` where the city has one in OSM, else `online`/`dinas`.

### 1.3 Kota Padang (`padang`), Sumatera Barat
- **Admin:** HDX ADM2 pcode `ID1371`; Kemendagri `13.71`. 11 kecamatan (Bungus Teluk Kabung, Koto Tangah, Kuranji,
  Lubuk Begalung, Lubuk Kilangan, Nanggalo, Padang Barat, Padang Selatan, Padang Timur, Padang Utara, Pauh) and
  ≈ 104 kelurahan. Islands inside the city boundary: keep them if HDX has them; they are small after simplification.
- **Rivers (OSM):** Batang Kuranji (scenario river), Batang Arau, Batang Air Dingin, Banjir Kanal, Batang Kandis.
- **Markets (OSM):** expected Pasar Raya Padang, Pasar Alai, Pasar Siteba, Pasar Lubuk Buaya, Pasar Bandar Buat,
  Pasar Tanah Kongsi, Pasar Ulak Karang. `shopMarketId`: the market nearest to the flood kecamatan (expected Pasar
  Siteba or Pasar Alai).
- **Landmarks:** kantor (Balai Kota), pelabuhan (Teluk Bayur, Muaro), rs, sekolah, puskesmas. `damLandmarkId`: the
  weir on Batang Kuranji only if OSM tags it `weir`/`dam` with a name (expected Bendung Gunung Nago); else empty.
- **Economy (simulated):** trade, transport & warehousing (port), accommodation & food, processing, fisheries,
  services; commodities beras, cabai merah keriting, cabai rawit, bawang merah, ikan tongkol, telur ayam, daging
  ayam, minyak goreng, gula pasir, kelapa.
- **Hazard scenario (simulated):** monsoon rain → Batang Kuranji and Batang Air Dingin overflow in the low coastal
  plain. `floodKecamatanIds` derived like Bandung (candidates: Koto Tangah, Kuranji, Nanggalo, Padang Utara).
  `riskLandslide` high on the eastern/southern hills (candidates: Bungus Teluk Kabung, Lubuk Kilangan, Pauh).
  **No tsunami layer** (not in the schema, and a simulated tsunami zone for a real coastal city is too easy to
  mistake for official guidance; §7 Q2).
- **Language:** `regional: ['min']`, `speechCodes: ['id-ID']` (no browser voice for Minang). Greetings and 12+
  templates in Baso Minang with ID + EN.
- **OPD / services:** same rule as Bandung.

### 1.4 Data sources and licences (to be copied into `packs/README.md` by each builder)

| Layer | Source | Licence | Both packs |
|---|---|---|---|
| Kecamatan + kelurahan polygons | HDX COD-AB Indonesia admin3 + admin4 (BPS / OCHA ROAP), same ZIP as Bojonegoro | CC BY-IGO | yes |
| Kemendagri kecamatan codes | id.wikipedia.org `Kota_Bandung` / `Kota_Padang` (tables citing Permendagri 72/2019) | CC BY-SA (facts) | yes |
| Kelurahan names (cross-check only) | HDX admin4 names; Wikipedia per-kecamatan pages only for spelling | CC BY-IGO / CC BY-SA | yes |
| Rivers, roads, markets, landmarks | OpenStreetMap via Overpass API | ODbL 1.0, © OpenStreetMap contributors | yes |
| Stats, sector shares, prices, altitude | `tools/region/data/sim-<id>.mjs`, labelled *angka simulasi* | GAMADA simulation | yes |
| Flood + landslide zones, `riskFlood/riskLandslide` | derived by `build-<id>.mjs` from the layers above | derived, simulated, **not BNPB** | yes |
| OPD, services, regional-language samples | `tools/region/content/<id>.mjs` | GAMADA editorial | yes |

Not used: BNPB InaRISK, BIG/Ina-Geoportal RBI layers, Pemkot open-data portals, BPS tables (licence or terms
unclear, and the owner said not to spend effort on official data). Basemap stays OpenFreeMap; satellite stays the
EOX Sentinel-2 cloudless **2016** mosaic (CC BY 4.0), whose global coverage includes both cities.

### 1.5 Validation
- `npx tsx tools/region/validate.mjs bandung` / `padang`: zod schema, ≥ 12 templates (≥ 3 banjir), ≥ 4 greetings,
  ≥ 14 services, unique ids, `scenario.*` ids exist, round trip `.min` ↔ canonical, gzip budgets, *simulasi* labels.
- Extra checks each builder runs and pastes into the report (no edit of validate.mjs): kecamatan count (30 / 11),
  kelurahan count (≈ 151 / ≈ 104), every kecamatan has `kemendagri` matching `^32\.73\.` / `^13\.71\.`, every market
  and landmark inside the bbox and tagged with a `kecamatanId`, `floodKecamatanIds` touch the scenario river buffer.
- Integrator: adds the two packs to `REGIONS` in `loader.ts`, runs `npm run region:validate` (all three packs),
  and the size table (§6).

### 1.6 Hard-coded Bojonegoro: what must be checked and fixed
Grep at the start of Wave B and again at the gate:
`rg -n "Bojonegoro|Bengawan|Ngujo|Kalitidu|Trucuk|Kanor|Padangan|Gayam|Basa Jawa|Jawa Timur|35\.22|'jv'|kalitidu" src --glob '!src/demo-kit/region/packs/**'`.
Known hits on 2026-11-19 (Tahap 4–6 folders must be added at the start of Wave B):

| File(s) | Hard-coded | Fix (owner) |
|---|---|---|
| `demo-kit/world/seed.ts:387` | prefers kecamatan `'kalitidu'` | use `floodKecamatanIds[0]` only (P3 kit) |
| `demo-kit/world/seed.ts:1106` + `world/scenario-texts.ts` | dam hoax falls back to any `bendungan` | no-dam variant: hoax about "tanggul/pintu air <river>" (P3 kit) |
| `demo-kit/world/sd/gauge.ts` | EN rename assumes "pos X" names | keep; verify Bandung/Padang gauge names read well (P3) |
| `demo-kit/docs/nik.ts` | built-in Bojonegoro table is the default | default from `nikRegions(pack.kecamatan)`; table stays as fallback (P3) |
| `demo-kit/docs/extract.ts:31-33` | `floodKecamatan`, bbox of Bojonegoro | read from the current pack (P3) |
| `demo-kit/i18n/index.ts` | comment only | none |
| `demos/naskah-pintar/{model,scenario,strings}.ts` | sample flood meeting: Bengawan Solo, tanggul Ngujo, Kalitidu, Trucuk, Kanor, Pasar Kota | template the sample from pack: river name, `floodKecamatanIds`, tanggul at the first kelurahan/desa of the first flood kecamatan, `shopMarketId` (P1) |
| `demos/meja-pimpinan/{scenario,strings}.ts` | Kanor, Kalitidu, Trucuk; "Kabupaten" → "Regency" | from pack; "Kota X" → "X City" path already exists, test it (P1) |
| `demos/siaga-wilayah/{scenario,Alerts,AskAi,Broadcast}.tsx` | Bengawan Solo, Trucuk, Kalitidu, `'jv'`, "Basa Jawa" | river + kecamatan from pack; language label from `regionalLanguageName()` (P1) |
| `demos/sapa-warga/*` | 26 `'jv'` scenario synonyms, "Basa Jawa" labels | synonyms keyed by `RegionalLang` with `su` + `min` sets (≥ 8 each); labels from i18n (P1) |
| `demos/radar-isu/{Assistant,scenario,clarify-text,model}.ts` | "Basa Jawa", dam hoax | i18n label; no-dam hoax variant from kit (P1) |
| `demos/pajak-beres/scenario.ts` | "Basa Jawa" synonym label | key by lang (P2) |
| Tahap 4 folders (katalog-lokal, rapor-usaha, indeks-ekonomi, sinyal-pasar, inti) | unknown yet | grep, fix (P2) |
| `content/tour.ts` | `regionId: 'bojonegoro'` | **keep**: the tour is "Satu Hari di Bojonegoro"; `?region=` on `/tur` plays Bandung/Padang without a crash (P4 checks) |
| Site pages / product copy (Tahap 6) | `{region}` placeholders | keep Bojonegoro wording on site pages (deferred, §8) |
| `tests/e2e/tahap2/region-lang.spec.ts` | expects the bar to show a label (one pack) | now a picker: update the assertion (integrator) |

Region switch behaviour (spec §7): switching resets the world to the new region's seed without a full reload, and map
demos "fly" to the new bbox (`flyTo` 1.2 s; instant under reduced motion). The picker lives in the TopBar
(`shell/Picker.tsx` / `TopBar.tsx`), shows the 3 regions with type + province, and writes `?region=`.

---

## 2 · Polish backlog (prioritised, with cut line)

Effort = one agent, focused. Area = owner in §5. **Cut line:** everything marked **Must** and **Should** fits the
≈ 6–8 h budget because it runs in parallel across 4–5 owners; **Could** is done only if an owner finishes early, else
it moves to §8.

| # | Item | Source | Area | Effort | Priority |
|---|---|---|---|---|---|
| 1 | Bandung + Padang packs built, validated, in `REGIONS` | spec §7, §16 row 7 | R1, R2, integrator | 2.5 h each (parallel) | Must |
| 2 | Region picker (3 packs) + world reset + map fly-to; picker test | spec §2.3, §7 | P3 kit | 1 h | Must |
| 3 | De-hardcode Bojonegoro (table §1.6) in kit + 18 demos | §1.6 | P3, P1, P2 | 2 h spread | Must |
| 4 | axe scan of all demos, `/tur`, site pages; fix serious/critical | spec §14; Tahap 3–6 deferrals | M finds, P1–P4 fix | 0.5 h + fixes | Must |
| 5 | INP of the heaviest clicks (list §3.2); fix anything > 200 ms | spec §14; Tahap 2 "never measured" | M finds, owners fix | 1 h + fixes | Must |
| 6 | "Mulai di sini" hotspot overlaps (Toko Autopilot KPI + outlet picker, Pantau Merek rule text, TenderPilot "peluang 45%" + right edge) | tahap-3 INDEX | P3 kit (`ui/Hotspot`) | 45 min | Must |
| 7 | Meja Pimpinan EN first load 175.4 KB (> 175 internal target) | Tahap 2 size | P1 | 30 min | Must |
| 8 | No-crash region + language matrix: 18 demos × 3 regions × ID/EN | spec §15.5 | integrator test | 30 min | Must |
| 9 | Final screenshots + INDEX + final report (§4) | spec §15, §16 | integrator | 1.5 h | Must |
| 10 | Toko Autopilot phone: KPI delta clipped ("vs kemarin ja…"), "Jadwal Shift" tab not visible | tahap-3 INDEX | P2 | 20 min | Should |
| 10b | Tahap 4 shot defects (docs/shots/demo/tahap-4/INDEX.md), number fixes already done in Tahap 5 kit: "Mulai di sini" overlaps in Katalog Lokal, Inti, Sinyal Pasar (→ P3 with item 6); Inti guide step 1 points to a hidden trail for pemilik-toko; Katalog Lokal split proposal omits terpal; Indeks Ekonomi map stuck on "Memuat peta..." in ID; EN plural "1 businesses", mixed-language Rapor Usaha EN, "-6%" vs "-6,0%"; empty areas (Rapor Usaha bank-mitra, Katalog Lokal right pane); phone: Rapor Usaha "Tanya skor" icon-only, Inti tabs cut off. Plus 2 intermittent e2e (Juara Jualan "Tugaskan coaching" click intercepted; Katalog Lokal ?focus= card > 10 s) | tahap-4 INDEX, integrate:t4 | P2 (+P3 hotspot) | 1 h | Should |
| 10c | Tahap 5 tour shot defects (docs/shots/demo/tahap-5/INDEX.md; text fixes already done): product toasts on /tur appear bottom-left over the narration column; Toko Autopilot chat panel opens over the whole window in ch. 11 (keep inside the stage); Rapor Usaha bank cards wrap one word per line in the narrow stage (ch. 14); Sinyal Pasar HARGA / 7 HARI overlap (ch. 17); stage scrolled so the product header is cut (ch. 7, 8, 17, 19); Katalog Lokal match lines over Daftar kebutuhan; Ambil alih from ch. 11 lacks focus= and uses outlet=toko (plan says warung), clock 13.00 vs 13.10; summary screen controls row between CTA and Coba sendiri; /tur not in tools/perf.mjs; per-chapter add-on 106-172 KB (rule <= 12 KB not met; loads only after Mulai tur, accepted as is) | tahap-5 INDEX, integrate:t5 | P4 (+P2 for product layouts) | 1 h | Should |
| 11 | "Kelancaran" (smooth) lows from Tahap 2 wow audit: list transitions that snap, long tasks during autoplay, layout shift on new rows (`flashNewRow`), chart re-mount flashes | Tahap 2 wow | P1 (SD), P2 (UP/PD) | 1.5 h | Should |
| 12 | Sitemap entries for `/ekosistem`, 3 eco pages, 17 `/produk/:slug`, `/tur`, `/lab` + JSON-LD (`Organization` on home, `Product`/`SoftwareApplication` on product pages, no price, no rating) | tahap6 §8 | P4 | 40 min | Should |
| 13 | Pixel-diff baseline: Tahap 6 shots → `docs/shots/demo/baseline/`; `tools/shot-diff.mjs` (pixelmatch, devDep, §7 Q3) reports % changed per page; judgement, not a gate | spec §15 visual; tahap6 §8 | integrator | 45 min | Should |
| 14 | Presenter notes window (BroadcastChannel; `?notes=1` second window follows chapter + timer) | tahap5 P4 | P4 | 1 h | Could |
| 15 | Kit size: UP stub floor 126.5 KB vs plan 112; `Gauge`/`Donut` pull d3-shape (9–12 KB) into first loads | CONTRACTS Tahap 3 | P3 | 1.5 h | Could (only for a demo > 175) |
| 16 | Waveform markers at the same time stack (Juara Jualan / Naskah Pintar) | CONTRACTS Tahap 3 | P3 | 20 min | Could |
| 17 | `LineChart` forecast band (now `AreaChart` workaround) | CONTRACTS Tahap 3 | P3 | 30 min | Could |
| 18 | OGL particle background behind the constellation (tier high only, off under reduced motion, home JS unchanged) | tahap6 §8 | P4 | 1.5 h | Could |
| 19 | Light single-pass wow audit (4 personas, 6 demos + tour, no re-score) | spec §15, §16 | integrator | 1 h | Could (Q4) |
| 20 | Full `/karya` redesign | tahap6 §8 | — | 4 h+ | **Won't** (§8) |
| 21 | Region switch on site pages, Live mode with a real key, Pajak Beres own CSV upload | tahap3/6 §7 | — | — | **Won't** (§8) |

---

## 3 · Accessibility and INP measurement

### 3.1 axe
- `axe-core` is **not installed**. Proposal (§7 Q3): add `@axe-core/playwright` as a **devDependency** (test-only,
  never in a bundle; home and demo sizes unchanged). Fallback if the owner says no: the manual checklist from
  tahap6 §0.6 (names, roles, contrast spot checks with DevTools) on 6 pages only.
- `tests/e2e/tahap7/a11y.spec.ts` (measurer M): `AxeBuilder` with tags `wcag2a, wcag2aa, wcag21aa`, report all, **fail
  on serious + critical**. Pages: every `/demo/<slug>` (default role, 1440 + 390), `/tur` opener + chapter 7 + summary,
  `/`, `/ekosistem`, `/ekosistem/satu-daerah`, `/produk/sapa-warga`, `/lab`, plus one demo per eco in EN. Run with
  `?off=preloader` and after the first world event lands (alive state).
- Known exclusions (documented, not silenced globally): MapLibre canvas (`.maplibregl-canvas`), decorative SVG with
  `aria-hidden`. `color-contrast` inside device frames is checked; a simulated "screen glare" or disabled control with
  a visible reason is the only accepted exception, listed per selector.
- M writes `docs/build/tahap7-a11y.json` (rule, impact, page, selector, owner area) and hands it to P1–P4 at the
  start of Wave B. Owners fix serious/critical in their area; moderate is fixed only if < 10 min each.
- 44 px check: the bounding-box script from Tahap 6 (`button, a, [role=button], input, select` ≥ 44×44 at 390 px,
  `::after` hit areas counted through `elementFromPoint` sampling), run on every demo; exceptions listed.

### 3.2 INP
- Tool: Playwright + `web-vitals` attribution build injected by `addInitScript` from `node_modules` (web-vitals is a
  tiny devDependency; if adding it is refused, use a `PerformanceObserver({ type: 'event', durationThreshold: 16 })`
  shim that reports the max `duration` per interaction id, which is the same measure). Chrome, CPU throttling ×4
  (CDP `Emulation.setCPUThrottlingRate`), 390×844 and 1440×900, production build (`vite preview`), 3 runs, report the
  worst.
- `tests/e2e/tahap7/inp.spec.ts` clicks (one per product, the heaviest from each plan):
  Sapa Warga Kirim aduan · Meja Pimpinan Susun briefing · Naskah Pintar Putar rapat contoh · Radar Isu Kirim klarifikasi ·
  Siaga Wilayah Kirim peringatan + layer toggle · Awas Belanja Analisis paket · Cek Berkas Verifikasi 50 berkas ·
  Toko Autopilot Bayar · Pajak Beres Proses nota · Juara Jualan Putar panggilan · Kenal Mitra Saring 200 CV ·
  Pantau Merek Kirim 5 balasan · TenderPilot Susun dokumen · Katalog Lokal Terbitkan + flip · Rapor Usaha Setujui 3 saran ·
  Indeks Ekonomi Play frame · Sinyal Pasar Simulasikan · Inti replay story · `/tur` Mulai tur, next chapter, Ambil alih,
  Ringkasan · `/ekosistem` star click + filter · **region switch** (Siaga Wilayah, map fly) · language switch.
- Pass: every interaction ≤ 200 ms at ×4 throttle on 390. Output `docs/build/tahap7-inp.json`; anything over is
  assigned to the file owner with the long-task attribution (script URL, function).
- Usual fixes (in order): `startTransition` / `useDeferredValue` for the view switch, yield before heavy work
  (`await scheduler.yield?.() ?? setTimeout 0`), move a batch into chunks of ≤ 50 rows per frame, memoise selectors
  with `createParamSelector`, avoid synchronous layout reads after writes.

### 3.3 Perf (unchanged gates)
`npm run perf` home A/B not worse than the Tahap 6 baseline; LCP `/produk/:slug` ≤ 2.5 s (Lighthouse mobile preset,
median of 3) for 3 product pages; perf targets for `/tur` and `/demo/siaga-wilayah` (spec §14) re-run with the
Bandung pack selected (largest kelurahan count) to show packs do not degrade map fps.

---

## 4 · Final proof package (spec §15, §16 "laporan tahap")

**Screenshots** → `docs/shots/demo/tahap-7/` with `INDEX.md` (one line per file: what it shows, any known defect):
- Every demo (18) at 1440 and 390, default role, ID; plus one alternative role at 1440 ID and one EN at 390.
- Region proof: Siaga Wilayah, Sapa Warga, Meja Pimpinan, Toko Autopilot, Sinyal Pasar in **Bandung** and **Padang**
  at 1440 (map visible, kecamatan names, regional-language complaint with translation), and 390 for Siaga Wilayah.
- Tour: opener, chapters 1, 7, 12, 20, summary (1440 + 390).
- Site: `/`, `/ekosistem`, 3 eco pages, 3 product pages (1440 + 390).
- Pixel-diff table vs `baseline/` (item 13): % changed per page, with a one-line reason for anything > 5 %.

**Final report** (Indonesian, from the integrator, `docs/build/LAPORAN-AKHIR.md` plus the chat report):
1. What exists: 17 products + Inti, tour, site pages, 3 regions, with links to the screenshots.
2. Test results: e2e count passed/failed per folder, chains (≥ 10 event chains), dead-control crawler, region ×
   language matrix, Live mode mock + timeout fallback, tour autoplay 20 chapters at 1440 and 390 without console errors.
3. Numbers: size table (18 demos × ID/EN, first load KB, limit 180), home JS (≤ 253.6), home perf A/B, LCP of
   product pages, INP table (§3.2), axe summary (serious/critical = 0, moderate count).
4. Data and licences: the source table of all three packs and what is simulated.
5. Wow audit: the latest scores per demo (Tahap 2/3 audits + the optional single pass), marked "tidak dinilai ulang"
   where no re-score ran.
6. What is not done (§8) and why; open owner items (Live key + budget + hosting, site.ts contacts, deploy).
7. How to run: `npm run dev`, `npm run build`, `npm run region:validate`, `npm run test:e2e`, `npm run perf`,
   `node server/ai-proxy` (Live mode), and how to add a 4th region (scripts + README).

---

## 5 · Builder split and file ownership

| Agent | Wave | Owns (write) | Delivers |
|---|---|---|---|
| **R1 Bandung** | A | `tools/region/{fetch,build}-bandung.mjs`, `tools/region/data/sim-bandung.mjs`, `tools/region/content/bandung.mjs`, `src/demo-kit/region/packs/bandung/**` | pack + README section text (in report) + §1.5 checks |
| **R2 Padang** | A | same pattern for `padang` | same |
| **P3 Kit** | A | `src/demo-kit/**` except `region/packs/**` and `region/loader.ts` | picker + fly-to + world reset (item 2), kit de-hardcode (§1.6), Hotspot (6), Could 15–17; a short "Tahap 7" section in `CONTRACTS.md` |
| **M Measurer** | A | `tests/e2e/tahap7/{a11y,inp,targets}.spec.ts`, `docs/build/tahap7-{a11y,inp}.json`, `package.json` devDeps (after Q3) | findings by owner area at end of Wave A |
| **P1 Satu Daerah** | B | `src/demos/{sapa-warga,meja-pimpinan,naskah-pintar,radar-isu,siaga-wilayah,awas-belanja,cek-berkas}/**`, their `tests/e2e/tahap2/*.spec.ts` | de-hardcode, items 7, 11 (SD), axe/INP fixes |
| **P2 Usaha + Pasar** | B | `src/demos/{toko-autopilot,pajak-beres,juara-jualan,kenal-mitra,pantau-merek,tenderpilot}/**` + the Tahap 4 product folders, their tahap3/tahap4 specs | de-hardcode, items 10, 11 (UP/PD), axe/INP fixes |
| **P4 Site + tour** | B | `src/routes/**`, `src/pages/**`, `src/content/**`, the tour folder from Tahap 5, `public/sitemap.xml`, `index.html` meta | items 12, 14 (Could), 18 (Could), axe/INP fixes on site + tour |
| **Integrator** | C | `region/loader.ts` (`REGIONS`), `region/packs/README.md`, `tools/region/validate.mjs` (only if a builder reports a real blocker), `tests/e2e/tahap7/{regions,final}.spec.ts`, `tests/e2e/tahap2/region-lang.spec.ts`, `tools/shot-diff.mjs`, `docs/shots/**`, `docs/build/LAPORAN-AKHIR.md` | items 8, 9, 13, 19 (Q4), gate |

Order and timing (start of Wave A = T0):
- **Wave A (T0 → T0+2.5 h):** R1, R2, P3, M in parallel. P3 develops the picker against Bojonegoro + the existing
  `world/__fixtures__/mini-pack.ts` (a second id), so it does not wait for R1/R2.
- **Mid-point (T0+2.5 h):** integrator registers the packs in `REGIONS`, runs validate + size table, hands M's
  findings and the §1.6 grep (with Tahap 4 folders) to P1/P2/P4.
- **Wave B (T0+2.5 → T0+5 h):** P1, P2, P4 in parallel; P3 stays on call for kit fixes the owners report (one
  batch, not a ping-pong).
- **Wave C (T0+5 → T0+7.5 h):** integration, gate (§6), screenshots, pixel diff, final report.
- If R1 or R2 is late, Wave B starts anyway on everything except the region matrix; the matrix runs in Wave C.

---

## 6 · Tests and gate

New specs in `tests/e2e/tahap7/`:
- `regions.spec.ts` (integrator): for each of 18 demos × {bojonegoro, bandung, padang}: open `?region=<id>`, no
  console error, the TopBar picker shows the region, at least one kecamatan name of that pack is visible in the
  canvas within 10 s, ID → EN → ID changes canvas text; switch region from the picker (no reload: a `window` marker
  survives) and the world resets (clock back to the seed start). Siaga Wilayah: map bbox contains the pack centre
  after the fly. Sapa Warga: a regional-language template in `su` / `min` shows its ID translation.
- `a11y.spec.ts`, `inp.spec.ts`, `targets.spec.ts` (M): §3.
- `final.spec.ts` (integrator): tour autoplay 20 chapters at 1440×900 and 390×844 without console errors on Bandung
  (`/tur?region=bandung`, no crash, names from the pack) and on Bojonegoro (full assertions as Tahap 5).
- Re-run everything: `tests/e2e/*.spec.ts`, `tahap2/`, `tahap3/`, `tahap4/`, `tahap5/`, `tahap6/` (missions,
  ≥ 10 cross-product chains, dead-control crawler, region + language, Live mock + timeout fallback).
- Self-tests: world self-tests run once per pack (`world.selftest.ts` with `REGION=bandung|padang`): seed builds,
  flood scenario fires, `tourSummary` numbers > 0, no NaN, no undefined names.

Gate (integrator, all must pass): `npm run typecheck` · `npm run build` (includes `region:validate` for 3 packs) ·
all e2e above · size table 18 demos × ID/EN ≤ 180 (target ≤ 175) and no demo higher than at Tahap 7 start · home
JS ≤ 253.6 KB · `npm run perf` home not worse · no console errors · axe serious/critical = 0 · INP ≤ 200 ms on every
listed click · screenshots + INDEX present · commits per agent + `tahap7: region packs Bandung & Padang, polish,
laporan akhir`. No push, no deploy.

---

## 7 · Owner questions: ALL APPROVED by the owner on 2026-11-19 ("oke semua"); use the defaults exactly as written below (Q4: one wow pass, no re-score)

**Q1 · Bahasa daerah dan teks contoh.** Kota Bandung memakai **Basa Sunda** dan Kota Padang memakai **Baso Minang**.
Kalimat aduan dan sapaan contoh (minimal 12 per kota) ditulis tim GAMADA, diberi terjemahan ID + EN, dan diberi
label "contoh". Teks ini belum diperiksa penutur asli. *Default: ya, pakai Sunda dan Minang, ditulis tim, berlabel
contoh.* Jika Anda punya penutur asli yang bisa memeriksa, sebutkan, dan teksnya akan kami kirim setelah tahap ini.

**Q2 · Sumber data dan lisensi Bandung/Padang (spek §17 no. 2).** Sumber dan lisensinya sama dengan Bojonegoro:
batas kecamatan/kelurahan dari HDX COD-AB (CC BY-IGO), sungai/pasar/landmark dari OpenStreetMap (ODbL), dan kode
Kemendagri dari Wikipedia (fakta, CC BY-SA). Zona banjir dan longsor adalah **simulasi turunan**, bukan peta resmi
BNPB, dan diberi label begitu. **Padang tidak diberi lapisan tsunami**, karena zona tsunami simulasi untuk kota
pesisir sungguhan mudah disangka panduan resmi. *Default: ya, sumber sama, tanpa lapisan tsunami.*

**Q3 · Alat uji baru (devDependency saja, tidak masuk bundle situs).** Tambah `@axe-core/playwright` (cek
aksesibilitas), `web-vitals` (ukur INP), dan `pixelmatch` + `pngjs` (bandingkan screenshot dengan baseline). Semua
hanya dipakai saat pengujian; ukuran halaman tidak berubah. *Default: ya, tambahkan ketiganya.*

**Q4 · Penilaian "wow" di akhir.** Spek meminta perbaikan berulang sampai dua putaran bersih. Sesuai preferensi
kecepatan Anda, usulannya: **satu putaran saja**. Satu agen penilai dengan 4 peran (Bupati, Kepala Diskominfo,
Direktur Bank Daerah, pemilik toko 3 cabang) menilai tur dan 6 demo unggulan sekali. Hasilnya dicatat di laporan
akhir tanpa penilaian ulang. Perbaikan otomatis (axe, INP, tombol mati, region) tetap wajib lulus. *Default: satu
putaran, tanpa penilaian ulang.* Alternatifnya, jawab "tanpa wow audit" untuk melewatinya sama sekali.

**Q5 · Halaman situs dan tur tetap Bojonegoro.** Pilihan daerah tersedia di semua demo (`/demo/...`). Tur "Satu
Hari di Bojonegoro" dan teks halaman produk tetap memakai Bojonegoro. Tur tetap bisa diputar dengan
`?region=bandung`/`padang` tanpa error, tetapi tautannya tidak dipasang di situs. *Default: ya.*

---

## 8 · Coverage and deliberate deferrals

| Spec item | Where |
|---|---|
| §7 `[DAERAH_2]`, `[DAERAH_3]` packs, ≥ 12 regional templates, attribution, switch without reload + fly | §1, §2 items 1–3 |
| §14 mobile 360–430, keyboard, aria-live, 44 px, axe, INP, LCP, home JS, perf flags | §0.1, §3 |
| §15.1–6 Playwright suites | §6 |
| §15 visual: screenshots 1440 + 390, default + alt role, baseline comparison | §4, item 13 |
| §15 wow audit | Q4 (one pass) |
| §16 row 7: packs, polish, full test, final report | §1–§6 |
| §17 no. 1 (names + languages), no. 2 (licences) | Q1, Q2 |

**Will NOT be done in this program** (listed in the final report as open items):
- Full `/karya` portfolio redesign (keeps the Tahap 6 restyle; `KaryaDetail` untouched).
- Region switch on site pages and a Bandung/Padang tour narrative (Q5).
- Wow re-score loops and "2 clean rounds" (Q4), and the OGL constellation particles and presenter notes window
  unless an owner finishes early (Could items 14, 18).
- Live mode with a real key, budget limit and proxy hosting: waiting for the owner (§17 no. 4). The mock and fallback
  stay tested.
- Contact data in `src/content/site.ts` (§17 no. 7) stays `TODO` until the owner sends it.
- Official statistics, BNPB hazard maps, tsunami zones, BMKG live weather, native-speaker review of Sunda/Minang text.
- Pajak Beres own-CSV upload, PKP/PPN screen, BPPU bukti potong (Tahap 3 deferrals).
- Kit size refactors (item 15) unless a demo exceeds 175 KB.
- Push and deploy: only on the owner's command.
