/**
 * world/pasar-daerah.ts — the Pasar Daerah selectors, rules, labels and payload helpers (NOT in the world barrel;
 * products import this one path: `../../demo-kit/world/pasar-daerah`). Modules live in world/pd/<domain>.ts; the build
 * rewrites each imported name to the module that defines it (vite.config barrelImports), so a product carries only
 * what it uses. It also re-exports the Usaha Pintar selectors a PD product may read (only Katalog Lokal, Rapor Usaha,
 * Inti and the Sinyal Pasar UMKM side: they need the UP data, `useWorldReady(['usaha-pintar/data', 'pasar-daerah'])`).
 * All numbers are SIMULATED.
 */
export { PD, CATEGORY_REF, LOAN, LENDERS } from './pd/config'
export { BADGE, ORDER_STATUS, CONSENT_SCOPE, LOAN_STATUS, OP_STAGE, SECTOR, PROGRAM_KIND, SCORE_FACTOR } from './pd/labels'
export { matchScore, listingOf, rankVerified, newMatchesFor, shopOnHand, needKm, MATCH_WEIGHTS, type MatchParts, type Listing } from './pd/match'
export {
  badgesOf, catalogShortlist, offerFor, splitSuggestion, needList, needView, ordersOf, umkmInbox, vendorStorefront, verifiedCount,
  type Badges, type Card, type Offer, type OfferLine, type NeedTab, type NeedView, type StoreRow,
} from './pd/katalog'
export { catalogKpi } from './pd/kpi'
export { naturalNeedPayload, matchPayloads } from './pd/need'
export { orderPayload, umkmPoPayload } from './pd/payloads'
export {
  SCORE_BANDS, bandOf, raporOf, scoreActions, loanOffer, loanAdvice, lenderQueue, consentsOf, activeConsent, dataFeed, netProfitAvg,
  type Rapor, type RaporFactor, type ScoreAction, type ActionKey, type LoanOffer, type LoanAdvice, type QueueRow, type FeedRow,
} from './pd/rapor'
export { installment } from './pd/loan-math'
export {
  ECON, MODAL_PROGRAM_ID, econMonths, econFrame, econSeries, econSectors, econPulse, econEvents, programList, programImpact, dinkopCards, briefingModel,
  type EconFrame, type EconMarker, type ProgramRow, type Impact, type BriefingInput,
} from './pd/econ'
export { seasonalBand, shockPath, priceOutlook, opSimulate, priceStep, shocksOn, type Outlook, type OpPlan, type Band, type OutlookFactorKey } from './pd/forecast'
export {
  priceBoard, priceTicker, commodityIndex, opView, pdKpi, alertsFor, priceSubsOf, distributorsFor, cmSkuFor,
  type BoardRow, type OpView, type UmkmAlert, type Distributor,
} from './pd/prices'
export { weekChangeOf } from './price-math'
export { shockMarkets } from './pd/reactions'
// Usaha Pintar selectors a Pasar Daerah product may read (lazy chunks of KL / SP; RU and Inti need the UP data anyway)
export { outletKpis, demandForecast } from './up/toko'
export { omzetByMonth, pnlMonthly, ledgerRows, taxCalendar, reviewSuggestion, reviewedLines, type ReviewWhy } from './up/books'
export { pendingReviews } from './score'
export { vendorProfile, shopOpportunities } from './up/shop'
export { verificationOf, kybCase } from './up/mitra'
export { priceAdvice } from './up/win-score'
export { verifiedBusinesses } from './selectors'
