/**
 * shell/GuidePanel.tsx — "Coba ini" (spec §6.3): a NON-modal right drawer (the visitor keeps using the demo
 * while the checklist ticks itself). Desktop: a column beside the canvas. < 768 px: a bottom sheet over the
 * canvas. Esc closes it when focus is inside. Completion → Confetti (≤ 1 s) + sfx.success + a card linking
 * to a related product (products.ts `related`).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import { useI18n } from '../../lib/i18n'
import { sfx } from '../../lib/audio'
import AppLink from '../../components/AppLink'
import { Button, Confetti, Icon, IconButton, enterPanel } from '../ui'
import { useSession } from '../world'
import { useDemoStrings } from '../i18n'
import { resetMissions, useMissionProgress, useMissionTracker, type Mission } from './missions'
import { demoHref } from './url'

export interface GuidePanelProps {
  product: ProductSlug
  missions: readonly Mission[]
  open: boolean
  onClose: () => void
  /** id of the panel (the "?" button's aria-controls) */
  id?: string
}

export function GuidePanel({ product, missions, open, onClose, id }: GuidePanelProps) {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const session = useSession()
  const done = useMissionProgress(product)
  useMissionTracker(product, missions)
  const panel = useRef<HTMLElement>(null)
  const total = missions.length
  const count = missions.filter((m) => done.includes(m.id)).length
  const complete = total > 0 && count === total
  const next = missions.find((m) => !done.includes(m.id))
  const [burst, setBurst] = useState(0)
  const [announce, setAnnounce] = useState('')
  const prev = useRef<{ done: readonly string[]; complete: boolean } | null>(null)

  // celebrate transitions only (not progress restored from storage)
  useEffect(() => {
    const p = prev.current
    prev.current = { done, complete }
    if (!p) return
    const fresh = missions.filter((m) => done.includes(m.id) && !p.done.includes(m.id))
    if (fresh[0]) setAnnounce(t.missionTicked(fresh[0].label[lang]))
    if (complete && !p.complete) {
      setBurst((b) => b + 1)
      sfx.success()
    } else if (fresh.length) sfx.click()
  }, [done, complete, missions, lang, t])

  useLayoutEffect(() => {
    if (!open || !panel.current) return
    const tw = enterPanel(panel.current, { x: 16 })
    return () => {
      tw?.kill()
    }
  }, [open])

  const related = PRODUCT_BY_SLUG[product].related.slice(0, 2).map((s) => PRODUCT_BY_SLUG[s])

  return (
    <>
      <aside
        ref={panel}
        id={id}
        className="dk-guide"
        hidden={!open}
        aria-labelledby={`${id ?? 'dk-guide'}-t`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <header className="dk-guide-head">
          <div>
            <p className="dk-guide-eyebrow">{t.guide}</p>
            <h2 id={`${id ?? 'dk-guide'}-t`} className="dk-guide-title">
              {t.tryThis}
            </h2>
          </div>
          <IconButton icon="close" label={t.guideClose} onClick={onClose} />
        </header>
        <p className="dk-guide-intro">{t.guideIntro}</p>
        <div className="dk-guide-progress">
          <span className="dk-guide-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${total ? count / total : 0})` }} />
          </span>
          <span className="dk-guide-count dk-num">{t.progress(count, total)}</span>
        </div>
        <ol className="dk-guide-list">
          {missions.map((m, i) => {
            const ok = done.includes(m.id)
            const isNext = next?.id === m.id
            return (
              <li key={m.id} className={`dk-guide-step${ok ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}>
                <span className="dk-guide-check" aria-hidden="true">
                  {ok ? <Icon name="check" size={14} strokeWidth={2} /> : <span className="dk-num">{i + 1}</span>}
                </span>
                <span className="dk-guide-text">
                  <span className="dk-guide-label">{m.label[lang]}</span>
                  {m.hint && !ok && <span className="dk-guide-hint">{m.hint[lang]}</span>}
                  <span className="dk-sr">, {ok ? t.missionDone : isNext ? t.missionNext : t.missionTodo}</span>
                </span>
              </li>
            )
          })}
        </ol>
        {complete && (
          <div className="dk-guide-done">
            <Confetti fire={burst || null} />
            <p className="dk-guide-done-title">
              <Icon name="checkCircle" size={18} /> {t.allDone}
            </p>
            <p className="dk-guide-done-body">{t.allDoneBody}</p>
            {related.map((r) => (
              <AppLink key={r.slug} to={demoHref(r.slug, session)} className="dk-guide-next" data-eco={r.eco}>
                <span className="dk-guide-next-dot" aria-hidden="true" />
                <span className="dk-guide-next-text">
                  <span className="dk-guide-next-k">{t.nextProduct} →</span>
                  <span className="dk-guide-next-name">{r.name}</span>
                  <span className="dk-guide-next-desc">{r.descriptor[lang]}</span>
                </span>
              </AppLink>
            ))}
            <Button size="sm" variant="ghost" icon="replay" onClick={() => resetMissions(product)}>
              {t.restartMissions}
            </Button>
          </div>
        )}
      </aside>
      {/* outside the aside so ticks are announced while the guide is closed too */}
      <p className="dk-sr" aria-live="polite">
        {announce}
      </p>
    </>
  )
}
