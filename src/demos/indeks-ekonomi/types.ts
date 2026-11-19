import type { IeRole, TabId } from './strings'

/** the view state the canvas shares with every tab (kept across tabs and role switches) */
export interface View {
  role: IeRole
  months: string[]
  monthIdx: number
  setMonthIdx: (i: number) => void
  /** selected kecamatan (map / list / drawer) */
  sel: string | null
  /** select a kecamatan; `open` opens its drawer, `fly` flies the map there and flashes its list row */
  pick: (id: string | null, open?: boolean, fly?: boolean) => void
  /** bumps when a ?focus= arrival selected something (the list flashes that row) */
  flash: number
  /** programme of the Dampak tab */
  program: string
  setProgram: (id: string) => void
  /** bumps when the programme must be measured right away (?focus=OP-… / LN-…) */
  measure: number
  go: (tab: TabId) => void
  ask: (prompt?: string) => void
  instruct: () => void
  phone: boolean
}
