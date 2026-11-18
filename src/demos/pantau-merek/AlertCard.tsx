/**
 * demos/pantau-merek/AlertCard.tsx — the alert slot. Before the spike: an honest pre-signal card (the overnight
 * delivery complaints, below the rule) with "Lompat ke lonjakan". Once the stored `brandAlerts` row is visible
 * (at ≤ now): the red alert (volume, +x %, crossing minute, cause) with "Kelompokkan & tangani" and "Balas keluhan".
 * After the notice: "Ditangani HH.MM". Every number is the alert row's own (= audit row = Toko Autopilot chip).
 */
import { memo, useState } from 'react'
import { Button, IconButton } from '../../demo-kit/ui'
import { Sparkline } from '../../demo-kit/viz'
import type { BrandAlert, BrandAnnouncement } from '../../demo-kit/world'
import { intentProps } from '../../demo-kit/shell'
import { loadCluster } from './loaders'
import { fill, nf, tm, type Lang, type Strings } from './strings'

export interface PreSignal { count: number; rule: number; baseline: number; hourly: number[] }

export const AlertCard = memo(function AlertCard(props: {
  alert: BrandAlert | null
  ann: BrandAnnouncement | null
  pre: PreSignal
  t: Strings
  lang: Lang
  compact: boolean
  flash: number
  onJump: () => void
  onHandle: (alertId: string, view?: 'cluster' | 'announce' | 'published') => void
  onReplies: () => void
}) {
  const { alert, ann, pre, t, lang, compact, flash, onJump, onHandle, onReplies } = props
  const [folded, setFolded] = useState(false)
  if (!alert) {
    return (
      <section className="dk-pm-card dk-pm-alert is-pre" aria-labelledby="dk-pm-alert-h" data-pm="pre-signal">
        <header className="dk-pm-alert-h">
          <h3 id="dk-pm-alert-h" className="dk-pm-sec-t">
            {t.preTitle}
          </h3>
        </header>
        <p className="dk-pm-alert-body">{fill(t.preBody, { n: pre.count })}</p>
        <div className="dk-pm-pre-spark">
          <Sparkline values={pre.hourly} label={t.spark} height={30} color="var(--dk-warn)" area />
        </div>
        <p className="dk-pm-note">{fill(t.preRule, { r: pre.rule, b: nf(pre.baseline, lang) })}</p>
        <Button variant="primary" icon="forward" onClick={onJump} data-pm="jump-spike" data-hotspot="pm-jump" data-hotspot-label={t.jumpHot}>
          {t.jump}
        </Button>
      </section>
    )
  }
  const handled = alert.status === 'ditangani'
  return (
    <section
      key={`${alert.id}${handled ? 'h' : 'a'}`}
      className={`dk-pm-card dk-pm-alert ${handled ? 'is-done' : 'is-active'}${folded && compact ? ' is-folded' : ''}${flash ? ' is-arrived' : ''}`}
      aria-labelledby="dk-pm-alert-h"
      data-pm="alert"
      data-id={alert.id}
    >
      <header className="dk-pm-alert-h">
        <h3 id="dk-pm-alert-h" className="dk-pm-sec-t">
          {handled ? fill(t.handled, { t: tm(ann?.at ?? alert.at, lang) }) : t.alertTitle}
        </h3>
        {compact && (
          <IconButton size="sm" variant="quiet" icon={folded ? 'chevronDown' : 'chevronUp'} label={folded ? t.expand : t.collapse} aria-expanded={!folded} onClick={() => setFolded((f) => !f)} />
        )}
      </header>
      <p className="dk-pm-alert-meta dk-num" data-pm="alert-meta">
        {fill(t.alertMeta, { t: tm(alert.at, lang), v: alert.volume, p: nf(alert.deltaPct, lang) })}
      </p>
      {!(folded && compact) && (
        <>
          {alert.cause && <p className="dk-pm-alert-body">{alert.cause[lang]}</p>}
          {handled && ann && <p className="dk-pm-note">{fill(t.handledBody, { n: ann.channels.length })}</p>}
          <div className="dk-pm-alert-act">
            {handled ? (
              <Button variant="secondary" icon="doc" onClick={() => onHandle(alert.id, 'published')} data-pm="show-ann">
                {t.showAnn}
              </Button>
            ) : (
              <Button
                variant="primary"
                icon="layers"
                onClick={() => onHandle(alert.id)}
                data-pm="cluster"
                data-hotspot="pm-handle"
                data-hotspot-label={t.handleHot}
                {...intentProps(loadCluster)}
              >
                {t.handle}
              </Button>
            )}
            <Button variant="ghost" icon="chat" onClick={onReplies} data-pm="to-reviews">
              {t.replyNow}
            </Button>
          </div>
        </>
      )}
    </section>
  )
})
