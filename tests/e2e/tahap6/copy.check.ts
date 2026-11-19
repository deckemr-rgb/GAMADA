/**
 * copy.check.ts — content contract of src/demos/<slug>/copy.ts (Tahap 6 plan §3.1). Pure, no browser.
 * Run alone: `npx tsx tests/e2e/tahap6/copy.check.ts`; also run by contracts.spec.ts. Stubs (`stub: true`) are
 * listed as pending, not failed; `--strict` (or STRICT=1 in contracts.spec.ts) fails them too (gate).
 */
import { PRODUCT_BY_SLUG, PRODUCT_SLUGS, type Bi, type ProductSlug } from '../../../src/content/products'
import { COPIES, type ProductCopy } from '../../../src/demos/minis'

const filled = (b: Bi | undefined): boolean => !!b && b.id.trim() !== '' && b.en.trim() !== ''

export function copyProblems(slug: ProductSlug, c: ProductCopy): string[] {
  const p = PRODUCT_BY_SLUG[slug]
  const out: string[] = []
  const bis: [string, Bi | undefined][] = [['pitch', c.pitch], ['dataNote', c.dataNote]]
  if (c.pitch.id.length > 160 || c.pitch.en.length > 160) out.push('pitch > 160 chars')
  for (const [k, list] of [['problems', c.problems], ['steps', c.steps], ['highlights', c.highlights]] as const) {
    list.forEach((x, i) => {
      bis.push([`${k}[${i}].title`, x.title], [`${k}[${i}].body`, x.body])
      if (x.body.id.length > 180 || x.body.en.length > 180) out.push(`${k}[${i}].body > 180 chars`)
    })
  }
  if (c.highlights.length < 2 || c.highlights.length > 3) out.push(`highlights: ${c.highlights.length} (2–3)`)
  if (c.faq.length < 4 || c.faq.length > 6) out.push(`faq: ${c.faq.length} (4–6)`)
  c.faq.forEach((f, i) => bis.push([`faq[${i}].q`, f.q], [`faq[${i}].a`, f.a]))
  for (const r of Object.keys(c.roles)) if (!p.roles.includes(r as never)) out.push(`roles.${r} not a role of ${slug}`)
  for (const r of p.roles) if (!c.roles[r]) out.push(`roles.${r} missing`)
  for (const r of Object.keys(c.relations ?? {})) if (!p.related.includes(r as ProductSlug)) out.push(`relations.${r} not in related`)
  if (c.miniCaption.length < 1) out.push('miniCaption empty')
  c.miniCaption.forEach((b, i) => bis.push([`miniCaption[${i}]`, b]))
  for (const [k, b] of bis) if (!filled(b)) out.push(`${k}: empty ID or EN`)
  return out
}

/** All 18: { slug: problems[] } (only slugs with problems), plus the list of stubs still pending. */
export async function checkAllCopies(strict = false): Promise<{ problems: Record<string, string[]>; stubs: string[] }> {
  const problems: Record<string, string[]> = {}
  const stubs: string[] = []
  for (const slug of PRODUCT_SLUGS) {
    const { copy } = await COPIES[slug]()
    if (copy.stub) {
      stubs.push(slug)
      if (strict) problems[slug] = ['still the step-0 stub']
      continue
    }
    const pr = copyProblems(slug, copy)
    if (pr.length) problems[slug] = pr
  }
  return { problems, stubs }
}

const argv: string[] = (globalThis as { process?: { argv: string[] } }).process?.argv ?? []
if (argv[1]?.split(String.fromCharCode(92)).join('/').endsWith('tahap6/copy.check.ts')) {
  const r = await checkAllCopies(argv.includes('--strict'))
  console.log(JSON.stringify(r, null, 2))
  if (Object.keys(r.problems).length) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1
}
