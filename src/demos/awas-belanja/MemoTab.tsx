/**
 * MemoTab.tsx (lazy) — "Laporan": the audit memo on a PaperFrame (print / PDF). "Rekomendasikan" streams the AI
 * summary (Simulasi, or Live through the proxy with fallback), then emits procurement.recommended with the corrected
 * HPS (= the market median of the HPS table) and inviteLocal ⇒ a Katalog Lokal need. Every number in the memo comes
 * from hpsVsMarket through the same formatters as the HPS tab (spec "Cek lulus": memo numbers = table numbers).
 */
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'
import { PaperFrame, printPaper } from '../../demo-kit/frames'
import { Button, EmptyState, Icon, enterPanel } from '../../demo-kit/ui'
import { useAiChat } from '../../demo-kit/ai/chat'
import { useShell } from '../../demo-kit/shell'
import { dateWib } from '../../demo-kit/viz/format'
import { emit, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { DETECTOR_BY_ID, SLUG, aiContext, isAnalysed, memoModel, noteText, pct, qtyUnit, rpFull } from './model'
import { memoSummary } from './scenario'
import { useT } from './strings'
import type { RoleKey } from './types'

const all = (s: WorldState) => s

export default function MemoTab({
  id, roleKey, memoReq, memoHandled, onAnalyse, running,
}: {
  id: string
  roleKey: RoleKey
  memoReq: number
  /** memo requests already started: owned by the Canvas, so it survives this tab re-mounting but not the page */
  memoHandled: RefObject<number>
  onAnalyse: () => void
  running: boolean
}) {
  const { t, lang } = useT()
  const cards = useShell().size === 'sm'
  const session = useSession()
  const s = useWorld(all)
  const p = s.procurements.byId[id]
  const analysed = !!p && isAnalysed(p)
  const recommended = !!p?.recommendation
  const paper = useRef<HTMLElement>(null)
  const recsRef = useRef<HTMLDivElement>(null)

  const chat = useAiChat('awas-belanja', {
    mode: session.aiMode,
    role: roleKey,
    getContext: () => aiContext(world.get(), id, roleKey),
    onDone: (m) => {
      if (m.status !== 'done') return
      const cur = world.get()
      const q = cur.procurements.byId[id]
      if (!q || q.recommendation) return
      const ctx = aiContext(cur, id, roleKey)
      const m2 = memoModel(cur, id, roleKey, lang)
      if (!m2) return
      emit('procurement.recommended', { procurementId: id, hpsCorrected: m2.hpsCorrected, note: { id: memoSummary(ctx, 'id'), en: memoSummary(ctx, 'en') }, inviteLocal: true }, SLUG)
    },
  })
  const { send, busy, last, prepare } = chat

  const start = useCallback(() => {
    void send(lang === 'id' ? 'Susun memo audit untuk paket ini' : 'Draft the audit memo for this package')
  }, [send, lang])

  // "Rekomendasikan" in the header: start once per request (deferred one tick, so a StrictMode re-mount in dev
  // cannot abort the request it just started)
  useEffect(() => {
    if (!(memoReq > memoHandled.current && analysed && !recommended)) return
    const c = gsap.delayedCall(0, () => {
      memoHandled.current = memoReq
      start()
    })
    return () => {
      c.kill()
    }
  }, [memoReq, memoHandled, analysed, recommended, start])

  useEffect(() => {
    if (recommended && recsRef.current) enterPanel(recsRef.current, { y: 6 })
  }, [recommended])

  const model = useMemo(() => memoModel(s, id, roleKey, lang), [s.procurements, s.bidders, s.region, id, roleKey, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p || !model) return null
  if (!analysed && !running)
    return (
      <EmptyState
        art="doc"
        title={t.memoNeedScan}
        body={t.memoNeedScanBody}
        action={{ label: t.analyse, icon: 'zap', onClick: onAnalyse }}
      />
    )

  const streamed = last && last.role === 'assistant' ? last : null
  const summary = streamed?.content || (p.recommendation ? p.recommendation.note[lang] : '')
  const mode = streamed?.mode ?? session.aiMode

  return (
    <div className="dk-ab-memo">
      <div className="dk-ab-memo-bar">
        {!recommended ? (
          <>
            <div className="dk-ab-memo-intro">
              <p className="dk-ab-h4">
                <Icon name="spark" size={16} />
                {t.memoReadyTitle}
              </p>
              <p className="dk-ab-muted">{t.memoReadyBody}</p>
            </div>
            <Button variant="primary" icon="spark" onClick={start} onFocus={prepare} onPointerEnter={prepare} busy={busy} disabled={busy || running || !analysed}>
              {busy ? t.memoWriting : t.memoWrite}
            </Button>
          </>
        ) : (
          <>
            <p className="dk-ab-memo-ok" role="status">
              <Icon name="check" size={16} />
              {t.memoSent}
            </p>
            <Button variant="secondary" icon="print" onClick={() => paper.current && printPaper(paper.current)}>
              {t.memoPrint}
            </Button>
          </>
        )}
      </div>
      <PaperFrame label={`${t.memoKind[roleKey]} ${model.number}`} size="auto" className="dk-ab-paper">
        <article ref={paper} className="dk-ab-memo-doc">
          <p className="dk-ab-memo-draft">{t.memoDraft}</p>
          <h3 className="dk-ab-memo-kind">{t.memoKind[roleKey]}</h3>
          <p className="dk-ab-memo-sub">{t.memoSubject[roleKey]}</p>
          <dl className="dk-ab-memo-meta">
            <dt>{t.memoNo}</dt>
            <dd>{model.number}</dd>
            <dt>{t.memoDate}</dt>
            <dd>{dateWib(`${s.day}T09:00:00+07:00`, lang, 'long')}</dd>
            <dt>{t.memoTo}</dt>
            <dd>{model.to}</dd>
            <dt>{t.memoFrom}</dt>
            <dd>{model.from}</dd>
            <dt>{t.memoCc}</dt>
            <dd>{model.cc}</dd>
            <dt>{t.memoRe}</dt>
            <dd>{model.subject}</dd>
          </dl>

          <h4>{t.memoSummary}</h4>
          <div className="dk-ab-memo-sum" aria-live="polite" aria-busy={busy || undefined}>
            {summary ? (
              <p>
                {summary}
                {busy && <span className="dk-ab-caret" aria-hidden="true" />}
              </p>
            ) : busy ? (
              <p className="dk-ab-memo-think">
                <span className="dk-ab-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {t.memoWriting}
              </p>
            ) : (
              <p className="dk-ab-memo-ph">{t.memoReadyBody}</p>
            )}
            {summary && !busy && (
              <p className="dk-ab-memo-by">
                {t.memoAiBy(t.chatMode[mode] ?? mode)}
                {streamed?.fellBack && ` · ${t.memoFallback}`}
              </p>
            )}
          </div>

          <h4>{t.memoTable}</h4>
          <table className={`dk-ab-memo-table${cards ? ' is-cards' : ''}`}>
            <thead>
              <tr>
                <th scope="col">{t.colItem}</th>
                <th scope="col">{t.colQty}</th>
                <th scope="col">{t.colHpsUnit}</th>
                <th scope="col">{t.colMarket}</th>
                <th scope="col">{t.colDev}</th>
                <th scope="col">{t.colGap}</th>
              </tr>
            </thead>
            <tbody>
              {model.table.items.map((i) => (
                <tr key={i.name.id} className={`is-${i.level}`}>
                  <th scope="row">{i.name[lang]}</th>
                  <td data-l={t.colQty}>{qtyUnit(i.qty, i.unit, lang)}</td>
                  <td data-l={t.colHpsUnit}>{rpFull(i.hps, lang)}</td>
                  <td data-l={t.colMarket}>{rpFull(i.market, lang)}</td>
                  <td data-l={t.colDev}>{pct(i.devPct, lang, true)}</td>
                  <td data-l={t.colGap}>{rpFull(i.overpay, lang)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t.total}</th>
                <td className="is-empty" />
                <td data-ab="memo-hps" data-l={t.hps}>{rpFull(model.table.hps, lang)}</td>
                <td data-ab="memo-market" data-l={t.colMarket}>{rpFull(model.table.market, lang)}</td>
                <td data-l={t.colDev}>{pct(model.table.devPct, lang, true)}</td>
                <td data-ab="memo-gap" data-l={t.colGap}>{rpFull(model.table.overpay, lang)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="dk-ab-memo-src">{t.sim} · seed {s.seed}</p>

          <h4>{t.memoFindings}</h4>
          {model.findings.length ? (
            <ol className="dk-ab-memo-list">
              {model.findings.map((f) => (
                <li key={f.detector}>
                  <b>{DETECTOR_BY_ID[f.detector].name[lang]}</b> ({t.levels[f.level]}): {noteText(f.note, lang)}.
                </li>
              ))}
            </ol>
          ) : (
            <p>{t.allPass}</p>
          )}

          <h4>{t.memoRecs}</h4>
          {recommended ? (
            <div ref={recsRef}>
              <ol className="dk-ab-memo-list">
                {model.recs.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="dk-ab-memo-ph">{busy ? t.memoWriting : '—'}</p>
          )}

          <p className="dk-ab-memo-close">{t.memoClose}</p>
          <div className="dk-ab-memo-sign">
            <p>{model.from}</p>
            <p className="dk-ab-memo-signed">{t.memoSign}</p>
          </div>
        </article>
      </PaperFrame>
    </div>
  )
}
