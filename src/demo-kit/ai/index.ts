/**
 * ai/ — hybrid AI engine (spec §9). Public barrel. UI code imports from here only.
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
  validateStructured,
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
export { checkHealth, peekHealth, configureLive, isLiveConfigured, liveBaseUrl, liveChat, liveExtract, parseSSE, LiveError, LIVE, type Health, type LiveErrorKind } from './live'
export { summarize, byteLength, CONTEXT } from './context'
export { simulate, simChunks, getMatcher, setScenarioSynonyms, ENGINE, type SimResult, type SimInput } from './scripted/engine'
export { useAiChat, staticConversation, type ChatMessage, type ChatStatus, type UseAiChat, type UseAiChatOptions } from './useAiChat'
