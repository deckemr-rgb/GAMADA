/**
 * strings.ts — the few /produk/:slug labels that are not in content/i18n/eco.ts (that file is integrator-owned and
 * frozen for Tahap 6). Every entry is a `Bi`; product names come from products.ts through `{name}` + fill().
 */
import type { Bi } from '../../content/products'

export const PR = {
  eyebrows: {
    problems: { id: 'Masalah', en: 'The problem' },
    steps: { id: 'Alurnya', en: 'The flow' },
    highlights: { id: 'Di dalam demo', en: 'Inside the demo' },
    related: { id: 'Satu ekosistem', en: 'One ecosystem' },
    roles: { id: 'Peran', en: 'Roles' },
    security: { id: 'Kepercayaan', en: 'Trust' },
    faq: { id: 'FAQ', en: 'FAQ' },
    chapters: { id: 'Tur', en: 'Tour' },
  },
  step: { id: 'Langkah {n}', en: 'Step {n}' },
  relatedLead: {
    id: '{name} bertukar kejadian dengan produk-produk ini. Pilih salah satu untuk membuka halamannya.',
    en: '{name} exchanges events with these products. Pick one to open its page.',
  },
  graphSummary: { id: '{name} terhubung dengan: {list}.', en: '{name} is connected to: {list}.' },
  rolesLead: {
    id: 'Peran yang bisa Anda coba di demo. Satu akun GAMADA Inti bisa memegang beberapa peran.',
    en: 'The roles you can try in the demo. One GAMADA Inti account can hold several roles.',
  },
  securityLead: {
    id: 'Yang benar-benar dilakukan demo ini, dan yang bisa dibahas untuk pemasangan di tempat Anda.',
    en: 'What the demo really does, and what can be discussed for an installation at your site.',
  },
  faqLead: {
    id: 'Jawaban singkat. Untuk hal yang lebih rinci, tanyakan langsung lewat WhatsApp.',
    en: 'Short answers. For anything more detailed, ask us directly on WhatsApp.',
  },
  chaptersLead: {
    id: 'Bab tur "Satu Hari di {region}" yang menampilkan {name}.',
    en: 'The chapters of the tour "A Day in {region}" that feature {name}.',
  },
  defaultRole: { id: 'peran awal demo', en: 'starting role in the demo' },
  mergedCta: {
    kasir: { id: 'Buka modul Kasir', en: 'Open the Checkout module' },
    analisis: { id: 'Buka tab Analisis', en: 'Open the Analysis tab' },
  },
  highlightStill: { id: 'Cuplikan simulasi', en: 'Simulated still' },
} satisfies Record<string, Bi | Record<string, Bi>>
