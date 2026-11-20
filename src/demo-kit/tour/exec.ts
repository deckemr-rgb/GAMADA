/**
 * tour/exec.ts — DOM step executors on the stage: find a hook (waits ≤ 3 s real time), click it, type into it with
 * the native value setter (React sees real input events). Nothing here moves keyboard focus: the spotlight is
 * visual only, a synthetic click never focuses, and the typed field gets its value without .focus().
 */
import { gsap } from 'gsap'

/** real-time delay on the gsap ticker (no setInterval, no second RAF) */
export const realDelay = (ms: number): Promise<void> =>
  new Promise((r) => {
    gsap.delayedCall(ms / 1000, r)
  })

let stageRoot: HTMLElement | null = null
export const setStageRoot = (el: HTMLElement | null): void => {
  stageRoot = el
}
export const getStageRoot = (): HTMLElement | null => stageRoot
export const inStage = (el: Element): boolean => !!stageRoot?.contains(el)
/** the stage runs the product's phone layout (its shell measured itself 'sm') */
export const stageIsPhone = (): boolean => (stageRoot?.getBoundingClientRect().width ?? 1000) < 640

const visible = (el: Element): boolean => {
  const r = el.getBoundingClientRect()
  return r.width > 0 || r.height > 0
}

/** the first visible match inside the stage (≤ timeout ms); null when missing */
export async function findHook(sel: string, timeout = 3000, alive: () => boolean = () => true): Promise<HTMLElement | null> {
  const t0 = performance.now()
  for (;;) {
    if (!alive()) return null
    const all = stageRoot ? Array.from(stageRoot.querySelectorAll<HTMLElement>(sel)) : []
    // a product's dialogs render in a portal (outside the stage): look there too, never in the tour frame
    const portal = Array.from(document.querySelectorAll<HTMLElement>(`[role="dialog"] ${sel}`)).filter((e) => !e.closest('.dk-tour-drawer'))
    const el = all.find(visible) ?? portal.find(visible) ?? null
    if (el) return el
    if (performance.now() - t0 > timeout) return null
    await realDelay(100)
  }
}

const scrolls = (p: HTMLElement, axis: 'x' | 'y'): boolean => {
  if (axis === 'y' ? p.scrollHeight <= p.clientHeight + 1 : p.scrollWidth <= p.clientWidth + 1) return false
  const o = getComputedStyle(p)[axis === 'y' ? 'overflowY' : 'overflowX']
  return o === 'auto' || o === 'scroll'
}

/**
 * Scroll the hook into the stage's view without moving focus, as little as possible (Tahap 8): only real scrollers
 * inside the stage move (scrollIntoView also shifted the overflow:hidden stage frame), and a scroller goes back to its
 * top whenever the hook fits there, so the product's own header stays on screen. Rects are visual px (the stage box
 * may be zoomed), scroll offsets are the scroller's own CSS px: k converts.
 */
export function reveal(el: HTMLElement): void {
  const root = stageRoot
  if (!root || !root.contains(el)) {
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    } catch {
      /* old engines */
    }
    return
  }
  for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
    const y = scrolls(p, 'y')
    const x = scrolls(p, 'x')
    if (!y && !x) continue
    const c = p.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const k = c.height > 0 ? p.offsetHeight / c.height : 1
    if (y) {
      const view = p.clientHeight
      const top = (r.top - c.top) * k + p.scrollTop
      const h = Math.min(r.height * k, view)
      // the hook's top part (≤ 60 % of the view) already shows with the scroller at its top: keep the top (header)
      const want = top + Math.min(h, view * 0.6) <= view - 8 ? 0 : top >= p.scrollTop + 8 && top + h <= p.scrollTop + view - 8 ? p.scrollTop : Math.max(0, Math.min(top - 12, top + h - view + 12))
      if (want !== p.scrollTop) p.scrollTop = want
    }
    if (x) {
      const left = (r.left - c.left) * k
      const w = r.width * k
      if (left < 0) p.scrollLeft += left - 8
      else if (left + w > p.clientWidth) p.scrollLeft += Math.min(left - 8, left + w - p.clientWidth + 8)
    }
  }
}

/**
 * Chapter start (Tahap 8): the product header shows. The stage frame never stays scrolled, and the product canvas goes
 * back to its top when the product's own ?focus= arrival only nudged it (≤ 35 % of its height: the focused row stays
 * in view); a deep focus keeps its scroll.
 */
export function settleStage(): void {
  const root = stageRoot
  if (!root) return
  for (const f of [root, root.querySelector<HTMLElement>('.dk-tour-zoom'), root.querySelector<HTMLElement>('.dk-shell')]) if (f && f.scrollTop) f.scrollTop = 0
  const canvas = root.querySelector<HTMLElement>('.dk-shell-canvas')
  if (canvas && canvas.scrollTop > 0 && canvas.scrollTop <= canvas.clientHeight * 0.35) canvas.scrollTop = 0
}

const target = (el: HTMLElement): HTMLElement => (el.matches('button, a, input, [role="button"], [role="tab"], [role="radio"], label') ? el : (el.querySelector<HTMLElement>('button, [role="button"], [role="radio"], input') ?? el))
export const isDisabled = (el: HTMLElement): boolean => {
  const b = target(el)
  return !!(b as HTMLButtonElement).disabled || b.getAttribute('aria-disabled') === 'true'
}

/** a synthetic click (HTMLElement.click(): no pointerdown, so the "visitor touched the stage" pause stays off) */
export function clickHook(el: HTMLElement): boolean {
  const btn = target(el)
  if (isDisabled(el)) return false
  btn.click()
  return true
}

/** set a text field's value through the native setter, char by char, so React's onChange runs */
export function setFieldValue(el: HTMLElement, value: string): void {
  const input = (el.matches('input, textarea') ? el : el.querySelector('input, textarea')) as HTMLInputElement | HTMLTextAreaElement | null
  if (!input) return
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
