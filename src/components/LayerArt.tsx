/**
 * LayerArt — one trimmed raster layer: <picture> with AVIF + WebP sources (mobile pinned to the
 * 1280 variant), positioned at its canvas bbox via the scene's --s/--ox/--oy cover mapping.
 */
import type { CSSProperties } from 'react'
import { getArt, mobileSrc, placeStyle, sizesFor, srcSet } from '../lib/layers'

const MOBILE_MQ = '(max-width: 768px)'

interface Props {
  art: string
  /** Render the pre-blurred depth-of-field variant instead of the sharp one. */
  blur?: boolean
  className?: string
  priority?: boolean
}

export default function LayerArt({ art, blur = false, className = '', priority = false }: Props) {
  const a = getArt(art)
  if (!a) return null
  if (blur) {
    if (!a.blur) return null
    return (
      <picture>
        <source type="image/avif" srcSet={a.blur.avif} />
        <img
          className={`layer-art layer-art--blur ${className}`}
          src={a.blur.webp}
          alt=""
          draggable={false}
          decoding="async"
          data-art-blur={art}
          style={placeStyle(a.blur.bbox) as CSSProperties}
        />
      </picture>
    )
  }
  const sizes = sizesFor(a.bbox.w)
  const fallback = a.files[a.files.length - 1]
  return (
    <picture>
      <source type="image/avif" media={MOBILE_MQ} srcSet={mobileSrc(a, 'avif')} />
      <source type="image/webp" media={MOBILE_MQ} srcSet={mobileSrc(a, 'webp')} />
      <source type="image/avif" srcSet={srcSet(a, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(a, 'webp')} sizes={sizes} />
      <img
        className={`layer-art ${className}`}
        src={fallback?.webp}
        width={a.bbox.w}
        height={a.bbox.h}
        alt=""
        draggable={false}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        data-art={art}
        style={placeStyle(a.bbox) as CSSProperties}
      />
    </picture>
  )
}
