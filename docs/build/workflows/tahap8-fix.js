export const meta = {
  name: 'tahap8-fix',
  description: 'Fix the open defects from LAPORAN-AKHIR §6: INP > 200 ms, Meja Pimpinan size, Cek Berkas/Naskah Pintar region text, tour layout (10c), Katalog/Sinyal content; then gate + shots',
  phases: [
    { title: 'Fix', detail: '4 fixers, disjoint file ownership, dev server only' },
    { title: 'Integrate', detail: 'build, gate, full e2e, INP + budgets, report update' },
    { title: 'Shots', detail: 'docs/shots/demo/tahap-8 (changed screens only)' },
  ],
}

const CTX = `Repo: C:/Users/LENOVO/gamada (Vite 8 + React 19 + TS strict, Windows; Git Bash and PowerShell available). All 7 build stages are DONE and committed (HEAD 4dfcea1). This is a short defect-fix round ("Tahap 8") for the open defects listed in docs/build/LAPORAN-AKHIR.md §3 (INP table) and §6, and docs/build/tahap7-plan.md §2 row 10c. Read those parts first. Kit contracts: src/demo-kit/CONTRACTS.md. Product code: src/demos/<slug>/. Regions: Bojonegoro (kabupaten, "Bupati"), Bandung and Padang (kota, "Wali Kota"/"Mayor"); region packs in src/demo-kit/region/packs/.
Servers already running (do not start or stop them): dev http://127.0.0.1:5173 (HMR) and preview http://127.0.0.1:4173 serving dist/ (only the integrator writes dist/).
Owner wants SPEED and "secukupnya": fix right the first time, self-check once, report. No polishing rounds. Do not commit/push/deploy. Do not edit src-art/. Keep data fictional/simulated (officials by title only). Never write regexes through a shell command that can turn \\b into a backspace byte; before finishing run grep -rlP '[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]' src server/ai-proxy/src server/ai-proxy/prompts tests tools (must print nothing). DISK C: HAS ONLY ~800 MB FREE: fixers must NOT run vite build or the full e2e suite; keep scratch tiny under .shots/t8-<you>/ (no traces/videos/sourcemaps) and delete it when done; never delete anything else. Stay strictly inside the files you own; if a fix needs a file you do not own, describe it in handoff instead.
Measure INP on the dev server with Playwright + CDP Emulation.setCPUThrottlingRate 4 (Event Timing / PerformanceObserver 'event', durationThreshold 16), worst of 3 runs; dev numbers are noisier than the production numbers in LAPORAN-AKHIR, so report before/after on dev for the same script. Typical cures: defer non-urgent state with startTransition / a requestAnimationFrame+setTimeout split, give visual feedback first then heavy work next frame, avoid synchronous layout reads after writes, avoid mounting large subtrees and map style/layer changes in the click frame, content-visibility for offscreen lists. Never weaken a test assertion.`

const RESULT = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    done: { type: 'array', items: { type: 'string' } },
    notDone: { type: 'array', items: { type: 'string' } },
    filesChanged: { type: 'array', items: { type: 'string' } },
    inp: { type: 'string', description: 'before -> after per interaction (dev, x4 CPU)' },
    handoff: { type: 'array', items: { type: 'string' } },
    checks: { type: 'string' },
  },
  required: ['summary', 'done', 'notDone', 'filesChanged', 'checks'],
}

const SELF = `Self-check once: npx tsc --noEmit; the existing e2e spec files that cover your products, run alone with --workers=1 against the dev server if the config allows (check playwright config / fixtures for the base URL env; otherwise run them as the config does but only those files) and delete test-results afterwards; 0 console errors on your pages in ID and EN, 1440 and 390.`

phase('Fix')
const FIXERS = [
  { key: 'inp-a', prompt: `YOUR TASK (fixer inp-a). You own: src/demos/siaga-wilayah/**, src/demos/sapa-warga/**, src/demos/meja-pimpinan/**, src/demo-kit/map/**, src/demo-kit/region/** (not the pack data).
1. INP: Siaga Wilayah "Kirim peringatan" flow: "selesai" (352 ms at 1440, 296 at 390), "prakiraan +6 jam" 264, "citra satelit" 216; region switch on Siaga Wilayah (map fly) 232; Sapa Warga "foto banjir" 256; Meja Pimpinan "Susun briefing" 216. Script the same interactions as tests/e2e/tahap7/inp.spec.ts (read it) and get each under 200 ms with margin (aim <= 170 on dev x4).
2. Size: Meja Pimpinan first load is 176.6 KB ID / 178.2 KB EN (gzip -9, measured by .shots/t7-*/budget.mjs or the tahap7 budget script; find it). Target <= 175 both. You cannot build; reduce by moving clearly non-first-paint code (secondary panels, EN strings if they ship in the ID load, heavy charts) behind lazy imports, and explain the expected saving; the integrator measures.
${SELF}` },
  { key: 'inp-b', prompt: `YOUR TASK (fixer inp-b). You own: src/demos/toko-autopilot/**, src/demos/tenderpilot/**, src/demos/cek-berkas/**, src/demos/pantau-merek/**.
1. INP: Toko Autopilot "buka keranjang" 264 ms (390); TenderPilot "ke Dokumen" 232 (390); Cek Berkas "mode Massal" 216 (390); Pantau Merek "Kirim 5 balasan" 208 (1440). Script the same interactions as tests/e2e/tahap7/inp.spec.ts (read it) and get each under 200 ms with margin (aim <= 170 on dev x4).
2. Cek Berkas region text: the specimen gallery (KTP/KK/surat etc.) still shows Bojonegoro / Provinsi Jawa Timur when the region is Bandung (Jawa Barat, Kota Bandung) or Padang (Sumatera Barat, Kota Padang). Make the specimen documents and any related verification text derive province/kabupaten-kota/kecamatan/kelurahan names and NIK region code prefixes from the active region pack (read how other demos get the active region, e.g. via the region kit hook), with fictional people. Keep it cheap in size. Add a check in tests/e2e/tahap7/regions.spec.ts (you may edit only the Cek Berkas part of that file) that Bandung shows "JAWA BARAT"/"Bandung" and no "Bojonegoro".
${SELF}` },
  { key: 'tour', prompt: `YOUR TASK (fixer tour). You own: src/demo-kit/tour/**, src/demo-kit/shell/**, src/routes/Tur*.tsx (if any), tests/e2e/tahap5/**. You must NOT edit src/demos/**; fix product layouts inside the tour stage with CSS scoped to the tour stage container (e.g. a stage attribute selector in a tour stylesheet) or with stage containment (e.g. transform/contain on the stage so fixed-position product overlays stay inside it).
Fix the open tour defects from tahap7-plan row 10c and LAPORAN-AKHIR §5/§6: (a) product toasts on /tur appear bottom-left over the narration column: they must render inside the stage (or top-right of the stage) and never cover the narration; (b) the stage scrolls so the product header is cut (ch. 7, 8, 17, 19): the product header must be visible when a chapter starts and during autoplay at 1440 and 390; (c) Toko Autopilot chat panel opens over the whole window in ch. 11: keep inside the stage; (d) Rapor Usaha bank cards wrap one word per line in the narrow stage (ch. 14); (e) Sinyal Pasar HARGA / 7 HARI overlap (ch. 17); (f) Katalog Lokal match lines over "Daftar kebutuhan"; (g) Ambil alih from ch. 11 lacks focus= and uses outlet=toko (plan says warung), clock 13.00 vs 13.10; (h) summary screen: controls row between CTA and "Coba sendiri". Also check the autoplay for long tasks > 200 ms on chapter change at x4 CPU and defer what is cheap.
Verify by playing /tur on the dev server at 1440 and 390 (ID and EN) with screenshots into your scratch dir and look at them (ch. 7, 8, 11, 14, 17, 19, summary). Run tests/e2e/tahap5/tour.spec.ts. ${SELF}` },
  { key: 'content', prompt: `YOUR TASK (fixer content). You own: src/demos/naskah-pintar/**, src/demos/katalog-lokal/**, src/demos/sinyal-pasar/**, src/demos/rapor-usaha/**, src/demo-kit/world/** (only if needed for item 3; keep determinism and run the world selftest npx tsx src/demo-kit/world/__tests__/world.selftest.ts).
1. Naskah Pintar: the mission hint "Setujui sebagai Bupati" is static; in kota regions it must say "Wali Kota" (EN "Mayor"; Bojonegoro EN keeps its current term). Check every other place in Naskah Pintar that still hardcodes Bupati/Bojonegoro/Jawa Timur in region-dependent text.
2. Katalog Lokal: the "bagi pesanan" (split order) suggestion is proposed without terpal (tarpaulin) although the need list contains it (Tahap 4 defect noted in LAPORAN-AKHIR §5): the split suggestion must cover every item of the need list or say clearly which item has no local supplier.
3. Sinyal Pasar: the anomaly moment needs more than 15 s after the flood to appear; make the anomaly visible within ~5 s after the flood event (world clock) without changing the numbers other demos/tour show for the same moment (the tour and Indeks Ekonomi read the same selectors; keep them consistent).
4. Rapor Usaha: quick check at 390 and in a narrow container (~560 px) that bank cards do not wrap one word per line; fix in the product CSS if they do (the tour fixer handles the tour stage separately).
Add a one-line assertion for items 1-3 in the matching existing spec (tahap3/tahap4/tahap7 regions) without weakening any assertion. ${SELF}` },
]

const fixes = await parallel(FIXERS.map(f => () =>
  agent(`${CTX}\n\n${f.prompt}`, { label: `fix:${f.key}`, phase: 'Fix', schema: RESULT })
    .then(r => ({ key: f.key, r }))))

const fixSummary = fixes.filter(Boolean).map(x => ({ key: x.key, summary: x.r && x.r.summary, notDone: x.r && x.r.notDone, files: x.r && x.r.filesChanged, inp: x.r && x.r.inp, handoff: x.r && x.r.handoff }))
log(`fixers done: ${fixSummary.length}/4`)

phase('Integrate')
const integ = await agent(`${CTX}

YOUR TASK (integrator + gate, Tahap 8): you are now the only agent editing (any file).
Fixer results: ${JSON.stringify(fixSummary)}
1. Apply the fixers' handoff items if cheap and correct. Check the fixers did not edit each other's files in conflicting ways (git diff --stat).
2. Gate: npx tsc -b; region validate; world selftest (0 failed per pack); ui/shell selftests; viz tests; npm run ai:test; npm run build (dist/, served live on 4173). Before any disk-heavy step check free space (df -h /c); if under 300 MB stop and report instead of failing midway. Full npm run test:e2e (2 workers); if the e2e config builds its own copy (.e2e/dist) delete it and test-results right after; on ENOSPC or load flakes re-run only the failing files alone. Fix minimally; never weaken an assertion without saying why.
3. Measure: tests/e2e/tahap7/inp.spec.ts on the production build (same method as Tahap 7, x4 CPU) and update docs/build/tahap7-inp.json -> write the new run to docs/build/tahap8-inp.json; budgets for all 18 demos + /tur ID and EN with the Tahap 7 budget script (<= 180 KB each, report which are > 175), home JS <= 253.6 KB; home perf once at CPU 1x (tools/perf.mjs) vs docs/perf/tahap1-ab.txt; axe on the changed demos + /tur (0 findings expected); control-byte grep; git status shows no deleted files; no .only in tests.
4. Update docs/build/LAPORAN-AKHIR.md in Indonesian (say "batas ukuran", never "anggaran"): add a short section "8 · Putaran perbaikan (Tahap 8)" with a table of each defect -> fixed / partly / not, the new INP table (before Tahap 7 -> after Tahap 8), the size table changes, and e2e result; update §6 so it lists only what is still open. Be honest.
Return the facts.`, { label: 'integrate:t8', phase: 'Integrate', schema: { type: 'object', properties: { summary: { type: 'string' }, budget: { type: 'string' }, inp: { type: 'string' }, e2e: { type: 'string' }, gates: { type: 'string' }, fixed: { type: 'array', items: { type: 'string' } }, notDone: { type: 'array', items: { type: 'string' } }, diskFree: { type: 'string' } }, required: ['summary', 'budget', 'inp', 'e2e', 'gates', 'notDone'] } })

phase('Shots')
const shots = await agent(`${CTX}

YOUR TASK (screenshots, Tahap 8): from the production build on http://127.0.0.1:4173 save screenshots of ONLY the screens changed in this round to docs/shots/demo/tahap-8/: /tur ch. 7, 8, 11, 14, 17, 19 and the summary at 1440 (plus ch. 7 at 390); Cek Berkas specimen gallery in Bandung and Padang; Naskah Pintar mission hint in Bandung (ID) and Padang (EN); Katalog Lokal split-order suggestion; Sinyal Pasar anomaly shortly after the flood; Siaga Wilayah after "Kirim peringatan" selesai at 1440. Reuse/adapt the Tahap 7 shot script (.shots/t7-*/ or tools/) into .shots/t8-shots/ and delete that scratch dir afterwards. PNGs compressed, each under ~400 KB, total under 15 MB. Look at each screenshot and judge whether the defect is really gone. Write docs/shots/demo/tahap-8/INDEX.md (one line per file, remaining visible defects noted honestly). Be fast.
Integrator result: ${JSON.stringify(integ ? { summary: integ.summary, notDone: integ.notDone } : { failed: true })}`, { label: 'shots:t8', phase: 'Shots', effort: 'medium', schema: { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'integer' }, defects: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'defects'] } })

return { fixes: fixSummary, integ, shots }
