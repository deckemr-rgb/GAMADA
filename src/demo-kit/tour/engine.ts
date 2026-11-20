/**
 * tour/engine.ts — the tour player (plan §1.2 engine): start(n) · play · pause · next · prev · restart · setRate.
 * One loop: a gsap.ticker listener attached only while playing (idle / paused = 0 tour listeners) advances a virtual
 * chapter clock scaled by `rate`; every `wait`, typing speed and chapter duration runs on it. The WORLD clock stays
 * paused (the tour sets it per chapter / step), so two runs give the same audit trail (K6). Loading a product never
 * eats chapter time: the chapter timer starts when the stage reports ready.
 */
import { gsap } from 'gsap'
import type { ProductSlug } from '../../content/products'
import { DEMO_READY, preloadDemo } from '../../demos/registry'
import { CHAPTERS, SUMMARY_N, SUMMARY_SECONDS, chapterOf } from './chapters'
import { clickHook, findHook, inStage, isDisabled, realDelay, reveal, setFieldValue, stageIsPhone } from './exec'
import { tourStore, type StageSpec } from './store'
// named static imports only: a dynamic import('../world') would pull the whole barrel namespace (incl. its demo-gen
// re-exports) into the demo-core chunk and create a demo-core ⇄ demo-gen cycle that breaks every /demo page
import { clock as wClock, loadWorld, resetWorld, rows as wRows, setNaturalEvents, setSession, world as wWorld } from '../world'
import type { ChapterScript, FocusKey, Lang, Step } from './types'

type WS = typeof import('./world-steps')
let wsP: Promise<WS> | null = null
let wsMod: WS | null = null
export const loadWorldSteps = (): Promise<WS> => (wsP ??= import('./world-steps').then((m) => (wsMod = m)))
/** Tahap 8: a stage's focus entity as the world is NOW (Ambil alih after the chapter created it, e.g. ch. 11's sent PO) */
export const focusNow = (key: FocusKey | null | undefined): string | null => (key && wsMod ? wsMod.focusOf(key) : null)

class Cancelled extends Error {}

const query = () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
const e2e = () => query().get('e2e') === '1'
/** ?e2e=1&tourDegrade=<slug>: that product plays as a poster (degrade test) */
const degraded = (slug: ProductSlug): boolean => !DEMO_READY[slug] || (e2e() && query().get('tourDegrade') === slug)

/* ------------------------------------------------------------------ virtual chapter clock */

let vt = 0
let waiters: { at: number; res: () => void }[] = []
let attached = false
let chapterT0 = 0
let chapterMs = 1
let progressEl: HTMLElement | null = null
let dwellSlug: ProductSlug | null = null
let dwellAcc = 0

function tick(_t: number, dt: number) {
  const st = tourStore.get()
  if (!st.playing) return
  const d = Math.min(dt, 250)
  if (!st.busy) {
    vt += d * st.rate
    if (dwellSlug) dwellAcc += d
  }
  if (waiters.length) {
    const due = waiters.filter((w) => w.at <= vt)
    if (due.length) {
      waiters = waiters.filter((w) => w.at > vt)
      for (const w of due) w.res()
    }
  }
  if (progressEl) progressEl.style.transform = `scaleX(${Math.max(0, Math.min(1, (vt - chapterT0) / chapterMs))})`
  if (dwellAcc > 1000 && dwellSlug) flushDwell()
}
function flushDwell() {
  if (!dwellSlug || dwellAcc <= 0) return
  const slug = dwellSlug
  const add = dwellAcc
  dwellAcc = 0
  tourStore.set((s) => ({ seen: { ...s.seen, [slug]: (s.seen[slug] ?? 0) + add } }))
}
function sync() {
  const want = tourStore.get().playing && (typeof document === 'undefined' || document.visibilityState !== 'hidden')
  if (want && !attached) {
    gsap.ticker.add(tick)
    attached = true
  } else if (!want && attached) {
    gsap.ticker.remove(tick)
    attached = false
  }
}
/** virtual ms (scaled by rate; frozen while paused or busy) */
const delay = (ms: number): Promise<void> => new Promise((res) => waiters.push({ at: vt + ms, res }))

/** the number of tour ticker listeners (0 while paused: plan §0.2) */
export const tourTickerListeners = (): number => (attached ? 1 : 0)
export const bindProgress = (el: HTMLElement | null): void => {
  progressEl = el
}

/* ------------------------------------------------------------------ engine */

let token = 0
let fallbacks = 0
const doneLog: Record<number, boolean> = {}
const fallbackLog: string[] = []
let stageKey = 0
let stageReady = -1
let stageWaiters: (() => void)[] = []
let lang: Lang = 'id'
/** world preparation runs one at a time (a quick ←/→ never interleaves two prepareThrough calls) */
let lock: Promise<unknown> = Promise.resolve()
const locked = <T,>(fn: () => Promise<T>): Promise<T> => {
  const p = lock.then(fn, fn)
  lock = p.catch(() => undefined)
  return p
}
let booted = false

export const setEngineLang = (l: Lang): void => {
  lang = l
  void refreshFills()
}

/** the Stage calls this once its product rendered (module loaded, world + eco ready, no busy skeleton) */
export function markStageReady(key: number): void {
  stageReady = key
  const ws = stageWaiters
  stageWaiters = []
  for (const w of ws) w()
}

async function waitStage(key: number, alive: () => boolean): Promise<void> {
  const t0 = performance.now()
  while (stageReady !== key && alive() && performance.now() - t0 < 15000) {
    await new Promise<void>((r) => {
      stageWaiters.push(r)
      gsap.delayedCall(0.25, r)
    })
  }
}

function mount(spec: Omit<StageSpec, 'key'>): number {
  const key = ++stageKey
  if (dwellSlug !== spec.slug) {
    flushDwell()
    dwellSlug = spec.slug
  }
  tourStore.set((s) => ({ stage: { ...spec, key }, spot: null, seen: s.seen[spec.slug] != null ? s.seen : { ...s.seen, [spec.slug]: 0 } }))
  return key
}

async function refreshFills(): Promise<void> {
  const st = tourStore.get()
  if (!booted || st.phase === 'opener' || st.phase === 'poster') return
  const ws = await loadWorldSteps()
  tourStore.set({ fills: ws.chapterFacts(st.n, lang) })
}

/** load the tour's world (scope 'tour'), optionally reset it to 06:00 ("Mulai tur"), register UP + PD */
export async function bootWorld(opts: { reset: boolean; regionId: string; seed: number }): Promise<void> {
  const { loadRegion } = await import('../region/loader')
  setSession({ scope: 'tour', regionId: opts.regionId, seed: opts.seed, from: null, aiMode: 'sim', present: false })
  const pack = await loadRegion(opts.regionId)
  const w = wWorld
  if (w.status() !== 'ready' || w.scope() !== 'tour' || w.get().regionId !== opts.regionId || w.get().seed !== opts.seed) await loadWorld(pack, opts.seed, { scope: 'tour' })
  if (opts.reset) await resetWorld({ clock: 6 * 60 })
  wClock.pause()
  setNaturalEvents(true)
  const ws = await loadWorldSteps()
  await ws.ensureTourWorld()
  await ws.caughtUp()
  booted = true
}

async function runStep(step: Step, ch: ChapterScript, alive: () => boolean, ws: WS): Promise<void> {
  const check = () => {
    if (!alive()) throw new Cancelled()
  }
  const miss = (sel: string) => {
    fallbacks++
    fallbackLog.push(`${ch.n}:${sel}`)
    if (import.meta.env.DEV) console.warn(`[tour] chapter ${ch.n}: hook missing ${sel}`)
  }
  // a step the product's phone layout does not have on this screen (by design, not a missing hook)
  if ('wide' in step && step.wide && stageIsPhone()) return
  switch (step.k) {
    case 'wait':
      await delay(step.ms)
      break
    case 'caption':
      tourStore.set({ cap: step.cap })
      break
    case 'setClock':
      await ws.jumpTo(step.t)
      break
    case 'story':
    case 'world':
      await ws.runKey(step.key)
      break
    case 'await': {
      const t0 = vt
      while (!ws.awaitOf(step.until) && vt - t0 < (step.timeout ?? 4000)) {
        await delay(150)
        check()
      }
      break
    }
    case 'navigate': {
      // a non-READY (or ?tourDegrade=) product inside a chapter: the rest of the chapter plays as a poster
      if (degraded(step.slug)) {
        flushDwell()
        dwellSlug = step.slug
        tourStore.set((s) => ({ poster: true, posterSlug: step.slug, stage: null, spot: null, seen: { ...s.seen, [step.slug]: s.seen[step.slug] ?? 0 } }))
        break
      }
      const key = mount({ slug: step.slug, role: step.role, tab: step.tab, focus: step.focus ? ws.focusOf(step.focus) : null, focusKey: step.focus, q: step.q })
      tourStore.set({ busy: true })
      await waitStage(key, alive)
      tourStore.set({ busy: false })
      break
    }
    case 'focus':
    case 'click': {
      if (step.cap != null) tourStore.set({ cap: step.cap })
      const el = await findHook(step.sel, 3000, alive)
      check()
      if (!el) {
        miss(step.sel)
        if (step.k === 'click' && step.fb) await ws.runKey(step.fb)
        break
      }
      reveal(el)
      tourStore.set({ spot: inStage(el) ? step.sel : null })
      await delay(step.k === 'focus' ? 1400 : 700)
      check()
      if (step.k === 'click') {
        // a product step may still be running (real time): wait ≤ 4 s for the control to be enabled
        const t0 = performance.now()
        while (isDisabled(el) && performance.now() - t0 < 4000 && alive()) await realDelay(120)
        if (!clickHook(el)) {
          miss(`${step.sel} (disabled)`)
          if (step.fb) await ws.runKey(step.fb)
        }
        await delay(300)
      }
      break
    }
    case 'type':
    case 'ai': {
      const el = await findHook(step.sel, 3000, alive)
      check()
      if (!el) {
        miss(step.sel)
        break
      }
      reveal(el)
      tourStore.set({ spot: inStage(el) ? step.sel : null })
      const text = step.text[lang]
      const cps = step.k === 'type' ? (step.cps ?? 18) : 18
      for (let i = 1; i <= text.length; i++) {
        setFieldValue(el, text.slice(0, i))
        await delay(1000 / cps)
        check()
      }
      if (step.k === 'ai') {
        const send = await findHook(step.send, 1500, alive)
        check()
        if (!send || !clickHook(send)) miss(step.send)
        await delay(2600)
      }
      break
    }
  }
  check()
}

async function playChapter(n: number, my: number): Promise<void> {
  const alive = () => my === token
  const ch = chapterOf(n)
  const ws = await loadWorldSteps()
  if (!alive()) return
  if (!ch) return showSummary(my)
  const poster = degraded(ch.product)
  tourStore.set({ phase: 'player', n, step: 0, cap: null, spot: null, busy: true, poster, posterSlug: poster ? ch.product : null, stage: null, curtain: true, interrupted: false })
  syncUrl(n)
  // world first (instant, no UI): earlier chapters' keys + this chapter's time, with no product mounted
  await locked(() => ws.prepareThrough(n))
  if (!alive()) return
  tourStore.set({ fills: ws.chapterFacts(n, lang) })
  if (poster) {
    dwellSlug = ch.product
    tourStore.set((s) => ({ stage: null, seen: { ...s.seen, [ch.product]: s.seen[ch.product] ?? 0 } }))
  } else {
    const key = mount({ slug: ch.product, role: ch.role, tab: ch.tab, focus: ch.focus ? ws.focusOf(ch.focus) : null, focusKey: ch.focus, q: ch.q })
    await waitStage(key, alive)
  }
  if (!alive()) return
  // preload the next chapter's product while this one plays (the visitor asked for autoplay: intent)
  const nx = chapterOf(n + 1)
  if (nx && !degraded(nx.product)) preloadDemo(nx.product)
  tourStore.set({ busy: false, curtain: false })
  chapterT0 = vt
  chapterMs = ch.duration * 1000
  try {
    for (let i = 0; i < ch.steps.length; i++) {
      tourStore.set({ step: i })
      const st = ch.steps[i]!
      // a poster plays only the world steps (plan §2.0)
      if (tourStore.get().poster && !['story', 'world', 'setClock', 'await', 'wait', 'caption'].includes(st.k)) continue
      await runStep(st, ch, alive, ws)
      if (st.k === 'story' || st.k === 'world' || st.k === 'setClock') tourStore.set({ fills: ws.chapterFacts(n, lang) })
    }
    // the chapter's own keys always end true (idempotent)
    for (const k of ch.world) await ws.runKey(k)
    if (!alive()) return
    tourStore.set({ fills: ws.chapterFacts(n, lang), spot: null })
    doneLog[n] = ws.chapterDone(n)
    const rest = chapterT0 + chapterMs - vt
    if (rest > 0) await delay(rest)
  } catch (e) {
    if (e instanceof Cancelled) return
    throw e
  }
  if (!alive()) return
  void playChapter(n + 1, my)
}

async function showSummary(my: number): Promise<void> {
  const ws = await loadWorldSteps()
  if (my !== token) return
  flushDwell()
  dwellSlug = null
  // the whole day (clock jumps included: a cold /tur/20 needs the 10:00 rumour, the afternoon prices …), idempotent
  await locked(async () => {
    await ws.prepareThrough(SUMMARY_N)
    for (const ch of CHAPTERS) for (const k of ch.world) await ws.runKey(k)
  })
  tourStore.set({ phase: 'summary', n: SUMMARY_N, stage: null, spot: null, cap: null, busy: false, curtain: false, fills: ws.chapterFacts(SUMMARY_N, lang) })
  syncUrl(SUMMARY_N)
  doneLog[SUMMARY_N] = ws.chapterDone(SUMMARY_N)
  chapterT0 = vt
  chapterMs = SUMMARY_SECONDS * 1000
}

/** resolves after the next paint (rAF → task); a hidden tab (no rAF) falls back to a short timer */
const afterPaint = (): Promise<void> =>
  new Promise((res) => {
    let done = false
    const fin = () => {
      if (!done) {
        done = true
        res()
      }
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(fin, 0))
    setTimeout(fin, 100)
  })

/** keep the address bar on /tur/<n> (+ the tour's own params); products' own params (?tab …) are dropped */
export function syncUrl(n: number | null, extra: Record<string, string> = {}): void {
  if (typeof window === 'undefined') return
  const cur = new URLSearchParams(window.location.search)
  const p = new URLSearchParams()
  for (const k of ['lang', 'region', 'seed', 'e2e', 'rate', 'present', 'off', 'static', 'tourDegrade', 'motion']) {
    const v = cur.get(k)
    if (v != null) p.set(k, v)
  }
  for (const [k, v] of Object.entries(extra)) p.set(k, v)
  const q = p.toString()
  const next = `${n ? `/tur/${n}` : '/tur'}${q ? `?${q}` : ''}`
  if (next !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, '', next)
}

export const engine = {
  /** start chapter n (1–20) and play */
  async start(n: number, opts: { reset?: boolean; regionId: string; seed: number; resume?: boolean }): Promise<void> {
    const my = ++token
    tourStore.set({ phase: 'player', n: Math.min(n, SUMMARY_N), busy: true, playing: true, stage: null, curtain: true, interrupted: false })
    sync()
    await bootWorld({ reset: !!opts.reset, regionId: opts.regionId, seed: opts.seed })
    if (my !== token) return
    if (n >= SUMMARY_N) return showSummary(my)
    await playChapter(n, my)
  },
  /** jump to chapter n inside a running tour (drawer, ←/→): forward in world time only */
  go(n: number): void {
    const my = ++token
    waiters = []
    // INP (Tahap 7): paint the curtain first; the old product's unmount + world preparation run after that frame
    tourStore.set({ playing: true, interrupted: false, drawer: false, curtain: true })
    sync()
    void afterPaint().then(() => {
      if (my !== token) return
      if (n >= SUMMARY_N) void showSummary(my)
      else void playChapter(Math.max(1, n), my)
    })
  },
  play(): void {
    tourStore.set({ playing: true, interrupted: false })
    sync()
  },
  pause(): void {
    tourStore.set({ playing: false })
    flushDwell()
    sync()
  },
  toggle(): void {
    if (tourStore.get().playing) engine.pause()
    else engine.play()
  },
  next(): void {
    engine.go(tourStore.get().n + 1)
  },
  prev(): void {
    engine.go(Math.max(1, tourStore.get().n - 1))
  },
  restart(): void {
    engine.go(tourStore.get().n)
  },
  setRate(rate: number): void {
    tourStore.set({ rate })
  },
  /** the visitor touched the stage while playing ⇒ pause + "Lanjutkan tur" chip */
  interrupt(): void {
    if (!tourStore.get().playing) return
    engine.pause()
    tourStore.set({ interrupted: true })
  },
  /** stop everything (exit to the opener, leaving the page) */
  stop(): void {
    token++
    waiters = []
    flushDwell()
    dwellSlug = null
    tourStore.set({ playing: false, stage: null, spot: null, busy: false, curtain: false })
    sync()
  },
  get fallbacks(): number {
    return fallbacks
  },
  doneLog,
  fallbackLog,
}

if (typeof document !== 'undefined') {
  let hiddenPaused = false
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && tourStore.get().playing) {
      hiddenPaused = true
      engine.pause()
    } else if (document.visibilityState === 'visible' && hiddenPaused) {
      hiddenPaused = false
      engine.play()
    }
  })
}

/** ?e2e=1: the spec reads the engine state */
export function exposeForTests(): void {
  if (!e2e()) return
  ;(window as unknown as { __gamadaTour?: unknown }).__gamadaTour = {
    get state() {
      return tourStore.get()
    },
    get fallbacks() {
      return fallbacks
    },
    doneLog,
    fallbackLog,
    listeners: tourTickerListeners,
    engine,
    /** audit rows ≥ 06:00 as text ("at|type|refs") + FNV fingerprint (plan §5 test 6) */
    audit: async () => {
      const s = wWorld.get()
      const NL = String.fromCharCode(10)
      const lines = wRows(s.auditLog).filter((r) => r.at >= 360).map((r) => `${r.at}|${r.type}|${r.entityRefs.join(',')}`).reverse()
      const text = lines.join(NL)
      let h = 0x811c9dc5
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 0x01000193) >>> 0
      }
      return { fp: h.toString(16).padStart(8, '0'), n: lines.length, text }
    },
    summary: async () => {
      const ws = await loadWorldSteps()
      return ws.tourSummary(wWorld.get(), Object.keys(tourStore.get().seen))
    },
  }
}
