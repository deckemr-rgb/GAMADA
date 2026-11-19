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
  crop), `supplySignals`, `gauges` (simulated water levels at real places). `WORLD.version` = 3 since the tahap-2 integration (saved worlds regenerate).
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

## Tahap 2 integration (2026-11-17): kit changes from the builders' handoffs

All seven Satu Daerah products are `DEMO_READY`. API and behaviour changes:

### shell/
- `Hotspot` prop `placement?: 'auto' | 'below' | 'above'` (also on `DemoShell`'s `hotspot` object). The label is
  placed against the target: `'auto'` (default) hangs it under the target's bottom edge when the viewport has room,
  else above the dot; it never covers the target and is clamped inside the viewport. The ring hides while the
  target's corner is clipped by a scroller or covered (a sheet, a drawer), and the target is re-queried when it
  remounts (persona switch). Products no longer override `.dk-hotspot-label` in CSS.
- `Mission.hideSm?: boolean`: a mission whose feature is not offered on a phone-sized shell is not listed, counted
  or required there (Meja Pimpinan "Buka mode rapat").
- The phone guide sheet sits at `--dk-z-pop`, above any canvas content that makes its own stacking context.
- TopBar: at ≥ 1280 px the role label may use up to 230 px before `fitBar` tightens it.

### ui/
- `Drawer` props `className?` (on the `.dk-ov` root) and `scrim?: 'dim' | 'none'` ('none' keeps the page undimmed
  for side-by-side demos; the drawer stays modal, a click outside still closes it).
- Modal / Drawer: `lenis.stop()` now runs after the opening paint (it forces a layout), not inside the interaction.
- `Kpi` prop `wrapLabel?` (label wraps instead of ellipsizing). The value never shrinks; the spark slot shrinks and
  clips (`flex: 0 1 120px`).
- `Inbox`: one `minmax(0, 1fr)` track, so a long nowrap title ellipsizes instead of widening the list.
- `Kanban`: a card moved with the keyboard is scrolled into view once its FLIP has settled.
- `Segmented` prop `onIntent?(value)` (pointer enter / focus / touch start on an option: preload that tab's chunk).

### media/ · docs/ · viz/ · map/
- `VoiceRecorder` prop `sampleWps?` (sample playback speed, default 2.3 words/s). The hold button and the sample
  button are distinct elements, so a mic-denied release never "clicks" the sample.
- `.dk-wave` is its own paint/compositing layer (progress updates no longer repaint the page root).
- `DocViewer`: the OCR number marks sit outside their box (left margin), never over the text being read.
- `BarChart` (horizontal): labels longer than the label column are shortened with "…" (full name in the tooltip).
- `NetworkGraph`: the painted edge ignores pointer events; the hit line is 26 px wide on coarse pointers.
- `MapView` prop `minHeight?: number | string` (default 320 px from CSS; e.g. 0 for a mini map in a fixed box).

### world/
- `ticket.statusChanged` to the status a ticket already has (e.g. a rating after 'selesai') keeps the first
  `closedAt` and adds no duplicate history row.
- `letter.dispositioned` may carry `number`, `from`, `subject`: the inbox identity of the letter (its scanned sample),
  patched onto the letter so the audit log and other products name the same letter.
- Cluster audit text names all three receivers ("→ Meja Pimpinan, Siaga Wilayah & Radar Isu"); the booking text uses
  HH.MM in Indonesian.
- Seed: follow-up tasks come from a per-agency pool (`ACTION_TPL_BY_OPD`, no title repeated across agencies); today's
  flood meeting lists the speakers of the sample recording as participants.
- `world/satu-daerah`: `weekChangeOf(price, history)` (true 7-day change; history excludes today), `TOPIC_LABEL` /
  `topicLabel(topic, lang)`; `briefingItems` uses them, never links two items to the same record, and adds an
  Indeks Ekonomi item when `econ.updated` arrived today.

### CSS prefixes
- Siaga Wilayah's prefix is `dk-sg-` (it shared `dk-sw-` with Sapa Warga; both stylesheets stay loaded after an
  in-app navigation, so prefixes must be unique per product).

### tests
- `tests/e2e/tahap2/*.spec.ts`: per-product missions + §11 pass checks (1440 and 390), UI-driven cross-product chains,
  a no-dead-controls crawler, region + language + role, and Live mode with a mocked SSE proxy (stream + 10 s
  first-token fallback). Helpers in `tests/e2e/tahap2/helpers.ts` (`openDemo` pauses the world clock).

## Tahap 2 kit leftovers (2026-11-18)

### shell/
- `Hotspot`: measured only when something can have moved the target (ResizeObserver on target + root, capture
  scroll, window resize) plus a 250 ms poll for layout shifts and coverage; never `getBoundingClientRect` per frame.
  The ring sits 3 px OUTSIDE the target's top-right corner (never over its text); the label hangs under the target's
  bottom edge or above the ring and flips when the chosen side has no room. Hidden while the target is disconnected
  (re-queried), has an empty box, is clipped / outside the root, or covered. Products need no padding wrappers or
  anchor strips for it any more.
- `dismissHotspot(id)` (shell barrel, tiny module; does not load the lazy Hotspot chunk) retires a ring for the tab
  session. The id is the hotspot's `id`, DemoShell default `${slug}:${target}`.
- Toast placement: `DemoShell` prop `toastPlacement?` and `useShell().setToastPlacement(spec | null)`, where spec is
  `'bottom-left' | 'bottom-right' | 'top-right'` or `{ wide, sm }` (per shell size). Below 768 px, while any Modal /
  Drawer is open, every toast stack moves to the top edge (`.dk-toasts.is-ov`).
- The shell canvas landmark is named "Demo <product>" / "<product> demo" (distinct from a frame labelled with the
  product name). TopBar role label base max-width 164 px ("Head of Regional Agency" fits at 1280).

### ui/
- Modal / Drawer close: the inert restore is batched into the next frame and focus returns in a rAF (no forced style
  recalculation inside the closing click). Focus goes to `returnFocus?` (ref or function), else the opener, else
  the opener's nearest ancestor still on the page (itself if focusable, else its first focusable descendant); it is
  left alone when something else already took focus. `subscribeOverlays` / `overlayOpen` expose the open count.
- `.dk-input` / `.dk-select` are `calc(44px + 2px)` on phones / coarse pointers (the inner control is a full 44 px).
- `.dk-kpi-spark > .dk-viz-micro` fills the spark slot (the Sparkline sizes from it).
- `Chip` passes `aria-disabled` (toggle chips, dimmed) and `aria-describedby` through.
- Note: the 44 px `::after` hit area of small controls (`button.dk-chip`, `.dk-chip-x`, `.dk-kb-move`) is clipped by an
  `overflow: auto/hidden` ancestor. Inside a horizontal chip scroller give the scroller `padding-block: 9px` and a
  matching negative `margin-block`, so the hit area fits inside it.

### media/ · docs/ · viz/ · map/
- `Waveform` progress: a clip box slid by transform (outer translateX(p − 1), inner translateX(1 − p)); no SVG
  attribute write and no repaint per frame.
- `ExtractedField.kind?: 'amount' | 'presence' | 'text'` (inferred by `docs/values.fieldKind`). `ExtractPanel` formats
  Rupiah ONLY for amount fields (total / bayar / kembali / saldo / modal …); postcodes, KBLI, RT/RW, years and IDs stay
  verbatim; presence values read 'ada'/'tidak ada' or 'present'/'absent' (`simulateExtract` also returns them in the
  session language). Value column wider, confidence stacked in 44 px, values break between words only (tabular
  numbers). The count is announced only when reading starts and with the final count.
- `DocViewer`: box numbers sit in gutters left / right of the page (the side of the box), stacked so none overlap;
  boxes have a ≥ 24 px invisible hit area; confidence pills take no pointer events. `TamperToggle` slider is 44 px
  tall on phones / coarse pointers.
- `NetworkGraph`: labels pick the free side crossed by the fewest edges; on coarse pointers every node has an
  invisible hit circle of r ≥ 22.
- `TimeScrubber`: arrows step `step` (0.25 h), PageUp/PageDown 1 h, Home/End the ends (a product handler that called
  preventDefault wins); `aria-valuetext` from the first render; quarter hours print 2 decimals ('+0,25 j').
- `MapView`: the MapLibre canvas is named "Kanvas peta <region>" / "Map canvas: <region>"; prop
  `notice?: { placement?: 'top' | 'bottom'; inset?: number }` places the basemap-unavailable notice.

### world/
- `WORLD.version` 4. Today's flood meeting (RP-0007, `MEETING_TPL[0]`) is held 06.30–07.00 (`WORLD.floodMeetingAt`,
  `floodMeetingMin`), before the clock start: status 'selesai', `transcribed: false`, participants = the clip's
  speakers. The `meeting.transcribed` audit row names the meeting's own time ("rapat pukul 06.30").
- `harvest.updated` accepts `dropPctByKecamatan?: Record<string, number>` (per-district drop; missing keys use
  `dropPct`), in the reducer and the econ reaction.
- `document.verified` for a document the world does not know writes an audit row without refs (flagged in its text).

## Tahap 2 kit leftovers, round 2 (2026-11-18)

### shell/
- Cross-product toasts (`effects.ts`): the body drops a "… → A, B & C" tail (the title already names the receivers, and
  never this product). A target whose demo is not `DEMO_READY` is never linked: the title reads
  "<what> dicatat untuk <product> (demo tahap N)" / "<what> recorded for <product> (stage N demo)" and the toast has
  no `onActivate`. `CrossEffect.target` is `ProductSlug | null` (first READY target). The toast calls
  `preloadDemo(target)` when it appears.
- `GuidePanel` "Lanjut ke produk terkait" lists only READY products (topped up from the same ecosystem). The phone
  sheet is at most 52 % of the shell height (internal scroll).
- `Hotspot`: ring centre 12 px outside the corner on both axes (a gap, never on the target); a target that reaches the
  right edge (full-width CTA) gets its ring ABOVE it with an 8 px gap; centre ≥ 19 px from the edges (pulse never
  clipped at 360–390). Label text: the target's `data-hotspot-label` attribute, else the `label` prop.
- Phone clock (`ClockChip`, `ClockControl`, jump list) prints "07.00" in ID, "07:00" in EN. `ClockControl` prop
  `onPicked?` (MoreSheet passes `onClose`: a speed or jump closes the "⋯" sheet).
- Phone page: while the product module (missions) is loading, the mission-pill row is reserved (`.dk-mpill.is-slot`),
  so the canvas does not jump 44 px when the pill mounts.

### ui/
- Toasts on phones: only the newest toast shows, with a "+n" marker for the hidden ones (`.dk-toasts-more`); body
  clamps at 3 lines; phone life 4 s.
- `formatSla(minutesLeft, lang, done?, now?)` / `<SlaLabel now={…}>`: with `now`, a deadline 2+ calendar days away
  reads "Lusa" / "in 2 days", then "N hari lagi" by calendar day. Without `now` nothing changes.

### ai/
- `streamText` caps a whole answer at `maxMs` (default 2000 ms; the schedule is compressed). `ENGINE.stepMaxMs` 260.
- `useAiChat().send(text, { maxMs })`: after `maxMs` the rest appears at once (same as `flush()`).

### viz/ · map/ · docs/ · media/
- `BarChart`: a `prev` value is also drawn as a 2 px tick in the text colour on top of the bar (visible when prev < value).
- `BubbleChart`: a click / tap hit-tests itself (no hover needed) and calls `onSelect`; each bubble `g` has `data-id`.
- `MapView` prop `onLayersReady?(handle)`: once, after the first region and the first map 'idle' after it.
- `ExtractPanel` ID heading "Isian terbaca"; `MEETING_BANJIR` EN speaker "Head of the Disaster Agency"; the PUPR pump
  memo names Trucuk, Kalitidu and Bojonegoro (no Kanor).

### world/
- `complaintRouting(region, category, text)` (texts.ts): a flood / fallen-tree report about evacuation, trapped people
  or a rubber boat goes to `bpbd` with a 60-minute SLA (reducer and seed). Seed: such tickets are forwarded at once;
  3 of 4 past high-urgency flood tickets went to BPBD. Seed: a regional-language sample that names a place is used
  only for a report from that desa / kecamatan.
- Natural complaints pick a template unused for 30 days in the category, else one of the least recently used third.
- The first complaint number after a fresh world is kept for the visitor: a background (clock) complaint that would
  take it skips one; the next product complaint gets the kept number (`seq.complaintKept`, `seq.complaintKeep`).
- Persist: a batch holding a non-clock depth-0 event is saved after 120 ms (`PERSIST_USER_MS`); `flushPersist` is in
  the world barrel.
- Audit: `briefing.generated` names the time of day (Briefing pagi / siang / sore / malam); `document.verified` prints
  Lengkap / Kurang / Perlu cek manual (EN Complete / Incomplete / Needs manual check). Hoax evidence EN uses "8.6 m".
- `world/satu-daerah`: `complaintsByKecamatan` breaks ties by name. `briefingItems` item 3 without an alert = the river's
  status from `gaugeOutlook` (SIAGA / AWAS with threshold, crest or recede, heavy-rain line only before 11.00); with an
  automatic (clock) alert not yet broadcast: "Peringatan banjir level N aktif sejak HH.MM; siaran ke warga belum
  dikirim". Item 4: a hoax with a clarification instruction reads "Klarifikasi diinstruksikan pukul HH.MM (OPD),
  menunggu rilis". Item 5 EN "Owner's estimate (HPS) …". Item 8 after verification: "n berkas diperiksa · x lolos ·
  p pasang NIK ganda ditahan · z luar zona" (pairs / out-of-zone once the whole batch is checked).

## Tahap 2 size limit and kit round 3 (2026-11-18)

The owner's limit: **≤ 180 KB gzip -9 per demo first load** beyond home (JS + JSON, MapLibre engine excluded, measured
by `.shots/t2-int/budget.mjs`: networkidle + 3 s at 1440, ID and EN). Everything the page fetches by itself in that
window counts, idle preloads included. Internal target ≤ 175 KB in both languages. Code fetched after a user action
is reported separately and is allowed.

### Preload on intent, not on idle (shell/intent.ts)

A lazy part the visitor may open next is fetched when they show intent, never as a side effect of opening the demo
(`requestIdleCallback` preloads count as first load). From `../../demo-kit/shell`:

```tsx
const loadLetters = () => import('./Letters')
const Letters = lazy(loadLetters)
<Tab {...intentProps(loadLetters)}>Surat Masuk</Tab>          // props: pointerenter / focus / pointerdown / touchstart
const ref = usePreloadOnIntent<HTMLButtonElement>(loadVoice)  // ref form
useEffect(() => preloadOnIntent(el, loadBulk), [el])          // imperative, returns a cleanup
preloadNow(loadX)                                             // from your own handler (e.g. a toast appeared)
```

Each loader runs once (a failed download is retried by the real use). Hover → click is ~200–400 ms and pointerdown →
click ~100 ms, so the chunk is normally there by the click; keep a Suspense fallback for the rare slow case.

### world/ — the event pipeline comes in two chunks

- `engine-core.ts` (≈ 3 KB) handles the events a demo raises **without input**: `complaint.created`, `mention.created`
  (not a hoax-burst post, i.e. without `rumor`), `price.updated`, `sale.created`, `ledger.posted`, `score.updated`,
  `procurement.flagged` (`engine-scope.ts`, `CORE_EVENT_TYPES`). A running clock (natural events) or a boot-time
  screening therefore no longer downloads the full pipeline.
- `engine.ts` (reducers + reactions + audit of every type) is fetched for any other event, or on the visitor's first
  pointerdown / keydown (as before). A batch that reaches a non-core event stops before it and continues, in the same
  order, once `engine.ts` has arrived: same ids, audit rows and reactions (world self-test "core pipeline ≡ full").
- Products: emitting a non-core type at boot (or from a clock subscriber before any input) brings the full pipeline
  (~13 KB) into the first load. Keep boot-time emits to the core types, or emit on the visitor's action.
- `reducers-core.ts`, `reactions-core.ts`, `audit-core.ts` hold the core types' functions; `REDUCERS`, `REACTIONS` and
  `describe` still contain every type (the core ones are the same objects). Adding a reaction on a core type: put it in
  `reactions-core.ts` and in `CORE_REACTIONS`, or remove the type from `CORE_EVENT_TYPES`; the self-test fails otherwise.
- `world/satu-daerah.ts` is a barrel of `world/sd/<domain>.ts` (citizen, leaderboard, gauge, leader, letters, radar,
  siaga, procurement, bansos, base). Import from `satu-daerah` as before: the build rewrites the import to the module
  that defines each name (vite.config `satuDaerahImports`), so a demo carries only its own selectors. A dynamic
  `import('…/satu-daerah').then(({ a }) => …)` is rewritten when all names come from one module; destructure there.
- `useSession().role` is deferred (`useDeferredValue`): a role switch renders the new role's views in the background
  and the current screen stays up (no loading fallback) until they are ready. `getSession()` is always current; read
  the role from `useSession()` in render, not from `getSession()`.

### Site language in a sandbox

`/demo/<slug>` renders at once in English without the site's EN dictionary (`lib/i18n.tsx`): demo code reads only
`useI18n().lang` (and `setLang` via `switchLang`). Reading `useI18n().t` (or spreading the value, e.g. `useEcoI18n()`)
in a demo downloads the home page's English copy (~7 KB) into the first load. The shell warms that dictionary when a
link out of the sandbox is hovered, focused or touched.

### shell/

- `index.html` paints a static frame on `/demo/*` before any JS (`#dk-boot`: top bar, three cards, "Menyiapkan dunia
  demo…" / "Preparing the demo world…"); `DemoShell` removes it in its first layout pass (RootLayout / RouteError on
  any other outcome). The 11 home-hero AVIF preloads now apply to `/` only.
- The shell root and every kit portal (`ui/Overlay` host) carry `data-lenis-prevent`: panels, lists, phone threads and
  dialogs scroll natively with the wheel (the site's Lenis used to cancel those wheel events). A product portal of its
  own needs the same attribute.
- Guide on phones: a tap outside the sheet folds it (the tap still reaches its target). `useShell().holdGuide(true |
  false)` folds the sheet while a product animation plays (nested calls; the visitor's choice comes back after the
  last release; the "Coba ini" bar releases at once). `Mission.target` (a selector) turns the step card into a
  button that scrolls to and focuses the target (on phones the sheet folds first).
- Build: the always-loaded kit modules form two chunks, `demo-core` and `demo-gen` (vite.config). A new always-loaded
  shell / world / ui atom module belongs in that list; modules a site page imports (ui/icons, i18n/roles) must not.

### viz/ · map/

- `Sparkline` draws its monotone line / area with `viz/monotone.ts` (byte-identical to d3-shape's curveMonotoneX,
  `viz/__tests__/monotone.test.ts`), so a demo with only sparklines no longer loads the shared d3-shape chunk.
- `MapView` shows a quiet "Memuat citra peta…" / "Loading map tiles…" pill (top centre, after 450 ms) while basemap or
  imagery tiles are still arriving, and sets `aria-busy` on the map region meanwhile.

## Tahap 3 (2026-11-18): what the kit adds for Usaha Pintar (P8–P13)

Plan: `docs/build/tahap3-plan.md` §1 (APIs), §3 (chains C14–C29), §5 (sizes). Where this section and the plan differ,
**this section is what the code does**. Builders own `src/demos/<slug>/**`, their prompt file and their own spec only.

### Measured floors (gzip -9, beyond home, `VITE_DEMO_CONTROLS=1` build, 1440, networkidle + 3 s)

| What | Measured | Rule |
|---|---|---|
| Home initial JS | 252.7 KB | ≤ 253.6 (unchanged vs Tahap 2) |
| Satu Daerah demos, first load ID / EN vs final Tahap 2 | sapa-warga 149.8 / 151.4 (−0.7) · meja-pimpinan 173.2 / 174.8 (±0) · naskah-pintar 143.5 / 145.1 (−0.7) · radar-isu 157.8 / 163.3 (−0.7) · siaga-wilayah 158.9 / 160.5 (−0.7) · awas-belanja 148.1 / 149.7 (±0) · cek-berkas 158.9 / 160.4 (+0.4) | ≤ Tahap 2 + 0.5 |
| Satu Daerah after a flood action | siaga-wilayah +30.6, awas-belanja +29.8 (the UP boot + chains chunks, fetched AFTER the action) | reported, allowed |
| Satu Daerah kit floor (shell + world + pack JSON, no product) | ≈ 105.3 KB (demo-core 41.5 + demo-gen 36.8 + pack 15.4 + icons 4.9 + products 4.6 + small) | — |
| UP boot (`up/boot` 12.9 + shared `texts` 6.5 + `cv-data` 1.8) | **21.2 KB** | plan said ≤ 12: NOT met (seed extension + natural events + their texts; all needed before the first paint of data) |
| **UP stub floor** (`/demo/<up-slug>?controls=all`, stub canvas) | **126.5 KB** (JS 111.2 + JSON 15.4) | plan said ≤ 112: NOT met |
| UP chains chunk (`up/chains`) | ≈ 10 KB, fetched on the first pointerdown / keydown, never in the first load | after-action |

**Consequence for builders: own allowance = 175 − 126.5 ≈ 48 KB** for each role landing (hard limit 180 ⇒ 53 KB), not
the plan's ≈ 64. Product chunks, product strings, the selectors you import from `world/usaha-pintar` and any kit UI/viz/
docs module you pull in all count. Toko Autopilot `?role=kasir` (plan ≈ 54 KB own) must lazy-load the payment drawer
and receipt and keep the Kasir first screen ≤ 48 KB own.

Measure with `.shots/t3-kit/budget.mjs` (copy of `.shots/t2-int/budget.mjs` + a UP stub loop at the end; edit the
slug list / add your role URLs).

### Lazy ecosystem module (`world/eco.ts`, in the world barrel)

- `preloadEcosystem(product.eco)` (DemoShell, in parallel with the region) loads `world/up/boot`: seed extension
  `extendUsahaPintar` (deterministic, patches the installed world once: `s.meta.ext['usaha-pintar'] = 1`), the UP natural
  events and the reducers/reactions of the boot-only types. `preloadEcosystemChains` (first pointerdown / keydown on a
  UP page) loads `world/up/chains` (reactions C15–C29 + user-action reducers).
- The store gate holds events (in order) of `ECO_TRIGGERS['usaha-pintar']` until the needed chunk is in, so any page may
  emit them (a Satu Daerah flood loads both chunks AFTER the action). Invariant: UP handlers registered ⇔ UP data present.
- Products: `const ready = useEcosystemReady('usaha-pintar')`; render a skeleton with the final layout boxes until true
  (`useDemoStrings().upLoading` = "Menyiapkan data usaha…" / "Preparing the business data…"). Never call
  `ensureEcosystem` yourself. `?e2e=1` exposes `__gamada.ensure('usaha-pintar')` (both chunks) for specs.
- `setNaturalBoost('sale', 3)` is set by DemoShell on toko-autopilot / pajak-beres (opening hours rhythm ×3).
- `WORLD.version` = 5.
- Low-level: `world/ext.ts` (`registerExtension`, `applyExtensions`, `extCovers`), `engine-core.withExtensions`,
  `natural.registerNaturalSource`. Only for a future ecosystem module (Pasar Daerah); products never touch them.

### `world/usaha-pintar` (ONE import path; not in the barrel; tree-shaken)

Everything of plan §1.5 exists with the plan's names. Shapes that differ from or add to the plan:
- `outletKpis(s, now)` → `{ total, byOutlet, month }`; `total` / each outlet `{ revenue, tx, avgTicket, cost, grossMargin,
  vsYesterday: { revenue, tx, avgTicket, grossMargin } }` (ratios, e.g. 0.12 = +12 %); `month` = `omzetByMonth()[demo month]`.
- `floodBanner(s)` → `{ text: Bi, factor, pct, alertId, productIds } | null` (`pct` 340 for factor 4.4).
- `demandForecast(s, productId, now)` → `{ history30, forecast14, lo, hi, factors[{ key, pct, label, cause? }], daysLeft } | null`.
- `poSuggestions(s, now)` rows carry `poId` / `code` when a `po.drafted` draft exists for that supplier (send that id with
  `po.sent` so the draft is patched, not duplicated). `poLines(s, productIds, leadDays)` and `supplierReply(s, poId)` are the
  same formulas the reactions use.
- `cashierShift(s, staffId, now)` → `{ staffId, outletId, start, tx, cashSales, expectedCash } | null` (float `UP.cashFloat`).
- `omzetByMonth(s, bizId)` → `Record<'YYYY-MM', number>`; `pphFinalOf(s, bizId, period)` → `{ omzet, cumulativeBefore,
  taxable, amount }`; `pphFinalMonth(omzet, cumulativeBefore)` *plain* (the rule); `notaLines(po, paidCash?)` = the nota
  journal lines (Persediaan D / Kas or Utang Usaha C). `mutasiRows(s, bizId, '2026-11')` rows `{ date, desc, amount,
  balance, status: 'cocok'|'baru'|'tinjau', category?, ledgerId?, lines? }`.
- `trialBalance` → `{ rows, debit, credit, balanced }`; `balanceSheet` → `{ assets, liabilities, equity, … }`;
  `cashFlow(s, bizId, 'YYYY-MM')` → `{ opening, inflow, outflow, closing }`.
- Sales: `CRITERIA_KEYS`, `PRAPESAN_CLIP` ('tb-wa-prapesan'), `clipOf(key)`, `clipsOf(industry)`, `FLAG_OF`, `IND_SHORT`
  ('tb'|'mf'|'asr' ↔ industry, for `?industry=`), `teamRadar(board)`; `callDetail(s, id)` → `{ call, agent, clip, po, alertId }`;
  `agentProfile(s, now, agentId)` → `{ row, of, coachings, roleplays }`. Industry keys: `toko-bangunan|multifinance|asuransi`.
- Mitra: `catalogPreview(s, bizId?)` → `{ needs, suppliers: CatalogCard[] }`; `cvShortlist(cvs, criteria, blind, size = 10)` →
  `{ funnel: { total, education, years, skills, distance }, top }`; `kycInputOf(s, documentId)` → the `kycRisk` input;
  `KYB_RULE`, `shopDistance(s)(kecamatanId)`, `subjectName(s, request)`; `cvFit` re-exported.
- Brand: `brandStream(s, now, { brand: 'shop'|'competitor'|'kategori'|'all', topic, sentiment, outletId, … })`;
  `reputationScore(s, now, brand?)` → `{ score, at }`; `reputationAt(s, now, brandId)` *plain*; `brandAlertsAt(s, now)`;
  `mentionPlace(s, m)` → `{ desa, kecamatan }`; `CHANNELS`, `TOPICS`, `REPUTATION`; `brandSpike` → `{ count, rule,
  baselinePer2h, crossed, preSignalIds }`; `affectedOrders` → `{ count, value, orderCodes }`.
- Tender: `tenderFeed(s, now, { kbli: 'cocok'|'semua', kecamatanId, value: 'kecil'|'sedang'|'besar', deadlineDays: 3|7 })` →
  `{ rows: { tender, probability, kbliOk, deadlineIn, risk, mirror, isNew }[], counts }`; `tenderKpi` → `{ openMatched,
  avgProbability, dueIn3Days, activeBidValue }`; `priceAdvice` → `{ hps, cost, range, suggested, margin, ratio, history }`;
  `bidHistory` → `{ rows, winRate, valueWon }`; `procurementOfTender`, `WIN_MODEL`, `itemCost`, `kbliOf`.
- Config: `UP`, `UP_SCENARIO`, `BRAND_BURST`, `EMERGENCY_TENDER` (key `karung-terpal-darurat`, unit HPS karung 15.500 /
  terpal 135.000 ⇒ Bojonegoro HPS Rp 37.750.000, chance 0,78), `SHOP_KBLI`, `FLOOD_TAGS`; labels incl. `ANNOUNCE_CHANNEL`.
- Base helpers: `shopOutlets(s)`, `outletKey(outlet)` ('toko'|'kopi'|'warung', for `?outlet=`), `kecName`, `desaName`.
- Scenario: `ensureFloodScenario(s, now)` (idempotent, also while queued), `activeFloodAlert(s)`, `useFloodAutoplay(on)`.
- Payloads *plain*: `salePayload({ outletId, lines, discount?, payments?, staffId?, cashGiven? })`, `bidPayload(tenderId,
  bizId, price, docSections, pages = 34)`, `repliesPayload(mentionIds, tone, replies, by, alertId?)`.

Seeded facts (`s.meta.facts.up`): `payrollStaffIds`, `newCashierStaffId`, `newCashierAgentId`, `lowCall[industry]`,
`kenalMitra { heroBusinessId, heroRequestId, mismatchBusinessId, kycCleanDocId, kycEditedDocId, cvOpening, cvCount,
shortlistSize }`, `brand { baselinePer2h, preSignalIds, reputationAt0700 }`, `shopBidderId`, `omzetYtdBefore`. Shop id:
`s.meta.shopId`; competitors `s.meta.competitors`.

### Events and toasts

All events of plan §1.4 exist with the plan's payloads (types in `world/types.ts` `EventMap`). Follow-ups carry the
CONSUMING product as `source`, so the cross-product toast is automatic; the toast link is `/demo/<target>?focus=<id>`
where `<id>` is the first entity of the follow-up's audit row. **Toasts carry only `?focus=`** (no `?tab=`,
`?industry=`, `?outlet=`): route the id to the right tab yourself. Ids your canvas receives:

| Chain | Target | `?focus=` is |
|---|---|---|
| C14 sale → ledger | pajak-beres | ledger entry id (`JR-…`) |
| C17 PO → WA chat | juara-jualan | call id (`CL-…`, industry toko-bangunan) |
| C18 reply → nota | pajak-beres | purchase order id (`PO-…`) |
| C20 price anomaly | toko-autopilot | product id (`SKU-…`, a warung/kopi `cm:` SKU ⇒ tab prediksi, its outlet) |
| C22 tender matched | tenderpilot | tender id (`TD-…`) |
| C25 bid → procurement | awas-belanja | procurement id (`PK-…`) |
| C26 need → KYB | kenal-mitra | verification request id (`KM-…`, kind kyb) |
| C28 flood → brand | pantau-merek | brand alert id (`BA-…`) |
| C29 announcement → Kasir | toko-autopilot | announcement id (`BN-…`; `s.posNotices` is keyed by it) |
| L1 `tax.ready` / L2 `partner.verified` (`EFFECT_ALSO`) | tenderpilot | latest tender matched to the shop |

`'ledger→score'` emits `score.updated` only when the Rapor score actually changes (one small sale usually does not).

### Kit components (import paths as plan §1.2)

- `ChatThread({ messages, typing?, quickReplies?, onQuick?, quickDisabled?: Bi, highlightId?, label })` + `ChatComposer({
  onSend, placeholder, label, sendLabel?, disabledReason?: Bi, value?, onFocus? })` from `demo-kit/ui`. Messages `{ id, side:
  'me'|'them'|'system', text: Bi|string, at? (world minutes), status?: 'sent'|'delivered'|'read', author? }`. `role="log"
  aria-live="polite"`; new bubbles slide 8 px (transform/opacity), opacity only under reduced motion, nothing under static.
- `MoneyInput({ value: number|null, onChange(n|null), max?, …input props })`; `MonthCalendar({ month, today, events: { id,
  at: 'YYYY-MM-DD', label, tone?, href? }[], onSelect?(date, events), compact?, label })` (arrows / Home / End / PageUp /
  PageDown, week strip < 640 px); `icsFor(events, { lang?, calName?, stamp? })` → iCalendar text; `flyBetween(from, to, { duration })`.
- `TextDiff({ before, after, mode: 'inline'|'split', label })` and `diffWords(a, b)` from `demo-kit/docs/TextDiff` (also in
  the docs barrel); `terbilang(n, lang)` from `demo-kit/i18n/terbilang`; `useCamera({ facing })` from `demo-kit/media`.
- Docs samples (import by MODULE): `finance` (`notaDoc(meta, { crumple?, tilt?, edited?, id? })`, `fakturDoc(meta, id?)`,
  `mutasiDoc(rows, { bank?, holder, account?, period?, id? })`, `FICTIONAL_BANK` = 'Bank Wiyata Sentosa'); `permits`
  (`kybSpecimens(subject, { mismatch?: 'alamat'|'nama' })` → `{ nib, npwp, akta|null, lokasi }`); `identity` (`ktpSpecimen`,
  samples `ktp-joko`, `ktp-siti-edit`, `ktp-bambang`); `cv` (`generateCvs`, `cvFit`, `cvDoc`, `CV`). `simulateExtract`
  handles kinds `npwp`, `akta`, `lokasi`. `kybCase(s, bizId).docs` already builds the KYB specimens for a business.
- `Waveform` markers: ≥ 24 px hit area, `data-tone`, `data-marker=<id>`.
- `/lab/_kit?only=up` shows ChatThread + ChatComposer, MonthCalendar (+ .ics), TextDiff and MoneyInput + terbilang.

### Stubs and tests

- `src/demos/<slug>/index.tsx` for the 6 slugs are STUBS (skeleton until ready, `missions = []`); the registry loaders
  point at them; `DEMO_READY` is untouched (integrator). Builders replace the stub file.
- World: `npx tsx src/demo-kit/world/__tests__/world.selftest.ts` runs `up.selftest.ts` (determinism, numbers, texts,
  alive 07:01–07:03, C14–C29, store gate) on the mini fixture and the Bojonegoro pack.
- `tests/e2e/chains.spec.ts` "chains 14 …" – "chain 29" = the world-level C14–C29 contract in the browser (lab shell +
  `__gamada.ensure`).

### Tahap 3 integration notes (2026-11-18, integrator)

- `DEMO_READY` is flipped for the 6 Usaha Pintar demos. Links to them render as real `AppLink`s with `?focus=`.
- `partner.verified` raises its `EFFECT_ALSO` toast (TenderPilot / Katalog Lokal) only for `subjectKind: 'business'`
  (KYB). KYC and CV verifications raise no cross-product toast (a CV batch used to raise 10, naming candidates).
- `ledger.reviewed` marks the entry `reviewed: true`; `mutasiRows` keeps the reviewed rows on the statement as `cocok`,
  so the November statement is the same 40 rows before and after a review.
- `pendingNotas` cold-start fallback never returns a PO whose nota is already booked.
- `shiftPlan(s, toko, now).extra` always holds "+1 kasir 13.00–17.00" on Mon–Wed while a banjir alert is active.
- The UP seed scales the history's weekly stock purchases to the history's HPP (+3 %): Persediaan is positive on the
  balance sheet (self-test asserts it).
- `kybSpecimens` site photo: house shape `y: 90, h: 440` (the door no longer gets a negative height).
- `getSample(id)` (docs samples barrel) no longer resolves generated CVs (`cv-0001`…): the CV generator stayed in every
  docs first load (Cek Berkas +3 KB). Build a CV document with `cvDoc(cv)` from `docs/samples/cv` (Kenal Mitra does).
- Never `import()` a kit barrel (`demo-kit/ui`, `demo-kit/docs` …) dynamically from a product: it turns the barrel into
  a dynamic entry and split `AppLink` / `routeLoaders` / `SectionHeader` out of the home entry chunk (home JS +1.1 KB).
- Known kit limits (worked around in products, not changed): `stockRisk` skips `bahan` SKUs (C20 `cm:` SKUs show only
  through `?focus=`); `LineChart` has no forecast band (use `AreaChart` with `forecast`); the kit `Gauge` and `Donut` pull
  d3-shape + ChartFrame (≈ 9–12 KB) into a first load; `docs/extract.ts` imports the samples barrel (after-action only);
  `world/usaha-pintar` lands as one ≈ 14.6 KB shared chunk for every UP product; Waveform markers at the same time stack.
- React: `useEffect(() => el?.scrollIntoView(...))` returns whatever `scrollIntoView` returns (a Promise in current
  Chrome), which React then calls as a cleanup ("destroy is not a function"). Always use a block body:
  `useEffect(() => { el?.scrollIntoView(...) }, [...])`.

## Tahap 4 (2026-11-19): what the kit adds for Pasar Daerah (P14–P17) + GAMADA Inti (P0)

Plan: `docs/build/tahap4-plan.md` §1 (APIs), §3 (chains C30–C38 + L7–L12), §5 (sizes). Where this section and the plan
differ, **this section is what the code does** (the differences are listed at the end). Builders own
`src/demos/<slug>/**`, their prompt file and their own spec only.

### Measured floors (gzip -9, beyond home, `VITE_DEMO_CONTROLS=1` build, 1440, networkidle + 3 s)

| What | Measured | Plan |
|---|---|---|
| Home initial JS | 252.7 KB | ≤ 253.6 |
| Satu Daerah demos vs the final Tahap 3 build (chunk-by-chunk on the same preview) | ≈ +0.5 each (chunk-by-chunk vs the Tahap 3 dist on 4173: demo-core +0.41, Demo +0.06, demo-gen +0.03); budget.mjs vs Tahap 3 budget.json +0.5…+0.6 (radar-isu +4.5 against a stale Tahap 3 value, +0.5 vs the dist) | ≤ + 0.5 |
| Usaha Pintar demos vs Tahap 3 (`budget.json`) | toko-autopilot +0.5; every other UP landing −1.8 … −12.2 (per-module UP selectors, up-data / up-live chunks) | ≤ + 0.5 |
| **IE / SP-Disperindag stub floor** (`/demo/indeks-ekonomi?controls=all`, PD only) | **117.2 KB** | ≤ 110: NOT met |
| **KL / RU / Inti / SP-Pemilik-Toko stub floor** (UP data + PD) | **135.9 KB** | ≤ 125: NOT met |
| PD boot path (`boot` + shared `forecast` + `match` + `reducers-katalog` + `shock-commodities`) | ≈ 8.6 (boot 3.9 + forecast 2.1 + match 1.8 + reducers-katalog 0.6 + shock-commodities 0.2) KB | `pd/boot` ≤ 4.2 |
| UP data chunk `up-data` (seed extension + its modules, one chunk) | 18.5 (up-live 6.0) KB | `up/data` ≤ 15.5 |
| `eco-load` (the world-module loaders, UP / PD / Inti pages only) | 1.0 (+ pd-loaders 0.6 on PD pages) KB | — |
| PD chains (`pasar-daerah/chains`, first pointerdown / keydown on a PD or Inti page) | 5.5 KB | ≤ 8, after-action |
| Natural PD events in the first 10 s of a PD stub | 0 extra KB; no UP live / chains module | none |

**Own allowance (175 − floor):** Indeks Ekonomi and Sinyal Pasar `disperindag` ≈ 57.8 KB (plan ≈ 65: IE must put the
pulse sparkline + ActivityFeed on second paint and keep the map kit + kecamatan JSON as the only big first-load
pieces); Katalog Lokal, Rapor Usaha, Inti, Sinyal Pasar `pemilik-toko` ≈ 39.1 KB (plan ≈ 50: KL cuts strings per side
and keeps Umkm / Compare / map / AI lazy; RU and Inti fit their plan numbers).

Measure with `.shots/t4-kit/budget.mjs <port> <dist>` (13 Tahap 2/3 demos + roles, the 5 Tahap 4 landings + roles,
and a 10 s check that the natural PD events pull no UP live / chains module) and `.shots/t4-kit/cmp.mjs /demo/<slug>`
(chunk-by-chunk vs the `dist/` preview on 4173).

### World modules and readiness (`world/eco.ts`, `world/eco-load.ts`, `world/ready.ts`)

| Module key | Chunk | What |
|---|---|---|
| `'usaha-pintar/data'` | `up-data` | `extendUsahaPintar` only (`meta.ext['usaha-pintar']`), incl. tahap 4 `seedPdLinks` |
| `'usaha-pintar'` | `up-live` | UP live handlers + natural events (imports the data module first) |
| `'usaha-pintar/chains'` | `chains` | C15–C29 (unchanged except the C26 guard and the C27 score) |
| `'pasar-daerah'` | `boot` | PD data patch `extendPasarDaerah` (`meta.ext['pasar-daerah']`), the natural-event reducers + texts (need, match, order.paid), natural-pd, the boot reaction "a natural need brings its own matches" |
| `'pasar-daerah/chains'` | `chains` | C30–C38 + the reducers / audit texts of every other PD type |

- **Readiness (PD + Inti products):** `import { useWorldReady, preloadWorld } from '../../demo-kit/world/ready'` (NOT the
  world barrel: Satu Daerah pages must not carry it). `useWorldReady(MODS)` with a module-level constant:
  KL, RU, Inti, SP `pemilik-toko` side → `['usaha-pintar/data', 'pasar-daerah']`; IE, SP `disperindag` → `['pasar-daerah']`.
  It is true once the modules are registered on a ready world that carries their data. `preloadWorld('usaha-pintar/data')`
  on the SP role chip's intent. UP products keep `useEcosystemReady('usaha-pintar')` (barrel).
- DemoShell preloads the landing's modules (`preloadWorldFor(slug, role, eco)`: table in `eco-load.ts`
  `worldModulesFor`) next to the region, and the eco's chains on the first pointerdown / keydown (PD + Inti pages ⇒
  `pasar-daerah/chains`). `?e2e=1`: `__gamada.ensure('pasar-daerah')` (boot + chains) / `ensure('usaha-pintar')`.
- **Store gate (`ecoNeeds`)**: every event a PD product emits (source `katalog-lokal | rapor-usaha | indeks-ekonomi |
  sinyal-pasar | inti`) waits for the PD chains (its reducer lives there; normally preloaded by the first click);
  `flood.alert`, `procurement.recommended`, `need.created`, `order.paid`, `loan.approved`, `price.shock/warning/alertSent`,
  `market.operation` **running** need the PD chains from any page; clock `need.created` / `order.paid` need the boot module
  only. The UP gate skips clock-sourced non-emergency `need.created`. A natural price tick never loads PD.
- The PD and UP data patches commute (either load order ⇒ the same world, self-test). `WORLD.version` = 6.
- **Ids of PD rows are assigned at emit time** (the boot module registers every PD id field), so emit only after
  `useWorldReady` is true.

### `world/pasar-daerah` (ONE import path; not in the barrel; rewritten per name at build)

Everything of plan §1.5 exists with the plan's names. Shapes that differ / add:
- `LENDERS` (+ `PD`, `CATEGORY_REF`, `LOAN`) come from here (not from the world barrel): `LENDERS[0]` = Koperasi Mitra
  Usaha Sejahtera.
- `matchScore(s, needId, bizId)` → `{ score, parts: { coverage, distance, skor, pajak, kapasitas } }` (2 decimals).
  `rankVerified`, `newMatchesFor(s, needId, n=6)` = the C36 / natural rule. `badgesOf(s, bizId)` → `{ verified, taxTidy,
  score, kybAt? }`. `catalogShortlist(s, needId)` → `{ top: Card[], waiting: Card[] }`, `Card = { business, km, score,
  parts, badges, offer, requestId? }`. `offerFor(...)` → `{ lines: { category, name, qty, unit, unitPrice, qtyAvailable }[],
  total, source: 'bid'|'saran'|'katalog', tenderId }`. `listingOf(s, bizId, category)` → `{ category, unitPrice,
  qtyAvailable, leadDays, unit }`. `catalogKpi(s, now)` also gives `paidOrdersMonth`. `needView` → `{ need, source:
  'siaga-wilayah'|'awas-belanja'|'ukpbj'|'natural', sourceRef, tenderId, hps, flags[{ procurementId, pct, riskScore }],
  matches, orders }`. `umkmInbox` rows add `isNew`, `need`. `vendorStorefront` rows `{ category, name, unit, unitPrice,
  onHand, productId }`. `orderPayload(s, needId, bizId, qty?)` items carry `category` (the shop's stock leaves on
  `order.shipped`). `umkmPoPayload(s, bizId, warningId)` → `po.drafted` payload | null.
- Rapor: `SCORE_BANDS[{ min, label, tone }]`, `bandOf(score)` → band INDEX 0..4. `raporOf` → `{ score, band, deltaMonth,
  history12, peerScore, peerLabel, factors[{ key, value, weight, contribution, live, source, evidence, focus }], recalcAt }`.
  `scoreActions` → `[{ key, gain, kind, label, target }]` (target = href or null for the in-product drawer).
  `loanOffer(s, bizId, now)` → `{ plafon, ratePct, tenors, installment(amount, tenor), dsr, netProfit, eligible, reason?,
  nextBand: { min, plafon, label } | null }` — **plafon is capped per band (`LOAN.cap`: Baik 100 jt, Sangat baik 150 jt,
  Prima 250 jt)** so the scenario shop gets Rp 100 jt at 710 and Rp 150 jt at ≥ 750 on every seed (the Sep–Oct net profit
  is 64.9 jt on the demo seed 2026, 50.4 jt on seed 1). `installment(150e6, 0.85, 12)` = 13.775.000. `loanAdvice` →
  `{ rec, reasons: Bi[3], maxAmount, scoreNow }`. `lenderQueue` rows `{ loan, business, scoreNow, scoreThen, badges, advice,
  consent }`. `dataFeed(s, bizId, now)` → `{ rows, tx, revenue }` (tx = outletKpis().total.tx). `reviewSuggestion(j)` /
  `reviewedLines(j, account)` are re-exported here (world/up/books, same rule as Pajak Beres).
- Econ: `econSeries(s, kecId|null)` → `{ points: { month, index|null, omzet|null }[12], markers, hidden }`.
  `econSectors(s, month, kecId|null)` → rows `{ key, label, businesses|null, omzet|null, share, merged }` (simulated sector
  mix from the kecamatan's main sector). `econPulse` → `{ tx, revenue|null, panelBusinesses, revenueVisible, byHour }`.
  `econEvents` rows add `index`, `hidden`. `programList` → the ops + `{ id: MODAL_PROGRAM_ID ('modal-kerja'), kind: 'modal' }`.
  `programImpact` → `{ method, labels, treated, control, split, after: { values, lo, hi }, effectPct (= the op's
  effectPct), didPct (measured), priceEffectPct?, measured, note }`. `dinkopCards(s, now)` → `{ sectors, scoreBins, modal:
  { count, amount, kecIds }, katalog: { spendMonth, orders } }`. `briefingModel` returns the paper's numbers incl. `hiddenIds`
  + footnote. Each econ cell keeps its `econ.updated` history in `EconIndex.events`.
- Prices: `seasonalBand(p)` → `{ expected, lo, hi, sdPct }` (band ± 1.5 × spread clamped 2.5–4 %). `shockPath(shock, day)`
  returns a FRACTION. **One world minute after a shock = one shock day** (the demo's acceleration).
  `priceOutlook(s, priceId, now)` → `{ history30, forecast14, lo, hi, peakDay, peakPct, deltaPct, expected, factors }`.
  `opSimulate(s, { commodityId, marketIds, volumeTon, days }, now?)` → `{ effectPct, damp, baseline, forecastAfter, lo, hi,
  costRp }` (effect −(2 + 0.45 t + 0.6 d) % in 3–15; damp t × d / 60 ≤ 0.8; 10 t × 3 d ⇒ peak −50 %). `priceBoard(s, now,
  { commodity?, market? })`, `priceTicker(s, now)`, `commodityIndex(s, id, days)` → `{ values, raw }`, `opView` → `{ op,
  commodity, markets, stage, auto, canStart, endsAt, measured, approveBy }`, `pdKpi`, `alertsFor` rows `{ id, kind:
  'peringatan'|'anomali', … }`, `distributorsFor` → 6 `{ id: 'DS-…', name, kecamatan, stockDays, watched }`, `cmSkuFor`.

### `world/inti`, `world/story`

- `TRAIL_SPINE`, `productOfAudit(a)`, `dataTrail(s, rootRef, { maxRows })` → `{ root, rows, spine[6], branches, complete }`,
  `unifiedInbox(s, now, { channel?, eco?, unreadOnly?, scope })`, `inboxKpi(s, now, scope)` → `{ total, unread, byChannel,
  callsToday }`, `accessMatrix()`, `scopeOf(role)` → `{ scope, allows(refs, s) }`, `auditQuery(s, filter)` rows `{ id, eventId,
  at, product, eco, actor, type, summary, refs, causeId }`, `auditCsv(rows, lang)`, `auditJson(rows)`, `platformPulse(s, now)`,
  `activityRows(s, now, { eco?, product?, max })` (→ `ActivityFeed` rows).
- `world/story.ts` (import on click): `DAY_STORY`, `storyDone(s)`, `sitiComplaint(s)`, `playDayStory({ gapMs = 600,
  onStep(key, 'done'|'skip'|'fail') })` → keys that ran. Twice ⇒ nothing new (self-test); after it `dataTrail(complaints:<Siti>)`
  has 6/6 lanes with audit ids. `world/sd/persona.ts` holds the Siti voice + neighbour report payloads (also in the
  satu-daerah barrel).

### Events, chains, toasts

- All events of plan §1.4 with the plan's payloads (`world/types.ts` EventMap). Extended types: `Order.items[].category`,
  `Order.confirmedQty/etaDays/confirmedAt/shipAt/paidAt/note`, `MarketOperation.sentBy/sentAt/volumeTon/days/startedAt/
  doneAt`, `LoanApp.consentId/purpose/ratePct/installment/decidedAmount/reason`, `CatalogNeed.by/budget`,
  `NeedItem.spec`, `EconIndex.events`, `Complaint.readAt`, `Call.readAt`, `SeedFacts.pd`. New tables `consents` (IZ),
  `priceSubs` (LG), `priceAlerts` (PA), `priceShocks` (GJ), `priceWarnings` (PDN), `distributorWatches` (DW).
- `market.operation` patch (by id) may now set `marketIds`, `volumeTon`, `days`, `sentBy` (stamps `sentAt`), `reason`,
  `effectPct`; `running` stamps `startedAt`, `done` stamps `doneAt`. SP's "Kirim ke Meja Pimpinan" = patch the open C13
  op of that commodity (or a new op) with `stage: 'recommended', sentBy: 'disperindag', volumeTon, days, marketIds,
  effectPct: opSimulate().effectPct`. The clock approves it after 4 world min (`instruction.issued` origin the op).
- `order.created` with a tender closes it (`selesai`, ordered business's bid `menang`, others `kalah`).
- C30–C38 as plan §3 (sources = the consuming product). Bojonegoro: the shocked markets are Pasar Banjarejo, Pasar Kota
  Bojonegoro, Pasar Wisata Bojonegoro; cabai `price.anomaly` at flood +2 (Pasar Kota), beras at +4 (Pasar Banjarejo).
  C36 skips `by: 'natural'` needs (they get their matches from the boot reaction, same batch, source katalog-lokal).
- Toasts: `EFFECT_ALSO` targets now only READY products (a pending one is never linked); `shell/effects-pd.ts` adds the
  PD landings (L8 RU, L9 `bid.submitted` → KL need, L10 `order.created` → TenderPilot bid, L11 `order.shipped` → Toko SKU,
  `market.operation` recommended → Meja, running/done → Indeks Ekonomi `?focus=<opId>`) and PD root labels; it is
  registered when the UP or PD chains module loads (i.e. after the visitor's first interaction). Toasts still carry only
  `?focus=` — route the ids yourself (`OP-` ⇒ IE Dampak, `PA-` ⇒ SP Pemilik Toko inbox, `pajak` ⇒ RU factor drawer …).

### Kit components

- `ScoreDial` (`demo-kit/viz`): `{ value, prev?, bands, label, size: 'sm'|'md'|'lg', max? }`, role="meter", no d3, ≈ 1 KB.
- `BizBadges` (`demo-kit/ui`): `{ badges, bizId?, size?, links? }`; `RangeField` (`demo-kit/ui`): `{ label, min, max, step,
  value, onChange, format?, unit?, disabled?, hook? }`; `ActivityFeed` (`demo-kit/ui`): `{ rows, max?, live?, label, empty? }`.
- `LineChart` now takes `forecast` (band + dashed line) and `markers: { x, label: string|Bi, tone? }[]` (listed in the text
  summary); `AreaChart` takes `markers` too (`AreaProps` = `XYProps`).
- **`StepScrubber`** (`demo-kit/map`, NOT a changed TimeScrubber — the flood demos keep the smaller original):
  TimeScrubber + `steps: { value, label: Bi, short?: Bi }[]` (value = index, aria-valuetext = label) + `onEnd`; Play runs
  the steps in 9 s, discrete under reduced motion, pauses off-screen.
- **AI traces: `import { useAiTraces, lastTrace, allTraces, type AiTrace } from '../../demo-kit/ai/trace'`** (NOT `ai/chat`:
  the chat surfaces would carry it). `useAiChat` pushes every finished answer (ring of 10, sessionStorage + memory).
- **Strings: `import { usePdStrings } from '../../demo-kit/i18n/pd'`** → `pdLoading`, `anonHidden`, `simPrice`,
  `simScore`, `projection` (NOT `useDemoStrings()`: kept out of every demo's first load).
- `/lab/_kit?only=pd`: ScoreDial, BizBadges, RangeField, LineChart forecast + markers, StepScrubber, ActivityFeed.

### Seed facts (demo seed 2026; seed 1 and the mini fixture: same numbers unless noted)

Shop score **710** ("−40 vs Okt": history[10] = 750 is set by the UP data patch), peer median 629 (seed 1: 573);
`scoreActions`: rapikan-jurnal +30, pajak-siap +80, stok-aman +8; 3 reviews ⇒ 720 / 730 / 740; then `tax.ready` ⇒ **820**
(`tax.ready` first: 790); hero CV Sedeng Jaya Abadi 692 ⇒ 790 after KYB lolos. Loan: 710 ⇒ Rp 100 jt (1,0 %/bln); ≥ 750 ⇒
Rp 150 jt, 0,85 %, 12 bln ⇒ Rp 13.775.000/bln (DSR 21 % on seed 2026, 27 % on seed 1). Hidden kecamatan (< 10 businesses):
Kedewan + Ngambon (mini: Trucuk + Kanor). `facts.pd`: shock commodities cabai-rawit + beras-medium, tick market
pasar-kota-bojonegoro, past op OP-0001 (beras, Pasar Banjarejo, −6 %, 35 days ago). Cooperative queue (`LENDERS[0]`):
3 waiting (CV Sedeng Jaya Abadi 120 jt, UD Bumi Terpal Lestari 75 jt, a warung 25 jt), 1 approved, 1 declined (reason),
each with a consent (scopes differ). The shop subscribes to price alerts (WA, 10 %, beras + cabai rawit first).

### Differences from the plan (decided by the kit agent for the size limits)

`useWorldReady` / `preloadWorld` from `world/ready` (not the barrel) · `LENDERS` from `world/pasar-daerah` · traces from
`ai/trace` · PD strings from `i18n/pd` · `StepScrubber` instead of a changed `TimeScrubber` · `worldModulesFor()` instead
of a `WORLD_MODULES` table · `bandOf` returns the band index · plafon capped per band · the PD data (facts.pd + past op) is
the PD module's patch, not the core seed (Satu Daerah first loads unchanged) · per-target toast focus dropped (also-targets
are READY products only) · floors above the plan (see the table).

### Tahap 4 integration notes (2026-11-19, integrator)

- `DEMO_READY` is flipped for Katalog Lokal, Rapor Usaha, Indeks Ekonomi, Sinyal Pasar and GAMADA Inti: every product
  is READY, so no `/demo/:slug` shows the interim placeholder any more (`polish.spec` "interim preview panel" is skipped
  and `shell.selftest` runs `interim,gutter` only when asked for explicitly).
- `ScoreDial` colours fall back to the `--dk-*` tokens outside a `.dk-viz` box (the band tones were unset there).
- `natural-pd` shock path: an anomaly already raised by an earlier step of the same shock is derived from the shock
  path, so a replayed multi-minute jump (state not updated yet between minutes) raises one anomaly per shock, not two
  (pd self-test "jump replay").
- `reviewSuggestion` / `reviewedLines` are exported from `world/usaha-pintar` too; Pajak Beres uses them (one rule
  with Rapor Usaha).
- `ID_PREFIX` (world/ids.ts) now carries `consents: 'IZ'` and `priceSubs: 'LG'` in the core map: the UP data patch
  (`seedPdLinks`) seeds them and can load before the PD module, which used to give them ids like `undefined-0005`
  (Rapor Usaha `?focus=IZ-…` then missed; pd self-test asserts the prefixes).
- Rapor Usaha's `?focus=` effect always applies the routed role (`setSession` is a no-op when unchanged): the deferred
  session role of the first render may still hold the previous page's role.
- TenderPilot routes a bid id (`?focus=BD-…`, the L10 toast after a Katalog Lokal order closed the tender) to the
  tender + the Riwayat tab.
- Dev-only: under React StrictMode a product that switches the session role inside its `?focus=` effect can be
  overridden by the shell's mount replay when the canvas chunk is already cached (seen in Sinyal Pasar `PA-` arrivals
  after an in-app navigation back to it). Production builds are not affected.
- `playwright.config.ts` runs 3 workers locally (260 tests: with 4 the heaviest crawls time out on a busy machine).
- Tests: `tests/e2e/tahap2/helpers.ts` `SLUGS` includes the 5 new demos (no dead controls, region + language); the
  crawler waits until the number of first-screen controls is steady (lazy map / list pieces). UI chain variants:
  `tests/e2e/tahap4/chains.spec.ts`.

## Tahap 5 (2026-11-19): what the kit adds for the tour (`/tur`, plan `docs/build/tahap5-plan.md` §1.3 K1–K7)

Where this section and the plan differ, **this section is what the code does**.

### K1 · world scope (`world/persist.ts`, `world/store.ts`, `world/session.ts`)
- `type WorldScope = 'default' | 'tour'` (world barrel). `persistKey(region, seed, scope = 'default')`: default
  `gamada:world:<region>:<seed>` (unchanged, Tahap 2–4 worlds stay readable), tour `gamada:world:tour:<region>:<seed>`.
  `loadPersisted` / `clearPersisted` take the scope as 3rd arg; `Persisted.scope?` (absent = default).
- `loadWorld(pack, seed, { scope? })` saves the outgoing world first (`flushPersist`), then loads / generates the one of
  that scope. `world.scope()` = the installed world's scope. `resetWorld({ clock? })` keeps the scope (the tour:
  `await resetWorld({ clock: 6 * 60 })` = "Mulai tur" at 06:00; the visitor's world is untouched).
- Session: `scope: WorldScope` (default 'default') and `from: string | null` ('tur-<n>' of a taken-over sandbox).
  DemoShell's "same world" check compares the scope too, so switching scope reloads the right world.
- The tour sets `setSession({ scope: 'tour', regionId, seed })` itself; the stage shell then loads the tour world.

### K2 · URL (`shell/url.ts`)
- `readDemoQuery` reads `?world=tour` (`q.world`) and, only with it, `?from=tur-<n>` (`q.from`, `/^tur-\d\d?$/`).
- `sessionParams` writes `world=tour` + `from` while the session is in the tour scope (a reload of a taken-over sandbox
  stays in the tour world); `demoHref(slug, session, focus)` carries `world=tour` (+ `from`) the same way. Every shell
  link (cross-product toasts, guide "next product", palette) and every product link built with `demoHref(…, session)`
  keeps the tour world. **Not carried:** links products build by hand (`world/inti` `activityRows` / `unifiedInbox`
  hrefs, Inti `hrefTo`, `?controls=all` helpers): those open the visitor's own world.
- DemoShell (sandbox mode): `scope = query.world ?? 'default'`, `from = query.from ?? null`.

### K3 · `DemoShell mode="tour"` (+ `tourSlot`)
- `<DemoShell product={slug} mode="tour" layout="contained" tourSlot={<AmbilAlih/>} canvas={…} />`. The bar shows only
  the product name (plain text, no link) and `tourSlot` at its end; no logo, region, role, clock, AI, mode badge, language,
  palette, guide, reset, fullscreen, "⋯", hotspot, mission pill; Ctrl K / "?" are not bound. Never writes the URL
  (`syncUrl` forced off) and never applies `?t` (the tour owns the clock). Session on mount: `scope 'tour'`,
  `from null`, `present false`, `aiMode 'sim'`, role = `?role` (URL handoff) or the product's default, region/seed from
  the URL or the current session. Toasts stay (`toastPlacement` prop / `setToastPlacement`). The event pipeline and the
  eco's chains are preloaded at mount (no first click needed).
- `useShell().link` still holds the handoff query (`?role ?tab ?focus …`) and `useShell().focus` the `?focus=` id.
- Products still write their own params (`?tab=` etc.) with `replaceQuery`: on `/tur/<n>` the Stage must clean them.

### K4 · "Kembali ke tur" (`shell/TourBar.tsx`, lazy chunk)
- A sandbox whose session has `scope 'tour'` and `from 'tur-<n>'` (i.e. opened with `?world=tour&from=tur-<n>`) shows
  `[data-tour=back-to-tour]` (44 × 44 px min, left of the product name, label hidden < 768 px) →
  `/tur/<n>?resume=1&region=<id>&lang=<lang>` (+ `&seed=` when not the default seed). After a cross-product hop
  (`demoHref` carries `world` + `from`) it is still there.

### K5 · `playDayStory({ gapMs?, onStep?, source?: 'clock' | 'tour', until?: StoryKey })`
- `source` sets the events' source (default 'clock'; origin stays the step's product). `until` stops after that key
  (`until: 'siti'` = flood + siti; a skipped key also stops there). The `flood` step goes through `ensureFloodScenario`,
  which always emits with source **'clock'** (origin siaga-wilayah).
- Shell toasts: an event with source 'tour' and origin = the shell's product counts as that product's own root (its
  cross-product effects toast in the stage). A 'tour' root with another origin raises no toast.
- `ensureFloodScenario`: its "already queued" guard is cleared on every world install / reset (before: a reset world
  that replays the flood at the same minute got NO flood, because the new alert has the same id).

### K6 · determinism probe (`world/__tests__/tour.selftest.ts`, run by `world.selftest.ts`)
- Fresh tour world on the Bojonegoro pack, UP + PD modules registered, natural events ON, clock jumped 06:00 → 17:00
  through the 19 chapter times (`TOUR_TIMES`), story keys at ch. 2 (flood), 4 (siti + neighbours), 5 (instruction), 7
  (recommend) with `source: 'tour'`; waits for the natural replay + settle after each jump. Twice ⇒ **identical audit
  fingerprint** (FNV of `at|type|source|refs` of every audit row ≥ 06:00): **DETERMINISTIC** — `72060f0e`, 979 rows (729
  natural, 4 tour) on seed 2026. ⇒ plan §0.4 holds: natural events stay ON in the tour, no fallback needed.
  `TOUR_DIAG=1` prints the first differing rows if it ever breaks. Browser caveat: a jump replays ≤ 60 minutes per idle
  slice with the state of the slice start (same in the probe); jump only after the previous replay caught up
  (`naturalBacklog() === 0` and `settled()`), as the probe does.

### K7 · router
- `/tur` and `/tur/:bab` have `handle: { chrome: 'none' }` (no navbar / footer / WhatsApp float / cursor / reading bar;
  the skip link uses the bare text). `lib/i18n` `sandboxRoute()` still matches `/demo/*` only: the site dictionary of
  an EN visitor is fetched on `/tur` like on any site page.

### Tour hooks (attributes only, no behaviour change)
`[data-tour=po-approve]` (already there: Toko Autopilot PO tab, first "Kirim PO"), `[data-tour=mp-ask]` +
`[data-tour=mp-ask-send]` (Meja Pimpinan ask input + send, both the AskBox stub and AskData), `[data-tour=sw-recipients]`
(Siaga Wilayah broadcast recipient list `ul`, inside the broadcast composer preview), `[data-tour=cb-bulk]` (Cek Berkas
"Massal" option of the mode switch; `SegmentedOption.hook` puts `data-tour` on an option), `[data-tour=ri-clarify]`
(Radar Isu clarification publish button = `[data-testid=ri-publish]`).

### Tahap 4 number fixes (kit side)
- `priceOutlook().factors` adds a `'lainnya'` factor ("Lainnya (pembulatan)") when the factors leave ≥ 0,1 pt, so the
  chips always add up to `peakPct` (selftest). Sinyal Pasar's drawer shows "Puncak prakiraan +x% =" in front of them.
- `StepScrubber` reads its step labels from a ref and rewrites the label when `steps` change (a flood during Play left
  the old "indeks 100,2").
- `AiTrace.worldAt` (world minutes of the answer); Inti Agen shows it (wall clock only for older traces).

### Sizes (gzip -9, beyond home, chunk-by-chunk vs the Tahap 4 `dist/`)
Home JS 252.7 (unchanged). `demo-core` +0.50 KB ⇒ every demo +0.5 (budget.mjs: 13 Satu Daerah / Usaha Pintar landings
+0.5, kenal-mitra +0.6 by rounding). The Tahap 4 fixes add on the PD landings: shared `forecast` +0.07, Rapor +0.09,
`trace` +0.04 (lazy) ⇒ Katalog Lokal / Indeks Ekonomi / Inti +0.6, Rapor Usaha / Sinyal Pasar +0.6…0.7. `TourBar` is
its own small lazy chunk (only on the tour stage / a taken-over sandbox).

## Tahap 7 (2026-11-20): region picker, region-neutral kit, Hotspot overlap (plan `docs/build/tahap7-plan.md` §1.6, §2 items 2, 6, 16, 17)

### Region picker + switch without reload (item 2)
- `RegionSwitcher` (shell/controls): with ≥ 2 entries in `REGIONS` it is a real picker (TopBar ≥ 1280; the "⋯" sheet's
  radio list below): every region with `name` ("Kota Bandung" / "Bandung City") + `sub` (type, plus the province when the
  `REGIONS` entry carries `province`: "Kota · Jawa Barat" / "City · West Java"). Opening / hovering it calls
  `preloadRegion` for every entry. One entry: the plain label as before. Labels: `regionLabel(entry, lang)` (kit i18n;
  reuses `regionText`, so the type / province tables exist once). **Integrator:** add `province` to each `REGIONS` entry.
- A pick writes the session (→ `?region=`). `DemoShell` sees a region different from the one it booted with and calls
  `loadWorld(pack, seed, { scope, fresh: true })`: the saved copy of that region is forgotten, the new region starts from
  its seed at `WORLD.clockStart`, `?focus=` is cleared, the stage remounts (skeleton meanwhile), and a toast says
  "Wilayah: Kota Bandung". No page reload (a `window` marker survives).
- Map fly: the stage remount unmounts `MapView`; its camera is handed to the next `MapView` of ANOTHER region mounted
  within 8 s, which starts there and flies to its bbox (`ENGINE.flyDur` 1.2 s; a jump under reduced motion). The engine
  no longer has a Bojonegoro start camera: `MapView` passes the pack's own centre (`EngineOptions.start`).
- `loadWorld(p, seed, { fresh })` is new; `currentRegion()` (world barrel, `world/util`) = the pack of the running world
  (set by `loadWorld`; null in node and on pages without a world).

### Region-neutral kit (§1.6)
- `region/anchor.ts` `floodAnchor(pack)` → `{ river, kecamatanId, kecamatan, desaId, desa, desaKind, floodKecamatan[],
  market }`: kecamatan = `scenario.meetingKecamatanId` → first flood kecamatan; desa = `scenario.embankmentDesaId` → its
  first desa/kelurahan. Its own tiny module (NOT re-exported by the world barrel, so it never joins demo-core); import it
  from `demo-kit/region/anchor`. Both scenario fields are optional in `RegionPack` (types.ts).
- The seeded flood meeting's camat uses the same rule (no `'kalitidu'` literal). **Integrator:** the Bojonegoro pack has
  no `meetingKecamatanId` yet, so its meeting now names Camat **Trucuk** (first flood kecamatan) while the default clip
  says Kalitidu/Ngujo: add `meetingKecamatanId: 'kalitidu', embankmentDesaId: 'kalitidu-ngujo'` to the Bojonegoro
  scenario (tools/region/content/bojonegoro.mjs) and rebuild, or accept Trucuk and let Naskah Pintar use `meetingBanjirFor`.
- `media`: `meetingBanjirFor(places)` + `meetingBanjirNotesFor(places)` template the flood meeting clip (river, flood
  kecamatan list, camat, embankment desa/kelurahan, "Kelurahan" for a kota). `MEETING_BANJIR` / `MEETING_BANJIR_NOTES`
  are unchanged byte for byte (= the default places). Naskah Pintar (P1): `meetingBanjirFor(floodAnchor(pack))`.
- No-dam hoax: a pack without a dam landmark gets a SIMULATED sluice gate on the flood river: gauge `Pintu air <river>`
  (kind `waduk`, own readings) and `facts.hoax = { damName: 'Pintu air <river>', damNameEn: '<river> sluice gate' }`.
  `hoaxDam(facts)` (scenario-texts) → `Bi`; `hoaxPost(i, at, dam: string | Bi, k, rumor)`; reactions fill claim /
  evidence / recovery per language. Evidence text now ends "Tidak ada laporan kerusakan." / "No damage reported."
  `gaugeName()` EN: "Pintu air X" → "X sluice gate". Radar Isu (P1) should read the name through `hoaxDam(facts)` for EN.
- `docs/nik`: `parseNik` defaults to `defaultNikRegions()` = the current region's Kemendagri codes + the built-in table;
  `nikRegionName` reads the current region first. `docs/extract`: geotag / flood-zone checks accept the current region
  (bbox, `floodKecamatanIds`) or the specimens' own region (the bundled sample photos stay Bojonegoro specimens).

### Hotspot (item 6)
The ring tries its default spot, then the other three corners of the target; the label tries below / above (right-
aligned to the ring, then left-aligned to the target), then beside the ring. A spot is taken only when it covers no text
or control (7 `elementFromPoint` samples; controls, img, svg and any element with its own text count) and the label
never overlaps its target; no free label spot ⇒ the ring alone. Re-checked on move and every 1 s at rest.

### Could items
- 16 · `Waveform` markers within 3 % of an earlier one stack one lane up (`data-lane` 1–2, media.css).
- 17 · `LineChart` takes `forecast` (band + dashed line) like `AreaChart`.
- 15 · not done (no demo over 175 KB from the kit side).

### Self-tests
`REGION=bandung|padang npx tsx src/demo-kit/world/__tests__/world.selftest.ts` runs every section on that pack (default
bojonegoro); section 9 (`region.selftest.ts`): anchors + meeting clip for every pack and a second-id city fixture (kota,
no dam), the no-dam hoax in ID + EN, a fresh region switch (clock back to 07.00, complaints in the new region), NIK
defaults. Tolerances for a dense city: the day story may skip `neighbours` (Siti's complaint already closes a cluster).

### Sizes (gzip -9, chunk-by-chunk vs the Tahap 6 `dist/`)
Home entry chunks unchanged. `demo-core` +0.62 KB (≈ +0.06 of it is the new pack URLs of `loader.ts`'s glob, not kit
code), `demo-gen` +0.18 ⇒ about +0.75 KB on every demo first load; plus `samples` +0.30 (Naskah Pintar / Juara Jualan),
`MapView` +0.15 (map demos), `extract` +0.09 (Cek Berkas), `Waveform` +0.05. Global `index.css` +48 B comes from a
Tailwind arbitrary variant matched in `tests/e2e/tahap7/inp.spec.ts`, not from the kit.

### Wave C (integrator, 2026-11-20)
- **Boot race fixed** (`shell/DemoShell.tsx`): the "load region pack + world" effect returns early while the
  render-time `session` differs from `getSession()` (the layout effect has just applied `?region` / `?seed` /
  `?world`), and drops the result when cancelled before `loadWorld`. A cold `?region=bandung|padang` no longer fetches
  two packs or installs Bojonegoro under a Bandung shell (seen ~50 % before; Bandung first loads fell back by ~15 KB).
- **Waveform** (`media/Waveform.tsx`): `role="slider"` + tabIndex + aria-value* + pointer/key handlers moved from the
  `.dk-wave` wrapper to an inner `.dk-wave-seek` layer (inset 0, before the marker buttons): axe nested-interactive
  is gone. Focus ring is on `.dk-wave-seek:focus-visible`.
- **TopBar fit**: `.dk-topbar-mid` now tightens on any overflow (was +1 px slack): Toko Autopilot at 1280 with the
  region picker overflowed by 1 px (shell self-test fit).
- **Bojonegoro pack**: `scenario.meetingKecamatanId = 'kalitidu'`, `embankmentDesaId = 'kalitidu-ngujo'` (from
  `build-bojonegoro.mjs`), so `region/anchor.ts` keeps the Tahap 2 story (Kalitidu / Ngujo) on Bojonegoro.
