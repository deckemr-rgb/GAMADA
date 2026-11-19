/**
 * Bank.tsx (lazy; the cooperative's first screen) — analis kredit Koperasi Mitra Usaha Sejahtera. Antrian pengajuan
 * (Segmented Menunggu / Diputus, `lenderQueue`): business, amount, tenor, score now (ScoreDial sm; "saat diajukan"
 * when it changed, e.g. 692 → 790 after KYB), BizBadges, recommendation chip (`loanAdvice`). A row opens the detail
 * drawer (lazy BankDrawer). Riwayat: the cooperative's decisions and the consents it received, newest first.
 */
import { Suspense, lazy, memo, useEffect, useRef } from 'react'
import { BizBadges, Icon, Segmented, StatusChip, flashNewRow } from '../../demo-kit/ui'
import { Dial } from './Dial'
import { useWorld, type WorldState } from '../../demo-kit/world'
import { CONSENT_SCOPE, LOAN_STATUS, SCORE_BANDS, lenderQueue, type QueueRow } from '../../demo-kit/world/pasar-daerah'
import { LENDER, jt, timeText, uiStore, useUi, type BankTab, type Lang } from './model'
import { useT } from './strings'

const loadDrawer = () => import('./BankDrawer')
const BankDrawer = lazy(loadDrawer)

export const REC: Record<string, { id: string; en: string; tone: 'done' | 'warn' | 'neutral' }> = {
  setujui: { id: 'Rekomendasi: setujui', en: 'Recommendation: approve', tone: 'done' },
  'setujui-bersyarat': { id: 'Rekomendasi: setujui bersyarat', en: 'Recommendation: approve with conditions', tone: 'warn' },
  'tinjau-manual': { id: 'Rekomendasi: tinjau manual', en: 'Recommendation: manual review', tone: 'neutral' },
}

const S = {
  id: {
    seg: 'Status pengajuan',
    menunggu: 'Menunggu',
    diputus: 'Diputus',
    intro: (l: string) => `Pengajuan modal kerja ke ${l}. Skor dan rekomendasi simulasi; keputusan tetap di analis.`,
    empty: { menunggu: 'Tidak ada pengajuan yang menunggu.', diputus: 'Belum ada pengajuan yang diputus.' },
    amount: (v: string, n: number) => `${v} · ${n} bln`,
    then: (n: number) => `saat diajukan ${n}`,
    scoreNow: 'Skor sekarang',
    open: 'Buka detail',
    histTitle: 'Riwayat keputusan dan akses data',
    histLoan: (code: string, st: string, v: string) => `${code} · ${st} · ${v}`,
    histGrant: (n: number, list: string) => `Akses data diberikan ${n} hari: ${list}`,
    histRevoke: 'Akses data dicabut pemilik',
    histEmpty: 'Belum ada riwayat.',
    sim: 'simulasi',
  },
  en: {
    seg: 'Application status',
    menunggu: 'Waiting',
    diputus: 'Decided',
    intro: (l: string) => `Working-capital applications to ${l}. Simulated scores and recommendations; the analyst decides.`,
    empty: { menunggu: 'No applications waiting.', diputus: 'No decided applications yet.' },
    amount: (v: string, n: number) => `${v} · ${n} mo`,
    then: (n: number) => `at application ${n}`,
    scoreNow: 'Score now',
    open: 'Open details',
    histTitle: 'Decisions and data access history',
    histLoan: (code: string, st: string, v: string) => `${code} · ${st} · ${v}`,
    histGrant: (n: number, list: string) => `Data access granted for ${n} days: ${list}`,
    histRevoke: 'Data access revoked by the owner',
    histEmpty: 'No history yet.',
    sim: 'simulated',
  },
}
type L = (typeof S)['id']

const waitSel = (s: WorldState) => lenderQueue(s, LENDER, 'menunggu')
const doneSel = (s: WorldState) => lenderQueue(s, LENDER, 'diputus')
const rowsEq = (a: QueueRow[], b: QueueRow[]) =>
  a.length === b.length && a.every((x, i) => x.loan === b[i]!.loan && x.scoreNow === b[i]!.scoreNow && x.business === b[i]!.business && x.advice?.rec === b[i]!.advice?.rec && x.consent === b[i]!.consent)

export default function Bank({ tab }: { tab: BankTab }) {
  const { lang } = useT()
  const L = S[lang]
  const loan = useUi((u) => u.loan)
  return (
    <div className="dk-ru-bank">
      {tab === 'antrian' ? <Queue L={L} lang={lang} /> : <History L={L} lang={lang} />}
      {loan && (
        <Suspense fallback={null}>
          <BankDrawer loanId={loan} />
        </Suspense>
      )}
    </div>
  )
}

function Queue({ L, lang }: { L: L; lang: Lang }) {
  const seg = useUi((u) => u.seg)
  const wait = useWorld(waitSel, rowsEq)
  const done = useWorld(doneSel, rowsEq)
  const list = seg === 'menunggu' ? wait : done
  const flash = useUi((u) => u.flash)
  const box = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (!flash) return
    const el = box.current?.querySelector<HTMLElement>(`[data-loan="${flash}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest' })
    flashNewRow(el)
    uiStore.set({ flash: null })
  }, [flash, list.length])
  return (
    <section className="dk-ru-card" aria-label={L.seg} data-ru="approve">
      <div className="dk-ru-row is-between">
        <p className="dk-ru-muted">{L.intro(LENDER)}</p>
        <Segmented
          size="sm"
          label={L.seg}
          value={seg}
          onChange={(v) => uiStore.set({ seg: v })}
          onIntent={() => void loadDrawer()}
          options={[
            { value: 'menunggu', label: `${L.menunggu} (${wait.length})` },
            { value: 'diputus', label: `${L.diputus} (${done.length})` },
          ]}
        />
      </div>
      {list.length ? (
        <ul className="dk-ru-queue" ref={box}>
          {list.map((r) => (
            <QueueItem key={r.loan.id} r={r} L={L} lang={lang} />
          ))}
        </ul>
      ) : (
        <p className="dk-ru-muted">{L.empty[seg]}</p>
      )}
    </section>
  )
}

const QueueItem = memo(function QueueItem({ r, L, lang }: { r: QueueRow; L: L; lang: Lang }) {
  const rec = r.advice ? REC[r.advice.rec]! : null
  return (
    <li className="dk-ru-qrow" data-loan={r.loan.id} data-biz={r.business.id} data-status={r.loan.status}>
      <button type="button" className="dk-ru-qbtn" onClick={() => uiStore.set({ loan: r.loan.id })} onPointerEnter={() => void loadDrawer()} onFocus={() => void loadDrawer()} aria-haspopup="dialog" aria-label={`${L.open}: ${r.business.name} ${r.loan.id}`}>
        <Dial value={r.scoreNow} prev={r.scoreThen} bands={SCORE_BANDS} label={{ id: S.id.scoreNow, en: S.en.scoreNow }} size="sm" />
        <span className="dk-ru-qmain">
          <strong>{r.business.name}</strong>
          <small className="dk-num">
            {r.loan.id} · {L.amount(jt(r.loan.amount, lang), r.loan.tenorMonths)} · {timeText(r.loan.at, lang)}
          </small>
          <span className="dk-ru-qscore dk-num" data-ru="score-now">
            {L.scoreNow} {r.scoreNow}
            {r.scoreNow !== r.scoreThen && <em> ({L.then(r.scoreThen)})</em>} · {L.sim}
          </span>
        </span>
      </button>
      <span className="dk-ru-qside">
        <BizBadges badges={r.badges} bizId={r.business.id} size="sm" />
        {r.loan.status === 'diajukan' ? rec && <StatusChip label={rec[lang]} tone={rec.tone} className="dk-ru-rec" /> : <StatusChip label={LOAN_STATUS[r.loan.status][lang]} tone={r.loan.status === 'disetujui' ? 'done' : 'danger'} />}
      </span>
    </li>
  )
})

interface HistRow { id: string; at: number; loanId: string | null; text: string; icon: 'stamp' | 'shield' | 'lock'; who: string }
function histSel(lang: Lang, L: L) {
  return (s: WorldState): HistRow[] => {
    const out: HistRow[] = []
    for (const id of s.loanApps.ids) {
      const l = s.loanApps.byId[id]!
      if (l.lender !== LENDER || l.status === 'diajukan') continue
      out.push({ id: l.id, at: l.decidedAt ?? l.at, loanId: l.id, icon: 'stamp', who: s.businesses.byId[l.businessId]?.name ?? '', text: L.histLoan(l.id, LOAN_STATUS[l.status][lang], l.status === 'disetujui' ? jt(l.decidedAmount ?? l.amount, lang) : (l.reason?.[lang] ?? '')) })
    }
    for (const id of s.consents.ids) {
      const c = s.consents.byId[id]!
      if (c.lender !== LENDER) continue
      const loan = s.loanApps.ids.find((k) => s.loanApps.byId[k]!.consentId === c.id) ?? null
      const who = s.businesses.byId[c.businessId]?.name ?? ''
      out.push({ id: c.id, at: c.at, loanId: loan, icon: 'shield', who, text: `${c.id} · ${L.histGrant(c.days, c.scopes.map((k) => CONSENT_SCOPE[k][lang]).join(', '))}` })
      if (c.revokedAt !== null) out.push({ id: `${c.id}-r`, at: c.revokedAt, loanId: loan, icon: 'lock', who, text: `${c.id} · ${L.histRevoke}` })
    }
    return out.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id)).slice(0, 30)
  }
}
function History({ L, lang }: { L: L; lang: Lang }) {
  const rows = useWorld(histSel(lang, L), (a, b) => a.length === b.length && a[0]?.id === b[0]?.id && a[0]?.text === b[0]?.text)
  return (
    <section className="dk-ru-card" aria-labelledby="dk-ru-hist-h">
      <h3 id="dk-ru-hist-h">{L.histTitle}</h3>
      {rows.length ? (
        <ol className="dk-ru-hist">
          {rows.map((r) => (
            <li key={r.id} data-hist={r.id}>
              <Icon name={r.icon} size={14} />
              <span>
                <strong>{r.who}</strong>
                <small>
                  {r.text} · {timeText(r.at, lang)}
                </small>
              </span>
              {r.loanId && (
                <button type="button" className="dk-ru-linkbtn" onClick={() => uiStore.set({ loan: r.loanId })} aria-haspopup="dialog">
                  {L.open}
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="dk-ru-muted">{L.histEmpty}</p>
      )}
    </section>
  )
}
