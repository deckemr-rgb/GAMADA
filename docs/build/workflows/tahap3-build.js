export const meta = {
  name: 'tahap3-build',
  description: 'Tahap 3 Usaha Pintar P8-P13 (lean): kit first, 6 products in parallel, integration + gate, screenshots',
  phases: [
    { title: 'Kit', detail: 'Usaha Pintar world module, events, components (plan §1)' },
    { title: 'Products', detail: '6 builders in parallel with self-checks' },
    { title: 'Integrate', detail: 'DEMO_READY flip, chains C14-C29, e2e, budgets, gate, fixes' },
    { title: 'Shots', detail: 'docs/shots/demo/tahap-3 + INDEX.md' },
  ],
}

const CTX = `Repo: C:/Users/LENOVO/gamada (Vite 8 + React 19 + TS strict, Windows; Git Bash and PowerShell available). Spec: docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md. THE BUILD PLAN IS docs/build/tahap3-plan.md: read §0 (rules, Tahap 2 lessons, self-check) and the sections your task names; it is binding, including §6 owner answers (ALL APPROVED on 2026-11-18: tax table, fictional names, product choices). Kit contracts: src/demo-kit/CONTRACTS.md. Tahap 2 (Satu Daerah P1-P7) is committed (dc96760, plan e72561e; the Tahap 3 kit is partly done in the WIP commit after that, see docs/build/RESUME-TAHAP3.md) and must keep working: its 7 demos must stay <= 180 KB first load and their e2e must stay green.
Servers already running (do not start or stop them): dev http://127.0.0.1:5173 (HMR; use /demo/<slug>?controls=all for demos not yet DEMO_READY, add &e2e=1 for window.__gamada) and preview http://127.0.0.1:4173 serving dist/ live (only the integrator writes dist/).
Owner wants SPEED and "secukupnya": build it right the first time, run your self-check once, fix what fails, report. No extra polishing rounds. Do not commit/push/deploy. Do not edit src-art/. Never write regexes through a shell command that can turn \\b into a backspace byte; before finishing run grep -rlP '[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]' src server/ai-proxy/src server/ai-proxy/prompts tests (must print nothing). Disk C: ~5 GB free: keep scratch small under .shots/t3-<you>/, no traces/videos, delete own dist folders when done.`

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

RESUME NOTE: a previous kit run was stopped by the owner during its final checks. It already built (WIP commit "Tahap 3 WIP: kit ..."): world/eco.ts + up.selftest.ts, docs diff/TextDiff + kyb/cv-data samples, i18n/terbilang.ts, media/camera.ts, ui Chat/MoneyInput/MonthCalendar/fly, engine/reducers/events/types changes, registry loaders. tsc -b passed and world selftest passed 2050/0 at the stop; Tahap 2 e2e was 44 ok / 1 fail (chains-ui "chains 3-6" Siaga => Awas Belanja ..., possibly flaky) when stopped; CONTRACTS.md was NOT yet updated; ai:test and the size check were not finished. Do NOT rebuild from scratch: run git show --stat HEAD, compare against plan §1, add only what is missing, then do the checks below and fix what fails (including that chains 3-6 test, without weakening it).
YOUR TASK (kit agent, Tahap 3): build everything in plan §1 (kit + world APIs for Tahap 3) and the shared parts §3 needs, so the 6 product builders can start right after you. You may edit src/demo-kit/**, src/demos/registry.ts (loaders only, DO NOT flip DEMO_READY), server/ai-proxy/** (shared parts, not product prompt files), vite.config.ts if the lazy ecosystem module needs it, and add selftest checks. Keep the Usaha Pintar world module out of the Satu Daerah boot path and out of home (verify: home initial JS <= 253.6 KB; a quick own build into .shots/t3-kit/dist + preview on 4400 + a copy of .shots/t2-int/budget.mjs: the 7 Satu Daerah demos must not grow by more than 1 KB).
Create each product folder src/demos/<slug>/ with a minimal compiling index.tsx stub ONLY if the registry needs it to compile; builders will replace it.
Checks: npx tsc -b; world selftest (npx tsx src/demo-kit/world/__tests__/world.selftest.ts) incl. new determinism checks for the UP module; ui/shell selftests; npm run ai:test. Document the new APIs in CONTRACTS.md. In kitHandoff list per product slug anything a builder must know that differs from the plan (exact names that changed).`, { label: 'kit:t3', phase: 'Kit', schema: RESULT })

const SLUGS = ['toko-autopilot', 'pajak-beres', 'juara-jualan', 'kenal-mitra', 'pantau-merek', 'tenderpilot']
phase('Products')
const products = await parallel(SLUGS.map((slug, i) => () => agent(`${CTX}

YOUR TASK (builder of ${slug}): build the ${slug} demo exactly per its brief in plan §2, the chains in §3 that involve ${slug}, the size plan in §5, using the kit APIs of §1. You own only src/demos/${slug}/**, server/ai-proxy/prompts/${slug}.ts and tests/e2e/tahap3/${slug}.spec.ts. Five other builders work in parallel in their own folders.
Kit result: ${JSON.stringify((kit && kit.summary) || 'missing: read git diff e72561e -- src/demo-kit and CONTRACTS.md')}
Kit notes: ${JSON.stringify(((kit && kit.kitHandoff) || []).filter((k) => k.includes(slug) || !/^\[?[a-z-]+\]?:/.test(k)))}
Then run the self-check list of §0 / your brief ONCE on the dev server (http://127.0.0.1:5173/demo/${slug}?controls=all): every mission completes by script, 0 console errors, 1440 and 390, ID and EN, every role, reduced motion, alive within 10 s, no dead controls. Measure size with your own build (port ${4401 + i}, see §0) and keep first load <= 175 KB ID and EN. Write the e2e spec (missions + your chain hops). npx tsc --noEmit (report errors in other folders, do not fix them). Fix what fails, then stop.`, { label: `build:${slug}`, phase: 'Products', schema: RESULT })))

phase('Integrate')
const integ = await agent(`${CTX}

YOUR TASK (integrator + gate, Tahap 3): you are the only agent editing now (any file).
Builder results: ${JSON.stringify(products.map((p, i) => ({ slug: SLUGS[i], ...(p ? { summary: p.summary, notDone: p.notDone, kitHandoff: p.kitHandoff, budget: p.budget } : { failed: true }) })))}
1. Resolve kitHandoff items that block correctness (kit side), and builder notDone items that are cheap. Flip DEMO_READY for the 6 Usaha Pintar demos that work; keep a demo unflipped only if it is broken (say why).
2. Verify chains C14-C29 end to end (plan §3) and write tests/e2e/tahap3/chains.spec.ts; make sure the existing no-dead-controls / smoke specs cover the 6 new demos (extend the slug lists).
3. Gate: npx tsc -b; region validate; world selftest; ui/shell selftests; npm run ai:test; npm run build (dist/, served on 4173); full npm run test:e2e until green (fix minimally; never weaken an assertion without saying why); budgets for all 13 demos with a copy of .shots/t2-int/budget.mjs extended to the 6 new slugs (save as .shots/t3-int/budget.mjs): every demo <= 180 KB first load ID and EN, home JS <= 253.6; home perf once at CPU 1x (tools/perf.mjs) vs docs/perf/tahap1-ab.txt; control-byte grep. Delete .e2e/dist and test-results afterwards, keep dist/.
4. Report a markdown budget table for all 13 demos, the e2e result, and every remaining defect honestly.`, { label: 'integrate:t3', phase: 'Integrate', schema: { type: 'object', properties: { summary: { type: 'string' }, flipped: { type: 'array', items: { type: 'string' } }, budget: { type: 'string' }, e2e: { type: 'string' }, gates: { type: 'string' }, fixed: { type: 'array', items: { type: 'string' } }, notDone: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'flipped', 'budget', 'e2e', 'gates', 'notDone'] } })

phase('Shots')
const shots = await agent(`${CTX}

YOUR TASK (screenshots, Tahap 3): from the production build on http://127.0.0.1:4173 (dist/ was just rebuilt by the integrator), save screenshots of the 6 Usaha Pintar demos to docs/shots/demo/tahap-3/: per demo 1440 ID default role, 390 ID, 1440 EN, one alternative role, and 1-2 key "wow" states after the main mission. Adapt .shots/t2-int/shots.mjs into .shots/t3-int/shots.mjs. Look at each screenshot you save. Write docs/shots/demo/tahap-3/INDEX.md (one line per file, visible defects noted honestly). Be fast.`, { label: 'shots:t3', phase: 'Shots', effort: 'medium', schema: { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'integer' }, defects: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'defects'] } })

return { kit, products: products.map((p, i) => ({ slug: SLUGS[i], ...(p || { failed: true }) })), integ, shots }
