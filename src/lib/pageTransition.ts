/**
 * pageTransition.ts — tiny bridge between links (AppLink) and the mist curtain (PageCurtain).
 * cover() resolves once the old page is hidden; RootLayout calls reveal() after the new route
 * has rendered and scrolled. Without a registered curtain (flag off / reduced motion) both are no-ops.
 */

export interface CurtainApi {
  cover: () => Promise<void>
  reveal: () => void
}

let curtain: CurtainApi | null = null

export function registerCurtain(api: CurtainApi): () => void {
  curtain = api
  return () => {
    if (curtain === api) curtain = null
  }
}

export function coverPage(): Promise<void> {
  return curtain ? curtain.cover() : Promise.resolve()
}

export function revealPage(): void {
  curtain?.reveal()
}
