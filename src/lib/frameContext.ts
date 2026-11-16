import { createContext, useContext } from 'react'
import type { FrameMapping } from './frame'

/** Current canvas→box mapping for components rendered inside a FrameSpace. */
export const FrameContext = createContext<FrameMapping>({ s: 1, ox: 0, oy: 0 })
export const useFrameMapping = (): FrameMapping => useContext(FrameContext)
