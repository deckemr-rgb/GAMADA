/**
 * Tahap 7 · INP (plan docs/build/tahap7-plan.md §3.2, measurer M).
 *
 * Production build (vite preview), Chrome, CPU throttling ×4 (CDP Emulation.setCPUThrottlingRate, switched on once the
 * page is ready, so load time is not part of it), 390×844 (3 runs) and 1440×900 (1 run); the worst run counts.
 * Every click in a scenario is measured: an Event Timing observer (durationThreshold 16) collects the entries of each
 * interaction id that starts after the click's mark, the action's value = max duration (< 16 ms reads as 16). The
 * long animation frames overlapping the worst interaction give the attribution (script URL, function, invoker).
 * web-vitals (attribution build, from node_modules, injected by addInitScript) reports the page INP as a cross-check.
 *
 * Pass: every measured interaction ≤ 200 ms at ×4 on 390 (`key` actions are the ones the plan lists; preparatory
 * clicks are measured and reported too). An action that cannot be reached is reported as `unreached` (soft fail).
 * Fragments go to $T7_FRAG/inp/; each worker's afterAll merges them into docs/build/tahap7-inp.json (worst per action).
 *
 * Note: numbers depend on the machine and on what else runs on it; run with --workers=1 or 2 for the final table.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { closeGuide, openDemo, type Slug } from '../tahap2/helpers'
import { open as openSite, PHONE } from '../tahap6/helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any

const FRAG = process.env.T7_FRAG ?? '.shots/t7-m/frag'
const OUT = 'docs/build/tahap7-inp.json'
const LIMIT = 200
const RATE = 4
const RUNS: Record<'390' | '1440', number> = { '390': Number(process.env.T7_INP_RUNS ?? 3), '1440': 1 }

const WV = readFileSync('node_modules/web-vitals/dist/web-vitals.attribution.iife.js', 'utf8')
const OBSERVE = `
(() => {
  const w = window; w.__inp = { ev: [], loaf: [], wv: null };
  const desc = (t) => { if (!t || !t.tagName) return ''; const c = (t.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.'); const d = [...t.attributes].find((a) => a.name.startsWith('data-') && a.name !== 'data-split'); return t.tagName.toLowerCase() + (c ? '.' + c : '') + (d ? '[' + d.name + '="' + d.value + '"]' : ''); };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) w.__inp.ev.push({ id: e.interactionId, name: e.name, st: e.startTime, d: e.duration, ps: e.processingStart, pe: e.processingEnd, t: desc(e.target) }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { w.__inp.loaf.push({ st: e.startTime, d: e.duration, b: e.blockingDuration, s: (e.scripts || []).map((s) => ({ u: (s.sourceURL || '').replace(location.origin, ''), f: s.sourceFunctionName || '', i: s.invoker || '', d: Math.round(s.duration) })).sort((a, b) => b.d - a.d).slice(0, 3) }); if (w.__inp.loaf.length > 400) w.__inp.loaf.shift(); } }).observe({ type: 'long-animation-frame', buffered: true }); } catch {}
  try { w.webVitals.onINP((m) => { w.__inp.wv = { v: Math.round(m.value), target: m.attribution && m.attribution.interactionTarget, type: m.attribution && m.attribution.interactionType }; }, { reportAllChanges: true }); } catch {}
})();`

interface Act {
  label: string
  key: boolean
  ms: number | null
  target?: string
  loaf?: { d: number; b: number; s: { u: string; f: string; i: string; d: number }[] }[]
  error?: string
}

type Area = 'P1' | 'P2' | 'P3' | 'P4'

class Meter {
  acts: Act[] = []
  constructor(readonly page: Page) {}

  /** click `loc` (first match) and measure the interaction(s) it starts */
  async click(label: string, loc: Locator, o: { key?: boolean; after?: number; optional?: boolean; dbl?: boolean } = {}): Promise<boolean> {
    const el = loc.first()
    try {
      await el.waitFor({ state: 'visible', timeout: 15_000 })
      await expect(el).toBeEnabled({ timeout: 15_000 })
      const mark = await this.page.evaluate(() => performance.now())
      await el.click({ timeout: 10_000 })
      await this.page.waitForTimeout(o.after ?? 900)
      const r = await this.page.evaluate((mark) => {
        const s = (window as G).__inp
        if (!s) return null
        const evs = s.ev.filter((e: G) => e.st >= mark - 5)
        if (!evs.length) return { ms: 16, target: '', loaf: [] }
        const worst = evs.reduce((a: G, b: G) => (b.d > a.d ? b : a))
        const end = worst.st + worst.d
        const loaf = s.loaf.filter((f: G) => f.st < end && f.st + f.d > worst.st).map((f: G) => ({ d: Math.round(f.d), b: Math.round(f.b), s: f.s }))
        return { ms: Math.max(16, Math.round(worst.d)), target: `${worst.name} ${worst.t}`, loaf: loaf.slice(0, 3) }
      }, mark)
      this.acts.push({ label, key: !!o.key, ms: r?.ms ?? null, target: r?.target, loaf: r?.loaf, ...(r ? {} : { error: 'observer missing' }) })
      return true
    } catch (e) {
      this.acts.push({ label, key: !!o.key, ms: null, error: (o.optional ? 'optional, not reached: ' : 'not reached: ') + String((e as Error).message).split('\n')[0]!.slice(0, 160) })
      return false
    }
  }
}

async function throttle(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
}

async function demo(page: Page, slug: Slug, extra?: string): Promise<void> {
  await openDemo(page, slug, extra ? { extra } : {})
  await closeGuide(page).catch(() => undefined)
  await throttle(page)
}

const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 640
const $ = (p: Page, s: string) => p.locator(s)

interface Scenario {
  id: string
  area: Area
  hint: string
  run: (m: Meter, p: Page) => Promise<void>
}

const SCENARIOS: Scenario[] = [
  { id: 'sapa-warga · Kirim aduan', area: 'P1', hint: 'src/demos/sapa-warga/', run: async (m, p) => {
    await demo(p, 'sapa-warga')
    await m.click('persona Siti', $(p, '[data-sw="persona-siti"]'), { optional: true })
    await m.click('foto banjir', $(p, '[data-sw="quick-photo"]'))
    await m.click('Kirim aduan', $(p, '[data-sw="send"]'), { key: true, after: 1500 })
  } },
  { id: 'meja-pimpinan · Susun briefing', area: 'P1', hint: 'src/demos/meja-pimpinan/', run: async (m, p) => {
    await demo(p, 'meja-pimpinan')
    await m.click('Susun briefing', $(p, '[data-hotspot="briefing"]'), { key: true, after: 1500 })
  } },
  { id: 'naskah-pintar · Putar rapat contoh', area: 'P1', hint: 'src/demos/naskah-pintar/', run: async (m, p) => {
    await demo(p, 'naskah-pintar')
    await m.click('Putar rapat contoh', $(p, '[data-np="play"]'), { key: true, after: 1500 })
  } },
  { id: 'radar-isu · Kirim klarifikasi', area: 'P1', hint: 'src/demos/radar-isu/', run: async (m, p) => {
    await demo(p, 'radar-isu')
    await m.click('picu hoaks', $(p, '.dk-ri-hoax-cta'), { after: 2500 })
    await m.click('Susun klarifikasi', $(p, '.dk-ri-hoax-act .dk-btn--primary'), { key: true, after: 1500 })
    await m.click('Kirim klarifikasi (publish)', $(p, '[data-testid="ri-publish"]'), { key: true, after: 1500 })
  } },
  { id: 'siaga-wilayah · Kirim peringatan + layer', area: 'P1', hint: 'src/demos/siaga-wilayah/', run: async (m, p) => {
    await demo(p, 'siaga-wilayah')
    await m.click('prakiraan +6 jam', $(p, '[data-sw="cta"]'), { after: 4000 })
    await m.click('buka peringatan', $(p, '[data-sw="cta"]'), { after: 1200 })
    await m.click('Kirim peringatan', $(p, '[data-sw="bc-send"]'), { key: true, after: 1500 })
    await m.click('selesai', $(p, '[data-sw="bc-done"]'), { optional: true })
    await m.click('Layer', $(p, '[data-sw="layers"]'))
    await m.click('layer toggle (citra satelit)', p.getByRole('switch', { name: /Citra satelit/ }), { key: true, after: 1500 })
  } },
  { id: 'awas-belanja · Analisis paket', area: 'P1', hint: 'src/demos/awas-belanja/', run: async (m, p) => {
    await demo(p, 'awas-belanja')
    await m.click('buka paket pompa', $(p, '[data-hotspot="ab-start"]'), { after: 2000 })
    await m.click('Analisis paket', p.getByRole('button', { name: 'Jalankan analisis' }), { key: true, after: 2000 })
  } },
  { id: 'cek-berkas · Verifikasi 50 berkas', area: 'P1', hint: 'src/demos/cek-berkas/', run: async (m, p) => {
    await demo(p, 'cek-berkas')
    await m.click('mode Massal', p.getByRole('radio', { name: 'Massal' }).or(p.getByRole('button', { name: 'Massal', exact: true })))
    await m.click('Verifikasi 50 berkas', $(p, '.dk-cb-bulk [data-hotspot="cek-go"]'), { key: true, after: 2500 })
  } },
  { id: 'toko-autopilot · Bayar', area: 'P2', hint: 'src/demos/toko-autopilot/', run: async (m, p) => {
    await demo(p, 'toko-autopilot')
    await m.click('tab Kasir', $(p, '#dk-ta-tab-kasir'), { optional: true })
    await m.click('tambah barang', $(p, '.dk-ta-item:not([disabled])'))
    if (isPhone(p)) await m.click('buka keranjang', $(p, '[data-ta="cart-bar"]'))
    await m.click('Bayar', $(p, '[data-ta="pay"]'), { key: true })
    await m.click('QRIS', p.getByRole('radio', { name: 'QRIS', exact: true }))
    await m.click('Bayar QRIS', $(p, '[data-ta="qris-pay"]'), { key: true, after: 1500 })
  } },
  { id: 'pajak-beres · Proses nota', area: 'P2', hint: 'src/demos/pajak-beres/', run: async (m, p) => {
    await demo(p, 'pajak-beres')
    await $(p, '[data-hotspot="pb-process"]').first().hover().catch(() => undefined)
    await p.waitForTimeout(3000)
    await m.click('Proses nota', $(p, '[data-hotspot="pb-process"]'), { key: true, after: 2500 })
  } },
  { id: 'juara-jualan · Putar panggilan', area: 'P2', hint: 'src/demos/juara-jualan/', run: async (m, p) => {
    await demo(p, 'juara-jualan')
    if (isPhone(p)) await m.click('momen merah (buka panggilan)', $(p, '[data-hotspot="jj-marker-danger"]'), { after: 1500 })
    await m.click('Putar panggilan', $(p, '.dk-jj-playbtn'), { key: true, after: 1500 })
  } },
  { id: 'kenal-mitra · Saring 200 CV', area: 'P2', hint: 'src/demos/kenal-mitra/', run: async (m, p) => {
    await demo(p, 'kenal-mitra')
    await m.click('tab CV', $(p, '.dk-km-tabs [role=tab][id$="-t-cv"]'))
    await m.click('unggah 200 CV', $(p, '[data-km="upload"]'), { after: 1500 })
    await m.click('Saring 200 CV', $(p, isPhone(p) ? '.dk-km-cv-left > .dk-km-row [data-km="screen"]' : '[data-km="screen"]'), { key: true, after: 2500 })
  } },
  { id: 'pantau-merek · Kirim 5 balasan', area: 'P2', hint: 'src/demos/pantau-merek/', run: async (m, p) => {
    await demo(p, 'pantau-merek')
    await m.click('tab Ulasan', p.getByRole('tab', { name: /Ulasan/ }))
    await m.click('pilih 5', $(p, '[data-pm="select-alert-5"]'))
    await m.click('buka balasan massal', $(p, '[data-pm="bulk-open"]'), { after: 2500 })
    await m.click('nada formal', $(p, '[data-pm="tone-formal"]'), { after: 2500 })
    await m.click('Kirim 5 balasan', $(p, '[data-pm="bulk-send"]'), { key: true, after: 1500 })
  } },
  { id: 'tenderpilot · Susun dokumen', area: 'P2', hint: 'src/demos/tenderpilot/', run: async (m, p) => {
    await demo(p, 'tenderpilot')
    await m.click('buka tender', $(p, '[data-hotspot="tp-open"]').filter({ visible: true }))
    await m.click('ke Dokumen', $(p, '[data-tp="to-doc"]'))
    await m.click('Susun dokumen', $(p, '[data-tp="compose"]'), { key: true, after: 2500 })
  } },
  { id: 'katalog-lokal · Terbitkan + flip', area: 'P2', hint: 'src/demos/katalog-lokal/', run: async (m, p) => {
    await demo(p, 'katalog-lokal')
    await m.click('contoh kebutuhan', $(p, '[data-hotspot="kl-example"]'), { after: 1500 })
    await m.click('Terbitkan', $(p, '[data-kl="publish"]'), { key: true, after: 2000 })
    await m.click('flip ke sisi UMKM', $(p, '[data-kl="side-toggle"]'), { key: true, after: 1500 })
  } },
  { id: 'rapor-usaha · Setujui 3 saran', area: 'P2', hint: 'src/demos/rapor-usaha/', run: async (m, p) => {
    await demo(p, 'rapor-usaha')
    await m.click('Rapikan jurnal', $(p, '[data-ru="fix"]'))
    await m.click('Setujui 3 saran', $(p, '[data-ru="approve-reviews"]'), { key: true, after: 2000 })
  } },
  { id: 'indeks-ekonomi · Play frame', area: 'P2', hint: 'src/demos/indeks-ekonomi/', run: async (m, p) => {
    await demo(p, 'indeks-ekonomi')
    await m.click('Play frame', $(p, '[data-hotspot="ie-play"] .dk-mts-play'), { key: true, after: 2000 })
  } },
  { id: 'sinyal-pasar · Simulasikan', area: 'P2', hint: 'src/demos/sinyal-pasar/', run: async (m, p) => {
    await demo(p, 'sinyal-pasar')
    await m.click('putar banjir', $(p, '[data-sp="play-flood"]'), { after: 2500 })
    await m.click('buka anomali', $(p, '.dk-sp-rowbtn[data-hotspot="sp-anomaly"]'), { optional: true })
    await p.keyboard.press('Escape').catch(() => undefined)
    await m.click('tab Operasi', $(p, '#dk-sp-tab-operasi'))
    await m.click('Simulasikan', $(p, '[data-sp="simulate"]'), { key: true, after: 2000 })
  } },
  { id: 'inti · replay story', area: 'P2', hint: 'src/demos/inti/', run: async (m, p) => {
    await demo(p, 'inti')
    await m.click('Putar ulang cerita', $(p, '[data-in="play"]'), { key: true, after: 2500 })
  } },
  { id: '/tur · Mulai, next, Ambil alih, Ringkasan', area: 'P4', hint: 'src/demo-kit/tour/', run: async (m, p) => {
    await p.goto('/tur?e2e=1&off=preloader')
    await p.waitForFunction(() => !!(window as G).__gamadaTour, null, { timeout: 30_000 })
    await throttle(p)
    await m.click('Mulai tur', $(p, '[data-tour-ctl="start"]'), { key: true, after: 2500 })
    await p.waitForFunction(() => (window as G).__gamadaTour?.state.phase === 'player', null, { timeout: 30_000 }).catch(() => undefined)
    await m.click('bab berikutnya', $(p, '[data-tour-ctl="next"], [data-tour-ctl="next-peek"]').filter({ visible: true }), { key: true, after: 2500 })
    // Ambil alih: chapter 4 (Sapa Warga) shows its entity, paused
    await p.goto('/tur/4?e2e=1&off=preloader&rate=8')
    await p.waitForFunction(() => !!(window as G).__gamadaTour, null, { timeout: 30_000 })
    await throttle(p)
    await m.click('putar bab 4', $(p, '[data-tour-ctl="play-chapter"]'), { after: 1000 })
    await p.waitForFunction(() => { const s = (window as G).__gamadaTour?.state; return s && s.n === 4 && !s.busy && s.stage?.focus }, null, { timeout: 90_000, polling: 200 }).catch(() => undefined)
    await p.evaluate(() => (window as G).__gamadaTour?.engine?.pause?.())
    if (isPhone(p)) await m.click('buka lembar', $(p, '[data-tour-ctl="sheet"]'), { optional: true })
    await m.click('Ambil alih', $(p, isPhone(p) ? '.dk-tour-sheet [data-tour="takeover"]' : '[data-tour="takeover"]'), { key: true, after: 2500 })
    // Ringkasan: chapter 20 is the summary
    await p.goto('/tur/20?e2e=1&off=preloader&rate=8')
    await p.waitForFunction(() => !!(window as G).__gamadaTour, null, { timeout: 30_000 })
    await throttle(p)
    await m.click('Ringkasan (putar bab 20)', $(p, '[data-tour-ctl="play-chapter"]'), { key: true, after: 2500 })
  } },
  { id: '/ekosistem · star click', area: 'P4', hint: 'src/routes/eco/Constellation.tsx', run: async (m, p) => {
    // there is no filter control on /ekosistem (stars + hulls only): the star preview / open is measured instead
    await openSite(p, '/ekosistem')
    await throttle(p)
    await m.click('bintang Sapa Warga', $(p, '.cst-btn[data-slug="sapa-warga"]'), { key: true, after: 2000 })
    if (isPhone(p)) await m.click('bintang Sapa Warga (buka)', $(p, '.cst-btn[data-slug="sapa-warga"]'), { key: true, after: 2000, optional: true })
  } },
  { id: 'region switch (siaga-wilayah, map fly)', area: 'P3', hint: 'src/demo-kit/shell/controls.tsx (RegionSwitcher) · src/demo-kit/map/', run: async (m, p) => {
    await demo(p, 'siaga-wilayah')
    if (isPhone(p)) await m.click('Kontrol lainnya', p.locator('[data-dk-more]'))
    const trigger = isPhone(p) ? p.locator('.dk-more-sec').getByRole('radio', { name: /Bandung/ }) : p.locator('.dk-topbar').getByRole('button', { name: /Pilih wilayah|Choose region/i })
    if (!(await trigger.count())) {
      m.acts.push({ label: 'region switch', key: true, ms: null, error: 'skipped: no region picker in this build (REGIONS has 1 entry until the integrator registers the packs)' })
      return
    }
    if (!isPhone(p)) {
      await m.click('buka pemilih wilayah', trigger)
      await m.click('Kota Bandung', p.getByRole('option', { name: /Bandung/ }).or(p.getByRole('menuitemradio', { name: /Bandung/ })).or(p.getByRole('radio', { name: /Bandung/ })), { key: true, after: 3000 })
    } else await m.click('Kota Bandung', trigger, { key: true, after: 3000 })
  } },
  { id: 'language switch (sapa-warga)', area: 'P3', hint: 'src/demo-kit/shell/controls.tsx (LangToggle) · src/demo-kit/i18n/', run: async (m, p) => {
    await demo(p, 'sapa-warga')
    if (isPhone(p)) await m.click('Kontrol lainnya', p.locator('[data-dk-more]'))
    const root = isPhone(p) ? p.locator('.dk-more-sec .dk-lang') : p.locator('.dk-topbar .dk-lang')
    await m.click('EN', root.getByText('EN', { exact: true }), { key: true, after: 2000 })
  } },
]

function save(name: string, row: unknown): void {
  mkdirSync(join(FRAG, 'inp'), { recursive: true })
  writeFileSync(join(FRAG, 'inp', `${name.replace(/[^a-z0-9-]+/gi, '_')}.json`), JSON.stringify(row))
}

function mergeInp(): void {
  let frags: G[] = []
  try {
    frags = readdirSync(join(FRAG, 'inp')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(FRAG, 'inp', f), 'utf8')))
  } catch {
    return
  }
  // worst per (scenario, viewport, action) over the runs
  const by = new Map<string, G>()
  for (const f of frags) {
    for (const a of f.acts as Act[]) {
      const k = `${f.scenario}|${f.viewport}|${a.label}`
      const cur = by.get(k)
      const runs = (cur?.runs ?? []).concat(a.ms)
      if (!cur || (a.ms ?? -1) > (cur.ms ?? -1)) by.set(k, { scenario: f.scenario, area: f.area, hint: f.hint, viewport: f.viewport, label: a.label, key: a.key, ms: a.ms, target: a.target, loaf: a.loaf, error: a.error, runs })
      else cur.runs = runs
    }
  }
  const rows = [...by.values()].sort((a, b) => (a.scenario + a.viewport).localeCompare(b.scenario + b.viewport))
  const over = rows.filter((r) => r.ms !== null && r.ms > LIMIT)
  const pageInp = frags.map((f) => ({ scenario: f.scenario, viewport: f.viewport, run: f.run, webVitalsINP: f.wv }))
  const out = {
    generated: new Date().toISOString(),
    method: `Playwright + Event Timing (durationThreshold 16) + LoAF attribution; web-vitals ${JSON.parse(readFileSync('node_modules/web-vitals/package.json', 'utf8')).version} attribution build as cross-check; Chrome, CPU ×${RATE}, vite preview build; 390×844 ×${RUNS['390']} runs, 1440×900 ×${RUNS['1440']}; worst run reported; < 16 ms reads as 16`,
    limit: LIMIT,
    summary: {
      measured: rows.filter((r) => r.ms !== null).length,
      over: over.length,
      overByArea: over.reduce((m: Record<string, number>, r) => ((m[r.area] = (m[r.area] ?? 0) + 1), m), {}),
      unreached: rows.filter((r) => r.ms === null).map((r) => `${r.scenario} @${r.viewport}: ${r.label} (${r.error})`),
      worst: rows.filter((r) => r.ms !== null).sort((a, b) => b.ms - a.ms).slice(0, 10).map((r) => `${r.ms} ms · ${r.scenario} @${r.viewport} · ${r.label}`),
    },
    rows,
    pageInp,
  }
  mkdirSync('docs/build', { recursive: true })
  writeFileSync(OUT, JSON.stringify(out, null, 1))
}

test.afterAll(() => mergeInp())
test.describe.configure({ timeout: 240_000 })

for (const vp of ['390', '1440'] as const) {
  test.describe(`INP @${vp}`, () => {
    if (vp === '390') test.use({ ...PHONE })
    for (const sc of SCENARIOS) {
      for (let run = 1; run <= RUNS[vp]; run++) {
        test(`${sc.id} @${vp} run ${run}`, async ({ page }) => {
          await page.addInitScript({ content: `${WV}\n${OBSERVE}` })
          const m = new Meter(page)
          let fatal: string | undefined
          try {
            await sc.run(m, page)
          } catch (e) {
            fatal = String((e as Error).message).split('\n')[0]!.slice(0, 200)
            m.acts.push({ label: '(scenario setup)', key: true, ms: null, error: fatal })
          }
          const wv = await page.evaluate(() => (window as G).__inp?.wv ?? null).catch(() => null)
          save(`${sc.id}-${vp}-${run}`, { scenario: sc.id, area: sc.area, hint: sc.hint, viewport: vp, run, acts: m.acts, wv })
          if (vp === '390') {
            for (const a of m.acts) if (a.ms !== null) expect.soft(a.ms, `${a.label} ≤ ${LIMIT} ms`).toBeLessThanOrEqual(LIMIT)
          }
          for (const a of m.acts.filter((x) => x.key && x.ms === null && !/^skipped|^optional/.test(x.error ?? ''))) expect.soft(a.error, `${a.label} reachable`).toBeUndefined()
        })
      }
    }
  })
}

