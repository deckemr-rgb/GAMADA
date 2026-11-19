/**
 * Rapor.tsx — "Skor usaha" (the owner's first screen): ScoreDial 0 → score (900 ms; final under reduced motion), band,
 * "−40 vs Okt", the "Skor simulasi · bukan keputusan kredit" ribbon, the 12-month sparkline (+ lazy chart), "Data
 * masuk hari ini" (dataFeed = outletKpis().total, counts up with the 07:01 / 07:03 sales), the FactorWaterfall from
 * the peer median to the score, the factor drawer (mission 1) and exactly 3 "Cara menaikkan skor" cards
 * (scoreActions). Every number from raporOf / scoreActions / dataFeed.
 */
import { Suspense, lazy, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useShell } from '../../demo-kit/shell'
import { Button, Drawer, Icon, flashNewRow, motionMode } from '../../demo-kit/ui'
import { Dial } from './Dial'
import { useWorld, type ScoreFactor, type WorldState } from '../../demo-kit/world'
import { SCORE_BANDS, SCORE_FACTOR, type RaporFactor, type ScoreAction } from '../../demo-kit/world/pasar-daerah'
import type { ProductSlug } from '../../content/products'
import { FactorWaterfall } from './FactorWaterfall'
import { DemoLink } from './DemoLink'
import { useT } from './strings'
import { actionsM, afterPaint, feedM, monthShort, pctText, raporM, rp, timeText, uiStore, useUi, type Lang } from './model'

const loadReview = () => import('./Review')
const loadTrend = () => import('./Trend')
const Review = lazy(loadReview)
const Trend = lazy(loadTrend)

const S = {
  id: {
    dial: 'Skor kesehatan usaha',
    ribbon: 'Skor simulasi · bukan keputusan kredit',
    vs: (d: number, m: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} vs ${m}`,
    live: (n: number, total: number, step: number) => `Skor sekarang ${n}${total ? ` (${sg(total)} sejak awal sesi${step !== total ? `; langkah terakhir ${sg(step)}` : ''})` : ''}`,
    trend: 'Skor 12 bulan',
    trendBtn: 'Lihat 12 bulan',
    feedTitle: 'Data masuk hari ini',
    feedSales: (n: number, v: string) => `Penjualan ${n} transaksi · ${v}`,
    feedSim: 'simulasi',
    recalc: (t: string) => `Dihitung ulang ${t}`,
    feedEmpty: 'Belum ada data masuk hari ini.',
    kind: { penjualan: 'Penjualan', jurnal: 'Jurnal', pajak: 'Pajak', kyb: 'KYB' } as Record<string, string>,
    wfTitle: 'Yang menaikkan / menurunkan skor',
    wfLabel: 'Rincian skor dari median pembanding sampai skor toko',
    total: 'Skor toko',
    pts: (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)} poin`,
    perBook: (m: string) => `per tutup buku ${m}`,
    liveNote: 'diperbarui langsung',
    src: { 'toko-autopilot': 'Toko Autopilot', 'pajak-beres': 'Pajak Beres', 'kenal-mitra': 'Kenal Mitra' } as Record<string, string>,
    actTitle: 'Cara menaikkan skor',
    actFix: (n: number) => `Rapikan ${n} jurnal`,
    actTax: (m: string) => `Siapkan pajak ${m}`,
    actKyb: 'Lengkapi verifikasi KYB',
    actStock: 'Stok aman',
    actSupplier: 'Bayar pemasok tepat waktu',
    gainNow: (n: number) => `+${n} poin`,
    gainBook: (n: number) => `perkiraan +${n} saat tutup buku`,
    open: 'Buka',
    check: 'Periksa saran akun',
    fixWhy: 'AI menemukan jurnal yang akunnya belum pasti. Periksa saran akunnya.',
    taxWhy: 'Hitung pajak bulan ini dan tandai siap lapor di Pajak Beres.',
    kybWhy: 'Unggah dokumen usaha dan selesaikan verifikasi di Kenal Mitra.',
    stockWhy: 'Kirim PO sebelum stok habis supaya tagihan pemasok tepat waktu.',
    supWhy: 'Lunasi tagihan pemasok sebelum jatuh tempo.',
    drawerEyebrow: 'Faktor skor · simulasi',
    value: 'Nilai faktor',
    weight: 'Bobot',
    contrib: 'Dibanding median',
    evidence: 'Bukti',
    source: 'Sumber data',
    openSource: (p: string) => `Buka di ${p}`,
    tidy: 'Rapikan jurnal sekarang',
    done: 'Semua cara langsung sudah dilakukan. Skor berikutnya naik saat tutup buku.',
  },
  en: {
    dial: 'Business health score',
    ribbon: 'Simulated score · not a credit decision',
    vs: (d: number, m: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} vs ${m}`,
    live: (n: number, total: number, step: number) => `Score now ${n}${total ? ` (${sg(total)} since the session start${step !== total ? `; last step ${sg(step)}` : ''})` : ''}`,
    trend: '12-month score',
    trendBtn: 'See 12 months',
    feedTitle: 'Data in today',
    feedSales: (n: number, v: string) => `Sales ${n} transactions · ${v}`,
    feedSim: 'simulated',
    recalc: (t: string) => `Recalculated ${t}`,
    feedEmpty: 'No data in yet today.',
    kind: { penjualan: 'Sale', jurnal: 'Journal', pajak: 'Tax', kyb: 'KYB' },
    wfTitle: 'What raises / lowers the score',
    wfLabel: 'Score breakdown from the peer median to the shop’s score',
    total: 'Shop score',
    pts: (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)} pts`,
    perBook: (m: string) => `as of the ${m} book close`,
    liveNote: 'updated live',
    src: { 'toko-autopilot': 'Toko Autopilot', 'pajak-beres': 'Pajak Beres', 'kenal-mitra': 'Kenal Mitra' },
    actTitle: 'How to raise the score',
    actFix: (n: number) => `Tidy ${n} journal entries`,
    actTax: (m: string) => `Get the ${m} tax ready`,
    actKyb: 'Complete the KYB verification',
    actStock: 'Safe stock',
    actSupplier: 'Pay suppliers on time',
    gainNow: (n: number) => `+${n} pts`,
    gainBook: (n: number) => `about +${n} at the book close`,
    open: 'Open',
    check: 'Check the suggestions',
    fixWhy: 'The AI found entries whose account is uncertain. Check the suggested accounts.',
    taxWhy: 'Compute this month’s tax and mark it ready to file in Pajak Beres.',
    kybWhy: 'Upload the business documents and finish the check in Kenal Mitra.',
    stockWhy: 'Send POs before stock runs out so supplier bills are paid on time.',
    supWhy: 'Settle supplier bills before they are due.',
    drawerEyebrow: 'Score factor · simulated',
    value: 'Factor value',
    weight: 'Weight',
    contrib: 'Vs the median',
    evidence: 'Evidence',
    source: 'Data source',
    openSource: (p: string) => `Open in ${p}`,
    tidy: 'Tidy the journals now',
    done: 'Every direct step is done. The next rise comes at the book close.',
  },
}
type L = (typeof S)['id']

const raporSel = (s: WorldState) => raporM(s, s.meta.shopId)
const actSel = (s: WorldState) => actionsM(s, s.meta.shopId)
const feedSel = (s: WorldState) => {
  const f = feedM(s, s.meta.shopId)
  return { tx: f.tx, revenue: f.revenue, rows: f.rows.slice(0, 4), n: f.rows.length }
}
const feedEq = (a: ReturnType<typeof feedSel>, b: ReturnType<typeof feedSel>) => a.tx === b.tx && a.n === b.n && a.revenue === b.revenue
const monthSel = (s: WorldState) => s.day.slice(0, 7)

export default function Rapor(_props: { goTab: (t: string) => void }) {
  const [L, lang] = useLang()
  const r = useWorld(raporSel)
  const factor = useUi((u) => u.factor)
  const review = useUi((u) => u.review)
  const [trend, setTrend] = useState(false)
  if (!r) return null
  const prevMonth = r.history12[r.history12.length - 2]?.month ?? ''
  return (
    <div className="dk-ru-rapor">
      <div className="dk-ru-top">
        <DialCard L={L} lang={lang} score={r.score} band={r.band} delta={r.deltaMonth} prevMonth={prevMonth} history={r.history12} onTrend={() => setTrend(true)} />
        <FeedCard L={L} lang={lang} recalcAt={r.recalcAt} />
      </div>
      <Waterfall L={L} lang={lang} />
      <Actions L={L} lang={lang} />
      <FactorDrawer L={L} lang={lang} factorKey={factor} factors={r.factors} />
      {review !== false && (
        <Suspense fallback={null}>
          <Review />
        </Suspense>
      )}
      {trend && (
        <Suspense fallback={null}>
          <Trend open={trend} onClose={() => setTrend(false)} history={r.history12} />
        </Suspense>
      )}
    </div>
  )
}

function useLang(): [L, Lang] {
  const { lang } = useT()
  return [S[lang], lang]
}

/** the shop's score when this page session first showed it, for "sejak awal sesi" */
let sessionStart: number | null = null
const sg = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d)}`

const DialCard = memo(function DialCard({ L, lang, score, band, delta, prevMonth, history, onTrend }: { L: L; lang: Lang; score: number; band: number; delta: number; prevMonth: string; history: { month: string; score: number }[]; onTrend: () => void }) {
  const last = useRef(score)
  sessionStart ??= score
  const [said, setSaid] = useState('')
  useEffect(() => {
    if (score !== last.current) {
      setSaid(L.live(score, score - (sessionStart ?? score), score - last.current))
      last.current = score
    }
  }, [score, L])
  const b = SCORE_BANDS[band]!
  return (
    <section className="dk-ru-card dk-ru-dialcard" aria-label={L.dial} data-tour="ru-dial">
      <p className="dk-ru-ribbon">
        <Icon name="info" size={14} /> {L.ribbon}
      </p>
      <div className="dk-ru-dialrow">
        <Dial value={score} prev={0} bands={SCORE_BANDS} label={{ id: S.id.dial, en: S.en.dial }} size="lg" />
        <div className="dk-ru-dialside">
          <span className={`dk-ru-band is-${b.tone}`} data-ru="band">
            {b.label[lang]}
          </span>
          <span className={`dk-ru-delta${delta < 0 ? ' is-down' : delta > 0 ? ' is-up' : ''}`} data-ru="delta">
            {L.vs(delta, monthShort(prevMonth, lang))}
          </span>
          <span className="dk-ru-score-num dk-num" data-ru="score">
            {score}
          </span>
        </div>
      </div>
      <div className="dk-ru-trend">
        <Spark values={history.map((h) => h.score)} label={`${L.trend}: ${history.map((h) => `${monthShort(h.month, lang)} ${h.score}`).join(', ')}`} />
        <Button size="sm" variant="quiet" icon="chart" onClick={onTrend} {...{ onPointerEnter: () => void loadTrend(), onFocus: () => void loadTrend() }} aria-haspopup="dialog" data-ru="trend">
          {L.trendBtn}
        </Button>
      </div>
      <p className="dk-sr-only" aria-live="polite">
        {said}
      </p>
    </section>
  )
})

const FeedCard = memo(function FeedCard({ L, lang, recalcAt }: { L: L; lang: Lang; recalcAt: number }) {
  const f = useWorld(feedSel, feedEq)
  const ref = useRef<HTMLParagraphElement>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (ref.current) flashNewRow(ref.current)
  }, [f.tx])
  return (
    <section className="dk-ru-card dk-ru-feed" aria-labelledby="dk-ru-feed-h" data-ru="feed">
      <h3 id="dk-ru-feed-h">
        <Icon name="pulse" size={16} /> {L.feedTitle} <span className="dk-ru-sim">{L.feedSim}</span>
      </h3>
      <p ref={ref} className="dk-ru-feed-sum dk-num" data-ru="feed-sales" data-tx={f.tx} data-revenue={f.revenue}>
        {L.feedSales(f.tx, rp(f.revenue, lang))}
      </p>
      {f.rows.length ? (
        <ul className="dk-ru-feed-chips" aria-label={L.feedTitle} tabIndex={0}>
          {f.rows.map((x) => (
            <li key={x.id} className="dk-ru-feed-chip">
              <b>{L.kind[x.kind]}</b> {x.kind === 'penjualan' ? x.id : x.text[lang]} · {timeText(x.at, lang)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="dk-ru-muted">{L.feedEmpty}</p>
      )}
      <p className="dk-ru-fine" data-ru="recalc">
        {L.recalc(timeText(recalcAt, lang))}
      </p>
    </section>
  )
})

/** a tiny static sparkline (the kit Sparkline pulls ChartFrame + format into the first load, ≈ 8 KB) */
function Spark({ values, label }: { values: number[]; label: string }) {
  const lo = Math.min(...values) - 5
  const hi = Math.max(...values) + 5
  const W = 200
  const H = 36
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * (W - 6) + 3).toFixed(1)},${(H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6)).toFixed(1)}`)
  return (
    <svg className="dk-ru-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polygon points={`3,${H} ${pts.join(' ')} ${W - 3},${H}`} className="dk-ru-spark-area" />
      <polyline points={pts.join(' ')} className="dk-ru-spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const pctW = (w: number, lang: Lang) => pctText(w, lang)
function Waterfall({ L, lang }: { L: L; lang: Lang }) {
  const r = useWorld(raporSel)
  const month = useWorld(monthSel)
  const flash = useUi((u) => u.flash)
  const box = useRef<HTMLDivElement>(null)
  const prev = useRef<Record<string, number> | null>(null)
  const anim = useMemo(() => motionMode() === 'full', [])
  // a factor whose points changed flashes (e.g. pajak after tax.ready); a ?focus=<factor> arrival flashes too
  useLayoutEffect(() => {
    if (!r) return
    const now = Object.fromEntries(r.factors.map((f) => [f.key, f.contribution]))
    const was = prev.current
    prev.current = now
    if (!was) return
    for (const k of Object.keys(now)) {
      if (now[k] !== was[k]) {
        const el = box.current?.querySelector<HTMLElement>(`[data-factor="${k}"]`)
        if (el) flashNewRow(el)
      }
    }
  }, [r])
  useEffect(() => {
    if (!flash) return
    const el = box.current?.querySelector<HTMLElement>(`[data-factor="${flash}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest' })
    flashNewRow(el)
    uiStore.set({ flash: null })
  }, [flash])
  if (!r) return null
  const prevMonth = monthShort(r.history12[r.history12.length - 2]?.month ?? month, lang)
  return (
    <section className="dk-ru-card" aria-labelledby="dk-ru-wf-h" ref={box}>
      <h3 id="dk-ru-wf-h">{L.wfTitle}</h3>
      <FactorWaterfall
        label={L.wfLabel}
        lang={lang}
        animate={anim}
        peer={{ label: r.peerLabel[lang], score: r.peerScore }}
        total={{ label: L.total, score: r.score }}
        pts={L.pts}
        onOpen={(k) => uiStore.set({ factor: k as ScoreFactor })}
        rows={r.factors.map((f) => ({
          key: f.key,
          label: SCORE_FACTOR[f.key].label[lang],
          points: f.contribution,
          evidence: f.evidence[lang],
          note: f.live ? L.liveNote : L.perBook(prevMonth),
          source: (
            <DemoLink slug={f.source} href={`/demo/${f.source}${f.focus ? `?focus=${f.focus}` : ''}`} className="dk-ru-srcchip">
              {L.src[f.source] ?? f.source}
            </DemoLink>
          ),
        }))}
      />
      <p className="dk-ru-fine">{`${L.weight}: ${r.factors.map((f) => `${SCORE_FACTOR[f.key].label[lang]} ${pctW(f.weight, lang)}`).join(' · ')}`}</p>
    </section>
  )
}

function actionText(L: L, a: ScoreAction, n: number, month: string): { title: string; why: string } {
  switch (a.key) {
    case 'rapikan-jurnal':
      return { title: L.actFix(n), why: L.fixWhy }
    case 'pajak-siap':
      return { title: L.actTax(month), why: L.taxWhy }
    case 'kyb':
      return { title: L.actKyb, why: L.kybWhy }
    case 'stok-aman':
      return { title: L.actStock, why: L.stockWhy }
    default:
      return { title: L.actSupplier, why: L.supWhy }
  }
}
const SLUG_OF: Record<string, ProductSlug> = { 'pajak-siap': 'pajak-beres', kyb: 'kenal-mitra', 'stok-aman': 'toko-autopilot', 'bayar-supplier': 'pajak-beres' }
const reviewCount = (s: WorldState) => {
  let n = 0
  for (const id of s.ledger.ids) {
    const j = s.ledger.byId[id]!
    if (j.businessId === s.meta.shopId && j.needsReview) n++
  }
  return n
}
const MONTH_LONG = {
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

function Actions({ L, lang }: { L: L; lang: Lang }) {
  const list = useWorld(actSel)
  const n = useWorld(reviewCount)
  const month = useWorld(monthSel)
  const mName = MONTH_LONG[lang][Number(month.slice(5, 7)) - 1] ?? month
  return (
    <section className="dk-ru-card" aria-labelledby="dk-ru-act-h">
      <h3 id="dk-ru-act-h">{L.actTitle}</h3>
      <ol className="dk-ru-acts">
        {list.map((a, i) => {
          const tx = actionText(L, a, n, mName)
          const gain = a.kind === 'langsung' ? L.gainNow(a.gain) : L.gainBook(a.gain)
          const hot = i === 0 ? { 'data-hotspot': 'ru-fix' } : {}
          return (
            <li key={a.key} className={`dk-ru-act is-${a.kind}`} data-action={a.key} {...hot}>
              <span className="dk-ru-act-gain dk-num">{gain}</span>
              <strong>{tx.title}</strong>
              <span className="dk-ru-muted">{tx.why}</span>
              {a.target === null ? (
                <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'} icon="check" onClick={() => afterPaint(() => uiStore.set({ review: true }))} onPointerEnter={() => void loadReview()} onFocus={() => void loadReview()} aria-haspopup="dialog" data-ru="fix">
                  {L.check}
                </Button>
              ) : (
                <DemoLink slug={SLUG_OF[a.key] ?? 'pajak-beres'} href={a.target} className="dk-ru-actlink">
                  {L.open} {L.src[SLUG_OF[a.key] ?? 'pajak-beres']} <Icon name="arrowUpRight" size={14} />
                </DemoLink>
              )}
            </li>
          )
        })}
      </ol>
      {!list.some((a) => a.kind === 'langsung') && <p className="dk-ru-muted">{L.done}</p>}
    </section>
  )
}

function FactorDrawer({ L, lang, factorKey, factors }: { L: L; lang: Lang; factorKey: ScoreFactor | null; factors: RaporFactor[] }) {
  const f = factors.find((x) => x.key === factorKey) ?? null
  const close = () => uiStore.set({ factor: null })
  return (
    <Drawer open={!!f} onClose={close} title={f ? SCORE_FACTOR[f.key].label[lang] : ''} eyebrow={L.drawerEyebrow} width={440}>
      {f && <FactorBody L={L} lang={lang} f={f} />}
    </Drawer>
  )
}
function FactorBody({ L, lang, f }: { L: L; lang: Lang; f: RaporFactor }) {
  const { markMission } = useShell()
  const pending = useWorld(reviewCount)
  useEffect(() => {
    markMission('faktor')
  }, [markMission])
  return (
    <div className="dk-ru-fdrawer" data-ru="factor-drawer" data-factor={f.key}>
      <p>{SCORE_FACTOR[f.key].explain[lang]}</p>
      <dl className="dk-ru-dl">
        <div>
          <dt>{L.value}</dt>
          <dd className="dk-num">{pctText(f.value, lang)}</dd>
        </div>
        <div>
          <dt>{L.weight}</dt>
          <dd className="dk-num">{pctText(f.weight, lang)}</dd>
        </div>
        <div>
          <dt>{L.contrib}</dt>
          <dd className="dk-num" data-ru="factor-points">
            {L.pts(f.contribution)}
          </dd>
        </div>
        <div>
          <dt>{L.evidence}</dt>
          <dd>{f.evidence[lang]}</dd>
        </div>
        <div>
          <dt>{L.source}</dt>
          <dd>
            {L.src[f.source]} · {f.live ? L.liveNote : L.perBook(lang === 'id' ? 'Oktober' : 'October')}
          </dd>
        </div>
      </dl>
      <div className="dk-ru-row">
        {f.key === 'pajak' && pending > 0 && (
          <Button size="sm" variant="primary" icon="check" onClick={() => afterPaint(() => uiStore.set({ factor: null, review: true }))}>
            {L.tidy}
          </Button>
        )}
        <DemoLink slug={f.source} href={`/demo/${f.source}${f.focus ? `?focus=${f.focus}` : ''}`} className="dk-ru-actlink">
          {L.openSource(L.src[f.source] ?? f.source)} <Icon name="arrowUpRight" size={14} />
        </DemoLink>
      </div>
    </div>
  )
}
