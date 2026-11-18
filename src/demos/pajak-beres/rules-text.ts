/**
 * demos/pajak-beres/rules-text.ts — the readable list of the rules in rules.ts (value text + source) that Tanya Pajak
 * sends to the AI as context.rules. Every number comes from rules.ts; loaded with the lazy chat only.
 */
import { CEILING_WARN, LAPOR_DAY, PPH_FINAL, PTKP, SETOR_DAY, SOURCES as SRC, SPT_OP_DUE, pctText, type Rule, type Source } from './rules'
import type { Bi } from '../../demo-kit/world'

const jt = (n: number, lang: 'id' | 'en') => (n >= 1e9 ? `Rp ${(n / 1e9).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 1 })} ${lang === 'id' ? 'M' : 'bn'}` : `Rp ${(n / 1e6).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 1 })} ${lang === 'id' ? 'jt' : 'm'}`)
export const moneyShort = jt

/** the rule list shown under "Aturan yang dipakai" and sent to the AI as context.rules */
export function rulesList(): Rule[] {
  const r = (key: string, label: Bi, value: Bi, source: Source): Rule => ({ key, label, value, source })
  return [
    r('pph-final', { id: 'PPh Final UMKM', en: 'Final tax for SMEs' }, { id: `${pctText(PPH_FINAL.rate, 'id')} dari omzet bruto per bulan, final`, en: `${pctText(PPH_FINAL.rate, 'en')} of monthly gross turnover, final` }, SRC.pphFinal),
    r('exempt', { id: 'Omzet bebas pajak (orang pribadi)', en: 'Tax-free turnover (individuals)' }, { id: `omzet kumulatif s.d. ${jt(PPH_FINAL.exemptOmzetOP, 'id')} per tahun tidak kena PPh`, en: `cumulative turnover up to ${jt(PPH_FINAL.exemptOmzetOP, 'en')} a year is not taxed` }, SRC.exempt),
    r('ceiling', { id: 'Batas fasilitas dan batas PKP', en: 'Facility and VAT-registration line' }, { id: `${jt(PPH_FINAL.ceiling, 'id')} per tahun (peringatan di ${pctText(CEILING_WARN, 'id')})`, en: `${jt(PPH_FINAL.ceiling, 'en')} a year (warning at ${pctText(CEILING_WARN, 'en')})` }, SRC.ceiling),
    r('who', { id: 'Siapa dan berapa lama', en: 'Who and for how long' }, { id: 'orang pribadi boleh memakai tarif final tanpa batas waktu', en: 'individuals may use the final rate with no time limit' }, SRC.who),
    r('setor', { id: 'Tenggat setor', en: 'Payment deadline' }, { id: `tanggal ${SETOR_DAY} bulan berikutnya`, en: `the ${SETOR_DAY}th of the next month` }, SRC.setor),
    r('lapor', { id: 'Tenggat lapor', en: 'Filing deadline' }, { id: `SPT Masa PPh 21 tanggal ${LAPOR_DAY}; SPT Tahunan orang pribadi ${SPT_OP_DUE.day} Maret`, en: `PPh 21 return by the ${LAPOR_DAY}th; individual annual return by ${SPT_OP_DUE.day} March` }, SRC.lapor),
    r('ter', { id: 'PPh 21 karyawan (TER)', en: 'Employee PPh 21 (TER)' }, { id: 'tarif efektif rata-rata kategori A/B/C × bruto sebulan; Desember dihitung ulang', en: 'average effective rate category A/B/C × monthly gross; December is recalculated' }, SRC.ter),
    r('ptkp', { id: 'PTKP', en: 'Non-taxable income (PTKP)' }, { id: `TK/0 ${jt(PTKP.base, 'id')}/tahun, +${jt(PTKP.married, 'id')} kawin, +${jt(PTKP.perDependant, 'id')} per tanggungan (maks. ${PTKP.maxDependants})`, en: `TK/0 ${jt(PTKP.base, 'en')}/year, +${jt(PTKP.married, 'en')} married, +${jt(PTKP.perDependant, 'en')} per dependant (max ${PTKP.maxDependants})` }, SRC.ptkp),
  ]
}
