/**
 * demos/pantau-merek/OwnerBand.tsx — the owner's band above the stream (Pemilik Toko role, lazy): orders hit by the
 * flood and their value (`affectedOrders`, simulated), the score (same `reputationScore` as the KPI), the top 3 issues
 * in plain words, "Setujui pengumuman" when a Brand Manager draft waits, and "Ringkas hari ini" (AI).
 */
import { Button } from '../../demo-kit/ui'
import { affectedOrders, brandTopics, complaintClusters, reputationScore, BRAND_TOPIC } from '../../demo-kit/world/usaha-pintar'
import { AskLauncher } from './AskLauncher'
import { cardAlert, useBrand, usePendingDraft } from './model'
import { fill, useStr } from './strings'

const rpJt = (n: number, l: 'id' | 'en') => `Rp ${(n / 1e6).toLocaleString(l === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} ${l === 'id' ? 'jt' : 'M'}`

const S = {
  id: {
    label: 'Ringkasan pemilik',
    orders: 'Pesanan terdampak banjir: {n} · nilai {v} (simulasi)',
    noOrders: 'Belum ada pesanan yang terdampak banjir.',
    score: 'Skor reputasi {s}/100',
    issues: 'Masalah utama hari ini',
    approve: 'Setujui pengumuman',
    waiting: 'Draf pengumuman (gratis ongkir) menunggu persetujuan Anda.',
    ask: 'Ringkas hari ini untuk pemilik',
    askBtn: 'Ringkas hari ini',
    topic: '{t}: {n} keluhan',
  },
  en: {
    label: 'Owner summary',
    orders: 'Orders hit by the flood: {n} · worth {v} (simulated)',
    noOrders: 'No orders hit by the flood yet.',
    score: 'Reputation score {s}/100',
    issues: 'Main issues today',
    approve: 'Approve the notice',
    waiting: 'A notice draft (free re-delivery) is waiting for your approval.',
    ask: 'Summarize today for the owner',
    askBtn: 'Summarize today',
    topic: '{t}: {n} complaints',
  },
}

export default function OwnerBand({ now, onApprove }: { now: number; onApprove: (alertId: string) => void }) {
  const { lang } = useStr()
  const L = S[lang]
  const pend = usePendingDraft()
  const d = useBrand((s, n) => {
    const a = affectedOrders(s, n)
    const al = cardAlert(s, n).alert
    const issues = al
      ? complaintClusters(s, n, al.id)
          .slice(0, 3)
          .map((c) => c.label[lang])
      : brandTopics(s, n, 24)
          .filter((x) => x.count > 0)
          .sort((x, y) => y.count - x.count)
          .slice(0, 3)
          .map((x) => fill(L.topic, { t: BRAND_TOPIC[x.topic][lang], n: x.count }))
    return { a, issues, score: reputationScore(s, n).score }
  }, now, [lang])
  return (
    <section className="dk-pm-owner" aria-label={L.label} data-pm="owner-band">
      <div className="dk-pm-owner-main">
        <p className="dk-pm-owner-big dk-num" data-pm="owner-orders">
          {d.a.count ? fill(L.orders, { n: d.a.count, v: rpJt(d.a.value, lang) }) : L.noOrders}
        </p>
        <p className="dk-pm-note dk-num" data-pm="owner-score">
          {fill(L.score, { s: d.score })}
        </p>
      </div>
      {d.issues.length > 0 && (
        <div>
          <p className="dk-pm-k">{L.issues}</p>
          <ol className="dk-pm-owner-issues">
            {d.issues.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </div>
      )}
      <div className="dk-pm-owner-act">
        {pend && (
          <>
            <p className="dk-pm-note is-warn">{L.waiting}</p>
            <Button variant="primary" icon="check" onClick={() => onApprove(pend.alertId)} data-pm="owner-approve">
              {L.approve}
            </Button>
          </>
        )}
        <AskLauncher prompt={L.ask} label={L.askBtn} pm="ask-summary" />
      </div>
    </section>
  )
}
