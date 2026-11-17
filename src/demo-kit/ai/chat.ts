/**
 * ai/chat.ts — LIGHT entry for product chat surfaces: the useAiChat hook, the scenario registry and the zod-free
 * live helpers, WITHOUT the scripted engine. The engine (provider, intent matcher, streaming, about 7 KB gzip) is
 * fetched on the first send() or on prepare(), so a demo page whose chat is never used never downloads it.
 * The full barrel ('ai/index.ts') exports the same names plus the sync engine API (simulate, createMatcher,
 * getAi, staticConversation …), and therefore loads the engine with the page.
 */
export type * from './types'
export { useAiChat, loadAiEngine, type ChatMessage, type ChatStatus, type UseAiChat, type UseAiChatOptions } from './useAiChat'
export { registerScenario, unregisterScenario, getScenario } from './scenarios'
export {
  checkHealth, peekHealth, configureLive, isLiveConfigured, liveBaseUrl, LiveError, LIVE, LIVE_FALLBACK_NOTICE, onLiveFallback, registerStructuredSchema,
  type Health, type LiveErrorKind, type StructuredValidator, type FallbackInfo, type FallbackReason,
} from './live-base'
