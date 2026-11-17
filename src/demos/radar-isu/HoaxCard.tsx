/**
 * demos/radar-isu/HoaxCard.tsx — "Peringatan Hoaks" (spec P4 "Kanan"): idle (trigger the 10:00 scenario), burst in
 * progress (n / 6 posts), detected (score, spread rate + small exponential chart, first fictional accounts, counter-
 * evidence from the Siaga Wilayah dam gauge) and clarified (recovery, "Lihat 30 menit ke depan"). Role decides the
 * actions: Humas drafts; the Regional Head instructs the Comms Office or reviews and approves the draft.
 */
import { memo, useMemo } from 'react'
import { Button, Score, Icon, LiveBadge, Chip } from '../../demo-kit/ui'
import { Sparkline } from '../../demo-kit/viz'
import { clockWib, compact } from '../../demo-kit/viz/format'
import type { RoleId } from '../../content/products'
import type { WaterGauge } from '../../demo-kit/world'
import { fill, useStr, CHANNEL_LABEL, type Channel } from './strings'
import type { HoaxPhase } from './model'

export interface HoaxCardProps {
  phase: HoaxPhase
  now: number
  role: RoleId
  damName: string
  gauge: WaterGauge | undefined
  /** sentiment index at the clarification and now (recovery line) */
  recovery: { before: number; after: number } | null
  bursting: boolean
  instructed: boolean
  onTrigger: () => void
  onClarify: (mode: 'draft' | 'approve') => void
  onInstruct: () => void
  onSkip: () => void
  /** open the gauge in Siaga Wilayah (cross-product jump) */
  onOpenSiaga: () => void
  /** compact idle card (phones: pinned on top) */
  compactIdle?: boolean
}

const nf = (n: number, lang: 'id' | 'en', d = 1) =>
  n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  })

function GaugeMeter({ g, lang, label }: { g: WaterGauge; lang: 'id' | 'en'; label: string }) {
  const max = g.awas * 1.08
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`
  return (
    <div className="dk-ri-gauge" role="img" aria-label={`${label}: ${nf(g.level, lang, 2)} m; siaga ${nf(g.siaga, lang)} m; awas ${nf(g.awas, lang)} m`}>
      <span className="dk-ri-gauge-fill" style={{ transform: `scaleX(${Math.min(1, g.level / max)})` }} aria-hidden="true" />
      <span className="dk-ri-gauge-mark is-siaga" style={{ left: pct(g.siaga) }} aria-hidden="true" />
      <span className="dk-ri-gauge-mark is-awas" style={{ left: pct(g.awas) }} aria-hidden="true" />
    </div>
  )
}

export const HoaxCard = memo(function HoaxCard(p: HoaxCardProps) {
  const { t, lang } = useStr()
  const { phase, role, damName, gauge } = p
  const head = role === 'kepala-daerah'

  const spread = useMemo(() => {
    if (phase.kind === 'idle') return [] as number[]
    let c = 0
    return phase.posts.map((m) => (c += m.reach))
  }, [phase])

  if (phase.kind === 'idle') {
    return (
      <section className={`dk-ri-hoax is-idle${p.compactIdle ? ' is-compact' : ''}`} aria-labelledby="dk-ri-hoax-h">
        <header className="dk-ri-hoax-h">
          <span className="dk-ri-hoax-ic" aria-hidden="true">
            <Icon name="shield" size={18} />
          </span>
          <h3 id="dk-ri-hoax-h" className="dk-ri-sec-t">
            {t.hoaxTitle}
          </h3>
        </header>
        <p className="dk-ri-hoax-title">{t.idleTitle}</p>
        {!p.compactIdle && <p className="dk-ri-hoax-body">{t.idleBody}</p>}
        <Button variant="primary" icon="zap" onClick={p.onTrigger} busy={p.bursting} className="dk-ri-hoax-cta">
          {p.compactIdle ? fill(t.triggerShort, { dam: damName }) : fill(t.trigger, { dam: damName })}
        </Button>
        <p className="dk-ri-hoax-note">
          <LiveBadge /> {t.idleAuto}
        </p>
      </section>
    )
  }

  if (phase.kind === 'burst') {
    const n = phase.posts.length
    const span = Math.max(1, (phase.posts[n - 1]?.at ?? 0) - (phase.posts[0]?.at ?? 0))
    return (
      <section className="dk-ri-hoax is-burst" aria-labelledby="dk-ri-hoax-h" aria-live="polite">
        <header className="dk-ri-hoax-h">
          <span className="dk-ri-hoax-ic is-warn" aria-hidden="true">
            <Icon name="pulse" size={18} />
          </span>
          <h3 id="dk-ri-hoax-h" className="dk-ri-sec-t">
            {t.burstTitle}
          </h3>
        </header>
        <p className="dk-ri-hoax-body">{fill(t.burstBody, { n, dam: damName, m: span, k: 6 })}</p>
        <div className="dk-ri-burst" role="progressbar" aria-valuemin={0} aria-valuemax={6} aria-valuenow={Math.min(6, n)} aria-label={t.burstTitle}>
          <span style={{ transform: `scaleX(${Math.min(1, n / 6)})` }} />
        </div>
        <p className="dk-ri-hoax-note">
          <Icon name="refresh" size={14} /> {t.burstLive}
        </p>
      </section>
    )
  }

  const a = phase.alert
  const clarified = phase.kind === 'clarified'
  const tone = a.clarification ? t[`tone_${a.clarification.tone}` as const] : ''
  const channels = a.clarification ? a.clarification.channels.map((c) => CHANNEL_LABEL[c as Channel]?.[lang] ?? c).join(', ') : ''
  const newSince = a.clarification ? phase.posts.filter((m) => m.at > a.clarification!.at).length : 0
  const pendingRecovery = !!a.clarification && p.now < a.clarification.at + 30

  return (
    <section className={`dk-ri-hoax ${clarified ? 'is-done' : 'is-active'}`} aria-labelledby="dk-ri-hoax-h" data-entity={a.id}>
      <header className="dk-ri-hoax-h">
        <span className={`dk-ri-hoax-ic ${clarified ? 'is-ok' : 'is-danger'}`} aria-hidden="true">
          <Icon name={clarified ? 'check' : 'alert'} size={18} />
        </span>
        <h3 id="dk-ri-hoax-h" className="dk-ri-sec-t">
          {clarified ? fill(t.clarified, { t: clockWib(a.clarification!.at, lang) }) : t.detected}
        </h3>
        <span className="dk-ri-hoax-at dk-num">{clockWib(a.at, lang)}</span>
      </header>
      <p className="dk-ri-hoax-claim">“{a.claim[lang]}”</p>
      {!clarified && (
        <p className="dk-ri-hoax-fwd">
          <Icon name="forward" size={14} /> {t.forwardedMp}
        </p>
      )}
      {clarified && (
        <p className="dk-ri-hoax-body">
          {fill(t.clarifiedTone, {
            tone: tone.charAt(0).toUpperCase() + tone.slice(1),
            ch: channels,
          })}
        </p>
      )}

      <div className="dk-ri-hoax-stats">
        <Score value={Math.round(a.score * 100)} label={t.score} higherIsBetter={false} warn={40} danger={70} size={60} />
        <div className="dk-ri-hoax-spread">
          <span className="dk-ri-k">{t.spread}</span>
          <span className="dk-ri-v dk-num">{compact(a.spreadPerHour, lang)}</span>
          <span className="dk-ri-k">{t.spreadUnit}</span>
          {spread.length > 1 && <Sparkline values={spread} label={t.spreadChart} area color="var(--dk-danger-ink)" height={30} />}
        </div>
      </div>

      {!clarified && (
        <div className="dk-ri-hoax-acc">
          <span className="dk-ri-k">{t.accounts}</span>
          <div className="dk-ri-chips">
            {a.accounts.map((x) => (
              <Chip key={x}>{x}</Chip>
            ))}
          </div>
          <span className="dk-ri-note">{t.accountsNote}</span>
        </div>
      )}

      {gauge && (
        <div className="dk-ri-evid">
          <p className="dk-ri-evid-h">
            <Icon name="water" size={14} /> {t.evidence} · <span>{fill(t.evidenceSrc, { dam: damName })}</span>
          </p>
          <p className="dk-ri-evid-t">
            {fill(t.evidenceText, {
              dam: damName,
              level: nf(gauge.level, lang),
              siaga: nf(gauge.siaga, lang),
            })}
          </p>
          <div className="dk-ri-evid-row">
            <span className="dk-ri-v dk-num">{nf(gauge.level, lang, 2)} m</span>
            <span className="dk-ri-k">
              {t.gaugeSiaga} {nf(gauge.siaga, lang)} m
            </span>
          </div>
          <GaugeMeter g={gauge} lang={lang} label={t.gaugeNow} />
          <Sparkline values={gauge.history} label={t.gaugeChart} color="var(--dk-viz-acc)" height={26} format={(v) => `${nf(v, lang, 2)} m`} />
          <Button size="sm" variant="ghost" iconEnd="external" onClick={p.onOpenSiaga} className="dk-ri-evid-link">
            {t.openSiaga}
          </Button>
        </div>
      )}

      {clarified ? (
        <div className="dk-ri-recov">
          <p className="dk-ri-k">{t.recovery}</p>
          <p className="dk-ri-hoax-body">
            {p.recovery && !pendingRecovery
              ? fill(t.recoveryDone, {
                  a: `${p.recovery.before > 0 ? '+' : ''}${p.recovery.before}`,
                  b: `${p.recovery.after > 0 ? '+' : ''}${p.recovery.after}`,
                })
              : t.recoveryBody}
          </p>
          <p className="dk-ri-note">{fill(t.hoaxVolume, { n: newSince })}</p>
          {pendingRecovery && (
            <Button variant="secondary" icon="forward" onClick={p.onSkip}>
              {t.skip30}
            </Button>
          )}
        </div>
      ) : head ? (
        <div className="dk-ri-hoax-act">
          <Button variant="primary" icon="stamp" onClick={() => p.onClarify('approve')}>
            {t.review}
          </Button>
          <Button variant="secondary" icon="send" onClick={p.onInstruct} disabled={p.instructed}>
            {p.instructed ? t.instructed : t.instruct}
          </Button>
        </div>
      ) : (
        <div className="dk-ri-hoax-act">
          <Button variant="primary" icon="spark" onClick={() => p.onClarify('draft')}>
            {t.clarify}
          </Button>
        </div>
      )}
    </section>
  )
})
