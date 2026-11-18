/**
 * naskah-pintar/approvals.ts — dispositions the Sekretariat submitted that wait for the Regional Secretary (maker ≠
 * checker). They are approved when the user acts as the Sekda ("Setujui sebagai Sekda", simulated), or when the world
 * clock has moved on a few minutes (the Sekda signs in the meantime, simulated e-signature). Kept outside the letter
 * component so an approval still lands after the user has opened another letter or tab. Tiny, React-free.
 */
const pending = new Map<string, { at: number; run: () => void }>()
const subs = new Set<() => void>()
const ping = () => subs.forEach((f) => f())

/** world minutes the Sekda takes when the clock runs (simulated) */
export const SEKDA_DELAY = 4

export function submitForApproval(letterId: string, at: number, run: () => void): void {
  pending.set(letterId, { at, run })
  ping()
}
export function isPendingApproval(letterId: string): boolean {
  return pending.has(letterId)
}
export function approveNow(letterId: string): void {
  const p = pending.get(letterId)
  if (!p) return
  pending.delete(letterId)
  p.run()
  ping()
}
/** clock tick: approve what has waited long enough; a clock that went back (world reset) drops the submission */
export function approveDue(now: number): void {
  for (const [id, p] of [...pending]) {
    if (now < p.at) {
      pending.delete(id)
      ping()
    } else if (now - p.at >= SEKDA_DELAY) approveNow(id)
  }
}
export function onApprovals(f: () => void): () => void {
  subs.add(f)
  return () => void subs.delete(f)
}
