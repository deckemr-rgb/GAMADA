/**
 * LabArt — the art box at the top of a /lab card (plan §2.4). Static icon art by default (and always on touch);
 * once the card has been hovered / focused for ECO_SITE.mini.previewDelayMs the product's mini-demo is loaded through
 * MINIS (useMini) and plays while the card stays hovered; on leave it pauses but stays mounted (the Lab keeps at
 * most ECO_SITE.mini.maxMounted, least recently used first out). The mini is decorative (aria-hidden, inert).
 */
import type { EcoOrInti, ProductSlug } from '../../content/products'
import { useMini } from '../../demos/minis'
import { Icon } from '../../demo-kit/ui/icons'

export default function LabArt({ slug, icon, eco, mounted, playing, label }: { slug: ProductSlug | null; icon: string; eco?: EcoOrInti; mounted: boolean; playing: boolean; label: string }) {
  const C = useMini(slug ?? 'inti', !!slug && mounted)
  const live = !!slug && mounted && C
  return (
    <div className="es-lab-art" data-eco={eco} data-live={live ? '' : undefined} aria-hidden="true">
      <span className="es-lab-art-sky" />
      {live ? (
        <div className="es-lab-mini">
          <C playing={playing} />
        </div>
      ) : (
        <span className="es-lab-art-icon">
          <Icon name={icon} size={30} />
        </span>
      )}
      {live ? <span className="es-lab-art-tag">{label}</span> : null}
    </div>
  )
}
