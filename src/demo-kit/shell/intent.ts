/**
 * shell/intent.ts — preload on intent: start a lazy chunk's download on the first sign that the visitor is about to
 * use it (pointer over it, keyboard focus on it, the press itself on touch screens), never as a side effect of
 * opening a demo. Code fetched this way is not part of a demo's first load (size limit ≤ 180 KB, CONTRACTS.md) and
 * still arrives before the click in practice (hover → click is ~200–400 ms; pointerdown → click ~100 ms).
 *
 *   const Letters = lazy(loadLetters)
 *   <Tab {...intentProps(loadLetters)}>Surat Masuk</Tab>                     // props form (spread on the element)
 *   const ref = usePreloadOnIntent<HTMLButtonElement>(loadVoice)            // ref form
 *   useEffect(() => preloadOnIntent(el, loadBulk), [el])                    // imperative form (returns a cleanup)
 *
 * Each loader runs at most once (later intents and the real click reuse its promise); a rejected download is
 * swallowed here, so the real use retries it and reports the error.
 */
import { useCallback, useRef } from 'react'

type Loader = () => unknown

const started = new WeakSet<Loader>()

/** Run `load` once (per loader function). Safe to call from any event handler. */
export function preloadNow(load: Loader): void {
  if (started.has(load)) return
  started.add(load)
  try {
    const p = load()
    if (p && typeof (p as Promise<unknown>).then === 'function')
      (p as Promise<unknown>).then(undefined, () => {
        // let the real use try again
        started.delete(load)
      })
  } catch {
    started.delete(load)
  }
}

const EVENTS = ['pointerenter', 'focusin', 'pointerdown', 'touchstart'] as const

/**
 * Attach intent listeners to `target`: the first pointerenter / focusin / pointerdown / touchstart runs `load` once
 * and detaches. Returns a cleanup that detaches without loading (use it as an effect's cleanup).
 */
export function preloadOnIntent(target: Element | null | undefined, load: Loader): () => void {
  if (!target) return () => {}
  const off = () => {
    for (const t of EVENTS) target.removeEventListener(t, go)
  }
  function go() {
    off()
    preloadNow(load)
  }
  for (const t of EVENTS) target.addEventListener(t, go, { passive: true })
  return off
}

/**
 * Props to spread on the element that opens the lazy part. React handlers: they compose with the element's own
 * onClick etc. (pass yours after the spread when you need the same event).
 */
export function intentProps(load: Loader): {
  onPointerEnter: () => void
  onFocus: () => void
  onPointerDown: () => void
  onTouchStart: () => void
} {
  const go = () => preloadNow(load)
  return { onPointerEnter: go, onFocus: go, onPointerDown: go, onTouchStart: go }
}

/** Ref callback form: `<button ref={usePreloadOnIntent(loadX)}>` (the latest `load` is used). */
export function usePreloadOnIntent<T extends Element>(load: Loader): (el: T | null) => void {
  const loadRef = useRef(load)
  loadRef.current = load
  const off = useRef<(() => void) | null>(null)
  // one stable loader per hook instance, so preloadNow's once-per-loader holds across renders
  const stable = useRef<Loader>(() => loadRef.current())
  return useCallback((el: T | null) => {
    off.current?.()
    off.current = el ? preloadOnIntent(el, stable.current) : null
  }, [])
}
