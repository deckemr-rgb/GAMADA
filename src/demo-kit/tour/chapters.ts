/**
 * tour/chapters.ts — the 19 chapter scripts + the summary (plan §2). DATA only: times, products and titles mirror
 * content/tour.ts (the site index); narration text lives in narration.<lang>.ts, world values in world-steps.ts.
 * Selectors are the products' own hooks (data-hotspot / data-<p> / data-tour); `fb` = the world key a missing
 * selector falls back to (engine counts it in `fallbacks`).
 */
import { PRODUCT_BY_SLUG } from '../../content/products'
import type { ChapterScript } from './types'

const eco = (slug: ChapterScript['product']) => PRODUCT_BY_SLUG[slug].eco

const c = (x: Omit<ChapterScript, 'eco'>): ChapterScript => ({ ...x, eco: eco(x.product) })

export const CHAPTERS: readonly ChapterScript[] = [
  c({
    n: 1, time: '06:00', product: 'siaga-wilayah', role: 'bpbd', duration: 26, world: [],
    steps: [
      { k: 'wait', ms: 1200 },
      { k: 'focus', sel: '[data-hotspot="sw-run"]', cap: 0 },
      { k: 'click', sel: '[data-sw="cta"]', cap: 1 },
      { k: 'wait', ms: 4500 },
      { k: 'focus', sel: '[data-sw="layers"]', cap: 2 },
    ],
  }),
  c({
    n: 2, time: '06:20', product: 'siaga-wilayah', role: 'bpbd', duration: 24, world: ['flood', 'broadcast'],
    steps: [
      { k: 'story', key: 'flood' },
      { k: 'navigate', slug: 'siaga-wilayah', role: 'bpbd', focus: 'alert' },
      { k: 'caption', cap: 0 },
      { k: 'wait', ms: 1500 },
      { k: 'click', sel: '[data-tour="sw-send-now"]', fb: 'broadcast' },
      { k: 'focus', sel: '[data-tour="sw-recipients"]', cap: 1 },
      { k: 'wait', ms: 1800 },
      { k: 'click', sel: '[data-sw="bc-send"]', fb: 'broadcast', cap: 2 },
      { k: 'wait', ms: 3000 },
      { k: 'world', key: 'broadcast' },
      { k: 'navigate', slug: 'sapa-warga', role: 'warga', focus: 'alert' },
      { k: 'wait', ms: 1500 },
      { k: 'caption', cap: 3 },
    ],
  }),
  c({
    n: 3, time: '07:00', product: 'meja-pimpinan', role: 'kepala-daerah', duration: 28, world: [],
    steps: [
      { k: 'wait', ms: 800 },
      { k: 'click', sel: '[data-hotspot="briefing"]', cap: 0 },
      { k: 'wait', ms: 3500 },
      { k: 'focus', sel: '[data-mp="listen"]', cap: 1 },
      { k: 'wait', ms: 1500 },
      { k: 'ai', sel: '[data-tour="mp-ask"]', send: '[data-tour="mp-ask-send"]', text: { id: 'Desa mana paling berisiko?', en: 'Which village is most at risk?' }, wide: true },
      { k: 'caption', cap: 2 },
    ],
  }),
  c({
    n: 4, time: '08:15', product: 'sapa-warga', role: 'warga', duration: 30, world: ['siti', 'neighbours'],
    steps: [
      { k: 'story', key: 'siti' },
      { k: 'wait', ms: 600 },
      { k: 'focus', sel: '[data-hotspot="voice"]', cap: 0 },
      { k: 'wait', ms: 2500 },
      { k: 'story', key: 'neighbours' },
      { k: 'navigate', slug: 'sapa-warga', role: 'petugas', focus: 'siti' },
      { k: 'wait', ms: 1200 },
      { k: 'caption', cap: 1 },
      { k: 'wait', ms: 1500 },
      { k: 'caption', cap: 2 },
    ],
  }),
  c({
    n: 5, time: '09:00', product: 'naskah-pintar', role: 'sekretariat', duration: 26, world: ['instruction', 'minutes'],
    steps: [
      { k: 'story', key: 'instruction' },
      { k: 'wait', ms: 800 },
      { k: 'click', sel: '[data-np="play"]', cap: 0 },
      { k: 'wait', ms: 5000 },
      { k: 'caption', cap: 1 },
      { k: 'wait', ms: 3000 },
      { k: 'caption', cap: 2 },
    ],
  }),
  c({
    n: 6, time: '10:00', product: 'radar-isu', role: 'humas', tab: 'live', focus: 'hoax', duration: 24, world: ['clarify'],
    steps: [
      { k: 'wait', ms: 800 },
      { k: 'caption', cap: 0 },
      { k: 'wait', ms: 1800 },
      { k: 'setClock', t: '10:12' },
      { k: 'world', key: 'clarify' },
      { k: 'caption', cap: 1 },
      { k: 'wait', ms: 1500 },
      { k: 'caption', cap: 2 },
    ],
  }),
  c({
    n: 7, time: '11:00', product: 'awas-belanja', role: 'ukpbj', focus: 'pump', duration: 26, world: ['analyse', 'recommend'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'focus', sel: '[data-ab="total-gap"]', cap: 0 },
      { k: 'wait', ms: 1500 },
      { k: 'click', sel: '[data-ab="analyse"]', fb: 'analyse', cap: 1 },
      { k: 'wait', ms: 3500 },
      { k: 'world', key: 'analyse' },
      { k: 'story', key: 'recommend' },
      { k: 'caption', cap: 2 },
    ],
  }),
  c({
    n: 8, time: '11:40', product: 'katalog-lokal', role: 'ukpbj', focus: 'need', duration: 24, world: ['order'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'focus', sel: '[data-kl="match-board"]', cap: 0 },
      { k: 'wait', ms: 2200 },
      { k: 'world', key: 'order' },
      { k: 'caption', cap: 1 },
    ],
  }),
  c({
    n: 9, time: '12:00', product: 'kenal-mitra', role: 'analis-kyc', tab: 'kyb', focus: 'kybRequest', duration: 22, world: ['verify'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'click', sel: '[data-km="start"]', cap: 0 },
      { k: 'wait', ms: 2500 },
      { k: 'focus', sel: '[data-km="map-check"]', cap: 1 },
      { k: 'click', sel: '[data-km="map-check"]' },
      { k: 'wait', ms: 1800 },
      { k: 'click', sel: '[data-km="approve"]', fb: 'verify', cap: 2 },
      { k: 'wait', ms: 1500 },
      { k: 'world', key: 'verify' },
    ],
  }),
  c({
    n: 10, time: '12:30', product: 'tenderpilot', role: 'vendor', focus: 'tender', duration: 24, world: ['bid'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'focus', sel: '[data-tp="score"]', cap: 0 },
      { k: 'wait', ms: 2000 },
      { k: 'world', key: 'bid' },
      { k: 'caption', cap: 1 },
    ],
  }),
  c({
    n: 11, time: '13:00', product: 'toko-autopilot', role: 'pemilik-toko', tab: 'prediksi', focus: 'floodSku', duration: 24, world: ['po'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'focus', sel: '[data-tour="flood-banner"]', cap: 0 },
      { k: 'wait', ms: 1500 },
      { k: 'focus', sel: '[data-tour="forecast-chart"]', cap: 1, wide: true },
      { k: 'wait', ms: 1500 },
      { k: 'navigate', slug: 'toko-autopilot', role: 'pemilik-toko', tab: 'po' },
      { k: 'click', sel: '[data-tour="po-approve"]', fb: 'po', cap: 2 },
      { k: 'wait', ms: 800 },
      { k: 'world', key: 'po' },
      { k: 'setClock', t: '13:10' },
      { k: 'await', until: 'reply' },
      { k: 'caption', cap: 3 },
    ],
  }),
  c({
    n: 12, time: '13:30', product: 'juara-jualan', role: 'supervisor-sales', duration: 20, world: ['coach'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'focus', sel: '[data-hotspot="jj-marker-danger"]', cap: 0 },
      { k: 'wait', ms: 2000 },
      { k: 'world', key: 'coach' },
      { k: 'caption', cap: 1 },
    ],
  }),
  c({
    n: 13, time: '14:00', product: 'pajak-beres', role: 'pemilik-toko', focus: 'po', duration: 20, world: ['tax'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'click', sel: '[data-pb="process"]', cap: 0 },
      { k: 'wait', ms: 2500 },
      { k: 'world', key: 'tax' },
      { k: 'caption', cap: 1 },
    ],
  }),
  c({
    n: 14, time: '14:30', product: 'rapor-usaha', role: 'pemilik-toko', duration: 24, world: ['tax', 'loan'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'focus', sel: '[data-tour="ru-dial"]', cap: 0 },
      { k: 'wait', ms: 2000 },
      { k: 'world', key: 'loan' },
      { k: 'navigate', slug: 'rapor-usaha', role: 'bank-mitra' },
      { k: 'wait', ms: 1500 },
      { k: 'caption', cap: 1 },
    ],
  }),
  c({
    n: 15, time: '15:00', product: 'pantau-merek', role: 'brand-manager', focus: 'brandAlert', duration: 22, world: ['brandReply'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'focus', sel: '[data-pm="cluster"]', cap: 0 },
      { k: 'wait', ms: 2000 },
      { k: 'world', key: 'brandReply' },
      { k: 'caption', cap: 1 },
    ],
  }),
  c({
    n: 16, time: '15:30', product: 'cek-berkas', role: 'dinsos', duration: 22, world: ['bulk'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'click', sel: '[data-tour="cb-bulk"]', cap: 0 },
      { k: 'wait', ms: 1000 },
      { k: 'click', sel: '[data-hotspot="cek-go"]', fb: 'bulk', cap: 1 },
      { k: 'wait', ms: 5000 },
      { k: 'world', key: 'bulk' },
      { k: 'caption', cap: 2 },
    ],
  }),
  c({
    n: 17, time: '16:00', product: 'sinyal-pasar', role: 'disperindag', focus: 'warning', duration: 26, world: ['op'],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'caption', cap: 0 },
      { k: 'wait', ms: 2000 },
      { k: 'world', key: 'op' },
      { k: 'caption', cap: 1 },
    ],
  }),
  c({
    n: 18, time: '16:30', product: 'indeks-ekonomi', role: 'bappeda', tab: 'peta', focus: 'econ', duration: 24, world: [],
    steps: [
      { k: 'wait', ms: 1000 },
      { k: 'focus', sel: '[data-tour="ie-map"]', cap: 0 },
      { k: 'wait', ms: 2500 },
      { k: 'caption', cap: 1 },
    ],
  }),
  c({
    n: 19, time: '17:00', product: 'meja-pimpinan', role: 'kepala-daerah', duration: 30, world: [],
    steps: [
      { k: 'wait', ms: 2500 },
      { k: 'caption', cap: 0 },
      { k: 'navigate', slug: 'inti', role: 'kepala-daerah', focus: 'siti' },
      { k: 'wait', ms: 1200 },
      { k: 'focus', sel: '[data-tour="in-trail"]', cap: 1 },
      { k: 'wait', ms: 5000 },
      { k: 'caption', cap: 2 },
    ],
  }),
]

/** chapter 20 = the summary */
export const SUMMARY_N = 20
export const SUMMARY_SECONDS = 25
export const OPENER_SECONDS = 12
export const chapterOf = (n: number): ChapterScript | undefined => CHAPTERS.find((x) => x.n === n)
/** total length at 1× in seconds (plan: 7–9 min) */
export const totalSeconds = (): number => OPENER_SECONDS + CHAPTERS.reduce((a, x) => a + x.duration, 0) + SUMMARY_SECONDS
