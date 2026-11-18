/**
 * i18n/terbilang.ts — a number in words (Surat Penawaran "terbilang", receipts): Indonesian ("tiga puluh tujuh juta
 * tujuh ratus lima puluh ribu") or English ("thirty-seven million seven hundred fifty thousand"). Integers ≥ 0 up to
 * the trillions; the caller appends "rupiah".
 */
const ID = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
const EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const BIG_ID: [number, string][] = [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1e3, 'ribu']]
const BIG_EN: [number, string][] = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]

function idWords(n: number): string {
  if (n < 12) return ID[n]!
  if (n < 20) return `${ID[n - 10]} belas`
  if (n < 100) return `${ID[Math.floor(n / 10)]} puluh${n % 10 ? ` ${ID[n % 10]}` : ''}`
  if (n < 200) return `seratus${n % 100 ? ` ${idWords(n % 100)}` : ''}`
  if (n < 1000) return `${ID[Math.floor(n / 100)]} ratus${n % 100 ? ` ${idWords(n % 100)}` : ''}`
  if (n < 2000) return `seribu${n % 1000 ? ` ${idWords(n % 1000)}` : ''}`
  for (const [v, w] of BIG_ID) if (n >= v) return `${idWords(Math.floor(n / v))} ${w}${n % v ? ` ${idWords(n % v)}` : ''}`
  return ''
}
function enWords(n: number): string {
  if (n < 20) return EN[n]!
  if (n < 100) return `${EN_TENS[Math.floor(n / 10)]}${n % 10 ? `-${EN[n % 10]}` : ''}`
  if (n < 1000) return `${EN[Math.floor(n / 100)]} hundred${n % 100 ? ` ${enWords(n % 100)}` : ''}`
  for (const [v, w] of BIG_EN) if (n >= v) return `${enWords(Math.floor(n / v))} ${w}${n % v ? ` ${enWords(n % v)}` : ''}`
  return ''
}

/** words of the integer part of `n` ("minus …" for negatives) */
export function terbilang(n: number, lang: 'id' | 'en' = 'id'): string {
  const v = Math.floor(Math.abs(n))
  const w = lang === 'id' ? idWords(v) : enWords(v)
  return n < 0 ? `minus ${w}` : w
}
