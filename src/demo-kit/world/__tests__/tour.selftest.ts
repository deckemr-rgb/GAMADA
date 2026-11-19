/**
 * Tahap 5 kit self-tests (tour): the world scope (K1: own persist key, reset keeps the scope), the day story options
 * (K5: source 'tour', `until`) and the K6 DETERMINISM PROBE: a fresh tour world on the real pack, natural events ON,
 * jumped 06:00 → 17:00 through the chapter times with the story steps at their chapters, twice ⇒ the same audit
 * fingerprint (types + entity refs + minute). Also the Tahap 4 number fix (c): forecast factor chips add up to peakPct.
 * Run by world.selftest.ts after the Pasar Daerah tests (needs the UP + PD modules registered).
 */
import type { RegionPack } from '../../region/types'
import { priceOutlook } from '../pasar-daerah'
import { rows } from '../util'

type Ok = (cond: unknown, msg: string) => void

/** the chapter times of docs/build/tahap5-plan.md §2 (ch. 1–19) and the story key each one plays (§0.4 / §2) */
export const TOUR_TIMES = ['06:00', '06:20', '07:00', '08:15', '09:00', '10:00', '11:00', '11:40', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] as const
const STORY_AT: Partial<Record<(typeof TOUR_TIMES)[number], 'flood' | 'neighbours' | 'instruction' | 'recommend'>> = { '06:20': 'flood', '08:15': 'neighbours', '09:00': 'instruction', '11:00': 'recommend' }

/** FNV-1a over a string (a short printable fingerprint) */
const fnv = (str: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function runTourSelftest(ok: Ok, section: (n: string) => void, packs: { label: string; pack: RegionPack }[]): Promise<{ fingerprint: string; same: boolean; rows: number }> {
  const real = packs[packs.length - 1]!.pack
  const store = await import('../store')
  const eco = await import('../eco')
  const { clock } = await import('../clock')
  const natural = await import('../natural')
  const story = await import('../story')
  const persist = await import('../persist')

  section('tahap-5 · world scope (K1) + story options (K5)')
  ok(persist.persistKey('bojonegoro', 2026, 'tour') === 'gamada:world:tour:bojonegoro:2026', 'persistKey(tour) = gamada:world:tour:<region>:<seed>')
  ok(persist.persistKey('bojonegoro', 2026) === 'gamada:world:bojonegoro:2026' && persist.persistKey('bojonegoro', 2026, 'default') === 'gamada:world:bojonegoro:2026', 'persistKey(default) unchanged (visitor worlds of Tahap 2–4 stay readable)')

  /** wait until the natural replay queue is empty and every event (and reaction) settled */
  async function caughtUp() {
    for (let i = 0; i < 600; i++) {
      await store.settled()
      if (natural.naturalBacklog() === 0) {
        await sleep(2)
        await store.settled()
        if (natural.naturalBacklog() === 0) return
      }
      await sleep(2)
    }
    ok(false, 'natural replay caught up within 600 slices')
  }

  async function day(): Promise<{ fp: string; n: number; tourRows: number; natural: number; storyRan: string[]; text: string }> {
    await store.loadWorld(real, 2026, { scope: 'tour' })
    await store.resetWorld({ clock: 6 * 60 })
    await eco.ensureEcosystem('usaha-pintar')
    await eco.ensureEcosystem('pasar-daerah')
    natural.setNaturalEvents(true)
    const ran: string[] = []
    for (const t of TOUR_TIMES) {
      clock.setTime(t)
      await caughtUp()
      const key = STORY_AT[t]
      if (key) ran.push(...(await story.playDayStory({ gapMs: 0, source: 'tour', until: key })))
      await caughtUp()
    }
    const s = store.world.get()
    const audit = rows(s.auditLog).filter((a) => a.at >= 6 * 60)
    const text = audit.map((a) => `${a.at}|${a.type}|${a.source}|${a.entityRefs.join(',')}`).join('\n')
    return { text, fp: fnv(text), n: audit.length, tourRows: audit.filter((a) => a.source === 'tour').length, natural: audit.filter((a) => a.source === 'clock').length, storyRan: ran }
  }

  section('tahap-5 · K6 determinism probe: tour world, natural ON, 06:00 → 17:00 through the chapter times, twice')
  const t0 = Date.now()
  const a = await day()
  ok(store.world.scope() === 'tour', 'the probe ran on the tour scope')
  ok(clock.get().minutes === 17 * 60, `clock at 17:00 after the jumps (${clock.get().minutes})`)
  // Tahap 7: in a dense city (REGION=bandung) Siti's complaint can already close a cluster, so 'neighbours' is skipped
  const dense = real.id !== 'bojonegoro' && !a.storyRan.includes('neighbours')
  const want = dense ? 'flood,siti,instruction,recommend' : 'flood,siti,neighbours,instruction,recommend'
  ok(a.storyRan.join(',') === want, `story keys at their chapters with until (${a.storyRan.join(',')})`)
  ok(a.tourRows >= (dense ? 3 : 4), `story events carry source 'tour' (${a.tourRows} audit rows)`)
  ok(a.natural > 50, `natural events ran during the day (${a.natural} clock rows)`)
  const s1 = store.world.get()
  ok(rows(s1.mentions).filter((m) => m.rumor && m.at >= 10 * 60).length >= 3, 'the 10:00 rumor burst ran (natural, ≥ 3 rumor posts)')
  ok(rows(s1.priceShocks).length > 0 && rows(s1.priceWarnings).length > 0, 'C30 shocks + C31 warning from the 06:20 flood')
  // Tahap 4 fix (c): the forecast chips add up to the forecast peak, for every shocked price
  const shocked = rows(s1.prices).filter((p) => rows(s1.priceShocks).some((x) => x.commodityId === p.commodityId && x.marketIds.includes(p.marketId)))
  const bad = shocked.filter((p) => {
    const o = priceOutlook(s1, p.id, clock.get().minutes)
    return !o || Math.abs(o.factors.reduce((x, f) => x + f.pct, 0) - o.peakPct) > 0.051
  })
  ok(shocked.length > 0 && bad.length === 0, `priceOutlook factors sum to peakPct on ${shocked.length} shocked prices (${bad.map((p) => p.id).join(', ')})`)
  const b = await day()
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.TOUR_DIAG) {
    const c = await day()
    const NL = String.fromCharCode(10)
    const la = a.text.split(NL).reverse(), lb = b.text.split(NL).reverse(), lc = c.text.split(NL).reverse()
    const cnt = (l: string[]) => { const m: Record<string, number> = {}; for (const x of l) { const k = x.split('|').slice(1, 3).join('|'); m[k] = (m[k] ?? 0) + 1 } return m }
    const ca = cnt(la), cb = cnt(lb), cc = cnt(lc)
    console.log('  type counts a/b/c that differ:', Object.keys({ ...ca, ...cb, ...cc }).filter((k) => ca[k] !== cb[k] || cb[k] !== cc[k]).map((k) => `${k} ${ca[k] ?? 0}/${cb[k] ?? 0}/${cc[k] ?? 0}`).join(' · '))
    console.log('  b==c', b.fp === c.fp)
    for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) { console.log('  first diff a/b at', i, NL, '  a:', la.slice(i, i + 4).join(' ; '), NL, '  b:', lb.slice(i, i + 4).join(' ; ')); break }
    for (let i = 0; i < Math.max(lb.length, lc.length); i++) if (lb[i] !== lc[i]) { console.log('  first diff b/c at', i, NL, '  b:', lb.slice(i, i + 4).join(' ; '), NL, '  c:', lc.slice(i, i + 4).join(' ; ')); break }
  }
  ok(a.fp === b.fp && a.n === b.n, `K6: two tour days ⇒ identical audit fingerprint (${a.fp} / ${b.fp}, ${a.n} / ${b.n} rows)`)
  console.log(`  K6 probe: fingerprint ${a.fp} (${a.n} audit rows 06:00–17:00, ${a.natural} natural, ${a.tourRows} tour) · ${a.fp === b.fp ? 'DETERMINISTIC' : 'NOT deterministic'} · ${Date.now() - t0} ms`)

  // reset keeps the scope; a default load switches back
  await store.resetWorld()
  ok(store.world.scope() === 'tour', 'resetWorld keeps the tour scope')
  await store.loadWorld(real, 2026)
  ok(store.world.scope() === 'default', 'loadWorld without a scope ⇒ the default (visitor) world')
  return { fingerprint: a.fp, same: a.fp === b.fp, rows: a.n }
}
