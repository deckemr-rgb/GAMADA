# Demo Kit — module contracts (tahap 1)

Spec: `docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` (sections 5–10 and 14). Site rules: `docs/CONTRACTS.md`.
Visual direction (decided in tahap 0): **C "Data-dense tenang" as the base**, with the grafts and the fix list in
`docs/design/ARAH-VISUAL-TAHAP0.md` sections 1 and 5, with the reference screenshots in `docs/shots/`
(the tahap-0 `src/lab-design/` prototypes and the `/lab/_design` route were deleted after tahap 1).

Already written by the integrator (read-only unless you own them):
- `src/content/products.ts` — registry: `ProductSlug`, `EcoId`, `RoleId`, `ROLES`, `ECOSYSTEMS`, `PRODUCTS`, `PRODUCT_BY_SLUG`.
- `src/demo-kit/region/types.ts` — `RegionPack`, `RegionGeo` zod schemas (+ TS types).
- `src/demo-kit/ai/types.ts` — `AiProvider`, `AiChunk`, `ChatRequest`, `Extracted`, simulation DSL (`Scenario`, `Intent`, `SimResponse`).
- `src/lib/motion.ts` — flags `demoAnimations`, `tourCinematics`, `mapRain`, `constellation`; constants group `DEMO`.

## Ground rules (all modules)

- TS strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (`import type`). Check with
  `npx tsc --noEmit 2>&1 | grep "<your folder>"` — ignore errors in folders other agents are editing.
- Edit only the files you own. Need something from another module that does not exist yet? Code against the API
  below; if the API is missing something, add it in YOUR module or write it in your report — never edit theirs.
- One RAF loop: `gsap.ticker` only. Animate transform/opacity (stroke-dashoffset for chart/line draws). No
  backdrop-filter, no animated filter/blur, no mix-blend-mode on large elements. Pause anything looping when
  off-screen or the tab is hidden. Clean up listeners, ticker callbacks, GSAP contexts and WebGL on unmount.
- `isEnabled('demoAnimations')` (and `prefersReducedMotion()`) gate motion: when off, final states with fades ≤ 150 ms.
- Timings from `DEMO` in motion.ts. Need a new constant? Put it in one `const` block at the top of your file and
  mention it in your report.
- Bilingual: every visible string has `{ id, en }`; read `useI18n().lang` (src/lib/i18n.tsx). Shared demo strings
  go in `src/demo-kit/i18n/{id,en}.ts` (owner: shell) — module-local strings may live in the module.
- CSS: class prefix `dk-` (+ module, e.g. `dk-table-…`, `dk-map-…`), tokens from `src/demo-kit/ui/tokens.css`
  (`--dk-*`). Import your CSS from your component. No Tailwind `@apply` chains; utilities are fine.
- A11y: visible focus ring (2px lavender, 2px offset), AA contrast (dark UI and light paper), labelled icon
  buttons, touch targets ≥ 44px below 768px, `aria-live="polite"` for new events and AI answers.
- No dead controls: a visible control must change something real. Out of scope ⇒ do not render it.
- Every person, company, media outlet, account, vendor, bank and transaction is FICTIONAL and generated from the
  seed. Real (open licence, attributed): region geography, place names, Kemendagri kecamatan codes. Statistics
  (population, households, PDRB shares) and prices are SIMULATED and must be labelled "simulasi" in the UI, never
  presented as official figures (owner decision 2026-11-17). Officials by title only.
- No new npm dependencies beyond: maplibre-gl, d3-scale, d3-shape, d3-array, idb-keyval, zod,
  @tanstack/react-table (site) and hono, @hono/node-server, @anthropic-ai/sdk, zod (server/ai-proxy only).

## Ownership (tahap 1)

| Folder | Owner | Wave |
|---|---|---|
| `src/demo-kit/world/` | world | 1 |
| `src/demo-kit/region/loader.ts`, `region/packs/**`, `tools/region/**` | region | 1 |
| `src/demo-kit/ai/**` (except types.ts) | ai | 1 |
| `server/ai-proxy/**` | proxy | 1 |
| `src/demo-kit/ui/**`, `src/demo-kit/frames/**` | ui | 1 |
| `src/demo-kit/viz/**` | viz | 1 |
| `src/demo-kit/shell/**`, `src/demo-kit/i18n/**` | shell | 2 |
| `src/demo-kit/map/**` | map | 2 |
| `src/demo-kit/docs/**`, `src/demo-kit/media/**` | docs-media | 2 |
| `src/routes/{Ekosistem,EkosistemDetail,Produk,Demo,Tur,Lab}.tsx`, `src/demos/registry.ts`, `src/demos/_placeholder/**` | routes | 2 |

Integrator (main session) owns: router.tsx, routeLoaders.ts, motion.ts, products.ts, package.json, the tahap-1
showcase `/lab/_kit`.

## Public APIs

### world/ (simulated world, spec §6.1–6.2)
- `types.ts`: one interface per entity (`Complaint`, `Ticket`, `Letter`, `Meeting`, `ActionItem`, `Mention`,
  `HoaxAlert`, `Alert`, `RainCell`, `Procurement`, `Bidder`, `DocumentRec`, `Verification`, `Business`, `Outlet`,
  `Product`, `Sale`, `StockLevel`, `PurchaseOrder`, `Supplier`, `LedgerEntry`, `TaxItem`, `Call`, `Chat`,
  `SalesAgent`, `Candidate`, `BrandMention`, `Tender`, `Bid`, `CatalogNeed`, `Match`, `BizScore`, `LoanApp`,
  `EconIndex`, `PricePoint`, `Market`, `AuditEntry`, `Citizen`), each with `id: string`.
  `Table<T> = { byId: Record<string, T>; ids: string[] }` (ids newest first).
  `WorldState = { regionId, seed, day /* ISO date of the demo day */, citizens: Table<Citizen>, complaints: …, … , auditLog: Table<AuditEntry> }`.
  `EventMap` maps every event type to its payload; `WorldEvent<K extends EventType = EventType> = { id; type: K; at: number /* world minutes since 00:00 */; source: ProductSlug | 'clock' | 'tour' | 'user'; payload: EventMap[K]; origin?: ProductSlug }`.
  `source` is WHO acted: a product passes its own slug for anything the user did in it; `'clock'` = background
  (natural) events nobody triggered, with `origin` = the product whose domain they belong to (audit/labels only);
  `'tour'` = the guided tour. `AuditEntry` carries the same `source` and `origin`.
  Event types (at least): complaint.created, complaint.clustered, ticket.statusChanged, service.booked,
  briefing.generated, instruction.issued, meeting.transcribed, actionItem.created, letter.dispositioned,
  hoax.detected, clarification.published, rain.forecast, flood.alert, alert.broadcast, procurement.flagged,
  document.verified, sale.created, stock.forecastChanged, po.sent, supplier.replied, ledger.posted, tax.ready,
  call.scored, coaching.assigned, partner.verified, brand.alert, tender.matched, bid.submitted, need.created,
  match.made, order.created, score.updated, loan.applied, loan.approved, econ.updated, price.anomaly,
  market.operation. Products in tahap 2–4 may add fields/events in world/types.ts via their own PRs.
- `store.ts`: `world.get(): WorldState`; `world.subscribe(fn): () => void`;
  `useWorld<T>(selector: (s: WorldState) => T, isEqual?): T` (useSyncExternalStore, selectors memoised);
  `emit<K>(type: K, payload: EventMap[K], source: EventSource, opts?: { at?; origin? }): WorldEvent<K>` —
  `source` is REQUIRED (no default): the shell only announces cross-product toasts for root events whose
  `source` is the current product, and the audit log shows it as the actor. Queued, processed in a microtask:
  reducer → auditLog row → reactions (follow-up events, depth-limited) → one notify;
  `onEvent(type | '*', fn): () => void` (for toasts, missions, tests);
  `loadWorld(pack: RegionPack, seed: number): Promise<void>` (from IndexedDB if present, else generated);
  `resetWorld(): Promise<void>`; `exportWorld(): string`; `importWorld(json: string): void`.
  Max 5 000 entities per table (oldest dropped).
- `reducers.ts`: `REDUCERS: { [K in EventType]?: (s: WorldState, e: WorldEvent<K>) => WorldState }` — pure, structural sharing.
- `reactions.ts`: `REACTIONS: Reaction[]`, `type Reaction = { on: EventType; run(e, s): { type; payload; source }[] }` —
  pure; the ONE place for cross-product effects (spec examples: flood.alert → demand up in toko-autopilot +
  catalog need; price.anomaly → market.operation recommendation in meja-pimpinan).
- `seed.ts`: `mulberry32(seed)`, `streamRng(seed, regionId, stream: string)`; Indonesian name generators
  (Jawa, Sunda, Batak, Minang, Bugis, Tionghoa-Indonesia, Madura, Bali… weighted by region language);
  `generateWorld(pack, seed): WorldState` (addresses from real desa in the pack; numbers realistic).
- `clock.ts`: world clock — `clock.get(): { minutes; speed: 0 | 1 | 10 | 60; running }`, `setTime('HH:MM')`,
  `play()`, `pause()`, `setSpeed()`, `useClock()`, `formatTime(min)`. Runs on gsap.ticker, pauses with the tab.
- `natural.ts`: natural events while the clock runs (complaints, sales, mentions, price moves; busy mornings/
  midday, quiet nights): `setNaturalEvents(on: boolean)`, default on, off in tour/presenter. They are emitted
  with `source: 'clock'` and `origin: <product>` (sale → toko-autopilot, complaint → sapa-warga, mention →
  radar-isu, price → sinyal-pasar), so they never raise "this product triggered …" toasts.
- `session.ts`: demo session store `{ regionId, seed, role, aiMode: 'sim' | 'live', present: boolean, lang }`
  with `useSession()`, `setSession(patch)`; URL sync is done by the shell.
- `persist.ts`: IndexedDB (idb-keyval) namespace `gamada:world:<regionId>:<seed>`, debounced save.
- `selectors.ts`: memoised selectors used by many products (complaintsToday, slaOnTimePct, activeAlerts,
  negativeIssues, overdueActions, serviceIndex, auditFor(entityId) …).

### region/
- `loader.ts`: `REGIONS: { id; name; shortName; type }[]`, `DEFAULT_REGION_ID = 'bojonegoro'`,
  `loadRegion(id): Promise<RegionPack>` (fetches `pack.min.json`, cached), `loadRegionGeo(id, opts?: { desa?:
  boolean }): Promise<RegionGeo>` (default includes desa; `{ desa: false }` skips the heaviest layer),
  `loadRegionDesa(id): Promise<FeatureCollection>` (cached), `preloadRegion(id, withGeo, opts)`,
  `regionText(pack, lang)` helpers. All region data is FETCHED as hashed static JSON (`import.meta.glob '?url'`),
  never bundled as JS. zod runs on load only in dev; production validation happens at build time
  (`npx tsx tools/region/validate.mjs`, part of `npm run build`).
- `packs/<id>/`: `pack.json` (canonical, for tools/tests; not fetched), `pack.min.json` (what the browser
  fetches; expanded by `wire.ts`), `geo.json` (kecamatan, rivers, roads, hazards; no desa; 4-decimal coords),
  `desa.json` (desa polygons). `geo.json` / `desa.json` are canonical and NOT fetched: the browser fetches their
  lossless shared-arc twins `geo.min.json` / `desa.min.json` (decoded by `region/topo.ts` to exactly the canonical
  GeoJSON; `validate.mjs` fails unless the round trip is deep-equal). Built by `tools/region/*.mjs` from public sources, every source in `sources[]`.
  ≥ 12 complaint templates in Basa Jawa with ID + EN. `kecamatan[].code` is the BPS code (statistics only);
  `kecamatan[].kemendagri` ('35.22.16') is the administrative code used for NIK / No. KK.

### ai/
- `provider.ts`: `getAi(mode: 'sim' | 'live'): AiProvider` — 'live' is wrapped with automatic fallback to sim
  (no first token within `DEMO.liveFirstTokenTimeoutMs`, HTTP 429/5xx, invalid structured output ⇒ sim, and a
  `fellBack: true` flag on `done`). `registerScenario(s: Scenario)`, `getScenario(slug)`.
- `intents.ts`: `createMatcher(intents, synonyms?)` → `match(text, lang): IntentMatch` (TF-IDF over words +
  char 3-grams, ID/EN/regional synonyms, threshold).
- `stream.ts`: `streamText(text, { tps?, signal? }): AsyncIterable<string>` (25–45 tok/s, punctuation pauses).
- `live-base.ts` (zod-free): `checkHealth(): Promise<{ ok; live; models }>`, `peekHealth`, `configureLive`,
  `isLiveConfigured`, `LiveError`, `onLiveFallback`, `LIVE_FALLBACK_NOTICE`, `registerStructuredSchema(kind, zodSchema)`.
- `live.ts` (the ONLY zod importer of the kit at runtime): SSE client for `POST {VITE_AI_PROXY_URL}/api/ai/chat`
  and `/api/ai/extract`, `STRUCTURED_SCHEMAS`, `validateStructured`. provider.ts loads it with `import()` on the
  first live request; the barrel `ai/index.ts` never re-exports it (use `loadLiveClient()` or import `ai/live`
  directly in tools/tests), so sim mode and every demo route stay zod-free. Do not add value imports of zod
  elsewhere in demo routes (region packs are validated at build time).
- `context.ts`: `summarize(value, maxBytes = 6000)` (trims arrays/strings to fit).
- `useAiChat(product)` hook: messages, `send(text)`, streaming state, structured results, follow-ups.

### server/ai-proxy/ (spec §10)
Own package (`package.json`, `tsconfig.json`), Hono app in `src/app.ts`, adapters `src/node.ts`, `src/vercel.ts`
(`api/[...route].ts`), `src/netlify.ts`, `src/worker.ts`, `prompts/<slug>.ts`, Dockerfile, docker-compose.yml,
.env.example, README. Endpoints `/api/ai/health`, `/api/ai/chat` (SSE: text, tool_call, done, error),
`/api/ai/extract`.

### ui/ + frames/ (direction C)
- `ui/tokens.css` (`--dk-*`: spacing 4…64, radius 6/10/14/20, lines, 3 elevations + inner highlight, type
  scale 12/13/14/16/20/24/32, row heights 40/32, accent API `[data-eco="satu-daerah|usaha-pintar|pasar-daerah|inti"]`
  setting `--dk-accent`, `--dk-accent-2`, `--dk-on-accent`, `--dk-accent-paper`; light paper theme
  `[data-theme="paper"]`).
- `ui/icons.tsx`: `Icon({ name, size? })` — 1.5px line set, 20px; every product icon key in products.ts + UI icons.
- components: Button, IconButton, Segmented, Input/Field, Select, Table (@tanstack/react-table; density 40/32;
  cards < 640px; new-row slide + highlight; rows memoised by row object), Kanban (translate-only FLIP, no GSAP
  Flip; pass `renderCard` as a stable `useCallback`), Inbox, Timeline, KPI (count-up),
  Badge, Chip, StatusChip, Tabs, Drawer, Modal, Toast (primitive), Skeleton, EmptyState (dusk line art + one
  CTA), Stepper, Score, Avatar, Kbd, Tooltip, Menu, Confetti (≤ 1 s, lavender/peach). Barrel `ui/index.ts`.
- `ui/motion.ts`: `useCountUp`, `flashNewRow`, `dropChips`, `enterPanel`/`exitPanel` (write-only `animatePose`
  ticker tweens; `enterPanel` returns `PoseTween { kill }`), `animatePose`, `useInView`. `motionMode()` mirrors
  "not full" (`?off=demoAnimations`, `?static=1`, degrade) to `html[data-dk-calm]`; the tokens.css safety net
  zeroes kit transitions under `html[data-motion='reduced']`, `html[data-dk-calm]`, `.dk-root.is-calm`, `.dk-calm`.
- Toast regions pause every queue while hovered or focused (WCAG 2.2.1) and hand focus on when a focused toast
  is dismissed. Touch targets: `var(--dk-target)` (44 px) under `(max-width:767px),(pointer:coarse)`.
- frames: `BrowserFrame` (36px bar, neutral dots, URL `demo.gamada.id/<slug>`, radius 14, soft lavender glow),
  `PhoneFrame` (9:19.5, 10px bezel, capsule notch, status bar with world clock, pointer tilt ≤ 6° off in reduced
  motion), `TabletFrame`, `WallScreenFrame` (light perspective, thin bezel, static gradient reflection),
  `PaperFrame` (light paper, shadow, print stylesheet). Barrel `frames/index.ts`.

### viz/
`ChartFrame` (title, unit, source "Data simulasi · seed N", sr-only summary), `LineChart`, `AreaChart` (+ forecast
band: 10% area + dashed line), `BarChart`, `Donut`, `Gauge`, `RadarChart`, `SankeyLite`, `NetworkGraph`
(animated force layout on gsap.ticker, clickable edges), `Sparkline`, `Heat`; pointer tooltip + vertical
crosshair; draw-in ≤ 800 ms on first view; data updates interpolate. Charts render final geometry once and
never setState per frame: `rv(kind, opts)` marks nodes, `useRevealDom(ref, onPlay)` plays the reveal on one
write-only ticker listener (`[data-viz-pre]` on the plot root), `useAttrTween(ref, key, live)` tweens attributes
on data updates, `useCountText(ref, value, fmt, shownRef, from)` counts text. `useReveal`/`useTweened` are legacy. `format.ts`: `rupiah(n, 'short' | 'full')`
→ "Rp 1,2 jt" / "Rp 1.250.000", `percent`, `num`, `dateWib`, `timeWib`. Palette from tokens (≤ 6 per chart).

### shell/ (wave 2) · map/ (wave 2) · docs/ + media/ (wave 2) · routes (wave 2)
Specified in the wave-2 briefs. Tahap-1 additions:
- `DemoShell` prop `interim?: boolean` (routes/Demo.tsx passes `!DEMO_READY[slug]`): hides role, clock, AI and
  reset controls and pauses the clock, so a placeholder canvas shows no control it would ignore. Dev-only
  `?controls=all` forces the full bar.
- `demoHref()` carries `ai=live` when the session is Live; Live survives cross-product jumps and downgrades to
  sim only when `/api/ai/health` is down. `?lang=` from the URL wins on mount.
- Below 640 px the shell canvas owns the single 16 px side gutter; canvases add no side padding of their own.
- Browser self-test: `node src/demo-kit/shell/__tests__/shell.selftest.mjs [baseUrl] [fit,touch,focus,lang,live,interim,gutter]`.
- Background (natural/seeded) events use source `'clock'` plus optional `origin: ProductSlug`; the shell toasts
  only roots whose source is the current product.
- MapView DOM order: corner controls and the Sources popover come before the canvas (keyboard order).

### docs/nik.ts — the ONE specimen NIK / No. KK rule
- Used by the document samples AND `world/seed.ts`; nothing else builds NIKs. Format `PP KK CC DDMMYY SSSS`:
  the first six digits are the **Kemendagri** kecamatan code (Permendagri 72/2019, e.g. Kalitidu 35.22.16),
  never the BPS code (Kalitidu BPS 3522200 is statistics only); women DD + 40; serial 9001–9999 (specimen range).
- Region digits: pack `kecamatan[].kemendagri` ('35.22.16') → built-in Bojonegoro table → BPS `code` (legacy).
- `makeNik(kec: id | NikKecamatan, birthIso, gender, serial)`, `makeNoKk(kec, issuedIso, serial)`,
  `nikRegion(kec)`, `nikRegions(pack.kecamatan)`, `parseNik(nik, regions = all Bojonegoro kecamatan)`,
  `nikRegionName(nik)`. Every seeded world document passes `parseNik`; only the 3 intended bansos pairs share a
  NIK (world self-test).
- Every Cek Berkas sample (KTP, KK, NIB, domisili, foto rumah bansos) carries the "SPESIMEN" watermark, the
  "SPESIMEN · data fiktif untuk demo GAMADA · bukan dokumen resmi" footer and `specimen: true`.

## Tahap-1 polish (2026-11-17): API changes every product must know

Budget rule (owner decision 2026-11-17): **≤ 180 KB gzip per demo, excluding only the MapLibre engine (engine
chunk + its worker), counting EVERYTHING the demo fetches beyond the home page, JS and region JSON alike.**
desa.min.json counts only when it is actually fetched. Kit floors after this pass (gzip -9, beyond home): a
placeholder demo ≈ 57 KB, a live non-map demo ≈ 95 KB, a live map demo ≈ 121 KB (+ 22 KB once desa is needed),
which leaves a product ≈ 35–60 KB of its own.

### world/
- The barrel `world/index.ts` is the RUNNING world only. These are no longer re-exported (import from the module):
  `generateWorld` (`world/seed`), `personName` / `makeNamer` / `groupWeights` (`world/names`, still in
  `world/rng`), `REDUCERS` (`world/reducers`), `REACTIONS` (`world/reactions`), `processEvents` (`world/engine`),
  `describeEvent` (`world/audit`, as `describe`), `naturalEventsAt` (`world/natural-gen`). Types stay exported.
  Random numbers without name data: `world/prng` (`mulberry32`, `hashString`, `makeRng`, `streamRng`).
- New: `preloadWorldGenerator()` starts the seed/generator chunk early (the shell calls it with `loadRegion` on a
  first visit), and `preloadWorldEngine()` starts the event pipeline chunk (the shell calls it on the first
  pointerdown/keydown).
- `emit()` still returns the event (ids) synchronously, but the FIRST batch is processed once the pipeline chunk
  has loaded; events queue in order. Await `settled()` before reading derived state in tests/tools.
- Natural events: `natural-gen.ts` loads the first time the running clock crosses a minute; minutes crossed while
  it loads are replayed in order.

### region/
- `loader.ts` fetches `pack.min.json`, `geo.min.json` and (lazily) `desa.min.json`; `topo.ts` is the decoder.
  Region NAMES for pickers and labels come from the static `REGIONS` (no fetch).

### map/
- `MapViewHandle.loadDesa(): Promise<void>` resolves once the current region's desa polygons are in (it rejects if
  the fetch fails). MapView loads geometry WITHOUT desa and fetches desa.min.json only on a trigger: the desa layer
  switched on, zoom ≥ 9.7 with desa on, flood hour > 0, or one of these handle calls.
- `MapViewHandle.floodImpact(hours): FloodImpact | null` comes from the same model the map paints (seed 1). It is
  null until desa are in, and the call itself starts the download. Pattern: when null, show a short loading state
  ("Memuat batas desa…"), `await handle.loadDesa()`, then call again (see `_showcase/map.tsx`).
- MarkersLayer: badges that overlap at the current zoom bucket merge into a count badge below zoom 12.5. Hover or
  tap lists up to 3 names; a click zooms in until the group separates. `onMarker` fires only for single markers.
- Map CSS is split per component (map.css, legend.css, layer-toggle.css, time-scrubber.css, kecamatan-list.css).

### docs/
- `ExtractPanel` prop `emptyText?`; `readPrompt(action, lang)` gives 'Tekan “<aksi>” untuk mulai membaca.' /
  'Press “<action>” to start reading.'. Use it whenever a document is on screen but not read yet.
- The `DocViewer` zoom hint follows the input: pinch on touch, Ctrl + wheel with a mouse.

### ai/
- Light entry `ai/chat.ts`: `useAiChat`, the scenario registry (`ai/scenarios.ts`) and the live-base helpers, with
  no static path to the scripted engine. Provider, matcher, engine and stream load with `import()` on the first
  `send()`; `UseAiChat.prepare()` / `loadAiEngine()` start that download early (e.g. on input focus). Products
  import the chat from `demo-kit/ai/chat`, not the full barrel. The barrel still statically includes provider.ts,
  which is why the build prints an INEFFECTIVE_DYNAMIC_IMPORT note (only the lab showcase uses the barrel).
- `staticConversation` lives in `ai/static.ts` (still exported from the barrel).
- The shell imports `checkHealth`, `peekHealth`, `LIVE_FALLBACK_NOTICE` and `onLiveFallback` from `ai/live-base`
  directly; keep live-base dependency-free.

### shell/ + demo-kit/i18n
- Barrel: `CommandPalette`, `GuidePanel`, `Hotspot`, `SplitStage` and `CoachMark` are no longer VALUE exports (they
  are lazy chunks via `shell/lazy.ts`); their types are. Import `CoachMark` from `demo-kit/shell/CoachMark`;
  `fuzzyScore` / `filterItems` live in `shell/fuzzy.ts` (still exported).
- `Mission.hintSm` is the hint shown on phones, where bar controls sit in the ⋯ sheet. Every mission hint that
  points at the top bar needs one.
- `ShellApi.link` (the validated query the page opened with) and `ShellApi.interim`.
- Interim (`!DEMO_READY`): the shell loads NEITHER the region pack NOR the world. The placeholder canvas shows the
  "Yang akan bisa Anda coba" / "What you will be able to try" preview panel: the roles (the ?role chip marked
  current), the paused clock and the ?t time ("Tautan ini membuka pukul 09.15"), the AI mode, the tour chapters
  and the build stage. It has no buttons or inputs. When the product flips `DEMO_READY`, its sandbox replaces the
  panel and the full bar returns by itself.
- `demo-kit/i18n`: `DEMO_STRINGS`, `DEMO_EN` and `demoStrings()` are removed. Use `useDemoStrings()`,
  `demoStringsIfLoaded(lang)`, `loadDemoStrings(lang)`, `switchLang(lang, setLang, { persist })` and
  `roleInitials(role, lang)` (also importable on its own from `demo-kit/i18n/roles`). Code that changes the language
  on a demo route calls `switchLang`, so the EN dictionaries (site and demo, fetched in parallel) are in memory
  before the flip. Pass `persist: true` for a viewer's explicit choice and `persist: false` when applying a link's
  `?lang`.
- Site `lib/i18n`: `setLang(l, { persist? }): Promise<boolean>` is last-call-wins; a `?lang=` link never writes
  localStorage; `preloadLang(l)` fetches a dictionary without switching.

### `package.json` files in ui/, viz/, map/, docs/, media/
- They are NOT packages: `{ private, type: module, sideEffects: [...] }` hints that let the bundler drop barrel
  members a demo does not import (and their CSS). Any new kit module with an import-time side effect other than
  CSS must be listed in its folder's `sideEffects` (ui lists `./motion.ts`), or a demo importing through the
  barrel will drop it. The only other top-level side effect is `setWorkerUrl` in map/engine.ts.
- `html[data-dk-calm]` is set only at load (`?static=1`, `?off=demoAnimations`, a forced or start-up degrade). A
  runtime perf degrade switches JS motion to 'reduced' via `motionMode()` but no longer flips the CSS safety net
  mid-session (that cost a 0.5 s style recalc at 4× CPU).
- `TabletFrame` landscape is 16:10 when the frame is ≥ 760 px wide, 4:3 below that.
- Charts: `BubbleChart` puts a label inside only when every line fits, otherwise outside with a leader line,
  otherwise tooltip-only. `NetworkGraph` moves labels to free spots once the layout rests and hides labels with no
  free spot (except the selection, its neighbours and clusters).

### build
- `vite.config.ts` `codeSplitting.groups` keep the always-loaded home core in two files (`vendor`: react,
  react-dom, scheduler, react-router, preload-helper; `motion`: gsap core and plugins except Draggable/Inertia,
  lenis, lib/motion, lib/perf, lib/smoothScroll). Home JS budget: ≤ 253.6 KB gzip.

## Tahap 2 (2026-11-17): what the kit adds for the Satu Daerah products

Full briefs, the chain list and the do-not-touch list: `docs/build/tahap2-plan.md`. Summary of the API changes:

### Product-module contract (`src/demos/registry.ts`, `src/routes/Demo.tsx`)
- `src/demos/<slug>/index.tsx` default-exports the canvas (`DemoCanvasProps`) and MAY export `missions`
  (`readonly Mission[]`), `hotspot` (`DemoShellProps['hotspot']`) and `splitTabs` (`SplitStageProps`; the canvas is then
  ignored). `useDemoModule(slug)` loads the module once and Demo.tsx hands the named exports to `DemoShell`.
- Visitors see a product only once `DEMO_READY[slug]` is set (integrator). Before that `/demo/<slug>` keeps the
  placeholder + interim shell; `?controls=all` opens the real module with the full live shell on the dev server, or in
  a build made with `VITE_DEMO_CONTROLS=1`.
- `DemoShell` now applies the guide's first-open rule when missions arrive after mount.
- `?e2e=1` on a live shell exposes `window.__gamada = { world, emit, settled, onEvent, clock }` (tests/e2e/chains.spec.ts).

### world/
- New tables: `messages` (CitizenMessage: phone messages, one row per broadcast with `to: citizenId[]`), `facilities`
  (pack places + SIMULATED shelters, `origin: 'pack' | 'simulasi'`), `harvests` (simulated estimate per kecamatan ×
  crop), `supplySignals`, `gauges` (simulated water levels at real places). `WORLD.version` = 2 (saved worlds regenerate).
- New fields: `Mention.rumor`, `HoaxAlert.rumor`, `Alert.confirmedBy`, `Alert.broadcast.desaIds`, `ActionItem.remindedAt`,
  `Procurement.{bids, winnerId, scheduleDays, spec, recommendation}`, `Harvest.ndviBase`,
  `WorldMeta.personas { siti, raka, darmo }` and `WorldMeta.facts` (SeedFacts: bansos counts, tampered doc, hoax dam +
  gauge, pump ring).
- New events: `citizen.notified`, `actionItem.statusChanged`, `actionItem.reminded`, `flood.confirmed`,
  `harvest.updated`, `procurement.recommended`, `supply.signal` (+ `hoax.detected.rumor`, `alert.broadcast.{desaIds,
  message}`).
- New reactions (reactions.ts, ids in quotes): 'cluster→flood-confirmed', 'cluster→radar-topic',
  'ticket-status→citizen-phone', 'broadcast→citizen-phones', 'flood→radar-topic', 'rumor-burst→hoax' (fires once,
  on the crossing of `WORLD.hoaxBurstMin` posts within `WORLD.hoaxWindowMin`), 'clarification→sentiment-recovery'
  (future-dated positive mentions over 30 min), 'harvest→econ', 'harvest→supply-signal',
  'procurement-recommendation→catalog-need', 'booking→citizen-phone'. The flood pump package now carries bids,
  a brand-locked spec and a 3-day schedule.
- Natural events: the rumor burst starts by itself at 10:00 (`WORLD.hoaxAt`) unless a product already fired it.
- `world/satu-daerah.ts` (NOT in the barrel; import it directly): personas, citizenInbox, consoleTickets,
  duplicateCandidates, kpiStrip, opdLeaderboard, opdScorecard, complaintsByKecamatan, briefingItems, instructionIdeas,
  letterInbox, actionBoard, mentionsByHour, sentimentSeries, topicClusters, mentionStream, hoaxBurst, rumorSpread,
  floodScenarioAlert, rainScenario, alertRecipients, zoneCitizens, confirmedComplaints, facilitiesOf, harvestValues,
  packages, affiliationEdges, hpsVsMarket, analyzeProcurement, localBenchmarks, bansosBatch, bansosCsv, clusterDetail.
  Time-keyed selectors are memoised (safe inside `useWorld`); `briefingItems`, `analyzeProcurement`, `affiliationEdges`
  and `hpsVsMarket` are plain functions: call them on an action or inside `useMemo`.
- `isEvent(e, type)` type guard (barrel) for `Mission.done` and `onEvent('*')`.
- `createParamSelector` caches at most 64 keys per input generation.

### shell/
- One cross-product toast per root event: further products the same root reaches are added to it ("… diteruskan ke
  Awas Belanja, Toko Autopilot +3"). A follow-up that is the news itself (`complaint.clustered`, `hoax.detected`)
  names the toast. Background roots (source 'clock') are announced on the page of the product that reacted when the
  follow-up has an `EFFECT_TARGET` (`hoax.detected` → Meja Pimpinan).

### map/
- Layer kinds `zones` (`{ zones: { kecamatanIds?, desaIds?, tone }[] }`, fill 20 % + outline over the real boundaries;
  a visible desa zone asks for desa) and `imagery` (satellite raster under the boundaries, tiles fetched only once
  visible; source `IMAGERY` in map/strings.ts, listed in the Sumber panel while visible).
- Helpers `facilityMarkers(facilities, lang)` and `alertZones(alerts)`.

### ai/ + server/ai-proxy/
- New shared tools / structured kinds (mirrored in `STRUCTURED_SCHEMAS`, parity test green): `lookup_service` →
  `service`, `book_queue` → `booking`, `ticket_status` → `ticket-status`, `compose_briefing` → `briefing`,
  `analyze_topic` → `analysis`, `draft_audit_memo` → `audit-memo`, `draft_reminder` → `reminder` (31 kinds).
- `prompts/<slug>.ts` may declare product-owned tools with `customTools: [productTool(slug, name, zodSchema, desc)]`
  plus `customMocks`; the proxy serves them with the shared ones (kind `'<slug>/<name>'`). The site validates such a
  kind with `registerStructuredSchema(kind, { safeParse })` from `demo-kit/ai/chat` (no zod in the demo bundle needed).
