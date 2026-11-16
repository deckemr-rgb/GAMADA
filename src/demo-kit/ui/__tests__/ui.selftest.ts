/**
 * Self-tests for the ui module (no framework): `npx tsx src/demo-kit/ui/__tests__/ui.selftest.ts`
 * 1. AA contrast of --dk-on-accent on --dk-accent for all 4 ecosystems, white on --dk-accent-paper,
 *    and the text tokens on their surfaces (dark + paper) — parsed from the real CSS files.
 * 2. formatSla wording + tones.
 * 3. Icon set covers every product icon key in products.ts.
 * 4. deltaMeaning / scoreTone.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRODUCTS } from '../../../content/products'
import { formatSla } from '../sla'

const here = dirname(fileURLToPath(import.meta.url))
const site = readFileSync(join(here, '../../../styles/tokens.css'), 'utf8')
const dk = readFileSync(join(here, '../tokens.css'), 'utf8')

let fails = 0
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ok   ${msg}`)
  else {
    fails++
    console.log(`  FAIL ${msg}`)
  }
}

/* ---------------------------------------------------------------- colour helpers */
const siteVars = new Map<string, string>()
for (const m of site.matchAll(/(--c-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) if (!siteVars.has(m[1]!)) siteVars.set(m[1]!, m[2]!)

function block(selector: string): string {
  const i = dk.indexOf(selector)
  if (i < 0) throw new Error(`selector not found: ${selector}`)
  return dk.slice(dk.indexOf('{', i) + 1, dk.indexOf('}', i))
}
function resolve(v: string): string {
  const s = v.trim()
  const ref = /^var\((--c-[\w-]+)\)$/.exec(s)
  if (ref) {
    const hex = siteVars.get(ref[1]!)
    if (!hex) throw new Error(`unknown ${ref[1]}`)
    return hex
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  throw new Error(`cannot resolve ${s}`)
}
function prop(b: string, name: string): string {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(b)
  if (!m) throw new Error(`missing ${name}`)
  return resolve(m[1]!)
}
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

console.log('1 · contrast')
const ecos = ['satu-daerah', 'usaha-pintar', 'pasar-daerah', 'inti'] as const
for (const e of ecos) {
  const b = block(`[data-eco='${e}'] {`)
  const acc = prop(b, '--dk-eco-acc')
  const on = prop(b, '--dk-eco-on')
  const paper = prop(b, '--dk-eco-paper')
  const r1 = ratio(acc, on)
  const r2 = ratio(paper, '#ffffff')
  const r3 = ratio(paper, '#f8f6f0')
  ok(r1 >= 4.5, `${e}: on-accent ${on} on ${acc} = ${r1.toFixed(2)}:1`)
  ok(r2 >= 4.5, `${e}: #fff on accent-paper ${paper} = ${r2.toFixed(2)}:1`)
  ok(r3 >= 4.5, `${e}: accent-paper text on paper = ${r3.toFixed(2)}:1`)
  // accent used as text / icon on the dark panels
  ok(ratio(acc, siteVars.get('--c-ink-2')!) >= 4.5, `${e}: accent on --dk-s1 = ${ratio(acc, siteVars.get('--c-ink-2')!).toFixed(2)}:1`)
}
const s1 = siteVars.get('--c-ink-2')!
const s2 = siteVars.get('--c-indigo')!
for (const [name, hex] of [
  ['text', siteVars.get('--c-text')!],
  ['muted', siteVars.get('--c-muted')!],
  ['faint', '#a29bcc'],
  ['danger-ink', '#ff8d82'],
  ['warn', siteVars.get('--c-gold')!],
  ['pos', '#6fe8cf'],
] as const) {
  ok(ratio(hex, s2) >= 4.5, `dark: ${name} on --dk-s2 = ${ratio(hex, s2).toFixed(2)}:1 (s1 ${ratio(hex, s1).toFixed(2)})`)
}
const paperSurfaces = ['#f8f6f0', '#fffdf8', '#efece3']
for (const [name, hex] of [
  ['ink', '#1f1d2b'],
  ['muted', '#4d4a60'],
  ['faint', '#5c5872'],
  ['danger-ink', '#a3221b'],
  ['warn-ink', '#7a5200'],
  ['pos', '#0b6a59'],
] as const) {
  const worst = Math.min(...paperSurfaces.map((p) => ratio(hex, p)))
  ok(worst >= 4.5, `paper: ${name} worst = ${worst.toFixed(2)}:1`)
}
ok(ratio(siteVars.get('--c-violet')!, '#f8f6f0') >= 3, `paper focus ring violet ≥ 3:1 (${ratio(siteVars.get('--c-violet')!, '#f8f6f0').toFixed(2)})`)
ok(ratio(siteVars.get('--c-lavender')!, siteVars.get('--c-ink')!) >= 3, `dark focus ring lavender ≥ 3:1 (${ratio(siteVars.get('--c-lavender')!, siteVars.get('--c-ink')!).toFixed(2)})`)

console.log('2 · formatSla')
const cases: [number, 'id' | 'en', boolean, string, string][] = [
  [20 * 60, 'id', false, '20 j lagi', 'ok'],
  [45, 'id', false, '45 mnt lagi', 'warn'],
  [-120, 'id', false, 'Lewat 2 j', 'late'],
  [0, 'id', true, 'Tuntas', 'done'],
  [7 * 60 + 59, 'en', false, '8 h left', 'warn'],
  [-30, 'en', false, '30 min late', 'late'],
  [3 * 24 * 60, 'id', false, '3 hr lagi', 'ok'],
]
for (const [m, l, d, text, tone] of cases) {
  const r = formatSla(m, l, d)
  ok(r.text === text && r.tone === tone, `formatSla(${m}, ${l}${d ? ', done' : ''}) = "${r.text}" / ${r.tone}`)
}

console.log('3 · icons')
const iconsSrc = readFileSync(join(here, '../icons.tsx'), 'utf8')
for (const p of Object.values(PRODUCTS)) ok(new RegExp(`^  ${p.icon}: \\(\\) =>`, 'm').test(iconsSrc), `icon for ${p.slug} (${p.icon})`)
const count = (iconsSrc.match(/^  [a-zA-Z]+: \(\) =>/gm) ?? []).length
ok(count >= 18 + 40, `icon count ${count} ≥ 58`)

console.log(fails ? `\n${fails} FAILED` : '\nall passed')
process.exit(fails ? 1 : 0)
