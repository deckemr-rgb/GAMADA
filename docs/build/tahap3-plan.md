# Tahap 3 · Usaha Pintar (6 products): build plan and briefs

Written by the tahap-3 plan synthesiser on 2026-11-18 from `.shots/t3p/brief-*.md` (6 product briefs),
`.shots/t3p/kit-plan.md` (kit + world plan) and `.shots/t3p/tax-research.md`. **Where a brief and this file differ, this
file wins** (conflicts resolved in §1.9). The owner wants speed: the build is **kit agent → 6 product builders in parallel
→ integration → gate**. There is NO separate 4-lens review round, so every builder runs the self-check (§0.5 + their
brief) before handing over, and the kit agent runs §1.10.

Builders own only `src/demos/<slug>/**`, `server/ai-proxy/prompts/<slug>.ts` and `tests/e2e/tahap3/<slug>.spec.ts`.
If something is truly missing from the kit, work around it inside your folder and say so in your report (`kitHandoff`);
never edit the kit.

Read first (in this order):
1. Spec `docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` §6, §8, §9, your product in §11, your chapter in §12.2, §14, §15.
2. `src/demo-kit/CONTRACTS.md` (all of it, including every Tahap 2 section and the new **Tahap 3** section the kit
   agent writes, which carries the measured floors).
3. This file: §0 rules, §1 APIs, your brief in §2, chains §3, do-not-touch §4, your size line §5.
4. Visual direction C "Data-dense tenang": `docs/design/ARAH-VISUAL-TAHAP0.md` (sections 1 and 5), `/lab/_kit`.
   Usaha Pintar accent = peach/gold via `[data-eco="usaha-pintar"]`, tokens `--dk-*` only.
5. One Tahap 2 product as the pattern: `src/demos/awas-belanja/` (autoplay + `catchUp`, focus arrival, lazy tabs) and
   `src/demos/radar-isu/` (stream, alert card, tone drafts, "Lihat 30 menit ke depan").

---

## 0 · Rules for every builder

### 0.1 Product
- Data is simulated and deterministic. People, companies, media, accounts, banks, suppliers, handles: FICTIONAL.
  Officials by title only ("Kepala BPBD", "Camat Trucuk"). Real: region geography, place names, markets, OSM,
  Kemendagri codes. Any number that could pass for real (omzet, prices, HPS, wages, scores, risk, face match, median
  times, order values) carries "simulasi" / "simulated" next to it (ChartFrame prints "Data simulasi · seed N" on charts;
  add the chip on KPI strips and money cards). Testimonials, if any, are labelled "ilustrasi".
- Personas already in use: Siti Aminah, Raka Pratama, Darmo Sutrisno (Satu Daerah). Usaha Pintar people come from the
  kit (§1.3): the shop owner, 14 staff incl. ONE new cashier, Joko Prasetyo (KYC/KYB hero), Rina Wulandari (mf agent).
  Fictional pump brand "Hidroflo" stays as in Tahap 2. Do not invent new named people in product code: read names from
  the world.
- ID and EN are both first-class: every visible string is `{ id, en }` and follows `useI18n().lang`. Product strings
  in `strings.ts` (split per tab when a tab is lazy), shared ones from `useDemoStrings()`. Regional words (kulakan,
  bathi, nota, pajek…) only in scenario synonyms and in seeded customer texts.
- **No dead controls**: every visible control changes something real (world event, view, export, dialog, role). Out of
  scope ⇒ not rendered. A blocked action is rendered disabled WITH a visible reason (e.g. "Kirim" until the checklist is
  complete), never silently inert.
- Every flow step of your product in spec §11 works and every mission can be completed by a script (§2 lists the
  exact `done` predicates).
- Product pages (`copy.ts`, `mini.tsx`, `/produk/:slug`) are Tahap 6: NOT now. But build the components named in your
  brief as standalone pure-props components so `mini.tsx` can reuse them later.

### 0.2 Tahap 2 lessons (all mandatory; each one cost a fix round last time)
1. **Alive within 10 s**: with no interaction, the clock runs (×10, 1 world minute ≈ 6 s) and at least one world event
   lands visibly on your first screen within 10 s (the kit guarantees one per UP domain at 07:01–07:03, §1.6). Never
   fake motion that has no world event behind it (crawl lines are fine if `aria-hidden` and derived from world minutes).
2. **Numbers agree across screens**: every number shown in two places comes from ONE selector (lists in each brief).
   Never recompute a total locally when a selector exists; never type a number that the world can compute.
3. **No repeated template text**: no sentence twice on one screen or in one day's stream (memos, replies, reasons,
   supplier answers, AI wording). Template pools rotate least-recently-used; every templated sentence contains at least
   one entity-specific field (code, item, desa, amount, time).
4. **Honest labels**: "simulasi", "spesimen", "contoh fiktif", "QR contoh, tidak dapat dibayar", "(demo tahap 4)" for
   targets that are not built. A link to a non-READY demo is never rendered as a link.
5. **Cross-product links land on the right state**: every toast/link carries `?focus=<entityId>` (plus `?tab=` when
   needed); your canvas opens that entity, scrolls it into view, flashes it (`flashNewRow`), then `clearFocus()`.
   Unknown id ⇒ default tab + toast "Data tidak ditemukan" / "Item not found".
6. **Phone guide visible**: at 360–430 px the GuidePanel pill/sheet is visible and never covered by your sticky bars,
   drawers or toasts. Any mission hint that points at the top bar has a `hintSm` (on phones those controls live in the
   ⋯ sheet).
7. **Secondary views load on intent, never on idle**: `lazy(() => import('./Tab'))` + the shell intent helper
   (`import { intentProps, usePreloadOnIntent, preloadOnIntent, preloadNow } from '../../demo-kit/shell'`;
   `<Tab {...intentProps(loadX)}>` or `Segmented onIntent`). No `requestIdleCallback` preloads.

### 0.3 Performance and motion
- Size limit: ≤ 180 KB gzip beyond home per demo first load, INCLUDING fetched JSON, excluding only the MapLibre engine
  + worker. **Target ≤ 175 KB.** Code fetched after a user action is reported separately (keep it lean too). Home JS
  must stay ≤ 253.6 KB (you cannot change it; just never import product code from home paths). Your allowance is in §5.
- INP ≤ 200 ms (measure the heaviest click: Bayar, Proses nota, Saring 200 CV, Kirim 5 balasan, Susun dokumen).
- Animate transform / opacity only (stroke-dashoffset for chart draws), one RAF loop (`gsap.ticker` via kit helpers),
  respect `prefers-reduced-motion`, `?off=demoAnimations`, `?static=1` (`motionMode()` from `demo-kit/ui`). No
  backdrop-filter, no animated blur, no mix-blend on large elements. Pause loops off-screen / tab hidden. Clean up
  listeners, tickers and GSAP contexts on unmount. Idle page = 0 `gsap.ticker` listeners under reduced motion.

### 0.4 Accessibility and mobile
- Keyboard everywhere (logical order, arrows in lists/grids, Enter opens, `Esc` closes drawers/modals, focus returns),
  visible focus ring, `aria-live="polite"` for arriving events (throttled to ≤ 1 announcement per 5–10 s), AI answers
  and payment/chat status; labelled icon buttons; AA contrast; every chart has a text summary.
- 360–430 px fully usable: no horizontal page scroll, 44 px targets, tables become cards (`Table` does it < 640 px),
  split views become tabs. Below 640 px the shell canvas owns the 16 px gutter: add no side padding. Horizontal chip
  scrollers get `padding-block: 9px` + matching negative margin (CONTRACTS note) so 44 px hit areas are not clipped.
- Usaha Pintar canvases render a skeleton ("Menyiapkan data usaha…", `useDemoStrings`) until
  `useEcosystemReady('usaha-pintar')` is true (§1.1); the skeleton has the final layout boxes (no jump).

### 0.5 Process and common self-check
- No git commit/push/stash/reset/checkout. Do not edit `src-art/`.
- Dev server `http://127.0.0.1:5173` (already running; never start another one on 5173). Open your product with
  `/demo/<slug>?controls=all` (full shell before DEMO_READY). Add `&e2e=1` for `window.__gamada = { world, emit,
  settled, onEvent, clock, ensure }`.
- Own builds only: `VITE_DEMO_CONTROLS=1 npx vite build --outDir .shots/t3-<slug>/dist --emptyOutDir`; scratch files
  under `.shots/t3-<slug>/`. Budget: `npx vite preview --outDir .shots/t3-<slug>/dist --port <4400+n>` then
  `node .shots/t2-prep/budget.mjs <port> .shots/t3-<slug>/dist` (copy it and edit the route list for your slug and
  roles). Ports: toko-autopilot 4401, pajak-beres 4402, juara-jualan 4403, kenal-mitra 4404, pantau-merek 4405,
  tenderpilot 4406.
- Typecheck: `npx tsc --noEmit 2>&1 | grep "src/demos/<slug>"` must be empty. After a prompt edit: `npm run ai:test`.
- Write your own Playwright spec `tests/e2e/tahap3/<slug>.spec.ts` (`@playwright/test`, `channel: 'chrome'`, base URL
  from `tests/e2e/fixtures.ts`) and run ONLY it: `npx playwright test tests/e2e/tahap3/<slug>.spec.ts`. Never run the
  whole suite (the integrator does). Do NOT flip `DEMO_READY`.

**Common self-check (run all, plus the product list in §2; report each line PASS/FAIL with the number measured):**
- [ ] tsc clean for your folder; no console errors or React warnings on any tab, both roles, ID and EN.
- [ ] Fresh world (`?controls=all&e2e=1`, storage cleared) at 1440×900 AND 390×844: within 10 s the clock runs and ≥ 1
      world event lands visibly on the first screen without touching anything.
- [ ] Every mission completed by your spec at 1440 and 390; confetti + "Lanjut ke produk terkait" shows.
- [ ] Every "numbers that must agree" line of your brief checked in the spec (read the world via `__gamada.world`).
- [ ] Every `?focus=` arrival in your brief lands on the right tab + entity; a bad id ⇒ default tab + toast.
- [ ] Every chain row of §3 that names your product: emit the root via `__gamada.emit`, the follow-up appears ≤ 1 s
      in your UI.
- [ ] No-dead-controls crawl (Tahap 2 crawler pattern: click every enabled control on every tab × role, assert a DOM,
      URL, world or download change).
- [ ] 360 / 390 / 430: no horizontal scroll (`scrollWidth ≤ innerWidth`), all targets ≥ 44 px, guide pill visible,
      sticky bars never cover the pill or toasts.
- [ ] Keyboard pass + axe (no serious/critical). Reduced motion + `?off=demoAnimations` + `?static=1`: final states
      render, no RAF running when idle.
- [ ] No repeated template sentence (spec greps the rendered texts of a list/stream for duplicates).
- [ ] Region switch to Bandung and Padang: no crash, names/kecamatan follow the pack, no "Bojonegoro" text left.
- [ ] Own build + budget: first load ≤ 175 KB (each role landing measured), intent and after-action chunks listed.
- [ ] Live mode with mocks (`npm run ai:test` green; product buttons fall back to sim on invalid / 10 s timeout).

---

## 1 · Kit + world APIs for Tahap 3 (import paths relative to `src/demos/<slug>/`)

The kit agent builds everything in this section FIRST, on top of the final Tahap 2 commit, and writes the measured
numbers into CONTRACTS.md "Tahap 3". Builders start only after the kit agent's self-check (§1.10) is green.

### 1.0 Kit agent build order
1. Lazy ecosystem path (`world/eco.ts`, `world/ext.ts`, store wait, engine merge) + `WORLD.version` 5.
2. Types + events (§1.4), core seed changes, `up/seed-up.ts`, reducers, reactions (C14–C29), audit texts ID/EN,
   `shell/effects.ts` labels + targets, natural-up (§1.6). World self-test `up.selftest.ts`.
3. Selectors `world/usaha-pintar.ts` + `world/up/*.ts` (§1.5).
4. UI/doc/media pieces (§1.7).
5. **Stubs**: `src/demos/<slug>/index.tsx` for the 6 slugs (default export canvas rendering the UP skeleton,
   `missions = []`) and point the 6 loaders in `src/demos/registry.ts` at `() => import('./<slug>')` (NOT DEMO_READY).
   Prompt files exist already; leave them to the builders.
6. CONTRACTS.md "Tahap 3" section (APIs + measured floors), `/lab/_kit` entries for ChatThread, MonthCalendar, TextDiff.

### 1.1 Module contract (unchanged from Tahap 2) + ecosystem readiness
```tsx
// src/demos/<slug>/index.tsx
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { useEcosystemReady } from '../../demo-kit/world'
export default function Canvas({ product }: DemoCanvasProps) {
  const ready = useEcosystemReady('usaha-pintar')
  if (!ready) return <UpSkeleton />           // product-local, same boxes as the real layout
  …
}
export const missions: readonly Mission[] = [ … ]
export const hotspot = { target: '[data-hotspot=…]', label: { id: '…', en: '…' } }
```
- `useShell()` (`../../demo-kit/shell`): `pack`, `focus` + `clearFocus()`, `markMission(id)`, `toast(…)`, `size`
  ('sm' = phone), `role`, `present`, `setToastPlacement`. Missions: `done(e, s)` with `isEvent(e, '<type>')`.
- `world/eco.ts` (barrel): `ensureEcosystem('usaha-pintar'): Promise<void>`, `preloadEcosystem(eco)`,
  `useEcosystemReady(eco): boolean`, `ecosystemLoaded(eco)`, `ECO_TRIGGERS`. `routes/Demo.tsx` calls
  `preloadEcosystem(product.eco)` in parallel with the region load; products never call `ensureEcosystem` themselves.
  Invariant: UP handlers registered ⇔ UP data present. A Satu Daerah page that emits `flood.alert` loads the UP chunk
  AFTER the action (reported separately), so its toast still lists the UP products.

### 1.2 Imports (one path each; never another product's folder)
| What | Import |
|---|---|
| World barrel | `../../demo-kit/world` (`useWorld`, `emit`, `onEvent`, `settled`, `useClock`, `clock`, `rows`, `get`, `hhmm`, `fmtRp`, `ref`, `isEvent`, `WORLD`, types, `useEcosystemReady`) |
| Usaha Pintar selectors | `../../demo-kit/world/usaha-pintar` (NOT in the barrel; tree-shaken; memoised selectors safe in `useWorld` with `shallowEqual`) |
| Satu Daerah helpers | never at module top level; `ensureFloodScenario` (below) wraps `floodScenarioAlert` for you |
| UI | `../../demo-kit/ui` (+ `ChatThread`, `ChatComposer`, `MoneyInput`, `MonthCalendar`, `flyBetween` new) |
| Viz | `../../demo-kit/viz` (`LineChart` with `Forecast {values, lo, hi}`, `BarChart` (`prev` tick), `Gauge`, `RadarChart`, `Donut`, `Sparkline`, `Heat`, `PairBars`, `TargetMeter`, `ChartFrame`) |
| Docs | `../../demo-kit/docs` for `DocViewer`, `ExtractPanel`, `TamperHeatmap`, `DispositionStamp`, `TextDiff`, `simulateExtract`, `parseNik`; samples by MODULE only: `../../demo-kit/docs/samples/finance`, `/identity`, `/permits`, `/cv` (never the samples barrel: letters = 15 KB) |
| Media | `../../demo-kit/media` (`Waveform`, `usePlayback`, `timeline`, `peaksForClip`, `SALES_CALL`, `SpeakButton`, `useCamera`) |
| AI | `../../demo-kit/ai/chat` only (`useAiChat`, `registerScenario`, `registerStructuredSchema`); never the `ai` barrel |
| i18n | `../../demo-kit/i18n/terbilang` (`terbilang(n, lang)`) |
| Frames | `../../demo-kit/frames` (`BrowserFrame`, `TabletFrame`, `PhoneFrame`, `PaperFrame`, `printPaper`) |
| Shell split | `../../demo-kit/shell/SplitStage` (Kenal Mitra KYC only) |

### 1.3 Seed you can rely on (Bojonegoro, seed 1; other packs keep the same shapes and facts)
All facts under `s.meta.facts.up` (written once by `extendUsahaPintar`).
- **Shop** `s.meta.shopId`: "Toko Bangunan Tunas Kencana Baru" (seed 1; generated per pack, company-word rule: no
  repeated word), next to the real Pasar Kota Bojonegoro, Kec. Bojonegoro; `legal: 'perorangan'`, owner = a fictional
  individual (orang pribadi), non-PKP, `verified: true` (KYB seeded, date in `verifications`), `taxTidy: false`,
  since 2009. 3 outlets: toko (07.00–17.00, 291 SKUs), "Kedai Kopi …" (06.00–22.00, 49), "Warung Makan Bu …"
  (05.30–20.00, 49) = 389 SKUs. Warung/kopi `bahan` SKUs tagged `cm:<commodityId>` (beras, cabai, bawang…). 27 flood
  SKUs (`sandbag`/`pump`/`tarp`): "Karung pasir siap pakai 25 kg" cost Rp 14.000, "Terpal plastik 4x6 m" cost
  Rp 124.800 (both below the emergency HPS). `Product.barcode` = EAN-13 in-store prefix `2` + checksum (`barcodeOf`).
  15–25 SKUs below reorder point at 07:00. 13 suppliers (`leadDays`, `reliability`), 10 POs (2 `draf`).
- **Staff** `staffOf(s, shopId)`: 14 = toko 5 (kepala toko, admin penjualan & keuangan, kasir **baru** `isNew`
  `joinedDays: 9`, gudang, sopir) · kedai kopi 4 · warung 5. Each `{ outletId, job, ptkp, gross (Rp/mo, simulasi) }`.
  The 5 toko staff = PPh 21 "5 karyawan" (`facts.up.payrollStaffIds`); 3–4 of them in the 0 % TER band, 1–2 above.
  `facts.up.newCashierStaffId` + `facts.up.newCashierAgentId` = the SAME person in Toko Autopilot shifts, Pajak Beres
  payroll and Juara Jualan (tb team).
- **Books**: opening entry day −91 "Saldo awal" (balanced), 90 days of sales/ledger, `Beban Gaji` on the 25th = Σ staff
  gross, 3 `needsReview` bank rows (memos = the 3 review rows of `mutasiRows`), today's pre-07:00 sales journaled.
  Tax items: PPh Final Aug–Oct `dibayar` (= `PPH_FINAL` rule on cumulative omzet, Rp 500 jt line crossed in the month
  in `facts.up.omzetYtdBefore`), Nov `perlu-hitung` due 15 Dec; PPh 21 Nov `perlu-hitung` (setor 15 Dec, lapor 20 Dec).
- **Sales teams** (`agentsSales`, 9): tb = 3 shop staff (kepala toko, admin, the new cashier); mf "Arta Kencana
  Finance · Cabang <kabupaten>" incl. **Rina Wulandari** (the `SALES_CALL` voice); asr "Pelita Proteksi · Kantor
  <kabupaten>". 60 past calls + today's (6 scored before 07:00 per industry, 2 unscored per industry, 1 live per industry
  started 06:57, 4–6 min). `facts.up.lowCall[industry]` (keys `multifinance|asuransi|toko-bangunan`) = lowest scored
  call today with flag `keberatan-tidak-dijawab`. 3 coachings (selesai/latihan; none yet for the new cashier), 2
  roleplays history.
- **Verification**: `verificationRequests` 8 open (KYC 2: Siti Nurjanah `ktp-siti-edit`, Bambang Sutrisno
  `ktp-bambang`; KYB 5: hero, mismatch, 3 random unverified; CV 1: 200 CVs) + 1 closed row per verified business.
  Joko Prasetyo's KYC request is NOT seeded: it arrives at 07:01 (natural). `facts.up.kenalMitra = { heroBusinessId,
  heroRequestId, mismatchBusinessId, kycCleanDocId, kycEditedDocId, cvOpening, cvCount: 200, shortlistSize: 10 }`.
  Hero **CV Sedeng Jaya Abadi** (director Joko Prasetyo = specimen `ktp-joko`, Desa Sedeng, Kec. Kanor; supplies
  karung-pasir + terpal; unverified). Mismatch **UD Bumi Terpal Lestari** (NIB address Kec. Balen, photo GPS ≈ 9 km in
  Kec. Sumberrejo, NPWP name "UD BUMI TERPAL"). Lender `LENDERS[0]` "Koperasi Mitra Usaha Sejahtera". `candidates` =
  `generateCvs(200, seed, pack.kecamatan)`.
- **Brand**: ≈ 190 mentions / 30 days (shop 60 %, competitors 25 %, category 15 %), ≥ 24 shop mentions in the last
  24 h, 2 overnight delivery complaints (06:10, 06:40; below the spike rule), ~35 % of older negatives replied (median
  9 h). Competitors `s.meta.competitors` (Toko Bangunan Gading Sentosa, Depo Bahan Sumber Agung). `facts.up.brand =
  { baselinePer2h, preSignalIds, reputationAt0700 }`. Channel keys unchanged, labels generic (§6 Q2).
- **Tenders**: 16 + ≥ 4 open matched to the shop (probability = `winScore`), ≥ 2 outside KBLI; shop history 8 bids /
  10 months (4 menang, 3 kalah, 1 evaluasi; bid/HPS 0.89–0.97). Shop Bidder mirror `facts.up.shopBidderId`
  (legal 'UD', ring null, own address/IP) so Awas Belanja lists its bid.
- Every UP domain fires within 07:01–07:03 (§1.6).

### 1.4 Events (exact names; reducers, audit text ID/EN and `effects.ts` label + target exist for each)
| Event | Payload | Emitted by (source) |
|---|---|---|
| `sale.created` (extended) | existing + `discount?: number`, `payments?: { method: 'tunai'\|'qris'\|'transfer'; amount }[]` (`payment` = largest share), `staffId?`, `cash?: { given, change }`; total = Σ items − discount; ledger splits Kas/Bank by payments | toko-autopilot · clock (natural, origin toko-autopilot) |
| `stock.forecastChanged` | existing `{ productId(s), factor, reason: Bi, cause }` | reactions (C5 flood, C20 price) |
| `po.drafted` | `{ id?, code?, businessId, supplierId, items: POItem[], reason: Bi, cause?: EntityRef\|null }` ⇒ PO `draf` | reaction C15 · toko-autopilot |
| `po.sent` | existing (patches the draft id) | toko-autopilot |
| `supplier.replied` | existing `{ poId, supplierId, message: Bi, eta }` ⇒ PO `dibalas` | reaction C16 · toko-autopilot (Supplier role quick replies) |
| `po.received` | `{ poId }` ⇒ stock `onHand += qty`, PO `diterima`; **no journal** | toko-autopilot |
| `price.changed` | `{ productId, price, prev, reason: Bi, suggestionId? }` | toko-autopilot |
| `promo.created` | `{ id?, title: Bi, productIds, discountPct, until }` | toko-autopilot |
| `shift.updated` | `{ shiftId?, staffId, outletId, day: 0..6, start, end }` (create or move) | toko-autopilot |
| `shift.closed` | `{ staffId, outletId, expectedCash, countedCash, variance, tx }` (float Rp 300.000) | toko-autopilot |
| `pos.noticeSet` | `{ announcementId, outletIds, text: Bi }` | reaction C29 (source toko-autopilot) |
| `nota.received` | `{ businessId, poId, supplierId, total }` (once per poId) | reaction C18 (source pajak-beres) |
| `ledger.posted` | existing; nota: `source: 'nota'`, `refId: poId`, Persediaan D / Kas or Utang Usaha C, total = PO total; CSV: only "baru" rows | pajak-beres · reaction C14 (sale) |
| `ledger.reviewed` | `{ ledgerId, lines?: LedgerLine[], note?: Bi }` ⇒ `needsReview: false` | pajak-beres |
| `bank.imported` | `{ businessId, period: '2026-11', rows: 40, matched, posted, review: 3, bank }` | pajak-beres |
| `tax.computed` | `{ taxItemId, kind: 'pph-final'\|'pph21', amount, basis: Bi, rulesRef }` ⇒ `TaxItem.amount` | pajak-beres |
| `tax.ready` | existing `{ businessId, period: '2026-11', taxItemIds }` ⇒ items `siap`, `taxTidy: true` | pajak-beres |
| `period.locked` | `{ businessId, period }` ⇒ `lockedPeriods` | pajak-beres (Konsultan only) |
| `call.created` | `{ id?, agentId, industry, channel: 'telepon'\|'wa', customer, transcript: ClipKey, durationSec, refId?, topic?: 'banjir'\|null }` (score null) | clock (natural, origin juara-jualan) · reaction C17 |
| `call.scored` (extended) | `{ callId, score, criteria?, flags?: string[], by?: 'ai'\|'supervisor' }`; reducer sets `score = callScore(criteria)` whenever criteria are given | juara-jualan · clock |
| `coaching.assigned` (extended) | `{ id?, agentId, focus: Bi[3], examples: Bi[3], focusKeys: CriterionKey[], callId?, baseline }` | juara-jualan |
| `roleplay.completed` | `{ id?, agentId, coachingId: string\|null, persona: 'ragu-harga'\|'buru-buru'\|'banyak-tanya', industry, turns, score, baseline, criteria }` ⇒ roleplay row, coaching `selesai` | juara-jualan |
| `verification.requested` | `{ id?, code?, kind: 'kyc'\|'kyb'\|'cv', subjectKind, subjectId, requestedBy, needId?, priority? }` (skips a duplicate open request) | kenal-mitra (bank role) · clock · reaction C26 |
| `partner.verified` | existing `{ subjectKind, subjectId, kind, result, score }`; reducer also closes the open request of that subject. KYC subject = the KTP `document` id, KYB = `business`, CV = `candidate` (10 in one batch, score = fit) | kenal-mitra |
| `brand.mentioned` | `Opt<BrandMention,'id'\|'at'>` (future `at` allowed; selectors filter `at ≤ now`) | clock · reactions C28/C29 (source pantau-merek) |
| `brand.alert` (extended) | existing + `id?`, `at?` (= 5th burst mention, may be future), `mentionIds?`, `causeRef?`, `baselinePer2h?` ⇒ `brandAlerts` | reaction C28 |
| `brand.replied` | `{ mentionIds, tone: 'empatik'\|'formal'\|'santai', replies: Bi[] (same order), by: RoleId, alertId? }` (one event per bulk send) | pantau-merek |
| `brand.announced` | `{ id?, businessId, alertId, topic, text: Bi, channels: ('marketplace'\|'sosmed'\|'ulasan-peta'\|'wa-status'\|'struk')[], offer: 'gratis-ongkir'\|'ambil-sendiri'\|'jadwal-ulang'\|null, by }` ⇒ alert `ditangani`, deletes the alert's burst mentions with `at > e.at` | pantau-merek |
| `tender.created` | `Opt<Omit<Tender,'matches'>,'id'\|'code'\|'status'> & { key? }` (idempotent on key + needId) | reactions C21/C24 (source tenderpilot) · clock (07:01) |
| `tender.matched` | existing `{ tenderId, businessId, probability }`; probability ALWAYS = `winScore(...).probability` | reaction C22 · clock |
| `bid.submitted` (extended) | `{ id?, tenderId, businessId, price, pages?, docSections? }` | tenderpilot |
| `procurement.bidReceived` | `{ procurementId, bidderId, businessId, price, bidId }` ⇒ appended to `procurement.bids` + `bidderIds` | reaction C25 (source awas-belanja) |
| `procurement.flagged` (extended reducer) | unchanged payload; mirrored tender gets `risk` when riskScore ≥ 60 | awas-belanja |

New tables: `staff`, `shifts`, `promos`, `cashShifts`, `posNotices`, `bankImports`, `roleplays`, `verificationRequests`,
`brandAlerts`, `brandAnnouncements`; `Business.legal?`, `Business.lockedPeriods?`, `Tender.{ method, requirements:
ReqKey[], items?, hps?, procurementId?, needId?, key?, risk? }`, `Bid.{ pages?, docSections? }`, `Call.{ transcript,
topic?, scoredBy? }`, `SalesAgent.{ role: 'sales'|'kasir', joinedDays, org, businessId, staffId }`, `Coaching.{ examples,
baseline, focusKeys }`, `BrandMention.{ outletId?, item?, orderCode?, kecamatanId?, desaId?, daysLate?, cause?, inReplyTo?,
repliedAt?, replyTone?, repliedBy? }` (brand may be `'kategori'`). `ReqKey = 'nib-kbli'|'akta'|'npwp'|'kyb'|'pajak'|
'pengalaman'|'kapasitas'|'pakta'`.

### 1.5 Selectors — `../../demo-kit/world/usaha-pintar` (memoised unless marked *plain*)
| File | Exports |
|---|---|
| `shop.ts` | `vendorProfile(s, bizId)` (NIB specimen 13 digits + "SPESIMEN", KBLI list, NPWP masked `0000 •••• •••• 0000`, akta `null` for perorangan, address, staff count, years, KYB date — the ONLY source for these in every product) · `staffOf(s, bizId, outletId?)` · `barcodeOf(p)` *plain* · `shopStockFor(s, category)` · `shopOpportunities(s)` (open needs whose items ⊂ shop supplies, with qty + shop onHand) |
| `toko.ts` | `outletKpis(s, now)` → `{ total, byOutlet: Record<outletId, { revenue, tx, avgTicket, grossMargin, vsYesterday }> }` (yesterday to the same minute; also the outlet comparison) · `liveReceipts(s, now, n, outletId?)` · `topProducts(s, days, outletId?)` · `posCatalog(s, outletId)` · `findByBarcode(s, code)` *plain* · `demandForecast(s, productId, now)` → `{ history30, forecast14, lo, hi, factors: { key: 'musim'\|'gajian'\|'banjir'\|'promo'\|'harga', pct, label: Bi, cause? }[], daysLeft }` · `stockRisk(s, outletId, now)` (by daysLeft, flood SKUs first while an alert is active) · `floodBanner(s)` (text = reaction reason, factor 4.4, alert ref) · `poSuggestions(s, now)` (drafts per supplier, each item `{ qty, shortfall, why: Bi }`, formula `demand × (leadDays + 3) − onHand` rounded to pack) · `priceSuggestions(s, outletId)` → `{ id, productId, from, to, unitsDelta, marginDelta, locked?: Bi }[]` (elasticity table `up/elasticity`, simulasi; flood SKUs `locked` during an active flood alert) · `bundleIdeas(s, outletId)` · `hourlyTraffic(s, outletId)` · `shiftPlan(s, outletId, now)` → `{ blocks, extra }` · `cashierShift(s, staffId, now)` → expected cash |
| `books.ts` + `coa.ts` | `COA` (code, name `{id,en}`, group, normal side; existing account strings unchanged + Prive, Beban Bahan Bakar, Beban Admin Bank, Pendapatan Bunga, Utang PPh 21, Utang PPh Final, Beban Pajak) · `omzetByMonth(s, bizId)` (**the one omzet function**: Toko dashboard month, Pajak Beres, Rapor Usaha) · `pendingNotas(s, bizId)` (POs `dibalas\|diterima` with no ledger row `refId === po.id`, newest first, nota meta) · `ledgerRows(s, bizId, { from, to, review? })` · `trialBalance(s, bizId, period)` → `{ rows, debit, credit, balanced }` · `pnlMonthly(s, bizId)` (Sep, Oct, Nov-berjalan) · `balanceSheet(s, bizId, at)` · `cashFlow(s, bizId, month)` · `taxCalendar(s, bizId, now)` · `pendingReviews(s, bizId)` · `mutasiRows(s, bizId, '2026-11')` (exactly 40 rows 1–16 Nov: settlements "cocok", supplier payments, utilities, rent, admin fee, interest, prive, 3 review) |
| `tax-constants.ts` | `PPH_FINAL = { rate: 0.005, exemptOmzetOP: 500_000_000, ceiling: 4_800_000_000, ref: 'PP 55/2022 jo. PP 20/2026' }` (seed uses it; Pajak Beres `rules.ts` re-exports it and asserts equality) |
| `sales.ts` | `CALL_WEIGHTS = { salam: 10, gali: 20, keberatan: 20, penawaran: 20, closing: 20, kepatuhan: 10 }` · `callScore(criteria)` *plain* · `weakest(criteria, n)` *plain* · `salesKpi(s, now, ind)` · `callList(s, now, ind, { agentId?, sort })` · `liveCalls(s, now, ind)` · `callDetail(s, id)` · `teamBoard(s, now, ind)` (avg14, delta7, trend[14], radar, rank) · `agentProfile(s, now, agentId)` · `coachingsFor(s, agentId)` · `CALL_CLIPS` (key list: `{ key, industry, channel, weak: CriterionKey }`, see §1.9 #7) |
| `mitra.ts` | `verificationQueue(s, now)` · `verificationKpi(s, now)` · `verificationOf(s, subjectId)` · `kybCase(s, bizId)` → `{ docs, matrix, owner, gps, distanceKm, score, result }` (hero 91 lolos; mismatch cek-manual) · `kycRisk(input)` *plain* (Joko 18 setujui, edited 63 tinjau; formula in P11) · `catalogPreview(s, bizId?)` (verified first, then distance: the ranking Katalog Lokal will use) · `cvShortlist(cvs, criteria, blind)` *plain* |
| `brand.ts` | `brandStream(s, now, filter)` · `brandKpi(s, now)` · `sentimentByChannel(s, now, hours)` · `brandTopics(s, now, hours)` (+ delta vs previous window) · `reputationSeries(s, now, hours, brand)` (hourly 0–100 = 50 + 50 × weighted mean; a replied negative weighs × 0.5) · `reputationScore(s, now, brand)` · `brandSpike(s, now)` · `activeBrandAlert(s, now)` (`at ≤ now`) · `complaintClusters(s, now, alertId)` · `replyCandidates(s, now, alertId?)` · `replyInputs(mention)` *plain* · `competitorCompare(s, now, days)` · `affectedOrders(s, now)` |
| `tender.ts` | `EMERGENCY_TENDER` (§P13) · `winScore(s, tenderId, bizId)` → `{ probability, factors: { key: 'kbli'\|'pengalaman'\|'jarak'\|'harga'\|'pesaing', value, weight, impact: 'naik'\|'turun'\|'netral', note: Bi }[] }` (0.78 for the emergency tender on Bojonegoro seed 1; other packs 0.70–0.85) · `tenderFeed(s, now, filters)` · `tenderKpi(s, now)` · `requirementsFor(s, tenderId, bizId)` → `{ key, label, ok, warn?, source, detail, focus? }[]` · `priceAdvice(s, tenderId, bizId)` · `bidHistory(s, bizId)` |
| `scenario.ts` | `UP_SCENARIO.floodAt = 7*60+6` (= Awas Belanja `FLOOD_AT`) · `ensureFloodScenario(s, now)` (idempotent: emits a clock-sourced `flood.alert` level 3, origin siaga-wilayah, at `floodAt`, only if no flood alert is active) · `useFloodAutoplay(enabled)` (calls it once the clock passes `floodAt`; catch-up on jumps) |
| payload helpers *plain* | `salePayload(cart)`, `bidPayload(...)`, `repliesPayload(...)` (return payloads; products emit with their own slug) |

### 1.6 Natural events (`up/natural-up.ts`, source `'clock'` + origin) — "alive within 10 s" at ×10
- 07:01 `sale.created` kedai kopi, 07:03 toko (core guaranteed), then natural rhythm; `setNaturalBoost('sale', 3)`
  07–17 while a shop demo (toko-autopilot, pajak-beres) is open (rhythm kept, invisible in the audit).
- 07:01 `call.created`, then when `(minute − 420) % 3 === 1` 07–17 (industry rotates); `call.scored` (`by: 'ai'`) at
  call end; tb calls get `topic: 'banjir'` while a flood alert is active.
- 07:01 `verification.requested` (Joko Prasetyo KYC, requestedBy Koperasi Mitra Usaha Sejahtera), then ≈ 1/40 per min
  08–16, ≤ 12 open.
- 07:01 `brand.mentioned` (ambient), then ≈ 1 per 20 world min (shop/competitor/category).
- 07:01 one non-emergency `tender.created` (+ `tender.matched` ≈ 0.64 via C22; moved from the kit plan's 07:02 so TenderPilot is alive within 10 s).
- 07:06 flood only where a product opts in with `useFloodAutoplay(true)` (Pantau Merek, TenderPilot; Awas Belanja is
  moved onto it in integration).

### 1.7 Kit components (new or changed; only pieces with ≥ 2 users live in the kit)
| Piece | Import | API | Users |
|---|---|---|---|
| `ChatThread` + `ChatComposer` | `demo-kit/ui` | `{ messages: { id, side: 'me'\|'them'\|'system', text: Bi\|string, at?, status?: 'sent'\|'delivered'\|'read', author? }[], typing?, quickReplies?: { id, label: Bi }[], onQuick?, highlightId?, label: Bi }`; `aria-live`; new bubble 8 px slide (transform/opacity); composer 44 px, keyboard-safe | P8 PO chat + supplier, P9 Tanya Pajak, P10 roleplay + WA transcripts, P12 reply threads |
| `MoneyInput` | `demo-kit/ui` | Rp thousands, `inputMode="numeric"`, `fmtRp` | P8, P9, P13 |
| `MonthCalendar` + `icsFor(events)` | `demo-kit/ui` | `{ month: 'YYYY-MM', today, events: { id, at, label: Bi, tone, href? }[], onSelect?, compact? }`; week strip < 640 px; arrows | P9, P13 |
| `TextDiff` | `demo-kit/docs` | `{ before, after, mode: 'inline'\|'split', label }` word diff, `<ins>/<del>` | P13 (P10, P12 may) |
| `terbilang` | `demo-kit/i18n/terbilang` | `terbilang(n, lang)` | P13, P9 |
| `flyBetween` | `demo-kit/ui` | `flyBetween(fromEl, toEl, { duration ≤ 900 })` clone, transform+opacity; fades under reduced motion | P9, P13 |
| `useCamera` | `demo-kit/media` | `useCamera({ facing })` opt-in, local only, tracks stopped on unmount; `{ supported, start, stop, stream, error }` | P11 selfie, P8 barcode |
| `Waveform` (changed) | `demo-kit/media` | marker hit ≥ 24 px; `data-tone` on markers | P10 |
| Finance docs on the world | `demo-kit/docs/samples/finance` | `notaDoc(meta, { crumple?, tilt?, edited? })`, `fakturDoc(meta)`, `mutasiDoc(rows, { bank, holder })`; fixed `FINANCE` kept; `FICTIONAL_BANK` renamed (§1.9 #9) | P9 |
| KYB/KYC specimens | `demo-kit/docs/samples/permits`, `/identity` | `kybSpecimens(biz, { mismatch?: 'alamat'\|'nama' })` → `{ nib, npwp, akta?, lokasi }`; `ktpSpecimen(person)`; sample `ktp-bambang`; `simulateExtract` kinds `npwp`, `akta`, `lokasi` | P11 (P13 lampiran thumbnails) |
| CV | `demo-kit/docs/samples/cv` | `generateCvs(count, seed, kecamatanList)`, `cvFit(cv, criteria)`, `cvDoc` | P11 |
| Labels | `world/usaha-pintar` | `ACCOUNT`, `PAYMENT`, `PO_STATUS`, `TAX_KIND`, `TAX_STATUS`, `CALL_CRITERIA`, `CALL_FLAG`, `BRAND_CHANNEL`, `BRAND_TOPIC`, `TENDER_STATUS`, `REQ`, `KYC_STATUS`, `STAFF_JOB` (`{id,en}`) | all |
| Shell effects | `shell/effects.ts` | label + `EFFECT_TARGET` for every §1.4 event; `EFFECT_ALSO` for state-consumed roots: `tax.ready` → tenderpilot, katalog-lokal, rapor-usaha; `partner.verified` → tenderpilot, katalog-lokal | all |
Product-local (NOT kit): receipt, dummy QR, WeekGrid, LedgerTable, LivenessFace, MentionStream, ReputationChart,
StackedBar (unless `BarChart` stacks), crawl line, roleplay engine, clip libraries.

### 1.8 AI
Nothing new in the shared AI kit. Each product: `scenario.ts` registered by its LAZY AI surface (never by the page),
`prepare()` on hover/focus of the AI button, numbers from `ctx.world` selectors, wording canned (pools, no repeats).
Product-owned structured kinds use the prefix `<slug>/`: `toko-autopilot/price`, `toko-autopilot/shifts`,
`pajak-beres/tax-breakdown`, `juara-jualan/draft_coaching`, `kenal-mitra/rank_candidates`, `pantau-merek/announcement`,
`tenderpilot/tender-summary`, `tenderpilot/bid-section` (`registerStructuredSchema(kind, { safeParse })`). Shared kinds
used: `po`, `ledger`, `kyc`, `reply`, `clusters`, `win-score`, `insight`. Live tools: keep the existing shared tool of
your prompt file, add `customTools: [productTool('<slug>', name, z.object(…), desc)]` + `customMocks`; Live only rewrites
wording, local numbers win (mismatched quantities/amounts ⇒ fall back to the computed draft). Invalid / 10 s timeout ⇒
sim. The tour always uses sim.

### 1.9 Conflicts resolved (names above are final)
1. Code lives in `world/up/<x>.ts`; products import ONE path `../../demo-kit/world/usaha-pintar`.
2. `po.received` posts NO journal (the TA brief's "po-received→ledger" chain is dropped): the purchase journal comes
   from Pajak Beres processing the nota (`ledger.posted` source `nota`, refId poId). Otherwise purchases double-count.
3. Staff = 14 (not ≈ 8); the new cashier is one person (`facts.up.newCashierStaffId` + `newCashierAgentId`).
4. Brand spike: no `brandWatch` tick; C28 stores a future-dated `brand.alert` (`at` = 5th burst mention), selectors
   filter `at ≤ now`. Flood 07:06 ⇒ alert 07:12 (≈ 36 s at ×10).
5. Shop = orang pribadi (`perorangan`, non-PKP); Bidder mirror legal `'UD'` (not 'CV'); shop requirement list has no
   `akta` (7 items, §P13); `vendorProfile().akta = null`.
6. `createAmbientFeed` and `viz/WeekGrid` are not built (natural-up covers the feed; WeekGrid is product-local with
   `data-tour` hooks). `ui/ReplyStamp` folds into `ChatThread` `status` + a product-local chip.
7. Call transcripts: `Call.transcript` is a `ClipKey`. The kit owns the KEY list `CALL_CLIPS` (per industry 6 clips,
   one per weak criterion; tb 3 WA + 3 telepon, mf/asr 5 telepon + 1 WA; + `tb-wa-prapesan`). It picks a clip
   least-recently-used, then draws criteria = agent radar + noise with the clip's `weak` criterion forced lowest. Juara
   Jualan owns the clip TEXT (`clips-*.ts`, lines tagged `{ criterion, ok|miss }`, slots `{poCode}`, `{price}`,
   `{item}` filled from the world) and must cover every key.
8. Selector names: TA brief `shopKpis/stockForecast/criticalStock/poDrafts/outletCompare` ⇒ `outletKpis/demandForecast/
   stockRisk/poSuggestions/outletKpis.byOutlet`; PM brief `brandFeed/channelSentiment/competitorTable` ⇒
   `brandStream/sentimentByChannel/competitorCompare`; PM/TP `WORLD.floodAutoAt`, `SCENARIO.floodAt`,
   `ensureScenarioFlood`, `useDemoAutoplay` ⇒ `UP_SCENARIO.floodAt`, `ensureFloodScenario`, `useFloodAutoplay`; facts
   `facts.newCashierAgentId`, `facts.salesLowCall`, `facts.kenalMitra`, `SeedFacts.shopBidderId` ⇒ under `facts.up.*`;
   `EMERGENCY_TENDER` lives in `up/config.ts` (exported via `world/usaha-pintar`).
9. `FICTIONAL_BANK` ('Bank Arta Kencana') collides with the multifinance "Arta Kencana Finance": the kit renames the bank
   to **"Bank Wiyata Sentosa"** (fictional; fixed FINANCE samples follow). Pajak Beres mutasi uses `FICTIONAL_BANK`.
10. Chain ids: the briefs' C14–C19 / U9-x / J1 / KM1 / UP-PM1 / T1 and the kit plan's U1–U16 are replaced by **C14–C29**
    (§3); the self-test and `chains.spec.ts` use these ids.
11. Registry stubs: the kit agent creates the 6 stubs and points the loaders (kit plan said registry untouched; stubs
    are needed for `/demo/<slug>?controls=all`). `DEMO_READY` stays for the integrator.
12. `nota.received` fires once per poId (a manual Supplier-role reply after the auto-reply does not duplicate it).
13. Juara Jualan clip `tb-wa-prapesan` customer = "Pengurus musala Desa <desa in the alert zone>" (generated per pack).

### 1.10 Kit agent self-check (green before builders start)
- [ ] `npx tsc --noEmit` clean for `src/demo-kit/**`; `npm run build` green; `npm run ai:test` green.
- [ ] `npx tsx src/demo-kit/world/__tests__/world.selftest.ts` (tahap 1/2 sections + C1–C13 still green) and NEW
      `up.selftest.ts` on the mini fixture AND every pack in `region/packs/`: C14–C29 each produce the listed follow-ups.
- [ ] Determinism: `generateWorld` + `extendUsahaPintar` twice ⇒ deep-equal; moved tables keep values (same streams)
      except the documented regenerations (brand, calls, tenders, candidates).
- [ ] `flood.alert` on a world WITHOUT the UP extension loads it first and yields the same UP rows (by key) as a world
      extended before the flood.
- [ ] Numbers: trial balance balanced (each entry and whole book); `omzetByMonth` Nov = Σ salesDaily + today =
      `outletKpis` month omzet; `Beban Gaji` = Σ staff gross; `mutasiRows` = 40 with 3 review memos = the 3 ledger review
      rows; emergency tender `winScore` = 0.78 (Bojonegoro seed 1), 0.70–0.85 elsewhere; emergency HPS > shop cost of
      karung/terpal; `requirementsFor` pajak flips after `tax.ready`; list score = `callScore(criteria)`;
      `verifiedBusinesses().length` = closed KYB requests + seeded verified; 200 candidates = `generateCvs`; seeded PPh
      Final = `PPH_FINAL` on cumulative omzet.
- [ ] Texts: 10 newest calls pairwise different clip keys; no brand sentence twice in a day; no company name with a
      repeated word; supplier replies never repeat within 20 POs; every new event has ID + EN audit text.
- [ ] Alive: fresh world at 07:00 ⇒ minutes 07:01–07:03 give ≥ 1 event in each of the 6 UP domains.
- [ ] Size (budget.mjs on a `VITE_DEMO_CONTROLS=1` build): home JS ≤ 253.6 KB; every SD demo first load ≤ its final
      Tahap 2 number + 0.5 KB; `up/boot` ≤ 12 KB; UP stub floor ≤ 112 KB; table into CONTRACTS.md "Tahap 3".
- [ ] Regression: `npx playwright test tests/e2e/tahap2` green; `/lab/_kit` renders ChatThread, MonthCalendar, TextDiff.
- [ ] New components: transform/opacity only, `motionMode()`, 44 px, focus ring, `aria-live` on ChatThread, arrows in
      MonthCalendar, ID/EN labels.

---

## 2 · Product briefs

Common to all six: replace the stub `src/demos/<slug>/index.tsx`; split files per tab; strings in `strings.ts`; sim
scenario in `scenario.ts` (registered by the lazy AI surface); CSS prefix `dk-<short>-` with `--dk-*` tokens; skeleton
until `useEcosystemReady('usaha-pintar')`; `data-tour` / `data-<short>` hooks exactly as listed (Tahap 5 tour drives
them); URL params `?tab=`, `?focus=` (plus product ones listed). Each brief's self-check is IN ADDITION to §0.5.

### P8 · Toko Autopilot (incl. Kasir ex-KasirKu) — `src/demos/toko-autopilot/` · `dk-ta-` · prompt `toko-autopilot.ts`
- **Frames/layout:** `TabletFrame` (landscape) for Kasir; `BrowserFrame` (`demo.gamada.id/toko-autopilot`) for Dasbor ·
  Kasir · Prediksi · PO · Harga & Promo · Jadwal Shift. `?tab=dasbor|kasir|prediksi|po|harga|shift` (default dasbor),
  `?outlet=semua|toko|kopi|warung`, `?role=`.
- **Roles:** Pemilik Toko (default: all tabs, all outlets, cost/margin, approve PO, prices, shifts) · Kasir (lands on
  Kasir, outlet fixed = Toko, own shift read-only, Tutup shift, discount capped 10 %, no cost/margin/PO/prices) ·
  Supplier (`PhoneFrame` "Pesanan masuk", WA-style chat with POs to the karung/terpal supplier; quick replies "Siap,
  kirim besok pagi" / "Stok terbatas, kirim sebagian lusa" / "Bisa kirim hari ini sore" ⇒ `supplier.replied` with new
  eta). Role switch keeps the cart (per outlet, product state); language switch mid-cart keeps it too.
- **Files:** `index.tsx`, `Dashboard.tsx`, `Kasir.tsx` (lazy; first load for role Kasir), `Payment.tsx` (lazy drawer),
  `qr.ts` (deterministic 25×25 pattern from the sale code, caption "QR contoh, tidak dapat dibayar", the word "QRIS" as
  text only, no logo), `Receipt.tsx` (58 mm, `PaperFrame` + `printPaper`), `Forecast.tsx` (lazy), `ForecastChart.tsx`
  (standalone, mini reuse), `Po.tsx` + `PoChat.tsx` (lazy, standalone), `Supplier.tsx` (lazy), `Pricing.tsx` (lazy),
  `Shifts.tsx` + `WeekGrid.tsx` (lazy), `scenario.ts`, `strings.ts`, `toko-autopilot.css`.
- **First 30 s:** KPI strip (outlet toggle Semua/Toko/Kedai Kopi/Warung): Omzet hari ini, Transaksi, Rata-rata struk,
  Margin kotor, each vs yesterday same minute (Sparkline), "Data simulasi". "Transaksi masuk" feed (`liveReceipts`:
  this morning ≈ 11 rows; 07:01 kopi sale at ≈ 6 s, 07:03 toko at ≈ 18 s slide in; KPI tweens). "Perlu perhatian"
  (SKUs below reorder, 2 draft POs, next peak hour). "Kejadian di daerah": no alert ⇒ "Belum ada peringatan banjir" +
  button "Putar skenario banjir (dari Siaga Wilayah)" = `ensureFloodScenario(s, clock.now())` (source clock, origin
  siaga-wilayah; same path as autoplay); alert active ⇒ peach `floodBanner` linked to Prediksi. Opportunity card from
  `shopOpportunities` when a need is open ("Kebutuhan Pemda: 2.000 karung pasir · Kec. Trucuk · stok Anda 340", plain
  text "(demo tahap 4)" until Katalog Lokal is READY). Chip "Keluhan pengiriman +x %" when `activeBrandAlert` exists
  → `/demo/pantau-merek?focus=<brandAlertId>`. Hotspot `[data-hotspot=kasir-tab]` "Mulai di sini: 1 transaksi QRIS".
- **Kasir:** product grid (`posCatalog`), search (`/` focuses), barcode input (typed / scanner wedge; camera button only
  when `'BarcodeDetector' in window`, via `useCamera`), cart (qty ±, remove), discount % or Rp (`MoneyInput`), split
  payment (tunai + QRIS/transfer), QRIS dummy + "Simulasikan pembayaran", tunai change (Rp 100.000 for Rp 73.500 ⇒
  Rp 26.500), receipt, "Tutup shift" (`shift.closed`, variance = counted − expected). "Bayar" emits ONE `sale.created`
  (double-tap safe). Stock badge per item = `stock.onHand`. A `posNotices` banner shows when present (C29).
- **Prediksi:** `stockRisk` list "habis dalam X hari"; `ForecastChart` = `LineChart` 30 d history + 14 d forecast with
  band `{ lo, hi }`; factors chips (musim, gajian, banjir, promo, harga) with pct and "Kenapa?" popover (lazy scenario).
  After `flood.alert` the flood SKUs jump (chart redraw by stroke-dashoffset) + banner "Permintaan diperkirakan naik
  340% karena peringatan banjir" (text from `floodBanner`) ≤ 1 s.
- **PO:** `poSuggestions` grouped per supplier, each line shows the shortfall formula; "Setujui & kirim" ⇒ `po.sent` ⇒
  `PoChat` (ChatThread: sent bubble with the item list = PO payload; typing 1.6 s, 0 s reduced motion) ⇒ the reaction's
  `supplier.replied` bubble; status chip `dibalas`; "Terima barang" on a `dibalas` PO ⇒ `po.received` (onHand up).
- **Harga & Promo:** `priceSuggestions` table (from → to, units Δ, margin Δ, simulasi) with "Terapkan" ⇒ `price.changed`;
  locked flood SKUs show the rule "Harga barang darurat tidak dinaikkan selama peringatan banjir" (no button);
  `bundleIdeas` card ⇒ "Buat promo" ⇒ `promo.created`.
- **Jadwal Shift:** `WeekGrid` (7 × hours, `Heat` of `hourlyTraffic` behind) from `shiftPlan`; `extra` blocks highlighted
  ("+1 kasir 13.00–17.00", flood days raise traffic); drag (pointer, transform), keyboard arrows, tap-select-then-tap-slot
  on coarse pointers ⇒ `shift.updated`. The new cashier's block shows a badge "Sedang coaching di Juara Jualan" when a
  coaching for `newCashierAgentId` exists (link `/demo/juara-jualan?focus=<staffId>`).
- **Missions:** 1 `qris` Transaksi QRIS — `isEvent(e,'sale.created') && e.source==='toko-autopilot' &&
  (e.payload.payment==='qris' || e.payload.payments?.some(p=>p.method==='qris'))` · 2 `banjir` Lihat dampak banjir —
  markMission when Prediksi renders a SKU with a `banjir` factor (chart visible) · 3 `po` Kirim PO — `po.sent` source
  toko-autopilot · 4 `harga` Terapkan 1 saran harga — `price.changed` source toko-autopilot · 5 `shift` Lihat kasir
  tambahan — markMission on opening the extra block's explanation (works on phones). Outlet-toggle hints carry `hintSm`.
- **Focus arrivals:** `PO-*`/po id → PO tab + chat open; product id → Prediksi with that SKU; `alerts:*` → Prediksi
  filtered to flood SKUs; sale id → Dasbor receipt drawer; staff id → Shift with block selected; announcement id → Kasir
  with the notice banner.
- **Tour hooks (ch. 11):** `[data-tour=forecast-chart]`, `[data-tour=flood-banner]`, `[data-tour=po-approve]`,
  `[data-tour=po-chat]`.
- **Numbers that agree:** Dasbor omzet = `outletKpis` = Pajak Beres "Penjualan hari ini"; month omzet = `omzetByMonth`;
  +340 % banner = reaction reason = factor 4.4 on the chart; PO qty = shortfall on the draft = chat bubble = `po.sent`
  payload; Kasir stock badge = Prediksi onHand after every sale; applied price = Kasir grid price = margin KPI; need qty
  quoted verbatim on the opportunity card.
- **AI:** computed: forecast, band, factor %, PO qty, prices, margin, shifts, bundles. Canned pools: PO reason, supplier
  replies (kit), "Kenapa?" factor text, shift rationale. Scenario intents `jelaskan_prediksi` → `insight`, `susun_po` →
  `po`, `saran_harga` → `toko-autopilot/price`, `atur_shift` → `toko-autopilot/shifts`. Prompt: keep `draft_po`; add
  `suggest_price` `{ productId, price, reason, ethicsNote? }` and `plan_shifts` `{ outletId, blocks[], note }` + mocks;
  context: outlet, critical stock (top 10), active alerts, price anomalies, drafts; keep the disaster-goods ethics line.
- **Phone 390:** `Tabs` scroll (active scrolled into view); frames drop chrome < 640 px. Kasir 2-column grid, sticky
  bottom bar "Keranjang (3) · Rp 245.000 · Bayar" (above the guide pill), cart + payment as full-height `Drawer`.
  Prediksi list first, chart in a Drawer. PO cards, chat full-screen Drawer. Shift: day `Segmented` + vertical hour list,
  tap-to-move. Dasbor KPI 2-up.
- **Self-check (extra):** a Kasir sale lowers that SKU in Prediksi and raises Dasbor omzet by exactly the receipt
  total; flood ⇒ chart + banner ≤ 1 s (measured); PO send ⇒ reply bubble + `dibalas`; Terima barang ⇒ onHand up; payment
  math table (tunai change, split, 10 % cap as Kasir, one sale on double tap, shift variance); role Kasir hides cost and
  margin; camera button absent without `BarcodeDetector`; receipts `aria-live` ≤ 1 per 5 s.

### P9 · Pajak Beres — `src/demos/pajak-beres/` · `dk-pb-` · prompt `pajak-beres.ts`
- **Frames/layout:** `BrowserFrame` (`demo.gamada.id/pajak-beres`); `PaperFrame` (light, printable) for Laporan bulanan,
  export previews. Tabs Dokumen · Jurnal · Laporan · Kalender · PPh 21 · Ekspor; header button "Tanya Pajak" (drawer,
  always visible, also on phones). `?tab=`, `?from=tenderpilot` (shows "Kembali ke TenderPilot →").
- **Roles:** Pemilik Usaha (`pemilik-toko`, default; plain words "Uang masuk", "Untung bulan ini", "Pajak yang perlu
  disetor"; debit/credit behind "Lihat detail akuntansi"; Ekspor has "Kirim ke konsultan" = role switch + toast) ·
  Konsultan Pajak (lands on Jurnal; client switcher = shop + 3 world businesses as read-only cards with status chips;
  full journal with CoA codes and confidence; "Perlu tinjauan" queue first; PPh 21 shows category, TER row, formula,
  source chip; only role with "Kunci periode Oktober" ⇒ `period.locked`, locked rows show a lock, no inline edit).
- **Files:** `index.tsx`, `rules.ts` (every rate/threshold/date/format with `source: { ref, url, since }` + comment;
  re-exports `PPH_FINAL` from the kit and asserts equality), `pph21.ts`, `Inbox.tsx`, `NotaProcessor.tsx` (pure props
  `{ doc, onDone, autoplay }`, mini reuse), `Journal.tsx` (lazy), `Mutasi.tsx` (lazy), `Reports.tsx` (lazy),
  `Calendar.tsx` (lazy), `Payroll.tsx` (lazy), `Export.tsx` (lazy: XML + CSV writers), `Ask.tsx` (lazy, registers
  `scenario.ts`), `Clients.tsx` (lazy), `strings.ts`, `pajak-beres.css`.
- **First 30 s:** KPI strip (Omzet Nov berjalan · Laba Nov (estimasi) · Estimasi PPh Final Nov · Perlu tinjauan ·
  Tenggat terdekat); columns Kotak Dokumen (26 %) · DocViewer with the newest nota tilted and crumpled (44 %) · "Jurnal
  hari ini" feed (30 %). Ribbon "Simulasi · bukan nasihat pajak · aturan per November 2026" (EN "Simulation · not tax
  advice · rules as of November 2026"). Inbox rows stagger in; top row = `pendingNotas[0]` ("Nota <supplier> · PO-xxxx ·
  baru"). Count-up "N penjualan hari ini sudah dijurnal" (= today's ledger rows `source: 'sale'`). Every natural sale
  (boosted) adds a journal row (`flashNewRow`) and counts KPIs up (≤ 600 ms). Hotspot `[data-hotspot=pb-process]`.
- **Flows:** (1) nota → "Proses nota" (`[data-pb=process]`) → deskew → OCR boxes → fields (`simulateExtract`,
  `extractKind: 'invoice'`) → entry flies (`flyBetween`) into the journal (on phones: into the Jurnal tab badge +1) in
  ≤ 2 s; the edited nota variant is flagged (TamperHeatmap) and posts "Perlu tinjauan". (2) Mutasi CSV (`mutasiDoc`,
  bank = `FICTIONAL_BANK`) → "Impor 40 baris" ⇒ `bank.imported` (cocok rows post nothing; baru rows ⇒ `ledger.posted`)
  → review drawer → approve or fix the account ⇒ `ledger.reviewed` ×3. (3) Laporan: `pnlMonthly` chart (Sep, Oct,
  Nov-berjalan), `balanceSheet`, `cashFlow`, per-account drill-down; "Laporan bulanan" builds P&L + neraca + arus kas +
  ringkasan pajak in one PaperFrame ("Cetak / PDF"). (4) PPh 21: 5 toko staff, TER category A/B/C, row, amount (0-band
  employee shows Rp 0 with the reason), "Hitung semua" ⇒ `tax.computed` kind pph21; PPh Final Nov computed ⇒
  `tax.computed` kind pph-final. (5) Ekspor: preview of the Coretax XML import template structure (BPMP) + CSV journal,
  labelled "Contoh simulasi · bukan untuk diunggah", real file downloads, "Tandai siap lapor" (`[data-pb=ready]`) ⇒
  `tax.ready`. (6) Tanya Pajak: "Kenapa pajak bulan ini naik?" ⇒ `pajak-beres/tax-breakdown` computed from the world.
  Kalender: `MonthCalendar` with `taxCalendar` (setor 15, lapor 20, SPT Tahunan OP 31 Maret), "Ingatkan saya" = local
  chip + `useShell().toast` at world H-3 (no event), `.ics` via `icsFor`. Upload of an own image: Live only
  (`/api/ai/extract` after a consent line, not stored); not rendered in Sim.
- **Missions:** 1 `nota` — `isEvent(e,'ledger.posted') && e.source==='pajak-beres' && e.payload.source==='nota'` ·
  2 `mutasi` — on `ledger.reviewed`: `pendingReviews(s, shopId) === 0` and a `bank.imported` exists · 3 `pph21` —
  `tax.computed` kind `pph21` · 4 `ekspor` — `tax.ready` source pajak-beres · 5 `tanya` — markMission when the
  tax-breakdown card renders (hint on the canvas-header button: no `hintSm` needed).
- **Focus arrivals:** ledger id → Jurnal, row highlighted; po id → Dokumen with that nota selected, hotspot on Proses;
  tax item id → Kalender on the item (+ banner "Diminta TenderPilot · <tender title>" when `from=tenderpilot`); shop id
  → Kalender.
- **Tour hooks (ch. 13):** `[data-pb=process]`, `[data-pb=ready]`; `?focus=<poId>` from ch. 11; a cold `/tur/13` uses
  `pendingNotas[0]` (the selector falls back to the newest seeded received PO).
- **Numbers that agree:** Omzet Nov = `omzetByMonth` = Toko Autopilot month omzet; Estimasi PPh Final = omzet × rate
  after the Rp 500 jt line (all from `rules.ts`); nota total = PO total; review count 3 = Rapor Usaha "3 jurnal"; Beban
  Gaji = Σ staff gross = PPh 21 bruto base; KPI Laba = P&L Laba = AI answer; tax amount in Kalender = Ekspor = Tanya
  Pajak = TenderPilot checklist line.
- **AI:** ≥ 12 intents (ID/EN/Jawa examples): kenapa-pajak-naik, pajak-bulan-ini, kapan-tenggat, apa-pph-final,
  batas-500-juta, batas-4-8-miliar / perlu-ppn (non-PKP; PKP out of scope, text only), pph21-karyawan (slot name),
  kenapa-pph21-nol, untung-bulan-ini, kategori-transaksi (→ `ledger`, balanced), prive-vs-beban, cara-setor (billing is
  made in Coretax, not simulated), laporan-untuk-bank, fallback + "Tanyakan ke konsultan" (role switch). Every answer
  ends with "cek ke KPP/konsultan pajak". Prompt: keep `categorize_transaction`; add `explain_tax` `{ period, rows:
  [{ label, amount, rule_ref }], total, delta }` + mock; rules "use only context.rules (each has a source); never compute
  PPh 21 yourself, quote context.pph21; PP 20/2026 applies; non-PKP"; context ≤ 6 KB.
- **Phone 390:** KPI 2-up scroll with "Tenggat terdekat" first; Dokumen list → viewer full width above a bottom sheet of
  fields; Jurnal/PPh 21 as cards, inline edit in a Drawer; Laporan stacks chart, 3 cards, button; Ekspor full-height
  Drawer; "Tanya Pajak" stays in the canvas header (44 px icon + label).
- **Size note:** first load is the tightest (DocViewer is on the hero). If first load > 165 KB, render a static `DocArt`
  thumbnail and load DocViewer on "Proses nota" intent.
- **Self-check (extra):** every entry incl. the 40 CSV rows and the nota has Σ D = Σ C; `trialBalance().balanced` for
  Sep/Oct/Nov; Aset = Kewajiban + Modal (+ laba berjalan); grep: no rate/threshold/date literal outside `rules.ts`
  (`0.005`, `500_000_000`, `4_800_000_000`, `54_000_000`, due days); every citation chip opens its URL; PPh 21 rows equal
  a hand calculation from the TER rows in `rules.ts`; nota flow ≤ 2 s full motion, instant reduced; CSV 40 = matched +
  posted + review and Laba changes only by new rows; approve 3 ⇒ review 0 and `score.updated` delta > 0; `tax.ready`
  flips Kalender chips + `taxTidy` and survives reload; every export/paper view carries "SIMULASI · bukan dokumen
  resmi", NPWP masked, no billing code.

### P10 · Juara Jualan — `src/demos/juara-jualan/` · `dk-jj-` · prompt `juara-jualan.ts`
- **Frames/layout:** `BrowserFrame` (`demo.gamada.id/juara-jualan`). Header: industry `Segmented` Multifinance |
  Asuransi | Toko Bangunan (`?industry=mf|asr|tb`, default `tb`; world codes stay `multifinance|asuransi|toko-bangunan`)
  + KPI strip (`salesKpi`: Percakapan hari ini · Rata-rata skor · Perlu coaching · Pelanggaran skrip). Left 38 %:
  "Sedang berlangsung" strip (`liveCalls`) + list (`callList`, "Skor terendah dulu"). Right 62 %: Detail of
  `facts.up.lowCall[industry]` already open.
- **Roles:** Supervisor Sales (default; tabs Percakapan · Tim · Coaching · Latihan · Tanya QA; all agents; Nilai sekarang,
  Tugaskan coaching, Ubah skor manual per criterion ⇒ `call.scored` `by: 'supervisor'`) · Agen Sales (tabs Coaching Saya ·
  Latihan · Percakapan Saya; "Masuk sebagai" Select, default = agent with the newest coaching, else
  `newCashierAgentId` for tb; board shows own rank only "Anda #7 dari 9"). `?role=agen-sales` after an assignment lands
  on the new card (new-row highlight).
- **Files:** `index.tsx`, `Calls.tsx`, `LiveStrip.tsx`, `Detail.tsx`, `WaveMoments.tsx` (standalone waveform + markers,
  mini reuse), `Transcript.tsx`, `clips-tb.ts` (first load), `clips-mf.ts`, `clips-asr.ts` (lazy on industry intent;
  mf reuses `SALES_CALL`), `Team.tsx` (lazy), `Coaching.tsx` + `AssignDialog.tsx` (lazy), `AgentHome.tsx` (lazy),
  `Practice.tsx` + `roleplay.ts` (lazy), `AskQa.tsx` (lazy, registers `scenario.ts`), `strings.ts`, `juara-jualan.css`.
- **Detail:** `Waveform` (56 px+, stroke reveal ≤ 800 ms) with moment markers (salam, gali, keberatan, penawaran,
  closing, pelanggaran skrip; `data-tone`); synced transcript (current line highlighted, click line = seek); 6 criterion
  bars (count up); evidence quotes (each criterion quotes a real line of the clip, click = seek); "Seharusnya: …"
  suggestions specific to flag × industry. Recordings are SILENT by default (text timeline on the playback clock), with
  optional "Putar suara" (browser TTS via `SpeakButton`). Marker click ⇒ playhead within ±0.3 s (`data-playhead`).
- **Moves by itself:** live strip: 1–2 agents on a call, mm:ss counter, level meter (scaleY on `gsap.ticker`, paused
  off-screen), a transcript line every ~3 s from that call's clip ("Simulasi panggilan langsung"). Guaranteed 07:01
  `call.created`, call end ⇒ `call.scored` chip drops in. Reduced motion: no meter, rows still arrive.
- **Tim:** `teamBoard` leaderboard, `RadarChart` agent vs team average, 14-day `LineChart`. **Coaching:** weekly card per
  agent = 3 focus + 1 example sentence each; "Tugaskan coaching" (prefilled from `weakest(criteria, 3)`) ⇒
  `coaching.assigned` with baseline = agent avg14. **Latihan:** roleplay personas ragu-harga / buru-buru / banyak-tanya
  per industry (8-step scripts with branches); agent reply classified locally (probe, empathy, value, discount,
  pressure, breach words "pasti disetujui", "dijamin", "100 %", CTA); 3 suggestion chips per turn (good/average/weak)
  so phones play without typing; ends at turn 8, "selesai" or accepted CTA; ≥ 6 turns ⇒ score, baseline, delta,
  3 bullets ⇒ `roleplay.completed`. Weak chips give a lower score (honest).
- **PO chat (C17):** a shop `po.sent` creates a WA `call.created` (clip `tb-wa-prapesan`, agent = new cashier, refId
  poId, unscored). Its Detail quotes the karung/terpal price (`fmtRp(products.price)`), PO code and supplier ETA when
  replied, all from the world; link "Lihat PO-xxxx di Toko Autopilot" → `/demo/toko-autopilot?focus=<poId>`. Flood
  context chip on `topic: 'banjir'` calls → `/demo/siaga-wilayah?focus=<alertId>`.
- **Missions:** 1 `momen` — markMission when the playhead lands within ±0.3 s of a `danger` marker after a marker or
  evidence click · 2 `nilai` — `call.scored` source juara-jualan · 3 `coaching` — `coaching.assigned` source
  juara-jualan · 4 `agen` — markMission when role = `agen-sales` and the newest card renders (`hintSm` "Buka ⋯ → Peran →
  Agen Sales") · 5 `latihan` — `roleplay.completed` with `turns >= 6`. Hotspot `[data-hotspot="jj-marker-danger"]`
  "Klik momen merah: rekaman loncat ke detik masalah" (phones: the red Momen chip has the same attribute).
- **Focus arrivals:** call id → switches industry, opens Detail, scrolls; staff id / agent id → Tim with that agent;
  coaching id → Coaching card.
- **Tour hooks (ch. 12):** `[data-jj=score-now]`, `[data-hotspot=jj-marker-danger]`, `[data-jj=assign]`.
- **Numbers that agree:** list score = detail total = audit row = toast (`callScore`); board avg14 = agent view =
  roleplay baseline (stored at assignment); radar = criteria averages; KPI counts = `callList` length; PO chat price /
  PO code / ETA = Toko Autopilot; agent names identical in Juara Jualan, Inti audit, Toko Autopilot shifts.
- **AI:** Tanya QA ≥ 10 intents: skor-terendah-hari-ini, agen-paling-perlu-coaching, kenapa-skor-rendah,
  keberatan-tersering (14 d), bandingkan-tim, tren-minggu-ini, contoh-jawab-keberatan-harga (per industry),
  arti-kriteria-kepatuhan, ringkas-panggilan-ini, buat-kartu-coaching (opens the assign dialog prefilled),
  mulai-latihan, fallback. "Nilai sekarang": "menilai…" 1.2 s, criteria = the clip's ok/miss tags, total via
  `callScore`, chips stagger 60 ms. Prompt: keep `score_call` (map `gali-kebutuhan→gali`, `kepatuhan-skrip→kepatuhan`,
  0–5 × 20 → 0–100, then `callScore`); add `draft_coaching` `{ focus: [{ key, title, example }] × 3 }` + mock; context
  `{ mode: 'qa'|'roleplay', industry, persona, turnLimit: 8, transcript, agent: { name, baseline } }`.
- **Phone 390:** industry Segmented → `Select`; tabs scroll; KPI 2-up; list → cards, Detail as full-height Drawer;
  waveform full width with a "Momen" chip row (44 px, scrolls; red chip = hotspot); mini player sticky over the
  transcript; Latihan full-height chat, 3 chips + input pinned bottom (`env(safe-area-inset-bottom)`).
- **Self-check (extra):** marker sync logged for 5 markers × 3 clips; every evidence quote is a real line of its clip;
  every `CALL_CLIPS` key has a clip with its `weak` criterion tagged miss; no suggestion text repeated across clips;
  `__gamada.emit('po.sent', <shop PO>)` ⇒ WA row ≤ 1 s with Toko Autopilot's price/code and a toast whose link opens it;
  assign → role switch → card with 3 + 3; good chips ⇒ score > baseline, weak chips ⇒ lower; ID/EN on transcripts
  (EN line under ID), roleplay scripts and chips; Space play/pause.

### P11 · Kenal Mitra — `src/demos/kenal-mitra/` · `dk-km-` · prompt `kenal-mitra.ts`
- **Frames/layout:** `BrowserFrame` (`demo.gamada.id/kenal-mitra`), tabs Antrian · Nasabah (KYC) · Mitra/Supplier (KYB) ·
  Kandidat (CV), `?tab=antrian|kyc|kyb|cv` (default antrian). KYC uses `SplitStage` 40/60: `PhoneFrame` "HP Nasabah"
  (generic koperasi app) | "Analis". `PaperFrame` only for the certificate (lazy). Same document engine as Cek Berkas
  (kit `docs`), never forked.
- **Roles:** Analis KYC/HR (default, all tabs and actions) · Bank/Koperasi Mitra (lender `LENDERS[0]`; tabs "Permintaan
  saya" + "Hasil verifikasi" with consent line "dibagikan atas persetujuan nasabah"; "Minta KYC nasabah baru" (pick 1 of
  3 seeded applicants ⇒ `verification.requested`, toast with a "Ganti peran" button); "Lihat sertifikat"; KYB results
  read-only; no Kandidat tab).
- **Files:** `index.tsx`, `Queue.tsx`, `CatalogPreview.tsx`, `Activity.tsx`, `Kyc.tsx` (lazy), `LivenessFace.tsx` (lazy,
  SVG specimen face, landmark dots), `Kyb.tsx` (lazy), `KybChecks.tsx` (standalone, mini reuse), `LocationCheck.tsx`
  (lazy after "Cek lokasi": `MapView` + `desa` layer + `pointMarkers`), `Candidates.tsx` + `CvFunnel.tsx` (lazy,
  standalone), `Certificate.tsx` (lazy), `Reasons.tsx` (lazy "Tanya alasan", registers `scenario.ts`), `strings.ts`,
  `kenal-mitra.css`.
- **First 30 s:** KPI (`verificationKpi`): Antrian 8 · Selesai hari ini · Median waktu verifikasi "4 mnt (simulasi)" with
  "manual ±2 hari kerja (ilustrasi)" · Mitra terverifikasi (= `verifiedBusinesses(s).length`). Three lanes KYC | KYB |
  Kandidat of request cards (`KM-0xx`, subject, requester, waiting time ticking per world minute, priority chip "Untuk
  kebutuhan KL-…"). Right rail 30 %: "Pratinjau etalase Katalog Lokal" (`catalogPreview`: open needs + top 3 suppliers
  with badges Terverifikasi / Pajak Rapi / Skor Usaha) above "Aktivitas" (last 6 verification audit rows). At 07:01
  (≈ 6 s) Joko's KYC request slides into the KYC lane, Antrian 8 → 9, hotspot `[data-hotspot="km-first-request"]`
  "Mulai verifikasi nasabah ini". After a `flood.alert`, up to 2 priority KYB requests jump to the top (C26).
- **KYC flow:** phone form (prefilled from the request) → "Foto KTP" (`ktp-joko`, tilted, kit straightens) → "Swafoto"
  (sample face default; opt-in real camera via `useCamera`, processed locally, never uploaded, labelled simulasi;
  denied/unavailable ⇒ sample face silently) → liveness "Kedipkan mata", "Tolehkan kepala ke kiri" (progress ring,
  ≈ 4 s, "Simulasi uji liveness") → "Kirim" (phones switch to the Analis tab). Analis: DocViewer + ExtractPanel, checks
  (NIK format, birth date in NIK = field, form ↔ KTP name/address, liveness, face match "cocok 0,93 (simulasi)"), risk
  `Gauge`, Setujui / Tinjau / Tolak (AI suggestion preselected) ⇒ `partner.verified` kind kyc. Joko ⇒ 18 setujui.
  `ktp-siti-edit` (Siti Nurjanah) ⇒ TamperHeatmap, 63 tinjau, link "Dokumen yang sama ditandai di Cek Berkas ↗"
  `/demo/cek-berkas?focus=<facts.tamperedDocumentId>`.
- **KYB flow:** doc strip NIB · NPWP · Akta (CV/PT only) · Foto lokasi (all SPESIMEN, `kybSpecimens`); "Mulai verifikasi"
  (`[data-km=start]`) extracts the docs in sequence (≤ 2.5 s); cross-check matrix (nama usaha, pemilik/direktur,
  alamat, KBLI × docs, ✓/≠ with values); owner KTP check ("Direktur: Joko Prasetyo · KYC lolos" if done, else inline);
  "Cek lokasi" (`[data-km=map-check]`, loads map on intent): NIB pin + photo GPS pin + 1 km ring on real desa
  boundaries, distance label. Hero ⇒ 0,2 km, all ✓, score 91 ⇒ Setujui (`[data-km=approve]`) ⇒ `partner.verified` kyb
  lolos ⇒ DispositionStamp "Terverifikasi" ⇒ the preview card (`[data-km=catalog-preview]`) flips its badge ≤ 1 s and
  shows "Masuk shortlist KL-… (karung pasir)" when a matching need is open (C27). Mismatch ⇒ GPS ≈ 9 km in another
  kecamatan + NPWP name ≠ ⇒ `cek-manual` (never lolos). Toast after the hero: "CV Sedeng Jaya Abadi terverifikasi:
  lencana dicatat untuk Katalog Lokal & Rapor Usaha (demo tahap 4)" (shell; no link until READY).
- **CV flow:** opening "Staf Administrasi Keuangan · <shop name>"; "Unggah 200 CV contoh" ⇒ 200 dots fill (stagger,
  transform) → "Saring" (`[data-km=screen]`) → criteria (pendidikan min, pengalaman ≥ n th, skill wajib chips, domisili
  ≤ n km from the shop) → funnel 200 → n → top 10 with fit bar + one reason (≤ 3 s animation) ⇒ `partner.verified` ×10
  kind cv (one batch). Blind toggle "Sembunyikan nama/foto": names → `Kandidat K-0147`, neutral tiles; ranking
  identical (dev assert). Row: "Lihat CV" (`cvDoc`, reasons highlighted). No "Undang wawancara" (no reducer).
- **Computed rules (in `mitra.ts` / product):** `kycRisk` = 10 + 45 tamper + 8 per field mismatch + 30 liveness fail +
  15 if address > 5 km, clamp 0–100; < 30 setujui, 30–69 tinjau, ≥ 70 tolak; `kybScore` = 100 − penalties (same table);
  name/address equality: normalised token Jaccard ≥ 0.8; CV fit `cvFit`, ties by id; name, gender, age, kecamatan name
  are never inputs.
- **Missions:** 1 `kyc` — `partner.verified`, `kind === 'kyc'`, source kenal-mitra · 2 `kyb` — kind kyb, result lolos ·
  3 `alamat` — kind kyb, result `cek-manual` · 4 `cv` — markMission when the shortlist of 10 renders after the cv batch.
  Hints name lanes/tabs (no top-bar hints).
- **Focus arrivals:** request id, verification id (bank: certificate), business id → matching tab + case; bad id ⇒
  Antrian + toast.
- **Tour hooks (ch. 9):** `?tab=kyb&focus=<facts.up.kenalMitra.heroRequestId>`, `[data-km=start]`,
  `[data-km=map-check]`, `[data-km=approve]`, `[data-km=catalog-preview]`.
- **Numbers that agree:** Mitra terverifikasi = `verifiedBusinesses(s).length` (Katalog Lokal badges, Rapor Usaha
  factor); score delta = `score.updated.delta` (never typed); 200 / 10 = `facts.up.kenalMitra`; risk 18/63 =
  `kycRisk`; KYB 91 = `kybCase().score`; distance = `distanceKm`; need code + kecamatan = `catalogNeeds` row.
- **AI:** no free chat; "Tanya alasan" panel ≥ 10 intents: why-review, why-reject, what-checked, liveness-how,
  data-stored (spesimen; nothing leaves the browser), kyb-docs-needed, badge-meaning, cv-why-rank, cv-blind, cv-bias,
  next-step, fallback; reasons templated from passed/failed checks (no template twice in one list). Prompt: keep
  `kyc_decision`; add `rank_candidates` `{ ranked: [{ ref, fit 0–100, reason ≤ 200 }] ≤ 10, criteriaUsed ≤ 6 }` + mock;
  CV context = only the 30 pre-filtered candidates, anonymised `{ ref, years, education, major, skills }`; KYC/KYB
  context = check results only, never the image; unknown refs ⇒ sim.
- **Phone 390:** KPI 2×2, lane filter chips + one card list, catalog preview as a collapsible card below; KYC SplitStage
  tabs "HP Nasabah | Analis"; KYB docs 2×2, matrix → one card per field, map card 200 px, sticky bottom bar Tinjau /
  Setujui; CV criteria in a Drawer, shortlist as cards, blind toggle sticky in the list header.
- **Self-check (extra):** hero badge ≤ 1 s and `businesses[hero].verified === true`, `match.made` when a need is open;
  mismatch never lolos, map 2 pins ≈ 9 km; KPI +1 exactly; blind toggle keeps the same 10 ids in order; INP < 200 ms on
  Saring; bank role round trip; camera denied ⇒ no error, tracks stopped on leave; "SPESIMEN" on every doc and
  "simulasi" on risk / face match / median time.

### P12 · Pantau Merek — `src/demos/pantau-merek/` · `dk-pm-` · prompt `pantau-merek.ts`
- **Frames/layout:** `BrowserFrame` (`demo.gamada.id/pantau-merek`), tabs Pantauan · Ulasan · Kompetitor
  (`?tab=pantauan|ulasan|kompetitor`). Same look and interaction grammar as Radar Isu (stream + bars + alert card + tone
  drafts + "Lihat 30 menit ke depan"), built from the kit, never imported from `src/demos/radar-isu`. Brand = the shop
  (outlet filter chip); competitors = `s.meta.competitors`. Channel labels generic (§6 Q2): "Marketplace", "Medsos foto",
  "Medsos singkat", "Video pendek", "Ulasan peta".
- **Roles:** Brand Manager (default; all tabs; replies signed "— Tim <shop name>"; publishes announcements; offer
  "Gratis ongkir" shows "perlu persetujuan pemilik" + a real button that switches role) · Pemilik Toko (owner band above
  the stream: "Pesanan terdampak banjir: 14 · nilai Rp 18,4 jt (simulasi)" from `affectedOrders`, top 3 issues in plain
  words, "Setujui pengumuman" when a draft waits; replies signed "— <owner first name>, pemilik"; "Gratis ongkir"
  enabled). Role switch keeps tab and selection.
- **Files:** `index.tsx`, `Kpis.tsx`, `AlertCard.tsx`, `Stream.tsx`, `Crawl.tsx` (aria-hidden, derived from world
  minutes), `ReputationChart.tsx` (standalone, mini reuse), `Topics.tsx`, `Channels.tsx` (local StackedBar), `Reviews.tsx`
  (lazy), `BulkReply.tsx` (lazy), `ReplyChip.tsx` (standalone "Dibalas HH.MM · empatik"), `Cluster.tsx` +
  `Announce.tsx` (lazy, register `scenario.ts`), `Competitors.tsx` (lazy), `OwnerBand.tsx` (lazy on role intent),
  `strings.ts`, `pantau-merek.css`. Uses `useFloodAutoplay(true)`.
- **First 30 s:** KPI (`brandKpi`: Skor reputasi 0–100 · Sebutan 24 jam · Keluhan belum dibalas · Waktu balas median).
  Left 40 % stream (`brandStream`, newest first, 20 visible). Middle reputation line 24 h (shop vs category) + topic bars
  (pengiriman, kualitas, harga, layanan, stok; delta vs previous 24 h). Right: `sentimentByChannel` (5 rows pos/neu/neg
  + net + text summary) + alert slot. Before the flood: honest pre-signal card "2 keluhan pengiriman sejak subuh (hujan
  semalam) · dipantau" with sparkline and "Lompat ke lonjakan" (`[data-pm=jump-spike]`, `clock.setTime(alert.at + 1)`
  once the flood exists, else `clock.setTime(UP_SCENARIO.floodAt + 7)`), hotspot `[data-hotspot="pm-jump"]`. 07:01
  ambient mention (≈ 6 s); 07:06 flood (autoplay) ⇒ in-page notice "Peringatan banjir level 3 aktif: Kec. … (Siaga
  Wilayah, otomatis)"; burst mentions land; 07:12 the card flips to the red alert (scale 0.98→1 + opacity, 240 ms),
  marker on the line; hotspot moves to `[data-hotspot="pm-handle"]` "Tangani lonjakan". Opened later / after a jump ⇒
  the alert is already there, stamped at its crossing minute (no duplicate).
- **Flow:** alert card → "Kelompokkan" (`[data-pm=cluster]`) ⇒ `clusters` (≤ 6, from `complaintClusters`, e.g.
  "Telat 1–3 hari ke Kec. Kanor/Trucuk" 55 %, "Tidak ada kabar/ETA" 25 %, "Pompa celup kosong" 12 %, "Harga terpal naik"
  8 %; samples are real review texts; the stok cluster quotes "Permintaan pompa naik 340 %" = flood factor and links to
  Toko Autopilot PO state) → "Sarankan pengumuman" ⇒ `pantau-merek/announcement` (names the 4 kecamatan, "pengiriman
  tertunda 1–2 hari karena banjir", ambil sendiri di <market>, offer) → channels incl. `struk` → "Terbitkan"
  (`[data-pm=announce-publish]`) ⇒ `brand.announced` (trickle stops; C29 recovery + `pos.noticeSet`). Ulasan: filter
  chips, review cards with 44 px checkboxes, "Pilih 5 dari lonjakan" (`[data-pm=select-alert-5]`), sticky "Balas n
  terpilih" (`[data-pm=bulk-open]`) → bulk sheet: tone Segmented (`[data-pm=tone-empatik]` / formal / santai), one draft
  per review personalised from `replyInputs` (handle, item, orderCode, desa, daysLate, outlet; 3 tones × ≥ 4 opening and
  closing banks so 5 drafts never share a sentence; language follows the review), "Kirim n balasan"
  (`[data-pm=bulk-send]`) ⇒ ONE `brand.replied` ⇒ replies attached under each review (Ulasan + stream), "belum dibalas"
  −n, reputation up at once (× 0.5 weight). "Lihat 30 menit ke depan" (`[data-pm=ahead30]`, `clock.setTime(now + 30)`)
  shows follow-ups (C29) and recovery. Kompetitor: `competitorCompare` (share of voice `Donut`, net sentiment, avg rating,
  top complaint, reply rate, median reply time, 7-day reputation lines) with metric Segmented Reputasi / Waktu balas /
  Rating. Links: "Lihat di Siaga Wilayah" → `/demo/siaga-wilayah?focus=<floodAlertId>`.
- **Missions:** 1 `lonjakan` — `brand.announced` source pantau-merek · 2 `balas5` — `brand.replied` with
  `mentionIds.length >= 5`, source pantau-merek · 3 `kompetitor` — markMission when the Kompetitor metric Segmented is
  switched (not on tab open) · 4 `pulih` — markMission when `reputationScore(s, now).score >= spikeLow + 5` after a reply
  or announcement. Top-bar hints carry `hintSm`.
- **Focus arrivals:** brandAlert id → Pantauan, card expanded; mention id → Ulasan, selected and scrolled; announcement
  id → Pantauan, announcement panel open.
- **Tour hooks (ch. 15):** `[data-pm=cluster]`, `[data-pm=announce-publish]`, `[data-pm=select-alert-5]`,
  `[data-pm=bulk-open]`, `[data-pm=tone-empatik]`, `[data-pm=bulk-send]`, `[data-pm=ahead30]`, `[data-pm=jump-spike]`.
- **Numbers that agree:** alert volume / +x % / crossing time = card = audit row = Toko Autopilot chip (one
  `brandAlerts` row); reputation = KPI = Kompetitor row = owner band = mission 4; flood time 07:06 + kecamatan = Siaga
  Wilayah / Awas Belanja; pump +340 % = `WORLD.floodDemandFactor`.
- **AI:** scenario intents `cluster_complaints` → `clusters`, `draft_announcement` → `pantau-merek/announcement`,
  `draft_reply` / `draft_bulk_replies` → `reply` (single streams ≤ 1.2 s, bulk drafts one by one ≤ 2 s total),
  `explain_spike` → `insight` (flood + road names from the pack, "rute ke Kec. X terdampak genangan (simulasi)", no
  invented closures), `compare_competitors` → `insight` (no attacks), `summarize_today` → `insight` (owner band).
  Prompt: keep `cluster_feedback`, `draft_reply`; add `draft_announcement` `{ text, channels, offer }` + mock; context =
  selected reviews (≤ 8) + spike numbers; keep "never fake reviews, never ask to delete honest reviews".
- **Phone 390:** tabs scroll; Pantauan: alert/pre-signal card (sticky under tabs while active, collapsible) → KPI 2×2 →
  stream cards (12 + "Muat lebih") → reputation → topics → channels; Ulasan: chip row, cards with checkbox, sticky bulk
  bar; bulk sheet full height, one collapsible draft per review, sticky "Kirim n balasan"; Kompetitor table → cards.
- **Self-check (extra):** hands-off alert ≤ 07:13 world (≈ 40 s); "Lompat ke lonjakan" gets there in 1 click; no burst
  mention after `brand.announced`; 5 distinct drafts each naming its item/orderCode/desa; tone switch regenerates; EN
  reviews get EN drafts; Toko Autopilot toast after a `struk` announcement and its link opens the Kasir notice; stream
  `aria-live` ≤ 1 per 10 s.

### P13 · TenderPilot — `src/demos/tenderpilot/` · `dk-tp-` · prompt `tenderpilot.ts`
- **Frames/layout:** `BrowserFrame` (`demo.gamada.id/tenderpilot`), tabs Umpan · Detail · Dokumen · Riwayat; 1440: Umpan
  40 % | Detail 60 %. Header KPIs (`tenderKpi`): Tender terbuka cocok · Rata-rata peluang · Tenggat ≤ 3 hari · Nilai
  penawaran aktif. Profile chip "<shop name> · KBLI 46634 · Terverifikasi (Kenal Mitra)". Feed label "Data pengadaan
  simulasi, bergaya pengumuman publik"; never LPSE/SPSE branding. `PaperFrame` + `printPaper` in Dokumen.
- **Role:** Vendor only; the RoleSwitcher shows "Vendor · <owner name>" with no menu. Profile drawer "Satu akun · data dari
  Kenal Mitra, Pajak Beres, Toko Autopilot" with deep links (`vendorProfile`).
- **Files:** `index.tsx`, `Feed.tsx` + `Filters.tsx`, `Banner.tsx`, `Detail.tsx`, `ScoreCard.tsx` (standalone Gauge +
  factors, mini reuse), `Checklist.tsx` (standalone), `PriceCard.tsx`, `Deadlines.tsx` (lazy, `MonthCalendar`, `.ics`),
  `Composer.tsx` (lazy: sections, `TextDiff`, terbilang), `Preview.tsx` (lazy PaperFrame), `Send.tsx` (Stepper),
  `History.tsx` (lazy), `ai.ts` (lazy, registers `scenario.ts`), `strings.ts`, `tenderpilot.css`. Uses
  `useFloodAutoplay(true)`.
- **First 30 s:** best match open on the right. Clock plays; 07:01 natural tender ⇒ `tender.matched` ⇒ bell badge + row
  "Baru · peluang 64 %" slides in (≈ 6 s, ≤ 10 s). 07:06 flood ⇒ need ⇒ emergency tender ⇒ `tender.matched` 0.78 ⇒ peach banner
  (`aria-live`) "Tender baru cocok: Pengadaan Karung Pasir & Terpal (darurat) · peluang 78 % · tenggat <day> 12.00" with
  "Buka" (`[data-hotspot="tp-open"]`; before the banner the hotspot sits on the first row). Countdown chips tick. Reduced
  motion: no autoplay animation, rows/banner still appear when the clock is played or jumped; static line "Jalankan jam
  untuk melihat tender baru masuk" (with `hintSm`).
- **Umpan:** `tenderFeed` rows (code, title, OPD, kecamatan, value, method, deadline, competitors, KBLI); filters KBLI,
  lokasi, nilai (≤ 50 jt / 50–200 jt / > 200 jt), tenggat (≤ 3 / ≤ 7 hari / semua), each shows a count; sort peluang
  menang; KBLI-mismatch rows greyed "KBLI tidak cocok"; the pump mirror tender shows "peluang rendah" and, after Awas
  Belanja's analysis, chip "Temuan pengawas ↗" → `/demo/awas-belanja?focus=<procurementId>`.
- **Detail:** AI summary (streamed after the first interaction or "Ringkas"), `ScoreCard` (`Gauge` 0–100 % + 5 factor
  bars with one sentence and naik/turun), `Checklist` from `requirementsFor` — for the shop 7 items: nib-kbli, npwp, kyb
  (chip "Kenal Mitra · terverifikasi <date>" → `/demo/kenal-mitra?focus=<verificationId>`), pengalaman, kapasitas
  (warning from Toko Autopilot stock, e.g. "Stok 1.240 dari 2.000 karung · kirim PO di Toko Autopilot ↗" →
  `/demo/toko-autopilot?focus=<productId>`; not blocking), pakta, **pajak missing** ("Status pajak belum valid · Lengkapi
  di Pajak Beres" `[data-tp=tax-link]` → `/demo/pajak-beres?focus=<taxItemId>&from=tenderpilot`); `tax.ready` ticks it
  ≤ 1 s with animation. Deadline calendar; `PriceCard` (`priceAdvice`: range, suggested, HPS, cost, margin, position vs
  history; what-if −3 % / +3 % chips recompute).
- **Dokumen:** 7 sections = 34 pages: Surat Penawaran (2), Daftar Kuantitas & Harga (3), Spesifikasi Teknis & Contoh
  Barang (6), Jadwal & Metode Pengiriman (3), Pengalaman Pekerjaan Sejenis (5), Pakta Integritas & Pernyataan (2),
  Lampiran legal NIB/NPWP/KTP pemilik/sertifikat KYB (13). "Susun dengan AI" (`[data-tp=compose]`) fills sections in a
  stagger, page counter 0 → 34; "Sebelum" = profile template with `[perlu dilengkapi]`, "Sesudah AI" = filled text;
  `TextDiff` toggle per section; sections stay editable (`Textarea`); price edits re-run total + `terbilang`. "Cetak /
  Simpan PDF" prints only the PaperFrame.
- **Send:** Stepper Periksa → Tanda tangan (simulasi) → Kirim (`[data-tp=send]`) ⇒ ONE `bid.submitted` `{ tenderId,
  businessId, price, pages: 34, docSections }` ⇒ C25 `procurement.bidReceived` ⇒ shell toast to Awas Belanja (its
  `?focus=<procurementId>` shows the shop's bid row, same price). "Kirim" disabled with the reason while pajak is
  missing.
- **Riwayat:** `bidHistory` table (menang / kalah / evaluasi / terkirim), win rate, value won, strip plot of bid/HPS.
- **Missions:** 1 `buka` — markMission when the Detail of a tender with `method === 'darurat'` renders · 2 `syarat` —
  `isEvent(e,'tax.ready') && e.payload.businessId === shopId`, or markMission at once if the checklist is already
  complete when Detail opens · 3 `susun` — markMission when all 7 sections hold their AI version · 4 `kirim` —
  `bid.submitted` source tenderpilot.
- **Focus arrivals:** tender id → Detail of that tender, scrolled to top; procurement id → the mirrored tender.
- **Tour hooks (ch. 10):** `?focus=<emergency tenderId>`, `[data-tp=tax-link]`, `[data-tp=compose]`, `[data-tp=send]`.
- **Numbers that agree:** probability in banner = gauge = row = audit "(78%)" = tour caption (`tender.matches[shopId]`);
  HPS = Σ need qty × `EMERGENCY_TENDER.hps` (2.000 karung × Rp 15.500 + 50 terpal × Rp 135.000 = Rp 37.750.000 on
  seed 1, computed) = Awas Belanja package HPS; bid price in Surat = Daftar Harga total = terbilang = `bid.submitted.price`
  = audit = Awas Belanja bid row = toast; stock and SKU prices = Toko Autopilot; KYB date = Kenal Mitra; tax status =
  Pajak Beres; deadline = calendar = countdown; page count = `bid.pages`.
- **AI:** sim intents `ringkas-tender`, `jelaskan-skor` (→ `win-score`), `saran-harga` (→ `win-score` priceRange),
  `cek-syarat`, `susun-bagian:<id>` × 7 (→ `tenderpilot/bid-section`), `pertanyaan-klarifikasi` (pump tender only:
  polite question about the brand-locked spec), fallback; `tenderpilot/tender-summary` `{ summary, keyRequirements ≤ 5,
  risks ≤ 3, deadline }`. Wording canned per section (no template repeated across sections). Prompt: keep `estimate_win`;
  add `summarize_tender`, `draft_bid_section` + mocks; context ≤ 6 KB `{ tender, requirements, priceAdvice, profile,
  history }`; add "jangan menyebut nama portal pengadaan nyata".
- **Phone 390:** tabs as the top row (scroll, 44 px); opening a tender switches to Detail; filters in a bottom Drawer
  ("Filter · 3 aktif"); Detail order banner, gauge 160 px + factors, checklist, price, week strip; Dokumen accordion,
  PaperFrame scaled by `transform: scale()`, "Lihat halaman" full-height Drawer; Susun/Kirim in flow at the end, never
  fixed over the guide pill.
- **Self-check (extra):** hands-off: new match row ≤ 10 s, emergency banner by ≈ 40 s; 78 % in banner, gauge, row and
  audit; `__gamada.emit('tax.ready', { businessId: shopId, period: '2026-11', taxItemIds: [...] }, 'pajak-beres')`
  ticks ≤ 1 s; compose 0 → 34 and Surat total = Daftar Harga = terbilang; bid sent once on double click and visible in
  Awas Belanja `?focus=`; pump tender low chance + risk note after `procurement.flagged`; every filter changes the count;
  `.ics` valid.

---

## 3 · Cross-product chains (exact event names; ids continue after C13)

World self-test section "tahap-3 Usaha Pintar chains" (`up.selftest.ts`, mini fixture AND every real pack) and
`tests/e2e/chains.spec.ts` (world level, kit agent) cover C14–C29. Builders verify the rows that name their product in
their own spec; the integrator adds the UI-driven variants. Existing C5 (`flood.alert` ⇒ `stock.forecastChanged`
toko-autopilot · `need.created` katalog-lokal) becomes visible in Toko Autopilot now.

| # | Root (source) | Reaction id → follow-ups (source) | Visible in / toast → landing |
|---|---|---|---|
| C14 | `sale.created` (toko-autopilot · clock) | 'sale→ledger' → `ledger.posted` source sale (pajak-beres) → 'ledger→score' `score.updated` (rapor-usaha) | toast "Transaksi <code> diteruskan ke Pajak Beres" → `/demo/pajak-beres?focus=<ledgerId>` (Rapor Usaha "(demo tahap 4)") |
| C15 | `stock.forecastChanged` | 'forecast→po-draft' → `po.drafted` per supplier (toko-autopilot) | Toko PO tab |
| C16 | `po.sent` (toko-autopilot) | 'po→supplier-reply' → `supplier.replied` (toko-autopilot; per-supplier pool; flood goods ETA next 07.00) | in-canvas chat bubble after typing 1.2–2 s; no cross toast |
| C17 | `po.sent` (shop PO) | 'po→sales-chat' → `call.created` WA, clip `tb-wa-prapesan`, agent = new cashier, refId poId (juara-jualan) | toast "Chat pra-pesan PO-xxxx diteruskan ke Juara Jualan" → `/demo/juara-jualan?focus=<callId>&industry=tb` |
| C18 | `supplier.replied` (shop PO, once per poId) | 'supplier-reply→nota' → `nota.received` (pajak-beres) | toast "Nota PO-xxxx masuk ke Pajak Beres" → `/demo/pajak-beres?focus=<poId>` |
| C19 | `ledger.reviewed` (pajak-beres) | 'ledger-reviewed→score' → `score.updated` (rapor-usaha) | "(demo tahap 4)" label |
| C20 | `price.anomaly` beras/cabai/bawang (sinyal-pasar) | 'price-anomaly→shop-stock' → `stock.forecastChanged` on `cm:` bahan SKUs, factor 1.6 (toko-autopilot) | toast → `/demo/toko-autopilot?tab=prediksi&outlet=warung&focus=<productId>` |
| C21 | `need.created` emergency, items ⊂ shop supplies (katalog-lokal) | 'need→tender' → `tender.created` key `karung-terpal-darurat` (tenderpilot) | TenderPilot banner |
| C22 | `tender.created` | 'tender→match' → `tender.matched` shop, p = `winScore` (0.78 seed 1) (tenderpilot) | toast "Tender darurat dicatat untuk TenderPilot" → `/demo/tenderpilot?focus=<tenderId>` |
| C23 | `tender.created` method darurat (not a mirror) | 'tender→procurement' → `procurement.created` same key, clean spec, no ring, `bidderIds: []` (awas-belanja) | Awas Belanja list +1 package |
| C24 | `procurement.created` key `pompa-darurat` | 'pump→tender' → `tender.created` mirror with procurementId → C22 low p (≈ 0.2) | TenderPilot "peluang rendah" |
| C25 | `bid.submitted` with tender.procurementId (tenderpilot) | 'bid→procurement' → `procurement.bidReceived` (awas-belanja) | toast "Penawaran Rp … terkirim ke BPBD" → `/demo/awas-belanja?focus=<procurementId>` |
| C26 | `need.created` | 'need→vendor-kyb' → `verification.requested` ≤ 2 unverified matching businesses within capacity, hero first, `priority: true` (kenal-mitra) | toast → `/demo/kenal-mitra?tab=kyb&focus=<requestId>` |
| C27 | `partner.verified` business lolos (kenal-mitra) | existing 'kyb→score' `score.updated` · 'kyb→catalog-match' → `match.made` per open matching need (katalog-lokal) | "lencana dicatat untuk Katalog Lokal & Rapor Usaha (demo tahap 4)"; Awas Belanja `localBenchmarks` |
| C28 | `flood.alert` (siaga-wilayah · clock 07:06) | 'flood→brand-delivery' (once per business per day) → `brand.mentioned` × 8 pengiriman at +[0,1,2,4,6,9,15,24] min, 1 stok (pompa celup) +7, 1 harga (terpal) +12, 1 pengiriman per hour to 17:00, 2 competitor +6/+19 · `brand.alert` with `at` = 5th pengiriman (+6) (pantau-merek) | Siaga toast lists Pantau Merek → `/demo/pantau-merek?focus=<brandAlertId>` |
| C29 | `brand.replied` / `brand.announced` (pantau-merek) | 'brand-replied→recovery' (2 of 5 replied ≤ 3-star authors follow up +8…+30, + 1 positive category mention) · 'brand-announced→recovery' (3 positive +5…+30) + `pos.noticeSet` when channels include `struk` (toko-autopilot) | reputation line; toast "Pengumuman layanan diteruskan ke Toko Autopilot (Kasir)" → `/demo/toko-autopilot?tab=kasir&focus=<announcementId>` |

Depth: flood 0 → need 1 → tender 2 → matched/procurement 3 (≤ `WORLD.maxDepth` 4).

**State links (no event; selectors read state; toasts via `EFFECT_ALSO`):**
| # | Root | Read by | Landing |
|---|---|---|---|
| L1 | `tax.ready` (pajak-beres) | TenderPilot `requirementsFor` pajak ✓; Katalog Lokal "Pajak Rapi" (tahap 4) | one toast "Status pajak November siap: diteruskan ke TenderPilot …" → `/demo/tenderpilot?focus=<tenderId of latest tender.matched>` |
| L2 | `partner.verified` (kenal-mitra) | TenderPilot kyb chip; Kenal Mitra catalog preview | `/demo/kenal-mitra?focus=<verificationId>` |
| L3 | `procurement.flagged` (awas-belanja) | reducer sets `tender.risk` on the pump mirror | TenderPilot row chip |
| L4 | `coaching.assigned` for the new cashier | Toko Autopilot shift badge | `/demo/juara-jualan?focus=<staffId>` |
| L5 | `brand.alert` | Toko Autopilot Dasbor chip | `/demo/pantau-merek?focus=<brandAlertId>` |
| L6 | `need.created` | Toko Autopilot `shopOpportunities` card | plain text until Katalog Lokal READY |

---

## 4 · Do not touch (builders)

- `src/demo-kit/**` (world, shell, ui, viz, map, docs, media, ai, region, frames, i18n, CONTRACTS.md).
- `src/demos/registry.ts`, `src/demos/_placeholder/**`, every other product folder (incl. the 7 Satu Daerah ones; Radar
  Isu is a pattern to copy ideas from, never to import).
- `src/routes/**`, `src/router.tsx`, `src/routeLoaders.ts`, `src/content/**` (incl. `products.ts`), `src/lib/**`,
  `src/styles/**`, `src/main.tsx`, `src/index.css`, `src-art/**`, `index.html`.
- `server/ai-proxy/src/**`, `server/ai-proxy/prompts/_shared.ts`, `prompts/index.ts`, `server/ai-proxy/test/**`, other
  products' prompt files.
- `tests/e2e/**` except your own `tests/e2e/tahap3/<slug>.spec.ts`; `playwright.config.ts`, `vite.config.ts`,
  `tsconfig.json`, `package.json`, `package-lock.json`, `tools/**`, `docs/**`, `public/**`.
- No new npm dependencies. No git commands.

---

## 5 · Size plan per demo (gzip -9, beyond home, `VITE_DEMO_CONTROLS=1` build)

Floor F = final Tahap 2 non-map live floor (≈ 99 KB today, being cut by the Tahap 2 closing work; the kit agent writes
the measured value) + `up/boot` ≤ 12 KB ⇒ **UP floor ≈ 111 KB** (kit agent asserts ≤ 112). Own allowance for a 175 KB
target ≈ 64 KB. Map kit (≈ 30 KB) + desa JSON (≈ 22 KB) only after an action (Kenal Mitra "Cek lokasi").

| Demo | First load (own) | First load total | Intent-loaded (each) | After action |
|---|---|---|---|---|
| Toko Autopilot (owner) | index + Dasbor + strings + toko selectors ≈ 36 | ≈ 147 | Kasir 16–20 · Prediksi 10–12 · PO/Supplier 8–10 · Harga 7–9 · Shift 9–11 | scenario, satu-daerah flood helper, camera, print 3–6 each |
| Toko Autopilot (`?role=kasir`) | + Kasir on first load ≈ 54 | ≈ 165 | other tabs hidden | payment drawer, print |
| Pajak Beres | index + KPI + Inbox + feed ≈ 20, DocViewer + ExtractPanel + notaDoc ≈ 16, books ≈ 5, NotaProcessor + flyBetween ≈ 4 ⇒ ≈ 45 | ≈ 156 (fallback DocArt if > 165) | Jurnal 6 · Mutasi 6 · Laporan 12 · Kalender/PPh 21 7 · Ekspor 4 · Konsultan 3 | Tanya Pajak (ai/chat + scenario) ≈ 15 |
| Juara Jualan | index + KPI + list + live ≈ 10, Detail + WaveMoments ≈ 12, clips-tb + strings ≈ 9, sales selectors + Waveform ≈ 7 ⇒ ≈ 38 | ≈ 149 | Tim 12 · Coaching 7 · Latihan 16 · clips-mf/asr 4 each · AgentHome 4 | Tanya QA ≈ 18 |
| Kenal Mitra | index + Queue + KPI + CatalogPreview + strings ≈ 16, mitra selectors ≈ 3 ⇒ ≈ 19 | ≈ 130 | KYC ≈ 39 · KYB ≈ 15 (+19 docs kit if KYC not loaded) · Kandidat ≈ 11 | map + desa (reported), Tanya alasan ≈ 12, certificate 3, camera 1 |
| Pantau Merek | index + KPI + alert card ≈ 8, stream + crawl ≈ 5, charts ≈ 6, brand selectors + strings + css ≈ 9 ⇒ ≈ 28 | ≈ 139 | Ulasan 7 · BulkReply 9 · Kompetitor 7 · Owner band 3 | Cluster + Announce + ai/chat ≈ 18 |
| TenderPilot | index + KPIs + Feed + banner ≈ 9, ScoreCard + Checklist + price ≈ 10, tender selectors + profile ≈ 6, strings + css ≈ 8 ⇒ ≈ 33 | ≈ 144 | Dokumen 12 · Preview 4 · Riwayat 5 · Calendar 4 · filters drawer 2 | AI chunk ≈ 16 |

Rules: target ≤ 175 KB per route and per role landing; hard limit 180. Satu Daerah demos must not grow (± 0.5 KB);
home JS ≤ 253.6 KB unchanged. Never import `world/satu-daerah`, the docs samples barrel, the `ai` barrel or the map kit at
module top level in a UP product. The event pipeline chunk and the UP chunk loaded by a Satu Daerah flood are reported
separately as after-action code.

---

## 6 · Owner questions: P1 (tax table), P2 (fictional names) and P3 (product choices) all APPROVED by the owner on 2026-11-18 ("oke semua"); use the defaults exactly as written below

**P1 · Angka pajak untuk Pajak Beres (spek §17.3) — mohon konfirmasi satu blok ini.**
Profil wajib pajak demo: toko milik **orang pribadi** (bukan CV/PT), **bukan PKP**, omzet dari dunia simulasi
(≈ Rp 200 jt/bulan, di bawah Rp 4,8 M/tahun), 5 karyawan toko untuk PPh 21. Riset 18 Nov 2026:

| # | Aturan | Angka yang dipakai | Sumber | Keyakinan |
|---|---|---|---|---|
| 1 | PPh Final UMKM | 0,5% dari omzet bruto per bulan, final | PP 55/2022 jo. PP 20/2026 · https://peraturan.bpk.go.id/Details/233488 · https://www.pajak.go.id/en/node/119950 | Tinggi |
| 2 | Omzet bebas pajak (orang pribadi saja) | Omzet kumulatif s.d. Rp500 jt/tahun tidak kena PPh; 0,5% dihitung setelah batas terlewati | PP 55/2022 Ps. 60(2) · https://www.pajak.go.id/en/node/119950 | Tinggi |
| 3 | Batas omzet fasilitas 0,5% dan batas PKP | Rp4,8 M/tahun (meter peringatan di 80%) | PP 20/2026 · PMK 81/2024 Ps. 62 · https://www.pajak.go.id/id/siaran-pers/batasan-omzet-pengusaha-kecil-wajib-ppn-dinaikkan | Tinggi |
| 4 | Siapa dan berapa lama | Orang pribadi boleh 0,5% tanpa batas waktu; CV/PT yang baru terdaftar tidak boleh (berlaku 22 Apr 2026). Kasus peralihan "7 tahun habis 2024/2025" TIDAK ditampilkan (satu tulisan IKPI membacanya berbeda) | PP 20/2026 · https://peraturan.bpk.go.id/Details/349415/pp-no-20-tahun-2026 | Sedang |
| 5 | Tenggat setor | Tanggal 15 bulan berikutnya (semua PPh masa, termasuk final UMKM); hari libur → hari kerja berikutnya | PMK 81/2024 · https://peraturan.bpk.go.id/Details/306614 | Tinggi |
| 6 | Tenggat lapor | SPT Masa PPh 21 tanggal 20; setoran PPh Final yang tervalidasi dianggap lapor; SPT Tahunan orang pribadi 31 Maret | PMK 81/2024 · https://www.pajak.go.id/index.php/en/node/119382 | Tinggi (Sedang untuk "dianggap lapor") |
| 7 | PPh 21 karyawan | Tarif Efektif Rata-rata (TER) kategori A (TK/0, TK/1, K/0), B (TK/2, TK/3, K/1, K/2), C (K/3) × bruto sebulan; Desember dihitung ulang dengan tarif Ps. 17 (5/15/25/30/35%). Hanya baris TER yang dipakai 5 karyawan (≤ 8 baris) disalin dari lampiran peraturan, tiap baris diberi kutipan | PP 58/2023 + PMK 168/2023 · https://www.pajak.go.id/en/node/105641 · https://pajak.go.id/id/node/110746 | Tinggi (struktur) / Sedang (angka baris, dicek ke lampiran saat dibangun) |
| 8 | PTKP | TK/0 Rp54 jt/tahun (+Rp4,5 jt kawin, +Rp4,5 jt per tanggungan, maks. 3) | PMK 101/2016 (lama, konsisten di semua sumber) | Tinggi |
| 9 | PPN (hanya di jawaban Tanya Pajak "kalau nanti jadi PKP") | 12% × DPP 11/12 (efektif 11%) | PMK 131/2024 · https://www.pajak.go.id/id/artikel/pmk-1312024-tarif-ppn-sebelas-dua-belas | Tinggi |
| 10 | Format ekspor | Pratinjau struktur template XML impor Coretax (bukti potong PPh 21 bulanan) + CSV jurnal, berlabel "Contoh simulasi · bukan untuk diunggah"; NPWP tersamar, tanpa kode billing | https://www.pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml | Tinggi (template ada) |
| 11 | Gaji karyawan | Angka simulasi; minimal setara UMK Bojonegoro 2026 bila keputusan gubernur Jatim ditemukan (dikutip), selain itu berlabel "simulasi" | SK Gubernur Jatim (dicari saat dibangun) | — |

Tidak ditampilkan (di luar cakupan demo): PPh Badan 22%, simulasi "jadi PKP" di layar, PPh 23/bukti potong BPPU, wacana
penurunan PPN.
Pita di layar: "Simulasi · bukan nasihat pajak · aturan per November 2026 · cek ke DJP atau konsultan pajak".
**Default bila tidak dijawab: pakai angka-angka ini persis seperti di tabel, semuanya diberi label simulasi dan kutipan
sumber yang bisa diketuk.**

**P2 · Nama fiktif.** Akan dipakai: "Arta Kencana Finance" (multifinance), "Pelita Proteksi" (asuransi), "CV Sedeng Jaya
Abadi" (UMKM pemasok, direktur Joko Prasetyo), "UD Bumi Terpal Lestari", "Koperasi Mitra Usaha Sejahtera", bank fiktif
"Bank Wiyata Sentosa" (mengganti "Bank Arta Kencana" supaya tidak bentrok dengan nama multifinance), nama toko dan
supplier hasil generator (contoh "Toko Bangunan Tunas Kencana Baru"), dan label kanal medsos generik ("Marketplace",
"Medsos foto", "Medsos singkat", "Video pendek", "Ulasan peta") alih-alih nama platform asli.
**Default: pakai semuanya; agen kit mengganti nama yang ternyata sama dengan perusahaan nyata.**

**P3 · Pilihan produk lain (satu paket).** (a) Harga barang darurat (karung, terpal, pompa) tidak pernah disarankan naik
selama peringatan banjir, tampil sebagai aturan yang terlihat. (b) QRIS berupa QR contoh dengan tulisan "QRIS" tanpa logo
resmi, keterangan "QR contoh, tidak dapat dibayar". (c) Kamera (swafoto KYC, scan barcode) hanya bila pengunjung
mengizinkan, diproses di browser, tidak diunggah; jalur bawaan memakai foto contoh. (d) Rekaman Juara Jualan diam saat
dibuka; suara (TTS browser) hanya lewat tombol "Putar suara". (e) Pengumuman Pantau Merek bisa dikirim ke struk Kasir
Toko Autopilot. (f) Harga simulasi tender darurat: karung pasir Rp15.500, terpal 4x6 Rp135.000 (di atas harga modal toko).
(g) TenderPilot satu peran (Vendor); tur bab 10 menyelesaikan syarat pajak lewat bolak-balik singkat ke Pajak Beres.
**Default: setuju semua.**

---

## 7 · Spec §11 coverage and deliberate deferrals

Every §11 item of P8–P13 maps to a section above: frames/layout, roles, screens, flow steps 1–5/6, wow moments, AI,
events emitted/consumed, missions (spec missions are a subset of §2's lists), pass checks (in each self-check).
Consumes: P8 `flood.alert` (C5), `price.anomaly` (C20), `need.created` (L6); P9 `sale.created` (C14); P10 `po.sent`
(C17); P11 `need.created` (C26); P12 `flood.alert` (C28); P13 `need.created` (C21), `procurement.flagged` (L3),
`partner.verified` (L2), `tax.ready` (L1).

Deferred on purpose:
- §13 product pages (`copy.ts`, `mini.tsx`, `#kasir` anchor, redirect `/karya/kasirku` → `/produk/toko-autopilot#kasir`):
  Tahap 6. Builders ship the standalone components named in their briefs now (ForecastChart, PoChat, NotaProcessor,
  WaveMoments, KybChecks, CvFunnel, ReputationChart, ReplyChip, ScoreCard, Checklist).
- Tour chapters 9–15: Tahap 5. Builders ship the `data-*` hooks and `?focus=` arrivals now.
- Visible effects in Katalog Lokal / Rapor Usaha (badge in the real storefront, score rise, bid on the need): Tahap 4.
  Until then the shell labels them "(demo tahap 4)" and Kenal Mitra shows the "Pratinjau etalase Katalog Lokal" card
  from the same selector (spec pass check "≤ 1 s badge" is met on that preview and on `verifiedBusinesses`).
- Pajak Beres own-CSV upload (spec says "unggah atau pilih contoh"; the Live own-image upload covers "unggah"), PKP/PPN
  scenario on screen, BPPU bukti potong: out for speed and accuracy (tax-research §3 marks them optional).
- Full Bandung / Padang polish: Tahap 7 (now: no crash, names follow the pack).

Integrator after the builders (no review round): flip `DEMO_READY` ×6; `products.ts` related of juara-jualan gains
`pantau-merek`; point Awas Belanja's `FLOOD_AT` autoplay at `useFloodAutoplay`; re-run `tests/e2e/tahap2` (C23 adds a
package to Awas Belanja, C27 adds local benchmarks; memo-number check) and all `tests/e2e/tahap3/*`; UI variants of
C14–C29 in `chains.spec.ts`; budget table for all 13 demos; screenshots 1440 + 390; gate (typecheck, selftests, build,
e2e, size, home perf, INP).
