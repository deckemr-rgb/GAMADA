export const meta = {
  name: 'tahap6-build',
  description: 'Tahap 6 site pages (lean): step 0 contracts/stubs, 3 builders in parallel, integration + gate + one visual pass vs home, screenshots',
  phases: [
    { title: 'Step0', detail: 'plan step 0: contracts, stubs, shared files' },
    { title: 'Builders', detail: 'B1 Ekosistem+Lab, B2 Produk, B3 Situs in parallel' },
    { title: 'Integrate', detail: 'links, routes, gate, visual comparison vs home (one pass, <= 15 fixes)' },
    { title: 'Shots', detail: 'docs/shots/demo/tahap-6 + INDEX.md' },
  ],
}

const CTX = `Repo: C:/Users/LENOVO/gamada (Vite 8 + React 19 + TS strict, react-router 7, Tailwind 4, GSAP, Lenis; Windows, Git Bash and PowerShell available). Spec: docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md §4, §13, §14. THE BUILD PLAN IS docs/build/tahap6-plan.md: read §0 (rules + self-check) and the sections your task names; it is binding, including §7 owner answers (ALL APPROVED on 2026-11-19, "oke semua"; FAQ makes no claims). Kit contracts: src/demo-kit/CONTRACTS.md. Tahap 2-5 (18 demos + the /tur tour) are committed and must keep working: every demo and /tur <= 180 KB first load, their e2e must stay green, home JS <= 253.6 KB and home perf not worse.
Servers already running (do not start or stop them): dev http://127.0.0.1:5173 (HMR) and preview http://127.0.0.1:4173 serving dist/ live (only the integrator writes dist/).
Owner wants SPEED and "secukupnya": build it right the first time, run your self-check once, fix what fails, report. No extra polishing rounds. Do not commit/push/deploy. Do not edit src-art/. Site pages must match the existing GAMADA home look. No prices; "Hubungi kami"; all data simulated and labelled; people/companies fictional, officials by title only. Never write regexes through a shell command that can turn \\b into a backspace byte; before finishing run grep -rlP '[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]' src server/ai-proxy/src server/ai-proxy/prompts tests (must print nothing). DISK C: IS NEARLY FULL: keep scratch tiny under .shots/t6-<you>/, no traces/videos/sourcemaps, delete your own dist right after each measurement. Do not delete anything else under .shots/.`

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

phase('Step0')
const step0 = await agent(`${CTX}

YOUR TASK (step 0, Tahap 6): do plan step 0 exactly (contracts, stub files, shared files the integrator owns per §4: content/i18n/eco.ts, lib/motion.ts additions, ecoNav.ts shape, mini-kit API, MINIS registry with stub minis, copy.ts type) so B1, B2 and B3 can start in parallel without touching each other's files. npx tsc -b must pass; home JS must stay <= 253.6 KB (quick own build into .shots/t6-s0/dist, delete after). In handoff list exact names/paths each builder needs.`, { label: 'step0:t6', phase: 'Step0', effort: 'medium', schema: RESULT })

const BUILDERS = [
  ['B1', 'B1 · Ekosistem + Lab'],
  ['B2', 'B2 · Produk (template, 18 copy.ts, minis P0-P7)'],
  ['B3', 'B3 · Situs (navbar, footer, home sections, /karya, redirects, minis P8-P17)'],
]
phase('Builders')
const builders = await parallel(BUILDERS.map(([id, name], i) => () => agent(`${CTX}

YOUR TASK (builder ${name}): build everything plan §2/§3/§5/§6 assigns to ${id}, owning ONLY the files listed for ${id} in plan §4 (the other two builders work in parallel on their own files).
Step 0 result: ${JSON.stringify((step0 && step0.summary) || 'missing: read git diff HEAD and plan step 0')}
Step 0 notes: ${JSON.stringify((step0 && step0.handoff) || [])}
Self-check once on the dev server: your pages in ID and EN, 1440 and 390, 0 console errors, no dead links or controls, reduced motion, 44 px targets, look consistent with the home page. Measure your routes' first load with your own build (port ${4401 + i}; delete the dist after) against plan §5. Write your spec under tests/e2e/tahap6/. npx tsc --noEmit (report errors in other builders' files, do not fix them). Fix what fails, then stop.`, { label: `build:${id}`, phase: 'Builders', schema: RESULT })))

phase('Integrate')
const integ = await agent(`${CTX}

YOUR TASK (integrator + gate, Tahap 6): you are the only agent editing now (any file).
Builder results: ${JSON.stringify(builders.map((b, i) => ({ builder: BUILDERS[i][0], ...(b ? { summary: b.summary, notDone: b.notDone, handoff: b.handoff, budget: b.budget } : { failed: true }) })))}
1. Merge fixes; finish cheap notDone items; write tests/e2e/tahap6/links.spec.ts (crawl: no dead links incl. navbar, mobile menu, footer; every redirect in spec §4 incl. anchors) and extend tests/e2e/routes.spec.ts.
2. ONE visual comparison pass vs the home page (plan §6 method): screenshot /, /ekosistem, one /ekosistem/:eco, two /produk/:slug, /lab, /karya at 1440 and 390; list mismatches in type scale, spacing, colour, buttons, section rhythm; fix at most 15, then stop.
3. Gate: npx tsc -b; region validate; world selftest; ui/shell selftests; npm run ai:test; npm run build (dist/, served on 4173); full npm run test:e2e until green (fix minimally; never weaken an assertion without saying why); sizes: home JS <= 253.6 KB, every new route within plan §5, the 18 demos and /tur still <= 180 KB (use .shots/t5-int/budget.mjs or the latest budget script; save yours as .shots/t6-int/budget.mjs); home perf once at CPU 1x (tools/perf.mjs) vs docs/perf/tahap1-ab.txt; control-byte grep; git status shows no deleted files. Delete .e2e/dist and test-results afterwards, keep dist/.
4. Report: size table, e2e result, visual pass findings (fixed / left), every remaining defect honestly.`, { label: 'integrate:t6', phase: 'Integrate', schema: { type: 'object', properties: { summary: { type: 'string' }, budget: { type: 'string' }, e2e: { type: 'string' }, gates: { type: 'string' }, visual: { type: 'string' }, fixed: { type: 'array', items: { type: 'string' } }, notDone: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'budget', 'e2e', 'gates', 'notDone'] } })

phase('Shots')
const shots = await agent(`${CTX}

YOUR TASK (screenshots, Tahap 6): from the production build on http://127.0.0.1:4173, save screenshots to docs/shots/demo/tahap-6/: home (1440 + 390, ID), navbar Ekosistem dropdown open, mobile menu open, /ekosistem (1440 ID, 390 ID, 1440 EN), each /ekosistem/:eco at 1440 ID (4), 4 product pages (one per ecosystem + Toko Autopilot #kasir) at 1440 ID and one at 390, /lab, /karya, footer. Save PNGs compressed (each under ~400 KB). Look at each screenshot. Write docs/shots/demo/tahap-6/INDEX.md (one line per file, visible defects noted honestly). Be fast.`, { label: 'shots:t6', phase: 'Shots', effort: 'medium', schema: { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'integer' }, defects: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'defects'] } })

return { step0, builders: builders.map((b, i) => ({ builder: BUILDERS[i][0], ...(b || { failed: true }) })), integ, shots }
