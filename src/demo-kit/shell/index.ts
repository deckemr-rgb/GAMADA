/**
 * shell/ — DemoShell, the frame of every sandbox (spec §6.3) — barrel.
 *
 *   <DemoShell product="sapa-warga" canvas={<Sandbox/>} missions={MISSIONS} hotspot="[data-hotspot=send]" />
 *   const { focus, markMission, toast } = useShell()
 */
export { DemoShell, type DemoShellProps } from './DemoShell'
export { useShell, useShellOptional, ShellContext, type ShellApi } from './context'
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
export { GuidePanel, type GuidePanelProps } from './GuidePanel'
export { markMission, resetMissions, missionProgress, useMissionProgress, useMissionTracker, type Mission } from './missions'
export { Hotspot, CoachMark, type HotspotProps, type CoachMarkProps } from './Hotspot'
export { EventToastStack, type EventToastStackProps } from './EventToasts'
export { createEffectTracker, EFFECT_TARGET, type CrossEffect } from './effects'
export { CommandPalette, fuzzyScore, filterItems, type PaletteItem, type CommandPaletteProps } from './CommandPalette'
export { SplitStage, type SplitStageProps } from './SplitStage'
export { usePresenter, useIdleCursor, useMediaQuery, useShellSize, useFullscreen, type ShellSize } from './hooks'
export { readDemoQuery, sessionParams, replaceQuery, demoHref, type DemoQuery } from './url'
export { SHELL } from './constants'
