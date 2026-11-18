/**
 * shell/GuidePanel.tsx — "Coba ini" (spec §6.3): a NON-modal right drawer (the visitor keeps using the demo
 * while the checklist ticks itself). Desktop: a column beside the canvas. < 768 px: a bottom sheet over the
 * canvas. Esc closes it when focus is inside; closing with focus inside returns focus to the "?" toggle
 * (aria-controls = id), or to the "⋯" button on mobile where the toggle lives in the sheet. Completion → Confetti (≤ 1 s) + sfx.success + a card linking
 * to a related product (products.ts `related`).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS, PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import { DEMO_READY } from '../../demos/registry'
import { useI18n } from '../../lib/i18n'
import { sfx } from '../../lib/audio'
import AppLink from '../../components/AppLink'
import { Button, Confetti, Icon, IconButton, enterPanel, motionMode, overlayOpen } from '../ui'
import { useSession } from '../world'
import { useDemoStrings } from '../i18n'
import { resetMissions, useMissionProgress, useMissionTracker, type Mission } from './missions'
import { demoHref } from './url'
import type { ShellSize } from './hooks'

export interface GuidePanelProps {
  product: ProductSlug
  missions: readonly Mission[]
  open: boolean
  onClose: () => void
  /** id of the panel (the "?" button's aria-controls) */
  id?: string
  /** the shell's layout size: on 'sm' (phone) a mission's `hintSm` replaces its `hint` (bar controls live in "⋯") */
  size?: ShellSize
}

export function GuidePanel({ product, missions: all, open, onClose, id, size }: GuidePanelProps) {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const session = useSession()
  const done = useMissionProgress(product)
  useMissionTracker(product, all)
  // phones hide missions whose feature is not offered there (Mission.hideSm)
  const missions = useMemo(() => (size === 'sm' ? all.filter((m) => !m.hideSm) : all), [all, size])
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

  // focus return: remember whether focus was inside when closing, then hand it to the toggle once hidden
  const returnFocus = useRef(false)
  const close = () => {
    returnFocus.current = !!panel.current?.contains(document.activeElement)
    onClose()
  }
  useLayoutEffect(() => {
    if (open) return
    const p = panel.current
    const inside = returnFocus.current || (!!p && p.contains(document.activeElement))
    returnFocus.current = false
    if (!inside || !p) return
    const scope: ParentNode = p.closest('.dk-shell') ?? document
    const toggle = id ? scope.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(id)}"]`) : null
    const target = toggle && toggle.getClientRects().length > 0 ? toggle : scope.querySelector<HTMLElement>('[data-dk-more]')
    target?.focus()
  }, [open, id])

  // phones: the guide is a bottom sheet over the canvas, so Esc closes it wherever focus is (unless a dialog above it
  // takes the key), and a downward swipe on its header closes it too
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open || size !== 'sm') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || overlayOpen()) return
      closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, size])
  // phones: a tap outside the sheet folds it (the tap itself still reaches what it hit, so tapping "Putar" or a
  // mission target starts the product's animation with the sheet out of the way). Not while a dialog sits above it,
  // and not on the bar that toggles it (that bar handles the tap itself).
  useEffect(() => {
    if (!open || size !== 'sm') return
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null
      if (!el || panel.current?.contains(el) || overlayOpen()) return
      if (id && el.closest(`[aria-controls="${CSS.escape(id)}"]`)) return
      if (el.closest('.dk-toast, [data-dk-more], [role="dialog"]')) return
      closeRef.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open, size, id])
  // a step that names its target (Mission.target): tapping it goes there (on phones the sheet folds first)
  const goTo = (target: string) => {
    const scope: ParentNode = panel.current?.closest('.dk-shell') ?? document
    const el = [...scope.querySelectorAll<HTMLElement>(target)].find((x) => x.getClientRects().length > 0)
    if (!el) return
    if (size === 'sm') onClose()
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
      el.focus({ preventScroll: true })
    })
  }
  const swipe = useRef<{ y: number; id: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !panel.current) return
    const tw = enterPanel(panel.current, { x: 16 })
    return () => {
      tw?.kill()
    }
  }, [open])

  // only products whose sandbox is open to visitors; top up from the same ecosystem when a related one is not built yet
  const related = useMemo(() => {
    const own = PRODUCT_BY_SLUG[product]
    const pick = own.related.filter((s) => s !== product && DEMO_READY[s])
    for (const p of PRODUCTS) if (pick.length < 2 && p.slug !== product && p.eco === own.eco && DEMO_READY[p.slug] && !pick.includes(p.slug)) pick.push(p.slug)
    return pick.slice(0, 2).map((s) => PRODUCT_BY_SLUG[s])
  }, [product])

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
            close()
          }
        }}
      >
        <header
          className="dk-guide-head"
          onPointerDown={(e) => {
            if (size === 'sm' && e.pointerType !== 'mouse') swipe.current = { y: e.clientY, id: e.pointerId }
          }}
          onPointerUp={(e) => {
            const s0 = swipe.current
            swipe.current = null
            if (s0 && s0.id === e.pointerId && e.clientY - s0.y > 48) close()
          }}
          onPointerCancel={() => (swipe.current = null)}
        >
          <div>
            <p className="dk-guide-eyebrow">{t.guide}</p>
            <h2 id={`${id ?? 'dk-guide'}-t`} className="dk-guide-title">
              {t.tryThis}
            </h2>
          </div>
          <IconButton icon="close" label={t.guideClose} onClick={close} />
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
            const hint = size === 'sm' ? (m.hintSm ?? m.hint) : m.hint
            const body = (
              <>
                <span className="dk-guide-check" aria-hidden="true">
                  {ok ? <Icon name="check" size={14} strokeWidth={2} /> : <span className="dk-num">{i + 1}</span>}
                </span>
                <span className="dk-guide-text">
                  <span className="dk-guide-label">{m.label[lang]}</span>
                  {hint && !ok && <span className="dk-guide-hint">{hint[lang]}</span>}
                  <span className="dk-sr">, {ok ? t.missionDone : isNext ? t.missionNext : t.missionTodo}</span>
                </span>
              </>
            )
            const target = !ok ? m.target : undefined
            return (
              <li key={m.id} className={`dk-guide-step${ok ? ' is-done' : ''}${isNext ? ' is-next' : ''}${target ? ' has-target' : ''}`}>
                {target ? (
                  <button type="button" className="dk-guide-go" onClick={() => goTo(target)}>
                    {body}
                  </button>
                ) : (
                  body
                )}
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
