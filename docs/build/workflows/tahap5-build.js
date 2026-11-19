export const meta = {
  name: 'tahap5-build',
  description: 'Tahap 5 tour "Satu Hari di Bojonegoro" (lean): kit K1-K7, one tour builder, integration + gate, screenshots',
  phases: [
    { title: 'Kit', detail: 'plan §1.3 K1-K7 + the 5 data-* hooks' },
    { title: 'Tour', detail: 'src/demo-kit/tour + /tur route, 20 chapters, tests' },
    { title: 'Integrate', detail: 'gate, e2e, budgets, fixes' },
    { title: 'Shots', detail: 'docs/shots/demo/tahap-5 + INDEX.md' },
  ],
}

const CTX = `Repo: C:/Users/LENOVO/gamada (Vite 8 + React 19 + TS strict, Windows; Git Bash and PowerShell available). Spec: docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md §12. THE BUILD PLAN IS docs/build/tahap5-plan.md: read §0 (rules + self-check) and the sections your task names; it is binding, including §6 owner answers (ALL APPROVED on 2026-11-19, "oke semua"). Kit contracts: src/demo-kit/CONTRACTS.md (Tahap 3 and Tahap 4 sections). Tahap 2-4 (18 demos: Satu Daerah, Usaha Pintar, Pasar Daerah, Inti) are committed and must keep working: every demo <= 180 KB first load, their e2e must stay green, home JS <= 253.6 KB.
Servers already running (do not start or stop them): dev http://127.0.0.1:5173 (HMR) and preview http://127.0.0.1:4173 serving dist/ live (only the integrator writes dist/).
Owner wants SPEED and "secukupnya": build it right the first time, run your self-check once, fix what fails, report. No extra polishing rounds. Do not commit/push/deploy. Do not edit src-art/. Never write regexes through a shell command that can turn \\b into a backspace byte; before finishing run grep -rlP '[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]' src server/ai-proxy/src server/ai-proxy/prompts tests (must print nothing). DISK C: IS NEARLY FULL: keep scratch tiny under .shots/t5-<you>/, no traces/videos/sourcemaps, delete your own dist right after each measurement. Do not delete anything else under .shots/.`

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

phase('Kit')
const kit = await agent(`${CTX}

YOUR TASK (kit agent, Tahap 5): build plan §1.3 K1-K7 and add the 5 missing data-* hooks from plan §1 (po-approve, mp-ask + mp-ask-send, sw-recipients, cb-bulk, ri-clarify) as attributes only, with no behaviour change in those products. First check that the Tahap 4 parts the tour needs exist (world/story.ts DAY_STORY/playDayStory, chains C30-C38, world/inti); if one is missing, say so in notDone and build what you can. You may edit src/demo-kit/**, src/routes/** (router entries for /tur), the 5 product files that get a hook attribute, and selftests. Checks: npx tsc -b; world selftest incl. the K6 determinism probe; ui/shell selftests; the existing chain specs (tests/e2e/chains.spec.ts, tests/e2e/tahap3/chains.spec.ts, tests/e2e/tahap4/chains.spec.ts) against the dev server; home JS <= 253.6 KB and the 18 demos not grown by more than 0.5 KB (own build into .shots/t5-kit/dist + preview on 4400 + .shots/t4-int/budget.mjs; delete the dist afterwards). Document the new APIs in CONTRACTS.md (section "Tahap 5"). In handoff list anything the tour builder must know that differs from the plan.`, { label: 'kit:t5', phase: 'Kit', schema: RESULT })

phase('Tour')
const tour = await agent(`${CTX}

YOUR TASK (tour builder): build plan §1.2 (src/demo-kit/tour/), §2 all 20 chapters, §3 layout and controls (incl. presenter mode, summary with 6 numbers, PDF via print dialog, WhatsApp share), §4 size plan and §5 tests (tests/e2e/tahap5/tour.spec.ts). You own src/demo-kit/tour/**, the /tur route files the plan names, tour strings, and tests/e2e/tahap5/**.
Kit result: ${JSON.stringify((kit && kit.summary) || 'missing: read git diff HEAD -- src/demo-kit and CONTRACTS.md "Tahap 5"')}
Kit notes: ${JSON.stringify((kit && kit.handoff) || [])}
Self-check once on the dev server (http://127.0.0.1:5173/tur): autoplay of all 20 chapters at 1440 and 390, each chapter opened directly, Ambil alih and Kembali ke tur, numbers agree across screens, ID and EN, reduced motion, keyboard, 0 console errors, no dead controls, the sandbox world untouched by the tour. Measure /tur first load with your own build (port 4401; delete the dist after) and keep it <= 175 KB, and the per-chapter add-on <= 12 KB above the product. npx tsc --noEmit. Fix what fails, then stop.`, { label: 'build:tour', phase: 'Tour', schema: RESULT })

phase('Integrate')
const integ = await agent(`${CTX}

YOUR TASK (integrator + gate, Tahap 5): you are the only agent editing now (any file).
Tour builder result: ${JSON.stringify(tour ? { summary: tour.summary, notDone: tour.notDone, handoff: tour.handoff, budget: tour.budget } : { failed: true })}
1. Fix what blocks correctness from the builder's notDone/handoff if cheap. Link the tour where the plan says (home/navbar entry only if the plan says Tahap 5 owns it; otherwise leave site pages for Tahap 6).
2. Gate: npx tsc -b; region validate; world selftest; ui/shell selftests; viz tests; npm run ai:test; npm run build (dist/, served on 4173); full npm run test:e2e until green (fix minimally; never weaken an assertion without saying why); budgets with .shots/t4-int/budget.mjs extended to /tur (save as .shots/t5-int/budget.mjs): /tur and all 18 demos <= 180 KB first load ID and EN, home JS <= 253.6; home perf once at CPU 1x (tools/perf.mjs) vs docs/perf/tahap1-ab.txt; control-byte grep; git status shows no deleted files. Delete .e2e/dist and test-results afterwards, keep dist/.
3. Report: budget table (/tur + 18 demos, change vs Tahap 4), e2e result, every remaining defect honestly.`, { label: 'integrate:t5', phase: 'Integrate', schema: { type: 'object', properties: { summary: { type: 'string' }, budget: { type: 'string' }, e2e: { type: 'string' }, gates: { type: 'string' }, fixed: { type: 'array', items: { type: 'string' } }, notDone: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'budget', 'e2e', 'gates', 'notDone'] } })

phase('Shots')
const shots = await agent(`${CTX}

YOUR TASK (screenshots, Tahap 5): from the production build on http://127.0.0.1:4173, save screenshots of the tour to docs/shots/demo/tahap-5/: the opening screen (1440 ID, 390 ID, 1440 EN), the chapter list, 6-8 key chapters mid-play at 1440 (incl. the flood, a cross-product hand-off, a Tahap 4 product chapter), one chapter at 390, an Ambil alih product with the "Kembali ke tur" button, presenter mode, and the summary screen. Adapt .shots/t4-int/shots.mjs into .shots/t5-int/shots.mjs. Save PNGs compressed (each under ~400 KB). Look at each screenshot; check numbers shown against the screens they refer to. Write docs/shots/demo/tahap-5/INDEX.md (one line per file, visible defects noted honestly). Be fast.`, { label: 'shots:t5', phase: 'Shots', effort: 'medium', schema: { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'integer' }, defects: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'defects'] } })

return { kit, tour, integ, shots }
