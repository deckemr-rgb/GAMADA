/**
 * tour/types.ts — the tour DSL (plan docs/build/tahap5-plan.md §1.2). Chapters are DATA: every world-dependent value
 * (fills, focus ids, done predicates, fallbacks) is a key resolved by the lazy `world-steps.ts` chunk, so the opener
 * and the player frame never import a product, the ecosystem selectors or the story.
 */
import type { EcoOrInti, ProductSlug, RoleId } from '../../content/products'

export type Bi = { id: string; en: string }
export type Lang = 'id' | 'en'

/** world steps (idempotent by key): the day story + payload builders that stand in for a product click */
export type WorldKey =
  | 'flood'
  | 'siti'
  | 'neighbours'
  | 'instruction'
  | 'recommend'
  | 'broadcast'
  | 'clarify'
  | 'analyse'
  | 'order'
  | 'verify'
  | 'bid'
  | 'po'
  | 'coach'
  | 'minutes'
  | 'bulk'
  | 'tax'
  | 'loan'
  | 'brandReply'
  | 'op'

/** an entity id a chapter lands on (resolved in world-steps) */
export type FocusKey =
  | 'alert'
  | 'hoax'
  | 'pump'
  | 'need'
  | 'kybRequest'
  | 'tender'
  | 'floodSku'
  | 'po'
  | 'warning'
  | 'econ'
  | 'siti'
  | 'cluster'
  | 'brandAlert'

/** a world state a step waits for */
export type AwaitKey = 'reply' | 'opRunning' | 'aiAnswer'

export type Step =
  | { k: 'setClock'; t: string }
  | { k: 'story'; key: 'flood' | 'siti' | 'neighbours' | 'instruction' | 'recommend' }
  | { k: 'world'; key: WorldKey }
  | { k: 'navigate'; slug: ProductSlug; role?: RoleId; tab?: string; focus?: FocusKey; q?: Record<string, string> }
  | { k: 'focus'; sel: string; cap?: number; wide?: boolean }
  | { k: 'click'; sel: string; cap?: number; fb?: WorldKey; soft?: boolean }
  | { k: 'type'; sel: string; text: Bi; cps?: number }
  | { k: 'ai'; sel: string; send: string; text: Bi; wide?: boolean }
  | { k: 'wait'; ms: number }
  | { k: 'await'; until: AwaitKey; timeout?: number }
  | { k: 'caption'; cap: number }

export interface ChapterScript {
  n: number
  time: string
  product: ProductSlug
  eco: EcoOrInti
  /** seconds at 1× (the chapter holds until then) */
  duration: number
  role?: RoleId
  tab?: string
  /** the handoff ?focus= entity */
  focus?: FocusKey
  /** extra handoff params (e.g. outlet) */
  q?: Record<string, string>
  /** world keys this chapter makes true (prepareThrough applies them for later chapters, gap 0) */
  world: WorldKey[]
  steps: Step[]
}

export interface NarrationEntry {
  title: string
  body: string
  happened: string[]
  /** step captions (with {placeholders}) */
  caps: string[]
}
export type Narration = Record<number, NarrationEntry>

export type Fills = Record<string, string | number>

export interface TourSummary {
  complaintsHandled: number
  warningsSent: number
  hoaxesCountered: number
  savingsRp: number
  umkmOrders: number
  pricesStabilised: number
  productsSeen: number
  events: number
}
