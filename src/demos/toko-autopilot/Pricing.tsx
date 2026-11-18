/**
 * Harga & Promo — priceSuggestions (from → to, units Δ, margin Δ per day, simulated elasticity) with "Terapkan"
 * (price.changed); flood goods are locked during a flood warning and show the rule instead of a button. bundleIdeas
 * → "Buat promo" (promo.created); running promos listed.
 */
import { Button, Icon } from '../../demo-kit/ui'
import { DAY_MIN, clock, emit, rows, useWorld } from '../../demo-kit/world'
import { bundleIdeas, priceSuggestions, type PriceSuggestion } from '../../demo-kit/world/usaha-pintar'
import { SLUG, pct, rp, useT } from './strings'
import type { TabProps } from './types'

const S = {
  id: {
    title: 'Saran harga', none: 'Tidak ada saran harga untuk outlet ini.', units: 'Unit/hari', margin: 'Margin/hari', apply: 'Terapkan', applied: 'Diterapkan',
    reason: (n: string, a: string, b: string) => `Saran harga ${n}: ${a} → ${b} (elastisitas simulasi)`, bundles: 'Ide paket promo', bundleCount: (n: number) => `dibeli bersama ${n}× (2 hari terakhir)`,
    make: (p: number) => `Buat promo −${p}%`, made: 'Promo aktif', promos: 'Promo berjalan', until: (d: number) => `berlaku ${d} hari`, noBundle: 'Belum ada pasangan barang yang sering dibeli bersama.',
    note: 'Elastisitas harga per kategori (simulasi): perubahan unit terjual per 1% perubahan harga.',
  },
  en: {
    title: 'Price suggestions', none: 'No price suggestions for this outlet.', units: 'Units/day', margin: 'Margin/day', apply: 'Apply', applied: 'Applied',
    reason: (n: string, a: string, b: string) => `Price suggestion ${n}: ${a} → ${b} (simulated elasticity)`, bundles: 'Bundle promo ideas', bundleCount: (n: number) => `bought together ${n}× (last 2 days)`,
    make: (p: number) => `Create −${p}% promo`, made: 'Promo running', promos: 'Running promos', until: (d: number) => `valid ${d} days`, noBundle: 'No item pairs bought together often yet.',
    note: 'Price elasticity per category (simulated): change in units sold per 1% price change.',
  },
}

export default function Pricing({ outletId }: TabProps) {
  const { lang, t: T } = useT()
  const t = S[lang]
  const sug = useWorld((s) => priceSuggestions(s, outletId))
  const prices = useWorld((s) => s.products)
  const bundles = useWorld((s) => bundleIdeas(s, outletId))
  const promos = useWorld((s) => s.promos)
  const apply = (x: PriceSuggestion) =>
    emit('price.changed', { productId: x.productId, price: x.to, prev: x.from, suggestionId: x.id, reason: { id: S.id.reason(x.name, rp(x.from), rp(x.to)), en: S.en.reason(x.name, rp(x.from), rp(x.to)) } }, SLUG)
  const live = rows(promos).filter((p) => p.productIds.some((id) => prices.byId[id]?.outletId === outletId))
  return (
    <div className="dk-ta-grid">
      <section className="dk-ta-card" aria-labelledby="dk-ta-price-h">
        <header className="dk-ta-ch">
          <h3 id="dk-ta-price-h">{t.title}</h3>
          <span className="dk-ta-sim">{T.sim}</span>
        </header>
        <p className="dk-ta-muted">{t.note}</p>
        {sug.length ? (
          <ul className="dk-ta-prices">
            {sug.map((x) => {
              const done = prices.byId[x.productId]?.price === x.to
              return (
                <li key={x.id} data-pid={x.productId} className={x.locked ? 'is-locked' : ''}>
                  <span className="dk-ta-main">
                    <b>{x.name}</b>
                    <small className="dk-num">
                      {rp(x.from)} → {rp(x.to)} · {t.units} {pct(x.unitsDelta / 100, 1, lang)} · {t.margin} {x.marginDelta >= 0 ? '+' : '−'}
                      {rp(Math.abs(x.marginDelta))}
                    </small>
                  </span>
                  {x.locked ? (
                    <span className="dk-ta-lock" data-ta="price-lock">
                      <Icon name="lock" size={16} /> {x.locked[lang]}
                    </span>
                  ) : done ? (
                    <span className="dk-ta-ok">
                      <Icon name="check" size={16} /> {t.applied}
                    </span>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => apply(x)} data-ta="price-apply">
                      {t.apply}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="dk-ta-muted">{t.none}</p>
        )}
      </section>
      <section className="dk-ta-card" aria-labelledby="dk-ta-bundle-h">
        <header className="dk-ta-ch">
          <h3 id="dk-ta-bundle-h">{t.bundles}</h3>
        </header>
        {bundles.length ? (
          <ul className="dk-ta-prices">
            {bundles.map((b) => {
              const made = rows(promos).some((p) => p.productIds.join() === b.productIds.join())
              return (
                <li key={b.productIds.join()}>
                  <span className="dk-ta-main">
                    <b>{b.title[lang]}</b>
                    <small>{t.bundleCount(b.count)}</small>
                  </span>
                  {made ? (
                    <span className="dk-ta-ok">
                      <Icon name="check" size={16} /> {t.made}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="tag"
                      data-ta="promo-make"
                      onClick={() => emit('promo.created', { title: b.title, productIds: [...b.productIds], discountPct: b.discountPct, until: (Math.floor(clock.get().minutes / DAY_MIN) + 7) * DAY_MIN }, SLUG)}
                    >
                      {t.make(b.discountPct)}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="dk-ta-muted">{t.noBundle}</p>
        )}
        {live.length > 0 && (
          <>
            <h4 className="dk-ta-h4">{t.promos}</h4>
            <ul className="dk-ta-plain">
              {live.map((p) => (
                <li key={p.id}>
                  {p.title[lang]} · −{p.discountPct}% · {t.until(Math.max(1, Math.round((p.until - clock.get().minutes) / DAY_MIN)))}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
