/**
 * viz/format.ts — number, money, percent, date and time formatters for the Demo Kit (ID + EN).
 *
 * Conventions
 * - Minus is the typographic U+2212 "−"; the space between "Rp", value and unit is a no-break space (U+00A0),
 *   so "Rp 1,2 jt" never wraps inside a narrow table cell or tooltip.
 * - Indonesian uses "." for thousands and "," for decimals (id-ID); English uses en-GB grouping.
 * - Dates and times are always shown in WIB (Asia/Jakarta), whatever the viewer's own time zone.
 * - Pure functions: safe in Node (npx tsx) and the browser.
 */
export type Lang = 'id' | 'en'
export type RupiahMode = 'short' | 'full'

export const NBSP = ' '
export const MINUS = '−'
export const TZ = 'Asia/Jakarta'

const LOCALE: Record<Lang, string> = { id: 'id-ID', en: 'en-GB' }

const nfCache = new Map<string, Intl.NumberFormat>()
function nf(lang: Lang, min: number, max: number): Intl.NumberFormat {
  const key = `${lang}|${min}|${max}`
  let f = nfCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: true })
    nfCache.set(key, f)
  }
  return f
}

/** Group digits without a sign; `fixed` keeps trailing zeros. */
function plain(abs: number, digits: number, lang: Lang, fixed = false): string {
  return nf(lang, fixed ? digits : 0, digits).format(abs)
}

function sign(n: number, signed: boolean): string {
  if (n < 0) return MINUS
  if (signed && n > 0) return '+'
  return ''
}

/** Round to `digits` and turn −0 into 0, so "−0" never shows. */
function tidy(n: number, digits: number): number {
  const p = 10 ** digits
  const r = (Math.sign(n) * Math.round(Math.abs(n) * p + 1e-9)) / p
  return r === 0 ? 0 : r
}

export interface NumOpts {
  digits?: number
  lang?: Lang
  /** Prefix "+" on positive values (deltas). */
  signed?: boolean
  /** Keep trailing zeros ("12,0"). */
  fixed?: boolean
}

/** 1250000 → "1.250.000" (id) / "1,250,000" (en). */
export function num(n: number, opts: NumOpts = {}): string {
  const { digits = 0, lang = 'id', signed = false, fixed = false } = opts
  if (!Number.isFinite(n)) return '–'
  const v = tidy(n, digits)
  return sign(v, signed) + plain(Math.abs(v), digits, lang, fixed)
}

export interface PercentOpts extends NumOpts {
  /** Input is a ratio (0.874) instead of percentage points (87.4). */
  ratio?: boolean
  /** "pp" instead of "%" (difference between two percentages). */
  points?: boolean
}

/** 87.4 → "87,4%" (id) / "87.4%" (en). `{ ratio: true }` accepts 0.874. Default 1 decimal max. */
export function percent(n: number, opts: PercentOpts = {}): string {
  const { digits = 1, ratio = false, points = false } = opts
  const v = ratio ? n * 100 : n
  return num(v, { ...opts, digits }) + (points ? `${NBSP}pp` : '%')
}

/* ------------------------------------------------------------------ compact scale */

const UNITS: Record<Lang, readonly string[]> = {
  id: ['', 'rb', 'jt', 'M', 'T'],
  en: ['', 'k', 'M', 'B', 'T'],
}

/** Digits for a scaled value: 3 significant digits, max 1 decimal for rb/jt, 2 for M/T. */
function compactDigits(scaled: number, unit: number): number {
  if (scaled >= 100) return 0
  if (unit === 0) return 1
  if (scaled >= 10) return 1
  return unit >= 3 ? 2 : 1
}

/** Splits |n| into a rounded scaled value + unit index, promoting when rounding reaches 1000 (999 999 → 1 jt). */
function compactParts(abs: number): { value: number; unit: number } {
  let unit = 0
  while (unit < 4 && abs >= 1000 ** (unit + 1)) unit++
  for (;;) {
    const scaled = abs / 1000 ** unit
    const digits = compactDigits(scaled, unit)
    const value = tidy(scaled, digits)
    if (value >= 1000 && unit < 4) {
      unit++
      continue
    }
    return { value, unit }
  }
}

function compactBody(abs: number, lang: Lang): { text: string; zero: boolean } {
  const { value, unit } = compactParts(abs)
  const digits = compactDigits(value, unit)
  const body = plain(value, digits, lang)
  const u = UNITS[lang][unit] ?? ''
  return { text: !u ? body : lang === 'id' ? `${body}${NBSP}${u}` : `${body}${u}`, zero: value === 0 }
}

/** 1250000 → "1,3 jt" (id) / "1.3M" (en); 950 → "950". For axes and tight labels. */
export function compact(n: number, lang: Lang = 'id', opts: { signed?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '–'
  const b = compactBody(Math.abs(n), lang)
  return (b.zero ? '' : sign(n, !!opts.signed)) + b.text
}

/**
 * Rupiah. short: "Rp 1,2 jt" / "Rp 1,25 M" / "Rp 950 rb" (en "Rp 1.2M", "Rp 1.25B", "Rp 950k").
 * full: "Rp 1.250.000" (en "Rp 1,250,000"). Negatives: "−Rp 1,5 jt". Always whole rupiah.
 */
export function rupiah(n: number, mode: RupiahMode = 'short', lang: Lang = 'id', opts: { signed?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '–'
  const v = tidy(n, 0)
  const abs = Math.abs(v)
  const body = mode === 'full' ? plain(abs, 0, lang) : compactBody(abs, lang).text
  return `${sign(v, !!opts.signed)}Rp${NBSP}${body}`
}

/* ------------------------------------------------------------------ dates (WIB) */

export type DateInput = Date | number | string
export type DateStyle = 'short' | 'long' | 'day' | 'dayMonth' | 'monthYear' | 'weekday'

const toDate = (d: DateInput): Date => (d instanceof Date ? d : new Date(d))

const dfCache = new Map<string, Intl.DateTimeFormat>()
function df(lang: Lang, key: string, o: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${lang}|${key}`
  let f = dfCache.get(k)
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE[lang], { timeZone: TZ, ...o })
    dfCache.set(k, f)
  }
  return f
}

const DATE_OPTS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  day: { day: 'numeric' },
  dayMonth: { day: 'numeric', month: 'short' },
  monthYear: { month: 'short', year: 'numeric' },
  weekday: { weekday: 'short' },
}

/** "17 Nov 2026" (short) · "Selasa, 17 November 2026" (long) · "17 Nov" (dayMonth) — in WIB. */
export function dateWib(d: DateInput, lang: Lang = 'id', style: DateStyle = 'short'): string {
  const date = toDate(d)
  if (Number.isNaN(date.getTime())) return '–'
  return df(lang, `d-${style}`, DATE_OPTS[style]).format(date).replace(/\.$/, '')
}

/** "14.05 WIB" (id) / "14:05 WIB" (en). `seconds` adds ss. */
export function timeWib(d: DateInput, lang: Lang = 'id', opts: { seconds?: boolean; suffix?: boolean } = {}): string {
  const date = toDate(d)
  if (Number.isNaN(date.getTime())) return '–'
  const { seconds = false, suffix = true } = opts
  const parts = df(lang, `t-${seconds ? 's' : 'm'}`, {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' as const } : {}),
    hourCycle: 'h23',
  }).formatToParts(date)
  const sep = lang === 'id' ? '.' : ':'
  const pick = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '00'
  const hh = pick('hour') === '24' ? '00' : pick('hour')
  const core = [hh, pick('minute'), ...(seconds ? [pick('second')] : [])].join(sep)
  return suffix ? `${core}${NBSP}WIB` : core
}

/** World-clock minutes since 00:00 → "07.30" (id) / "07:30" (en); add WIB with `suffix`. */
export function clockWib(minutes: number, lang: Lang = 'id', suffix = false): string {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440
  const core = `${String(Math.floor(m / 60)).padStart(2, '0')}${lang === 'id' ? '.' : ':'}${String(m % 60).padStart(2, '0')}`
  return suffix ? `${core}${NBSP}WIB` : core
}

const REL: Record<Lang, { now: string; min: string; h: string; d: string; w: string; ago: (s: string) => string; in: (s: string) => string; yday: string; tmrw: string }> = {
  id: { now: `baru${NBSP}saja`, min: 'mnt', h: 'j', d: 'hr', w: 'mgg', ago: (s) => `${s}${NBSP}lalu`, in: (s) => `dalam${NBSP}${s}`, yday: 'kemarin', tmrw: 'besok' },
  en: { now: `just${NBSP}now`, min: 'min', h: 'h', d: 'd', w: 'wk', ago: (s) => `${s}${NBSP}ago`, in: (s) => `in${NBSP}${s}`, yday: 'yesterday', tmrw: 'tomorrow' },
}

/**
 * Relative time: "baru saja", "5 mnt lalu", "2 j lalu", "kemarin", "3 hr lalu", "2 mgg lalu", then a WIB date.
 * Future: "dalam 2 j" / "in 2 h". `now` defaults to Date.now() (pass the world clock in demos).
 */
export function relative(d: DateInput, lang: Lang = 'id', now: DateInput = Date.now()): string {
  const t = toDate(d).getTime()
  const n = toDate(now).getTime()
  if (Number.isNaN(t) || Number.isNaN(n)) return '–'
  const L = REL[lang]
  const diff = n - t
  const past = diff >= 0
  const s = Math.abs(diff) / 1000
  const wrap = (v: number, u: string) => (past ? L.ago : L.in)(`${v}${NBSP}${u}`)
  if (s < 45) return L.now
  if (s < 3600) return wrap(Math.max(1, Math.round(s / 60)), L.min)
  if (s < 86400) return wrap(Math.round(s / 3600), L.h)
  if (s < 2 * 86400) return past ? L.yday : L.tmrw
  if (s < 7 * 86400) return wrap(Math.floor(s / 86400), L.d)
  if (s < 35 * 86400) return wrap(Math.floor(s / (7 * 86400)), L.w)
  return dateWib(t, lang, 'short')
}

/* ------------------------------------------------------------------ bound set */

export interface Formatters {
  lang: Lang
  num: (n: number, opts?: Omit<NumOpts, 'lang'>) => string
  percent: (n: number, opts?: Omit<PercentOpts, 'lang'>) => string
  compact: (n: number, opts?: { signed?: boolean }) => string
  rupiah: (n: number, mode?: RupiahMode, opts?: { signed?: boolean }) => string
  dateWib: (d: DateInput, style?: DateStyle) => string
  timeWib: (d: DateInput, opts?: { seconds?: boolean; suffix?: boolean }) => string
  relative: (d: DateInput, now?: DateInput) => string
}

const boundCache = new Map<Lang, Formatters>()
/** All formatters bound to one language: `const f = formatters(lang); f.rupiah(1.2e6)`. */
export function formatters(lang: Lang): Formatters {
  let f = boundCache.get(lang)
  if (!f) {
    f = {
      lang,
      num: (n, o) => num(n, { ...o, lang }),
      percent: (n, o) => percent(n, { ...o, lang }),
      compact: (n, o) => compact(n, lang, o),
      rupiah: (n, m, o) => rupiah(n, m, lang, o),
      dateWib: (d, s) => dateWib(d, lang, s),
      timeWib: (d, o) => timeWib(d, lang, o),
      relative: (d, now) => relative(d, lang, now),
    }
    boundCache.set(lang, f)
  }
  return f
}
