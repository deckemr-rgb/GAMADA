/**
 * config.ts — every environment variable the proxy reads, parsed once per app instance.
 * Runtimes hand env over differently (process.env, Workers bindings), so the app factory takes a
 * plain string map and never touches `process` itself.
 */

export type ProxyEnv = Record<string, string | undefined>
export type Effort = 'low' | 'medium' | 'high'

export interface Config {
  apiKey: string | undefined
  /** optional gateway / test server; SDK default when unset */
  baseUrl: string | undefined
  modelFast: string
  modelSmart: string
  modelExtract: string
  effortFast: Effort
  effortSmart: Effort
  maxOutputTokens: number
  maxToolRounds: number
  /** 0 = unlimited */
  dailyTokenBudget: number
  rateLimitPerIp: number
  rateLimitWindowSec: number
  /** exact origins; ['*'] allows any origin (not recommended in production) */
  allowedOrigins: string[]
  redisUrl: string | undefined
  redisToken: string | undefined
  mock: boolean
  mockDelayMs: number
  /** read the client IP from X-Forwarded-For / CF-Connecting-IP / X-Real-IP */
  trustProxy: boolean
  logLevel: 'info' | 'silent'
}

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

const int = (v: string | undefined, d: number, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  if (v === undefined || v.trim() === '') return d
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}
const bool = (v: string | undefined, d: boolean): boolean =>
  v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
const effort = (v: string | undefined, d: Effort): Effort =>
  v === 'low' || v === 'medium' || v === 'high' ? v : d
const str = (v: string | undefined): string | undefined => (v && v.trim() ? v.trim() : undefined)

export function readConfig(env: ProxyEnv): Config {
  const mock = bool(env.AI_MOCK, false)
  const modelSmart = str(env.AI_MODEL_SMART) ?? 'claude-sonnet-5-5'
  return {
    apiKey: str(env.ANTHROPIC_API_KEY),
    baseUrl: str(env.ANTHROPIC_BASE_URL),
    modelFast: str(env.AI_MODEL_FAST) ?? 'claude-haiku-5-5',
    modelSmart,
    // owner decision: extraction reads documents with the SMART model unless overridden
    modelExtract: str(env.AI_MODEL_EXTRACT) ?? modelSmart,
    effortFast: effort(env.AI_EFFORT_FAST, 'low'),
    effortSmart: effort(env.AI_EFFORT_SMART, 'low'),
    maxOutputTokens: int(env.AI_MAX_OUTPUT_TOKENS, 2048, 256, 16000),
    maxToolRounds: int(env.AI_MAX_TOOL_ROUNDS, 3, 1, 6),
    dailyTokenBudget: int(env.AI_DAILY_TOKEN_BUDGET, 2_000_000, 0),
    // the site's Playwright suite hammers the mock; keep the real default only for real traffic
    rateLimitPerIp: int(env.RATE_LIMIT_PER_IP, mock ? 1000 : 20, 1),
    rateLimitWindowSec: int(env.RATE_LIMIT_WINDOW_SEC, 600, 10, 86_400),
    allowedOrigins: (str(env.ALLOWED_ORIGINS)?.split(',') ?? DEFAULT_ORIGINS)
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    redisUrl: str(env.REDIS_URL),
    redisToken: str(env.REDIS_TOKEN) ?? str(env.UPSTASH_REDIS_REST_TOKEN),
    mock,
    mockDelayMs: int(env.AI_MOCK_DELAY_MS, 15, 0, 2000),
    trustProxy: bool(env.TRUST_PROXY, true),
    logLevel: env.LOG_LEVEL === 'silent' ? 'silent' : 'info',
  }
}
