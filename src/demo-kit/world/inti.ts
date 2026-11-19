/**
 * world/inti.ts — GAMADA Inti selectors (NOT in the world barrel; `../../demo-kit/world/inti`): the data trail across
 * the products (spine = TRAIL_SPINE), the unified inbox, the access matrix (= PRODUCTS[].roles), the Audit Log query
 * + CSV/JSON export, the platform pulse and the activity feed rows. The day story is `world/story.ts` (lazy).
 */
export { TRAIL_SPINE, productOfAudit, dataTrail, type Trail, type TrailRow } from './inti/trail'
export { unifiedInbox, inboxKpi, type InboxRow, type InboxChannel, type InboxFilter, type Scope } from './inti/inbox'
export { accessMatrix, scopeOf, auditQuery, auditCsv, auditJson, platformPulse, activityRows, actorOf, type Actor, type AuditRow, type AuditFilter, type Tone } from './inti/access'
