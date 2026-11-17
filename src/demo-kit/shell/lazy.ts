/**
 * shell/lazy.ts — the shell parts not every demo needs (or not at first paint), each its own chunk fetched on
 * first use: the command palette (first Ctrl K / search), the guide (products with missions), the hotspot ring
 * (only with a `hotspot`) and the split stage (split products). Keeps the shell's share of the per-demo budget
 * small. The barrel exports only their types (a static re-export would merge them back into the shell chunk).
 */
import { lazy } from 'react'

export const loadPalette = () => import('./CommandPalette')

export const LazyCommandPalette = lazy(() => loadPalette().then((m) => ({ default: m.CommandPalette })))
export const LazyGuidePanel = lazy(() => import('./GuidePanel').then((m) => ({ default: m.GuidePanel })))
export const LazyHotspot = lazy(() => import('./Hotspot').then((m) => ({ default: m.Hotspot })))
export const LazySplitStage = lazy(() => import('./SplitStage').then((m) => ({ default: m.SplitStage })))

/** Warm the palette chunk on intent (hover / focus of the search button); never rejects. */
export function preloadPalette(): void {
  loadPalette().catch(() => undefined)
}
