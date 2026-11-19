/**
 * Playwright smoke tests (spec §15). `npm run test:e2e` builds the site into .e2e/dist and serves it with
 * `vite preview` on port 4190, then runs tests/e2e/*.spec.ts in the installed Google Chrome (channel 'chrome',
 * no browser download). The build sets VITE_AI_PROXY_URL='' (same origin) so the AI health check really hits
 * /api/ai/health, which the tests stub or block per test.
 */
import { defineConfig } from '@playwright/test'

const PORT = 4190
const OUT = '.e2e/dist'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // 3 locally since tahap 4 (260 tests, 18 demos): with 4, the heaviest no-dead-controls crawls (Juara Jualan, Pantau
  // Merek) time out on clicks while other workers load their demos; they pass alone and with 3 workers
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite build --outDir ${OUT} --emptyOutDir --logLevel warn && npx vite preview --outDir ${OUT} --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    env: { VITE_AI_PROXY_URL: '' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
