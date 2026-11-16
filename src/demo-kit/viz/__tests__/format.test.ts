/**
 * Self-test for viz/format.ts and viz/palette.ts. Run: npx tsx src/demo-kit/viz/__tests__/format.test.ts
 * (no test runner in the repo; exits with code 1 on the first failed group).
 */
import { clockWib, compact, dateWib, num, percent, relative, rupiah, timeWib, formatters } from '../format'
import { CATEGORICAL_HEX, TOKEN_HEX, contrast } from '../palette'

let failed = 0
let passed = 0
/** Compare with NBSP shown as "␣" so failures are readable. */
const show = (s: string) => s.replace(/ /g, '␣')
function eq(label: string, got: string, want: string) {
  const w = want.replace(/ /g, ' ')
  if (got === w) passed++
  else {
    failed++
    console.error(`✗ ${label}: got "${show(got)}", want "${show(w)}"`)
  }
}
/** Exact compare (Intl output with ordinary spaces). */
function eqx(label: string, got: string, want: string) {
  if (got === want) passed++
  else {
    failed++
    console.error(`✗ ${label}: got "${show(got)}", want "${show(want)}"`)
  }
}
function ok(label: string, cond: boolean, info = '') {
  if (cond) passed++
  else {
    failed++
    console.error(`✗ ${label} ${info}`)
  }
}

/* rupiah short (id) */
eq('rp 0', rupiah(0), 'Rp 0')
eq('rp 950', rupiah(950), 'Rp 950')
eq('rp 12 500', rupiah(12_500), 'Rp 12,5 rb')
eq('rp 999 999', rupiah(999_999), 'Rp 1 jt')
eq('rp 1 000 000', rupiah(1_000_000), 'Rp 1 jt')
eq('rp 1 200 000', rupiah(1_200_000), 'Rp 1,2 jt')
eq('rp 1 250 000 short', rupiah(1_250_000), 'Rp 1,3 jt')
eq('rp 12 345 678', rupiah(12_345_678), 'Rp 12,3 jt')
eq('rp 999 949 999', rupiah(999_949_999), 'Rp 1 M')
eq('rp 1 250 000 000', rupiah(1_250_000_000), 'Rp 1,25 M')
eq('rp 3,4 T', rupiah(3_400_000_000_000), 'Rp 3,4 T')
eq('rp neg', rupiah(-1_500_000), '−Rp 1,5 jt')
eq('rp neg small', rupiah(-0.4), 'Rp 0')
eq('rp signed', rupiah(250_000, 'short', 'id', { signed: true }), '+Rp 250 rb')
/* rupiah full */
eq('rp full 0', rupiah(0, 'full'), 'Rp 0')
eq('rp full 999 999', rupiah(999_999, 'full'), 'Rp 999.999')
eq('rp full 1 000 000', rupiah(1_000_000, 'full'), 'Rp 1.000.000')
eq('rp full 1 250 000', rupiah(1_250_000, 'full'), 'Rp 1.250.000')
eq('rp full 1 250 000 000', rupiah(1_250_000_000, 'full'), 'Rp 1.250.000.000')
eq('rp full neg', rupiah(-1_250_000, 'full'), '−Rp 1.250.000')
eq('rp full rounds', rupiah(1999.6, 'full'), 'Rp 2.000')
/* rupiah EN */
eq('rp en 0', rupiah(0, 'short', 'en'), 'Rp 0')
eq('rp en 999 999', rupiah(999_999, 'short', 'en'), 'Rp 1M')
eq('rp en 950k', rupiah(950_000, 'short', 'en'), 'Rp 950k')
eq('rp en 1.2M', rupiah(1_200_000, 'short', 'en'), 'Rp 1.2M')
eq('rp en 1.25B', rupiah(1_250_000_000, 'short', 'en'), 'Rp 1.25B')
eq('rp en full', rupiah(1_250_000, 'full', 'en'), 'Rp 1,250,000')
eq('rp en neg', rupiah(-1_250_000_000, 'short', 'en'), '−Rp 1.25B')

/* compact */
eq('compact 0', compact(0), '0')
eq('compact 2.5', compact(2.5), '2,5')
eq('compact 150', compact(150), '150')
eq('compact 1 250', compact(1_250, 'id'), '1,3 rb')
eq('compact −0.01', compact(-0.01), '0')
eq('compact en 12 500', compact(12_500, 'en'), '12.5k')

/* num */
eq('num 0', num(0), '0')
eq('num 999 999', num(999_999), '999.999')
eq('num 1 000 000', num(1_000_000), '1.000.000')
eq('num 1 250 000 000', num(1_250_000_000), '1.250.000.000')
eq('num neg', num(-1234.5, { digits: 1 }), '−1.234,5')
eq('num −0', num(-0.001, { digits: 1 }), '0')
eq('num signed', num(12, { signed: true }), '+12')
eq('num signed 0', num(0, { signed: true }), '0')
eq('num fixed', num(12, { digits: 1, fixed: true }), '12,0')
eq('num en', num(1_250_000.5, { digits: 1, lang: 'en' }), '1,250,000.5')
eq('num NaN', num(Number.NaN), '–')

/* percent */
eq('pct 0', percent(0), '0%')
eq('pct 87.4', percent(87.4), '87,4%')
eq('pct ratio', percent(0.874, { ratio: true }), '87,4%')
eq('pct neg signed', percent(-3.25, { signed: true }), '−3,3%')
eq('pct pos signed', percent(3.2, { signed: true }), '+3,2%')
eq('pct pp', percent(1.5, { points: true, signed: true }), '+1,5 pp')
eq('pct en', percent(87.4, { lang: 'en' }), '87.4%')

/* dates & times (WIB = UTC+7) */
const t = Date.UTC(2026, 10, 17, 7, 5, 9) // 14:05:09 WIB, Tuesday
eqx('date short', dateWib(t), '17 Nov 2026')
eqx('date long', dateWib(t, 'id', 'long'), 'Selasa, 17 November 2026')
eqx('date long en', dateWib(t, 'en', 'long'), 'Tuesday, 17 November 2026')
eqx('date dayMonth', dateWib(t, 'id', 'dayMonth'), '17 Nov')
eqx('date midnight WIB', dateWib(Date.UTC(2026, 10, 17, 17, 30), 'id', 'dayMonth'), '18 Nov')
eq('time id', timeWib(t), '14.05 WIB')
eq('time en', timeWib(t, 'en'), '14:05 WIB')
eq('time sec', timeWib(t, 'id', { seconds: true }), '14.05.09 WIB')
eq('time midnight', timeWib(Date.UTC(2026, 10, 17, 17, 0)), '00.00 WIB')
eq('time invalid', timeWib('nope'), '–')
eq('clock', clockWib(7 * 60 + 30), '07.30')
eq('clock en wib', clockWib(1445, 'en', true), '00:05 WIB')

/* relative */
const now = t
eq('rel now', relative(now - 10_000, 'id', now), 'baru saja')
eq('rel 5 min', relative(now - 5 * 60_000, 'id', now), '5 mnt lalu')
eq('rel 2 h', relative(now - 2 * 3_600_000, 'id', now), '2 j lalu')
eq('rel 2 h en', relative(now - 2 * 3_600_000, 'en', now), '2 h ago')
eq('rel yesterday', relative(now - 30 * 3_600_000, 'id', now), 'kemarin')
eq('rel 3 d', relative(now - 3 * 86_400_000, 'id', now), '3 hr lalu')
eq('rel 2 wk en', relative(now - 15 * 86_400_000, 'en', now), '2 wk ago')
eq('rel future', relative(now + 2 * 3_600_000, 'id', now), 'dalam 2 j')
eq('rel future en', relative(now + 20 * 60_000, 'en', now), 'in 20 min')
eqx('rel old', relative(now - 60 * 86_400_000, 'id', now), '18 Sep 2026')

/* bound */
const f = formatters('en')
eq('bound rupiah', f.rupiah(1_250_000_000), 'Rp 1.25B')
eq('bound pct', f.percent(50), '50%')

/* palette contrast: every categorical colour ≥ 3:1 on both dark surfaces (graphics, WCAG 1.4.11) */
for (const hex of CATEGORICAL_HEX) {
  for (const bg of [TOKEN_HEX.ink, TOKEN_HEX.ink2, TOKEN_HEX.indigo]) {
    const c = contrast(hex, bg)
    ok(`contrast ${hex} on ${bg}`, c >= 3, `= ${c.toFixed(2)}`)
  }
}
ok('categorical ≤ 6', CATEGORICAL_HEX.length <= 6)
ok('danger ink on ink ≥ 4.5', contrast(TOKEN_HEX.dangerInk, TOKEN_HEX.ink) >= 4.5)
ok('neutral on ink ≥ 3', contrast(TOKEN_HEX.neutral, TOKEN_HEX.ink2) >= 3, `= ${contrast(TOKEN_HEX.neutral, TOKEN_HEX.ink2).toFixed(2)}`)

console.log(`${failed ? '✗' : '✓'} viz format/palette: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
