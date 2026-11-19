/**
 * Compare drawer (lazy, preloaded on the "Bandingkan" intent): ≤ 3 offers side by side (unit prices, total, km,
 * available, lead days, badges, ScoreDial), `splitSuggestion` "Pakai usulan bagi pesanan", then "Pilih <UMKM>" →
 * Ringkas → Pagu (MoneyInput, ≥ total) → Kirim ⇒ order.created (orderPayload; source katalog-lokal).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShell } from '../../demo-kit/shell'
import { BizBadges, Button, Drawer, MoneyInput, Stepper } from '../../demo-kit/ui'
import { ScoreDial } from '../../demo-kit/viz'
import { emit, useWorld, type EventMap, type WorldState } from '../../demo-kit/world'
import { SCORE_BANDS, catalogShortlist, listingOf, needView, orderPayload, splitSuggestion } from '../../demo-kit/world/pasar-daerah'
import { useI18n } from '../../lib/i18n'
import { SLUG, bizName, nf, rp } from './model'

const C = {
  id: {
    title: 'Bandingkan penawaran',
    eyebrow: (code: string) => `Kebutuhan ${code}`,
    match: 'Kecocokan',
    km: 'Jarak',
    lines: 'Harga satuan',
    avail: 'Tersedia',
    lead: 'Perkiraan kirim',
    days: (n: number) => `${n} hari`,
    total: 'Total',
    sim: 'simulasi',
    score: 'Skor Usaha',
    pick: (n: string) => `Pilih ${n}`,
    short: 'stok kurang dari permintaan',
    split: 'Usulan bagi pesanan',
    splitBtn: 'Pakai usulan bagi pesanan',
    steps: ['Ringkas', 'Pagu', 'Kirim'],
    stepsLabel: 'Langkah pesanan',
    change: 'Ubah pilihan',
    next: 'Lanjut',
    back: 'Kembali',
    pagu: 'Pagu anggaran (simulasi)',
    paguHint: (h: string) => `Acuan: ${h}`,
    paguLow: (t: string) => `Pagu harus ≥ total pesanan ${t}.`,
    send: 'Kirim pesanan',
    sending: 'Mengirim…',
    decide: 'Keputusan tetap pada pejabat pengadaan. Katalog Lokal melengkapi katalog elektronik nasional, tidak menggantikannya. Harga simulasi.',
    to: 'ke',
  },
  en: {
    title: 'Compare the offers',
    eyebrow: (code: string) => `Need ${code}`,
    match: 'Match',
    km: 'Distance',
    lines: 'Unit price',
    avail: 'Available',
    lead: 'Estimated delivery',
    days: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
    total: 'Total',
    sim: 'simulated',
    score: 'Business Score',
    pick: (n: string) => `Pick ${n}`,
    short: 'stock below the request',
    split: 'Split suggestion',
    splitBtn: 'Use the split suggestion',
    steps: ['Summary', 'Budget', 'Send'],
    stepsLabel: 'Order steps',
    change: 'Change the pick',
    next: 'Next',
    back: 'Back',
    pagu: 'Budget ceiling (simulated)',
    paguHint: (h: string) => `Reference: ${h}`,
    paguLow: (t: string) => `The budget must be ≥ the order total ${t}.`,
    send: 'Send the order',
    sending: 'Sending…',
    decide: 'The procurement official decides. Katalog Lokal complements the national e-catalogue, never replaces it. Simulated prices.',
    to: 'to',
  },
}
const whole = (s: WorldState) => s
type Plan = EventMap['order.created'][]

export default function Compare({ needId, picks, onClose, onOrdered }: { needId: string; picks: readonly string[]; onClose: () => void; onOrdered: (ids: string[], bizId: string) => void }) {
  const { lang } = useI18n()
  const L = C[lang]
  const shell = useShell()
  const s = useWorld(whole)
  const v = needView(s, needId)
  const top = catalogShortlist(s, needId).top
  const cards = picks.map((id) => top.find((c) => c.business.id === id)).filter((c): c is NonNullable<typeof c> => !!c)
  const split = splitSuggestion(s, needId)
  const [choice, setChoice] = useState<'split' | string | null>(null)
  const [step, setStep] = useState(0)
  const [pagu, setPagu] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const sent = useRef(false)
  const { markMission } = shell
  const two = cards.length >= 2
  useEffect(() => {
    if (two) markMission('banding')
  }, [two, markMission])

  const plan: Plan = useMemo(() => {
    if (!choice) return []
    if (choice !== 'split') {
      const p = orderPayload(s, needId, choice)
      return p ? [p] : []
    }
    const [a, b] = split
    if (!a || !b) return []
    const pa = orderPayload(s, needId, a.bizId)
    const pb = orderPayload(s, needId, b.bizId)
    if (!pa || !pb) return []
    return [
      { ...pa, items: pa.items.map((i) => (i.category === a.category ? { ...i, qty: a.qty } : i)).filter((i) => i.qty > 0) },
      { ...pb, items: pb.items.filter((i) => i.category === b.category).map((i) => ({ ...i, qty: b.qty })) },
    ]
  }, [choice, s, needId, split])
  const total = plan.reduce((a, p) => a + p.items.reduce((x, i) => x + i.qty * i.price, 0), 0)
  const ref0 = v?.need.budget ?? v?.hps ?? null
  useEffect(() => {
    if (choice) setPagu(ref0 ?? Math.ceil(total / 1e6) * 1e6)
  }, [choice]) // eslint-disable-line react-hooks/exhaustive-deps
  const low = pagu === null || pagu < total

  const send = () => {
    if (sent.current || low || !plan.length) return
    sent.current = true
    setBusy(true)
    const ids = plan.map((p) => emit('order.created', p, SLUG).payload.id).filter((x): x is string => !!x)
    onOrdered(ids, plan[0]!.businessId)
  }
  if (!v) return null
  const lead = (bizId: string, cats: string[]) => Math.max(1, ...cats.map((c) => listingOf(s, bizId, c).leadDays))

  return (
    <Drawer open onClose={onClose} title={L.title} eyebrow={L.eyebrow(v.need.code)} width={760} className="dk-kl-cmp-ov">
      <div className="dk-kl-cmp" data-kl="compare-drawer" data-n={cards.length}>
        {!choice ? (
          <>
            <div className="dk-kl-cmp-cols">
              {cards.map((c) => {
                const short = c.offer.lines.some((l) => l.qtyAvailable < l.qty)
                return (
                  <section key={c.business.id} className="dk-kl-cmp-col" data-kl-offer={c.business.id}>
                    <header>
                      <h3>{c.business.name}</h3>
                      <ScoreDial value={c.badges.score ?? 0} bands={SCORE_BANDS} label={{ id: C.id.score, en: C.en.score }} size="sm" />
                    </header>
                    <BizBadges badges={c.badges} bizId={c.business.id} />
                    <dl>
                      <div>
                        <dt>{L.match}</dt>
                        <dd className="dk-num">{Math.round(c.score * 100)}%</dd>
                      </div>
                      <div>
                        <dt>{L.km}</dt>
                        <dd className="dk-num">{nf(lang, c.km, 1)} km</dd>
                      </div>
                      {c.offer.lines.map((l) => (
                        <div key={l.category}>
                          <dt>
                            {L.lines} · {l.name[lang]}
                          </dt>
                          <dd className="dk-num">
                            {rp(l.unitPrice)} × {nf(lang, l.qty)}
                          </dd>
                        </div>
                      ))}
                      <div>
                        <dt>{L.avail}</dt>
                        <dd className={`dk-num${short ? ' is-short' : ''}`}>
                          {c.offer.lines.map((l) => `${nf(lang, l.qtyAvailable)} ${l.unit}`).join(' · ')}
                          {short && <small> ({L.short})</small>}
                        </dd>
                      </div>
                      <div>
                        <dt>{L.lead}</dt>
                        <dd>{L.days(lead(c.business.id, c.offer.lines.map((l) => l.category)))}</dd>
                      </div>
                      <div>
                        <dt>{L.total}</dt>
                        <dd className="dk-num" data-kl="cmp-total">
                          <b>{rp(c.offer.total)}</b> <span className="dk-kl-sim">{L.sim}</span>
                        </dd>
                      </div>
                    </dl>
                    <Button variant="primary" onClick={() => setChoice(c.business.id)} data-kl="choose">
                      {L.pick(c.business.name)}
                    </Button>
                  </section>
                )
              })}
            </div>
            {split.length === 2 && (
              <div className="dk-kl-split" data-kl="split">
                <b>{L.split}</b>
                <span>{split.map((x) => `${bizName(s, x.bizId)} ${nf(lang, x.qty)}`).join(' + ')}</span>
                <Button size="sm" variant="secondary" onClick={() => setChoice('split')}>
                  {L.splitBtn}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="dk-kl-order" data-kl="order-steps" data-step={step}>
            <Stepper steps={L.steps} current={step} label={L.stepsLabel} />
            {step === 0 && (
              <ul className="dk-kl-sum">
                {plan.map((p) => (
                  <li key={p.businessId}>
                    <b>{bizName(s, p.businessId)}</b>
                    {p.items.map((i) => (
                      <span key={i.category} className="dk-num">
                        {i.name[lang]} · {nf(lang, i.qty)} {i.unit} × {rp(i.price)} = {rp(i.qty * i.price)}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            {step === 1 && (
              <label className="dk-kl-pagu">
                <span>{L.pagu}</span>
                <MoneyInput value={pagu} onChange={setPagu} aria-describedby="kl-pagu-why" data-kl="pagu" />
                {ref0 !== null && <span className="dk-kl-muted">{L.paguHint(rp(ref0))}</span>}
              </label>
            )}
            {step === 2 && <p className="dk-kl-muted">{L.decide}</p>}
            <p className="dk-kl-total">
              {L.total} <b className="dk-num" data-kl="plan-total">{rp(total)}</b> <span className="dk-kl-sim">{L.sim}</span>
            </p>
            {low && step >= 1 && (
              <p id="kl-pagu-why" className="dk-kl-why">
                {L.paguLow(rp(total))}
              </p>
            )}
            <div className="dk-kl-compose-act">
              <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : setChoice(null))}>
                {step ? L.back : L.change}
              </Button>
              {step < 2 ? (
                <Button variant="primary" onClick={() => setStep(step + 1)} disabled={step === 1 && low} aria-describedby={step === 1 && low ? 'kl-pagu-why' : undefined} data-kl="next">
                  {L.next}
                </Button>
              ) : (
                <Button variant="primary" onClick={send} disabled={low || busy} busy={busy} aria-describedby={low ? 'kl-pagu-why' : undefined} data-kl="order">
                  {busy ? L.sending : L.send}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
