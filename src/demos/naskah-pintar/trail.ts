/**
 * naskah-pintar/trail.ts — the history of each letter handled in this session ("Riwayat surat"), kept outside the
 * letter component so reopening a letter shows the same steps (read by the AI, submitted, approved, tasks, link).
 * Keyed by world day + letter id; tiny and React-free (the day script writes to it too).
 */
export interface Trail {
  readAt: number | null
  /** OCR confidence range of the AI reading (%), when it was read */
  conf: [number, number] | null
  submittedAt: number | null
  edited: boolean
  made: number
  madeIds: string[]
  linkedNo: number | null
  /** handled through the Regent's instruction (day script) at this time */
  viaInstrAt: number | null
}

export const EMPTY_TRAIL: Trail = { readAt: null, conf: null, submittedAt: null, edited: false, made: 0, madeIds: [], linkedNo: null, viaInstrAt: null }

const trails = new Map<string, Trail>()
const key = (day: string, letterId: string) => `${day}:${letterId}`

export function getTrail(day: string, letterId: string): Trail {
  return trails.get(key(day, letterId)) ?? EMPTY_TRAIL
}
export function setTrail(day: string, letterId: string, t: Trail): void {
  trails.set(key(day, letterId), t)
}
