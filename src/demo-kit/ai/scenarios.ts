/**
 * ai/scenarios.ts — the registry of simulation scenarios (one per product). Tiny on purpose: a product registers
 * its scenario when its module loads, without pulling in the scripted engine (provider.ts / scripted/engine.ts),
 * which useAiChat loads on the first message (or on prepare()).
 */
import type { ProductSlug } from '../../content/products'
import type { Scenario } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScenario = Scenario<any>
/** @internal read by provider.ts */
export const scenarios = new Map<ProductSlug, AnyScenario>()

/** Register (or replace) the simulation scenario of a product. */
export function registerScenario<W>(s: Scenario<W>): void {
  scenarios.set(s.product, s as AnyScenario)
}
/** Remove a product's scenario (tests, showcase cleanup). */
export function unregisterScenario(slug: ProductSlug): void {
  scenarios.delete(slug)
}
export function getScenario(slug: ProductSlug): Scenario<unknown> | undefined {
  return scenarios.get(slug)
}
