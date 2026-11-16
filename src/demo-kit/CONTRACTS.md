# Demo Kit — module contracts (tahap 1)

Spec: `docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` (sections 5–10 and 14). Site rules: `docs/CONTRACTS.md`.
Visual direction (decided in tahap 0): **C "Data-dense tenang" as the base**, with the grafts and the fix list in
`docs/design/ARAH-VISUAL-TAHAP0.md` sections 1 and 5. Reference implementation: `src/lab-design/tenang/`
(take patterns, do not import from `src/lab-design/` — that folder is deleted after tahap 1).

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
  seed. Real: region geography, place names, public statistics (with source). Officials by title only.
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
  `EventMap` maps every event type to its payload; `WorldEvent<K extends EventType = EventType> = { id; type: K; at: number /* world minutes since 00:00 */; source: ProductSlug | 'clock' | 'tour' | 'user'; payload: EventMap[K] }`.
  Event types (at least): complaint.created, complaint.clustered, ticket.statusChanged, service.booked,
  briefing.generated, instruction.issued, meeting.transcribed, actionItem.created, letter.dispositioned,
  hoax.detected, clarification.published, rain.forecast, flood.alert, alert.broadcast, procurement.flagged,
  document.verified, sale.created, stock.forecastChanged, po.sent, supplier.replied, ledger.posted, tax.ready,
  call.scored, coaching.assigned, partner.verified, brand.alert, tender.matched, bid.submitted, need.created,
  match.made, order.created, score.updated, loan.applied, loan.approved, econ.updated, price.anomaly,
  market.operation. Products in tahap 2–4 may add fields/events in world/types.ts via their own PRs.
- `store.ts`: `world.get(): WorldState`; `world.subscribe(fn): () => void`;
  `useWorld<T>(selector: (s: WorldState) => T, isEqual?): T` (useSyncExternalStore, selectors memoised);
  `emit<K>(type: K, payload: EventMap[K], source): WorldEvent<K>` — queued, processed in a microtask:
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
  midday, quiet nights): `setNaturalEvents(on: boolean)`, default on, off in tour/presenter.
- `session.ts`: demo session store `{ regionId, seed, role, aiMode: 'sim' | 'live', present: boolean, lang }`
  with `useSession()`, `setSession(patch)`; URL sync is done by the shell.
- `persist.ts`: IndexedDB (idb-keyval) namespace `gamada:world:<regionId>:<seed>`, debounced save.
- `selectors.ts`: memoised selectors used by many products (complaintsToday, slaOnTimePct, activeAlerts,
  negativeIssues, overdueActions, serviceIndex, auditFor(entityId) …).

### region/
- `loader.ts`: `REGIONS: { id; name; shortName; type }[]`, `DEFAULT_REGION_ID = 'bojonegoro'`,
  `loadRegion(id): Promise<RegionPack>` (lazy import per pack, zod-validated, cached),
  `loadRegionGeo(id): Promise<RegionGeo>` (separate lazy chunk), `regionText(pack, lang)` helpers.
- `packs/bojonegoro/` — complete pack (`pack.json` + `geo.json`), built by scripts in `tools/region/` from
  public sources, with every source in `sources[]`. ≥ 12 complaint templates in Basa Jawa with ID + EN.

### ai/
- `provider.ts`: `getAi(mode: 'sim' | 'live'): AiProvider` — 'live' is wrapped with automatic fallback to sim
  (no first token within `DEMO.liveFirstTokenTimeoutMs`, HTTP 429/5xx, invalid structured output ⇒ sim, and a
  `fellBack: true` flag on `done`). `registerScenario(s: Scenario)`, `getScenario(slug)`.
- `intents.ts`: `createMatcher(intents, synonyms?)` → `match(text, lang): IntentMatch` (TF-IDF over words +
  char 3-grams, ID/EN/regional synonyms, threshold).
- `stream.ts`: `streamText(text, { tps?, signal? }): AsyncIterable<string>` (25–45 tok/s, punctuation pauses).
- `live.ts`: `checkHealth(): Promise<{ ok; live; models }>`, SSE client for `POST {VITE_AI_PROXY_URL}/api/ai/chat`
  and `/api/ai/extract`.
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
  cards < 640px; new-row slide + highlight), Kanban (GSAP Flip), Inbox, Timeline, KPI (count-up),
  Badge, Chip, StatusChip, Tabs, Drawer, Modal, Toast (primitive), Skeleton, EmptyState (dusk line art + one
  CTA), Stepper, Score, Avatar, Kbd, Tooltip, Menu, Confetti (≤ 1 s, lavender/peach). Barrel `ui/index.ts`.
- `ui/motion.ts`: `useCountUp`, `flashNewRow`, `dropChips`, `useInView` (last-entry IntersectionObserver).
- frames: `BrowserFrame` (36px bar, neutral dots, URL `demo.gamada.id/<slug>`, radius 14, soft lavender glow),
  `PhoneFrame` (9:19.5, 10px bezel, capsule notch, status bar with world clock, pointer tilt ≤ 6° off in reduced
  motion), `TabletFrame`, `WallScreenFrame` (light perspective, thin bezel, static gradient reflection),
  `PaperFrame` (light paper, shadow, print stylesheet). Barrel `frames/index.ts`.

### viz/
`ChartFrame` (title, unit, source "Data simulasi · seed N", sr-only summary), `LineChart`, `AreaChart` (+ forecast
band: 10% area + dashed line), `BarChart`, `Donut`, `Gauge`, `RadarChart`, `SankeyLite`, `NetworkGraph`
(animated force layout on gsap.ticker, clickable edges), `Sparkline`, `Heat`; pointer tooltip + vertical
crosshair; draw-in ≤ 800 ms on first view; data updates interpolate. `format.ts`: `rupiah(n, 'short' | 'full')`
→ "Rp 1,2 jt" / "Rp 1.250.000", `percent`, `num`, `dateWib`, `timeWib`. Palette from tokens (≤ 6 per chart).

### shell/ (wave 2) · map/ (wave 2) · docs/ + media/ (wave 2) · routes (wave 2)
Specified in the wave-2 briefs.
