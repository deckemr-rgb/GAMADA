/**
 * Tahap 6 contracts (no browser): ecoNav.ts literals in sync with products/tour/registry; every copy.ts honours
 * ProductCopy rules (stubs pass until the gate: STRICT=1 fails them). Plan docs/build/tahap6-plan.md §1.2, §3.1.
 */
import { expect, test } from '@playwright/test'
import { ecoNavDrift } from '../../../src/content/ecoNav.check'
import { checkAllCopies } from './copy.check'

test('ecoNav.ts matches products.ts, tour.ts and DEMO_READY', () => {
  expect(ecoNavDrift()).toEqual([])
})

test('copy.ts files follow the ProductCopy contract', async () => {
  const r = await checkAllCopies(process.env.STRICT === '1')
  expect(r.problems).toEqual({})
})
