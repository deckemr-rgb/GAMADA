/**
 * shell/EventToasts.tsx — the bottom-left stack (max 3, aria-live polite, spec §6.3 + §8.5):
 *   - cross-product effects of THIS product's events (effects.ts): "Aduan #SW-2026-0142 diteruskan ke
 *     Meja Pimpinan" → click opens /demo/<target>?focus=<entity> (region / seed / language preserved);
 *   - the AI live → simulation fallback notice ("AI Live sedang sibuk, beralih ke Simulasi");
 *   - anything the product pushes through useShell().toast().
 */
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { ProductSlug } from '../../content/products'
import { useI18n } from '../../lib/i18n'
import { sfx } from '../../lib/audio'
import { goTo } from '../../components/AppLink'
import { Toast, ToastRegion, type ToastData } from '../ui'
import { LIVE_FALLBACK_NOTICE, onLiveFallback } from '../ai/live-base' // not the barrel: see controls.tsx
import { getSession, onEvent, setSession, world } from '../world'
import { useDemoStrings } from '../i18n'
import { createEffectTracker } from './effects'
import { demoHref } from './url'

export interface EventToastStackProps {
  product: ProductSlug
  toasts: ToastData[]
  push: (t: Omit<ToastData, 'id'> & { id?: string }) => string
  dismiss: (id: string) => void
  /** bumps on world reset so chains from the old world are forgotten */
  epoch?: number
}

export function EventToastStack({ product, toasts, push, dismiss, epoch = 0 }: EventToastStackProps) {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const ctx = useRef({ lang, navigate, pathname })
  ctx.current = { lang, navigate, pathname }

  // cross-product effects
  useEffect(() => {
    const tracker = createEffectTracker(product)
    return onEvent('*', (e) => {
      const fx = tracker.feed(e, world.get())
      if (!fx) return
      const { lang: l } = ctx.current
      sfx.notify()
      push({
        id: `fx:${fx.key}`,
        tone: 'accent',
        icon: 'share',
        title: fx.title[l],
        body: fx.body[l],
        onActivate: () => {
          dismiss(`fx:${fx.key}`)
          void goTo(demoHref(fx.target, getSession(), fx.focus), ctx.current.navigate, ctx.current.pathname)
        },
      })
    })
  }, [product, push, dismiss, epoch])

  // AI live → simulation fallback
  useEffect(
    () =>
      onLiveFallback(() => {
        const l = ctx.current.lang
        setSession({ aiMode: 'sim' })
        push({
          id: 'ai-fallback',
          tone: 'warn',
          icon: 'alert',
          title: LIVE_FALLBACK_NOTICE[l],
        })
      }),
    [push],
  )

  return (
    <ToastRegion label={t.toasts} placement="bottom-left">
      {toasts.map((d) => (
        <Toast key={d.id} data={d} onDismiss={dismiss} />
      ))}
    </ToastRegion>
  )
}
