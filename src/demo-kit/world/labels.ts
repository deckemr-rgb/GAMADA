/**
 * world/labels.ts — display labels the barrel exports (tiny, always loaded). texts.ts re-exports them.
 */
import type { Bi, ComplaintCategory } from './types'

export const CATEGORY_LABEL: Record<ComplaintCategory, Bi> = {
  banjir: { id: 'Banjir/Genangan', en: 'Flood/Waterlogging' }, 'jalan-rusak': { id: 'Jalan rusak', en: 'Damaged road' }, sampah: { id: 'Sampah', en: 'Waste' },
  pju: { id: 'PJU mati', en: 'Street light out' }, 'air-bersih': { id: 'Air bersih', en: 'Clean water' }, 'pohon-tumbang': { id: 'Pohon tumbang', en: 'Fallen tree' },
  pungli: { id: 'Pungli', en: 'Illegal levy' }, kesehatan: { id: 'Kesehatan', en: 'Health' }, sekolah: { id: 'Sekolah', en: 'School' },
  adminduk: { id: 'Adminduk', en: 'Civil registry' }, bansos: { id: 'Bansos', en: 'Social aid' }, lainnya: { id: 'Lainnya', en: 'Other' },
}
