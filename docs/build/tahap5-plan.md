# Tahap 5 · Tur "Satu Hari di [DAERAH_1]": build plan

Written 2026-11-19 by the tahap-5 planner, while Tahap 4 (Pasar Daerah + Inti) was still being built in `src/`. Sources:
spec `docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` §12 (tour), §2, §6, §8, §14, §15, §16; `docs/build/tahap3-plan.md` §0;
`docs/build/tahap4-plan.md` (§1.5 `world/story.ts`, §3 C30–C38, tour hooks per brief, §7 deferrals);
`src/demo-kit/CONTRACTS.md`; `src/demos/registry.ts`; `src/routes/Tur.tsx` + `src/content/tour.ts` (the Tahap-1 index);
`src/demo-kit/shell/*`. **Where this file and an older plan differ, this file wins for the tour; CONTRACTS wins for
what the kit code actually does.**

The owner wants speed: **kit step (K1–K7, §1.3) → one tour builder → integration + gate + screenshots.** No review
round. The builder runs the self-check (§0.6) and reports every line PASS/FAIL with the measured number.

**Start condition:** Tahap 4 is integrated and gated (DEMO_READY ×5 flipped, `world/story.ts`, `world/inti`,
`world/pd` exist). If one Tahap-4 product is not READY, the tour still ships: its chapter runs in **poster mode** (§2.0).

---

## 0 · Rules

### 0.1 Product (unchanged from Tahap 3/4 §0.1)
- Direction C "Data-dense tenang" for everything inside the stage (`--dk-*` tokens, `/lab/_kit`). The **frame** of the
  tour (opener, narration column, summary) uses the site's editorial layer: Fraunces titles, dusk palette of the home
  page, but tokens only (no new colours). Ecosystem accents via `[data-eco]`.
- All data simulated and deterministic; people/companies fictional (Siti Aminah, Raka Pratama, Darmo Sutrisno, Joko
  Prasetyo, Rina Wulandari, the shop of the UP kit); officials by title only ("Kepala BPBD", "Camat Trucuk", "Kepala
  Daerah"). Every money / score / price number in narration or summary carries "simulasi".
- **Region-agnostic:** the tour never types "Bojonegoro", a kecamatan, desa, river, market or commodity name. Titles use
  `{region}` filled from `pack.name`; narration fills `{desa}`, `{kec}`, `{pasar}`, `{komoditas}`, `{tender}`, `{shop}`
  etc. from world selectors at chapter start. Bandung/Padang (Tahap 7) must play without a code change.
  `TOUR.regionName` in `content/tour.ts` stays only for the static site pages.
- ID + EN first-class: every visible string `{ id, en }`, follows `useI18n().lang`; narration ≤ 60 words per chapter
  per language (spec §12.1), "Yang terjadi" 2–3 bullets.
- AI always simulated in the tour (`aiMode: 'sim'` forced while the tour runs; Live is never used, even with `?ai=live`).
- **No dead controls.** Every control in the tour frame does something visible. A control that cannot work in the
  current state is disabled with a visible reason (e.g. "Ambil alih" in poster mode: "Demo penuh menyusul").
- **Numbers agree across screens:** narration numbers, captions, summary count-ups and the PDF read the SAME selectors
  the products use (78 % = `tender.matches[shopId]`, 50 / 3 = `bansosBatch`, `peakPct` = `priceOutlook`, …). Never type
  a number the world can compute.

### 0.2 Performance and motion
- **Size:** `/tur` and `/tur/:bab` first load ≤ 180 KB gzip beyond home (target ≤ 175), JSON included, MapLibre engine
  excluded. Home JS stays ≤ 253.6 KB (the tour is never imported from home paths). Plan in §4.
- One RAF loop: the tour engine schedules on `gsap.ticker` through the kit helpers (no `setInterval`, no second RAF).
  Animate transform / opacity only (clock hands = rotate, map "from the fog" = opacity of an SVG, curtain = opacity,
  constellation dots = opacity/scale). No backdrop-filter, no animated blur, no mix-blend on large elements.
- `prefers-reduced-motion`, `?off=tourCinematics`, `?off=demoAnimations`, `?static=1`: no clock spin, no fly, cut
  instead of curtain, typing steps fill at once; the timeline keeps its pacing so autoplay still reads. Idle (paused) =
  0 ticker listeners from the tour. Pause when the tab is hidden.
- INP ≤ 200 ms on: Mulai tur, next chapter, Ambil alih, Ringkasan PDF.

### 0.3 Accessibility and mobile
- 360–430 px fully usable (§3), no horizontal scroll, 44 px targets, the narration is a bottom sheet.
- Keyboard: Space play/pause, ←/→ chapters, `L` chapter list, `P` presenter, in presenter `F` fullscreen, `B` black
  screen, `R` restart chapter; shortcuts ignored while focus is in an input/textarea/select or inside the stage canvas.
  `Esc` closes the drawer/sheet. Visible focus; logical order (skip link "Ke kontrol tur").
- Narration region `aria-live="polite"`: announces the chapter title + first sentence on change, captions throttled
  ≤ 1 per 5 s. Stage steps never move keyboard focus (spotlight is visual only). Each summary number has a text label;
  the constellation has a text equivalent ("9 dari 17 produk sudah tampil").
- axe: no serious/critical on opener, a chapter (desktop + phone) and the summary.

### 0.4 Determinism
- The tour runs on its **own world** (`scope: 'tour'`, §1.3 K1, owner Q1), seed `DEFAULT_SEED`, region from the URL /
  session. "Mulai tur" from the opener resets that world to the seed at 06:00. Two runs produce the same audit
  fingerprint (types + entity ids up to ch. 19).
- Natural events stay ON in the tour world (the day is the same day the sandboxes show: 10:00 rumor burst, PD shock
  path, UP natural sales). Clock jumps between chapters use the kit's normal jump + catch-up. **K6 verifies this is
  deterministic**; if it is not, fallback = natural OFF in the tour and each chapter's `world` steps emit the roots it
  needs through exported payload builders (the list is in each chapter's "world" line below).

### 0.5 Ownership in Tahap 5
- Kit step owns: `src/demo-kit/world/persist.ts`, `store.ts`, `session.ts` (scope), `src/demo-kit/shell/DemoShell.tsx`,
  `TopBar.tsx`, `url.ts`, `context.ts` (tour mode, `?world=`, `?from=`), `src/demo-kit/world/story.ts` (one option),
  `src/router.tsx` (the `/tur` handle line), CONTRACTS "Tahap 5" section.
- Builder owns: `src/demo-kit/tour/**` (new), `src/routes/Tur.tsx` (rewritten), `tests/e2e/tahap5/**`, and **additive
  hook attributes only** in product folders (`data-tour="…"` on an existing element; no behaviour, text or style change;
  list in §2.0). `src/content/tour.ts` keeps its numbers, times, products and titles (site pages read it).
- No git commands, no new npm dependencies, no edits to `src-art/`, `server/`, `tools/`, `docs/shots` (screenshots are the
  integrator's).

### 0.6 Self-check (builder; report every line PASS/FAIL with the number)
- [ ] `npx tsc --noEmit` clean for `src/demo-kit/tour`, `src/routes/Tur.tsx`; no console errors / React warnings during
      a full autoplay in ID and EN.
- [ ] Autoplay at `?e2e=1&rate=8` finishes 20 chapters at 1440×900 AND 390×844; every chapter's `done(s)` true;
      **0 step fallbacks** for READY products (engine counter `__gamadaTour.fallbacks`).
- [ ] Total length at 1× between 7 and 9 min (sum of chapter `duration` + opener; printed by a unit test).
- [ ] Cold `/tur/N` for N = 1…20: poster in ≤ 1 s, "Putar bab N" ⇒ world prepared (chapters < N applied, idempotent)
      and the chapter's `done(s)` true at its end.
- [ ] Ambil alih ⇒ `/demo/<slug>?world=tour&from=tur-N…` shows the same entity (focus flash); "Kembali ke tur"
      resumes chapter N; the visitor's own sandbox world (scope default) is byte-identical before/after the tour.
- [ ] Numbers agree: each chapter caption number = the selector; summary = selectors = Inti/Meja numbers; PDF = summary.
- [ ] Region: `?region=<other pack>` (if a pack exists) plays ch. 1–3 without a hard-coded name and without crash;
      `grep -n "Bojonegoro" src/demo-kit/tour` empty.
- [ ] 360/390/430: no horizontal scroll, targets ≥ 44 px, sheet drag + button toggle, sheet never covers the stage's
      toasts or the Ambil alih button.
- [ ] Reduced motion / `?off=tourCinematics` / `?static=1`: final states render, no ticker listener while paused.
- [ ] Keyboard pass (all shortcuts, drawer, sheet) + axe (opener, chapter, summary).
- [ ] Size table (§4) measured; `/tur` ≤ 175 target, ≤ 180 hard; home ≤ 253.6.
- [ ] Poster mode: `?e2e=1&tourDegrade=sinyal-pasar` plays ch. 17 as poster with correct numbers and no dead control.

---

## 1 · Reuse vs new

### 1.1 Reused as is
| What | From | Used for |
|---|---|---|
| `DemoShell` (`layout="contained"`, `syncUrl={false}`) + the product modules via `demoComponent(slug)` / `useDemoModule` | `shell/`, `demos/registry.ts` | the live stage: real products, real reducers, real toasts |
| `?focus=` arrivals (`useShell().focus` → open, scroll, `flashNewRow`, `clearFocus`) | every product | landing a chapter on the right entity (the "arrive" step) |
| `?role=`, `?tab=`, `?t=` readers (`readDemoQuery`, products' `readParam('tab')`) | `shell/url.ts`, products | chapter role / tab / time |
| `world`, `emit`, `settled`, `onEvent`, `clock` (`setTime`, `play`, `pause`, `setSpeed`), `setSession`, `ensureEcosystem` | `demo-kit/world` | world steps, clock per chapter |
| `ensureFloodScenario(s, now)` (at = min(now, floodAt)) | `world/up/scenario-core` | ch. 2 flood alert at 06:20 |
| `playDayStory({ gapMs, onStep })`, `DAY_STORY` keys `flood · siti · neighbours · instruction · recommend` | `world/story.ts` (Tahap 4) | ch. 2, 4, 5, 7 world steps; ch. 19 trail |
| `dataTrail`, `TRAIL_SPINE`, `platformPulse`, `auditQuery` | `world/inti` (Tahap 4) | ch. 19, summary, PDF list of products |
| Selectors: `alertRecipients`, `zoneCitizens`, `openClusters`, `briefingItems`, `hoaxBurst`, `analyzeProcurement`, `hpsVsMarket`, `localBenchmarks`, `verifiedBusinesses`, `bansosBatch`, `priceOutlook`, `opSimulate`, `raporOf`, `loanOffer`, `brandAlerts`, `econFrame` … | `world/*` | narration fills, captions, `done(s)`, summary |
| `CoachMark` / hotspot ring styles | `shell/` | the spotlight of a `focus` step (visual only) |
| `usePresenter`, `useIdleCursor`, `useFullscreen`, `useMediaQuery`, `useShellSize` | `shell/hooks` | presenter mode, phone layout |
| `PaperFrame` + `printPaper` (print stylesheet prints PaperFrames only) | `frames/` | the 2-page take-home PDF |
| `waLink(text)` | `routes/EcoParts` (import the function only via a tiny re-export in `lib/` if EcoParts would drag its chunk) | "Jadwalkan demo personal" |
| `motionMode()`, `isEnabled('tourCinematics')` | `demo-kit/ui/motion`, `lib/motion` | cinematics on/off |
| `TOUR_CHAPTERS`, `chapterByNumber`, `parseChapter` | `content/tour.ts` | index (n, time, products, title) |

### 1.2 New (builder, `src/demo-kit/tour/`)
| File | Content |
|---|---|
| `types.ts` | `Step` union, `ChapterScript`, `TourState` |
| `chapters.ts` | the DSL `{ id, n, time, product, eco, duration, role?, tab?, arrive?(s), world: WorldKey[], steps: Step[], facts(s), done(s) }` for 19 chapters + summary; narration text NOT here |
| `narration.id.ts` / `narration.en.ts` | `{ [n]: { title, body, happened[] } }` with `{placeholders}`; the inactive language is loaded on switch |
| `world-steps.ts` | `prepareThrough(n)`: applies the `world` keys of chapters < n with gap 0, idempotent by key (same rule as `playDayStory`); `WorldKey` → function table |
| `engine.ts` | `createTourEngine({ chapters, onChange })` → `{ start(n), play(), pause(), next(), prev(), restart(), setRate(0.75\|1\|1.5), state, fallbacks }`; runs steps on the kit ticker; rate scales `wait` / typing / durations, never the world clock speed |
| `exec.ts` | step executors (below) |
| `store.ts` | `useTour()` (useSyncExternalStore): chapter, step, playing, rate, seen products + dwell ms, poster flag; sessionStorage (try/catch) for Ambil alih resume |
| `TourPage.tsx` | the route body: opener ⇄ player ⇄ summary |
| `Opener.tsx` | dusk screen, `Satu Hari di {region}`, region outline SVG from the pack's kecamatan geometry fading in from a fog layer (opacity), clock face spinning to 06:00, "Mulai tur (±8 menit)", "Pilih bab" |
| `Player.tsx` | desktop 38/62 split (narration / stage), phone sheet (§3), controls, curtain |
| `Narration.tsx` | chapter n / 20, big world clock (`useClock`), title, body, "Yang terjadi", Ambil alih |
| `Stage.tsx` | mounts `<DemoShell mode="tour" layout="contained" syncUrl={false} key={n}>` for the chapter product (URL handoff below); poster when not READY |
| `Spotlight.tsx` | dim + ring around a selector (4 opacity panels positioned with transform; no box-shadow animation) |
| `Constellation.tsx` | 17 product dots + Inti centre (SVG, positions from `PRODUCTS` eco groups), lit by `seen` |
| `ChapterDrawer.tsx` | chapter list (time, title, product chips, ✓ seen), keyboard nav |
| `Summary.tsx` (lazy) | count-ups, PDF, WA, "Coba sendiri" grid of 18 READY demos |
| `SummaryPaper.tsx` (lazy, on click) | 2 light pages in `PaperFrame`s: GAMADA logo, region, date, the 6 numbers, products seen with minutes, chapter list |
| `summary.ts` | `tourSummary(s, now)` (below) |
| `strings.ts` | frame UI strings `{ id, en }` |
| `tour.css` | prefix `dk-tour-` |

**URL handoff (how a chapter opens a product without new product code):** before mounting the chapter's shell the
Stage writes `?role=<role>&tab=<tab>&focus=<id>` into `/tur/<n>` with `replaceQuery`; the shell reads them as its `link`
at mount (exactly like a cross-product toast) and the product's own arrival code runs; after mount the Stage removes them
again (the tour URL stays `/tur/<n>`). Role is also set with `setSession({ role })`.

**Steps (`Step` union; spec §12.2 + 3 additions):**
`setClock(hhmm, { spin })` · `emit(type, payload | (s) => payload)` (source `'tour'`, origin = chapter product) ·
`navigate(slug, { role?, tab?, focus? })` (switch the stage product inside a chapter, ch. 2/19) · `focus(selector,
caption?)` (spotlight) · `type(selector, text | (s) => text, { cps: 18 })` (native value setter + `input` events, char by
char on the ticker) · `click(selector, { fallback?: WorldKey })` · `aiRespond(selector, prompt)` (= `type` + submit the
product's own chat, sim scenario; waits for the answer's `done`) · `mapFly(target)` (= `arrive` on a desa/kecamatan/alert
id; the product's own focus code flies the map) · `wait(ms)` · `toast(Bi)` (frame toast, not the shell's) ·
`caption(Bi | (s, lang) => string)` · **`arrive(id | (s) => id)`** · **`story(key)`** (`playDayStory` up to a key) ·
**`await(predicate, { timeout: 4000 })`** (waits for a world state, e.g. a reaction landed).
Every `click`/`type`/`focus` waits ≤ 3 s for its selector; missing ⇒ the step's `fallback` world key runs (or nothing),
the caption still shows, `fallbacks++` (dev console warns with the selector). Visitor pointerdown/keydown inside the
stage ⇒ tour pauses, chip "Lanjutkan tur" appears.

**`tourSummary(s, now)`** → `{ complaintsHandled, warningsSent, hoaxesCountered, savingsRp, umkmOrders, pricesStabilised,
productsSeen }`: complaints with status done/answered today; Σ `alertRecipients` of today's alerts (+ zone citizens
messaged); hoaxes with a clarification; Σ `hpsVsMarket` gap of flagged packages ("potensi", simulasi); orders + matches
for local businesses today; commodities whose shock `damp > 0` (op running). Kit step confirms exact field names;
Inti `platformPulse().todayCount` = the PDF's "peristiwa tercatat".

### 1.3 Kit step (before the builder; small, one agent, ≤ 2 h)
- **K1 world scope.** `loadWorld(pack, seed, { scope?: 'tour' })`, `persistKey(region, seed, scope)` →
  `gamada:world:tour:<region>:<seed>`; `resetWorld()` keeps the scope; session field `scope: 'default' | 'tour'`.
- **K2 URL.** `readDemoQuery` reads `?world=tour` and `?from=tur-<n>`; `demoHref` and every shell link (toasts, related
  products) carry `world=tour` while in scope tour, so cross-product toasts inside a taken-over sandbox stay in the tour
  world.
- **K3 DemoShell `mode="tour"`.** Hides role/clock/AI/reset/palette/guide/hotspot; keeps toasts (placement prop), the
  product name and a slot for the tour's "Ambil alih" button; never writes the URL; clock owned by the tour.
- **K4 TopBar "Kembali ke tur".** When the shell has `from=tur-<n>`: a 44 px button left of the product name →
  `/tur/<n>?resume=1&lang=…` (same region/scope).
- **K5 story source.** `playDayStory({ source?: 'clock' | 'tour' })` (default unchanged).
- **K6 determinism probe.** Node self-test: fresh tour world, jump 06:00 → 17:00 through the chapter times with natural
  ON, twice ⇒ identical audit fingerprint; report the result in CONTRACTS (decides §0.4 fallback).
- **K7 router.** `/tur` and `/tur/:bab` get the full-screen `handle: sandbox` (no navbar/footer/WA float/curtain).

---

## 2 · Chapters

### 2.0 Common behaviour
- Chapter start: curtain/clock-spin/fly transition (§12.1) → `setClock(time)` → `prepareThrough(n)` (instant, no UI)
  → Stage mounts product with URL handoff → wait for the product `ready` (the module loaded and
  `useEcosystemReady(eco)` true) → the chapter timer starts (loading time never eats the chapter) → steps → hold
  until `duration` → next. Clock runs ×10 while playing, paused with the tour.
- While chapter N plays, the next chapter's product chunk is preloaded (`preloadDemo`): the visitor asked for autoplay,
  so this is intent, not idle.
- `seen` += the chapter products (constellation dot lights, dwell time counted while visible).
- **Poster mode** (product not DEMO_READY, or `?tourDegrade=<slug>` with `e2e=1`): the world steps still run (they are
  kit-level: story, chains, selectors), the stage shows a calm card with the product name, the chapter's 2–3 result
  numbers from selectors and "Demo penuh menyusul" (no link); Ambil alih disabled with that reason; success = `done(s)`.
- Hooks: products already carry `data-hotspot`, `data-sw/mp/np/ab/km/tp/jj/pb/pm` and Tahap-4 `data-tour`/`data-kl/ru`.
  Missing today (builder adds, additive): `[data-tour=po-approve]` (Toko PO approve), `[data-tour=mp-ask]` +
  `[data-tour=mp-ask-send]` (Meja AskBox input/send), `[data-tour=sw-recipients]` (Siaga broadcast list),
  `[data-tour=cb-bulk]` (Cek Berkas "Massal" switch), `[data-tour=ri-clarify]` (Radar clarification publish). First
  builder step: a hook-audit script greps every selector in `chapters.ts` against `src/demos` and prints the missing ones.

Format per chapter: **link** = what the Stage opens (handoff) · **auto** = what plays · **visitor** = what they can do
· **ID/EN** = narration outline · **done** = success predicate · **T4** = Tahap-4 dependency.

**Opener (12 s, not numbered).** Region outline appears from the fog, clock spins to 06:00, title "Satu Hari di
{region}" / "A Day in {region}". Buttons "Mulai tur (±8 menit)" / "Start the tour (±8 min)", "Pilih bab".

**1 · 06:00 · Siaga Wilayah (26 s).** link `/demo/siaga-wilayah` role BPBD default · auto: rain cells play on the map,
`click [data-hotspot=sw-run]` runs the forecast to +6 h, `focus` the 4 desa list, `mapFly` the highest-risk desa ·
visitor: scrub the time slider, toggle layers · ID: "Pukul enam pagi, sel hujan masuk dari hulu. Siaga Wilayah
memperkirakan genangan dalam enam jam; {n} desa di {kec} masuk zona merah." EN mirrors · done: mission `scrub6` marked
and `rainScenario` lists ≥ 4 desa (the caption number = that list) · world: none.

**2 · 06:20 · Siaga Wilayah → Sapa Warga (24 s).** link siaga-wilayah · world `flood` (`ensureFloodScenario` at 06:20 /
story key `flood`) · auto: `focus [data-tour=sw-recipients]` (Camat + Kades from `alertRecipients`), `click
[data-sw=bc-send]`, then `navigate sapa-warga role warga focus <alertId>` showing the citizen phone receiving the zone
message · ID: "Peringatan dini terkirim ke {camat} dan {k} kepala desa; {w} warga di zona menerima pesan." · done:
active flood alert + broadcast audit row, recipient count = caption · T4: C30 price shock starts silently here
(shown in ch. 17).

**3 · 07:00 · Meja Pimpinan (28 s).** link meja-pimpinan role kepala-daerah · auto: `click [data-hotspot=briefing]`,
`click [data-mp=listen]` (the product reads the briefing), `aiRespond [data-tour=mp-ask]` "Desa mana paling berisiko?",
map flies to the answer · visitor: ask another question · ID: "Briefing pagi tersusun sendiri dari data semalam.
Pimpinan bertanya desa mana paling berisiko; jawabannya menunjuk {desa}, lengkap dengan sumbernya." · done:
`briefing.generated` today and an AI answer whose desa = `rainScenario` top desa.

**4 · 08:15 · Sapa Warga (30 s).** link sapa-warga role warga, then petugas · world `siti`, `neighbours` (story) ·
auto: `focus [data-hotspot=voice]` (Ibu Siti's voice note in the regional language, transcript appears), ticket chip,
`arrive <cluster id>` in the console (C1 cluster + `flood.confirmed`) · visitor: open the ticket, play the note ·
ID: "Ibu Siti Aminah mengirim pesan suara dalam bahasa daerah. Sapa Warga menerjemahkan, membuat tiket, dan
mengelompokkan {k} aduan banjir di sekitarnya." · done: Siti complaint exists, cluster with ≥ 5 complaints, ticket code
in caption = world.

**5 · 09:00 · Naskah Pintar (26 s).** link naskah-pintar · world `instruction` (Meja `instruction.issued` ⇒ C7 letter) ·
auto: `click [data-hotspot=np-play]` (the sample meeting plays, minutes + 6 follow-ups fill live), `focus` follow-ups,
`click [data-np=approve]` ⇒ dispositions to OPD · ID: "Rapat koordinasi berjalan; notulen dan enam tindak lanjut
tersusun saat rapat. Disposisi langsung masuk ke {opd1} dan {opd2}." · done: minutes approved, 6 follow-ups, ≥ 2
dispositions; letter from the instruction present.

**6 · 10:00 · Radar Isu (24 s).** link radar-isu (`?tab=live`, `focus <hoax id>`) · auto: the 10:00 rumor burst (natural,
§0.4) ⇒ `hoax.detected`; `click [data-hotspot=radar-start]`, `click [data-tour=ri-clarify]`, sentiment line recovers ·
ID: "Kabar 'bendungan jebol' menyebar cepat. Radar Isu menandainya hoaks, klarifikasi resmi terbit, dan sentimen
kembali naik dalam {m} menit." · done: hoax has a clarification; `sentimentSeries` last point > the dip.

**7 · 11:00 · Awas Belanja (26 s).** link awas-belanja `focus <flood pump package>` · auto: `click [data-ab=analyse]`,
`focus [data-ab=total-gap]` (HPS kemahalan), bidders tab with the affiliation edge, memo; world `recommend` (story ⇒
`procurement.recommended` inviteLocal ⇒ C11 need ⇒ C36 matches) · ID: "Paket darurat pompa air diperiksa: HPS
{gap}% di atas harga pasar dan dua peserta terafiliasi. Rekomendasinya: undang UMKM lokal." · done: package flagged,
`need.created` from the recommendation · T4: C36 matches (if KL is not READY the need still exists; ch. 8 posters).

**8 · 11:40 · Katalog Lokal (24 s) [T4].** link katalog-lokal role ukpbj `focus <flood needId>` · auto: `focus
[data-kl=match-board]` (lines light up, badged UMKM first), `click [data-kl=compare]`, `click [data-kl=order]` ⇒
`order.created` · ID: "Kebutuhan {qty} karung pasir dan terpal dicocokkan ke UMKM lokal yang sudah berlencana
Terverifikasi dan Pajak Rapi." · done: ≥ 3 `match.made` for the need, order created for the top match · poster: need +
match count + top business from `catalogShortlist`.

**9 · 12:00 · Kenal Mitra (22 s).** link kenal-mitra `?tab=kyb&focus=<facts.up.kenalMitra.heroRequestId>` · auto:
`click [data-km=start]`, `focus [data-km=map-check]`, `click [data-km=approve]` ⇒ `partner.verified`, `focus
[data-km=catalog-preview]` (badge appears) · ID: "UMKM baru milik Joko Prasetyo lolos verifikasi KYB: dokumen, lokasi,
dan pemilik cocok. Lencananya langsung muncul di Katalog Lokal." · done: business verified, `verifiedBusinesses` +1.

**10 · 12:30 · TenderPilot (24 s).** link tenderpilot `focus <emergency tenderId>` · auto: banner with probability,
`click [data-tp=tax-link]` (short bounce shown as caption only), `click [data-tp=compose]`, `click [data-tp=send]` ⇒
`bid.submitted` · ID: "Toko bangunan menerima notifikasi tender darurat. Skor peluang {p}%; dokumen penawaran tersusun
dan terkirim." · done: bid submitted; caption p = `tender.matches[shopId]` (78 on the Bojonegoro seed).

**11 · 13:00 · Toko Autopilot (24 s).** link toko-autopilot `?tab=prediksi&outlet=warung&focus=<productId>` · auto:
`focus [data-tour=flood-banner]`, `focus [data-tour=forecast-chart]` (+{x}%), `click [data-tour=po-approve]` ⇒
`po.sent`, `focus [data-tour=po-chat]` (supplier replies) · ID: "Prediksi permintaan {item} melonjak {x}% karena banjir.
PO otomatis dikirim ke pemasok, dan pemasok membalas dengan jadwal kirim." · done: `po.sent` + supplier reply.

**12 · 13:30 · Juara Jualan (20 s).** link juara-jualan · auto: `click [data-jj=score-now]`, `focus
[data-hotspot=jj-marker-danger]`, `click [data-jj=assign]` (coaching for the new cashier) · ID: "Percakapan penjualan
dinilai otomatis. Kasir baru mendapat coaching tepat pada momen yang terlewat." · done: a `callScore` row + assignment.

**13 · 14:00 · Pajak Beres (20 s).** link pajak-beres `focus <poId from ch. 11>` (cold: `pendingNotas[0]`) · auto:
`click [data-pb=process]` (nota → jurnal), `click [data-pb=ready]` ⇒ `tax.ready` · ID: "Nota pembelian stok tadi
berubah jadi jurnal yang seimbang. Status pajak bulan ini: siap." · done: ledger posted for the PO, `tax.ready`.

**14 · 14:30 · Rapor Usaha (24 s) [T4].** link rapor-usaha role pemilik-toko · auto: `focus [data-tour=ru-dial]`
(score rises from the fresh ledger/tax facts), `click [data-ru=fix]`, `click [data-ru=share]` (consent),
`click [data-ru=apply]`, `navigate rapor-usaha role bank-mitra`, `click [data-ru=approve]` · ID: "Skor usaha naik ke
{score} ({band}). Koperasi mitra melihat data yang dibagikan dan menyetujui modal kerja {plafon} (simulasi)." · done:
`score.updated`, loan approved (both sides) · poster: score + band + `loanOffer` plafon.

**15 · 15:00 · Pantau Merek (22 s).** link pantau-merek · auto: `focus [data-pm=cluster]` ("pengiriman lambat"),
`click [data-pm=select-alert-5]`, `click [data-pm=bulk-open]`, `click [data-pm=tone-empatik]`, `click
[data-pm=bulk-send]` · ID: "Keluhan 'pengiriman lambat' naik {x}%. Lima balasan empatik dikirim sekaligus, masing-masing
menyebut pesanan pelanggannya." · done: 5 replies sent; no duplicate sentence.

**16 · 15:30 · Cek Berkas (22 s).** link cek-berkas · auto: `click [data-tour=cb-bulk]`, `click [data-hotspot=cek-go]`
(50 files), `focus` the duplicate pairs · ID: "{n} berkas pendaftar bansos banjir diperiksa dalam hitungan detik;
{d} NIK ganda ditahan sebelum dana cair." · done: bulk batch processed, n = 50 and d = 3 from `bansosBatch` (spec
numbers; the caption reads the selector).

**17 · 16:00 · Sinyal Pasar (26 s) [T4].** link sinyal-pasar role disperindag `focus <PDN warning id>` · auto: `focus
[data-tour=sp-warning]` (warning from ch. 2's C30/C31), `focus [data-tour=sp-anomaly]` (C33), open drawer `focus
[data-tour=sp-outlook]`, `click [data-tour=sp-recommend]` ⇒ `market.operation` recommended → (auto-approval or Meja)
running ⇒ C34 forecast flattens · ID: "Harga {komoditas} di {pasar} mulai naik; peringatan dini sudah terbit lima hari
sebelum puncak. Operasi pasar direkomendasikan dan prakiraan puncaknya turun {y}%." · done: op running, shock `damp >
0` · poster: warning + `opSimulate` effect.

**18 · 16:30 · Indeks Ekonomi Daerah (24 s) [T4].** link indeks-ekonomi role bappeda `?tab=peta&focus=<kec>:<YYYY-MM>`
· auto: `focus [data-tour=ie-map]` (C35 flood dip on the kecamatan), `click` Play on `[data-tour=ie-scrubber]` (short),
`focus [data-tour=ie-impact]` (C34 program effect) · ID: "Banjir menurunkan indeks ekonomi {kec} sekitar {d} poin;
operasi pasar menahan penurunannya. Semua angka di bawah ambang anonimitas disembunyikan." · done: `econ.updated` kind
banjir and kind program present · poster: the two deltas.

**19 · 17:00 · Meja Pimpinan + GAMADA Inti (30 s) [T4].** link meja-pimpinan (day close: KPI strip, done tasks), then
`navigate inti focus <Siti complaint id>` · auto: `focus [data-tour=in-trail]`, `click [data-tour=in-trail-play]`
(story already ran ⇒ the trail renders and the 6 lanes light in order), `focus [data-tour=in-audit]` · ID: "Hari
ditutup di Meja Pimpinan. Inti menelusuri aduan Ibu Siti melintasi enam produk: dari pesan suara sampai pesanan ke UMKM
lokal." · done: `dataTrail(complaint).spine` 6/6 with audit ids · poster (Inti not READY): the 6 spine rows as a list
from `dataTrail`.

**20 · Ringkasan (25 s).** Summary screen (lazy): "Hari ini di {region}" with 6 count-ups from `tourSummary`,
constellation all lit, buttons "Bawa pulang ringkasan (PDF)" (opens `SummaryPaper` then `printPaper`; label says
"Simpan sebagai PDF lewat dialog cetak"), "Jadwalkan demo personal" (`waLink` with region + the product with the most
dwell time), "Coba sendiri" grid (READY demos, links carry `world=tour` so the visitor keeps this day), "Ulangi tur".
done: all 6 numbers > 0 and equal to the selectors.

Timing at 1×: opener 12 + chapters 26+24+28+30+26+24+26+24+22+24+24+20+20+24+22+22+26+24+30 = 466 + summary 25 ⇒
**503 s ≈ 8.4 min** (spec 7–9). At 1.5× ≈ 5.6 min, 0.75× ≈ 11 min.

---

## 3 · Layout and controls

**Desktop (≥ 1024):** left 38 % narration (chapter n/20, big clock, title Fraunces, body, "Yang terjadi", Ambil alih,
controls row, constellation 160 px at the bottom), right 62 % stage (`DemoShell mode="tour" layout="contained"`, its
own size from its width ⇒ md layout). Controls row: ⏮ prev · ⏯ play/pause · ⏭ next · speed (0,75× / 1× / 1,5×
segmented) · "Bab" (drawer) · presenter (P) · exit (✕ → opener). Progress: 20 segment bar, current segment fills with
transform: scaleX.

**Tablet (640–1023):** narration 40 % column collapses to a top band (title + controls) + body in a disclosure; stage
below.

**Phone (360–430):** stage fills the viewport above a **bottom sheet** (narration):
- three snaps: **peek** 120 px (n/20 · time · title one line · ⏯ · ⏭), **half** 50 dvh (body, bullets, Ambil alih,
  speed), **full** (chapter list). Drag on the handle (pointer events, transform only, velocity snap); the handle is
  also a 44 px button cycling peek → half → peek; `Esc` returns to peek.
- the stage's shell runs its `sm` layout; its toasts are placed `top` while the sheet is above peek (existing
  `setToastPlacement`); the Ambil alih button is in the sheet, never over the canvas.
- constellation becomes a chip "9/17 produk" in the peek row (opens the chapter list).
- during autoplay the sheet stays in peek so the product is visible; on pause it rises to half.

**Ambil alih (take over):** saves `{ chapter, rate }` to sessionStorage, navigates to
`/demo/<slug>?world=tour&from=tur-<n>&region=…&lang=…&role=<chapter role>&focus=<current arrive id>`; the sandbox is the
full product with the tour world at the current time. TopBar shows "Kembali ke tur" (K4) → `/tur/<n>?resume=1` →
player restarts chapter n paused at its first step without re-running its world steps (idempotent keys), then plays.
Cross-product toasts inside the sandbox keep `world=tour` (K2); "Kembali ke tur" still knows `from`.

**Presenter (`?present=1` or P):** fullscreen (`useFullscreen`), narration column narrower (30 %), cursor hides after
2 s idle (`useIdleCursor`), shortcuts Space ←/→ F B R; B = black overlay (opacity), R = restart chapter. Presenter
notes window (BroadcastChannel) deferred (owner Q4).

**Chapter drawer ("Pilih bab"):** 20 rows (number, time, title, product chips with eco accent, ✓ seen), arrow keys,
Enter = jump (runs `prepareThrough`), focus returns to the trigger. Also the content of `/tur/:bab` posters.

**Cold `/tur/:bab`:** poster = narration of that chapter + a still card + "Putar bab N" / "Mulai dari awal"; the product
chunk loads on intent of these buttons (`intentProps`) and on click. `/tur` without bab = opener.

---

## 4 · Size plan (gzip -9, beyond home, `VITE_DEMO_CONTROLS=1` build, MapLibre engine excluded)

| Load | Contents | Estimate | Rule |
|---|---|---|---|
| `/tur` first load (opener) | Tur route + `tour/` core (engine, store, chapters DSL, Opener, Player frame, Narration, Constellation, strings, css) ≈ 24 · narration current lang ≈ 5 · region loader + pack JSON ≈ 27 (pack 15.4) · kecamatan geometry for the outline ≈ 15 · world barrel/clock (needed for `useClock`) ≈ 20 | **≈ 91** | ≤ 175 target, 180 hard |
| `/tur/:bab` cold (poster) | as above (no product) | ≈ 91 | same |
| After "Mulai tur" / "Putar bab N" | the chapter product's own landing (Tahap 2–4 numbers, e.g. Siaga 158.9, Meja 173.2) minus what the tour already loaded + `world-steps` + story ≈ 10 | reported | the tour adds ≤ 12 KB on top of a product's own landing |
| Summary | Summary + count-up ≈ 6; SummaryPaper on click ≈ 5 | reported | — |
| Next chapter | preloaded product chunk while the current chapter plays | reported | — |

Rules: never import a product module, `world/satu-daerah`, `world/usaha-pintar`, `world/inti`, `world/story`, the ai
barrel or the map kit at the top of `tour/` (all through `import()` inside steps / Stage). If the opener outline costs
> 15 KB, use a pre-simplified outline from the pack (`pack.outline` if present) or a plain kecamatan dot cloud from
centroids. Home JS ≤ 253.6 (the tour route is lazy; `content/tour.ts` already exists in site chunks).

---

## 5 · Tests (`tests/e2e/tahap5/tour.spec.ts`, builder; `@playwright/test`, channel chrome, base URL from fixtures)
1. **Autoplay** `/tur?e2e=1&rate=8` → Mulai tur → reaches the summary at 1440×900 and 390×844, no console error, every
   `chapter.done` true (engine exposes `__gamadaTour = { state, fallbacks, doneLog }`), fallbacks = 0 for READY products.
2. **Cold chapters** loop N = 1…19: `/tur/N?e2e=1&rate=8` → Putar bab N → `done` true; N = 20 → summary numbers > 0.
3. **Numbers agree:** ch. 10 caption % = `__gamada.world` `tender.matches[shopId]`; ch. 16 50/3 = `bansosBatch`;
   summary 6 numbers = `tourSummary` recomputed in the page; PDF paper text = summary text.
4. **Ambil alih round trip** ch. 4 and ch. 11: URL has `world=tour&from=tur-N&focus=…`, entity flashed, "Kembali ke
   tur" → `/tur/N?resume=1`, chapter N resumes; a cross-product toast click inside keeps `world=tour`.
5. **Isolation:** open `/demo/sapa-warga`, act once, run ch. 1–4, reopen `/demo/sapa-warga` ⇒ the visitor world is
   unchanged (audit count and clock equal).
6. **Determinism:** two autoplays ⇒ identical audit fingerprint at ch. 19 (`auditQuery` types + entity ids).
7. **Controls / keyboard:** Space, ←/→, L, P, F, B, R, speed segmented changes `rate`, drawer jump, exit; pointerdown in
   the stage pauses and shows "Lanjutkan tur".
8. **Phone:** 360/390/430: `scrollWidth ≤ innerWidth`, every control ≥ 44 px, sheet snaps (drag + button), toasts not
   covered, Ambil alih reachable.
9. **Motion:** `emulateMedia({ reducedMotion: 'reduce' })` and `?off=tourCinematics`: autoplay still completes;
   paused tour ⇒ 0 tour ticker listeners.
10. **Degrade:** `?e2e=1&tourDegrade=sinyal-pasar` (and `inti`): poster renders numbers, Ambil alih disabled with the
    reason, tour continues.
11. **Region:** `?region=<second pack>` when present: opener title has the pack name; ch. 1–3 run.
12. **Language:** EN autoplay ch. 1–5: no ID string in the narration (word list check), title "A Day in {region}".
13. **axe** on opener, ch. 7 (desktop, phone) and summary: no serious/critical.
14. **Unit (node):** sum of durations 420–540 s; every chapter has narration ID+EN ≤ 60 words; placeholders all filled
    for the Bojonegoro world; every selector in `chapters.ts` exists in `src/demos` (hook audit).
Integrator: add `/tur` to `npm run perf` targets (spec §14), budget table, screenshots `docs/shots/demo/tahap5/`
(opener, ch. 1, 4, 8, 11, 17, 19, summary, PDF page 1 at 1440 and 390).

---

## 6 · Owner questions: ALL APPROVED by the owner on 2026-11-19 ("oke semua"); use the defaults exactly as written below

**P1 · Dunia tur terpisah.** Tur memakai dunia demonya sendiri (mulai bersih pukul 06:00 setiap "Mulai tur"), jadi
apa pun yang pengunjung lakukan di sandbox biasa tidak terhapus oleh tur. "Ambil alih" membuka produk di dunia tur
(state saat itu); "Coba sendiri" di ringkasan juga melanjutkan hari tur. **Default: ya.**

**P2 · PDF lewat dialog cetak.** "Bawa pulang ringkasan (PDF)" membuka laporan 2 halaman bertema terang lalu dialog
cetak browser ("Simpan sebagai PDF"); tanpa pustaka PDF baru, label tombol menjelaskannya. **Default: ya.**

**P3 · Jam tur.** Tur mengikuti jam bab spek: banjir terjadi 06:20 di tur (di sandbox biasa 07:06), dan peristiwa
alami dunia (isu 10:00, pergerakan harga, penjualan toko) tetap berjalan agar hari terasa hidup. Bila pemeriksaan
determinisme gagal, peristiwa alami dimatikan di tur dan tiap bab memicu sendiri yang ia perlukan. **Default: ya.**

**P4 · Catatan presenter di jendela kedua ditunda.** Mode presenter (layar penuh, kursor tersembunyi, Spasi ←/→ F B R)
dibangun sekarang; jendela catatan presenter (BroadcastChannel, "opsional" di spek) ditunda ke Tahap 7. **Default: ya.**

**P5 · `/tur` layar penuh.** `/tur` dan `/tur/:bab` tampil tanpa navbar/footer situs seperti `/demo`; daftar bab tetap
ada di pembuka ("Pilih bab") dan laci bab; tombol ✕ kembali ke beranda. **Default: ya.**

---

## 7 · §12 coverage and deliberate deferrals

| Spec §12 item | Where |
|---|---|
| Route `/tur`, cinematic opener (dusk, Fraunces title, region map from the fog, clock to 06:00) | §1.2 Opener, §2 opener |
| "Mulai tur (±8 menit)" + "Pilih bab" | Opener, ChapterDrawer |
| Desktop 38 % narration (n, big clock, title, ≤ 60 words, "Yang terjadi") / 62 % live canvas | §3, Narration, Stage |
| Mobile draggable bottom sheet | §3 phone |
| Play/Pause, ←/→, speed 0,75/1/1,5, chapter drawer | §3 controls, engine `setRate` |
| "Ambil alih" with current state + "Kembali ke tur" resumes the same chapter | §3, K1–K4 |
| Presenter `?present=1` / P: fullscreen, idle cursor, Space ←/→ F B R | §3 presenter |
| Presenter notes window (BroadcastChannel, optional) | **deferred to Tahap 7** (P4) |
| Constellation corner, dots light per product, all lit at the end | Constellation, ch. 20 |
| Transitions: map fly / fog curtain / clock spin | §2.0, `mapFly`, curtain, `setClock({ spin })` |
| Summary: 6 numbers with count-up, PDF 2 pages light with logo/region/products, WA prefill with region + most-viewed product, "Coba sendiri" grid | ch. 20, `tourSummary`, SummaryPaper, `waLink` |
| DSL in `src/demo-kit/tour/chapters.ts`, steps setClock/emit/navigate/focus/type/click/aiRespond/mapFly/wait/toast/caption | §1.2 (+ arrive, story, await) |
| 20 chapters with spec times and products | §2 (titles and order = `content/tour.ts`) |
| Every chapter runs the real product (Ambil alih always possible) | Stage + URL handoff; poster mode only for a non-READY product |
| Deterministic (fixed seed, simulated AI) | §0.4, K6, test 6 |
| Total 7–9 min at 1× | ≈ 8.4 min (§2), unit test |
| §15 test 1: autoplay 20 chapters, no console error, 1440 and 390 | test 1 |
| §14 perf target for `/tur` | integrator adds to `npm run perf` |

Deferred on purpose:
- Presenter notes window (P4) and the wow audit with 4 skeptical buyer agents (owner speed preference; polish in
  Tahap 7 together with the other deferred scores).
- Bandung / Padang playthrough beyond "no crash, names from the pack" (Tahap 7 packs).
- Site entry points to the tour ("Mulai tur dari bab X" on `/ekosistem/:eco`, "Lihat di tur" on `/produk/:slug`):
  Tahap 6 (they already link to `/tur/:bab`, which keeps working).
- Narration voice-over (spec does not ask for it; Meja Pimpinan reads its own briefing in ch. 3).
- A real PDF file generator (P2: browser print to PDF).

Tahap-4 dependency summary: ch. 8 (Katalog Lokal), 14 (Rapor Usaha), 17 (Sinyal Pasar), 18 (Indeks Ekonomi), 19 (Inti)
need the Tahap-4 products; ch. 2, 7, 17, 18, 19 need Tahap-4 kit pieces (`world/story.ts`, C30–C38, `world/inti`). A
non-READY product ⇒ poster mode with the same world steps and numbers. A missing kit piece (story/chains) is a blocker
for the tour build, not a degrade: the builder stops and reports.
