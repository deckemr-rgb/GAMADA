/** Home section copy: services (EN). Must have exactly the shape of the Indonesian copy in ./services.ts. */
import type { services as idCopy } from './services'

export const services: typeof idCopy = {
  eyebrow: 'Services & Products',
  title: 'Four things we build every day.',
  lead: 'From a first website to a system that ties your till, stock and reports together. Every service comes with a working example you can try in your browser before we talk budget.',
  includedLabel: 'What you get',
  items: [
    {
      key: 'web',
      title: 'Websites & Web Apps',
      desc: 'Company profiles, online shops and internal dashboards. Still fast on a patchy connection.',
      bullets: ['Responsive design & basic SEO', 'Admin panel to edit your content', 'WhatsApp & payment buttons'],
      count: (n: number) => `${n} demos`,
      cta: 'See the web demos',
    },
    {
      key: 'apk',
      title: 'Mobile Apps',
      desc: 'Android and iOS apps for your customers or your field team.',
      bullets: ['Android & iOS from one codebase', 'Push notifications & offline mode', 'Help all the way to store release'],
      count: (n: number) => `${n} demos`,
      cta: 'Try the app demos',
    },
    {
      key: 'ml',
      title: 'Machine Learning & AI',
      desc: 'Automate repetitive work and train models on the data your business already has.',
      bullets: ['Data scraping & processing', 'Bots & workflow automation', 'Dashboards to monitor results'],
      count: (n: number) => `${n} real projects`,
      cta: 'See the real projects',
    },
    {
      key: 'pos',
      title: 'POS & Business Systems',
      desc: 'Checkout, stock and reports in one system. Ready to use, or built around how you work.',
      bullets: ['Checkout with QRIS & receipts', 'Automatic stock & daily reports', 'Per-employee access rights'],
      count: (n: number) => `${n} POS demo + custom systems`,
      cta: 'Try the POS demo',
    },
  ],
  ctaTitle: 'Not sure where to start?',
  ctaText: 'Tell us what is slowing you down. We will help you pick the step that makes sense for the size of your business.',
  ctaButton: 'Chat with us on WhatsApp',
  waText: 'Hi GAMADA, I would like some advice on which service fits my business.',
}
