/**
 * BankDrawer.tsx (lazy) — one application as the cooperative's analyst sees it: the request (amount, tenor, rate,
 * cicilan = the owner's simulation), the score now vs at application, the recommendation (`loanAdvice`, 3 reasons),
 * ONLY the consented scopes' data (others "Tidak dibagikan pemilik"), and the decision: "Setujui" (MoneyInput ≤
 * requested) ⇒ `loan.approved` + the approval stamp flying to the owner mirror · "Tolak" (3 reasons) ⇒
 * `loan.rejected` · "Minta verifikasi KYB" (unverified only) ⇒ `verification.requested`. "Ringkas pengajuan" opens
 * the AI brief (lazy).
 */
import { Suspense, lazy, useRef, useState } from 'react'
import { BizBadges, Button, Drawer, Icon, MoneyInput, Select, StatusChip, flyBetween } from '../../demo-kit/ui'
import { emit, useWorld, type Bi, type ConsentScope, type WorldState } from '../../demo-kit/world'
import { CONSENT_SCOPE, LOAN_STATUS, SCORE_BANDS, bandOf, badgesOf, installment, loanAdvice, loanOffer, netProfitAvg, omzetByMonth } from '../../demo-kit/world/pasar-daerah'
import { SCOPES } from './ConsentCard'
import { REC } from './Bank'
import { LENDER, SLUG, jt, monthShort, pctText, rateText, rp, timeText, uiStore } from './model'
import { useT } from './strings'

const loadBrief = () => import('./Brief')
const Brief = lazy(loadBrief)

const REASONS: Bi[] = [
  { id: 'Arus kas belum cukup untuk cicilan', en: 'Cash flow too thin for the instalment' },
  { id: 'Dokumen usaha belum lengkap (KYB)', en: 'Business documents incomplete (KYB)' },
  { id: 'Plafon melebihi kebijakan koperasi saat ini', en: 'Amount above the cooperative’s current policy' },
]

const S = {
  id: {
    eyebrow: (l: string) => `${l} · pengajuan modal kerja · simulasi`,
    req: 'Pengajuan',
    amount: 'Jumlah',
    tenor: 'Tenor',
    months: (n: number) => `${n} bulan`,
    rate: 'Bunga flat',
    inst: 'Cicilan per bulan',
    purpose: 'Tujuan',
    score: 'Skor sekarang',
    then: (n: number) => `saat diajukan ${n}`,
    data: 'Data yang dibagikan pemilik',
    notShared: 'Tidak dibagikan pemilik',
    revoked: 'Akses dicabut pemilik',
    noConsent: 'Tidak ada persetujuan berbagi data untuk pengajuan ini.',
    omzet: (list: string) => `Omzet: ${list}`,
    omzetAvg: (v: string) => `Omzet rata-rata 3 bulan ${v}`,
    laporan: (v: string) => `Laba bersih rata-rata Sep–Okt ${v}`,
    pajakOk: 'Pajak rapi di Pajak Beres',
    pajakNo: 'Pajak belum rapi',
    kybOk: 'Lolos verifikasi KYB',
    kybNo: 'Belum lolos verifikasi KYB',
    mutasi: (v: string) => `Arus masuk rekening rata-rata ${v}/bulan`,
    supplier: (p: string) => `${p} tagihan pemasok dibayar tepat waktu`,
    decide: 'Keputusan analis',
    approveAmt: 'Jumlah disetujui',
    approve: 'Setujui',
    reject: 'Tolak',
    reason: 'Alasan penolakan',
    kyb: 'Minta verifikasi KYB',
    kybSent: (code: string) => `Sudah diminta: ${code} diprioritaskan di Kenal Mitra`,
    kybQueued: (code: string) => `${code} antre di Kenal Mitra; permintaan koperasi menaikkan prioritasnya`,
    tooHigh: (v: string) => `Maksimal sejumlah pengajuan (${v})`,
    tooLow: 'Isi jumlah yang disetujui',
    brief: 'Ringkas pengajuan',
    stamp: 'DISETUJUI',
    decided: (st: string, t: string) => `${st} · ${t}`,
    approvedLine: (v: string, i: string) => `Disetujui ${v} · cicilan ${i}/bulan`,
    note: 'Disetujui analis kredit koperasi (simulasi)',
    fair: 'Nilai dari data usaha, bukan dari identitas pemilik. Keputusan tetap di koperasi.',
  },
  en: {
    eyebrow: (l: string) => `${l} · working-capital application · simulated`,
    req: 'Application',
    amount: 'Amount',
    tenor: 'Tenor',
    months: (n: number) => `${n} months`,
    rate: 'Flat rate',
    inst: 'Monthly instalment',
    purpose: 'Purpose',
    score: 'Score now',
    then: (n: number) => `at application ${n}`,
    data: 'Data shared by the owner',
    notShared: 'Not shared by the owner',
    revoked: 'Access revoked by the owner',
    noConsent: 'No data-sharing consent for this application.',
    omzet: (list: string) => `Turnover: ${list}`,
    omzetAvg: (v: string) => `3-month average turnover ${v}`,
    laporan: (v: string) => `Average Sep–Oct net profit ${v}`,
    pajakOk: 'Tax in order in Pajak Beres',
    pajakNo: 'Tax not in order yet',
    kybOk: 'Passed the KYB check',
    kybNo: 'Has not passed the KYB check',
    mutasi: (v: string) => `Average account inflow ${v}/month`,
    supplier: (p: string) => `${p} of supplier bills paid on time`,
    decide: 'Analyst decision',
    approveAmt: 'Approved amount',
    approve: 'Approve',
    reject: 'Decline',
    reason: 'Reason for declining',
    kyb: 'Request a KYB check',
    kybSent: (code: string) => `Already requested: ${code} prioritised in Kenal Mitra`,
    kybQueued: (code: string) => `${code} is queued in Kenal Mitra; the cooperative's request raises its priority`,
    tooHigh: (v: string) => `At most the requested amount (${v})`,
    tooLow: 'Enter the approved amount',
    brief: 'Summarise the application',
    stamp: 'APPROVED',
    decided: (st: string, t: string) => `${st} · ${t}`,
    approvedLine: (v: string, i: string) => `Approved ${v} · instalment ${i}/month`,
    note: 'Approved by the cooperative credit analyst (simulated)',
    fair: 'Judged on business data, not on who the owner is. The cooperative decides.',
  },
}
type L = (typeof S)['id']

const viewSel = (loanId: string) => (s: WorldState) => {
  const loan = s.loanApps.byId[loanId] ?? null
  const b = loan ? (s.businesses.byId[loan.businessId] ?? null) : null
  return { loan, b, score: s.bizScores.byId[loan?.businessId ?? '']?.score ?? 0, consent: loan?.consentId ? (s.consents.byId[loan.consentId] ?? null) : null, sc: loan ? s.bizScores.byId[loan.businessId] : undefined }
}
const viewEq = (a: ReturnType<ReturnType<typeof viewSel>>, b: ReturnType<ReturnType<typeof viewSel>>) => a.loan === b.loan && a.b === b.b && a.score === b.score && a.consent === b.consent && a.sc === b.sc

export default function BankDrawer({ loanId }: { loanId: string }) {
  const { lang } = useT()
  const L = S[lang]
  const v = useWorld(viewSel(loanId), viewEq)
  const close = () => uiStore.set({ loan: null })
  return (
    <Drawer open={!!v.loan} onClose={close} title={v.b?.name ?? loanId} eyebrow={L.eyebrow(LENDER)} width={520} className="dk-ru-bdrawer">
      {v.loan && v.b && <Body L={L} lang={lang} loanId={loanId} />}
    </Drawer>
  )
}

function scopeText(s: WorldState, L: L, lang: 'id' | 'en', bizId: string, k: ConsentScope): string {
  const b = s.businesses.byId[bizId]!
  switch (k) {
    case 'omzet': {
      const om = omzetByMonth(s, bizId)
      const months = Object.keys(om).sort().filter((m) => m < s.day.slice(0, 7)).slice(-3)
      return months.length ? L.omzet(months.map((m) => `${monthShort(m, lang)} ${jt(om[m]!, lang)}`).join(' · ')) : L.omzetAvg(jt(b.monthlyRevenue, lang))
    }
    case 'laporan':
      return L.laporan(jt(netProfitAvg(s, bizId), lang))
    case 'pajak':
      return b.taxTidy ? L.pajakOk : L.pajakNo
    case 'kyb':
      return b.verified ? L.kybOk : L.kybNo
    case 'mutasi':
      return L.mutasi(jt(Math.round(b.monthlyRevenue * 0.96), lang))
    default:
      return L.supplier(pctText(s.bizScores.byId[bizId]?.factors.supplier ?? 0, lang))
  }
}

function Body({ L, lang, loanId }: { L: L; lang: 'id' | 'en'; loanId: string }) {
  const s = useWorld((x) => x)
  const loan = s.loanApps.byId[loanId]!
  const b = s.businesses.byId[loan.businessId]!
  const advice = loanAdvice(s, loanId)
  const consent = loan.consentId ? (s.consents.byId[loan.consentId] ?? null) : null
  const rate = loan.ratePct ?? loanOffer(s, b.id, 0).ratePct
  const inst = loan.installment ?? installment(loan.amount, rate, loan.tenorMonths)
  const openReq = s.verificationRequests.ids.map((id) => s.verificationRequests.byId[id]!).find((r) => r.kind === 'kyb' && r.subjectId === b.id && r.status !== 'selesai') ?? null
  const kybReq = !!openReq?.priority
  const [amt, setAmt] = useState<number | null>(loan.amount)
  const [why, setWhy] = useState(0)
  const [stamp, setStamp] = useState(false)
  const stampRef = useRef<HTMLSpanElement>(null)
  const [showBrief, setShowBrief] = useState(false)
  const scoreNow = advice?.scoreNow ?? loan.score
  const rec = advice ? REC[advice.rec]! : null
  const amtReason = amt === null || amt <= 0 ? L.tooLow : amt > loan.amount ? L.tooHigh(jt(loan.amount, lang)) : null
  const approve = () => {
    if (amtReason || amt === null) return
    emit('loan.approved', { loanId, amount: amt, note: { id: S.id.note, en: S.en.note } }, SLUG)
    setStamp(true)
    requestAnimationFrame(() => void flyBetween(stampRef.current, document.querySelector('[data-ru="mirror"]'), { duration: 0.7 }))
  }
  const decidedInst = loan.decidedAmount && loan.decidedAmount !== loan.amount ? installment(loan.decidedAmount, rate, loan.tenorMonths) : inst
  return (
    <div className="dk-ru-bd" data-ru="bank-drawer" data-loan={loanId}>
      <div className="dk-ru-bd-h">
        <BizBadges badges={badgesOf(s, b.id)} bizId={b.id} size="md" links />
        {loan.status === 'diajukan' && rec && <StatusChip label={rec[lang]} tone={rec.tone} />}
      </div>
      <dl className="dk-ru-dl is-grid">
        <div>
          <dt>{L.amount}</dt>
          <dd className="dk-num" data-ru="bd-amount">
            {rp(loan.amount, lang)}
          </dd>
        </div>
        <div>
          <dt>{L.tenor}</dt>
          <dd>{L.months(loan.tenorMonths)}</dd>
        </div>
        <div>
          <dt>{L.rate}</dt>
          <dd className="dk-num">{rateText(rate, lang)}/{lang === 'id' ? 'bln' : 'mo'}</dd>
        </div>
        <div>
          <dt>{L.inst}</dt>
          <dd className="dk-num" data-ru="bd-installment">
            {rp(inst, lang)}
          </dd>
        </div>
        <div>
          <dt>{L.score}</dt>
          <dd className="dk-num" data-ru="bd-score">
            {scoreNow} · {SCORE_BANDS[bandOf(scoreNow)]!.label[lang]}
            {scoreNow !== loan.score && <small> ({L.then(loan.score)})</small>}
          </dd>
        </div>
        {loan.purpose && (
          <div>
            <dt>{L.purpose}</dt>
            <dd>{loan.purpose[lang]}</dd>
          </div>
        )}
      </dl>
      {advice && (
        <ul className="dk-ru-reasons" aria-label={rec?.[lang]}>
          {advice.reasons.map((r) => (
            <li key={r.id}>{r[lang]}</li>
          ))}
        </ul>
      )}
      <section aria-labelledby="dk-ru-bd-data">
        <h3 id="dk-ru-bd-data">{L.data}</h3>
        {!consent && <p className="dk-ru-muted">{L.noConsent}</p>}
        <ul className="dk-ru-scopedata">
          {SCOPES.map((k) => {
            const shared = !!consent && consent.revokedAt === null && consent.scopes.includes(k)
            return (
              <li key={k} data-scope={k} data-shared={shared}>
                <b>{CONSENT_SCOPE[k][lang]}</b>
                <span className={shared ? '' : 'dk-ru-muted'}>{shared ? scopeText(s, L, lang, b.id, k) : consent?.revokedAt != null ? L.revoked : L.notShared}</span>
              </li>
            )
          })}
        </ul>
      </section>
      <section aria-labelledby="dk-ru-bd-dec" className="dk-ru-decide">
        <h3 id="dk-ru-bd-dec">{L.decide}</h3>
        {loan.status === 'diajukan' ? (
          <>
            <div className="dk-ru-row is-wrap">
              <label className="dk-ru-field">
                <span>{L.approveAmt}</span>
                <MoneyInput value={amt} onChange={setAmt} aria-label={L.approveAmt} data-ru="approve-amount" />
              </label>
              <Button variant="primary" icon="check" onClick={approve} disabled={!!amtReason} data-ru="approve-btn">
                {L.approve}
              </Button>
              {amtReason && <span className="dk-ru-reason">{amtReason}</span>}
            </div>
            <div className="dk-ru-row is-wrap">
              <label className="dk-ru-field">
                <span>{L.reason}</span>
                <Select value={String(why)} onChange={(e) => setWhy(Number(e.target.value))} options={REASONS.map((r, i) => ({ value: String(i), label: r[lang] }))} aria-label={L.reason} />
              </label>
              <Button variant="secondary" icon="close" onClick={() => emit('loan.rejected', { loanId, reason: REASONS[why]! }, SLUG)} data-ru="reject-btn">
                {L.reject}
              </Button>
            </div>
            {!b.verified && (
              <div className="dk-ru-row is-wrap">
                <Button variant="secondary" icon="shield" disabled={kybReq} onClick={() => emit('verification.requested', { kind: 'kyb', subjectKind: 'business', subjectId: b.id, requestedBy: LENDER, priority: true }, SLUG)} data-ru="kyb-btn">
                  {L.kyb}
                </Button>
                {kybReq ? <span className="dk-ru-reason">{L.kybSent(openReq!.code)}</span> : openReq && <span className="dk-ru-muted">{L.kybQueued(openReq.code)}</span>}
              </div>
            )}
          </>
        ) : (
          <p className="dk-num" data-ru="bd-decided">
            {L.decided(LOAN_STATUS[loan.status][lang], timeText(loan.decidedAt ?? loan.at, lang))}
            {loan.status === 'disetujui' ? ` · ${L.approvedLine(rp(loan.decidedAmount ?? loan.amount, lang), rp(decidedInst, lang))}` : loan.reason ? ` · ${loan.reason[lang]}` : ''}
          </p>
        )}
        {stamp && (
          <span ref={stampRef} className="dk-ru-stamp" aria-hidden="true">
            <Icon name="stamp" size={16} /> {L.stamp}
          </span>
        )}
      </section>
      <div className="dk-ru-row is-wrap">
        <Button variant="quiet" icon="spark" onClick={() => setShowBrief(true)} onPointerEnter={() => void loadBrief()} onFocus={() => void loadBrief()} data-ru="brief-btn">
          {L.brief}
        </Button>
      </div>
      {showBrief && (
        <Suspense fallback={null}>
          <Brief loanId={loanId} />
        </Suspense>
      )}
      <p className="dk-ru-fine">{L.fair}</p>
    </div>
  )
}
