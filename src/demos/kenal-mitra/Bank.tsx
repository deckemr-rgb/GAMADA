/**
 * Bank/Koperasi Mitra role (lazy): "Permintaan saya" (open requests of the lender + "Minta KYC nasabah baru": pick 1 of
 * the 3 seeded applicants ⇒ verification.requested, toast with "Ganti peran") and "Hasil verifikasi" (results of the
 * lender's requests, read-only, "Lihat sertifikat"). Consent line: data shared with the customer's consent.
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useShell } from '../../demo-kit/shell'
import { Button, Icon, flashNewRow } from '../../demo-kit/ui'
import { emit, useClock, useWorld, type WorldState } from '../../demo-kit/world'
import { subjectName } from '../../demo-kit/world/usaha-pintar'
import { clockText, lenderOf, SLUG, waitLabel } from './model'
import { STR, useStr } from './strings'

const Certificate = lazy(() => import('./Certificate'))

interface Row {
  id: string
  code: string
  kind: 'kyc' | 'kyb' | 'cv'
  subject: string
  status: string
  at: number
  verificationId: string | null
  result: string | null
  score: number | null
  vAt: number | null
}
const rowsKey = (a: Row[]) => a.map((r) => `${r.id}:${r.status}:${r.result ?? ''}`).join('|')

function lenderRows(s: WorldState, done: boolean): Row[] {
  const lender = lenderOf(s)
  const out: Row[] = []
  for (const id of s.verificationRequests.ids) {
    const r = s.verificationRequests.byId[id]
    if (!r || r.requestedBy !== lender || (r.status === 'selesai') !== done) continue
    const v = r.verificationId ? s.verifications.byId[r.verificationId] : undefined
    if (done && !v) continue
    out.push({ id: r.id, code: r.code, kind: r.kind, subject: subjectName(s, r), status: r.status, at: r.at, verificationId: r.verificationId, result: v?.result ?? null, score: v?.score ?? null, vAt: v?.at ?? null })
  }
  return done ? out.sort((a, b) => (b.vAt ?? 0) - (a.vAt ?? 0)).slice(0, 10) : out.sort((a, b) => b.at - a.at)
}

/** the 3 seeded loan applicants (the KYC KTP specimens) and whether a request for them is open */
function applicants(s: WorldState) {
  const out: { docId: string; name: string; open: boolean }[] = []
  for (const id of s.documents.ids) {
    const d = s.documents.byId[id]
    if (!d || d.program !== 'kyc') continue
    const open = s.verificationRequests.ids.some((x) => {
      const r = s.verificationRequests.byId[x]
      return r?.subjectId === d.id && r.status !== 'selesai'
    })
    out.push({ docId: d.id, name: d.ownerName, open })
  }
  return out.slice(0, 3)
}

export default function Bank({ view, focusReq, focusCert, focusKey, onSwitchToAnalyst }: { view: 'minta' | 'hasil'; focusReq: string | null; focusCert: string | null; focusKey: number; onSwitchToAnalyst: (requestId: string | null) => void }) {
  const { t, lang } = useStr()
  const shell = useShell()
  const now = useClock().minutes
  const mine = useWorld((s) => lenderRows(s, false), (a, b) => rowsKey(a) === rowsKey(b))
  const done = useWorld((s) => lenderRows(s, true), (a, b) => rowsKey(a) === rowsKey(b))
  const apps = useWorld(applicants, (a, b) => a.map((x) => `${x.docId}${x.open}`).join() === b.map((x) => `${x.docId}${x.open}`).join())
  const lender = useWorld(lenderOf)
  const [cert, setCert] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // ?focus= arrivals: the request row flashes, a verification opens its certificate
  useEffect(() => {
    if (focusCert) setCert(focusCert)
  }, [focusCert, focusKey])
  useLayoutEffect(() => {
    if (!focusReq) return
    const el = root.current?.querySelector<HTMLElement>(`[data-req="${focusReq}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
      flashNewRow(el)
    }
  }, [focusReq, focusKey, view])

  const ask = (docId: string, name: string) => {
    const e = emit('verification.requested', { kind: 'kyc', subjectKind: 'document', subjectId: docId, requestedBy: lender, priority: false }, SLUG)
    const L = STR[lang]
    const reqId = e.payload.id ?? null
    window.setTimeout(() => {
      shell.toast({ title: L.requested(e.payload.code ?? reqId ?? name), body: L.requestedBody, tone: 'accent', icon: 'send', action: { label: L.switchRole, onClick: () => onSwitchToAnalyst(reqId) } })
    }, 0)
  }
  const time = (at: number | null) => (at == null ? '' : at >= 0 ? t.at(clockText(at, lang)) : t.daysAgo(Math.max(1, Math.ceil(-at / 1440))))

  return (
    <div ref={root} className="dk-km-bank">
      <p className="dk-km-consent">
        <Icon name="lock" size={14} />
        {t.consent}
      </p>
      {view === 'minta' ? (
        <>
          <section className="dk-km-apply" aria-label={t.newKyc}>
            <h3>{t.newKyc}</h3>
            <p className="dk-km-muted">{t.newKycSub}</p>
            <ul>
              {apps.map((a) => (
                <li key={a.docId}>
                  <span>
                    <b>{a.name}</b>
                    <small className="dk-km-muted">KTP SPESIMEN</small>
                  </span>
                  <Button size="sm" variant="primary" icon="send" disabled={a.open} aria-describedby={a.open ? `km-app-${a.docId}` : undefined} onClick={() => ask(a.docId, a.name)} data-km="bank-request">
                    {t.request}
                  </Button>
                  {a.open && (
                    <span id={`km-app-${a.docId}`} className="dk-km-why">
                      {t.applicantOpen}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="dk-km-mine" aria-label={t.myRequests}>
            <h3>{t.myRequests}</h3>
            {mine.length ? (
              <ul className="dk-km-list">
                {mine.map((r) => (
                  <li key={r.id} data-req={r.id}>
                    <span className="dk-km-code dk-num">{r.code}</span>
                    <b>{r.subject}</b>
                    <span className="dk-km-muted">
                      {t.kindLabel[r.kind]} · {t.statusLabel[r.status]} · {t.waiting(waitLabel(Math.max(0, now - r.at), lang))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dk-km-empty">{t.noMine}</p>
            )}
          </section>
        </>
      ) : (
        <section className="dk-km-results" aria-label={t.results}>
          <h3>{t.results}</h3>
          <p className="dk-km-muted">{t.resultsSub}</p>
          {done.length ? (
            <ul className="dk-km-list">
              {done.map((r) => (
                <li key={r.id} data-req={r.id} data-ver={r.verificationId ?? undefined}>
                  <span className="dk-km-code dk-num">{r.code}</span>
                  <b>{r.subject}</b>
                  <span className={`dk-km-res is-${r.result}`}>{t.result[r.result ?? ''] ?? r.result}</span>
                  <span className="dk-km-muted dk-num">
                    {t.kindLabel[r.kind]} · {r.score != null ? (r.kind === 'kyc' ? t.riskOf(r.score) : t.scoreOf(r.score)) : ''} · {time(r.vAt)}
                  </span>
                  {r.verificationId && (
                    <Button size="sm" variant="quiet" icon="doc" onClick={() => setCert(r.verificationId)} data-km="see-cert">
                      {t.seeCert}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dk-km-empty">{t.noResults}</p>
          )}
        </section>
      )}
      {cert && (
        <Suspense fallback={null}>
          <Certificate verificationId={cert} onClose={() => setCert(null)} />
        </Suspense>
      )}
    </div>
  )
}
