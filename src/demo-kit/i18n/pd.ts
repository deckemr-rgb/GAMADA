/**
 * demo-kit/i18n/pd.ts — the shared strings of the Pasar Daerah + Inti products (own module, so the Satu Daerah /
 * Usaha Pintar pages do not carry them): `const p = usePdStrings()` → `p.pdLoading`, `p.anonHidden` …
 */
import { useI18n } from '../../lib/i18n'

export const PD_STRINGS = {
  id: {
    pdLoading: 'Menyiapkan data pasar…',
    anonHidden: 'Data agregat disembunyikan untuk menjaga anonimitas',
    simPrice: 'harga simulasi',
    simScore: 'skor simulasi',
    projection: 'proyeksi',
  },
  en: {
    pdLoading: 'Preparing the market data…',
    anonHidden: 'Aggregate hidden to protect anonymity',
    simPrice: 'simulated price',
    simScore: 'simulated score',
    projection: 'projection',
  },
} as const

export function usePdStrings(): (typeof PD_STRINGS)['id'] | (typeof PD_STRINGS)['en'] {
  return PD_STRINGS[useI18n().lang]
}
