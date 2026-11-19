/**
 * Skel — the Sinyal Pasar skeleton with the final layout boxes ("Menyiapkan data pasar…", plan §0.4).
 */
import { BrowserFrame } from '../../demo-kit/frames'
import { Skeleton } from '../../demo-kit/ui'
import { usePdStrings } from '../../demo-kit/i18n/pd'

/** the final layout boxes with "Menyiapkan data pasar…" (plan §0.4) */
export function SpSkeleton({ umkm, msg }: { umkm?: boolean; msg?: string }) {
  const p = usePdStrings()
  if (umkm)
    return (
      <div className="dk-sp-umkm" aria-busy="true">
        <p className="dk-sr" role="status">{msg ?? p.pdLoading}</p>
        <div className="dk-sp-umkm-grid">
          <Skeleton height={560} radius={28} />
          <Skeleton height={320} radius={12} />
        </div>
      </div>
    )
  return (
    <BrowserFrame slug="sinyal-pasar" label="Sinyal Pasar">
      <div className="dk-sp" aria-busy="true">
        <p className="dk-sr" role="status">{p.pdLoading}</p>
        <Skeleton height={44} />
        <Skeleton height={40} />
        <div className="dk-sp-kpis">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={92} />)}</div>
        <div className="dk-sp-main">
          <Skeleton height={420} radius={12} />
          <Skeleton height={420} radius={12} />
        </div>
      </div>
    </BrowserFrame>
  )
}
