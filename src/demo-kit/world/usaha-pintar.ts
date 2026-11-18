/**
 * world/usaha-pintar.ts — the Usaha Pintar selectors, rules, labels and payload helpers (NOT in the world barrel;
 * products import this one path: `../../demo-kit/world/usaha-pintar`). Modules live in world/up/<domain>.ts; the
 * bundler keeps only what a product uses. The UP world module itself (seed extension, reactions, natural events) is
 * loaded by world/eco.ts — render a skeleton until `useEcosystemReady('usaha-pintar')`.
 */
export { UP, UP_SCENARIO, BRAND_BURST, EMERGENCY_TENDER, SHOP_KBLI, FLOOD_TAGS } from './up/config'
export { PPH_FINAL, pphFinalMonth } from './up/tax-constants'
export { ACCOUNT, PAYMENT, PO_STATUS, TAX_KIND, TAX_STATUS, CALL_CRITERIA, CALL_FLAG, BRAND_CHANNEL, ANNOUNCE_CHANNEL, BRAND_TOPIC, TENDER_STATUS, REQ, KYC_STATUS, STAFF_JOB } from './up/labels'
export { shopOutlets, outletKey, kecName, desaName, type OutletKey } from './up/base'
export { vendorProfile, staffOf, barcodeOf, shopStockFor, shopOpportunities, type VendorProfile, type Opportunity } from './up/shop'
export {
  outletKpis, liveReceipts, topProducts, posCatalog, findByBarcode, demandForecast, stockRisk, floodBanner, poSuggestions, priceSuggestions, bundleIdeas, hourlyTraffic,
  shiftPlan, cashierShift, stockOf, ELASTICITY,
  type OutletKpi, type PosItem, type DemandForecast, type FactorKey, type StockRiskRow, type PoSuggestion, type PriceSuggestion, type ExtraBlock,
} from './up/toko'
export { poLines, supplierReply } from './up/po'
export {
  COA, coaOf, omzetByMonth, pphFinalOf, pendingNotas, notaLines, ledgerRows, trialBalance, pnlMonthly, balanceSheet, cashFlow, taxCalendar, pendingReviews, mutasiRows,
  type CoaRow, type AccountGroup, type PendingNota, type TbRow, type PnlMonth, type TaxEvent, type MutasiRowW,
} from './up/books'
export {
  CALL_WEIGHTS, CRITERIA_KEYS, callScore, weakest, CALL_CLIPS, PRAPESAN_CLIP, clipOf, FLAG_OF, IND_SHORT, IND_OF_SHORT, salesKpi, callList, liveCalls, callDetail, teamBoard,
  teamRadar, agentProfile, coachingsFor, clipsOf, type ClipDef, type SalesKpi, type CallRow, type BoardRow,
} from './up/sales'
export {
  verificationQueue, subjectName, verificationKpi, verificationOf, kybCase, KYB_RULE, kycRisk, kycInputOf, catalogPreview, cvShortlist, shopDistance, cvFit,
  type QueueRow, type KybCase, type KybField, type KycInput, type CatalogCard, type ShortlistRow, type CvCriteria,
} from './up/mitra'
export {
  brandStream, brandKpi, sentimentByChannel, brandTopics, reputationSeries, reputationScore, reputationAt, brandSpike, activeBrandAlert, brandAlertsAt, complaintClusters,
  replyCandidates, replyInputs, mentionPlace, competitorCompare, affectedOrders, CHANNELS, TOPICS, REPUTATION, type StreamFilter, type Cluster, type CompetitorRow,
} from './up/brand'
export {
  winScore, tenderFeed, tenderKpi, requirementsFor, priceAdvice, bidHistory, procurementOfTender, WIN_MODEL, itemCost, kbliOf,
  type FeedFilters, type FeedRow, type Requirement, type WinScore, type WinFactor, type WinFactorKey,
} from './up/tender'
export { ensureFloodScenario, activeFloodAlert, useFloodAutoplay } from './up/scenario'
export { salePayload, bidPayload, repliesPayload, type CartLine } from './up/payloads'
