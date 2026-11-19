export const meta = {
  name: 'tahap4-build',
  description: 'Tahap 4 Pasar Daerah P14-P17 + Inti (lean): kit first, 5 products in parallel, integration + gate, screenshots',
  phases: [
    { title: 'Kit', detail: 'Pasar Daerah world module, UP boot split, Inti selectors, components (plan §1)' },
    { title: 'Products', detail: '5 builders in parallel with self-checks' },
    { title: 'Integrate', detail: 'DEMO_READY flip, chains C30-C38, e2e, budgets for 18 demos, gate, fixes' },
    { title: 'Shots', detail: 'docs/shots/demo/tahap-4 + INDEX.md' },
  ],
}

const CTX = `Repo: C:/Users/LENOVO/gamada (Vite 8 + React 19 + TS strict, Windows; Git Bash and PowerShell available). Spec: docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md. THE BUILD PLAN IS docs/build/tahap4-plan.md: read §0 (rules, lessons, self-check) and the sections your task names; it is binding, including §6 owner answers (ALL APPROVED on 2026-11-19, "oke semua": use the defaults as written). Kit contracts: src/demo-kit/CONTRACTS.md (incl. the Tahap 3 section and integration notes at the end). Tahap 2 (Satu Daerah P1-P7) and Tahap 3 (Usaha Pintar P8-P13) are committed (HEAD d84c228, Tahap 3 = 9d156fb) and must keep working: their 13 demos must stay <= 180 KB first load and their e2e (182 tests) must stay green.
Servers already running (do not start or stop them): dev http://127.0.0.1:5173 (HMR; use /demo/<slug>?controls=all for demos not yet DEMO_READY, add &e2e=1 for window.__gamada) and preview http://127.0.0.1:4173 serving dist/ live (only the integrator writes dist/).
Owner wants SPEED and "secukupnya": build it right the first time, run your self-check once, fix what fails, report. No extra polishing rounds. Do not commit/push/deploy. Do not edit src-art/. Never write regexes through a shell command that can turn \\b into a backspace byte; before finishing run grep -rlP '[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]' src server/ai-proxy/src server/ai-proxy/prompts tests (must print nothing). DISK C: IS NEARLY FULL (~3.8 GB free): keep scratch tiny under .shots/t4-<you>/, no traces/videos/sourcemaps, delete your own dist folder right after each measurement, never leave more than one own build on disk. Do not delete anything else under .shots/.`

const RESULT = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    done: { type: 'array', items: { type: 'string' } },
    notDone: { type: 'array', items: { type: 'string' } },
    kitHandoff: { type: 'array', items: { type: 'string' } },
    budget: { type: 'string' },
    checks: { type: 'string' },
  },
  required: ['summary', 'done', 'notDone', 'checks'],
}

phase('Kit')
const kit = await agent(`${CTX}

YOUR TASK (kit agent, Tahap 4): build everything in plan §1 (kit + world APIs for Tahap 4: UP boot split into data/live, flood-scenario, price-math, eco WORLD_MODULES/preloadWorldFor, the pasar-daerah world module pd/*, world/inti selectors, story, new events + reactions C30-C38 shared parts, new components ScoreDial, BizBadges, RangeField, ActivityFeed, ai/trace) so the 5 product builders can start right after you. You may edit src/demo-kit/**, src/demos/registry.ts (loaders only, DO NOT flip DEMO_READY), server/ai-proxy/** (shared parts, not product prompt files), vite.config.ts, src/routes/LabKit.tsx (lab entries), and add selftest checks. Do not change the behaviour of Tahap 2/3 products (the C13 market-operation reaction stays as is); if a shared move (e.g. weekChangeOf) touches their imports, keep re-exports so their code is unchanged.
Keep the Pasar Daerah module out of the Satu Daerah / Usaha Pintar boot paths and out of home. Verify with a quick own build into .shots/t4-kit/dist + preview on 4400 + a copy of .shots/t3-int/budget.mjs: home JS <= 253.6 KB; the 13 existing demos must not grow by more than 0.5 KB (the UP split should make the 6 UP demos smaller); report the PD and Inti stub floors vs plan §5.
Create each product folder src/demos/<slug>/ with a minimal compiling index.tsx stub ONLY if the registry needs it to compile; builders will replace it.
Checks: npx tsc -b; world selftest (npx tsx src/demo-kit/world/__tests__/world.selftest.ts) incl. new determinism checks for the PD module and the key numbers of plan §1 (score 710 -> 740 -> 820, loan Rp 150 jt / 12 / Rp 13.775.000, 2 kecamatan hidden below 10 businesses); ui/shell selftests; npm run ai:test; the Tahap 2 + 3 chain specs (tests/e2e/chains.spec.ts, tests/e2e/tahap2/chains-ui.spec.ts, tests/e2e/tahap3/chains.spec.ts) against the dev server. Document the new APIs in CONTRACTS.md (section "Tahap 4"). In kitHandoff list per product slug anything a builder must know that differs from the plan (exact names that changed, measured floors).`, { label: 'kit:t4', phase: 'Kit', schema: RESULT })

const SLUGS = ['katalog-lokal', 'rapor-usaha', 'indeks-ekonomi', 'sinyal-pasar', 'inti']
phase('Products')
const products = await parallel(SLUGS.map((slug, i) => () => agent(`${CTX}

YOUR TASK (builder of ${slug}): build the ${slug} demo exactly per its brief in plan §2, the chains in §3 that involve ${slug}, the size plan in §5, using the kit APIs of §1. You own only src/demos/${slug}/**, server/ai-proxy/prompts/${slug}.ts and tests/e2e/tahap4/${slug}.spec.ts. Four other builders work in parallel in their own folders.
Kit result: ${JSON.stringify((kit && kit.summary) || 'missing: read git diff d84c228 -- src/demo-kit and CONTRACTS.md')}
Kit notes: ${JSON.stringify(((kit && kit.kitHandoff) || []).filter((k) => k.includes(slug) || !/^\[?[a-z-]+\]?:/.test(k)))}
Then run the self-check list of §0 / your brief ONCE on the dev server (http://127.0.0.1:5173/demo/${slug}?controls=all): every mission completes by script, 0 console errors, 1440 and 390, ID and EN, every role, reduced motion, alive within 10 s, no dead controls, numbers that must agree. Measure size with your own build (port ${4401 + i}, see §0; delete that dist right after) and keep first load <= 175 KB ID and EN. Write the e2e spec (missions + your chain hops). npx tsc --noEmit (report errors in other folders, do not fix them). Fix what fails, then stop.`, { label: `build:${slug}`, phase: 'Products', schema: RESULT })))

phase('Integrate')
const integ = await agent(`${CTX}

YOUR TASK (integrator + gate, Tahap 4): you are the only agent editing now (any file).
Builder results: ${JSON.stringify(products.map((p, i) => ({ slug: SLUGS[i], ...(p ? { summary: p.summary, notDone: p.notDone, kitHandoff: p.kitHandoff, budget: p.budget } : { failed: true }) })))}
1. Resolve kitHandoff items that block correctness (kit side), and builder notDone items that are cheap. Flip DEMO_READY for the 5 Tahap 4 demos that work; keep a demo unflipped only if it is broken (say why).
2. Verify chains C30-C38 and L7-L12 end to end (plan §3) and write tests/e2e/tahap4/chains.spec.ts driven by the real toasts and landings; extend the shared no-dead-controls / region-language / routes specs to the 5 new demos (and the /ekosistem/pasar-daerah route if it exists). The Tahap 3 C20 price-anomaly hop now has its root in Sinyal Pasar: add the toast-driven UI test for it.
3. Gate: npx tsc -b; region validate; world selftest; ui/shell selftests; viz tests; npm run ai:test; npm run build (dist/, served on 4173); full npm run test:e2e until green (fix minimally; never weaken an assertion without saying why); budgets for all 18 demos with .shots/t3-int/budget.mjs extended to the 5 new slugs and their roles (save as .shots/t4-int/budget.mjs): every landing <= 180 KB first load ID and EN, home JS <= 253.6; home perf once at CPU 1x (tools/perf.mjs) vs docs/perf/tahap1-ab.txt; control-byte grep; git status shows no deleted files. Delete .e2e/dist and test-results afterwards, keep dist/.
4. Report a markdown budget table for all 18 demos (with the change vs Tahap 3), the e2e result, and every remaining defect honestly.`, { label: 'integrate:t4', phase: 'Integrate', schema: { type: 'object', properties: { summary: { type: 'string' }, flipped: { type: 'array', items: { type: 'string' } }, budget: { type: 'string' }, e2e: { type: 'string' }, gates: { type: 'string' }, fixed: { type: 'array', items: { type: 'string' } }, notDone: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'flipped', 'budget', 'e2e', 'gates', 'notDone'] } })

phase('Shots')
const shots = await agent(`${CTX}

YOUR TASK (screenshots, Tahap 4): from the production build on http://127.0.0.1:4173 (dist/ was just rebuilt by the integrator), save screenshots of the 5 Tahap 4 demos (katalog-lokal, rapor-usaha, indeks-ekonomi, sinyal-pasar, inti) to docs/shots/demo/tahap-4/: per demo 1440 ID default role, 390 ID, 1440 EN, one alternative role (or 390 EN if single-role), and 1-2 key "wow" states after the main mission. Adapt .shots/t3-int/shots.mjs into .shots/t4-int/shots.mjs. Save PNGs compressed (they are committed; keep each under ~400 KB). Look at each screenshot you save; check numbers shown in a toast against the screen they land on. Write docs/shots/demo/tahap-4/INDEX.md (one line per file, visible defects noted honestly). Be fast.`, { label: 'shots:t4', phase: 'Shots', effort: 'medium', schema: { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'integer' }, defects: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'defects'] } })

return { kit, products: products.map((p, i) => ({ slug: SLUGS[i], ...(p || { failed: true }) })), integ, shots }
