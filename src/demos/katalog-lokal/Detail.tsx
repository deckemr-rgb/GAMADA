/**
 * The need detail of the Pemda side: NeedSpecCard → MatchBoard (or the lazy map) → compare tray → orders with
 * OrderTracker. NeedSpecCard and OrderTracker are pure-props components (Tahap 6 mini demo).
 */
import { Suspense, lazy, useMemo } from 'react'
import { Button, LoadingText, Segmented, Stepper } from '../../demo-kit/ui'
import type { CatalogNeed, Order, WorldState } from '../../demo-kit/world'
import { catalogShortlist, needView, type NeedView } from '../../demo-kit/world/pasar-daerah'
import AppLink from '../../components/AppLink'
import { DEMO_READY } from '../registry'
import { MatchBoard } from './MatchBoard'
import { bizName, kecName, nf, rp, type Lang } from './model'
import type { T } from './strings'

export const loadMap = () => import('./NeedMap')
const NeedMap = lazy(loadMap)

const STEPS: Order['status'][] = ['dipesan', 'dikonfirmasi', 'dikirim', 'dibayar']

export interface NeedSpecCardProps {
  need: CatalogNeed
  source: NeedView['source']
  sourceRef: string | null
  hps: number | null
  flags: NeedView['flags']
  kec: string
  t: T
  lang: Lang
}

export function NeedSpecCard({ need: n, source, sourceRef, hps, flags, kec, t, lang }: NeedSpecCardProps) {
  const srcChip =
    source === 'awas-belanja' && sourceRef && DEMO_READY['awas-belanja'] ? (
      <AppLink className="dk-kl-chip is-link" to={`/demo/awas-belanja?focus=${sourceRef.split(':')[1]}`}>
        {t.src[source]} ↗
      </AppLink>
    ) : (
      <span className="dk-kl-chip">{t.src[source]}</span>
    )
  return (
    <section className={`dk-kl-spec${n.emergency ? ' is-emergency' : ''}`} data-kl="need-spec" data-need={n.id}>
      {source === 'siaga-wilayah' && <p className="dk-kl-banner">{t.emergencyBanner}</p>}
      <header>
        <span className="dk-kl-code dk-num">{n.code}</span>
        {srcChip}
        {n.emergency && <span className="dk-kl-chip is-warn">{t.emergency}</span>}
        {flags.map((f) =>
          DEMO_READY['awas-belanja'] ? (
            <AppLink key={f.procurementId} className="dk-kl-chip is-danger is-link" to={`/demo/awas-belanja?focus=${f.procurementId}`} data-kl="flag">
              {t.flag(f.pct)} ↗
            </AppLink>
          ) : (
            <span key={f.procurementId} className="dk-kl-chip is-danger" data-kl="flag">
              {t.flag(f.pct)}
            </span>
          ),
        )}
      </header>
      <h3>{n.title[lang]}</h3>
      <dl className="dk-kl-facts">
        <div>
          <dt>{t.kec}</dt>
          <dd data-kl="kec">{kec}</dd>
        </div>
        <div>
          <dt>{t.deadline}</dt>
          <dd>{t.deadlineDays(n.deadlineDays)}</dd>
        </div>
        {hps !== null && (
          <div>
            <dt>{t.hps}</dt>
            <dd className="dk-num" data-kl="hps">
              {rp(hps)} <span className="dk-kl-sim">{t.sim}</span>
            </dd>
          </div>
        )}
        {n.budget ? (
          <div>
            <dt>{t.budget}</dt>
            <dd className="dk-num">
              {rp(n.budget)} <span className="dk-kl-sim">{t.sim}</span>
            </dd>
          </div>
        ) : null}
      </dl>
      <ul className="dk-kl-items" aria-label={t.items}>
        {n.items.map((i, k) => (
          <li key={k}>
            <b className="dk-num">{nf(lang, i.qty)}</b> {i.unit} · {i.name[lang]}
            {i.spec && <span className="dk-kl-muted"> — {i.spec[lang]}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

export interface OrderTrackerProps {
  order: Order
  biz: string
  t: T
  lang: Lang
  onPay?: (o: Order) => void
  onOpenUmkm?: (o: Order) => void
}

export function OrderTracker({ order: o, biz, t, lang, onPay, onOpenUmkm }: OrderTrackerProps) {
  const cur = STEPS.indexOf(o.status) + 1
  const req = o.items.reduce((a, i) => a + i.qty, 0)
  const conf = o.confirmedQty?.reduce((a, q) => a + q, 0)
  return (
    <li className="dk-kl-ord" data-kl-order={o.id} data-status={o.status}>
      <header>
        <span className="dk-kl-code dk-num" data-kl="order-code">
          {o.code}
        </span>
        <b>{biz}</b>
        <span className="dk-num" data-kl="order-total">
          {rp(o.total)} <span className="dk-kl-sim">{t.sim}</span>
        </span>
      </header>
      <Stepper steps={t.status} current={cur} label={`${t.tracker} ${o.code}`} className="dk-kl-steps" />
      {conf !== undefined && conf !== req && <p className="dk-kl-muted dk-num">{t.partial(conf, req)}</p>}
      <div className="dk-kl-ord-act">
        {o.status === 'dipesan' || o.status === 'dikonfirmasi' ? (
          <>
            <span className="dk-kl-muted">{o.status === 'dipesan' ? t.waitConfirm : t.status[1]}</span>
            {onOpenUmkm && (
              <Button size="sm" variant="ghost" icon="arrowRight" onClick={() => onOpenUmkm(o)}>
                {t.openUmkm}
              </Button>
            )}
          </>
        ) : o.status === 'dikirim' ? (
          onPay && (
            <Button size="sm" variant="primary" onClick={() => onPay(o)} data-kl="pay">
              {t.pay}
            </Button>
          )
        ) : (
          <span className="dk-kl-paid">
            ✓ {t.paid}
            {o.paidAt !== undefined ? ` · ${nf(lang, o.total)}` : ''}
          </span>
        )}
      </div>
    </li>
  )
}

export interface DetailProps {
  s: WorldState
  needId: string
  picks: readonly string[]
  onPick: (bizId: string) => void
  onClearPicks: () => void
  onCompare: () => void
  compareIntent: () => void
  view: 'daftar' | 'peta'
  onView: (v: 'daftar' | 'peta') => void
  onPay: (o: Order) => void
  onOpenUmkm: (o: Order) => void
  t: T
  lang: Lang
}

export default function Detail({ s, needId, picks, onPick, onClearPicks, onCompare, compareIntent, view, onView, onPay, onOpenUmkm, t, lang }: DetailProps) {
  const v = needView(s, needId)
  const sl = catalogShortlist(s, needId)
  const matched = useMemo(() => new Set(v?.matches.map((m) => m.businessId) ?? []), [v?.matches])
  const kn = (id: string) => kecName(s, id)
  if (!v) return null
  const open = v.need.status === 'baru' || v.need.status === 'dicocokkan'
  return (
    <div className="dk-kl-detail" data-need={needId} data-status={v.need.status}>
      <NeedSpecCard need={v.need} source={v.source} sourceRef={v.sourceRef} hps={v.hps} flags={v.flags} kec={kn(v.need.kecamatanId)} t={t} lang={lang} />
      <div className="dk-kl-board-h">
        <h3>{t.board}</h3>
        <Segmented<'daftar' | 'peta'>
          options={[
            { value: 'daftar', label: t.daftar, icon: 'list' },
            { value: 'peta', label: t.peta, icon: 'map' },
          ]}
          value={view}
          onChange={onView}
          onIntent={(x) => {
            if (x === 'peta') void loadMap()
          }}
          label={t.view}
          size="sm"
        />
      </div>
      <p className="dk-kl-muted">{t.boardNote}</p>
      {view === 'peta' ? (
        <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
          <NeedMap s={s} needId={needId} cards={sl.top} waiting={sl.waiting} matched={matched} lang={lang} />
        </Suspense>
      ) : (
        <MatchBoard key={needId} cards={sl.top} matched={matched} waiting={sl.waiting} picks={picks} onPick={onPick} kecName={kn} t={t} lang={lang} />
      )}
      {open && sl.top.length > 0 && (
        <div className="dk-kl-tray" data-kl="tray">
          <span className="dk-num">{picks.length ? t.tray(picks.length) : t.compareWhy}</span>
          {picks.length >= 3 && <span className="dk-kl-muted">{t.pickMax}</span>}
          {picks.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onClearPicks}>
              {t.clearPicks}
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            data-kl="compare"
            disabled={picks.length < 2}
            aria-describedby={picks.length < 2 ? 'kl-cmp-why' : undefined}
            onClick={onCompare}
            onPointerEnter={compareIntent}
            onFocus={compareIntent}
          >
            {t.compareBtn(picks.length)}
          </Button>
          {picks.length < 2 && (
            <span id="kl-cmp-why" className="dk-sr">
              {t.compareWhy}
            </span>
          )}
        </div>
      )}
      <section className="dk-kl-orders" aria-label={t.orders}>
        <h3>{t.orders}</h3>
        {v.orders.length ? (
          <ul>
            {v.orders.map((o) => (
              <OrderTracker key={o.id} order={o} biz={bizName(s, o.businessId)} t={t} lang={lang} onPay={onPay} onOpenUmkm={onOpenUmkm} />
            ))}
          </ul>
        ) : (
          <p className="dk-kl-muted">{t.noOrders}</p>
        )}
      </section>
    </div>
  )
}
