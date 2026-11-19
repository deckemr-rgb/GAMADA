/** Home section copy: portfolio (EN). Must have exactly the shape of the Indonesian copy in ./portfolio.ts. */
import type { portfolio as idCopy } from './portfolio'

export const portfolio: typeof idCopy = {
  eyebrow: 'Featured demos',
  title: 'Three products you can try right now.',
  lead: 'The data in every demo is simulated, but the flow is the same as the product we install.',
  tags: {
    gov: 'Local government',
    biz: 'Business',
    live: 'Interactive demo',
  },
  items: {
    'sapa-warga': 'Citizen complaints from WhatsApp are clustered automatically, then each ticket moves to done and the citizen is kept informed.',
    'siaga-wilayah': 'Rain forecasts read per district, early warnings sent, and officers know which villages to visit first.',
    'toko-autopilot': 'Checkout, stock and supplier POs that read the flood warning: the demand forecast changes before the shelves run empty.',
  },
  try: 'Try the demo',
  detail: 'Details',
  all: 'More studio portfolio',
}
