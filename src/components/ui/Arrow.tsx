/**
 * Arrow — the decorative "→" / "←" next to a link label. Spaced with a margin, not a text space: inside a flex link
 * (crumbs, pager, chapter links) a leading/trailing space in a child collapses and the arrow glued to the text.
 * `mid` is the "Old → New" separator (space on both sides).
 */
export default function Arrow({ dir = 'next' }: { dir?: 'next' | 'back' | 'mid' }) {
  return (
    <span className={`ln-arrow ln-arrow--${dir}`} aria-hidden="true">
      {dir === 'back' ? '←' : '→'}
    </span>
  )
}
