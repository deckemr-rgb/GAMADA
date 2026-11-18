/**
 * shell/ — DemoShell, the frame of every sandbox (spec §6.3) — barrel.
 *
 *   <DemoShell product="sapa-warga" canvas={<Sandbox/>} missions={MISSIONS} hotspot="[data-hotspot=send]" />
 *   const { focus, markMission, toast } = useShell()
 *
 * Per-demo budget: CommandPalette, GuidePanel, Hotspot and SplitStage are lazy chunks DemoShell fetches on first
 * use, so this barrel exports only their TYPES. A static re-export here would pull them back into every demo
 * (rolldown INEFFECTIVE_DYNAMIC_IMPORT). DemoShell already renders all four; to use one on its own, import its
 * file directly (`../shell/GuidePanel`). Same for CoachMark: products that want the tip import
 * `../../demo-kit/shell/CoachMark`, so demos without one do not carry it.
 */
export { DemoShell, type DemoShellProps } from './DemoShell'
export { useShell, useShellOptional, ShellContext, type ShellApi, type ToastPlacementSpec } from './context'
export { TopBar, MoreSheet, Breadcrumb, ecoShortName, type TopBarProps, type MoreSheetProps } from './TopBar'
export {
  RegionSwitcher,
  RoleSwitcher,
  ClockControl,
  AiModeToggle,
  ModeBadge,
  LangToggle,
  ResetButton,
  FullscreenButton,
  BackToProduct,
  OptionList,
  useAiHealth,
  type HealthState,
} from './controls'
export { Picker, type PickerOption, type PickerProps } from './Picker'
export type { GuidePanelProps } from './GuidePanel'
export { markMission, resetMissions, missionProgress, useMissionProgress, useMissionTracker, type Mission } from './missions'
export type { HotspotProps } from './Hotspot'
export { dismissHotspot } from './hotspot-store'
export type { CoachMarkProps } from './CoachMark'
export { EventToastStack, type EventToastStackProps } from './EventToasts'
export { createEffectTracker, EFFECT_TARGET, type CrossEffect } from './effects'
export type { PaletteItem, CommandPaletteProps } from './CommandPalette'
export { fuzzyScore, filterItems } from './fuzzy'
export type { SplitStageProps } from './SplitStage'
export { usePresenter, useIdleCursor, useMediaQuery, useShellSize, useFullscreen, type ShellSize } from './hooks'
export { readDemoQuery, sessionParams, replaceQuery, demoHref, type DemoQuery } from './url'
export { SHELL } from './constants'
