/**
 * shell/constants.ts — the shell's own constants (one block, see report). Timings reuse DEMO from motion.ts.
 */
import { DEMO } from '../../lib/motion'

export const SHELL = {
  /** top bar height (px, spec §6.3) */
  topBarH: 56,
  /** below this width the top bar collapses to product name + "⋯" (spec §6.3) */
  mobileBp: 768,
  /** below this shell width the secondary controls (region, AI, language, badge …) move into "⋯" */
  compactBp: 1240,
  /** from this shell width the full breadcrumb and the "Kembali ke produk" label are shown */
  wideBp: 1440,
  /** guide drawer width (px) */
  guideW: 340,
  /** the guide opens by default on first visit at or above this width */
  guideAutoOpenMin: 1280,
  /** presenter mode: cursor hides after this idle time (ms) */
  presentIdleMs: 2500,
  /** presenter mode: type scale multiplier exposed as --dk-present-scale */
  presentScale: 1.125,
  /** URL write throttle while the clock runs (ms) */
  urlThrottleMs: 2000,
  /** "rewind the clock" animation before a reset (s) */
  rewind: DEMO.wowMin,
  /** recent events kept to walk reaction chains back to their root */
  recentEvents: 400,
  /** audit rows scanned to find a follow-up's summary */
  auditScan: 80,
  /** localStorage / sessionStorage key prefix */
  storage: 'gamada:demo:',
} as const
