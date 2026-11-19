/**
 * Modal.tsx (lazy) — "Modal kerja": the working-capital simulation (simulasi, §6 P2): plafon RangeField + MoneyInput
 * (≤ loanOffer().plafon), tenor 6/12/18/24, cicilan live (`installment`), DSR, "Capai 750 untuk plafon Rp 150 jt"
 * (nextBand), purpose → "Ajukan modal" ⇒ `loan.applied` (+ consentId, ratePct, installment). Without an active
 * consent the ConsentCard comes first; a revoked consent / ineligible score / too-high amount disables the button
 * WITH the reason. Below: the LoanTimeline of the latest application, the approval card (same plafon / cicilan as the
 * bank drawer and the Pajak Beres disbursal journal) and, under 1280 px, the "Sisi Bank/Koperasi" card.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button, Icon, MoneyInput, RangeField, Segmented, Select, flashNewRow } from '../../demo-kit/ui'
import { clock, emit, useWorld, type Bi, type WorldState } from '../../demo-kit/world'
import { CONSENT_SCOPE, LOAN, installment } from '../../demo-kit/world/pasar-daerah'
import { consentState, dateOf, grant } from './consent'
import { ConsentCard, MIN_SCOPES } from './ConsentCard'
import { LoanTimeline, type TimelineStep } from './LoanTimeline'
import { DemoLink } from './DemoLink'
import { LENDER, SLUG, disbursalOf, jt, offerM, ownLoan, pctText, rateText, rp, timeText, uiStore, useUi, type Lang } from './model'
import { useT } from './strings'

const PURPOSES: Bi[] = [
  { id: 'Tambah stok bahan bangunan', en: 'More building-supply stock' },
  { id: 'Modal kerja harian', en: 'Daily working capital' },
  { id: 'Beli peralatan usaha', en: 'Business equipment' },
]

const S = {
  id: {
    simTitle: 'Simulasi modal kerja',
    sim: 'simulasi',
    plafon: 'Jumlah pinjaman',
    max: (v: string) => `Plafon Anda ${v}`,
    money: 'Jumlah (Rp)',
    tenor: 'Tenor',
    months: (n: number) => `${n} bln`,
    rate: 'Bunga flat per bulan',
    inst: 'Cicilan per bulan',
    dsr: 'Cicilan ÷ laba bersih (DSR)',
    dsrMax: 'maks 35%',
    net: (v: string) => `Laba bersih rata-rata Sep–Okt ${v}`,
    next: (min: number, v: string) => `Capai ${min} untuk plafon ${v}`,
    purpose: 'Tujuan',
    apply: 'Ajukan modal',
    to: (l: string) => `Diajukan ke ${l}`,
    rNoConsent: 'Bagikan data ke koperasi dulu (Omzet, Laporan, KYB)',
    rRevoked: 'Akses data dicabut · bagikan lagi untuk mengajukan',
    rMin: (list: string) => `Data minimal belum dibagikan: ${list}`,
    rOpen: (code: string) => `Pengajuan ${code} sedang ditinjau koperasi`,
    rHigh: (v: string) => `Melebihi plafon ${v}`,
    rLow: 'Minimal Rp 5 jt',
    rDsr: 'Cicilan melebihi 35% laba bersih: pilih tenor lebih panjang',
    consentOk: (scopes: string, until: string) => `Data dibagikan: ${scopes} · berlaku s.d. ${until}`,
    tlTitle: 'Status pengajuan',
    tl: { diajukan: 'Diajukan', ditinjau: 'Ditinjau analis', diputus: 'Diputus', dicairkan: 'Dicairkan (simulasi)' },
    rejected: 'Ditolak',
    approved: 'Disetujui',
    waiting: 'menunggu',
    noLoan: 'Belum ada pengajuan. Isi simulasi di atas lalu tekan "Ajukan modal".',
    card: 'Persetujuan modal kerja',
    cardLine: (amt: string, inst: string, n: number, r: string) => `${amt} · cicilan ${inst}/bln · ${n} bln · bunga ${r}/bln`,
    journal: 'Lihat jurnal pencairan di Pajak Beres',
    decision: 'Keputusan tetap di koperasi. Angka simulasi.',
    sent: 'Pengajuan terkirim ke koperasi.',
    granted: 'Data dibagikan ke koperasi.',
  },
  en: {
    simTitle: 'Working-capital simulation',
    sim: 'simulated',
    plafon: 'Loan amount',
    max: (v: string) => `Your limit ${v}`,
    money: 'Amount (Rp)',
    tenor: 'Tenor',
    months: (n: number) => `${n} mo`,
    rate: 'Flat rate per month',
    inst: 'Monthly instalment',
    dsr: 'Instalment ÷ net profit (DSR)',
    dsrMax: 'max 35%',
    net: (v: string) => `Average Sep–Oct net profit ${v}`,
    next: (min: number, v: string) => `Reach ${min} for a ${v} limit`,
    purpose: 'Purpose',
    apply: 'Apply for capital',
    to: (l: string) => `Sent to ${l}`,
    rNoConsent: 'Share data with the cooperative first (turnover, statements, KYB)',
    rRevoked: 'Data access revoked · share again to apply',
    rMin: (list: string) => `Minimum data not shared: ${list}`,
    rOpen: (code: string) => `Application ${code} is being reviewed`,
    rHigh: (v: string) => `Above the ${v} limit`,
    rLow: 'At least Rp 5 M',
    rDsr: 'Instalment above 35% of net profit: pick a longer tenor',
    consentOk: (scopes: string, until: string) => `Data shared: ${scopes} · valid until ${until}`,
    tlTitle: 'Application status',
    tl: { diajukan: 'Submitted', ditinjau: 'Analyst review', diputus: 'Decided', dicairkan: 'Disbursed (simulated)' },
    rejected: 'Declined',
    approved: 'Approved',
    waiting: 'waiting',
    noLoan: 'No application yet. Fill in the simulation above and press "Apply for capital".',
    card: 'Working-capital approval',
    cardLine: (amt: string, inst: string, n: number, r: string) => `${amt} · instalment ${inst}/mo · ${n} mo · rate ${r}/mo`,
    journal: 'See the disbursal journal in Pajak Beres',
    decision: 'The decision stays with the cooperative. Simulated numbers.',
    sent: 'Application sent to the cooperative.',
    granted: 'Data shared with the cooperative.',
  },
}
export type ModalStrings = (typeof S)['id']

const shopSel = (s: WorldState) => s.meta.shopId
const offerSel = (s: WorldState) => offerM(s, s.meta.shopId)
const consentSel = (s: WorldState) => consentState(s, clock.get().minutes)
const consentEq = (a: ReturnType<typeof consentSel>, b: ReturnType<typeof consentSel>) => a.active === b.active && a.revoked === b.revoked

export default function Modal({ mirror }: { goTab: (t: string) => void; mirror: ReactNode }) {
  const { lang } = useT()
  const L = S[lang]
  const shop = useWorld(shopSel)
  const offer = useWorld(offerSel)
  const cs = useWorld(consentSel, consentEq)
  const loan = useWorld(ownLoan)
  const day = useWorld((s) => s.day)
  const id = useId()
  const [amt, setAmt] = useState<number | null>(null)
  const [tenor, setTenor] = useState(12)
  const [purpose, setPurpose] = useState(0)
  const [said, setSaid] = useState('')
  const amount = amt ?? offer.plafon
  const inst = offer.installment(amount, tenor)
  const dsr = offer.netProfit > 0 ? inst / offer.netProfit : 0
  const missing = cs.active ? MIN_SCOPES.filter((k) => !cs.active!.scopes.includes(k)) : []
  const reason = !offer.eligible
    ? (offer.reason?.[lang] ?? '')
    : loan?.status === 'diajukan'
      ? L.rOpen(loan.id)
      : cs.revoked
        ? L.rRevoked
        : !cs.active
          ? L.rNoConsent
          : missing.length
            ? L.rMin(missing.map((k) => CONSENT_SCOPE[k][lang]).join(', '))
            : amount > offer.plafon
              ? L.rHigh(jt(offer.plafon, lang))
              : amount < LOAN.step
                ? L.rLow
                : dsr > LOAN.dsrMax
                  ? L.rDsr
                  : null
  const apply = () => {
    if (reason || !cs.active) return
    const p = PURPOSES[purpose]!
    emit('loan.applied', { businessId: shop, lender: LENDER, amount, tenorMonths: tenor, consentId: cs.active.id, purpose: p, ratePct: offer.ratePct, installment: inst }, SLUG)
    setSaid(L.sent)
  }
  return (
    <div className="dk-ru-modal">
      {!cs.active && (
        <ConsentCard
          lender={LENDER}
          lang={lang}
          onGrant={(sc, d) => {
            grant(sc, d, shop)
            setSaid(L.granted)
          }}
        />
      )}
      <section className="dk-ru-card dk-ru-sim-card" aria-labelledby={`${id}-h`} data-ru="apply">
        <h3 id={`${id}-h`}>
          <Icon name="coins" size={16} /> {L.simTitle} <span className="dk-ru-sim">{L.sim}</span>
        </h3>
        {cs.active && (
          <p className="dk-ru-ok" data-ru="consent-ok">
            <Icon name="shield" size={14} /> {L.consentOk(cs.active.scopes.map((k) => CONSENT_SCOPE[k][lang]).join(', '), dateOf(day, cs.active.until, lang))}
          </p>
        )}
        <div className="dk-ru-simgrid">
          <div className="dk-ru-simin">
            <RangeField
              label={{ id: S.id.plafon, en: S.en.plafon }}
              min={offer.plafon > 0 ? LOAN.step : 0}
              max={Math.max(offer.plafon, LOAN.step)}
              step={LOAN.step}
              value={Math.min(Math.max(amount, LOAN.step), Math.max(offer.plafon, LOAN.step))}
              onChange={(v) => setAmt(v)}
              format={(v, lg) => jt(v, lg === 'en' ? 'en' : 'id')}
              disabled={!offer.eligible}
              hook="ru-plafon"
            />
            <p className="dk-ru-fine" data-ru="plafon">
              {L.max(jt(offer.plafon, lang))} · {L.net(jt(offer.netProfit, lang))} · {L.sim}
            </p>
            {offer.nextBand && offer.nextBand.plafon > offer.plafon && (
              <p className="dk-ru-hint" data-ru="next-band">
                <Icon name="trendUp" size={14} /> {L.next(offer.nextBand.min, jt(offer.nextBand.plafon, lang))}
              </p>
            )}
            <label className="dk-ru-field">
              <span>{L.money}</span>
              <MoneyInput value={amount} onChange={(v) => setAmt(v ?? 0)} aria-label={L.money} data-ru="amount" />
            </label>
            <div className="dk-ru-field">
              <span>{L.tenor}</span>
              <Segmented size="sm" label={L.tenor} value={String(tenor)} onChange={(v) => setTenor(Number(v))} options={offer.tenors.map((n) => ({ value: String(n), label: L.months(n) }))} />
            </div>
            <label className="dk-ru-field">
              <span>{L.purpose}</span>
              <Select value={String(purpose)} onChange={(e) => setPurpose(Number(e.target.value))} options={PURPOSES.map((p, i) => ({ value: String(i), label: p[lang] }))} aria-label={L.purpose} />
            </label>
          </div>
          <dl className="dk-ru-simout" aria-live="polite">
            <div>
              <dt>{L.inst}</dt>
              <dd className="dk-num dk-ru-big" data-ru="installment">
                {rp(inst, lang)}
              </dd>
            </div>
            <div>
              <dt>{L.rate}</dt>
              <dd className="dk-num" data-ru="rate">
                {rateText(offer.ratePct, lang)}
              </dd>
            </div>
            <div>
              <dt>
                {L.dsr} <small>({L.dsrMax})</small>
              </dt>
              <dd className={`dk-num${dsr > LOAN.dsrMax ? ' is-down' : ''}`} data-ru="dsr">
                {pctText(dsr, lang, 1)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="dk-ru-row">
          <Button variant="primary" icon="send" disabled={!!reason} onClick={apply} aria-describedby={reason ? `${id}-r` : undefined} data-ru="apply-btn">
            {L.apply}
          </Button>
          {reason ? (
            <span id={`${id}-r`} className="dk-ru-reason" data-ru="apply-reason">
              {reason}
            </span>
          ) : (
            <span className="dk-ru-muted">{L.to(LENDER)}</span>
          )}
        </div>
        <p className="dk-sr-only" aria-live="polite">
          {said}
        </p>
      </section>
      <Status L={L} lang={lang} />
      {mirror}
    </div>
  )
}

function Status({ L, lang }: { L: ModalStrings; lang: Lang }) {
  const loan = useWorld(ownLoan)
  const jr = useWorld((s) => (loan ? disbursalOf(s, loan.id) : null))
  const flash = useUi((u) => u.flash)
  const box = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!flash || !loan || flash !== loan.id || !box.current) return
    box.current.scrollIntoView({ block: 'nearest' })
    flashNewRow(box.current)
    uiStore.set({ flash: null })
  }, [flash, loan])
  const prevStatus = useRef(loan?.status)
  useEffect(() => {
    if (loan && prevStatus.current && prevStatus.current !== loan.status && box.current) flashNewRow(box.current)
    prevStatus.current = loan?.status
  }, [loan])
  if (!loan) {
    return (
      <section className="dk-ru-card" aria-label={L.tlTitle}>
        <h3>{L.tlTitle}</h3>
        <p className="dk-ru-muted">{L.noLoan}</p>
      </section>
    )
  }
  const decided = loan.status !== 'diajukan'
  const ok = loan.status === 'disetujui'
  const amount = loan.decidedAmount ?? loan.amount
  const rate = loan.ratePct ?? 0
  const inst = ok ? (loan.decidedAmount && loan.decidedAmount !== loan.amount ? installment(amount, rate, loan.tenorMonths) : (loan.installment ?? installment(amount, rate, loan.tenorMonths))) : 0
  const steps: TimelineStep[] = [
    { key: 'diajukan', label: L.tl.diajukan, state: 'done', when: timeText(loan.at, lang), detail: `${loan.id} · ${jt(loan.amount, lang)} · ${L.months(loan.tenorMonths)}` },
    { key: 'ditinjau', label: L.tl.ditinjau, state: decided ? 'done' : 'now', ...(decided ? {} : { detail: L.waiting }) },
    { key: 'diputus', label: decided ? (ok ? L.approved : L.rejected) : L.tl.diputus, state: decided ? (ok ? 'done' : 'fail') : 'wait', ...(decided ? { when: timeText(loan.decidedAt ?? loan.at, lang) } : {}), ...(loan.status === 'ditolak' && loan.reason ? { detail: loan.reason[lang] } : {}) },
    { key: 'dicairkan', label: L.tl.dicairkan, state: jr ? 'done' : 'wait', ...(jr ? { when: timeText(jr.at, lang) } : {}) },
  ]
  return (
    <section className="dk-ru-card" aria-labelledby="dk-ru-tl-h" ref={box} data-ru="timeline" data-loan={loan.id} data-status={loan.status}>
      <h3 id="dk-ru-tl-h">{L.tlTitle}</h3>
      <LoanTimeline steps={steps} label={L.tlTitle} />
      {ok && (
        <div className="dk-ru-approved" data-ru="approval-card">
          <strong>
            <Icon name="stamp" size={16} /> {L.card}
          </strong>
          <span className="dk-num" data-ru="approval-line" data-amount={amount} data-installment={inst}>
            {L.cardLine(rp(amount, lang), rp(inst, lang), loan.tenorMonths, rateText(rate, lang))}
          </span>
          {jr && (
            <DemoLink slug="pajak-beres" href={`/demo/pajak-beres?tab=jurnal&focus=${jr.id}`} className="dk-ru-actlink">
              {L.journal} <Icon name="arrowUpRight" size={14} />
            </DemoLink>
          )}
        </div>
      )}
      <p className="dk-ru-fine">{L.decision}</p>
    </section>
  )
}
