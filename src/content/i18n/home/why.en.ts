/** Home section copy: why (EN). Must have exactly the shape of the Indonesian copy in ./why.ts. */
import type { why as idCopy } from './why'

export const why: typeof idCopy = {
  eyebrow: 'Why GAMADA',
  title: 'The groundwork that keeps your systems running.',
  lead: 'A good-looking screen is only the start. These are the six principles we hold to on every project, from a small demo to a system people use every day.',
  features: [
    {
      key: 'ecosystem',
      title: 'One connected ecosystem',
      text: 'Your website, app, till and reports talk to each other. Enter data once and it shows up wherever it is needed.',
    },
    {
      key: 'security',
      title: 'Security & compliance',
      text: 'Role-based access, encryption and regular backups. Customer data is handled with Indonesia’s Personal Data Protection Law in mind.',
    },
    {
      key: 'ops',
      title: 'Lighter day-to-day work',
      text: 'Repetitive manual tasks move into the system, so your team can focus on serving customers.',
    },
    {
      key: 'insight',
      title: 'Decisions backed by data',
      text: 'Dashboards that answer real questions: what sells, when it gets busy, which stock is running low.',
    },
    {
      key: 'scale',
      title: 'Built to grow with you',
      text: 'Start with one outlet, then add branches, users and features without rebuilding from scratch.',
    },
    {
      key: 'local',
      title: 'Close by & locally rooted',
      text: 'A team based in Indonesia, support over WhatsApp in plain language, and local payments like QRIS from day one.',
    },
  ],
  ecoNodes: ['Web', 'App', 'POS', 'Reports'],
  ecoCenter: 'Data',
  localChips: ['Indonesian team', 'WhatsApp support', 'QRIS & bank transfer', 'WIB · WITA · WIT'],
  statsTitle: 'Proof you can try, not just promises.',
  webDemos: 'Website demos',
  mobileApps: 'App demos',
  caseStudies: 'Real-project case studies',
  responseHours: 'Maximum reply time',
  hoursSuffix: ' h',
}
