/**
 * ai/static.ts — staticConversation(): a finished conversation built synchronously with the simulation, for
 * ?static=1 renders, thumbnails and restored sessions. Imports the scripted engine statically (it must be sync),
 * so it is kept out of useAiChat.ts.
 */
import { PRODUCT_BY_SLUG, type ProductSlug, type RoleId } from '../../content/products'
import type { Lang, Msg } from './types'
import type { ChatMessage } from './useAiChat'
import { getScenario } from './scenarios'
import { simulate } from './scripted/engine'

/**
 * Build a finished conversation instantly with the simulation (for ?static=1 renders, thumbnails and
 * restored sessions). Each text is answered with the history so far; emits are ignored.
 */
export function staticConversation(
  product: ProductSlug,
  texts: string[],
  opts: { lang: Lang; role?: RoleId; world?: unknown },
): ChatMessage[] {
  const role = opts.role ?? PRODUCT_BY_SLUG[product].defaultRole
  const out: ChatMessage[] = []
  const history: Msg[] = []
  texts.forEach((text, i) => {
    history.push({ role: 'user', content: text })
    const { match, response, fallback } = simulate(getScenario(product), { product, role, lang: opts.lang, messages: [...history], world: opts.world ?? null })
    out.push({ id: `s-u${i}`, role: 'user', content: text })
    const a: ChatMessage = {
      id: `s-a${i}`,
      role: 'assistant',
      content: response.text,
      status: 'done',
      mode: 'sim',
      toolCalls: (response.toolCalls ?? []).map((c, k) => ({ ...c, id: `s-${i}-${k}` })),
      structured: response.structured ? [response.structured] : [],
      followUps: response.followUps ?? [],
      confidence: match.confidence,
    }
    if (!fallback && match.intentId) a.intentId = match.intentId
    if (response.translation) a.translation = response.translation
    out.push(a)
    history.push({ role: 'assistant', content: response.text })
  })
  return out
}
