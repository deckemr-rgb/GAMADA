/** Home section copy: ecosystem (EN). Must have exactly the shape of the Indonesian copy in ./ecosystem.ts. */
import type { ecosystem as idCopy } from './ecosystem'

export const ecosystem: typeof idCopy = {
  eyebrow: 'A connected ecosystem',
  title: 'One event, three ecosystems respond.',
  lead: 'When a flood is forecast, citizen complaints, shop stock and market prices keep each other informed through GAMADA Inti.',
  hint: 'Hover, tap or Tab through each node to see the part it plays.',
  diagramLabel: 'Ecosystem diagram: GAMADA Inti in the centre, connected to Satu Daerah, Usaha Pintar and Pasar Daerah.',
  cta: 'Explore the ecosystem',
  nodeCta: 'See {name}',
  hubKicker: 'The foundation',
  nodes: {
    hub: {
      title: 'One account, one data layer, one audit trail',
      body: 'Access rights, regional data, the AI assistant and the audit trail are shared by every product.',
    },
    'satu-daerah': {
      title: 'Connected public services',
      body: 'Citizen complaints are clustered, leaders get a morning summary, and early warnings reach officers in each district.',
    },
    'usaha-pintar': {
      title: 'Operations that run themselves',
      body: 'Checkout, stock, bookkeeping and the sales team are connected, and they adjust when something happens in the region.',
    },
    'pasar-daerah': {
      title: 'Government spending that moves local SMEs',
      body: 'Government needs are matched to local SMEs, a business score opens access to capital, and staple prices are watched.',
    },
  },
}
