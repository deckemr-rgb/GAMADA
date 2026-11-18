/** shell/context.ts — what a product canvas can ask its DemoShell for (useShell()). */
import { createContext, useContext } from 'react'
import type { ProductDef } from '../../content/products'
import type { RegionPack } from '../region/types'
import type { ToastData, ToastPlacement } from '../ui'
import type { ShellSize } from './hooks'
import type { DemoQuery } from './url'

export interface ShellApi {
  product: ProductDef
  /** the region pack in use (null while booting) */
  pack: RegionPack | null
  /** ?focus=<entityId> the shell was opened with (e.g. from a cross-product toast); null once cleared */
  focus: string | null
  clearFocus: () => void
  /** tick a UI-only mission of this product */
  markMission: (id: string) => void
  guideOpen: boolean
  setGuideOpen: (open: boolean) => void
  openPalette: () => void
  /**
   * where the shell's toast stack sits for this demo: one placement, or { wide, sm } by shell size; null = the
   * DemoShell prop / kit default (bottom-left). Below 768 px the stack moves to the top while a sheet is open.
   */
  setToastPlacement: (p: ToastPlacementSpec | null) => void
  /** push a toast into the shell's stack (bottom-left by default, max 3) */
  toast: (t: Omit<ToastData, 'id'> & { id?: string }) => void
  /** presenter mode (?present=1) */
  present: boolean
  /** layout size of the shell (from its own width): 'sm' = phone layout */
  size: ShellSize
  /** the validated demo params the page was opened with (?role ?t ?ai …), before the shell rewrote the URL —
   *  e.g. the time a shared link asked for. Empty for a shell opened without params. */
  link: Readonly<DemoQuery>
  /** the shell runs `interim` (tahap-1 placeholder canvas): no role / clock / AI / reset controls in the bar */
  interim: boolean
}

/** a toast placement, or one per shell size (sm = phone layout, wide = everything else) */
export type ToastPlacementSpec = ToastPlacement | { wide: ToastPlacement; sm: ToastPlacement }

export const ShellContext = createContext<ShellApi | null>(null)

/** Access the surrounding DemoShell. Throws outside one. */
export function useShell(): ShellApi {
  const v = useContext(ShellContext)
  if (!v) throw new Error('useShell() outside <DemoShell>')
  return v
}

/** Same, but null outside a DemoShell (components that also render standalone, e.g. /produk mini-demos). */
export function useShellOptional(): ShellApi | null {
  return useContext(ShellContext)
}
