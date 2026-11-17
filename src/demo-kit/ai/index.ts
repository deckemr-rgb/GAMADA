/**
 * ai/ — hybrid AI engine (spec §9). Public barrel; UI code imports from here or from the light entries below.
 *
 * Everything exported here is zod-FREE, so importing the barrel never pulls zod into a demo route. The zod half
 * of the live client (STRUCTURED_SCHEMAS, validateStructured, liveChat, liveExtract, parseSSE, sseToChunk,
 * ExtractedSchema …) is `ai/live.ts`: provider.ts loads it on the first live request; tools/tests that need it
 * import '../ai/live' directly (or `await loadLiveClient()`).
 *
 * Bytes: this barrel also exports the SYNC engine API (simulate, createMatcher, getAi, staticConversation …), so
 * importing it loads the scripted engine with the page. A product chat that only needs the hook + scenario
 * registry should import 'ai/chat' (same names, engine fetched on the first send() or chat.prepare()); code that
 * only checks health / listens for fallbacks should import 'ai/live-base'.
 */
export type * from './types'
export {
  getAi,
  simProvider,
  createLiveProvider,
  registerScenario,
  unregisterScenario,
  getScenario,
  registerStructuredSchema,
  onLiveFallback,
  takeSimExtras,
  liveAvailable,
  LIVE_FALLBACK_NOTICE,
  type FallbackInfo,
  type FallbackReason,
  type SimExtras,
  type LiveProviderOptions,
} from './provider'
export { createMatcher, extractSlots, normalize, stem, DEFAULT_SYNONYMS, MATCH, type Matcher, type MatcherOptions, type SynonymMap } from './intents'
export { streamText, streamSchedule, tokenize, thinkingDelayMs, hashString, prng, type StreamTextOptions, type StreamSchedule } from './stream'
export { checkHealth, peekHealth, configureLive, isLiveConfigured, liveBaseUrl, LiveError, LIVE, type Health, type LiveErrorKind, type StructuredValidator } from './live-base'
export type { StructuredKind } from './live'
export { summarize, byteLength, CONTEXT } from './context'
export { simulate, simChunks, getMatcher, setScenarioSynonyms, ENGINE, type SimResult, type SimInput } from './scripted/engine'
export { useAiChat, loadAiEngine, type ChatMessage, type ChatStatus, type UseAiChat, type UseAiChatOptions } from './useAiChat'
export { staticConversation } from './static'

/** The zod half of the live client (STRUCTURED_SCHEMAS, validateStructured, liveChat, liveExtract …), loaded on demand. */
export const loadLiveClient = (): Promise<typeof import('./live')> => import('./live')
