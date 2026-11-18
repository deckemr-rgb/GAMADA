/**
 * world/sd/citizen.ts — personas and the citizen phone / officer console (Sapa Warga).
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { Citizen, CitizenMessage, Complaint, Minutes, Ticket, WorldState } from '../types'
import { createParamSelector, createSelector } from '../selectors'
import { DAY_MIN, distanceKm, rows } from '../util'

/* ================================================================== personas · citizen phone (Sapa Warga) */

export interface Personas {
  siti: Citizen | undefined
  raka: Citizen | undefined
  darmo: Citizen | undefined
}
/** the three script personas (Ibu Siti — regional language, flood desa; Raka — NIB; Pak Darmo — damaged e-KTP) */
export const personas = /*#__PURE__*/ createSelector((s) => [s.citizens, s.meta.personas], (c, p): Personas => ({
  siti: c.byId[p.siti], raka: c.byId[p.raka], darmo: c.byId[p.darmo],
}))

export interface CitizenInbox {
  messages: CitizenMessage[]
  complaints: { complaint: Complaint; ticket: Ticket | undefined }[]
  bookings: WorldState['bookings']['byId'][string][]
}
/** everything that shows on one citizen's phone, newest first */
export const citizenInbox = /*#__PURE__*/ createParamSelector((s) => [s.messages, s.complaints, s.tickets, s.bookings], (citizenId: string, msgs, complaints, tickets, bookings): CitizenInbox => ({
  messages: rows(msgs).filter((m) => m.to.includes(citizenId)),
  complaints: rows(complaints).filter((c) => c.citizenId === citizenId).map((complaint) => ({ complaint, ticket: tickets.byId[complaint.ticketId] })),
  bookings: rows(bookings).filter((b) => b.citizenId === citizenId),
}))

export interface ConsoleTicket {
  ticket: Ticket
  complaint: Complaint
  citizen: Citizen | undefined
  /** minutes left until the SLA due time at `now` (negative = late) */
  slaLeft: number
}
/** Konsol Petugas rows: ticket + complaint + citizen, newest first (filter / group in the product) */
export const consoleTickets = /*#__PURE__*/ createParamSelector((s) => [s.tickets, s.complaints, s.citizens], (now: Minutes, tickets, complaints, citizens): ConsoleTicket[] => {
  const out: ConsoleTicket[] = []
  for (const t of rows(tickets)) {
    const complaint = complaints.byId[t.complaintId]
    if (!complaint) continue
    out.push({ ticket: t, complaint, citizen: complaint.citizenId ? citizens.byId[complaint.citizenId] : undefined, slaLeft: t.status === 'selesai' ? 0 : t.slaDueAt - now })
  }
  return out
})

/** open complaints of the same category within `radiusKm` (the "Gabungkan duplikat" candidates) */
export function duplicateCandidates(s: WorldState, complaintId: string, radiusKm = 0.5): Complaint[] {
  const c = s.complaints.byId[complaintId]
  if (!c) return []
  return rows(s.complaints).filter((x) => {
    if (x.id === c.id || x.category !== c.category || Math.abs(x.at - c.at) > DAY_MIN) return false
    const st = s.tickets.byId[x.ticketId]?.status
    return st !== 'selesai' && distanceKm(x.coord, c.coord) <= radiusKm
  })
}
