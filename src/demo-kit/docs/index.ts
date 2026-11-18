/**
 * docs/ — sample documents (original inline SVG generated from data), DocViewer, ExtractPanel, TamperHeatmap,
 * DispositionStamp and the simulated extraction. Barrel.
 */
export * from './types'
export { DocArt, type DocArtProps } from './DocArt'
export { DocViewer, DOCS, type DocViewerProps, type DocViewerBox } from './DocViewer'
export { ExtractPanel, VERDICT_LABEL, readPrompt, type ExtractPanelProps } from './ExtractPanel'
export { TamperHeatmap, TamperToggle, HEAT, type TamperCell, type TamperHeatmapProps, type TamperToggleProps } from './TamperHeatmap'
export { DispositionStamp, STAMP, type DispositionStampProps } from './Stamp'
export { simulateExtract, docsExtract, verdictOf, tamperCells, fieldValue, EXTRACT, type Verdict, type VerdictResult, type SimulateOptions } from './extract'
export { SAMPLES, getSample, samplesOf, LETTERS, IDENTITY, PERMITS, HOUSES, FINANCE, FICTIONAL_BANK, BUYER, generateCvs, cvDoc, CV, idr } from './samples'
export {
  makeNik, makeNoKk, parseNik, nikMatchesBirth, nikRegion, nikRegions, nikRegionName, dmy, longDate, NIK, SPECIMEN_KEC, BOJONEGORO_KEMENDAGRI, BOJONEGORO_NIK_REGIONS,
  type NikParts, type NikKecamatan,
} from './nik'
export { textWidth, runBox, wrap } from './measure'
export { TextDiff, diffWords, type TextDiffProps, type DiffPart } from './TextDiff'
