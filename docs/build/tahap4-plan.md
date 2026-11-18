# Tahap 4 · Pasar Daerah (4 products) + GAMADA Inti: build plan and briefs

Written by the tahap-4 plan synthesiser on 2026-11-19 from `.shots/t4p/brief-*.md` (5 briefs: katalog-lokal,
rapor-usaha, indeks-ekonomi, sinyal-pasar, inti) and `.shots/t4p/kit-plan.md` (kit + world plan), checked against the
code (`world/types.ts`, `reducers.ts`, `reactions.ts`, `ids.ts`, `eco.ts`, `content/products.ts`). **Where a brief, the
kit plan and this file differ, this file wins** (conflicts resolved in §1.9). The owner wants speed: the build is
**kit agent → 5 product builders in parallel → integration → gate**. There is NO review round, so every builder runs the
self-check (§0.5 + their brief) before handing over, and the kit agent runs §1.10.

Base: the final Tahap 3 commit (the Tahap 3 integration is still running; the kit agent rebases on it first and takes
the measured floors from its `budget.json`).

Builders own only `src/demos/<slug>/**`, `server/ai-proxy/prompts/<slug>.ts` and `tests/e2e/tahap4/<slug>.spec.ts`.
If something is truly missing from the kit, work around it inside your folder and say so in your report (`kitHandoff`);
never edit the kit.

Read first (in this order):
1. Spec `docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` §6, §8, §9, your product in §11 (P14 ≈ l. 843, P15 ≈ 861, P16 ≈ 885,
   P17 ≈ 909, P0 ≈ 935), your chapter in §12.2, §14, §15.
2. `src/demo-kit/CONTRACTS.md` (all of it, incl. Tahap 2, Tahap 3 and the new **Tahap 4** section the kit agent writes,
   which carries the measured floors).
3. This file: §0 rules, §1 APIs, your brief in §2, chains §3, do-not-touch §4, your size line §5.
4. Visual direction C "Data-dense tenang": `docs/design/ARAH-VISUAL-TAHAP0.md` (sections 1 and 5), `/lab/_kit?only=pd`.
   Pasar Daerah accent = plum-lavender via `[data-eco="pasar-daerah"]`; Inti = lavender-white via `[data-eco="inti"]`;
   tokens `--dk-*` only.
5. Patterns: `src/demos/awas-belanja/` (autoplay + catch-up, focus arrival, lazy tabs) and `src/demos/toko-autopilot/`
   (UP skeleton, `ensureFloodScenario`, lazy tabs, role landings). Copy ideas, never import.

---

## 0 · Rules for every builder (carried over from Tahap 3 §0; Tahap 4 changes in **bold**)

### 0.1 Product
- Data is simulated and deterministic. People, companies, media, accounts, banks, cooperatives, distributors, handles:
  FICTIONAL. Officials by title only ("Kepala Daerah", "Kepala Disperindag", "analis kredit Koperasi Mitra Usaha
  Sejahtera"). Real: region geography, place names, markets, OSM, Kemendagri codes. Any number that could pass for real
  (omzet, prices, forecasts, HPS, scores, plafon, rates, cicilan, index values, effects, order values) carries
  "simulasi" / "simulated" next to it (ChartFrame prints "Data simulasi · seed N"; add the chip on KPI strips and money
  cards). Testimonials, if any, are labelled "ilustrasi".
- Names already in use (reuse, never duplicate): Siti Aminah, Raka Pratama, Darmo Sutrisno (Satu Daerah); the shop
  "Toko Bangunan Tunas Kencana Baru" (generated per pack); Joko Prasetyo + **CV Sedeng Jaya Abadi** (hero vendor);
  **UD Bumi Terpal Lestari** (mismatch); **Koperasi Mitra Usaha Sejahtera** (`LENDERS[0]`); Hidroflo; Arta Kencana
  Finance; Pelita Proteksi; Bank Wiyata Sentosa. **No new named people in product code**: read names from the world.
  New generated companies (distributors) follow the company-word rule and never reuse a Tahap 3 name.
- **No real national e-catalogue / procurement portal / payment gateway / official reference-price (HET/HAP) name or
  branding anywhere** (§6 Q1, Q3).
- ID and EN are both first-class: every visible string is `{ id, en }` and follows `useI18n().lang`. Product strings
  in `strings.ts` (split per tab/side when lazy), shared ones from `useDemoStrings()`.
- **No dead controls**: every visible control changes something real (world event, view, export, dialog, role). Out of
  scope ⇒ not rendered. A blocked action is rendered disabled WITH a visible reason, never silently inert.
- Every flow step of your product in spec §11 works and every mission can be completed by a script (§2 lists the exact
  `done` predicates).
- Product pages (`copy.ts`, `mini.tsx`, `/produk/:slug`, `/ekosistem/inti`) are Tahap 6: NOT now. Build the components
  named in your brief as standalone pure-props components so `mini.tsx` can reuse them later.

### 0.2 Tahap 2 lessons (all mandatory)
1. **Alive within 10 s**: with no interaction, the clock runs (×10, 1 world minute ≈ 6 s) and at least one world event
   lands visibly on your first screen within 10 s (the kit guarantees one per product at 07:01, §1.6). Never fake
   motion without a world event behind it.
2. **Numbers agree across screens**: every number shown in two places comes from ONE selector (lists in each brief).
   Never recompute a total locally when a selector exists; never type a number that the world can compute.
3. **No repeated template text**: no sentence twice on one screen or in one day's stream. Pools rotate
   least-recently-used; every templated sentence contains at least one entity-specific field (code, item, kecamatan,
   market, amount, time).
4. **Honest labels**: "simulasi", "proyeksi", "contoh", "pembayaran simulasi", "dipercepat untuk demo", "pratinjau,
   tidak menyimpan". A link to a non-READY demo is never rendered as a link.
5. **Cross-product links land on the right state**: every toast/link carries `?focus=<entityId>` (plus `?tab=` /
   `?role=` when needed); your canvas opens that entity, scrolls it into view, flashes it (`flashNewRow`), then
   `clearFocus()`. Unknown id ⇒ default tab + toast "Data tidak ditemukan" / "Item not found".
6. **Phone guide visible**: at 360–430 px the GuidePanel pill/sheet is visible and never covered by your sticky bars,
   drawers or toasts. Any mission hint that points at the top bar (role switcher!) has a `hintSm` (on phones those
   controls live in the ⋯ sheet).
7. **Secondary views load on intent, never on idle**: `lazy(() => import('./Tab'))` + `intentProps` /
   `usePreloadOnIntent` / `preloadOnIntent` / `preloadNow` from `../../demo-kit/shell`, or `Segmented onIntent`.
   No `requestIdleCallback` preloads.

### 0.3 Performance and motion
- Size limit: ≤ 180 KB gzip -9 beyond home per demo first load, INCLUDING fetched JSON (kecamatan geometry counts),
  excluding only the MapLibre engine + worker. **Target ≤ 175 KB.** After-action code reported separately. Home JS ≤
  253.6 KB (never import product code from home paths). **Your allowance is in §5; every role landing is measured.**
- INP ≤ 200 ms (heaviest click per product: KL Terbitkan + flip, RU Setujui 3 saran, IE Play frame, SP Simulasikan,
  Inti Putar jejak).
- Animate transform / opacity only (stroke-dashoffset for line draws), one RAF loop (`gsap.ticker` via kit helpers),
  respect `prefers-reduced-motion`, `?off=demoAnimations`, `?static=1` (`motionMode()` from `demo-kit/ui`). No
  backdrop-filter, no animated blur, no mix-blend on large elements. Map recolours = MapLibre paint transitions (≤ 400 ms,
  0 under reduced motion), never per-frame DOM. Pause loops off-screen / tab hidden. Clean up on unmount. Idle page =
  0 `gsap.ticker` listeners under reduced motion.

### 0.4 Accessibility and mobile
- Keyboard everywhere (arrows in lists/grids, Enter opens, `Esc` closes, focus returns), visible focus ring,
  `aria-live="polite"` for arriving events (≤ 1 announcement per 5–10 s), AI answers, order/loan status; labelled icon
  buttons; AA contrast; every chart, dial, map and line animation has a text summary.
- 360–430 px fully usable: no horizontal page scroll, 44 px targets, tables become cards (`Table` < 640 px), split
  views become one side at a time. Below 640 px the shell canvas owns the 16 px gutter: add no side padding. Horizontal
  chip scrollers get `padding-block: 9px` + matching negative margin.
- **Pasar Daerah / Inti canvases render a skeleton with the final layout boxes ("Menyiapkan data pasar…",
  `useDemoStrings().pdLoading`) until the readiness hook of §1.1 is true.**

### 0.5 Process and common self-check
- No git commit/push/stash/reset/checkout. Do not edit `src-art/`.
- Dev server `http://127.0.0.1:5173` (already running; never start another one on 5173). Open your product with
  `/demo/<slug>?controls=all` (full shell before DEMO_READY). Add `&e2e=1` for `window.__gamada = { world, emit,
  settled, onEvent, clock, ensure }`.
- Own builds only: `VITE_DEMO_CONTROLS=1 npx vite build --outDir .shots/t4-<slug>/dist --emptyOutDir`; scratch under
  `.shots/t4-<slug>/`. Budget: `npx vite preview --outDir .shots/t4-<slug>/dist --port <port>` then
  `node .shots/t2-prep/budget.mjs <port> .shots/t4-<slug>/dist` (copy it, edit the route list for your slug and every
  role landing). **Ports: katalog-lokal 4411, rapor-usaha 4412, indeks-ekonomi 4413, sinyal-pasar 4414, inti 4415.**
- Typecheck: `npx tsc --noEmit 2>&1 | grep "src/demos/<slug>"` must be empty. After a prompt edit: `npm run ai:test`.
- Write your own Playwright spec **`tests/e2e/tahap4/<slug>.spec.ts`** (`@playwright/test`, `channel: 'chrome'`, base URL
  from `tests/e2e/fixtures.ts`) and run ONLY it. Never run the whole suite. Do NOT flip `DEMO_READY`.

**Common self-check (run all, plus your brief's list; report each line PASS/FAIL with the number measured):**
- [ ] tsc clean for your folder; no console errors or React warnings on any tab, every role, ID and EN.
- [ ] Fresh world (`?controls=all&e2e=1`, storage cleared) at 1440×900 AND 390×844: within 10 s ≥ 1 world event lands
      visibly on the first screen without touching anything.
- [ ] Every mission completed by your spec at 1440 and 390; confetti + "Lanjut ke produk terkait" shows.
- [ ] Every "numbers that must agree" line of your brief checked in the spec (read the world via `__gamada.world`).
- [ ] Every `?focus=` arrival in your brief lands on the right tab/role + entity; a bad id ⇒ default + toast.
- [ ] Every chain row of §3 that names your product: emit the root via `__gamada.emit`, the follow-up shows ≤ 1 s.
- [ ] No-dead-controls crawl (Tahap 2 crawler pattern) on every tab × role.
- [ ] 360 / 390 / 430: no horizontal scroll, all targets ≥ 44 px, guide pill visible, sticky bars never cover pill/toasts.
- [ ] Keyboard pass. Reduced motion + `?off=demoAnimations` + `?static=1`: final states render, no RAF idle. (axe scan:
      run it if the tool is installed; otherwise "deferred to Tahap 7" as in Tahap 3.)
- [ ] No repeated template sentence (spec greps the rendered texts of a list/stream for duplicates).
- [ ] Region switch to Bandung and Padang (when the packs exist; else "deferred to Tahap 7"): no crash, names follow.
- [ ] Own build + budget: every role landing ≤ 175 KB; intent and after-action chunks listed.
- [ ] Live mode with mocks (`npm run ai:test` green; product buttons fall back to sim on invalid / 10 s timeout).

---

## 1 · Kit + world APIs for Tahap 4 (import paths relative to `src/demos/<slug>/`)

The kit agent builds everything in this section FIRST and writes the measured numbers into CONTRACTS.md "Tahap 4".
Builders start only after the kit self-check (§1.10) is green.

### 1.0 Kit agent build order
1. **Boot split + eco plumbing** (no behaviour change for SD/UP):
   - `world/up/data.ts` (NEW) registers extension id `'usaha-pintar/data'` = `extend: extendUsahaPintar` only (reducers
     `{}`, reactions `[]`, `describe: () => null`); chunk = seed-up + texts + cv ≈ 15.5 KB.
   - `world/up/boot.ts` keeps `boot()`, imports `./data` first, registers id `'usaha-pintar'` (live: UP_BOOT reducers,
     reactions, describe, idFields, covers) + `registerNaturalSource('usaha-pintar', naturalUpAt)` (≈ 5 KB own).
   - `world/flood-scenario.ts` (NEW, UP-free): `FLOOD_AT` (= `UP_SCENARIO.floodAt` 07:06), `ensureFloodScenario(s, now)`,
     `useFloodAutoplay(enabled)`, `activeFloodAlert(s)`; `up/scenario.ts` re-exports from it (UP products unchanged).
   - `world/price-math.ts` (NEW, tiny): `weekChangeOf` moved out of `sd/leader` (which re-imports it), so PD never pulls
     `sd/leader`.
   - `vite.config.ts`: `satuDaerahImports` → `barrelImports({ 'world/satu-daerah': 'world/sd', 'world/usaha-pintar':
     'world/up', 'world/pasar-daerah': 'world/pd' })`; re-exported names resolve to their defining module (a PD product
     chunk carries only the modules it imports; the 14.8 KB shared UP chunk disappears from PD).
   - `world/eco.ts`: `WorldEco = 'usaha-pintar' | 'pasar-daerah'`; `WorldModule = 'usaha-pintar/data' | 'usaha-pintar' |
     'usaha-pintar/chains' | 'pasar-daerah' | 'pasar-daerah/chains'`; LOADERS for each; per-eco `ECO_TRIGGERS` +
     boot-only predicate (§1.4); `WORLD_MODULES` (§1.1); `preloadWorldFor(slug, role?)`, `preloadWorld(mod)`,
     `useWorldReady(mods)`; `WORLD.version` 6 (`util.ts`).
2. Types + tables + events (§1.3, §1.4), core seed changes, UP data append step `seedPdLinks`, reducers, `world/pd/boot.ts`
   (≤ 4.2 KB: PD reducers + boot audit texts + natural-pd), `world/pd/chains.ts` (≤ 8 KB: reactions C30–C38 + other
   audit texts), `shell/effects.ts` labels/targets/`EFFECT_ALSO`, natural-pd (§1.6). World self-test `pd.selftest.ts`.
3. Selectors `world/pasar-daerah.ts` + `world/pd/*.ts`, `world/inti.ts` + `world/inti/*.ts`, `world/story.ts` (§1.5).
4. UI/viz/AI pieces (§1.7), `i18n` keys (§1.8).
5. **Stubs**: `src/demos/{katalog-lokal,rapor-usaha,indeks-ekonomi,sinyal-pasar,inti}/index.tsx` (default export
   canvas rendering the PD skeleton, `missions = []`); point the 5 loaders in `src/demos/registry.ts` at
   `() => import('./<slug>')` (NOT `DEMO_READY`). Prompt files exist; leave them to the builders.
6. CONTRACTS.md "Tahap 4" (APIs + measured floors), `/lab/_kit?only=pd` entries for every §1.7 piece.

### 1.1 Module contract + world readiness
```tsx
// src/demos/<slug>/index.tsx
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { useWorldReady } from '../../demo-kit/world'
export default function Canvas({ product }: DemoCanvasProps) {
  const ready = useWorldReady(['usaha-pintar/data', 'pasar-daerah'])   // exactly the list of your row below
  if (!ready) return <PdSkeleton />          // product-local, same boxes as the real layout
  …
}
export const missions: readonly Mission[] = [ … ]
export const hotspot = { target: '[data-hotspot=…]', label: { id: '…', en: '…' } }
```
- `useShell()` (`../../demo-kit/shell`): `pack`, `focus` + `clearFocus()`, `markMission(id)`, `toast(…)`, `size`,
  `role`, `setSession({ role })`, `present`, `setToastPlacement`. Missions: `done(e, s)` with `isEvent(e, '<type>')`.
- `useWorldReady(mods: WorldModule[]): boolean` requests missing modules (idempotent) and is true once all are
  registered. `useEcosystemReady(eco)` stays (UP products unchanged). DemoShell calls `preloadWorldFor(slug, role)`
  instead of `preloadEcosystem(product.eco)`, and loads `pasar-daerah/chains` on the first pointerdown/keydown on a PD
  or Inti page.

| Product (landing) | First load (preloaded) | Readiness call |
|---|---|---|
| 6 UP products | `usaha-pintar/data` + `usaha-pintar` | `useEcosystemReady('usaha-pintar')` (unchanged) |
| katalog-lokal, rapor-usaha, inti (all roles) | `usaha-pintar/data` + `pasar-daerah` | `useWorldReady(['usaha-pintar/data', 'pasar-daerah'])` |
| indeks-ekonomi (all roles), sinyal-pasar `disperindag` | `pasar-daerah` | `useWorldReady(['pasar-daerah'])` |
| sinyal-pasar `?role=pemilik-toko` | `usaha-pintar/data` + `pasar-daerah` (role-aware `WORLD_MODULES['sinyal-pasar:pemilik-toko']`) | Umkm lazy chunk: `useWorldReady(['usaha-pintar/data', 'pasar-daerah'])`; role chip intent ⇒ `preloadWorld('usaha-pintar/data')` |

Invariants: UP live handlers registered ⇒ UP data present (live imports data). A world with UP data but no UP live
handlers is valid. The UP live module + chains load only through the store gate (an `ECO_TRIGGERS['usaha-pintar']`
event, e.g. a user's emergency need, `ledger.reviewed`, `flood.alert`, `price.anomaly`) — after an action, reported.

### 1.2 Imports (one path each; never another product's folder)
| What | Import |
|---|---|
| World barrel | `../../demo-kit/world` (`useWorld`, `emit`, `onEvent`, `settled`, `useClock`, `clock`, `rows`, `get`, `hhmm`, `fmtRp`, `ref`, `isEvent`, `WORLD`, types, `useWorldReady`, `useEcosystemReady`, `preloadWorld`, `LENDERS`) |
| Pasar Daerah selectors | `../../demo-kit/world/pasar-daerah` (NOT in the barrel; rewritten per module at build). It also RE-EXPORTS the UP selectors PD products may read: `outletKpis`, `omzetByMonth`, `pnlMonthly`, `pendingReviews`, `ledgerRows`, `taxCalendar`, `vendorProfile`, `verificationOf`, `kybCase`, `priceAdvice`, `shopOpportunities`, `demandForecast`, `reviewSuggestion`, `reviewedLines`, `verifiedBusinesses`. **Never import `world/usaha-pintar` from a PD product.** KL/SP: UP re-exports only inside lazy chunks (UMKM side, Compare) |
| Inti selectors | `../../demo-kit/world/inti` (NOT in the barrel) |
| Story replay | `../../demo-kit/world/story` (lazy: `import()` on click only) |
| Flood scenario | `../../demo-kit/world/flood-scenario` (UP-free; `import()` on click or via `useFloodAutoplay`) |
| UI | `../../demo-kit/ui` (+ new `BizBadges`, `RangeField`, `ActivityFeed`) |
| Viz | `../../demo-kit/viz` (+ new `ScoreDial`; `LineChart` now takes `forecast` + `markers`) |
| Map | `../../demo-kit/map` (`MapView`, `choropleth`, `belowThreshold`, `MapLegend`, `KecamatanList`, `marketMarkers`, `pointMarkers`, `alertZones`, `TimeScrubber` with `steps`) — top level ONLY in Indeks Ekonomi; everyone else on intent |
| AI | `../../demo-kit/ai/chat` only (`useAiChat`, `registerScenario`, `registerStructuredSchema`, `useAiTraces`, `lastTrace`) |
| Frames | `../../demo-kit/frames` (`BrowserFrame`, `PhoneFrame`, `PaperFrame`, `printPaper`) |

### 1.3 Data model (`types.ts`; `WORLD.version` 6; id prefixes in `ids.ts`) and seed you can rely on
**New tables** (core state, `emptyTable()` in the core seed unless a seed row is listed):
| Table (prefix) | Shape | Seed |
|---|---|---|
| `consents` (`IZ`) | `{ id, businessId, lender: string, scopes: ConsentScope[], days: 30\|90\|180, at, until, revokedAt: Minutes\|null }`, `ConsentScope = 'omzet'\|'laporan'\|'pajak'\|'kyb'\|'mutasi'\|'supplier'` | UP append step: one per seeded queue loan (scopes vary) |
| `priceSubs` (`LG`) | `{ id, businessId, commodityIds: string[], channel: 'wa'\|'aplikasi', thresholdPct: 5\|10\|15, at }` | UP append step: 1 row for the shop (commodities of its `cm:` SKUs, beras + cabai rawit first; `wa`, 10) |
| `priceAlerts` (`PA`) | `{ id, subId, businessId, warningId, commodityId, marketId, peakInDays, peakPct, text: Bi, advice: Bi, at }` | — (C32) |
| `priceShocks` (`GJ`) | `{ id, commodityId, marketIds, startAt, peakDay: 5, pct, damp: number (0..0.8), cause: EntityRef\|null, at }` | — (C30, C34) |
| `priceWarnings` (`PDN`) | `{ id, shockId, commodityId, marketIds, peakInDays, peakPct, expected, at, cause: EntityRef }` | — (C31) |
| `distributorWatches` (`DW`) | `{ id, commodityId, distributorIds: string[], by: RoleId, at }` | — |
(The kit plan's `KS`, `PW`, `BR` prefixes collide with `cashShifts`, `alerts`, `briefings`; the prefixes above are final.)

**Extended types:** `NeedItem.spec?: Bi`; `CatalogNeed.{ by?: 'ai'\|'manual'\|'natural'\|'reaction', budget?: number }`;
`Order.{ confirmedQty?: number[], etaDays?: number, shipAt?: Minutes, paidAt?: Minutes }`; `LoanApp.{ consentId?, purpose?:
Bi, ratePct?, installment?, decidedAmount?, reason?: Bi }` (status `'ditolak'` already exists);
`LedgerEntry.source` += `'katalog' | 'pinjaman'`; COA += `2301 Utang Pinjaman` (kewajiban); `MarketOperation.{ sentBy?:
RoleId, volumeTon?, days?, startedAt?: Minutes }`; `Complaint.readAt?`, `Call.readAt?` (if missing); `Chat.unread` exists.

**Core seed additions (deterministic, own streams, other tables unchanged):**
- `s.meta.facts.pd = { shockCommodityIds: [cabaiRawitId, berasId] (per pack), tickMarketId (market nearest the kabupaten
  centroid; Bojonegoro = Pasar Kota Bojonegoro), subscriberCount (fictional count from food-sector businesses), pastOpId }`.
- **One past market operation** (`S('pd-ops')`): `marketOps` row stage `done`, beras, the first market in the highest
  `riskFlood` kecamatan, `at` day −35, `effectPct` −6, `sentBy: 'disperindag'`, `volumeTon`, `days: 3`; that market×beras
  `history` dampened days −35…−21 (−4…−6 %); Oct `econIndex` of its kecamatan +0.6. It powers IE mission 3 and SP's
  Operasi history from the first second. (Meja Pimpinan filters `recommended`, so it does not show; selftest documents
  the one changed price series.)
- The seeded `dikirim` order's business is never the shop (kit enforces in seed).
- **UP data append step `seedPdLinks`** (last step of `extendUsahaPintar`, stream `S('up-pd')`): `loanApps` +3
  `diajukan` to `LENDERS[0]` (CV Sedeng Jaya Abadi — unverified; UD Bumi Terpal Lestari — KYB cek-manual; 1 warung) + 2
  decided (1 `disetujui`, 1 `ditolak` with `reason`) for Riwayat, each with a `consents` row (scopes differ so "Tidak
  dibagikan pemilik" is visible); the shop `priceSubs` row. All other UP tables identical by key (selftest).

**Seed facts builders rely on (Bojonegoro seed 1; other packs: same shapes):**
- Shop score **710** (factors omzet .78, margin .66, pajak .37, supplier .83, kyb 1, pertumbuhan .71; history[10] = 750 ⇒
  "−40 vs Okt"); 3 review rows ⇒ after "rapikan 3 jurnal" pajak .52 ⇒ **740** (+10 per journal); then `tax.ready` ⇒
  **820** (`tax.ready` first: 790). Net profit Sep 47,36 jt, Oct 53,43 jt (avg 50,40 jt). Hero CV Sedeng Jaya Abadi 692
  (kyb .35) ⇒ ≈ 790 after KYB lolos. The kit asserts these and writes the per-pack values into CONTRACTS.
- Emergency tender HPS Rp 37.750.000 (`EMERGENCY_TENDER`, seed 1); shop karung/terpal cost below it.
- `econIndex` 28 kecamatan × 12 months (Dec 2025–Nov 2026), `index` 100 = 12-month regional mean; the 2 smallest
  kecamatan have 4–9 businesses ⇒ hidden everywhere.
- `prices` = real market × commodity, 60 daily closes + today; 14 real Bojonegoro markets × 9 commodities.
- `catalogNeeds` 4 seeded (3 selesai, 1 dipesan), orders 4 (3 dibayar, 1 dikirim).

### 1.4 Events (exact names; reducer, audit text ID/EN and `effects.ts` label + target exist for each)
| Event | Payload | Reducer | Emitted by (source) |
|---|---|---|---|
| `need.created` (extended) | + `by?`, `budget?`, items `spec?` | existing + fields; status `baru` | katalog-lokal (AI spec) · clock (natural, origin katalog-lokal, `by: 'natural'`) · reactions C5/C11 |
| `match.made` (unchanged) | `{ id?, needId, businessId, score }`; score ALWAYS = `matchScore(...).score` | existing | reaction C36, C27 · clock (natural need's matches) |
| `order.created` (extended reducer) | unchanged payload (`orderPayload` builds it) | existing + need ⇒ `dipesan`; when the need has a tender: tender ⇒ `selesai`, ordered business's bid ⇒ `menang`, other bids ⇒ `kalah` | katalog-lokal |
| `order.confirmed` | `{ orderId, qtyConfirmed: number[], etaDays: number, note?: Bi }` | status `dikonfirmasi`, `confirmedQty`, total = Σ confirmed × unit | katalog-lokal (UMKM side) |
| `order.shipped` | `{ orderId }` | status `dikirim`, `shipAt`; shop orders: mapped SKUs `stock.onHand −= confirmed qty` (when UP data present) | katalog-lokal (UMKM side) |
| `order.paid` | `{ orderId, amount, method: 'transfer-kasda' }` | status `dibayar`, `paidAt`; need ⇒ `selesai` when all its orders are paid | katalog-lokal (Pemda) · clock 07:03 (seeded non-shop order) |
| `consent.granted` | `{ id?, businessId, lender, scopes: ConsentScope[], days }` | `consents` (`until = at + days × DAY_MIN`) | rapor-usaha |
| `consent.revoked` | `{ consentId }` | `revokedAt` | rapor-usaha |
| `loan.applied` (extended) | + `consentId?`, `purpose?: Bi`, `ratePct?`, `installment?` (from `loanOffer`) | existing + fields | rapor-usaha |
| `loan.approved` (extended) | `{ loanId, amount?, note?: Bi }` | + `decidedAmount` | rapor-usaha (bank-mitra) |
| `loan.rejected` | `{ loanId, reason: Bi }` | status `ditolak`, `reason`, `decidedAt` | rapor-usaha (bank-mitra) |
| `price.shock` | `{ id?, commodityId, marketIds, startAt, peakDay, pct, damp?, cause }` (patch by `id`: `damp` only) | upsert `priceShocks` | reactions C30, C34 (source sinyal-pasar) |
| `price.warning` | `{ id?, shockId, commodityId, marketIds, peakInDays, peakPct, expected, cause }` | upsert `priceWarnings` | reaction C31 (sinyal-pasar) |
| `price.anomaly` (unchanged) | `{ marketId, commodityId, price, expected, deltaPct }` | existing | clock (natural-pd shock path, origin sinyal-pasar) |
| `price.subscribed` | `{ id?, businessId, commodityIds, channel, thresholdPct }` | upsert per business | sinyal-pasar (UMKM side; Disperindag "Daftarkan UMKM contoh" not built) |
| `price.alertSent` | `{ subId, businessId, warningId, commodityId, marketId, peakInDays, peakPct, text: Bi, advice: Bi }` | `priceAlerts` | reaction C32 (sinyal-pasar) |
| `distributor.watched` | `{ commodityId, distributorIds, by }` | `distributorWatches` | sinyal-pasar |
| `market.operation` (extended reducer) | + `volumeTon?`, `days?`, `sentBy?`; a patch may now also set `marketIds`, `volumeTon`, `days`, `sentBy`, `startedAt` (on `running`) | existing + fields | sinyal-pasar (`recommended` "Kirim ke Meja Pimpinan", `running` "Mulai operasi pasar") · core C13 · meja-pimpinan · clock (`done`) |
| `instruction.issued` (unchanged) | origin `ref('marketOps', id)` ⇒ op `approved` (existing) | existing | meja-pimpinan · clock (SP auto-approve, §1.6) · indeks-ekonomi (Kepala Daerah) |
| `econ.updated` (extended) | + `kind?: 'banjir'\|'program'\|'panen'`, `cause?: EntityRef\|null` | existing | reactions C34, C35, C10 |
| `econ.briefed` | `{ id?, month, kecamatanIds, programIds, sections: ('peta'\|'sektor'\|'harga'\|'dampak')[], by: RoleId }` | none (audit only) | indeks-ekonomi |
| `chat.read` | `{ refs: EntityRef[] }` | `chats.unread = 0`; complaints/calls `readAt` | inti (no reaction, no cross toast) |
| reused as-is | `score.updated`, `ledger.reviewed` (source rapor-usaha ⇒ C19), `verification.requested` (bank "Minta verifikasi KYB"), `po.drafted` (SP UMKM side), `bid.submitted`, `partner.verified`, `tax.ready` | | |

**Gate:** `ECO_TRIGGERS['pasar-daerah']` = every new type above + `flood.alert`, `market.operation`, `order.created`,
`loan.approved`, `need.created`. Boot-only (no chains needed): clock-sourced `need.created`, `match.made`, `order.paid`,
`price.updated` with origin ∈ PD slugs (predicate on source/origin, not only on type). **The UP gate also skips
clock-sourced non-emergency `need.created`** (C21 and C26 are no-ops for it; C26 gains the guard `e.source !== 'clock'`),
so no PD natural event pulls UP live/chains into a first load (kit self-test).

### 1.5 Selectors (memoised unless *plain*)
**`world/pasar-daerah` → `world/pd/*.ts`**
| File | Exports |
|---|---|
| `pd/config.ts`, `pd/labels.ts` | `PD = { anonMin: 10, anomalyBandSd: 1.5, earlyWarnDays: 5, forecastDays: 14, matchMin: 0.45, opHours: 90 }`; labels `BADGE`, `ORDER_STATUS`, `CONSENT_SCOPE`, `LOAN_STATUS`, `OP_STAGE`, `SECTOR`, `PROGRAM_KIND`, `SCORE_FACTOR` (+ one-line explanation) `{id,en}` |
| `pd/katalog.ts` | `matchScore(s, needId, bizId)` *plain* → `{ score 0..1, parts: { coverage .35, distance .25, skor .20, pajak .10, kapasitas .10 } }` (coverage = share of need categories supplied; distance = 1 − km/capacity clamped; skor = bizScore/1000; pajak = taxTidy; kapasitas = min(1, available/qty)) · `badgesOf(s, bizId)` → `{ verified, taxTidy, score, kybAt? }` (THE badge source) · `catalogShortlist(s, needId)` → `{ top: Card[] (verified only, ≤ 6, score desc, id asc), waiting: Card[] (unverified, `requestId?`) }`, `Card = { business, km (0.1), score, parts, badges, offer }` · `offerFor(s, needId, bizId)` → `{ lines: { category, unitPrice, qtyAvailable }[], total, source: 'bid'\|'saran'\|'katalog' }` (shop with a bid on the need's tender ⇒ bid price; shop without ⇒ `priceAdvice().suggested`; others ⇒ `listingOf`; shop `qtyAvailable` = Toko `stock.onHand`) · `listingOf(s, bizId, category)` *plain* (deterministic: HPS unit or category reference × f(bizId) ∈ [0.86, 1.04], round Rp 100; stock/leadDays from employees + capacity) · `splitSuggestion(s, needId)` (≤ 2 `{ bizId, category, qty }`) · `catalogKpi(s, now)` → `{ openNeeds, verifiedLocal, ordersToday, ordersTodayBusinesses, spendMonth }` · `needList(s, now, status)` · `needView(s, needId)` (+ source chip: flood / Awas Belanja / UKPBJ, `flags` from `procurement.flagged`) · `ordersOf(s, { needId?, bizId? })` · `umkmInbox(s, bizId)` · `vendorStorefront(s, bizId)` (shop: SKUs whose tags map to catalog categories, price, onHand; others: `listingOf`) |
| `pd/payloads.ts` *plain* | `naturalNeedPayload(s, now)`, `matchPayloads(s, needId, n = 6)`, `orderPayload(s, needId, bizId, qty?)` (total = Σ qty × `offerFor` unit), `umkmPoPayload(s, bizId, warningId)` (null when an open `draf` PO already holds that SKU) |
| `pd/rapor.ts` | `SCORE_BANDS` `[0 'Perlu perhatian', 550 'Cukup', 650 'Baik', 750 'Sangat baik', 850 'Prima']` (Bi) · `bandOf(score)` *plain* · `raporOf(s, bizId)` → `{ score, band, deltaMonth (vs history[10]), history12: { month, score }[], peerScore, factors: { key, value, weight, contribution, live, source: ProductSlug, evidence: Bi, focus }[], recalcAt }` (score = `computeScore` = `bizScores`; `peerScore + Σ contribution = score` exactly, largest remainder; peer = median factors of same-kind businesses; `live` = pajak, kyb) · `scoreActions(s, bizId)` → exactly 3 `{ key: 'rapikan-jurnal'\|'pajak-siap'\|'kyb'\|'stok-aman'\|'bayar-supplier', gain, kind: 'langsung'\|'tutup-buku', label: Bi, target }` (gain = `computeScore` on a patched copy; shop seed: rapikan-jurnal +30, pajak-siap +80, stok-aman "perkiraan +x saat tutup buku"; done actions drop out, list refills) · `loanOffer(s, bizId, now)` → `{ plafon, ratePct, tenors: [6,12,18,24], installment(amount, tenor), dsr, eligible, reason?: Bi, nextBand? }` · `installment(amount, ratePct, months)` *plain* (THE formula, §2 P15) · `loanAdvice(s, loanId)` → `{ rec: 'setujui'\|'setujui-bersyarat'\|'tinjau-manual', reasons: Bi[3], maxAmount }` · `lenderQueue(s, lender, status: 'menunggu'\|'diputus')` · `consentsOf(s, bizId)` · `activeConsent(s, bizId, lender, now)` · `dataFeed(s, bizId, now)` (today's sales/ledger/tax/KYB rows of the business, newest first) |
| `pd/econ.ts` | `ECON = { anonMin: 10, months: 12 }` · `econMonths(s)` · `econFrame(s, month)` → `{ values: Record<kecId, number\|null>, hidden: kecId[], omzetTotal, businessesTotal, rank: { kecId, index, delta }[] }` (hidden ⇒ null everywhere; counted in totals) · `econSeries(s, kecId\|null)` → `{ month, index, omzet }[12]` + `markers` from `econ.updated` causes · `econSectors(s, month, kecId\|null)` (sectors < 10 businesses merged "Lainnya (digabung)") · `econPulse(s, now)` → `{ tx, revenue, panelBusinesses, revenueVisible: panelBusinesses ≥ 10, byHour }` · `econEvents(s, now)` (today's `econ.updated` rows `{ kecId, month, delta, reason, at, cause, kind }`) · `programList(s)` → `{ id, kind: 'operasi-pasar'\|'modal', title, stage, measured, kecIds }[]` (all `marketOps` + one "Modal kerja Koperasi" cohort from approved `loanApps`) · `programImpact(s, programId, now)` → `{ method: 'selisih-ganda', treated, control, before, after: { values, lo, hi }, effectPct, priceEffectPct?, measured, note }` (uses `priceOutlook`/`opSimulate`; `measured` only for `done` ops) · `dinkopCards(s, now)` (aggregates only, bins < 10 merged) · `briefingModel(s, now, { month, kecIds, programIds, sections })` *plain* |
| `pd/prices.ts` + `pd/forecast.ts` | `seasonalBand(p)` *plain* (mean ± 1.5 sd, 30-day sine) · `shockPath(shock, day)` *plain* (`pct × (1 − damp) × shape(day/peakDay)`, smoothstep to 1 at peak, half-life 4 days after) · `priceOutlook(s, priceId, now)` → `{ history30, forecast14, lo, hi, peakDay, peakPct, deltaPct, factors: { key: 'musim'\|'pasokan'\|'banjir'\|'operasi', pct, label: Bi, cause? }[] }` (THE forecast: SP, IE, AI) · `opSimulate(s, { commodityId, marketIds, volumeTon, days })` → `{ effectPct, forecastAfter, lo, hi, costRp }` (THE op model: C34, SP simulator, IE impact) · `priceBoard(s, now, { commodity?, market? })` → rows `{ id, marketId, commodityId, price, weekPct, deltaPct, expected, anomaly, warning?, spark14 }` · `priceTicker(s, now)` (12 largest \|weekPct\|) · `commodityIndex(s, commodityId, days)` (regional mean, index 100) · `opView(s, opId)` · `pdKpi(s, now)` → `{ commodities, markets, anomalies, warnings, subscribers }` · `alertsFor(s, bizId, now)` · `priceSubsOf(s, bizId)` · `distributorsFor(s, commodityId)` (6 per pack, derived deterministic fictional names, real kecamatan, stock days; `watched` from `distributorWatches`) · `cmSkuFor(s, bizId, commodityId)` (null without UP data) · `weekChangeOf` (re-export of `world/price-math`) |

**`world/inti` → `world/inti/*.ts`**
| Export | Contract |
|---|---|
| `TRAIL_SPINE` | `['sapa-warga','siaga-wilayah','meja-pimpinan','naskah-pintar','awas-belanja','katalog-lokal']` (spec order; NOT `PRODUCTS.inti.related`, whose order differs) |
| `productOfAudit(a)` *plain* | `source` if a product slug; `'clock'\|'tour'` ⇒ `origin`; else `EFFECT_TARGET[type]`; else `null` ("Sistem") |
| `dataTrail(s, rootRef, { maxRows = 40 })` | `{ root, rows: { auditId, eventId, at, product, summary: Bi, refs, hop }[], spine: { product, auditId\|null, at\|null }[6], branches: { product, count }[], complete }`; walk = rows whose `entityRefs` intersect the frontier or whose `causeId` was collected; hub tables (other citizens, `kecamatan:*`, suppliers, the shop, agentsSales) not expanded; ≤ 6 hops; oldest first |
| `unifiedInbox(s, now, { channel?: 'wa'\|'web'\|'telepon'\|'semua', eco?, unreadOnly?, scope })` · `inboxKpi(s, now, scope)` | rows `{ id, ref, channel, product, eco, from, preview: Bi, at, unread, href }` from complaints (voice ⇒ wa + mic chip), `messages`, `chats`, `calls`, PD orders |
| `accessMatrix()` *plain* · `scopeOf(role)` | `{ roles, products, allowed(role, slug), isDefault(role, slug) }` from `PRODUCTS[].roles/defaultRole`; scope `'semua'\|'usaha'` + ref predicate (pemilik-toko = shop rows only) |
| `auditQuery(s, { product?, eco?, type?, actor?: 'user'\|'clock'\|'tour'\|'reaction', q?, from?, to?, scope })` · `auditCsv(rows, lang)` / `auditJson(rows)` *plain* | columns id, waktu, produk, aktor, jenis, ringkasan, entitas, sebab |
| `platformPulse(s, now)` · `activityRows(s, now, { eco?, product?, max })` | `{ todayCount, perProduct: Record<slug, { count, lastAt }> }`; rows for `ActivityFeed` |
**`world/story.ts`** (lazy, after action; Inti + Tahap 5 tour): `DAY_STORY` steps keyed `flood` (`ensureFloodScenario`) →
`siti` (Siti Aminah's voice complaint; persona text copied into kit `sd/persona.ts`) → `neighbours` (4 banjir complaints
≤ 1 km ⇒ C1 cluster + `flood.confirmed`) → `instruction` (Meja Pimpinan `instruction.issued` refs cluster + alert ⇒ C7
letter) → `recommend` (`procurement.recommended` inviteLocal ⇒ C11 need ⇒ C36 matches). `playDayStory({ gapMs = 600,
onStep })` emits only missing steps (idempotent by key), source `'clock'` with `origin` = the step's product, at = now.

### 1.6 Natural events (`pd/natural-pd.ts`, source `'clock'` + origin) — alive within 10 s at ×10
- **07:01** `need.created` non-emergency from a 6-template pool (nasi kotak rapat, air minum posko, seragam relawan,
  spanduk layanan, ATK posko, kursi lipat — only categories ≥ 3 verified businesses supply in the pack; LRU,
  entity-specific qty + kecamatan; `by: 'natural'`) immediately followed by its `match.made` ×≤ 6 (via `matchPayloads`,
  staggered 1 world-second apart); then ≈ 1 per 45 world min 08–15, ≤ 6 open. (KL, Inti)
- **07:01** `price.updated` at `facts.pd.tickMarketId` (commodity rotates, deterministic ±0,5–1 %); then one market ×
  commodity tick every 5 world min 06–18; `setNaturalBoost('price', 5)` (every world minute) while sinyal-pasar or
  indeks-ekonomi is open. (SP, IE Harga, Meja)
- **07:03** `order.paid` on the seeded `dikirim` (non-shop) order. (KL)
- Core 07:01 kopi / 07:03 toko `sale.created` (existing) ⇒ IE pulse, RU "Data masuk", Inti pulse.
- **Shock path** (minute tick, only while a `priceShocks` row is active): the shocked pairs' today price steps toward
  `expected × (1 + shockPath(shock, d₀))` at flood +1, +2, +4 world min; a pair whose price leaves `seasonalBand().hi`
  emits `price.anomaly` (≤ 3 pairs/day, once per pair, worst first). Bojonegoro seed 1: cabai rawit at the flood-kecamatan
  market at flood +2, beras at +4 (self-test).
- **SP auto-approve**: a `recommended` op with `sentBy: 'disperindag'` and no approval after 4 world min ⇒ clock
  `instruction.issued` `{ text: "Disetujui Kepala Daerah (simulasi) · operasi pasar <komoditas>", opdIds: ['disperindag'],
  origin: ref('marketOps', id) }` (existing ⇒ `approved`).
- **Running ops**: `done` at `startedAt + PD.opHours` (90 world min; UI "3 hari, dipercepat untuk demo"); today's prices of
  its markets step toward `opSimulate().forecastAfter[0]`.
- Flood autoplay: Sinyal Pasar opts in with `useFloodAutoplay(true)` (07:06 ≈ 36 s). IE, KL, RU, Inti: button / story only.

### 1.7 Kit components (new or changed; only pieces with ≥ 2 users)
| Piece | Import | API | Users |
|---|---|---|---|
| `ScoreDial` | `demo-kit/viz` | `{ value 0..1000, prev?, bands: { min, label: Bi, tone }[], label: Bi, size: 'sm'\|'md'\|'lg' }` SVG 270° arc (stroke-dashoffset), `useTweened` 900 ms, final value under reduced motion; ≤ 1,5 KB, no d3 | RU dial + bank rows, KL compare drawer |
| `BizBadges` | `demo-kit/ui` | `{ badges: ReturnType<badgesOf>, size: 'sm'\|'md', links?: boolean }` Terverifikasi → `/demo/kenal-mitra?focus=<bizId>`, Pajak Rapi → `/demo/pajak-beres?tab=ekspor`, Skor nnn → `/demo/rapor-usaha?focus=<bizId>` (links only when the target is READY, else text); missing badge = outlined "Belum" chip with reason tooltip | KL cards, RU bank queue, Inti Data node detail |
| `RangeField` | `demo-kit/ui` | `{ label: Bi, min, max, step, value, onChange, format(v, lang), unit?: Bi }` native range, 44 px thumb, arrows/PageUp/Home/End, `aria-valuetext` | SP op simulator, RU loan plafon |
| `ActivityFeed` | `demo-kit/ui` | `{ rows: { id, at, product, text: Bi, href?, tone }[], max, live }` eco-coloured dots, new row 8 px slide, `aria-live` throttled | Inti, IE "Kejadian ekonomi" (`/ekosistem` Tahap 6) |
| `LineChart` (changed) | `demo-kit/viz` | gains `forecast?: Forecast {values, lo, hi}` band (closes the Tahap 3 known limit) and `markers?: { x, label: Bi, tone }[]`; `AreaChart` gains `markers` | SP outlook, IE series/impact, RU 12-month trend |
| `TimeScrubber` (changed) | `demo-kit/map` | `steps?: { value, label: Bi }[]`, Play/Pause on the kit ticker (`playSeconds` 9), arrows/Home/End, `aria-valuetext`, ≥ 44 px thumb, discrete steps under reduced motion, pauses off-screen | IE time-lapse, tour ch. 18 |
| `ai/trace.ts` | `demo-kit/ai/chat` | `useAiChat` appends on `done` `{ product, role, at, prompt (≤ 120 chars), intentId, confidence, mode, fellBack, steps: ToolCall[], timing, structuredKinds }` to a ring of 10 (module store + sessionStorage in try/catch); `useAiTraces()`, `lastTrace()`; empty ⇒ honest empty state (no fake traces) | Inti Agen, tour (Tahap 5) |
| Effects | `shell/effects.ts` | label + `EFFECT_TARGET` for every §1.4 type (§3 landings); `score.updated` target → rapor-usaha `?focus=<bizId>`; `econ.updated` → indeks-ekonomi `?focus=<kecId>:<month>`; `EFFECT_ALSO`: `tax.ready` + katalog-lokal (`?focus=<shopId>`) + rapor-usaha (`?focus=pajak`), `partner.verified` + katalog-lokal + rapor-usaha, `bid.submitted` (tender with needId) + katalog-lokal `?focus=<needId>`, `market.operation` running/done + indeks-ekonomi `?tab=dampak&focus=<opId>`, `order.shipped` (shop) + toko-autopilot `?tab=prediksi&focus=<productId>` | all |
| i18n | `i18n/id.ts`, `en.ts` | `pdLoading` "Menyiapkan data pasar…" / "Preparing the market data…", `anonHidden` "Data agregat disembunyikan untuk menjaga anonimitas" / "Aggregate hidden to protect anonymity", `simPrice`, `simScore`, `projection` "proyeksi" | all |
Product-local (NOT kit): KL `FlipStage`, `MatchBoard` (SVG lines), `SupplierCard`, `NeedSpecCard`, `OrderTracker`,
`PhoneOrders`, need parser; RU `FactorWaterfall`, `ConsentCard`, `LoanTimeline`, `ApprovalStamp`; IE `TimelapseRank`,
`ImpactChart`, `BriefingPaper`, `PulseCard`, `KecDrawer`, hatched bars; SP `Ticker`, `Board`, `AnomalyCard`,
`OutlookChart`, `OpSimulator`; Inti `TrailLanes`, `PulseStrip`, `AccessMatrix`, `TraceTimeline`, `AuditTable`.

### 1.8 AI
Nothing new in the shared AI kit except `ai/trace.ts`. Each product: `scenario.ts` registered by its LAZY AI surface,
`prepare()` on hover/focus, numbers from selectors, wording canned (pools, no repeats). Shared kinds used: `need-spec`
(KL), `business-score` (RU), `insight` (IE, SP, Inti), `price-alert` (SP), `plan` (Inti). Product-owned kinds
(`registerStructuredSchema`): `katalog-lokal/compare`, `rapor-usaha/loan-brief`, `indeks-ekonomi/impact`,
`indeks-ekonomi/briefing`, `sinyal-pasar/action-plan`, `sinyal-pasar/umkm-alert`, `inti/trail`, `inti/access`. Live
tools: keep the shared tool of your prompt file, add `customTools: [productTool('<slug>', name, z.object(…), desc)]` +
`customMocks`; Live only rewrites wording, local numbers win; invalid / 10 s ⇒ sim; the tour always uses sim. Hidden IE
cells never enter `ctx`.

### 1.9 Conflicts resolved (names above are final)
1. Order lifecycle: **`order.confirmed` / `order.shipped` / `order.paid`** (KL brief), not the kit plan's single
   `order.statusChanged` — `EFFECT_TARGET` is keyed per type, so each step needs its own label/landing.
2. Consent: kit names **`consent.granted` / `consent.revoked`** + table `consents`, with RU's 6 scopes and `until`
   (RU's `data.shared` / `dataShares` dropped). Loan refusal = **`loan.rejected`** (RU's `loan.declined` dropped).
3. Ledger sources: order payment **`'katalog'`** (KL's `'order'` dropped); loan disbursal **`'pinjaman'`**, lines Bank D /
   **2301 Utang Pinjaman** C (RU's `'loan'` dropped; no existing "Utang Bank" account).
4. Rapor numbers: RU brief wins (measured): bands, `loanOffer` (avg net profit Sep–Oct × band multiplier), `loanAdvice`
   (≥ 750 setujui, 650–749 bersyarat, else / unverified tinjau). Kit plan's `scoreView`, A–E bands, `loanQueue`
   700/550 rule and "score × omzet" plafon are dropped. Names: `raporOf`, `scoreActions`, `loanOffer`, `loanAdvice`,
   `lenderQueue`. `ScoreDial` (kit, ≤ 1,5 KB) replaces RU's `Gauge variant="score"` (9–12 KB).
5. Katalog: `catalogShortlist` (top = verified only, ranked by `matchScore`) replaces kit `shortlistFor` (verified &&
   taxTidy top 3). `badgesOf` + kit `BizBadges` replace KL's `TrustBadges`. C27 and C36 both use `matchScore` (C27's
   `0.95 − km/80` replaced). `catalogPreview` (Kenal Mitra) is re-implemented on `catalogShortlist` (top 3 identical).
6. Listings are DERIVED (`listingOf`); the kit plan's `listing.updated` event and `listingEdits` table are dropped (no
   UMKM listing editor in scope; KL is alive through the natural need). Kit plan C37 'bid→catalog-offer' and C38
   'order→stock-reserve' dropped: the bid is a state link (`offerFor` source `bid`), stock moves on `order.shipped`.
7. Matching runs as reaction **C36 'need→catalog-match'** (KL brief), not a "Cocokkan" button. The 07:01 natural need
   carries its own `match.made` (natural), so no PD reaction is needed in a first load; C36 skips needs that already
   have matches.
8. Prices: one model. Flood ⇒ `price.shock` (C30, kit) ⇒ early warning **`price.warning`** (C31, SP brief; the kit's
   `price.anomaly kind 'prediksi'` is dropped so the core reducer stays unchanged) ⇒ UMKM alert `price.alertSent`
   (C32, on the WARNING = "lebih awal") ⇒ actual `price.anomaly` from the natural shock path (C33) ⇒ existing C13
   (Meja) + C20 (Toko). SP's SP1 `flood→supply.signal` is dropped (the shock carries the flood cause; `pasokan`
   factor reads existing `supplySignals`). `opSimulate` is the only op model (C34 sets `damp` from it).
9. **C13 is NOT changed to a 'draft' stage** (SP brief). It keeps auto-recommending (Tahap 2 Meja + tests untouched).
   SP's "Kirim ke Meja Pimpinan" emits `market.operation` stage `recommended` with `sentBy: 'disperindag'`, `volumeTon`,
   `days`, `marketIds` — patching the open op of that commodity if C13 created one, else a new op. SP shows a C13 op as
   "Usulan otomatis · belum dikirim Disperindag" until then. Auto-approve applies only to `sentBy` ops.
10. IE: brief names win (`econFrame`, `econSeries`, `econSectors`, `econPulse`, `econEvents`, `programList`,
    `programImpact`, `briefingModel`); kit `econCells/sectorSplit/econToday/programsOf/briefingData` dropped. Export
    event **`econ.briefed`** (IE) — the kit plan's generic `brief.exported` + `briefs` table are dropped (no second
    emitter: Inti audit export is a download, RU has no export). Flood formula = IE brief's per-kecamatan
    `riskFlood` rule (C35); op formula = IE's `|effectPct| × 0.25` (C34). Kit plan's 'loan→econ-program' dropped
    (IE reads approved loans from state). `ensurePriceScenario` not built (SP uses flood autoplay; IE mission 3 uses
    the seeded past op).
11. Flood helper path **`world/flood-scenario.ts`** (kit plan), not `scenario-flood.ts` (SP brief).
12. Inti: brief names win (`dataTrail`, `unifiedInbox`, `inboxKpi`, `accessMatrix`, `scopeOf`, `auditQuery`,
    `platformPulse`); story in **`world/story.ts`** (`playDayStory`), not `inti/trace-scenario.ts`. Trail spine =
    `TRAIL_SPINE` in spec order. `TraceGraph`, `ConnectorLines`, `SideSwitch`, `CatalogCard`, `PriceGrid`,
    `PeriodScrubber`, `Heat/BarChart masked` are NOT kit (one user each); `ai/trace.ts` ring = 10, no seeded "contoh"
    traces (honest empty state).
13. Id prefixes: `IZ`, `LG`, `PA`, `GJ`, `PDN`, `DW` (kit plan's `KS`/`PW`/`BR` collide). SP warning focus = `PDN-…`
    (SP brief's `PW-…` = flood alerts).
14. Natural price tick at **07:01** (kit plan's 07:02 ≈ 12 s misses the 10 s rule). Distributors are derived, not a table;
    only watches are stored.
15. Chain ids: briefs' KL-a…d, IE-a…e, SP1–3, L-bid, L-flag and the kit plan's C30–C40 are replaced by **C30–C38 +
    state links L7–L12** (§3).

### 1.10 Kit agent self-check (green before builders start)
- [ ] `npx tsc --noEmit` clean for `src/demo-kit/**`; `npm run build`; `npm run ai:test`; world selftests (tahap 1–3,
      C1–C29 unchanged except the documented C26 guard and C27 score) and NEW `pd.selftest.ts` on the mini fixture +
      every pack: C30–C38 each produce the listed follow-ups.
- [ ] Determinism: same seed ⇒ deep-equal worlds; UP data identical by key after the split except the `seedPdLinks`
      rows; a world with UP data but no live handlers processes `sale.created`; PD on a world without UP data: no crash.
- [ ] Numbers: `badgesOf().score` = `bizScores` = `raporOf().score` = `computeScore`; Bojonegoro seed 1 shop 710 →
      740 (3 × +10) → 820; `peerScore + Σ contribution = score`; `installment(150e6, 0.85, 12)` = 13.775.000;
      `order.total` = Σ `offerFor` unit × qty = C37 ledger amount; `econPulse().tx` = Σ salesDaily day 0 tx =
      `outletKpis().total.tx`; hidden cells yield no number in `econFrame`, `econSectors`, `briefingModel`, CSV;
      `priceBoard` price = `PricePoint.price`; C34 `damp` from `opSimulate` ⇒ default op lowers the forecast peak ≥ 40 %;
      `catalogPreview` top 3 = `catalogShortlist().top` top 3; `accessMatrix` = `PRODUCTS[].roles`.
- [ ] Story: fresh Bojonegoro 07:00 + `ensureFloodScenario` ⇒ C30 at 07:06, C31 warning ≤ 1 world-second later with
      `peakInDays` 5, C32 shop `price.alertSent`, cabai `price.anomaly` at 07:08 + C13 op + C20; beras at 07:10;
      `playDayStory` twice ⇒ no duplicates, `dataTrail(complaint).spine` 6/6 with audit ids.
- [ ] Alive: 07:01 gives a visible event for KL (need + matches), SP (`price.updated`), IE/RU/Inti (`sale.created`).
- [ ] Texts: no natural need / warning / alert / op reason twice in a day; every new event has ID + EN audit text.
- [ ] Size (budget.mjs + PD stub loop): `pd/boot` ≤ 4,2; `up/data` ≤ 15,5; IE/SP floor ≤ 110; KL/RU/Inti floor ≤ 125
      (else apply the lazy-`cv` fallback of the kit plan and report the real floor); SD and UP demos ≤ Tahap 3 + 0,5;
      home ≤ 253,6; no PD natural event pulls UP live/chains into a first load.
- [ ] Regression: `npx playwright test tests/e2e/tahap2 tests/e2e/tahap3` green; `chains.spec.ts` chain 30–38 (world
      level); `/lab/_kit?only=pd` renders §1.7 pieces at 1440 and 390, reduced motion + `?static=1`, keyboard.

---

## 2 · Product briefs

Common to all five: replace the stub `src/demos/<slug>/index.tsx`; split files per tab/side; strings in `strings.ts`;
sim scenario in `scenario.ts` (registered by the lazy AI surface); CSS prefix `dk-<short>-` with `--dk-*` tokens;
skeleton until the §1.1 readiness call is true; `data-tour` / `data-<short>` hooks exactly as listed (Tahap 5 tour);
URL params `?tab=`, `?focus=`, `?role=` (plus product ones listed). Each brief's self-check is IN ADDITION to §0.5.

### P14 · Katalog Lokal — `src/demos/katalog-lokal/` · `dk-kl-` · prompt `katalog-lokal.ts` · port 4411
- **Roles / frame:** `ukpbj` (default, "Sisi Pemda", label "UKPBJ / OPD") · `pemilik-toko` ("Sisi UMKM"). A big
  toggle "Sisi Pemda ↔ Sisi UMKM" `[data-kl=side-toggle]` = `setSession({ role })` (RoleSwitcher stays in sync).
  Flip: container `rotateY(0→180deg)` 600 ms, `perspective` on parent, `backface-visibility: hidden`; reduced motion /
  `?off=` / `?static=1` ⇒ crossfade ≤ 150 ms; focus moves to the new side's heading. Params `?role=`, `?view=daftar|peta`.
- **1440 Pemda:** stage 64/36: `BrowserFrame` `demo.gamada.id/katalog-lokal` | `PhoneFrame` "HP UMKM" peek (live,
  read-only; the whole frame is one button "Buka sisi UMKM" = the toggle; no inner focusables). Browser: left 32 %
  composer (textarea, 3 example chips, "Susun spesifikasi" `[data-kl=compose]`) + `NeedList` (Segmented Terbuka /
  Dipesan / Selesai with counts); right 68 % need detail = `NeedSpecCard` (title, items, kecamatan, tenggat, HPS acuan
  when a tender exists, source chip "Dari Siaga Wilayah" / "Dari Awas Belanja ↗" / "Dibuat UKPBJ", flag chip "Temuan
  Awas Belanja: HPS +n %" ↗ when `procurement.flagged`) → `MatchBoard` `[data-kl=match-board]` (need node left, ≤ 6
  `top` cards 2×3 right, SVG lines drawn by stroke-dashoffset ≤ 800 ms as `match.made` rows arrive; below, collapsed
  "Belum terverifikasi (n) · menunggu Kenal Mitra" with KYB request code chip ↗) → compare tray (sticky inside the panel)
  → orders of this need with `OrderTracker` (dipesan → dikonfirmasi → dikirim → dibayar). `Daftar | Peta` Segmented
  (`onIntent` preloads the map chunk: `MapView` + `pointMarkers`, distance rings from the need kecamatan centroid).
- **1440 UMKM (flipped):** `PhoneFrame` "HP UMKM" 40 % + `BrowserFrame` "Dasbor mitra" 60 %. "Lihat sebagai" Select =
  shop (default) + businesses with a match/order (≤ 6), label "Demo: akun UMKM lain". Phone: order notification cards,
  order detail (qty requested vs available), "Konfirmasi penuh" / "Konfirmasi sebagian" (qty stepper ≤ available) ⇒
  `order.confirmed` `[data-kl=umkm-confirm]`, "Tandai dikirim" ⇒ `order.shipped`, payment status. Dasbor: Etalase
  (`vendorStorefront` + `BizBadges` with "Cara dapat lencana ↗"), Peluang (open needs it matches; shop =
  `shopOpportunities`), Riwayat pesanan + total diterima (simulasi).
- **First 30 s (07:00, ×10, Pemda):** KPI strip (`catalogKpi`): Kebutuhan terbuka · UMKM lokal terverifikasi (=
  `verifiedBusinesses().length`, same as Kenal Mitra) · Pesanan ke UMKM hari ini · Belanja ke UMKM lokal bulan ini
  "(simulasi)". Right: newest open need's MatchBoard (empty state "Belum ada kebutuhan terbuka · coba contoh di kiri"
  until 07:01). **07:01 (≈ 6 s)** natural need slides in, its matches light one by one (≤ 1,2 s), KPI +1. **07:03**
  natural `order.paid` (chip "Dibayar", KPI belanja + total). Hotspot `[data-hotspot=kl-example]` on the first example
  chip "Butuh 2.000 karung pasir dan 50 terpal untuk Kec. <flood-risk kecamatan of the pack>, kirim 2 hari, darurat".
  No flood autoplay; if a flood alert exists, its C5 need is open with banner "Kebutuhan darurat dari Siaga Wilayah".
- **Composer / AI:** lazy AI chunk (`prepare()` on composer focus/hover). Sim parser → shared `need-spec` `{ items[{ name,
  qty, unit, spec }], location, deliveryDays, budgetCeiling? }`; `location` → pack kecamatan (normalised token match;
  unknown ⇒ chip "Pilih kecamatan" Select, "Terbitkan kebutuhan" disabled with reason); item → category via synonyms
  (karung/sak/sandbag, terpal/tarp, nasi kotak, air minum, seragam, spanduk, pompa, genset, beras, ATK, kursi);
  "darurat/banjir/segera" or active flood ⇒ emergency; numbers "2.000", "2rb", "dua ribu", EN "2,000". Chips via
  `dropChips`; qty/kecamatan editable inline. Duplicate guard: same categories + kecamatan open ⇒ "Kebutuhan serupa
  sudah terbuka: <code> · Buka" + "Tetap terbitkan" (both real). "Tanya Katalog" panel (lazy) ≥ 10 intents:
  `buat-kebutuhan`, `kenapa-urutan` (reads `matchScore.parts`), `kenapa-belum-terverifikasi`, `bandingkan` →
  `katalog-lokal/compare` `{ pickId, ranking: { businessId, reason ≤ 160 }[] ≤ 3, split?: { businessId, category, qty }[] ≤ 2,
  risks: string[] ≤ 2 }`, `bagi-pesanan`, `harga-wajar` (vs HPS), `lencana-artinya`, `waktu-kirim`, `pembayaran`
  (simulasi, transfer Kas Daerah), `porsi-lokal` (`spendMonth`), `aturan` ("keputusan tetap pada pejabat pengadaan"),
  fallback with chips. Prompt: keep `need_spec`; add `compare_offers` (`productTool`) + mock; context ≤ 6 KB `{ need,
  top 6 { ref, badges, km, available, unitPrices, total }, hps, flags }`; rules: only UMKM from context, never name a real
  national e-catalogue/portal, prices simulated, final choice by the authorised official.
- **Compare + order:** tick 2–3 cards → "Bandingkan (n)" `[data-kl=compare]` → lazy Compare drawer (≤ 3 offers: unit
  prices, total, km, available, badges, `ScoreDial size=sm`, `splitSuggestion` "Pakai usulan bagi pesanan") → "Pilih
  <UMKM>" → Stepper Ringkas → Pagu (`MoneyInput`, ≥ total else disabled with reason) → Kirim `[data-kl=order]` ⇒
  `order.created` (`orderPayload`); the order chip `flyBetween` to the phone; at 390 a pill "1 pesanan baru di Sisi
  UMKM" (tap = flip). Pemda "Terima & bayar (simulasi)" on a `dikirim` order ⇒ `order.paid` ("Transfer dari Kas Daerah
  (simulasi)"; no QRIS, no VA numbers).
- **Missions:** 1 `buat` Buat kebutuhan — `isEvent(e,'need.created') && e.source==='katalog-lokal' && !e.depth` ·
  2 `banding` Bandingkan penawaran — markMission when Compare renders ≥ 2 offers · 3 `pilih` Pilih UMKM —
  `isEvent(e,'order.created') && e.source==='katalog-lokal' && !!e.payload.needId` · 4 `konfirmasi` Konfirmasi dari sisi
  UMKM — `order.confirmed` source katalog-lokal (`hintSm` "Ketuk 'Sisi UMKM' di atas kanvas") · 5 `selesai` Kirim &
  bayar — `order.paid` source katalog-lokal. Next card → Kenal Mitra.
- **Focus arrivals:** `KB-` need → Pemda detail; `OR-` order → Pemda tracker (UMKM order when `?role=pemilik-toko`);
  business id → its card in the newest need containing it, else UMKM side "Lihat sebagai" it; `MC-` match → its need,
  card flashed; `TD-` tender → its need; bad id ⇒ Pemda default + toast.
- **Tour hooks (ch. 8, 11:40):** `?focus=<flood needId>`, `[data-kl=match-board]`, `[data-kl=compare]`, `[data-kl=order]`,
  `[data-kl=side-toggle]`, `[data-kl=umkm-confirm]`; ch. 20 summary = `catalogKpi().ordersTodayBusinesses`.
- **Numbers that agree:** badge Terverifikasi = `business.verified` (Kenal Mitra) · Pajak Rapi = `taxTidy` (flips ≤ 1 s on
  `tax.ready`) · Skor = `bizScores` (= Rapor dial) · km = Kenal Mitra preview km · top 3 = Kenal Mitra `catalogPreview` ·
  shop price = TenderPilot bid (chip "Penawaran resmi via TenderPilot") / before a bid `priceAdvice().suggested` · shop
  available = Toko Autopilot onHand · HPS acuan = tender `hps` · need code + kecamatan = Kenal Mitra priority chip = Awas
  Belanja · order total = Pajak Beres ledger row (C37) · stock after shipping = Toko Autopilot · verified count = Kenal
  Mitra KPI.
- **390:** one side at a time; toggle = full-width Segmented 44 px at the top of the canvas (in flow); composer card;
  needs as cards, opening a need pushes Detail (back button); MatchBoard = vertical list with a left rail line per card;
  compare tray = in-flow bar at the end of the list; Compare = full-height Drawer; UMKM phone content without the device
  frame (frame ≥ 768). No fixed bars.
- **Size:** see §5. Map, Compare, Umkm side, AI, Tanya Katalog on intent; UP re-exports only inside the Umkm and Compare
  chunks.
- **Self-check (extra):** hands-off 07:01 need + lit lines ≤ 10 s, 07:03 paid; example chip → spec → Terbitkan ⇒ ONE
  `need.created` (double click safe) ⇒ C21 tender + C26 ≤ 2 KYB + C36 matches; toasts land (TenderPilot `?focus=<tenderId>`,
  Kenal Mitra request); `top` all verified, `waiting` lists the hero with its KM code; `emit('partner.verified',
  { subjectKind:'business', subjectId: hero, kind:'kyb', result:'lolos', score: 91 }, 'kenal-mitra')` ⇒ hero in `top`
  ≤ 1 s (Flip); `tax.ready` ⇒ Pajak Rapi ≤ 1 s; order ⇒ phone notification ≤ 1 s (1440 and after flip at 390); partial
  confirm ⇒ total = Σ confirmed × unit; shipped ⇒ shop onHand −qty; paid ⇒ ledger total = order total; tender `selesai`,
  bids menang/kalah; composer ID + EN examples parse, unknown kecamatan ⇒ disabled with reason; flip = fade under reduced
  motion.

### P15 · Rapor Usaha — `src/demos/rapor-usaha/` · `dk-ru-` · prompt `rapor-usaha.ts` · port 4412
- **Roles / frame:** `pemilik-toko` (default, "Pemilik Usaha") · `bank-mitra` = analis kredit **Koperasi Mitra Usaha
  Sejahtera** (`LENDERS[0]`, title only). `BrowserFrame` `demo.gamada.id/rapor-usaha` (sisi UMKM) + right panel (≥ 1280)
  "Sisi Bank/Koperasi": read-only mirror of the latest own application (status, step, decided amount) + button "Buka
  sebagai Koperasi" (= real role switch); < 1280 it is a card under the timeline.
- **Owner tabs** `?tab=rapor|modal|berbagi` (default rapor), plain words ("Skor usaha", "Yang menaikkan / menurunkan").
  **Bank tabs** `?tab=antrian|riwayat` (antrian: Segmented Menunggu / Diputus). Owner-only tabs not rendered for the bank
  and vice versa.
- **First 30 s:** skeleton until ready. Dial (`ScoreDial size=lg`, `SCORE_BANDS`) fills 0 → **710** (900 ms; final under
  reduced motion), band "Baik", chip "−40 vs Okt", ribbon "Skor simulasi · bukan keputusan kredit". `FactorWaterfall`
  builds factor by factor (60 ms stagger) from "Median toko bangunan <kabupaten> (simulasi)" (`peerScore`) to 710; each
  factor row: points ±, evidence sentence (`raporOf().factors[].evidence`), source chip + link (Toko Autopilot / Pajak
  Beres / Kenal Mitra, `?focus=`), "per tutup buku Oktober" on non-live factors. Action card 1 pulses
  (`[data-hotspot=ru-fix]`). **Alive ≤ 10 s:** strip "Data masuk hari ini" = `dataFeed`: "Penjualan N transaksi · Rp X"
  (= `outletKpis().total`) counts up on the 07:01/07:03 sales; line "Dihitung ulang hh.mm" = `raporOf().recalcAt`.
- **Cara menaikkan skor:** exactly 3 cards from `scoreActions`: "Rapikan 3 jurnal +30" `[data-ru=fix]` opens a drawer
  with the 3 review rows + suggested account (`reviewSuggestion`, same as Pajak Beres) → "Setujui 3 saran" ⇒ 3
  `ledger.reviewed` (source rapor-usaha, 250 ms apart, `lines` = `reviewedLines`) ⇒ C19 `score.updated` +10 each (dial
  710 → 720 → 730 → 740, `aria-live`); "Siapkan pajak November +80" → `/demo/pajak-beres?tab=ekspor&focus=<taxItemId>`;
  third card per `scoreActions` (shop: "Stok aman", kind tutup-buku "perkiraan +x saat tutup buku" →
  `/demo/toko-autopilot?tab=po&focus=<draft poId>`). Done actions drop out, the list refills.
- **Berbagi data / consent** `[data-ru=share]`: `ConsentCard` (native checkboxes, 44 px rows): which data (6 scopes:
  omzet, laporan, pajak, kyb, mutasi, supplier; minimum for applying omzet + laporan + kyb, others optional), to whom
  (fixed: Koperasi Mitra Usaha Sejahtera), how long (Segmented 30/90/180 hari, default 90) → "Setujui berbagi" ⇒
  `consent.granted`. Berbagi Data tab lists consents with "Cabut akses" ⇒ `consent.revoked` (applying then disabled
  WITH reason "Akses data dicabut · bagikan lagi untuk mengajukan").
- **Modal kerja / loan** `[data-ru=apply]`: plafon `RangeField` + `MoneyInput` (clamped to `loanOffer().plafon`), tenor
  Segmented 6/12/18/24, cicilan live (`installment`), DSR, hint "Capai 750 untuk plafon Rp 150 jt" (computed `nextBand`),
  purpose Select (3 options) → "Ajukan modal" ⇒ `loan.applied` (+ consentId, ratePct, installment). `LoanTimeline`:
  Diajukan → Ditinjau → Diputus → Dicairkan (simulasi). **Loan maths (simulasi, §6 Q2):** plafon = floor to Rp 5 jt of
  avg net profit (Sep, Oct) × k, k = Cukup 1 · Baik 2 · Sangat baik 3 · Prima 4, < 550 ineligible (reason); flat rate
  per month 1,25 · 1,0 · 0,85 · 0,75 %; cicilan = ceil to Rp 1.000 of (amount/tenor + amount × rate); DSR ≤ 35 %. Seed 1:
  710 ⇒ Rp 100 jt; ≥ 750 ⇒ Rp 150 jt, 12 bln, 0,85 % ⇒ **Rp 13.775.000/bln**, DSR 27,3 %.
- **Bank side** `[data-ru=approve]`: queue rows (`lenderQueue`): business, amount, tenor, score now (+ "saat diajukan"
  when different, e.g. "692 → 790 setelah KYB"), `BizBadges`, recommendation chip (`loanAdvice`). Detail Drawer: only
  CONSENTED scopes render data; others "Tidak dibagikan pemilik". Actions: "Setujui" (`MoneyInput` ≤ requested) ⇒
  `loan.approved` (+ `ApprovalStamp` `flyBetween` to the owner mirror), "Tolak" (Select of 3 reasons) ⇒ `loan.rejected`,
  "Minta verifikasi KYB" (only if unverified) ⇒ `verification.requested` kind kyb, requestedBy `LENDERS[0]`.
- **Missions:** 1 `faktor` Lihat faktor skor — markMission when the factor drawer renders · 2 `naik` Naikkan skor —
  `isEvent(e,'score.updated') && e.payload.businessId===s.meta.shopId && e.payload.delta>0 &&
  pendingReviews(s, s.meta.shopId)===0` · 3 `bagikan` Bagikan data — `isEvent(e,'consent.granted') &&
  e.source==='rapor-usaha' && e.payload.lender===LENDERS[0]` · 4 `ajukan` Ajukan modal — `loan.applied` source
  rapor-usaha for the shop · 5 `setujui` Setujui sebagai koperasi — `isEvent(e,'loan.approved') &&
  get(s.loanApps, e.payload.loanId)?.businessId===s.meta.shopId` (hint + `hintSm` "⋯ → Peran").
- **Focus arrivals:** shop id → Rapor; other business id or `LN-` with bank role → Antrian + Drawer; `LN-` (owner) →
  Modal timeline; `IZ-` → Berbagi row; factor key (`?focus=pajak`) → factor drawer; `JR-` → review drawer row; bad ⇒ default
  + toast.
- **AI:** owner "Tanya skor" drawer (lazy): `kenapa-turun` (750 → 710 from factors), `cara-naik` (= `scoreActions`),
  `faktor-pajak`, `berapa-plafon`, `kenapa-plafon`, `berapa-cicilan`, `data-dibagikan`, `cabut-akses`,
  `pasti-disetujui` ("keputusan tetap di koperasi"), fallback → shared `business-score` from `raporOf`/`scoreActions`.
  Bank "Ringkas pengajuan" → `rapor-usaha/loan-brief` `{ loanId, rec, strengths: Bi[3], risks: Bi[3], maxAmount }` from
  `loanAdvice`; fair, non-discriminatory wording. Prompt: keep `explain_score`; add `brief_loan` + mock; context ≤ 4 KB;
  rules: only context numbers, never promise approval, scores simulasi.
- **Tour hooks (ch. 14, 14:30):** `[data-ru=fix]`, `[data-ru=share]`, `[data-ru=apply]`, `[data-ru=approve]`, dial
  `[data-tour=ru-dial]`.
- **Numbers that agree:** dial = `bizScores[shop]` = `computeScore` = KL badge = Kenal Mitra badge = bank "skor sekarang" ·
  review count 3 = Pajak Beres `pendingReviews` (same accounts after review) · omzet = `omzetByMonth` (never
  `pnlMonthly.revenue`) = Toko month omzet · plafon/cicilan identical in owner sim, bank Drawer, approval card, Pajak
  Beres disbursal journal (C38) · history[11] = score · "Data masuk" = `outletKpis().total`.
- **390:** dial 200 px + band + delta on top; "Data masuk" chips scroll; waterfall = 6-row list (bar + ± points); actions
  stacked cards; trend `Sparkline` + "Lihat 12 bulan" opens lazy `LineChart`; ConsentCard, loan sim, bank Drawer full
  height; no sticky CTA; toasts top.
- **Self-check (extra):** fresh 710, "−40 vs Okt", waterfall sums to 710 (spec reads DOM points); dial text =
  `computeScore` after every step (710/740/820); `tax.ready` via emit ⇒ pajak row flashes, 820 ≤ 1 s, plafon 100 → 150 jt;
  hero `partner.verified` ⇒ bank row 692 → ≈ 790 + rec chip ≤ 1 s; apply 150 jt/12 ⇒ 13.775.000 in sim, Drawer, approval
  card; approve ⇒ owner timeline "Disetujui" + mirror ≤ 1 s; C38 ledger balanced; unchecked scope ⇒ "Tidak dibagikan
  pemilik"; revoke ⇒ apply disabled with reason; ineligible / too-high amount disabled with reason; "simulasi" on score,
  plafon, rate, cicilan, peer median.

### P16 · Indeks Ekonomi Daerah — `src/demos/indeks-ekonomi/` · `dk-ie-` · prompt `indeks-ekonomi.ts` · port 4413
- **Roles / frame:** `bappeda` (default) · `dinkop` (Dinas Koperasi & UMKM) · `kepala-daerah`. `BrowserFrame`
  `demo.gamada.id/indeks-ekonomi`; `PaperFrame` (light A4) + `printPaper` for the briefing. Tabs
  `?tab=peta|sektor|harga|dampak|briefing` (Bappeda; default peta); Dinkop lands on `sektor`, Kepala Daerah on
  `ringkasan` (replaces Sektor/Harga in the bar; they stay in ⋯). Role switch keeps month, selection, tab when allowed.
  **Does not need UP data** (all inputs are core tables): never import UP re-exports.
- **First screen (Bappeda, 1440):** KPI strip (chip "simulasi"): Indeks kabupaten Nov (sementara) + Δ vs Okt
  (`econSeries(null)`) · Omzet UMKM Nov (`econFrame().omzetTotal`) · Kecamatan disembunyikan (anonimitas): 2 · "Transaksi
  tercatat hari ini" (`econPulse().tx`, live; Rp only when `revenueVisible`, else "Rp disembunyikan · < 10 usaha" — the
  rule demonstrated). Left 64 %: `MapView` + `choropleth()` (5 quantile classes, hatch via `belowThreshold` for hidden,
  `MapLegend` with hatch swatch) `[data-tour=ie-map]`, `TimeScrubber` with 12 month `steps` + Play under the map
  `[data-tour=ie-scrubber]` (`aria-valuetext` "Juni 2026, indeks 98,4"). Right 36 %: `KecamatanList` ranked (hidden rows:
  hatch + `anonHidden` text, no value) + "Kejadian ekonomi hari ini" (`ActivityFeed` of `econEvents` + hourly pulse
  `Sparkline`). Hotspot `[data-hotspot=ie-play]` "Mulai di sini: putar 12 bulan". **Alive ≤ 10 s:** 07:01 natural sale ⇒
  pulse +1 and sparkline tick. Strip without flood: "Belum ada peringatan banjir" + "Putar skenario banjir (dari Siaga
  Wilayah)" (`import('…/world/flood-scenario')` on click ⇒ `ensureFloodScenario`); with an alert: plum banner "Peringatan
  banjir aktif · N kecamatan · lihat dampak" → month Nov + `alertZones` outline.
- **Kecamatan drawer** (`KecDrawer`, click on map or list): 12-month `LineChart` with `markers` (flood, ops), sector mix,
  today's events, markets → `/demo/sinyal-pasar?focus=<marketId>:<commodityId>`, AI "Jelaskan". Hidden kecamatan ⇒
  hatch + text only.
- **Sektor:** `econSectors` bars (hatched merged rows, text "Lainnya (digabung)"), pack source line "(simulasi)".
  **Dinkop extra cards** (`dinkopCards`, aggregates only, no business names): UMKM per sector (≥ 10 rule), Rapor Usaha
  score distribution (5 bins, < 10 merged), Koperasi working-capital program (approved `loanApps`: count, Σ amount,
  kecamatan), Katalog Lokal local spend (`catalogKpi().spendMonth`, n orders). Dampak defaults to "Modal kerja".
- **Harga:** `commodityIndex` lines per staple (same series as Sinyal Pasar), anomaly markers, link per commodity →
  Sinyal Pasar `?commodity=`.
- **Dampak** `[data-tour=ie-impact]`: program picker (`programList`; the seeded past op is `measured`) → "Ukur dampak" ⇒
  `ImpactChart` (`LineChart` before + after with `forecast` band; treated vs control), method label "selisih-ganda
  (simulasi)", projections marked "proyeksi", `effectPct` = Sinyal Pasar op effect.
- **Briefing** `[data-tour=ie-briefing]`: sections (Peta, Sektor, Harga, Dampak), kecamatan + programs → `BriefingPaper`
  preview (same numbers as screen, hidden cells hatched with the footnote) → "Ekspor" (print = `printPaper`, or download
  `briefing-ekonomi-<region>-<YYYY-MM>.html`) ⇒ ONE `econ.briefed` per export (double-tap safe).
- **Kepala Daerah "Ringkasan":** 3 headline cards (biggest drop, biggest rise, program effect), compact map + Play, "Beri
  instruksi pemulihan" → local dialog (OPD picker: Dinkop, Disperindag, Bappeda; text prefilled with the lowest visible
  kecamatan) ⇒ `instruction.issued { text, opdIds, refs: [ref('econIndex', id)] }` (existing C7 ⇒ Naskah Pintar;
  toast → `/demo/meja-pimpinan?focus=<instructionId>`), then Briefing.
- **Missions:** 1 `timelapse` Putar time-lapse 12 bulan — markMission when the scrubber showed all 12 months in one run
  (Play end, or keyboard visit set = 12) · 2 `banjir` Lihat dampak banjir — `isEvent(e,'econ.updated') &&
  e.source==='indeks-ekonomi' && e.payload.kind==='banjir'` · 3 `dampak` Ukur dampak operasi pasar — markMission when
  `programImpact` renders for an `operasi-pasar` program · 4 `briefing` Ekspor briefing kebijakan — `econ.briefed` source
  indeks-ekonomi. Role hints carry `hintSm`. Next card → Sinyal Pasar.
- **Focus arrivals:** `<kecId>` or `<kecId>:<YYYY-MM>` → Peta, scrubber to month, kecamatan selected + drawer + flash
  (hidden ⇒ hatch tooltip only); `OP-` → Dampak with that op; `PW-` (flood alert) → Peta current month + zones; `LN-` →
  Dampak "Modal kerja"; bad ⇒ default + toast.
- **AI** ("Tanya ekonom", lazy): `jelaskan_kecamatan` → `insight` (from `econSeries` + `econEvents` + harvest/alert
  causes), `peringkat` → `insight` + local bar list, `dampak_program` → `indeks-ekonomi/impact` `{ programId, effectPct,
  measured, method: 'selisih-ganda', confidence: 'rendah'|'sedang', note }`, `susun_briefing` → `indeks-ekonomi/briefing`
  `{ headline ≤ 120, points: { text, refs }[3–5], recommendations: string[3], caveat }`; a hidden kecamatan asked ⇒ fixed
  anonymity answer (no number). Prompt: keep `query_world` + `econ_insight`; add `econ_brief` + mocks; context = kabupaten
  series, visible cells only (hidden ids listed as hidden), today's econ events, active alert, programs + impacts.
- **Numbers that agree:** map cell = list = drawer = briefing = Meja Pimpinan `econ_index` (latest month) = AI · Δ in toast
  = audit = map delta chip · kabupaten omzet/index = `econSeries(null)` everywhere · pulse tx = Toko `outletKpis().total.tx` ·
  op effectPct = Sinyal Pasar `opSimulate` / `marketOps.effectPct` · price lines = Sinyal Pasar `commodityIndex` · loan Σ =
  Rapor bank amounts · local spend = `catalogKpi` · hidden set identical in all views.
- **390:** Tabs scroll; map 52 vh then scrubber row (in the canvas flow, 48 px: Play + month + ‹ ›; never sticky over the
  pill or toasts); KecamatanList as cards; legend in a collapsible chip; drawer full height; KPI 2-up; Dampak picker =
  Segmented; Briefing preview in a full-screen Drawer with the Ekspor button at its end. No side padding < 640 px.
- **Self-check (extra):** anonymity crawl over all 12 months (both hidden kecamatan null on map, list, drawer, sectors,
  briefing, AI); 12 frames ≤ 9 s at 1×, list reorders by transform; reduced motion = discrete steps; `emit flood.alert` ⇒
  ≤ 1 s C35 drop by the formula + delta chip + "Kejadian ekonomi" row + Siaga toast landing `?focus=<kec>:<month>`; `emit
  market.operation running` ⇒ C34 recovery ≤ 1 s; briefing paper numbers = screen; Kepala instruction carries the
  econIndex ref; Dinkop never shows a business name.

### P17 · Sinyal Pasar — `src/demos/sinyal-pasar/` · `dk-sp-` · prompt `sinyal-pasar.ts` · port 4414
- **Roles / frame:** `disperindag` (default, `BrowserFrame` `demo.gamada.id/sinyal-pasar`, tabs
  `?tab=ringkasan|peta|operasi|langganan`, filters `?commodity=`, `?market=`) · `pemilik-toko` (`PhoneFrame` "Sinyal Pasar
  untuk UMKM" centred + desktop side panel "Bahan yang Anda pakai"; tabs `peringatan|langganan`; skeleton "Menyiapkan
  data usaha…" until its readiness call, §1.1). Role switch keeps commodity filter and open alert.
- **First 30 s (07:00, ×10, Disperindag):** `Ticker` on top `[data-tour=sp-ticker]` (`priceTicker`, transform-only scroll,
  paused on hover/focus/off-screen, pause button 44 px, static list under reduced motion) with price + 7-day Δ
  (`weekChangeOf`). KPI strip "Data simulasi" (`pdKpi`): Komoditas dipantau · Pasar · Anomali aktif · Peringatan dini ·
  Pelanggan UMKM. `Board` (`priceBoard`, sorted by \|Δ vs musiman\|, `Sparkline` per row; `Table` → cards < 640).
  **Alive:** 07:01 natural `price.updated` at `tickMarketId` ⇒ ticker cell + board row flash (≈ 6 s), then every world
  minute while open. Card "Kejadian di daerah": no alert ⇒ "Belum ada peringatan banjir" + "Putar skenario banjir (dari
  Siaga Wilayah)" (`ensureFloodScenario`); autoplay via `useFloodAutoplay(true)` at 07:06 (≈ 36 s). After the flood:
  "Peringatan dini" card (C31, `[data-tour=sp-warning]`) "Cabai rawit merah: puncak diperkirakan +x % dalam 5 hari
  (Pasar <name>)" ≤ 1 s; at flood +2 the cabai row turns red "Anomali" + toast (C33) `[data-tour=sp-anomaly]`. Hotspot
  `[data-hotspot=sp-anomaly]` "Mulai di sini: buka anomali harga".
- **Detail drawer** (row / card click): `OutlookChart` `[data-tour=sp-outlook]` (`LineChart` 30 d history + 14 d
  `forecast` band from `priceOutlook`, peak marker), factor chips (musim, pasokan, banjir, operasi) with pct, "Tindakan":
  "Rekomendasikan operasi pasar" `[data-tour=sp-recommend]` → dialog (markets pre-ticked from the warning/anomaly,
  `RangeField` volume ton, days Segmented 3/5/7, live effect from `opSimulate`) → "Kirim ke Meja Pimpinan" ⇒
  `market.operation` recommended (`sentBy: 'disperindag'`, §1.9 #9); "Pantau distributor" → list `distributorsFor`
  (fictional, kecamatan real, stock days) → "Pantau n distributor" ⇒ `distributor.watched` (rows get a "Dipantau" chip);
  "Imbauan ke UMKM" → Langganan tab.
- **Operasi Pasar tab** `[data-tour=sp-simulate]`: ops list (`opView`: stage chip, `sentBy`, markets, volume, days) incl.
  the seeded past op (done, measured); `OpSimulator` (volume/days `RangeField`s, "Simulasikan" ⇒ "sesudah" curve over
  "tanpa operasi", works before approval). A C13 op shows "Usulan otomatis · belum dikirim Disperindag". "Mulai operasi
  pasar" (stage `running`) is enabled once `approved`; before that disabled WITH reason "Menunggu persetujuan Kepala
  Daerah" + link `/demo/meja-pimpinan?focus=<opId>`; auto-approval (§1.6) after 4 world min. Running ⇒ C34 flattens the
  forecast ≤ 1 s; `done` at +90 world min ("3 hari, dipercepat untuk demo") clears the anomaly chip.
- **Peta tab** (lazy): `MapView` + `marketMarkers` coloured by Δ %, `alertZones`; "Daftar pasar" list toggle for non-map use.
- **Langganan:** Disperindag: subscriber count (`pdKpi().subscribers`, fictional count, no names) + alert rules per
  commodity. Pemilik Toko: tick commodities + threshold (5/10/15 %) + channel (WA/aplikasi) → "Simpan" ⇒ `price.subscribed`.
- **Pemilik Toko inbox** `[data-tour=sp-umkm-alert]`: `alertsFor(shopId)` (warning + anomaly cards, WA style via
  `ChatThread`, each with Δ, peak day, market, "simulasi", advice "stok secukupnya untuk 5–7 hari", never hoarding);
  per alert "Siapkan PO di Toko Autopilot" ⇒ `po.drafted` (`umkmPoPayload`; when null: "Draf PO sudah ada · Buka di Toko
  Autopilot" link that also marks the mission), "Buka prediksi stok" →
  `/demo/toko-autopilot?tab=prediksi&outlet=warung&focus=<cm SKU id>`. Side panel: shop `cm:` SKUs with onHand +
  `demandForecast().daysLeft`. No op controls, no other UMKM names.
- **Missions:** 1 `anomali` Temukan anomali — markMission when the detail of a row with `anomaly: true` rendered its chart
  · 2 `rekomendasi` Rekomendasikan operasi pasar — `isEvent(e,'market.operation') && e.source==='sinyal-pasar' &&
  e.payload.stage==='recommended'` · 3 `efek` Lihat efeknya — markMission when the simulator drew an "after" series ≠
  baseline · 4 `umkm` Peringatan untuk UMKM — `isEvent(e,'po.drafted') && e.source==='sinyal-pasar'` or the markMission of
  the existing-draft link (`hintSm` ⋯ → Peran) · 5 `langganan` Atur langganan — `price.subscribed` source sinyal-pasar.
- **Focus arrivals:** `<marketId>:<commodityId>` → ringkasan + drawer; `OP-` → operasi with op; `PDN-` → warning card;
  `GJ-` → the shock's warning card; `PA-` → Pemilik Toko inbox alert; `DW-` → drawer distributor list; bad ⇒ default + toast.
- **AI** ("Tanya Sinyal Pasar", lazy `Assist.tsx`): `jelaskan_anomali` → `insight`, `rekomendasi_aksi` →
  `sinyal-pasar/action-plan` `{ commodityId, actions: { kind: 'operasi-pasar'|'pantau-distributor'|'imbauan', marketIds,
  volumeTon?, days?, why: Bi }[], expectedEffectPct }` (numbers = `opSimulate`), `pesan_umkm` → `sinyal-pasar/umkm-alert`
  `{ commodityId, peakInDays, peakPct, text, advice }`, `ringkas_pasar` → `insight`. Prompt: keep `price_alert`; add
  `plan_market_action` + `draft_umkm_alert` + mocks; context = top 10 board rows, warnings/anomalies, supply signals, ops
  with stage, subscriber count; ethics line (no speculation/penimbunan; prices simulasi).
- **Numbers that agree:** board price = ticker = map popup = drawer = `PricePoint.price` · Δ vs musiman = `price.anomaly`
  deltaPct = C13 reason = Meja briefing = C20 Toko reason · 7-day Δ everywhere = `weekChangeOf` · peak % and "5 hari"
  identical in warning card, UMKM alert, AI, `price.warning` payload · simulator effect = `market.operation.effectPct` =
  IE `programImpact` · "Anomali aktif" = count of `prices.anomaly` · subscriber count = `pdKpi` · PO draft qty = Toko PO tab.
- **390:** ticker = one 44 px line (chip scroller rule) with pause; KPI 2-up; Board = commodity cards with Segmented
  picker; drawer full height; simulator sliders stacked under the chart; Pemilik Toko without PhoneFrame chrome < 640;
  toasts top (`setToastPlacement`); no sticky bottom bar.
- **Self-check (extra):** no UP chunk in the Disperindag first load; flood ⇒ warning ≤ 1 s, anomaly at +2; recommend ⇒
  `instructionSuggestions(world)` contains the op and `/demo/meja-pimpinan?focus=<opId>` shows it; Toko C20 factor 1.6 +
  `po.drafted` visible at the PO landing; "Mulai" disabled with reason before approval, enabled after; running ⇒ prices
  step down; no repeated sentence in warnings/explanations/alerts over a full day.

### P0 · GAMADA Inti — `src/demos/inti/` · `dk-in-` · prompt `inti.ts` · port 4415
- **Roles / frame:** `kepala-daerah` (default: all 17 products in Data/Kanal/Audit; Kanal default filter "Warga") ·
  `sekretariat` (same scope + Inti ID "Kelola peran": matrix cells toggle a PREVIEW, badge "pratinjau, tidak menyimpan ke
  produk", Reset; Audit shows the actor column first) · `pemilik-toko` (scope = own business via `scopeOf`; SD rows hidden
  with visible note "Data pemda tidak tampil untuk peran ini (contoh pembatasan akses)"). `BrowserFrame`
  `demo.gamada.id/inti`; desktop left rail of 5 modules (vertical `Tabs`, `intentProps` per lazy tab) `?tab=data|id|
  agen|kanal|audit` (default data), `?focus=`, `?as=<roleId>` (Inti ID preview), `?root=<ref>`, `?product=<slug>` (Audit).
  Role switch keeps tab, root and filters. `/ekosistem/inti` is Tahap 6.
- **First 30 s (Data):** `PulseStrip` (17 product dots in 3 eco clusters + Inti centre, pure SVG; a dot pulses by
  opacity/scale when an audit row of that product lands, `platformPulse`) + counter "Kejadian hari ini: N"; KPI line
  (chip "simulasi"): Produk aktif 17 · Peran (= `ROLES.length`) · Kejadian hari ini · Pesan belum dibaca (`inboxKpi`) ·
  Agen berjalan hari ini (`useAiTraces().length` this session). **Alive:** 07:01 SD naturals + KL natural need + core sale
  light ≥ 3 dots within 10 s. Root chips: "Aduan Ibu Siti", "Peringatan banjir", "Paket pompa darurat", "Tender
  karung–terpal", "Toko <shop>" (each disabled WITH reason until its entity exists, e.g. "Belum ada peringatan banjir").
  `TrailLanes` canvas (6 lanes = `TRAIL_SPINE`, nodes, path drawn by stroke-dashoffset in order, one GSAP timeline on the
  kit ticker; keyboard step list as text alternative). No story yet ⇒ empty state + real button **"Putar jejak aduan Ibu
  Siti (versi cepat · simulasi)"** `[data-hotspot=trail-play]` = lazy `playDayStory()` (missing steps ~0.6 s apart;
  each lane lights as its event lands; `aria-live`). Story already ran ⇒ the trail renders at once. Node click ⇒ Drawer
  (summary, `BizBadges` for business refs, "Buka di <produk>" link, "Lihat di Audit" = Audit tab with that row flashed).
- **Inti ID:** role list (`Picker` on phones) + ONE demo account "Akun demo GAMADA" (no personal name) + this session's
  role history; `AccessMatrix` (pure props `{ roles, products, allowed, active, onCell }`) role × 17 from `accessMatrix()`;
  checks animate (opacity/scale) on role change; ✓ cell = link "Buka <produk> sebagai <peran>" `/demo/<slug>?role=<roleId>`
  (READY targets only); ✗ cell disabled with reason "Peran ini tidak punya akses".
- **Inti Agen:** `lastTrace()` of ANY product (product badge, "dari Sapa Warga 08.17"), list of the 10, `TraceTimeline`:
  Intent (id + confidence %) → each tool (name, product, ms, input/output collapsible) → Data (structured kinds) →
  Jawaban (first-token/stream ms, Sim/Live badge). Inti's own console (lazy `useAiChat`) with chip "Tangani banjir Kec.
  <alert kec> dari aduan sampai pengadaan". Empty ring ⇒ honest empty state + that chip.
- **Inti Kanal:** `unifiedInbox` (filters WA / web / telepon / semua, eco, unread), thread in a Drawer (`ChatThread`),
  "Tandai dibaca" ⇒ `chat.read`; "Buka percakapan di <produk>" → `/demo/<product>?focus=<id>`.
- **Audit Log:** `auditQuery` filters (product, eco, type, actor, text, time) in a Drawer on phones; `AuditTable`;
  "Ekspor CSV" / "Ekspor JSON" (`auditCsv`/`auditJson`, ID/EN headers, file `audit-gamada-<region>-<HHMM>.csv`).
- **Missions:** 1 `jejak` Lihat jejak data — markMission when `dataTrail(...).spine` has 6/6 lit (after animation, at once
  under reduced motion) · 2 `peran` Ganti peran — markMission on a preview role change to another ecosystem with the matrix
  rendered (`hintSm`) · 3 `agen` Lihat jejak berpikir — markMission when the timeline shows ≥ 4 steps + answer done ·
  4 `kanal` Baca pesan — `isEvent(e,'chat.read') && e.source==='inti'` · 5 `audit` Ekspor audit — markMission on download
  (blob created). Next card → first trail product not yet visited.
- **Focus arrivals:** `AU-` ⇒ Audit row flashed; `table:id` or any other entity id ⇒ Data with that root; `?tab=audit
  &product=<slug>` ⇒ filtered; unknown ⇒ default + toast. Story replay raises the products' normal shell toasts (C1/C3/C7/
  C11), none attributed to Inti.
- **AI:** sim `inti/scenario.ts` ≥ 10 intents: `rencana_banjir` → shared `plan` + 5 tool steps (`cek_peringatan`
  siaga-wilayah, `klaster_aduan` sapa-warga, `susun_instruksi` meja-pimpinan, `cek_hps` awas-belanja, `cari_umkm`
  katalog-lokal) quoting world numbers; `jejak_entitas` → `inti/trail` `{ root, products[], rows }` + "Tampilkan di Inti
  Data"; `siapa_akses` → `inti/access` `{ role, allowed, denied, note }`; `ringkas_hari` → `insight`; `kanal_hari_ini`;
  `cari_audit`; `produk_terkait`; `umkm_siap_pasok`; `status_pajak_toko`; `harga_pangan`; fallback. Step ms
  deterministic from intent + index (80–900 ms). Prompt: keep `plan_agents`; add `trace_entity`, `explain_access` +
  mocks; context ≤ 6 KB (role + scope, `platformPulse`, active alert, last 15 audit summaries, trail rows, `inboxKpi`,
  matrix row); unknown slugs ⇒ sim.
- **Tour hooks (ch. 19, 17:00):** `[data-tour=in-trail]`, `[data-tour=in-trail-play]`, `[data-tour=in-matrix]`,
  `[data-tour=in-agent]`, `[data-tour=in-audit]`.
- **Numbers that agree:** pulse "Kejadian hari ini" = Audit unfiltered today count · every trail node = an Audit row with
  the same `auditId` and summary · Siti complaint code = Sapa Warga console · cluster size = Sapa Warga cluster panel ·
  package HPS on the Awas Belanja node = `packages()` HPS · need qty on the KL node = KL need card · Kanal unread =
  Σ `chats.unread` + unread complaints · calls today = Juara Jualan `salesKpi` · matrix ticks = `PRODUCTS[].roles`.
- **390:** pulse strip = 3 eco rings + count; rail = top scrolling Tabs; TrailLanes vertical (lanes = rows, 44 px nodes);
  step detail in a Drawer; matrix = role Picker + list of 17 products with ✓/✗ (grid ≥ 640 with sticky first column);
  Audit = cards; Kanal list → full-height Drawer thread; filters in a Drawer.
- **Self-check (extra):** "Putar jejak" ⇒ 6 lanes in order ≤ 6 s (×1), every node's `auditId` in `auditLog`, Audit tab row
  same text; story twice ⇒ no duplicates; matrix loop 25 × 17 = `PRODUCTS[].roles.includes(role)`; pemilik-toko scope
  has no row without a shop ref; a question asked in Sapa Warga shows in Agen after navigating (sessionStorage) or an
  honest empty state; `chat.read` lowers unread in Inti AND the source product; CSV rows = visible rows.

---

## 3 · Cross-product chains (exact event names; ids continue after C29)

World self-test `pd.selftest.ts` (mini fixture AND every pack) and `tests/e2e/chains.spec.ts` (world level, kit agent)
cover C30–C38. Builders verify the rows that name their product; the integrator adds the UI-driven variants.

| # | Root (source) | Reaction id → follow-ups (source) | Visible in / toast → landing |
|---|---|---|---|
| C30 | `flood.alert` (siaga-wilayah · clock 07:06) | 'flood→price-shock' → `price.shock` ×2 (`facts.pd.shockCommodityIds`; markets in the alert kecamatan, else the nearest ≤ 3; `peakDay` 5; pct cabai +22 / beras +9, simulasi; once per alert × commodity) (sinyal-pasar) | Siaga toast lists Sinyal Pasar → `/demo/sinyal-pasar?focus=<shockId>` |
| C31 | `price.shock` (new, not a patch) | 'shock→warning' → `price.warning` (`peakInDays` 5, `peakPct` = `priceOutlook` peak, `expected`) (sinyal-pasar) | "Peringatan dini: <komoditas> diperkirakan +x % dalam 5 hari" → `/demo/sinyal-pasar?focus=<PDN-id>` |
| C32 | `price.warning` | 'warning→umkm-alert' → `price.alertSent` per `priceSubs` row whose commodities include it and whose threshold ≤ peakPct (shop seeded) (sinyal-pasar) | "Peringatan stok <komoditas> lebih awal untuk <shop>" → `/demo/sinyal-pasar?role=pemilik-toko&focus=<PA-id>` |
| C33 | natural-pd shock path (clock, origin sinyal-pasar) | `price.anomaly` when a shocked pair leaves `seasonalBand().hi` → existing C13 `market.operation` recommended (Meja) + C20 `stock.forecastChanged` ×1.6 (toko-autopilot) → C15 PO draft | "Harga <komoditas> di <pasar> +d % di atas pola" → `/demo/sinyal-pasar?focus=<marketId>:<commodityId>`; Toko → `?tab=prediksi&outlet=warung&focus=<productId>` |
| C34 | `market.operation` stage `running` (sinyal-pasar · meja-pimpinan) | 'op→price-relief' → `price.shock` patch `damp` (from `opSimulate`, forecast flattens ≤ 1 s) (sinyal-pasar) · 'op→econ' → `econ.updated` kind program, op markets' kecamatan `+round(\|effectPct\| × 0.25, 1)`, cause `ref('marketOps', id)`, once per op (indeks-ekonomi) | "Dampak operasi pasar dicatat di Indeks Ekonomi" → `/demo/indeks-ekonomi?tab=dampak&focus=<opId>` |
| C35 | `flood.alert` level ≥ 2 | 'flood→econ-nowcast' → `econ.updated` kind banjir per alert kecamatan with a current-month row: `index × (1 − (0.04 + 0.05 × riskFlood))` rounded 0,1, cause `ref('alerts', id)`, reason "Peringatan banjir: aktivitas usaha Kec. <k> diperkirakan turun", once per alert × kecamatan (indeks-ekonomi) | Siaga toast lists Indeks Ekonomi → `/demo/indeks-ekonomi?tab=peta&focus=<kecId>:<YYYY-MM>` (lowest) |
| C36 | `need.created` (any source except a natural need that carries matches) | 'need→catalog-match' → `match.made` ×≤ 6 verified businesses with `matchScore ≥ 0.45`, staggered (katalog-lokal) | KL MatchBoard lines; Awas Belanja `localBenchmarks` fills; no toast of its own |
| C37 | `order.paid` (katalog-lokal), order of the shop | 'order→ledger' → `ledger.posted` source `katalog`, Kas D / Pendapatan C = `order.total`, refId orderId (pajak-beres) → core 'ledger→score' `score.updated` (rapor-usaha) | "Pembayaran <code> dicatat di Pajak Beres" → `/demo/pajak-beres?focus=<ledgerId>`; Rapor → `?focus=<shopId>` |
| C38 | `loan.approved` (rapor-usaha), shop loan | 'loan→ledger' → `ledger.posted` source `pinjaman`, Bank D / 2301 Utang Pinjaman C = approved amount, refId loanId (pajak-beres) | "Pencairan Rp … dicatat di Pajak Beres" → `/demo/pajak-beres?tab=jurnal&focus=<ledgerId>` |

Depth: flood 0 → shock 1 → warning 2 → alertSent 3 (≤ `WORLD.maxDepth` 4); flood 0 → need 1 (C5) → match 2.
Existing chains that now land in PD: C5 (KL need), C10 (IE), C11 (KL need), C13 (SP op), C19 (RU score), C20, C21/C26
(from a KL need; C26 guard `source !== 'clock'`), C27 (KL match on `matchScore`).

**State links (no event; selectors read state; toasts via `EFFECT_ALSO`; numbering continues Tahap 3 L1–L6):**
| # | Root | Read by | Landing |
|---|---|---|---|
| L7 | `tax.ready` (pajak-beres) | KL "Pajak Rapi" badge, RU pajak factor (score via existing tax→score) | `/demo/katalog-lokal?focus=<shopId>` · `/demo/rapor-usaha?focus=pajak` |
| L8 | `partner.verified` (kenal-mitra) | KL `catalogShortlist` (card moves into `top`), RU bank row score + rec | `/demo/katalog-lokal?focus=<needId of the C27 match>` · `/demo/rapor-usaha?role=bank-mitra&focus=<bizId>` |
| L9 | `bid.submitted` on a tender with `needId` (tenderpilot) | KL `offerFor` source `bid` | `/demo/katalog-lokal?focus=<needId>` |
| L10 | `order.created` with a tender (katalog-lokal) | reducer: tender `selesai`, bids menang/kalah (TenderPilot Riwayat) | `/demo/tenderpilot?tab=riwayat&focus=<bidId>` |
| L11 | `order.shipped` shop order | reducer: shop onHand −qty (Toko Prediksi/Kasir) | `/demo/toko-autopilot?tab=prediksi&focus=<productId>` |
| L12 | `consent.granted` / `econ.updated` / `market.operation` | RU bank queue scopes; SP drawer context line "Indeks omzet Kec. X turun y"; Meja Pimpinan op + IE `programList` | in-canvas |
| L6 (Tahap 3) | `need.created` | Toko Autopilot opportunity card now links to `/demo/katalog-lokal?focus=<needId>` (integration) | — |

---

## 4 · Do not touch (builders)

- `src/demo-kit/**` (world, shell, ui, viz, map, docs, media, ai, region, frames, i18n, CONTRACTS.md).
- `src/demos/registry.ts`, `src/demos/_placeholder/**`, and **every Tahap 2 and Tahap 3 product folder**:
  `sapa-warga`, `siaga-wilayah`, `meja-pimpinan`, `naskah-pintar`, `radar-isu`, `awas-belanja`, `cek-berkas`,
  `toko-autopilot`, `pajak-beres`, `juara-jualan`, `kenal-mitra`, `pantau-merek`, `tenderpilot` (patterns to copy ideas
  from, never to import), and the other Tahap 4 folders.
- `src/routes/**`, `src/router.tsx`, `src/routeLoaders.ts`, `src/content/**` (incl. `products.ts`), `src/lib/**`,
  `src/styles/**`, `src/main.tsx`, `src/index.css`, `src-art/**`, `index.html`.
- `server/ai-proxy/src/**`, `prompts/_shared.ts`, `prompts/index.ts`, `server/ai-proxy/test/**`, other products' prompt files.
- `tests/e2e/**` except your own `tests/e2e/tahap4/<slug>.spec.ts`; `playwright.config.ts`, `vite.config.ts`,
  `tsconfig.json`, `package.json`, `package-lock.json`, `tools/**`, `docs/**`, `public/**`.
- No new npm dependencies. No git commands.
- Kit agent: touches Tahap 2/3 product folders NOT at all either (the `reviewSuggestion`/`reviewedLines` copy lives in
  `world/up/books.ts`; Pajak Beres switching its import, Sapa Warga reading `sd/persona.ts`, Kenal Mitra/Toko/TenderPilot
  dropping "(demo tahap 4)" are integration steps).

---

## 5 · Size plan per demo (gzip -9, beyond home, `VITE_DEMO_CONTROLS=1` build, MapLibre engine excluded)

Floors (kit asserts, writes measured values into CONTRACTS): SD kit floor 105,3 KB (Tahap 3 measured) · `pd/boot` ≤ 4,2
· `up/data` ≤ 15,5. **IE / SP-Disperindag floor ≤ 110 ⇒ own ≥ 65 KB** (IE's map kit + kecamatan JSON count as own).
**KL / RU / Inti / SP-Pemilik-Toko floor ≤ 125 ⇒ own ≥ 50 KB.**

| Demo (landing) | First load own | Total | Intent-loaded (each) | After action (reported) |
|---|---|---|---|---|
| Katalog Lokal `ukpbj` | index + FlipStage + KPI + composer + NeedList ≈ 11, NeedSpecCard + MatchBoard + SupplierCard + BizBadges ≈ 9, pd/katalog ≈ 5, strings Pemda + css ≈ 9, phone peek ≈ 3 ⇒ ≈ 37 | ≈ 162 | Umkm side 14 · Compare + Stepper 7 · Peta: map kit ≈ 30 + geo · composer AI 15 · Tanya Katalog 4 | pd/chains 8 · UP live + chains ≈ 26 (user need) |
| Katalog Lokal `?role=pemilik-toko` | index + FlipStage + Umkm + strings ≈ 30, UP selector slice ≈ 4 ⇒ ≈ 34 | ≈ 159 | Pemda side 20 | as above |
| Rapor Usaha `pemilik-toko` | index + Rapor (ScoreDial, waterfall, actions, Data masuk) ≈ 13, strings ≈ 5, pd/rapor + books ≈ 6, css 2 ⇒ ≈ 26 | ≈ 151 | Review drawer 3 · Modal (loan sim + timeline + RangeField + MoneyInput) 8 · Consent 4 · Berbagi 3 · trend LineChart 7 | Tanya skor ≈ 14 · UP live + chains (ledger.reviewed) |
| Rapor Usaha `?role=bank-mitra` | index + Antrian + strings ≈ 12, selectors ≈ 6 ⇒ ≈ 18 | ≈ 143 | bank Drawer 6 · Riwayat 3 | Ringkas pengajuan ≈ 14 |
| Indeks Ekonomi `bappeda` | map kit ≈ 18 + kecamatan JSON ≈ 14,8 + index/KPI/Peta/list/pulse/strings ≈ 23 + pd/econ ≈ 3 ⇒ ≈ 59 | ≈ 169 | Sektor 6 · Harga 7 (+ d3 shared ≈ 8 once) · Dampak 9 · Briefing + PaperFrame 8 · Drawer 4 · AI 14 | flood helper + UP live/chains (flood is a UP trigger) ≈ 31 |
| Indeks Ekonomi `dinkop` (Sektor first, no map) | ≈ 30 | ≈ 140 | Peta (map + geo) ≈ 33 | — |
| Indeks Ekonomi `kepala-daerah` (Ringkasan + compact map) | ≈ 60 | ≈ 170 | instruction dialog 3 | — |
| Sinyal Pasar `disperindag` | index + KPI + Ticker + Board + AnomalyCard ≈ 14, strings + css ≈ 7, pd/prices + forecast ≈ 5 ⇒ ≈ 26 | ≈ 136 | Drawer (OutlookChart + Actions) 14 · Operasi + OpSimulator 8 · Langganan 4 · Peta ≈ 30 + geo · Assist 14 | UP live + chains after flood/anomaly ≈ 31 |
| Sinyal Pasar `?role=pemilik-toko` | index + Umkm + ChatThread + strings ≈ 18, UP slice ≈ 3 ⇒ ≈ 21 | ≈ 146 | Langganan 4 | `po.drafted` ⇒ UP live + chains |
| Inti `kepala-daerah` (all roles same) | index + rail + PulseStrip + KPI + Data (TrailLanes, chips) + `world/inti` + strings ≈ 30 | ≈ 155 | Inti ID + AccessMatrix 6 · Kanal (+ChatThread) 7 · Audit + export 6 · Agen + TraceTimeline 6 | story.ts + SD pieces 8–12 · UP chains · Agen console ≈ 16 |

Rules: target ≤ 175 KB per route and per role landing; hard limit 180. SD and UP demos must not grow (± 0,5 KB) beyond
their Tahap 3 numbers; home JS ≤ 253,6 KB. Never import `world/satu-daerah`, `world/usaha-pintar`, the docs samples
barrel or the `ai` barrel at module top level; the map kit at top level only in Indeks Ekonomi. If KL or IE exceeds 172:
KL cuts strings per side first (Umkm strings lazy); IE moves the pulse sparkline + `ActivityFeed` to the Peta tab's second
paint (`preloadOnIntent` on the list). Fallback if RU > 170: waterfall as a list on first paint, SVG on intent.

---

## 6 · Owner questions (few; each has a default that the build uses unless the owner objects)

**P1 · Katalog Lokal: posisi dan pembayaran.** Katalog Lokal ditampilkan sebagai etalase daerah generik yang
melengkapi, bukan menggantikan, katalog elektronik nasional; tidak ada nama atau merek portal nyata di mana pun.
Pembayaran oleh Pemda ditulis "Transfer dari Kas Daerah (simulasi)" setelah barang diterima; tanpa QRIS, nomor virtual
account, atau nama payment gateway. **Default: ya, seperti ditulis; satu kalimat FAQ di Tahap 6.**

**P2 · Rapor Usaha: satu koperasi dan rumus pinjaman.** Alur pinjaman hanya ke **Koperasi Mitra Usaha Sejahtera** (koperasi
yang sama yang meminta KYC di Kenal Mitra), ditampilkan sebagai penerima tetap; lembaga fiktif lain hanya muncul di
riwayat antrian. Angka (semua berlabel simulasi): plafon = rata-rata laba bersih Sep–Okt × 1–4 menurut pita skor,
bunga flat 0,75–1,25 %/bulan, DSR ≤ 35 %; toko contoh mendapat Rp 150 jt (cicilan Rp 13.775.000/bulan, 12 bulan) setelah
skor ≥ 750. **Default: seperti ditulis.**

**P3 · Sinyal Pasar: harga acuan, waktu, dan persetujuan otomatis.** (a) Harga acuan resmi pemerintah (HET/HAP) TIDAK
ditampilkan; pembanding = "pola musiman (simulasi)" dari riwayat 60 hari dunia demo. (b) Operasi pasar "3 hari"
dipercepat menjadi 90 menit dunia, berlabel "dipercepat untuk demo". (c) Bila rekomendasi Disperindag belum disetujui di
Meja Pimpinan dalam 4 menit dunia, dunia demo menyetujuinya sendiri dengan label "Disetujui Kepala Daerah (simulasi)"
supaya sandbox tidak buntu. **Default: ya untuk ketiganya.**

**P4 · Indeks Ekonomi: ambang dan data contoh.** Ambang anonimitas 10 usaha (sesuai spek); struktur sektor dari pack
berlabel "simulasi" dengan baris sumbernya; metode dampak "selisih-ganda (simulasi)" dengan proyeksi diberi label
"proyeksi"; dunia demo diberi SATU operasi pasar beras fiktif ±35 hari lalu (selesai) supaya "Ukur dampak" langsung bisa
dicoba (ini sedikit mengubah satu deret harga beras di satu pasar). **Default: ya.**

**P5 · GAMADA Inti: putar ulang cerita dan akun demo.** (a) Tombol "Putar jejak aduan Ibu Siti (versi cepat · simulasi)"
mengubah dunia bersama (peringatan banjir, aduan Siti, instruksi muncul di semua produk di browser ini); Reset di shell
membatalkannya. (b) Akun di Inti ID bernama "Akun demo GAMADA" tanpa nama orang; pejabat hanya dengan jabatan. (c) Mode
"Kelola peran" Sekretariat hanya pratinjau (tidak mengubah daftar peran produk lain), dengan Reset. **Default: ya untuk
ketiganya.**

---

## 7 · Spec §11 coverage and deliberate deferrals

| §11 requirement | Where |
|---|---|
| **P14** frame split + big toggle with card flip | P14 Roles/frame, 1440 Pemda/UMKM (`FlipStage`) |
| P14 roles UKPBJ/OPD · Pemilik Toko | P14 Roles (`setSession`) |
| P14 "Buat kebutuhan" natural language → AI spec | P14 Composer / AI (`need-spec`, parser, chips) |
| P14 matching animation, lines, some light up | P14 MatchBoard + C36 / natural matches |
| P14 shortlist badges Terverifikasi · Pajak Rapi · Skor Usaha, distance on map, price, capacity | `catalogShortlist`, `BizBadges`, `offerFor`, Daftar/Peta |
| P14 Bandingkan → pilih → pesanan | P14 Compare + order (`order.created`) |
| P14 UMKM side: etalase, pesanan masuk, konfirmasi kapasitas, status kirim, pembayaran (simulasi) | P14 1440 UMKM (`vendorStorefront`, `order.confirmed/shipped/paid`) |
| P14 wow (instant verified match; one click switches side) | natural/C36 ≤ 1,2 s; toggle; self-check ≤ 1 s |
| P14 events emit need/match/order; consume partner.verified, tax.ready, score.updated, bid.submitted, procurement.flagged | §1.4; L7–L10; flag chip in `needView` |
| P14 missions buat · pilih · konfirmasi; pass check (badged top, order ≤ 1 s) | P14 Missions 1, 3, 4; self-check |
| **P15** frame BrowserFrame + panel Sisi Bank/Koperasi; roles | P15 Roles/frame |
| P15 dial 0–1000 animated; 6 factors with ±; 12-month trend; "Cara menaikkan skor" 3 actions | `ScoreDial`, `FactorWaterfall`, trend LineChart, `scoreActions` |
| P15 consent screen (what, to whom, how long) | ConsentCard, `consent.granted/revoked` |
| P15 loan sim (plafon, tenor, cicilan, timeline); bank queue with score + recommendation | Modal kerja, `loanOffer`, LoanTimeline, `lenderQueue`, `loanAdvice` |
| P15 flows 1–3; wow; events (emit score.updated, loan.applied; consume ledger.posted, tax.ready, partner.verified, sale.created) | P15 sections; C19, C37, L7, L8, "Data masuk" |
| P15 missions; pass (deterministic score; approval on both sides) | P15 Missions 1–5; self-check |
| **P16** frame + real kecamatan choropleth; roles Bappeda · Dinkop · Kepala Daerah | P16 Roles/frame, first screen |
| P16 12-month time-lapse with Play; sector breakdown; staple price trends; program impact (op OR modal); briefing PaperFrame | TimeScrubber, Sektor, Harga, Dampak, Briefing |
| P16 anonymity < 10 hidden + hatch + tooltip | `econFrame.hidden`, `belowThreshold`, `anonHidden`, self-check crawl |
| P16 flows 1–4; wow; events (emit econ.updated; consume sale.created, flood.alert, market.operation) | missions 1–4; C34, C35, `econPulse` |
| P16 pass (aggregates = world sales; threshold everywhere) | numbers-agree; anonymity crawl |
| **P17** frame + ticker; roles; ticker per real market; table with sparkline; anomaly; 14-day forecast band; market map; action recs (op, distributor); UMKM subscriptions | P17 sections (`priceTicker`, `priceBoard`, C33, `priceOutlook`, Peta, Actions, `distributor.watched`, Langganan) |
| P17 flows 1–5 (flood rise; warning 5 days before peak; recommend → Meja; simulate → flattens; UMKM "stok beras lebih awal" → Toko) | C30, C31, C32, mission 2 + §1.9 #9, C34, UMKM inbox `po.drafted` |
| P17 events (emit price.anomaly, market.operation; consume flood.alert, econ.updated); pass (anomaly from flood; effect reaches Meja AND Toko) | C33, L12; self-check |
| **P0** routes `/demo/inti` (+ `/ekosistem/inti` deferred) | P0 Roles/frame |
| P0 Inti ID (roles, one account switching, matrix with animated checks) | Inti ID |
| P0 Inti Agen (last request in any product: intent → tool → data → answer with durations) | `ai/trace.ts`, TraceTimeline |
| P0 Inti Kanal (merged WA/web/telepon) | `unifiedInbox`, `chat.read` |
| P0 Inti Data (trail graph across 6 products, lines light in order) | `dataTrail`, `TRAIL_SPINE`, `TrailLanes`, `playDayStory` |
| P0 Audit Log (every event, filter, export) | `auditQuery`, `auditCsv/Json` |
| P0 wow + pass (trail = audit log; matrix = role definitions) | P0 self-check |

Deferred on purpose:
- §13 product pages and `/ekosistem/inti` story page: Tahap 6. Builders ship the pure-props components now (MatchBoard,
  FlipStage, ScoreDial use, FactorWaterfall, ConsentCard, LoanTimeline, TimelapseRank, ImpactChart, Ticker, OutlookChart,
  AnomalyCard, OpSimulator, TrailLanes, PulseStrip, AccessMatrix).
- Tour chapters 8, 14, 17, 18, 19 and the closing summary: Tahap 5 (hooks + `?focus=` arrivals + `playDayStory` now).
- Bandung / Padang region packs and their polish, axe scans, INP measurement where the tooling is absent: Tahap 7 (as in
  Tahap 3; now: no crash where packs exist).
- Not built: a UMKM listing editor (listings derived), a real e-catalogue/payment integration, official reference prices
  (HET/HAP), C13 'draft' stage, `brief.exported`, `ensurePriceScenario`, Disperindag broadcast of alerts to named UMKM
  (count only), RU export of a summary.

Integrator after the builders (no review round): flip `DEMO_READY` ×5; UP products drop "(demo tahap 4)" (Toko
opportunity card → KL link, Kenal Mitra preview and TenderPilot links, Pajak Beres imports `reviewSuggestion` from
`world/up/books`, Sapa Warga reads `sd/persona.ts`); re-run `tests/e2e/tahap2` + `tahap3` (C26 guard, C27 `matchScore`,
C36 fills Awas Belanja `localBenchmarks`, the seeded past op) and all `tests/e2e/tahap4/*`; UI variants of C30–C38 in
`chains.spec.ts`; budget table for all 18 demos; screenshots 1440 + 390; gate (typecheck, selftests, build, e2e, size,
home perf, INP).
