/** demos/toko-autopilot/types.ts — props every tab receives (types only) */
import type { OutKey, TabId } from './strings'

/** what a ?focus= (or an in-product link) selects inside a tab; `n` re-triggers the arrival flash */
export interface Sel { kind: 'product' | 'po' | 'sale' | 'staff' | 'notice' | 'flood'; id: string; n: number }
export interface TabProps { outletId: string; outKey: OutKey; sel: Sel | null; go: (tab: TabId, sel?: Omit<Sel, 'n'> | null, out?: OutKey) => void; role: string }
