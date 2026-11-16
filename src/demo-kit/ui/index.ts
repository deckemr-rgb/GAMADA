/**
 * Demo Kit UI — barrel. Import tokens once at the app level via `import './tokens.css'` (done here) and put
 * `className="dk-root"` (+ optional `data-eco`, `data-theme="paper"`) on the outermost demo element.
 */
import './tokens.css'

export { Icon, ICON_NAMES, isIconName, type IconName, type IconProps } from './icons'
export { Button, IconButton, Kbd, type ButtonProps, type ButtonVariant, type ButtonSize, type IconButtonProps } from './Button'
export { Field, Input, Textarea, Select, Segmented, type FieldProps, type InputProps, type SelectProps, type SelectOption, type SegmentedProps, type SegmentedOption } from './Form'
export {
  Badge,
  Chip,
  StatusChip,
  SlaLabel,
  LiveBadge,
  Avatar,
  initialsOf,
  Score,
  scoreTone,
  Stepper,
  InsightCallout,
  SectionHeader,
  Panel,
  type Tone,
  type ChipProps,
  type StatusTone,
  type ScoreProps,
  type StepperProps,
  type PanelProps,
} from './Atoms'
export { Kpi, KpiStrip, deltaMeaning, type KpiProps, type DeltaMeaning } from './Kpi'
export { Table, TABLE, type TableColumn, type TableProps, type Density } from './Table'
export { Kanban, type KanbanColumn, type KanbanProps } from './Kanban'
export { Inbox, Timeline, type InboxItem, type InboxProps, type TimelineItem, type TimelineProps } from './Lists'
export { Tabs, type TabItem, type TabsProps } from './Tabs'
export { Portal, Modal, Drawer, type ModalProps, type DrawerProps } from './Overlay'
export { Toast, ToastRegion, useToastQueue, type ToastData, type ToastTone } from './Toast'
export { Skeleton, useSkeleton, EmptyState, DuskArt, Confetti, fireConfetti, LoadingText, type SkeletonProps, type EmptyStateProps, type EmptyArt } from './Feedback'
export { Tooltip, Menu, type TooltipProps, type MenuItem, type MenuProps } from './Popover'
export { formatSla, formatSlaClock, SLA_WARN_MIN, type SlaTone, type SlaResult } from './sla'
export { UI_STRINGS, useUiStrings, fmtNum } from './strings'
export * from './motion'
