/** shell/context.ts — what a product canvas can ask its DemoShell for (useShell()). */
import { createContext, useContext } from 'react'
import type { ProductDef } from '../../content/products'
import type { RegionPack } from '../region/types'
import type { ToastData } from '../ui'
import type { ShellSize } from './hooks'

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
  /** push a toast into the shell's stack (bottom-left, max 3) */
  toast: (t: Omit<ToastData, 'id'> & { id?: string }) => void
  /** presenter mode (?present=1) */
  present: boolean
  /** layout size of the shell (from its own width): 'sm' = phone layout */
  size: ShellSize
}

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
