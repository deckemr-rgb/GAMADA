export const meta = {
  name: 'tahap7-build',
  description: 'Tahap 7 (lean): Wave A packs+kit+measurer, mid-point registration, Wave B owners, Wave C integration + gate + one wow pass + final proof',
  phases: [
    { title: 'WaveA', detail: 'R1 Bandung, R2 Padang, P3 Kit, M Measurer in parallel' },
    { title: 'Mid', detail: 'register packs, validate, size table, hand findings + grep to owners' },
    { title: 'WaveB', detail: 'P1 Satu Daerah, P2 Usaha+Pasar, P4 Site+tour in parallel' },
    { title: 'WaveC', detail: 'integration, gate, wow pass, screenshots, pixel diff, final report' },
  ],
}

const CTX = `Repo: C:/Users/LENOVO/gamada (Vite 8 + React 19 + TS strict; Windows, Git Bash and PowerShell available). Spec: docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md §7, §14, §15, §16. THE BUILD PLAN IS docs/build/tahap7-plan.md: read §0 (rules + self-check) and the sections your task names; it is binding, including §7 owner answers (ALL APPROVED on 2026-11-19, "oke semua": Sunda/Minang sample texts labelled "contoh"; sources HDX COD-AB CC BY-IGO, OSM ODbL, Kemendagri codes; NO tsunami layer for Padang; devDeps @axe-core/playwright, web-vitals, pixelmatch, pngjs allowed; ONE wow pass, no re-score; site + tour stay Bojonegoro). Kit contracts: src/demo-kit/CONTRACTS.md. Tahap 2-6 (18 demos, /tur, site pages) are committed and must keep working: every demo and /tur <= 180 KB first load, e2e green, home JS <= 253.6 KB, home perf not worse.
Servers already running (do not start or stop them): dev http://127.0.0.1:5173 (HMR) and preview http://127.0.0.1:4173 serving dist/ live (only the integrator writes dist/).
Owner wants SPEED and "secukupnya": build it right the first time, self-check once, fix what fails, report. Do not commit/push/deploy. Do not edit src-art/. Real data only with an open licence and cited; everything else simulated and labelled; people/companies fictional, officials by title only. Never write regexes through a shell command that can turn \\b into a backspace byte; before finishing run grep -rlP '[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]' src server/ai-proxy/src server/ai-proxy/prompts tests tools (must print nothing). DISK C: IS NEARLY FULL: keep scratch tiny under .shots/t7-<you>/, no traces/videos/sourcemaps, delete your own dist right after each measurement; raw downloaded geodata goes to .shots/t7-<you>/raw and is deleted after the pack is built. Do not delete anything else under .shots/. Own only the files plan §5 gives you.`

const RESULT = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    done: { type: 'array', items: { type: 'string' } },
    notDone: { type: 'array', items: { type: 'string' } },
    handoff: { type: 'array', items: { type: 'string' } },
    budget: { type: 'string' },
    checks: { type: 'string' },
  },
  required: ['summary', 'done', 'notDone', 'checks'],
}

const WAVE_A = [
  ['R1', 'R1 Bandung: build the Kota Bandung region pack per plan §1 (fetch + build scripts, simulated data, content, pack folder), run the §1.5 checks and npm run region:validate against it (register it locally for checking only; the integrator owns REGIONS). Write the README section text and the source/licence table into your result.'],
  ['R2', 'R2 Padang: build the Kota Padang region pack per plan §1 (fetch + build scripts, simulated data, content, pack folder; no tsunami layer), run the §1.5 checks and npm run region:validate against it (register it locally for checking only; the integrator owns REGIONS). Write the README section text and the source/licence table into your result.'],
  ['P3', 'P3 Kit: the region picker + map fly-to + world reset without reload (backlog item 2), the kit de-hardcode list of §1.6, the Hotspot "Mulai di sini" overlap fix (item 6) and Could items 15-17 if time allows; develop against Bojonegoro + world/__fixtures__/mini-pack.ts. Add a short "Tahap 7" section to CONTRACTS.md. Checks: tsc -b, world selftest, ui/shell selftests, the chain specs on dev, home JS and the 18 demos not grown by more than 0.5 KB (own build on port 4400, delete after).'],
  ['M', 'M Measurer: install the approved devDeps, write tests/e2e/tahap7/{a11y,inp,targets}.spec.ts per plan §3, run them over all 18 demos, /tur and the site pages, and write docs/build/tahap7-a11y.json and docs/build/tahap7-inp.json. Return findings grouped by owner area (P1 Satu Daerah, P2 Usaha+Pasar, P3 kit, P4 site+tour) with file hints. Do not fix product code.'],
]

phase('WaveA')
const waveA = await parallel(WAVE_A.map(([id, task]) => () => agent(`${CTX}

YOUR TASK (Tahap 7 Wave A, agent ${id}): ${task}`, { label: `A:${id}`, phase: 'WaveA', schema: RESULT })))
const A = Object.fromEntries(WAVE_A.map(([id], i) => [id, waveA[i]]))

phase('Mid')
const mid = await agent(`${CTX}

YOUR TASK (integrator, Tahap 7 mid-point): register the finished packs in src/demo-kit/region/loader.ts REGIONS, write src/demo-kit/region/packs/README.md (sources + licences from R1/R2), run npm run region:validate for all 3 packs and a size table for the 18 demos with each region (no demo first load may grow). Run the §1.6 Bojonegoro hard-code grep over ALL product folders (incl. Tahap 4 folders, the tour and site), and split the hits plus the measurer findings into three lists for P1 (Satu Daerah), P2 (Usaha + Pasar) and P4 (site + tour), each item with file:line.
Wave A results: ${JSON.stringify(WAVE_A.map(([id], i) => ({ id, ...(waveA[i] ? { summary: waveA[i].summary, notDone: waveA[i].notDone, handoff: waveA[i].handoff } : { failed: true }) })))}`, { label: 'mid:t7', phase: 'Mid', schema: { type: 'object', properties: { summary: { type: 'string' }, P1: { type: 'array', items: { type: 'string' } }, P2: { type: 'array', items: { type: 'string' } }, P4: { type: 'array', items: { type: 'string' } }, kit: { type: 'array', items: { type: 'string' } }, budget: { type: 'string' } }, required: ['summary', 'P1', 'P2', 'P4'] } })

const WAVE_B = [
  ['P1', 'P1 Satu Daerah (src/demos/{sapa-warga,meja-pimpinan,naskah-pintar,radar-isu,siaga-wilayah,awas-belanja,cek-berkas}/** and their tahap2 specs): de-hardcode, backlog items 7 and 11 (SD part), incl. meja-pimpinan EN <= 175 KB, and the axe/INP fixes in your list.'],
  ['P2', 'P2 Usaha + Pasar (the 6 Usaha Pintar folders + the 5 Tahap 4 folders and their tahap3/tahap4 specs): de-hardcode, backlog items 10 and 11 (UP/PD part), and the axe/INP fixes in your list.'],
  ['P4', 'P4 Site + tour (src/routes/**, src/pages/**, src/content/**, the tour folder, public/sitemap.xml, index.html meta): backlog item 12, Could items 14 and 18 if time allows, and the axe/INP fixes in your list.'],
]
phase('WaveB')
const waveB = await parallel(WAVE_B.map(([id, task]) => () => agent(`${CTX}

YOUR TASK (Tahap 7 Wave B, owner ${id}): ${task}
Your list from the mid-point: ${JSON.stringify((mid && mid[id]) || 'missing: run the plan §1.6 grep for your folders and read docs/build/tahap7-{a11y,inp}.json')}
Kit changes this wave: ${JSON.stringify((A.P3 && A.P3.handoff) || [])}. If you need a kit fix, list it in handoff (one batch) instead of editing src/demo-kit.
Self-check once: your demos/pages in all 3 regions (?region=bojonegoro|bandung|padang) and ID/EN, 0 console errors, your specs green on dev, sizes not grown (own build on port ${4411 + ['P1', 'P2', 'P4'].indexOf(id)}, delete after). Fix what fails, then stop.`, { label: `B:${id}`, phase: 'WaveB', schema: RESULT })))

phase('WaveC')
const integ = await agent(`${CTX}

YOUR TASK (integrator, Tahap 7 Wave C): you are the only agent editing now (any file).
Wave B results: ${JSON.stringify(WAVE_B.map(([id], i) => ({ id, ...(waveB[i] ? { summary: waveB[i].summary, notDone: waveB[i].notDone, handoff: waveB[i].handoff } : { failed: true }) })))}
1. Apply the kit-fix batch from the owners' handoff lists; finish cheap notDone items.
2. Write tests/e2e/tahap7/{regions,final}.spec.ts and extend tests/e2e/tahap2/region-lang.spec.ts to the 3 regions x ID/EN x 18 demos (plan §6).
3. Gate (plan §6): tsc -b; region validate (3 packs); world selftest per pack; ui/shell/viz selftests; npm run ai:test; npm run build (dist/, served on 4173); full npm run test:e2e until green (fix minimally; never weaken an assertion without saying why); a11y serious/critical = 0; INP table; sizes for 18 demos x ID/EN, /tur and site routes (save script as .shots/t7-int/budget.mjs); home JS <= 253.6; home perf once at CPU 1x vs docs/perf/tahap1-ab.txt; control-byte grep; git status shows no deleted files.
4. ONE wow pass (owner Q4): one evaluator pass with the 4 personas over the tour and the 6 featured demos; record scores, do NOT re-score.
5. Final proof per plan §4: screenshots in docs/shots/demo/tahap-7/ + INDEX.md (PNG each under ~400 KB), tools/shot-diff.mjs pixel-diff table vs baseline, and docs/build/LAPORAN-AKHIR.md in Indonesian with all 7 sections. Delete .e2e/dist and test-results afterwards, keep dist/.
Report the size table, e2e result, a11y/INP summary, wow scores, and every remaining defect honestly.`, { label: 'integrate:t7', phase: 'WaveC', schema: { type: 'object', properties: { summary: { type: 'string' }, budget: { type: 'string' }, e2e: { type: 'string' }, gates: { type: 'string' }, a11yInp: { type: 'string' }, wow: { type: 'string' }, shots: { type: 'string' }, notDone: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'budget', 'e2e', 'gates', 'notDone'] } })

return { waveA: WAVE_A.map(([id], i) => ({ id, ...(waveA[i] || { failed: true }) })), mid, waveB: WAVE_B.map(([id], i) => ({ id, ...(waveB[i] || { failed: true }) })), integ }
