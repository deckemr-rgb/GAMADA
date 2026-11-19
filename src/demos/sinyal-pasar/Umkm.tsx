/**
 * Umkm — the Pemilik Toko side (lazy; needs the Usaha Pintar data): "Sinyal Pasar untuk UMKM" in a PhoneFrame (no frame
 * chrome below 640 px) with Peringatan (`alertsFor`: C32 early alerts + anomalies of subscribed commodities, WA style;
 * "Siapkan PO di Toko Autopilot" ⇒ `po.drafted` via `umkmPoPayload`, or the existing draft's link; "Buka prediksi
 * stok" ⇒ Toko Autopilot) and Langganan (`price.subscribed`); side panel "Bahan yang Anda pakai" (shop `cm:` SKUs,
 * onHand, `demandForecast().daysLeft`). No operation controls, no other business names.
 */
import { useEffect, useMemo, useState } from 'react'
import AppLink from '../../components/AppLink'
import { DEMO_READY } from '../registry'
import { demoHref, useShell } from '../../demo-kit/shell'
import { PhoneFrame } from '../../demo-kit/frames'
import { Button, Segmented, flashNewRow, motionMode } from '../../demo-kit/ui'
import { emit, formatTime, hhmm, rows, useClock, useSession, useWorld, world, type PriceSub, type WorldState } from '../../demo-kit/world'
import { useWorldReady, type WorldModule } from '../../demo-kit/world/ready'
import { alertsFor, demandForecast, priceSubsOf, umkmPoPayload, type UmkmAlert } from '../../demo-kit/world/pasar-daerah'
import { SpSkeleton } from './Skel'
import { floodOf, playFlood, useAutoplay, useFloodAutoplay } from './live'
import { cName, latestTick, mName } from './model'
import { pct, tm, type Lang } from './strings'
import { useUi } from './store'

const MODS: readonly WorldModule[] = ['usaha-pintar/data', 'pasar-daerah']
const keep = () => (new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : '')
const S = {
  id: {
    loading: 'Menyiapkan data usaha…',
    title: 'Sinyal Pasar untuk UMKM',
    phone: 'Simulasi layar HP pemilik toko',
    tabs: { peringatan: 'Peringatan', langganan: 'Langganan' },
    tabsLabel: 'Bagian aplikasi',
    inbox: 'Pesan peringatan harga',
    empty: 'Belum ada peringatan. Peringatan dini datang sebelum harga melonjak, misalnya saat banjir.',
    play: 'Putar skenario banjir (dari Siaga Wilayah)',
    early: 'Peringatan dini',
    anomaly: 'Harga sudah naik',
    meta: (p: string, d: number | null, m: string, t: string) => (d != null ? `Puncak ${p} dalam ${d} hari · ${m} · ${t} · simulasi` : `${p} di atas pola · ${m} · ${t} · simulasi`),
    po: 'Siapkan PO di Toko Autopilot',
    poMade: (q: string, item: string) => `Draf PO dibuat: ${q} ${item}. Setujui di Toko Autopilot.`,
    poHas: 'Draf PO sudah ada · Buka di Toko Autopilot',
    noSku: 'Bahan ini tidak ada di stok toko Anda.',
    forecast: 'Buka prediksi stok',
    side: 'Bahan yang Anda pakai',
    sideLead: 'Stok bahan di outlet makanan usaha Anda, per outlet (Toko Autopilot, simulasi). Toko bangunan tidak memakai komoditas ini.',
    left: (q: string, u: string) => `stok ${q} ${u}`,
    days: (d: string) => `cukup ±${d} hari`,
    subTitle: 'Langganan peringatan',
    subLead: 'Pilih bahan yang Anda pakai, ambang kenaikan, dan saluran pesan.',
    items: 'Bahan',
    threshold: 'Kirim bila puncak naik ≥',
    channel: 'Saluran',
    wa: 'WhatsApp',
    app: 'Aplikasi',
    save: 'Simpan',
    needOne: 'Pilih minimal satu bahan.',
    saved: (t: string) => `Tersimpan pukul ${t}.`,
    ethics: 'Belanja secukupnya, jangan menimbun. Harga dan prakiraan simulasi.',
  },
  en: {
    loading: 'Preparing the business data…',
    title: 'Sinyal Pasar for UMKM',
    phone: 'Simulated shop owner’s phone',
    tabs: { peringatan: 'Alerts', langganan: 'Subscription' },
    tabsLabel: 'App sections',
    inbox: 'Price alert messages',
    empty: 'No alert yet. Early warnings arrive before prices jump, e.g. during a flood.',
    play: 'Play the flood scenario (from Siaga Wilayah)',
    early: 'Early warning',
    anomaly: 'Price already up',
    meta: (p: string, d: number | null, m: string, t: string) => (d != null ? `Peak ${p} within ${d} days · ${m} · ${t} · simulated` : `${p} above pattern · ${m} · ${t} · simulated`),
    po: 'Prepare a PO in Toko Autopilot',
    poMade: (q: string, item: string) => `PO draft created: ${q} ${item}. Approve it in Toko Autopilot.`,
    poHas: 'A PO draft exists · Open in Toko Autopilot',
    noSku: 'This ingredient is not in your shop’s stock.',
    forecast: 'Open the stock forecast',
    side: 'Ingredients you use',
    sideLead: 'Ingredient stock of your business’s food outlets, per outlet (Toko Autopilot, simulated). The building-supply shop does not use these commodities.',
    left: (q: string, u: string) => `${q} ${u} in stock`,
    days: (d: string) => `lasts about ${d} days`,
    subTitle: 'Alert subscription',
    subLead: 'Pick the ingredients you use, the rise threshold and the channel.',
    items: 'Ingredients',
    threshold: 'Send when the peak rises ≥',
    channel: 'Channel',
    wa: 'WhatsApp',
    app: 'App',
    save: 'Save',
    needOne: 'Pick at least one ingredient.',
    saved: (t: string) => `Saved at ${t}.`,
    ethics: 'Buy what you need, do not hoard. Prices and forecasts are simulated.',
  },
}
type T = (typeof S)['id']
type Session = { regionId: string; seed: number; lang: Lang; present: boolean }

export default function Umkm() {
  const ready = useWorldReady(MODS)
  const { lang, regionId, seed, present } = useSession()
  const L = lang as Lang
  const t = S[L]
  const shell = useShell()
  const u = useUi()
  const c = useClock()
  const [tab, setTab] = useState<'peringatan' | 'langganan'>('peringatan')
  useAutoplay(shell.present)
  useFloodAutoplay()
  useEffect(() => {
    if (u.alert) setTab('peringatan')
  }, [u.alert, u.n])
  if (!ready) return <SpSkeleton umkm msg={t.loading} />
  const session: Session = { regionId, seed, lang: L, present }
  const screen = (
    <div className="dk-sp-app">
      <header className="dk-sp-app-h">
        <strong>{t.title}</strong>
        <ShopName />
        <LatestTick L={L} />
      </header>
      <Segmented size="sm" label={t.tabsLabel} value={tab} onChange={setTab} options={[{ value: 'peringatan', label: t.tabs.peringatan }, { value: 'langganan', label: t.tabs.langganan }]} />
      {tab === 'peringatan' ? <Inbox t={t} L={L} session={session} now={c.minutes} /> : <Subscribe t={t} L={L} now={c.minutes} />}
    </div>
  )
  return (
    <div className="dk-sp-umkm">
      <div className="dk-sp-umkm-grid">
        {shell.size === 'sm' ? <section aria-label={t.phone} className="dk-sp-bare">{screen}</section> : <PhoneFrame label={t.phone} time={formatTime(c.minutes)} width={340} tilt={false}>{screen}</PhoneFrame>}
        <Ingredients t={t} L={L} now={c.minutes} />
      </div>
    </div>
  )
}

function ShopName() {
  const name = useWorld((s) => s.businesses.byId[s.meta.shopId ?? '']?.name ?? '')
  return <span className="dk-sp-muted">{name}</span>
}

function Inbox({ t, L, session, now }: { t: T; L: Lang; session: Session; now: number }) {
  const shop = useWorld((s) => s.meta.shopId ?? '')
  const list = useWorld((s) => alertsFor(s, shop, now), (a, b) => a.length === b.length && a.every((x, i) => x.id === b[i]!.id))
  const u = useUi()
  const flood = useWorld((s) => !!floodOf(s))
  const [busy, setBusy] = useState(false)
  // ?focus=PA-… / role switch with an open alert: scroll to it and flash it
  useEffect(() => {
    if (!u.alert) return
    const el = document.querySelector<HTMLElement>(`[data-alert="${CSS.escape(u.alert)}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
    flashNewRow(el, { slide: false })
  }, [u.alert, u.n, list.length])
  const ordered = useMemo(() => [...list].reverse(), [list])
  return (
    <div className="dk-sp-inbox" data-tour="sp-umkm-alert">
      {ordered.length ? (
        <ol className="dk-sp-thread" role="log" aria-live="polite" aria-label={t.inbox}>
          {ordered.map((a) => (
            <AlertBubble key={a.id} a={a} t={t} L={L} shop={shop} session={session} active={a.id === u.alert} />
          ))}
        </ol>
      ) : (
        <div className="dk-sp-empty">
          <p className="dk-sp-muted">{t.empty}</p>
          {!flood && (
            <Button size="sm" variant="primary" icon="play" busy={busy} data-sp="play-flood" onClick={() => {
              setBusy(true)
              void playFlood().finally(() => setBusy(false))
            }}>
              {t.play}
            </Button>
          )}
        </div>
      )}
      <p className="dk-sp-note">{t.ethics}</p>
    </div>
  )
}

/** the shop's open draft PO holding the commodity's `cm:` SKU (Toko Autopilot PO tab shows the same row) */
const draftOf = (s: WorldState, shop: string, sku: string | null) =>
  sku ? rows(s.purchaseOrders).find((po) => po.businessId === shop && po.status === 'draf' && po.items.some((i) => i.productId === sku)) ?? null : null
const skuOf = (s: WorldState, shop: string, commodityId: string) => rows(s.products).find((p) => p.businessId === shop && p.tags.includes(`cm:${commodityId}`))?.id ?? null

function AlertBubble({ a, t, L, shop, session, active }: { a: UmkmAlert; t: T; L: Lang; shop: string; session: Session; active: boolean }) {
  const shell = useShell()
  const sku = useWorld((s) => skuOf(s, shop, a.commodityId))
  const draft = useWorld((s) => draftOf(s, shop, sku))
  const product = useWorld((s) => (sku ? s.products.byId[sku] : undefined))
  const warningId = useWorld((s) => a.warningId ?? rows(s.priceWarnings).filter((w) => w.commodityId === a.commodityId).sort((x, y) => y.at - x.at)[0]?.id ?? null)
  const market = useWorld((s) => mName(s, a.marketId))
  const [made, setMade] = useState(false)
  const ready = DEMO_READY['toko-autopilot']
  const prepare = () => {
    const s = world.get()
    if (!warningId) return
    const p = umkmPoPayload(s, shop, warningId)
    if (!p) return
    emit('po.drafted', p, 'sinyal-pasar')
    setMade(true)
  }
  return (
    <li className={`dk-sp-bubble is-${a.kind}${active ? ' is-active' : ''}`} data-alert={a.id}>
      <span className="dk-sp-bubble-k">{a.kind === 'peringatan' ? t.early : t.anomaly}</span>
      <p>{a.text[L]}</p>
      <p className="dk-sp-advice">{a.advice[L]}</p>
      <p className="dk-sp-muted dk-num">{t.meta(pct(a.pct, L), a.peakInDays, market, tm(hhmm(a.at), L))}</p>
      <div className="dk-sp-bubble-act">
        {!sku ? (
          <span className="dk-sp-muted">{t.noSku}</span>
        ) : draft ? (
          <>
            {made && <span className="dk-sp-strong" role="status">{t.poMade(String(draft.items.find((i) => i.productId === sku)?.qty ?? ''), product?.unit ?? '')}</span>}
            {ready ? (
              <AppLink className="dk-sp-link" data-sp="po-open" to={demoHref('toko-autopilot', session, draft.id) + '&tab=po' + keep()} onClick={() => shell.markMission('umkm')}>
                {t.poHas}
              </AppLink>
            ) : null}
          </>
        ) : (
          <Button size="sm" variant="primary" icon="package" onClick={prepare} disabled={!warningId || made} busy={made} data-sp="prepare-po">
            {t.po}
          </Button>
        )}
        {sku && ready && (
          <AppLink className="dk-sp-link" data-sp="forecast-open" to={demoHref('toko-autopilot', session, sku) + '&tab=prediksi&outlet=warung' + keep()}>
            {t.forecast}
          </AppLink>
        )}
      </div>
    </li>
  )
}

function Subscribe({ t, L, now }: { t: T; L: Lang; now: number }) {
  const shop = useWorld((s) => s.meta.shopId ?? '')
  const sub = useWorld((s) => priceSubsOf(s, shop))
  const commodities = useWorld((s) => s.region.commodities)
  const [ids, setIds] = useState<string[]>(() => sub?.commodityIds ?? [])
  const [thr, setThr] = useState<'5' | '10' | '15'>(() => String(sub?.thresholdPct ?? 10) as '5' | '10' | '15')
  const [ch, setCh] = useState<PriceSub['channel']>(() => sub?.channel ?? 'wa')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const save = () => {
    if (!ids.length) return
    emit('price.subscribed', { ...(sub ? { id: sub.id } : {}), businessId: shop, commodityIds: ids, channel: ch, thresholdPct: Number(thr) as PriceSub['thresholdPct'] }, 'sinyal-pasar')
    setSavedAt(now)
  }
  return (
    <form className="dk-sp-subform" onSubmit={(e) => {
      e.preventDefault()
      save()
    }}>
      <h3>{t.subTitle}</h3>
      <p className="dk-sp-muted">{t.subLead}</p>
      <fieldset className="dk-sp-markets">
        <legend>{t.items}</legend>
        {commodities.map((c) => (
          <label key={c.id} className="dk-sp-check">
            <input type="checkbox" checked={ids.includes(c.id)} onChange={(e) => setIds((x) => (e.target.checked ? [...x, c.id] : x.filter((y) => y !== c.id)))} />
            <span>{c.name[L]}</span>
          </label>
        ))}
      </fieldset>
      <div className="dk-sp-field">
        <span className="dk-sp-label">{t.threshold}</span>
        <Segmented size="sm" label={t.threshold} value={thr} onChange={setThr} options={(['5', '10', '15'] as const).map((v) => ({ value: v, label: `${v}%` }))} />
      </div>
      <div className="dk-sp-field">
        <span className="dk-sp-label">{t.channel}</span>
        <Segmented size="sm" label={t.channel} value={ch} onChange={setCh} options={[{ value: 'wa', label: t.wa }, { value: 'aplikasi', label: t.app }]} />
      </div>
      <div className="dk-sp-actbtns">
        <Button type="submit" variant="primary" icon="check" disabled={!ids.length} data-sp="save-sub">
          {t.save}
        </Button>
        {!ids.length && <span className="dk-sp-muted">{t.needOne}</span>}
        {savedAt != null && <span className="dk-sp-strong" role="status">{t.saved(tm(hhmm(savedAt), L))}</span>}
      </div>
    </form>
  )
}

function Ingredients({ t, L, now }: { t: T; L: Lang; now: number }) {
  const shop = useWorld((s) => s.meta.shopId ?? '')
  const list = useWorld(
    (s) =>
      rows(s.products)
        .filter((p) => p.businessId === shop && p.tags.some((x) => x.startsWith('cm:')))
        .map((p) => ({ id: p.id, outlet: s.outlets.byId[p.outletId]?.name ?? '', name: p.name, unit: p.unit, onHand: s.stock.byId[p.id]?.onHand ?? 0, daysLeft: demandForecast(s, p.id, now)?.daysLeft ?? null }))
        .sort((a, b) => a.outlet.localeCompare(b.outlet)),
    (a, b) => a.length === b.length && a.every((x, i) => x.id === b[i]!.id && x.onHand === b[i]!.onHand && x.daysLeft === b[i]!.daysLeft),
  )
  const n = (v: number, d = 0) => v.toLocaleString(L === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: d })
  return (
    <aside className="dk-sp-ingr" aria-label={t.side}>
      <h3>{t.side}</h3>
      <p className="dk-sp-muted">{t.sideLead}</p>
      {[...new Set(list.map((x) => x.outlet))].map((o) => (
        <div key={o} data-sp="ingr-outlet">
          <h4 className="dk-sp-muted">{o}</h4>
          <ul>
            {list.filter((x) => x.outlet === o).map((x) => (
              <li key={x.id} data-sku={x.id}>
                <strong>{x.name}</strong>
                <span className="dk-num">{t.left(n(x.onHand, 1), x.unit)}</span>
                {x.daysLeft != null && <span className="dk-sp-muted dk-num">{t.days(n(x.daysLeft, 1))}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <CommodityNote L={L} />
    </aside>
  )
}

/** the market keeps moving on this side too: the latest simulated tick (07.01 at the central market, then every minute) */
function LatestTick({ L }: { L: Lang }) {
  const p = useWorld(latestTick)
  const text = useWorld((s) => (p ? `${tm(hhmm(p.updatedAt), L)} · ${cName(s, p.commodityId)[L]} · ${mName(s, p.marketId)} Rp ${p.price.toLocaleString('id-ID')}` : ''))
  if (!text) return null
  return (
    <p className="dk-sp-latest" data-sp="latest">
      <span className="dk-sp-latest-dot" aria-hidden="true" />
      <span className="dk-sp-latest-k">{L === 'id' ? 'Harga pasar terbaru (simulasi)' : 'Latest market price (simulated)'}</span> {text}
    </p>
  )
}

function CommodityNote({ L }: { L: Lang }) {
  const u = useUi()
  const name = useWorld((s) => (u.commodity ? cName(s, u.commodity)[L] : ''))
  if (!name) return null
  return <p className="dk-sp-muted">{L === 'id' ? `Filter dari Disperindag: ${name}` : `Filter from the Trade Office: ${name}`}</p>
}
