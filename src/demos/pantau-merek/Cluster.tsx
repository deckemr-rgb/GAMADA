/**
 * demos/pantau-merek/Cluster.tsx — the spike sheet (lazy, registers scenario.ts). View 1 "Kelompokkan": the simulated
 * analyst streams a summary, then the clusters of `complaintClusters` (≤ 6, shares, real review texts as samples; the
 * stock cluster quotes the flood demand factor and points at Toko Autopilot's PO). "Jelaskan lonjakan" asks why.
 * View 2 (Announce.tsx): the service notice → "Terbitkan" ⇒ `brand.announced`. View 3: the published notice.
 */
import { useEffect, useMemo, useRef } from 'react'
import { Button, Drawer, Icon, LoadingText } from '../../demo-kit/ui'
import { useAiChat } from '../../demo-kit/ai/chat'
import { WORLD, clock, getSession, rows, useSession, world } from '../../demo-kit/world'
import { demoHref } from '../../demo-kit/shell'
import { useLocation, useNavigate } from 'react-router'
import { goTo } from '../../components/AppLink'
import { complaintClusters } from '../../demo-kit/world/usaha-pintar'
import { DEMO_READY } from '../registry'
import { ensureScenario } from './scenario'
import { brandCtx } from './ctx'
import Announce, { Published } from './Announce'
import { useBrand, useNow } from './model'
import { fill, nf, tm, useStr } from './strings'

ensureScenario()

const S = {
  id: {
    title: 'Pola keluhan lonjakan',
    titleAnn: 'Pengumuman layanan',
    titlePub: 'Pengumuman terbit',
    eyebrow: 'Lonjakan {t} · {n} keluhan · analis AI (simulasi)',
    ask: 'Kelompokkan keluhan lonjakan ini',
    why: 'Kenapa melonjak? Jelaskan lonjakan',
    whyBtn: 'Jelaskan lonjakan',
    thinking: 'Mengelompokkan keluhan…',
    share: '{p}% · {n} keluhan',
    sample: 'Contoh ulasan',
    pump: 'Permintaan {item} naik {p}% (prediksi stok Toko Autopilot, simulasi)',
    pumpLink: 'Lihat PO di Toko Autopilot',
    pumpLater: 'PO pompa ada di Toko Autopilot (demo tahap 3)',
    suggest: 'Sarankan pengumuman',
    none: 'Belum ada keluhan yang bisa dikelompokkan.',
  },
  en: {
    title: 'Spike complaint patterns',
    titleAnn: 'Service notice',
    titlePub: 'Notice published',
    eyebrow: 'Spike {t} · {n} complaints · AI analyst (simulated)',
    ask: 'Group the complaints of this spike',
    why: 'Why the spike? Explain the spike',
    whyBtn: 'Explain the spike',
    thinking: 'Grouping complaints…',
    share: '{p}% · {n} complaints',
    sample: 'Sample review',
    pump: '{item} demand up {p}% (Toko Autopilot stock forecast, simulated)',
    pumpLink: 'See the PO in Toko Autopilot',
    pumpLater: 'The pump PO lives in Toko Autopilot (stage 3 demo)',
    suggest: 'Suggest a notice',
    none: 'No complaints to group yet.',
  },
}

export default function Cluster({
  open,
  view,
  alertId,
  onView,
  onClose,
}: {
  open: boolean
  view: 'cluster' | 'announce' | 'published'
  alertId: string
  onView: (v: 'cluster' | 'announce' | 'published') => void
  onClose: () => void
}) {
  const { lang } = useStr()
  const L = S[lang]
  const session = useSession()
  const now = useNow()
  const chat = useAiChat('pantau-merek', { mode: session.aiMode, role: session.role, lang, getContext: () => brandCtx(world.get(), clock.get().minutes) })
  const clusters = useBrand((s, n) => complaintClusters(s, n, alertId), now, [alertId])
  const alert = world.get().brandAlerts.byId[alertId]
  const total = clusters.reduce((a, c) => a + c.count, 0)
  const asked = useRef(false)
  const { send, flush, busy, stop } = chat
  useEffect(() => {
    if (!open || view !== 'cluster' || asked.current) return
    asked.current = true
    let finished = false
    void send(L.ask, { maxMs: 1200 }).finally(() => (finished = true))
    // an unmount before the answer is in (StrictMode's probe, a fast close) aborts it; the next mount asks again
    return () => {
      if (finished) return
      stop()
      asked.current = false
    }
  }, [open, view, send, stop, L.ask])
  // the clusters show once the analyst's first answer is in (Live: its text; numbers always from the selector)
  const firstDone = chat.messages.some((m) => m.role === 'assistant' && (m.status === 'done' || m.status === 'error' || (m.status === 'stopped' && !!m.content)))
  const answers = useMemo(() => chat.messages.filter((m) => m.role === 'assistant' && !(m.status === 'stopped' && !m.content)), [chat.messages])
  const s = world.get()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const goPump = (item: string) => {
    const p = rows(s.products).find((x) => x.businessId === s.meta.shopId && x.name === item)
    const h = demoHref('toko-autopilot', getSession(), p?.id ?? null)
    void goTo(new URLSearchParams(window.location.search).get('controls') === 'all' ? `${h}&controls=all` : h, navigate, pathname)
  }

  const title = view === 'published' ? L.titlePub : view === 'announce' ? L.titleAnn : L.title
  return (
    <Drawer open={open} onClose={onClose} title={title} eyebrow={alert ? fill(L.eyebrow, { t: tm(alert.at, lang), n: total }) : undefined} width={640} className="dk-pm-sheet">
      {view === 'published' ? (
        <Published alertId={alertId} />
      ) : view === 'announce' ? (
        <Announce alertId={alertId} chat={chat} onPublished={() => onView('published')} />
      ) : (
        <div className="dk-pm-cluster" data-pm="clusters">
          {answers.map((m) => (
            <p key={m.id} className="dk-pm-ai" aria-live="polite" onClick={flush} data-status={m.status}>
              <Icon name="spark" size={14} />
              {m.content || L.thinking}
            </p>
          ))}
          {!firstDone ? (
            <LoadingText>{L.thinking}</LoadingText>
          ) : clusters.length ? (
            <ol className="dk-pm-clist">
              {clusters.map((c) => (
                <li key={c.key} className="dk-pm-cl" data-cluster={c.key}>
                  <div className="dk-pm-cl-h">
                    <b>{c.label[lang]}</b>
                    <span className="dk-num">{fill(L.share, { p: c.share, n: c.count })}</span>
                  </div>
                  <span className="dk-pm-cl-bar" aria-hidden="true">
                    <i style={{ transform: `scaleX(${c.share / 100})` }} />
                  </span>
                  {c.sampleIds.slice(0, 2).map((id) => {
                    const m = s.brandMentions.byId[id]
                    return m ? (
                      <blockquote key={id} className="dk-pm-quote" cite={`#${id}`}>
                        <span className="dk-sr">{L.sample}: </span>“{m.text[lang]}” <cite>@{m.author}</cite>
                      </blockquote>
                    ) : null
                  })}
                  {c.key === 'stok' && (
                    <p className="dk-pm-note" data-pm="pump-factor">
                      {fill(L.pump, { item: s.brandMentions.byId[c.sampleIds[0] ?? '']?.item ?? '', p: nf(Math.round((WORLD.floodDemandFactor - 1) * 100), lang) })}
                      {' · '}
                      {DEMO_READY['toko-autopilot'] ? (
                        <Button size="sm" variant="quiet" iconEnd="arrowUpRight" onClick={() => goPump(s.brandMentions.byId[c.sampleIds[0] ?? '']?.item ?? '')} data-pm="to-toko">
                          {L.pumpLink}
                        </Button>
                      ) : (
                        L.pumpLater
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="dk-pm-empty">{L.none}</p>
          )}
          <div className="dk-pm-sheet-act">
            <Button variant="ghost" icon="help" disabled={busy} onClick={() => void send(L.why, { maxMs: 1200 })} data-pm="explain">
              {L.whyBtn}
            </Button>
            <Button variant="primary" icon="doc" disabled={!firstDone || !clusters.length} onClick={() => onView('announce')} data-pm="announce-suggest">
              {L.suggest}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}
