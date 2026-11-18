/**
 * Browser self-tests for the DemoShell (no framework, headless Chrome over CDP against a running dev/preview server):
 *   node src/demo-kit/shell/__tests__/shell.selftest.mjs [baseUrl=http://127.0.0.1:5173] [only=fit,touch,focus,lang,live,interim,gutter]
 *
 * 1. fit     — the TopBar never overflows at 1280 / 1366 / 1440 / 1600 for the longest product name + role (indeks-ekonomi,
 *              siaga-wilayah?role=kepala-daerah, toko-autopilot, sapa-warga?role=petugas; full bar via the dev-only
 *              ?controls=all), in ID and EN:
 *              .dk-topbar-mid scrollWidth <= clientWidth, .dk-topbar scrollWidth <= clientWidth, and the last control
 *              of the middle group ends left of .dk-topbar-end.
 * 2. touch   — 390 px (mobile emulation): every interactive element in the "⋯" sheet is >= 44 px tall (spec §6.3).
 * 3. focus   — closing the guide (Esc or its close button) returns focus to the "?" toggle (desktop) or to "⋯" (mobile).
 * 4. lang    — client-side navigation to /demo/:slug?lang=en switches the language (the URL keeps lang=en).
 * 5. live    — tapping the disabled "Live" pill in the sheet shows its reason (visible helper text / toast).
 * 6. interim — on a placeholder canvas the shell shows no role / clock / AI / reset controls; the "Yang akan bisa Anda
 *              coba" panel shows the ?t time and the ?role chip as current, and holds no button / input.
 * 7. gutter  — placeholder at 390 px: the title and the preview panel start 16 px (± 2) from the viewport edge.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '')
const ONLY = (process.argv[3] || 'fit,touch,focus,lang,live,interim,gutter').split(',')
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fails = 0
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`)
  else {
    fails++
    console.log(`  FAIL ${msg}`)
  }
}

async function browser() {
  const port = 9800 + Math.floor(Math.random() * 150)
  const prof = mkdtempSync(join(tmpdir(), 'dk-shell-'))
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
  let targets = []
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      if (targets.find((t) => t.type === 'page')) break
    } catch {
      /* not up yet */
    }
    await sleep(200)
  }
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let id = 0
  const pending = new Map()
  const errors = []
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)
  })
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id
      pending.set(i, r)
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? null
  }
  const key = async (k, code) => {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: code })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code })
    await sleep(150)
  }
  const tap = async (x, y) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(300)
  }
  await send('Runtime.enable')
  await send('Page.enable')
  /** navigate, then wait (up to 15 s) for `ready` to match, then `wait` ms more for layout / fonts to settle */
  const open = async (path, w, h, mobile = false, wait = 800, ready = '.dk-topbar') => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile })
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile })
    // mark the old document first: Page.navigate returns before the new one commits, and the previous page also
    // matched `ready` (a false "ready" while the next route was still loading)
    await ev(`window.__dkOld = 1`)
    await send('Page.navigate', { url: BASE + path })
    for (let i = 0; i < 75 && !(await ev(`!window.__dkOld && !!document.querySelector(${JSON.stringify(ready)})`)); i++) await sleep(200)
    await ev(`document.fonts ? document.fonts.ready.then(() => 1) : 1`)
    await sleep(wait)
  }
  const close = async () => {
    ws.close()
    const exited = proc.exitCode !== null ? Promise.resolve() : new Promise((r) => proc.once('exit', r))
    try {
      proc.kill()
    } catch {
      /* gone */
    }
    await Promise.race([exited, sleep(5000)])
    for (let i = 0; i < 40; i++) {
      try {
        rmSync(prof, { recursive: true, force: true })
        return
      } catch {
        await sleep(250)
      }
    }
  }
  return { send, ev, key, tap, open, close, errors }
}

const MEASURE_BAR = `(() => {
  const bar = document.querySelector('.dk-topbar'); const mid = bar && bar.querySelector('.dk-topbar-mid'); const end = bar && bar.querySelector('.dk-topbar-end')
  if (!bar || !mid || !end) return null
  const kids = [...mid.children].filter((c) => c.getBoundingClientRect().width > 0)
  const right = Math.max(0, ...kids.map((c) => c.getBoundingClientRect().right))
  const crumbs = bar.querySelector('.dk-crumbs-name')
  return { size: bar.className, midSW: mid.scrollWidth, midCW: mid.clientWidth, barSW: bar.scrollWidth, barCW: bar.clientWidth,
    midRight: Math.round(right), endLeft: Math.round(end.getBoundingClientRect().left),
    nameCut: crumbs ? crumbs.scrollWidth > crumbs.clientWidth + 1 : null, tight: bar.getAttribute('data-tight') }
})()`

const SMALL = `((root) => {
  const els = [...root.querySelectorAll('a[href], button, input, select, textarea, [role=radio], [role=tab]')]
  return els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    .map((e) => { const r = e.getBoundingClientRect(); return { name: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24), h: Math.round(r.height), w: Math.round(r.width) } })
    .filter((x) => x.h < 44)
})`

async function fit(b) {
  console.log('fit: the top bar never overflows')
  // ?controls=all (dev only, routes/Demo.tsx): the full bar even on a placeholder canvas — the worst case
  const routes = ['/demo/indeks-ekonomi?controls=all', '/demo/siaga-wilayah?controls=all&role=kepala-daerah', '/demo/toko-autopilot?controls=all', '/demo/sapa-warga?controls=all&role=petugas', '/lab/_kit?only=shell']
  for (const lang of ['id', 'en'])
    for (const w of [1280, 1366, 1440, 1600])
      for (const r of routes) {
        const sep = r.includes('?') ? '&' : '?'
        await b.open(`${r}${sep}lang=${lang}`, w, 900, false, 600)
        const m = await b.ev(MEASURE_BAR)
        if (!m) {
          ok(false, `${w} ${lang} ${r}: no top bar`)
          continue
        }
        const pass = m.midSW <= m.midCW && m.barSW <= m.barCW && m.midRight <= m.endLeft && !m.nameCut
        ok(pass, `${w} ${lang} ${r}: mid ${m.midSW}/${m.midCW} bar ${m.barSW}/${m.barCW} midRight ${m.midRight} <= endLeft ${m.endLeft}${m.nameCut ? ' NAME CUT' : ''}${m.tight ? ` (tight ${m.tight})` : ''}`)
      }
}

async function touch(b) {
  console.log('touch: the "⋯" sheet at 390 px has 44 px targets')
  for (const r of ['/demo/sapa-warga?controls=all', '/demo/sapa-warga', '/lab/_kit?only=shell']) {
    await b.open(r, 390, 844, true, 3000)
    await b.ev(`document.querySelector('[data-dk-more]')?.click()`)
    await sleep(800)
    const small = await b.ev(`${SMALL}(document.querySelector('.dk-more') || document.body)`)
    ok(Array.isArray(small) && small.length === 0, `${r}: sheet targets < 44 px: ${JSON.stringify(small)}`)
  }
}

async function focus(b) {
  console.log('focus: closing the guide returns focus to its toggle')
  const name = `(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.tagName) : null })()`
  await b.open('/lab/_kit?only=shell', 1440, 900, false, 3000)
  const toggle = `document.querySelector('.dk-topbar [aria-controls^="dk-guide-"]')`
  const isOpen = `(() => { const g = document.querySelector('.dk-guide'); return !!g && !g.hidden })()`
  if (!(await b.ev(isOpen))) {
    await b.ev(`${toggle}.click()`)
    await sleep(500)
  }
  await b.ev(`document.querySelector('.dk-guide .dk-guide-head button').focus()`)
  await b.key('Escape', 27)
  await sleep(300)
  ok((await b.ev(`document.activeElement === ${toggle}`)) === true, `Esc → focus on the "?" toggle (now: ${await b.ev(name)})`)
  await b.ev(`${toggle}.click()`)
  await sleep(500)
  await b.ev(`document.querySelector('.dk-guide .dk-guide-head button').click()`)
  await sleep(300)
  ok((await b.ev(`document.activeElement === ${toggle}`)) === true, `close button → focus on the "?" toggle (now: ${await b.ev(name)})`)

  await b.open('/lab/_kit?only=shell', 390, 844, true, 3000)
  const more = `document.querySelector('[data-dk-more]')`
  if (!(await b.ev(isOpen))) {
    await b.ev(`${more}.click()`)
    await sleep(700)
    await b.ev(`[...document.querySelectorAll('.dk-more-actions button')].find((x) => x.querySelector('.dk-icon') && /Coba|Try/.test(x.textContent)).click()`)
    await sleep(700)
  }
  ok((await b.ev(isOpen)) === true, 'mobile: the guide sheet is open')
  await b.ev(`document.querySelector('.dk-guide .dk-guide-head button').focus()`)
  await b.key('Escape', 27)
  await sleep(300)
  // phones: the "Coba ini" mission bar under the top bar is the guide's toggle (aria-controls); without it, "⋯"
  ok((await b.ev(`document.activeElement === (document.querySelector('.dk-mpill') ?? ${more})`)) === true, `mobile Esc → focus on the mission bar / "⋯" (now: ${await b.ev(name)})`)
}

async function lang(b) {
  console.log('lang: ?lang is honoured on a client-side navigation')
  await b.open('/produk/sapa-warga?lang=id', 1440, 900, false, 1500, 'main')
  await b.ev(`history.pushState(null, '', '/demo/meja-pimpinan?lang=en&role=sekretariat&t=09:15'); dispatchEvent(new PopStateEvent('popstate')); 1`)
  await sleep(3000)
  const r = await b.ev(`({ html: document.documentElement.lang, search: location.search })`)
  ok(r?.html === 'en' && /lang=en/.test(r?.search ?? ''), `html lang ${r?.html}, url ${r?.search}`)
}

async function live(b) {
  console.log('live: tapping the disabled Live pill explains why')
  await b.open('/demo/sapa-warga?controls=all', 390, 844, true, 3000)
  await b.ev(`document.querySelector('[data-dk-more]').click()`)
  await sleep(800)
  const pos = await b.ev(`(() => { const x = [...document.querySelectorAll('.dk-more .dk-ai-opt')][1]; if (!x) return null; x.scrollIntoView({ block: 'center' }); const r = x.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, dis: x.getAttribute('aria-disabled') } })()`)
  if (!pos) return ok(false, 'no Live pill in the sheet')
  if (pos.dis !== 'true') return ok(true, 'Live is available here (proxy up): nothing to explain')
  const before = await b.ev(`document.querySelector('.dk-more .dk-ai-why')?.textContent || ''`)
  await b.tap(pos.x, pos.y)
  const r = await b.ev(`({ why: document.querySelector('.dk-more .dk-ai-why')?.textContent || '', vis: (() => { const w = document.querySelector('.dk-more .dk-ai-why'); return !!w && w.getBoundingClientRect().height > 0 })(), toast: [...document.querySelectorAll('.dk-toast')].map((t) => t.textContent).join(' | '), checked: [...document.querySelectorAll('.dk-more .dk-ai-opt')][1].getAttribute('aria-checked') })`)
  ok(r.vis && r.why.length > 10 && r.checked === 'false', `helper text visible: "${r.why.slice(0, 70)}" (before tap: ${before ? 'shown' : 'none'}), toast: "${r.toast.slice(0, 60)}"`)
}

async function interim(b) {
  console.log('interim: placeholder canvases show only controls that act on them')
  // a product that is still a placeholder (the Satu Daerah products are live since tahap 2)
  await b.open('/demo/indeks-ekonomi', 1440, 900, false, 2500)
  const r = await b.ev(`({ role: !!document.querySelector('.dk-topbar .dk-pick, .dk-topbar .dk-shell-chip .dk-avatar'), clock: !!document.querySelector('.dk-topbar .dk-clock'), ai: !!document.querySelector('.dk-topbar .dk-ai'), reset: [...document.querySelectorAll('.dk-topbar button')].some((x) => /Reset|Ulang/i.test(x.getAttribute('aria-label') || '')) })`)
  ok(!r.role && !r.clock && !r.ai && !r.reset, `top bar on a placeholder: ${JSON.stringify(r)}`)
  // the preview panel says what the link asked for (?role, ?t), with no fake controls
  await b.open('/demo/indeks-ekonomi?role=kepala-daerah&t=09:15', 1440, 900, false, 2500, '.dk-ph-try')
  const pv = await b.ev(`(() => { const p = document.querySelector('.dk-ph-try'); return p && { text: p.textContent, cur: p.querySelector('[aria-current="true"]')?.textContent || '', digits: p.querySelector('.dk-ph-digits')?.textContent || '', ctl: p.querySelectorAll('button, input, select, [role=button], [role=switch], [role=radio]').length } })()`)
  ok(!!pv && pv.digits === '09:15' && /pukul 09\.15/.test(pv.text) && /Kepala Daerah/.test(pv.cur) && pv.ctl === 0, `preview: clock ${pv?.digits}, link time in text ${/pukul 09\.15/.test(pv?.text || '')}, current role "${pv?.cur}", controls inside ${pv?.ctl}`)
  await b.open('/lab/_kit?only=shell', 1440, 900, false, 3000)
  const s = await b.ev(`({ role: !!document.querySelector('.dk-topbar .dk-pick'), clock: !!document.querySelector('.dk-topbar .dk-clock'), ai: !!document.querySelector('.dk-topbar .dk-ai') })`)
  ok(s.role && s.clock && s.ai, `a real canvas keeps them: ${JSON.stringify(s)}`)
}

async function gutter(b) {
  console.log('gutter: one 16 px gutter on mobile placeholders')
  await b.open('/demo/indeks-ekonomi', 390, 844, true, 800, '.dk-ph-title')
  const r = await b.ev(`(() => { const t = document.querySelector('.dk-ph-title'); const c = document.querySelector('.dk-ph-tagline'); return t && { title: Math.round(t.getBoundingClientRect().left), tagline: Math.round(c.getBoundingClientRect().left), sw: document.documentElement.scrollWidth } })()`)
  ok(!!r && Math.abs(r.title - 16) <= 2 && Math.abs(r.tagline - 16) <= 2 && r.sw <= 390, `title x ${r?.title}, tagline x ${r?.tagline}, scrollWidth ${r?.sw}`)
  const q = await b.ev(`(() => { const L = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().left) : null }; const R = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().right) : null }; return { title: L('.dk-ph-try-title'), chips: L('.dk-ph-chips'), digits: L('.dk-ph-digits'), stages: R('.dk-ph-stages') } })()`)
  ok(q && [q.title, q.chips, q.digits].every((x) => x !== null && Math.abs(x - 16) <= 2) && q.stages !== null && Math.abs(q.stages - 374) <= 2, `preview panel edges: ${JSON.stringify(q)} (left 16, right 374)`)
}

const TESTS = { fit, touch, focus, lang, live, interim, gutter }
const b = await browser()
try {
  for (const name of ONLY) if (TESTS[name]) await TESTS[name](b)
  if (b.errors.length) ok(false, `page exceptions: ${b.errors.slice(0, 3).join(' | ')}`)
} finally {
  await b.close()
}
console.log(fails ? `\n${fails} FAILED` : '\nall shell self-tests passed')
process.exit(fails ? 1 : 0)
