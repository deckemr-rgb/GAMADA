# Tahap 2 · Satu Daerah (7 products): build plan and briefs

Written by the tahap-2 prep agent (kit owner for this step) on 2026-11-17. Seven product builders work in parallel
from here. **You own only `src/demos/<slug>/**` and `server/ai-proxy/prompts/<slug>.ts`.** Everything else the flows need
is already in the kit; if something is truly missing, work around it inside your folder and say so in your report
(`kitHandoff`), never edit the kit.

Read first (in this order):
1. Spec `docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` §6, §8, §9, your product in §11, §14, §15.
2. Kit contracts `src/demo-kit/CONTRACTS.md` (all of it, including the **Tahap 2** section at the end).
3. This file: §0 rules, §1 kit APIs, your brief in §2, the chains in §3, the do-not-touch list in §4.
4. Visual direction C "Data-dense tenang": `docs/design/ARAH-VISUAL-TAHAP0.md` (sections 1 and 5) and the look of
   `/lab/_kit` (tokens `--dk-*`, components in `demo-kit/ui`, charts in `demo-kit/viz`).

---

## 0 · Rules for every builder

**Product**
- Data: the world is simulated and deterministic. People, companies, media, accounts, vendors, banks are FICTIONAL;
  officials by title only ("Bupati", "Camat Kalitidu", "Kepala BPBD"). Real: region geography, place names, OSM,
  Kemendagri codes. Any number that could pass for official (statistics, prices, harvest, water level, population
  affected, shelter capacity) carries a "simulasi" / "simulated" label next to it (ChartFrame already prints
  "Data simulasi · seed N").
- Bahasa Indonesia and English are both first-class: every visible string is `{ id, en }` and follows `useI18n().lang`.
  Module-local strings live in your folder (e.g. `strings.ts`); shared demo strings come from `useDemoStrings()`.
- No dead controls: every visible control changes something real (world event, view, export, dialog). Out of scope ⇒
  not rendered.
- Every flow step in spec §11 for your product works; every mission can be completed by a script.

**Performance and motion**
- Budget: ≤ 180 KB gzip beyond home per demo, INCLUDING fetched JSON, excluding only the MapLibre engine + worker.
  Kit floors (measured today, §5): non-map live demo ≈ 99 KB, map demo ≈ 125–130 KB. Your allowance is in your brief.
  Lazy-load secondary tabs and heavy features with `lazy(() => import('./Tab'))`; code fetched only after a user action
  is reported separately (still keep it lean).
- INP ≤ 200 ms. Animate transform / opacity only (stroke-dashoffset for chart draws), one RAF loop (`gsap.ticker`,
  the kit's `animatePose` / viz helpers), respect `prefers-reduced-motion`, `?off=demoAnimations`, `?static=1`
  (`motionMode()` from `demo-kit/ui`). No backdrop-filter, no animated blur, no mix-blend on large elements. Pause loops
  off-screen / tab hidden. Clean up listeners, tickers, GSAP contexts on unmount.

**Accessibility and mobile**
- Keyboard everywhere (logical tab order, `Esc` closes drawers/modals, arrows in grids/kanban), visible focus ring,
  `aria-live="polite"` for new events and AI answers, labelled icon buttons, AA contrast, 44 px targets below 768 px.
- 360–430 px fully usable: split views become tabs (SplitStage does it), wide tables become cards (`Table` does it below
  640 px), maps keep standard gestures. Below 640 px the shell canvas owns the 16 px gutter: add no side padding.

**Process**
- No git commit/push/stash/reset/checkout. Do not edit `src-art/`.
- Dev server: `http://127.0.0.1:5173` (already running, hot reload; never start another one on 5173).
  Open your product with **`/demo/<slug>?controls=all`** (full live shell before DEMO_READY is flipped). Add
  `&e2e=1` to get `window.__gamada = { world, emit, settled, onEvent, clock }` in the console.
- Own builds only: `npx vite build --outDir .shots/t2-<slug>/dist --emptyOutDir` (add `VITE_DEMO_CONTROLS=1` in the
  environment so `?controls=all` works in your build). Scratch files under `.shots/t2-<slug>/`.
- Do NOT run `npm run test:e2e` (the integrator does). Drive the browser with your own Playwright scripts
  (`@playwright/test`, `channel: 'chrome'`). Typecheck: `npx tsc --noEmit 2>&1 | grep "src/demos/<slug>"`.
- Budget check: `node .shots/t2-prep/budget.mjs <port> <dist>` after `npx vite preview --outDir <dist> --port <port>`
  (edit the route list at the top for your slug), or copy it.
- Do NOT flip `DEMO_READY` (integrator). Do not touch other products' folders.

---

## 1 · Kit APIs for tahap 2 (import paths are relative to `src/demos/<slug>/`)

### 1.1 Module contract
```tsx
// src/demos/<slug>/index.tsx  (replace the stub)
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
export default function Canvas({ product }: DemoCanvasProps) { … }
export const missions: readonly Mission[] = [ … ]                    // optional, 3–6
export const hotspot = { target: '[data-hotspot=…]', label: { id: '…', en: '…' } } // optional, one per screen
export const splitTabs = { left: <Phone />, right: <Console />, labels: [{…}, {…}] } // optional (P1)
```
- `routes/Demo.tsx` loads your module once and passes `missions` / `hotspot` / `splitTabs` to `DemoShell`.
- If your split needs shared React state or a controlled mobile tab, render `SplitStage` yourself inside the canvas
  instead: `import { SplitStage } from '../../demo-kit/shell/SplitStage'` (props `left`, `right`, `labels`, `ratio`,
  `tab`, `onTabChange`).
- `useShell()` (`../../demo-kit/shell`): `pack`, `focus` (+ `clearFocus`) for `?focus=<entityId>` arrivals from
  cross-product toasts, `markMission(id)` for UI-only steps, `toast(…)`, `size` ('sm' = phone layout), `present`.
- Missions: `done(e, s)` auto-ticks on world events; use the guard `isEvent(e, 'complaint.created')` from
  `../../demo-kit/world` to narrow the payload. UI-only steps call `useShell().markMission(id)`. Any `hint` pointing at
  the top bar needs a `hintSm` (phones: the controls sit in the ⋯ sheet).

### 1.2 World (`../../demo-kit/world` barrel + `../../demo-kit/world/satu-daerah`)
- Barrel: `useWorld(selector, isEqual?)`, `emit(type, payload, source)` (**source = your slug** for anything the user
  did), `onEvent`, `settled`, `useClock`, `clock`, `useSession`, `rows`, `get`, `hhmm`, `fmtRp`, `ref`, `isEvent`,
  `CATEGORY_LABEL`, `WORLD`, shared selectors (`complaintKpi`, `ticketsByStatus`, `slaOnTimePct`, `avgRating`,
  `openClusters`, `activeAlerts`, `negativeIssues`, `overdueActions`, `serviceIndex`, `instructionSuggestions`,
  `auditFor`, `latestAudit`), all types.
- `world/satu-daerah` (import directly; not in the barrel, so other ecosystems never pay for it). Memoised (safe in
  `useWorld`, pass `shallowEqual` for objects): `personas`, `citizenInbox(s, citizenId)`, `consoleTickets(s, now)`,
  `kpiStrip(s, now)`, `opdLeaderboard(s, now)`, `letterInbox`, `actionBoard(s, now)`, `mentionsByHour(s, now, hours?)`,
  `sentimentSeries(s, now, hours?)`, `topicClusters(s, now, hours?)`, `facilitiesOf(s, 'rs,pengungsian')`,
  `harvestValues(s, metric, crop?)`, `packages`, `bansosBatch(s, zone?)`. Plain functions (call on an action or in
  `useMemo` keyed on the tables they read): `duplicateCandidates`, `opdScorecard`, `complaintsByKecamatan`,
  `briefingItems`, `instructionIdeas`, `mentionStream`, `hoaxBurst`, `rumorSpread`, `floodScenarioAlert`, `rainScenario`,
  `alertRecipients`, `zoneCitizens`, `confirmedComplaints`, `affiliationEdges`, `hpsVsMarket`, `analyzeProcurement`,
  `localBenchmarks`, `bansosCsv`, `clusterDetail`, `DIRECT_PROCUREMENT_CEILING`.
- Seed you can rely on (`s.meta.facts`, `s.meta.personas`):
  - personas: Ibu **Siti Aminah** (P, 52, Basa Jawa, lives in the hot desa of the first flood kecamatan), **Raka Pratama**
    (L, 24, Indonesian, town kecamatan), **Pak Darmo Sutrisno** (L, 71, Basa Jawa, outside the flood zone);
  - complaints/tickets (140, 14 today; 3 overnight flood reports near Siti's desa, i.e. below the cluster rule so the
    demo forms the cluster live), MPP bookings, 24 letters (6 new `status: 'masuk'`, ~40 % `scanned: true` = crooked
    scan), 8 meetings (today 09:00 and 13:30 not transcribed) with action items, 160 mentions;
  - 50 flood-aid applicant KTP specimens (`program: 'bansos-banjir'`) with **exactly 3 NIK-sharing pairs**
    (`facts.bansosDuplicatePairs`) and `facts.bansosOutsideZone` addresses outside the scenario flood kecamatan; one
    digitally edited specimen (`facts.tamperedDocumentId`);
  - 36 fictional bidders incl. the affiliated "pompa" ring (`facts.pumpRingBidderIds`: shared director, address, IP,
    rotating wins in 3 past BPBD packages), 2 split packages just under `DIRECT_PROCUREMENT_CEILING`, the "Pengadaan
    Pompa Air Darurat" package created by `flood.alert` (bids within 0.5 %, brand-locked spec, 3-day schedule, HPS ≈ 44 %
    above market);
  - facilities: real hospitals, puskesmas, schools, offices, dams from the pack + **simulated** shelters ("Posko
    pengungsian Balai Desa …", `origin: 'simulasi'`) that fill after a flood alert;
  - harvest estimates per kecamatan × crop (padi, jagung, cabai, bawang merah; simulated), water gauges at the real
    dam of the hoax scenario and the flood river (simulated readings, 24 h history).
- Recipients: `alertRecipients(s, kecamatanIds, { desaIds?, pack })` returns Camat per kecamatan + Kepala Desa / Lurah
  per real desa (titles only, fictional masked numbers).

### 1.3 Shell
- Cross-product toasts are automatic (one per root event, listing every product it reached). Your job: emit with
  `source = your slug`. Arrivals: `useShell().focus` holds the entity id the toast pointed at (open it, then
  `clearFocus()`).
- The 10:00 rumor burst is a background ('clock') root: on the Radar Isu page the shell still announces "… diteruskan ke
  Meja Pimpinan". Meja Pimpinan itself shows hoaxes through its own `onEvent('hoax.detected', …)` (no self-toast from
  the shell).

### 1.4 Map (`../../demo-kit/map`)
`MapView` (+ `MapViewHandle`: `flyTo`, `fitRegion`, `fitKecamatan`, `setLayerVisible`, `highlight`, `setTime`,
`loadDesa`, `floodImpact`), `LayerToggle`, `MapLegend`, `TimeScrubber`, `KecamatanList`, layer kinds `kecamatan`,
`desa`, `rivers`, `roads`, `hazard`, `choropleth`, `heat`, `markers`, `flood`, `rain` and new in tahap 2 **`zones`**
(alert / warning areas: `{ id, kind: 'zones', zones: alertZones(activeAlerts) }`) and **`imagery`** (satellite; tiles
load only once visible; attribution shown in Sumber). Helpers: `landmarkMarkers`, `marketMarkers`, `pointMarkers`,
`heatPoints`, `countByKecamatan`, `perThousandKK`, `belowThreshold`, `choropleth`, **`facilityMarkers`**,
**`alertZones`**, `defaultRainField`. Rain cells from the world: `rain` layer `cells` = `rows(s.rainCells)`.
MapLibre is excluded from the budget; desa.min.json (≈ 22 KB) is fetched only on a desa trigger.

### 1.5 AI (`../../demo-kit/ai/chat` — never the `ai` barrel)
- `useAiChat(product, { getContext, onEmits, … })`, `registerScenario(scenario)` at module load (your
  `scenario.ts`, simulation DSL in `ai/types.ts`: intents with ID/EN/regional examples, `respond(ctx, slots)` reading
  `ctx.world` numbers, `structured`, `followUps`, `emits`), `prepare()` on input focus,
  `registerStructuredSchema(kind, { safeParse })` for a product-owned kind.
- Live tools per product live in `server/ai-proxy/prompts/<slug>.ts` (`tools: [...]` from the shared registry; or your
  own `customTools: [productTool('<slug>', 'name', z.object(…), 'desc')]` + `customMocks`). The proxy loads them; you
  edit only your prompt file. Run `npm run ai:test` after editing it.
- Structured kinds available (shared): ticket, checklist, query, instruction, minutes, classification, disposition,
  sentiment, clarification, alert, risk, doc-check, po, ledger, score, kyc, clusters, reply, win-score, need-spec,
  business-score, insight, price-alert, plan, **service, booking, ticket-status, briefing, analysis, audit-memo,
  reminder** (new).
- Docs/media kits: `../../demo-kit/docs` (DocViewer, ExtractPanel, TamperHeatmap, DispositionStamp, samples: letters,
  KTP/KK/NIB/domisili/foto rumah incl. `-edit` tampered specimens, `simulateExtract`), `../../demo-kit/media`
  (VoiceRecorder, Waveform, AudioPlayer, SpeakButton/useSpeakText, `MEETING_BANJIR` + `MEETING_BANJIR_NOTES`,
  `VOICE_NOTES`, `voiceNoteFromTemplate`, TTS/STT helpers). Frames: `../../demo-kit/frames` (BrowserFrame, PhoneFrame,
  TabletFrame, WallScreenFrame, PaperFrame).

---

## 2 · Product briefs

Common to all: replace `src/demos/<slug>/index.tsx` (the stub), keep files small and split per tab/screen, put
strings in `strings.ts`, the sim scenario in `scenario.ts` (registered on import of the chat surface, not of the
page), CSS with prefix `dk-<short>-` using `--dk-*` tokens and the `[data-eco="satu-daerah"]` accent.

### P1 · Sapa Warga — `src/demos/sapa-warga/` · prompt `prompts/sapa-warga.ts`
- **Layout:** split 40/60, `PhoneFrame` "HP Warga" | `BrowserFrame` "Konsol Petugas" (export `splitTabs` or render
  `SplitStage`; tabs below 768 px, switch to the console tab after "Kirim" on phones via controlled `tab`).
- **Files (suggested):** `index.tsx`, `Phone.tsx` (persona picker, chat, voice note, attachments, cards),
  `Console.tsx` (inbox + kanban), `TicketDetail.tsx` (lazy), `ClusterPanel.tsx` (lazy, mini map), `scenario.ts`
  (≥ 25 intents incl. all of spec §11 P1 + fallback "teruskan ke petugas"), `strings.ts`, `sapa-warga.css`.
- **Kit:** `personas`, `citizenInbox(s, citizenId)` (messages + complaints + bookings for the phone), `consoleTickets`,
  `ticketsByStatus`, `duplicateCandidates`, `openClusters`, `clusterDetail`; ui `Kanban`, `Inbox`, `Chip`,
  `StatusChip`, `SlaLabel`, `formatSla`; media `VoiceRecorder`, `Waveform`, `SpeakButton`, `VOICE_NOTES` /
  `voiceNoteFromTemplate`; docs samples for photo attachments; `pack.services` for checklists; map `MapView` +
  `pointMarkers` / `heatPoints` only inside the lazy detail / cluster panel.
- **Emit:** `complaint.created` (ids come back synchronously from `emit`), `service.booked` (with `citizenId`),
  `ticket.statusChanged` (verify → `diverifikasi`, forward → `diteruskan` with `opdId`, done → `selesai` with
  `rating`). The world does the rest: `complaint.clustered` at ≥ 5 similar flood reports within 1 km (toast "Klaster
  aduan diteruskan ke Meja Pimpinan, Siaga Wilayah & Radar Isu"), `citizen.notified` for every status change / queue.
- **Consume:** `citizen.notified` (render `citizenInbox(...).messages` in the chat: kind `tiket`, `antrean`,
  `peringatan` from Siaga Wilayah broadcasts), `ticket.statusChanged`. Ibu Siti lives in the flood zone, so a Siaga
  Wilayah broadcast lands on her phone.
- **Missions:** 1 Tanya syarat NIB (markMission when the checklist card renders) · 2 Kirim voice note
  (`isEvent(e,'complaint.created') && e.payload.channel === 'voice'`) · 3 Laporkan banjir (`complaint.created` banjir,
  source sapa-warga) · 4 Teruskan tiket ke OPD (`ticket.statusChanged` `diteruskan`) · 5 Selesaikan + rating
  (`ticket.statusChanged` `selesai` with `rating`).
- **Pass checks to self-verify:** sample voice note → ticket in console ≤ 2 s; console status change → phone updated
  ≤ 1 s; 5 similar reports → cluster toast + map point.
- **AI Live:** tools `create_ticket`, `service_checklist`, `lookup_service`, `book_queue`, `ticket_status` (already in
  the prompt file; adjust wording only).
- **Budget:** initial ≤ 75 KB own (non-map floor ≈ 99 KB). MapView, ticket detail, cluster panel, media recorder load
  after an action.
- **Mobile:** tabs "HP Warga" | "Konsol Petugas"; kanban scrolls horizontally per column with 44 px targets; ticket
  detail as a full-height Drawer.

### P2 · Meja Pimpinan — `src/demos/meja-pimpinan/` · prompt `prompts/meja-pimpinan.ts`
- **Layout:** `WallScreenFrame` grid 12: KPI strip (6), map centre, "Briefing Pagi" right, bottom OPD leaderboard +
  timeline + "Tanya data"; button "Lihat di HP" opens a `PhoneFrame` with the briefing as chat.
- **Files:** `index.tsx`, `Kpis.tsx`, `MapPanel.tsx`, `Briefing.tsx`, `Leaderboard.tsx`, `Scorecard.tsx` (lazy),
  `AskData.tsx` (lazy chat), `MeetingMode.tsx` (lazy), `PhoneBriefing.tsx` (lazy), `scenario.ts` (≥ 10 data intents:
  trend, compare, rank, cause, simple forecast), `strings.ts`.
- **Kit:** `kpiStrip(s, now)` (use `shallowEqual`), `briefingItems(s, now)` (≥ 6 items, each `{ title, detail, source,
  refs, focus }` from 6+ products: Sapa Warga, Siaga Wilayah, Radar Isu, Awas Belanja, Sinyal Pasar, Naskah Pintar,
  Cek Berkas when open), `instructionIdeas(s, now)`, `opdLeaderboard`, `opdScorecard`, `complaintsByKecamatan`
  (answers + map fly-to), `latestAudit` (timeline), `instructionSuggestions` (market operations), map `choropleth`,
  `heatPoints`, `zones` + `alertZones`, `marketMarkers`; viz `Kpi`, `Sparkline`, `BarChart`, `LineChart`;
  media `SpeakButton` / `speak` for "Dengarkan briefing" (highlight the item being read).
- **Emit:** `briefing.generated` (`items: briefingItems(...).map(({ title, source, refs }) => ({ title, source, refs }))`),
  `instruction.issued` (`{ text, opdIds, refs }`; with `origin: 'marketOps:<id>'` when accepting a market-operation
  suggestion). World: `instruction.issued` ⇒ `letter.dispositioned` + one `actionItem.created` per OPD (Naskah Pintar),
  toast "Instruksi pimpinan diteruskan ke Naskah Pintar".
- **Consume:** almost every Satu Daerah event + `price.anomaly`, `econ.updated`, `market.operation`, `hoax.detected`
  (show your own in-canvas alert: `onEvent('hoax.detected', …)`), `complaint.clustered`, `flood.alert`,
  `procurement.flagged`, `supply.signal`.
- **Missions:** Susun briefing (`briefing.generated`) · Dengarkan 1 butir (markMission) · Ajukan 1 pertanyaan data
  (markMission on answer) · Beri 1 instruksi (`instruction.issued` source meja-pimpinan) · Buka mode rapat (markMission).
- **Pass checks:** briefing ≥ 6 items each linked to correct world data (refs point at entities); instruction visible
  in Naskah Pintar ≤ 1 s.
- **AI Live:** `query_world`, `issue_instruction`, `compose_briefing`.
- **Budget:** map floor ≈ 125–130 KB ⇒ initial ≤ 45 KB own; chat, scorecard, meeting mode, phone view lazy.
- **Mobile:** KPI cards 2-up, map 60vh, briefing and leaderboard as tabs below; meeting mode disabled below 768 px
  (do not render the button there).

### P3 · Naskah Pintar — `src/demos/naskah-pintar/` · prompt `prompts/naskah-pintar.ts`
- **Layout:** `BrowserFrame` with tabs Rapat | Surat Masuk | Tindak Lanjut; documents in `PaperFrame` (print).
- **Files:** `index.tsx`, `Meeting.tsx`, `Minutes.tsx`, `OfficialMinutes.tsx` (lazy, PaperFrame), `Letters.tsx` (lazy
  tab), `FollowUps.tsx` (lazy tab), `strings.ts`.
- **Kit:** media `MEETING_BANJIR` (speaker-labelled clip, click a line to seek) + `MEETING_BANJIR_NOTES` (decisions and
  6 action items with PIC + due) + `usePlayback` / `AudioPlayer` / `createRecognizer` (live recording); today's
  meeting = `rows(s.meetings).find((m) => m.at >= 0 && !m.transcribed)`; `letterInbox` (scanned flag → crooked look
  via docs `DocViewer` letter samples), docs `DispositionStamp`; `actionBoard(s, now)` (kanban per OPD, `late` flag);
  ui `Kanban`, `Tabs`, `Table`.
- **Emit:** `meeting.transcribed` (`{ meetingId, summary, durationMin }`), `actionItem.created` (`source: { kind:
  'meeting', id: meetingId }`, ≥ 5 with `pic` + `dueAt`), `letter.dispositioned` (`{ letterId, to: opdIds, note,
  by }`), `actionItem.reminded` ("Kirim pengingat", WA preview), `actionItem.statusChanged` (kanban moves).
- **Consume:** `instruction.issued` → its disposition letter (`letters` with `instructionId`, kind `nota-dinas`) and its
  action items (`source.kind === 'instruction'`) appear in Surat Masuk / Tindak Lanjut; show the new row with the kit's
  new-row highlight.
- **Missions:** Putar rapat contoh (`meeting.transcribed`) · Ekspor notulen resmi (markMission on print/PDF) ·
  Disposisikan 1 surat (`letter.dispositioned` source naskah-pintar) · Kirim 1 pengingat (`actionItem.reminded`).
- **Pass checks:** sample meeting ⇒ ≥ 5 action items with PIC and due date; Meja Pimpinan instruction appears as a
  disposition.
- **AI Live:** `extract_minutes`, `classify_letter`, `draft_disposition`, `draft_reminder` (tier smart).
- **Budget:** ≤ 75 KB own initial (non-map); letters and follow-ups tabs + PaperFrame lazy.
- **Mobile:** tabs stay; transcript and minutes stack (transcript collapsible); kanban → list per OPD.

### P4 · Radar Isu — `src/demos/radar-isu/` · prompt `prompts/radar-isu.ts`
- **Layout:** `BrowserFrame` tabs Pantauan Live | Analisis Mendalam (`?tab=analisis` is the /tools/scrappulse redirect:
  honour it) | Laporan.
- **Files:** `index.tsx`, `Live.tsx` (stream, bubbles, 24 h sentiment, hoax card), `HoaxCard.tsx`, `Clarify.tsx`
  (lazy), `Deep.tsx` (lazy tab), `Report.tsx` (lazy tab, PaperFrame), `export.ts` (lazy: JSON + XLSX; no new
  dependency — write a minimal store-only XLSX zip, or SpreadsheetML if the owner agrees), `scenario.ts` (≥ 10 intents),
  `strings.ts`.
- **Kit:** `mentionStream(s, now)`, `topicClusters(s, now)` (viz `BubbleChart`), `sentimentSeries` / `mentionsByHour`
  (viz `LineChart`/`AreaChart`), `hoaxBurst(s, at)` for "Picu skenario", `rumorSpread` (small exponential chart),
  `rows(s.hoaxAlerts)` (claim, score, spreadPerHour, accounts, evidence quoting the Siaga Wilayah gauge),
  `s.gauges.byId[s.meta.facts.hoax.gaugeId]` (evidence chart, simulated).
- **Emit:** "Picu skenario" ⇒ emit every `hoaxBurst(s, now)` payload as `mention.created` with source radar-isu (the
  world raises ONE `hoax.detected` on the 6th post ⇒ toast "Temuan hoaks diteruskan ke Meja Pimpinan"). At 10:00 the
  clock fires the same burst by itself if nobody did. "Terbitkan" ⇒ `clarification.published` (`{ hoaxId, tone,
  channels }`) ⇒ 5 positive mentions over the next 30 world minutes (sentiment line recovers as the clock runs; to show
  it instantly, also offer "Lihat 30 menit ke depan", i.e. `clock.setTime(now + 30)`).
- **Consume:** `flood.alert` (a news mention, topic banjir), `complaint.clustered` (a social mention, topic banjir),
  `mention.created` (live stream), `hoax.detected`.
- **Missions:** Buka klaster topik terbesar (markMission) · Tangani hoaks bendungan (`clarification.published`) ·
  Analisis Mendalam 2 kata kunci (markMission) · Ekspor laporan (markMission on download).
- **Pass checks:** hoax ⇒ toast to Meja Pimpinan; clarification changes the sentiment line; XLSX + JSON download with
  valid content.
- **AI Live:** `assess_mention`, `draft_clarification`, `analyze_topic`.
- **Budget:** ≤ 75 KB own initial; Deep, Report, Clarify, export lazy.
- **Mobile:** stream first, bubbles + chart below, hoax card pinned on top when active; tabs scroll horizontally.

### P5 · Siaga Wilayah — `src/demos/siaga-wilayah/` · prompt `prompts/siaga-wilayah.ts`
- **Layout:** full map in a wide `BrowserFrame`, collapsible left panel (tabs Peringatan | Prediksi | Pertanian |
  Lingkungan), `TimeScrubber` at the bottom.
- **Files:** `index.tsx`, `MapStage.tsx`, `Alerts.tsx`, `Forecast.tsx`, `Agriculture.tsx` (lazy tab),
  `Environment.tsx` (lazy tab), `Broadcast.tsx` (lazy dialog), `strings.ts`.
- **Kit:** layers `kecamatan`, `desa`, `rivers`, `hazard`, `rain` (cells from `rows(s.rainCells)` after emitting
  `rainScenario(s)`), `flood` + handle `setTime(h)` / `floodImpact(h)` / `loadDesa()`, `zones` (`alertZones(...)`),
  `markers` (`facilityMarkers(facilitiesOf(s, 'rs,puskesmas,sekolah,pengungsian'), lang)`, flood complaints with
  `pointMarkers`, badge "Terkonfirmasi warga" from `confirmedComplaints(s, alert)` / `alert.confirmedBy`),
  `imagery` (satellite toggle), `choropleth` (`harvestValues(s, 'change' | 'estimate' | 'ndvi', crop?)`);
  `alertRecipients(s, kecIds, { desaIds, pack })`, `zoneCitizens`, `floodScenarioAlert(s, now, { level, kecamatanIds,
  desaIds })`; gauges for the river chart.
- **Emit:** `rain.forecast` (`rainScenario(s)`), `flood.alert` (`floodScenarioAlert(...)`: ⇒ Awas Belanja pump package,
  Cek Berkas bansos quota, Radar Isu topic, Toko Autopilot demand, Katalog Lokal need; shelters fill),
  `alert.broadcast` (`{ alertId, channels, desaIds?, message? }` ⇒ warning on the phones in the zone, Ibu Siti
  included), `harvest.updated` (`{ scenario: 'pasca-banjir', kecamatanIds, cause: 'alerts:<id>' }` ⇒ `econ.updated` +
  `supply.signal` for rice / chilli; `scenario: 'normal'` resets).
- **Consume:** `complaint.created` (banjir) and `flood.confirmed` (cluster confirms the prediction).
- **Lingkungan tab:** before/after slider of simulated land-use change (draw simulated polygons/markers over the real
  map, label "simulasi"); keep `imagery` for the "citra satelit" mission.
- **Missions:** Jalankan scrubber +6 jam (markMission at hour 6) · Kirim peringatan ke 1 kecamatan
  (`alert.broadcast`) · Buka citra satelit (markMission) · Lihat dampak pertanian (`harvest.updated` pasca-banjir).
- **Pass checks:** a warning produces a message on the Sapa Warga phone; map ≥ 50 fps on desktop tier high during
  rain.
- **AI Live:** `draft_alert`.
- **Budget:** map floor ≈ 125–130 KB ⇒ initial ≤ 45 KB own; Pertanian, Lingkungan, Broadcast lazy; desa (≈ 22 KB)
  loads on the first scrub (after a user action, reported separately).
- **Mobile:** map full width 60–70vh, panel becomes a bottom sheet with the same tabs; scrubber stays reachable.

### P6 · Awas Belanja — `src/demos/awas-belanja/` · prompt `prompts/awas-belanja.ts`
- **Layout:** `BrowserFrame`: package list + package detail with tabs HPS vs Pasar | Peserta | Pola | Laporan.
- **Files:** `index.tsx`, `List.tsx`, `Detail.tsx`, `HpsTab.tsx`, `BiddersTab.tsx` (lazy, NetworkGraph),
  `PatternsTab.tsx`, `MemoTab.tsx` (lazy, PaperFrame), `strings.ts`.
- **Kit:** `packages` (list + deviation %), `hpsVsMarket(s, id)` (table + bar chart; the memo MUST quote these
  numbers), `affiliationEdges(s, id)` (viz `NetworkGraph`, clickable edges with `evidence`), `analyzeProcurement(s,
  id)` (7 detectors: harga-seragam, pemenang-berulang, pemecahan-paket, jadwal-singkat, spesifikasi-merek,
  hps-kemahalan, afiliasi — each with `{ level, note }` ID/EN; animate the scan, then emit), `localBenchmarks`.
- **Emit:** `procurement.flagged` (`{ procurementId, ...analyzeProcurement(s, id) }`), `procurement.recommended`
  (`{ procurementId, hpsCorrected: hpsVsMarket(...).market, note, inviteLocal: true }` ⇒ `need.created` in Katalog
  Lokal).
- **Consume:** `flood.alert` ⇒ "Pengadaan Pompa Air Darurat" appears (find it with `p.key === 'pompa-darurat'`; open it
  when `useShell().focus` is its id), `match.made` (local UMKM offers as price benchmark).
- **Missions:** Analisis paket pompa (`procurement.flagged`) · Temukan peserta terafiliasi (markMission on edge click) ·
  Buat memo audit (`procurement.recommended`).
- **Pass checks:** every detector shows an explanation; memo numbers = table numbers.
- **Empty state:** before any flood alert the pump package does not exist: show the list with an EmptyState hint
  "Paket darurat muncul setelah peringatan banjir di Siaga Wilayah" + a real link to Siaga Wilayah (no fake button).
- **AI Live:** `assess_procurement`, `draft_audit_memo`.
- **Budget:** ≤ 75 KB own initial; NetworkGraph tab and memo lazy.
- **Mobile:** list → cards; detail full screen with tabs; graph pinch/zoom off, tap nodes; table → cards.

### P7 · Cek Berkas — `src/demos/cek-berkas/` · prompt `prompts/cek-berkas.ts`
- **Layout:** `BrowserFrame` with modes Satu Berkas | Massal.
- **Files:** `index.tsx`, `Single.tsx` (gallery, viewer, extraction, checks, tamper heatmap), `Bulk.tsx` (lazy),
  `UploadOwn.tsx` (lazy, Live only), `strings.ts`.
- **Kit:** docs `DocViewer`, `ExtractPanel`, `TamperHeatmap` + `TamperToggle`, `simulateExtract`, samples
  (`ktp-siti`, `ktp-siti-edit`, `kk-mojosari`, `nib-warung-tini`, `domisili-sranak(-edit)`, `foto-rumah-*`; every
  sample carries the SPESIMEN watermark), `parseNik` / `nikMatchesBirth`; `bansosBatch(s)` (50 rows: `result` lolos /
  kurang / ganda / luar-zona, `duplicateGroups` for the connecting lines, `summary.gandaPairs` = 3 =
  `facts.bansosDuplicatePairs`, `summary.luarZona` checked against the open programme / active alert zone),
  `bansosCsv(batch, lang)` for "Ekspor CSV".
- **Emit:** `document.verified` (`{ documentId, status }`, one per processed file; the bulk run emits 50 in one go, the
  kit handles it in one batch).
- **Consume:** `flood.alert` ⇒ `eligibility.opened` (programme with quota and kecamatan; show "Kuota pendaftar dibuka"
  banner and use its zone).
- **Missions:** Verifikasi 1 KTP spesimen (`document.verified` source cek-berkas) · Temukan dokumen yang diedit
  (markMission when the tamper heatmap shows "Perlu Cek Manual") · Jalankan verifikasi massal (markMission when the
  batch completes).
- **Pass checks:** every specimen field extracted correctly; duplicate count = seed (3 pairs).
- **AI Live:** `check_documents` (+ `/api/ai/extract` for "Proses dokumen saya", Live only, after confirmation, not
  stored).
- **Budget:** ≤ 75 KB own initial; Bulk + Upload lazy. 50 cards in ≈ 8 s with a fast stagger (transform/opacity).
- **Mobile:** viewer above extraction; bulk grid 3 columns of small cards, summary sticky on top.

---

## 3 · Cross-product reaction chains (exact event names)

Each chain is covered by the world self-test (`npx tsx src/demo-kit/world/__tests__/world.selftest.ts`, section
"tahap-2 cross-product chains", ids C1–C13, on the mini fixture AND the real Bojonegoro pack) and by
`tests/e2e/chains.spec.ts` (Playwright, real world store in the browser via `?e2e=1`). The integrator adds UI-driven
variants once products are DEMO_READY.

| # | Root (source) | Follow-ups (source) | Visible in |
|---|---|---|---|
| 1 | `complaint.created` ×5, banjir, ≤ 1 km (sapa-warga) | `complaint.clustered` (sapa-warga → Meja Pimpinan) · `flood.confirmed` (siaga-wilayah) · `mention.created` topic banjir (radar-isu) | one toast "Klaster aduan diteruskan ke Meja Pimpinan, Siaga Wilayah & Radar Isu" |
| 2 | `ticket.statusChanged` (sapa-warga) | `citizen.notified` kind `tiket` (sapa-warga) | HP Warga |
| 3 | `flood.alert` (siaga-wilayah) | `procurement.created` key `pompa-darurat` (awas-belanja) | Awas Belanja list |
| 4 | `flood.alert` (siaga-wilayah) | `eligibility.opened` bansos-banjir (cek-berkas) | Cek Berkas banner + zone |
| 5 | `flood.alert` (siaga-wilayah) | `mention.created` (radar-isu) · `stock.forecastChanged` (toko-autopilot) · `need.created` (katalog-lokal) | Radar Isu stream; tahap 3–4 products |
| 6 | `alert.broadcast` (siaga-wilayah) | `citizen.notified` kind `peringatan` to every citizen in the zone (sapa-warga) | HP Warga (Ibu Siti) |
| 7 | `instruction.issued` (meja-pimpinan) | `letter.dispositioned` + `actionItem.created` × OPD (naskah-pintar) | Naskah Pintar |
| 8 | `mention.created` ×6 with `rumor` (radar-isu, or clock at 10:00) | `hoax.detected` (radar-isu → Meja Pimpinan) | toast "Temuan hoaks diteruskan ke Meja Pimpinan"; Meja Pimpinan briefing |
| 9 | `clarification.published` (radar-isu) | `mention.created` ×5 positive, +6…+30 min (radar-isu) | sentiment line |
| 10 | `harvest.updated` pasca-banjir (siaga-wilayah) | `econ.updated` (indeks-ekonomi) · `supply.signal` beras/cabai (sinyal-pasar) | Indeks Ekonomi, Sinyal Pasar (tahap 4) |
| 11 | `procurement.recommended` inviteLocal (awas-belanja) | `need.created` (katalog-lokal) | Katalog Lokal (tahap 4) |
| 12 | `price.anomaly` (sinyal-pasar) | `market.operation` recommended (sinyal-pasar → Meja Pimpinan) | Meja Pimpinan suggestions |
| 13 | `service.booked` (sapa-warga) | `citizen.notified` kind `antrean` | HP Warga queue ticket |

Also stored: `flood.alert` fills the simulated shelters of the zone (`facilities[].occupied`); `flood.confirmed` adds
the complaints to `alert.confirmedBy`; `hoax.detected` links the rumor mentions (`hoaxId`).

---

## 4 · Do not touch (builders)

- `src/demo-kit/**` (the kit: world, shell, ui, viz, map, docs, media, ai, region, frames, i18n, CONTRACTS.md).
- `src/demos/registry.ts` (DEMO_READY is flipped by the integrator), `src/demos/_placeholder/**`, other products'
  folders under `src/demos/`.
- `src/routes/**`, `src/router.tsx`, `src/routeLoaders.ts`, `src/content/**`, `src/lib/**`, `src/styles/**`,
  `src/main.tsx`, `src/index.css`, `src-art/**`.
- `server/ai-proxy/src/**`, `server/ai-proxy/prompts/_shared.ts`, `server/ai-proxy/prompts/index.ts`,
  `server/ai-proxy/test/**`, other products' prompt files.
- `tests/e2e/**`, `playwright.config.ts`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`,
  `tools/**`, `docs/**` (except your own report if asked), `public/**`.
- No new npm dependencies.

---

## 5 · Budget numbers (gzip -9, beyond home, measured on a `VITE_DEMO_CONTROLS=1` build, 2026-11-17)

| Route | Before tahap 2 | Now |
|---|---|---|
| Home JS | 252.6 KB | 252.6 KB (unchanged) |
| `/demo/<slug>` interim placeholder | 57.4 KB | 58.4 KB |
| Live non-map demo floor (stub, `?controls=all`) | ≈ 95 KB (est.) | 99.1 KB (JS 83.7 + pack JSON 15.4) |
| `/lab/_kit?only=shell` (live shell + world) | 101.5 KB | 104.2 KB |
| `/lab/_kit?only=map` initial / after flood scrub | 85.4 / 107.6 KB | 88.4 / 110.6 KB |
| Map demo floor (upper bound, shell kit ∪ map kit) | 127.0 KB | 130.3 KB |

After the first interaction the event pipeline chunk loads (≈ 12.7 KB, reactions + reducers + audit texts + scenario
texts). `world/satu-daerah` is tree-shaken per product (whole module ≈ 12 KB standalone, most products use a third).

---

## 6 · Owner questions: all four defaults APPROVED by the owner on 2026-11-17 ("oke semua lanjutkan")

1. Satellite imagery for Siaga Wilayah: Sentinel-2 cloudless **2016** by EOX (CC BY 4.0, no key, attribution in the
   Sumber panel). Later mosaics are CC BY-NC-SA. Default: use the 2016 mosaic.
2. Persona names Siti Aminah, Raka Pratama, Darmo Sutrisno (fictional; spec names Ibu Siti / Raka / Pak Darmo).
3. The brand in the locked pump spec is fictional ("Hidroflo"). Default: keep.
4. Radar Isu "Ekspor XLSX" without a new dependency: default = minimal store-only XLSX writer in the product folder.
