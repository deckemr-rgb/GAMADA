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

/** scroll the hook into the stage's view without moving focus */
export function reveal(el: HTMLElement): void {
  try {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  } catch {
    /* old engines */
  }
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
