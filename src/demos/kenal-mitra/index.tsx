/**
 * kenal-mitra — Tahap 3 STUB (kit agent): renders the Usaha Pintar skeleton until the ecosystem's world data is in, then a
 * plain status line. The product builder replaces this file (plan docs/build/tahap3-plan.md §2).
 */
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { useEcosystemReady } from '../../demo-kit/world'
import { useDemoStrings } from '../../demo-kit/i18n'
import { Skeleton } from '../../demo-kit/ui'

export default function Canvas({ product }: DemoCanvasProps) {
  const ready = useEcosystemReady('usaha-pintar')
  const t = useDemoStrings()
  return (
    <div className="dk-root" data-eco="usaha-pintar" data-stub={product} aria-busy={!ready}>
      <p>{ready ? t.simChip : t.upLoading}</p>
      {!ready && <Skeleton lines={4} />}
    </div>
  )
}

export const missions: readonly Mission[] = []
