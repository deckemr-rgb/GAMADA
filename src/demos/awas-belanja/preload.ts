/** demos/awas-belanja/preload.ts — warm lazy chunks on intent (hover / focus), never rejects. */
export const preloadDetail = (): void => void import('./Detail').catch(() => undefined)
export const preloadAssistant = (): void => void import('./Assistant').catch(() => undefined)
