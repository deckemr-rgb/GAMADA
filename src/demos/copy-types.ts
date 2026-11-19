/**
 * copy-types.ts — the words of a /produk/:slug page (Tahap 6 plan §3.1). One `copy.ts` per product folder:
 *   export const copy: ProductCopy
 * reached ONLY through `COPIES[slug]()` in src/demos/minis.ts (dynamic import), never statically.
 * ID + EN in the same file; every visible string is a `Bi`. Names come from products.ts (`{name}` + fill()).
 * Checked by tests/e2e/tahap6/copy.check.ts (roles ⊆ product roles, relations ⊆ related, faq 4–6, 3/3 tuples).
 */
import type { Bi, ProductSlug, RoleId } from '../content/products'

/** One card of words: Masalah, Cara kerja, Momen unggulan. body ≤ 180 chars. */
export interface CopyCard {
  title: Bi
  body: Bi
}

export interface ProductCopy {
  /** 1 sentence under the tagline (hero lead, 2nd line), ≤ 160 chars */
  pitch: Bi
  /** "Masalah": exactly 3 */
  problems: readonly [CopyCard, CopyCard, CopyCard]
  /** "Cara kerja": exactly 3 numbered steps */
  steps: readonly [CopyCard, CopyCard, CopyCard]
  /** "Momen unggulan": 2–3; `frame` = a named frame of the mini shown as a still (<Mini frame=… playing={false}/>) */
  highlights: ReadonlyArray<CopyCard & { frame?: string }>
  /** one benefit line per role in products.ts `roles` (keys ⊆ those roles) */
  roles: Partial<Record<RoleId, Bi>>
  /** "Terhubung dengan" one-liners (keys ⊆ products.ts `related`); fallback = the related product's tagline */
  relations?: Partial<Record<ProductSlug, Bi>>
  /** what in the demo is real (region geography) vs simulated */
  dataNote: Bi
  /** "FAQ produk": 4–6 */
  faq: ReadonlyArray<{ q: Bi; a: Bi }>
  /** one caption per mini frame (shown as "Simulasi · {caption}") */
  miniCaption: readonly Bi[]
  /** step-0 placeholder marker: B2 deletes this line when the real copy is written (the check skips stubs) */
  stub?: true
}

/** Module shape of src/demos/<slug>/copy.ts. */
export interface CopyModule {
  copy: ProductCopy
}
