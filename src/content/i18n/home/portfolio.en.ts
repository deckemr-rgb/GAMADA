/** Home section copy: portfolio (EN). Must have exactly the shape of the Indonesian copy in ./portfolio.ts. */
import type { portfolio as idCopy } from './portfolio'

export const portfolio: typeof idCopy = {
  eyebrow: 'Featured work',
  title: 'Selected work you can open and test yourself.',
  lead: 'Two real GAMADA projects and a set of mobile app demos. You can browse all {n} pieces on the Work page.',
  tags: {
    real: 'Real project',
    automation: 'Automation',
    live: 'Live demo',
    ai: 'AI',
    mobile: 'Mobile',
  },
  phonefarm: {
    title: 'PhoneFarm',
    desc: 'One panel that runs many Android phones at once: task queue, device status and logs on a single screen.',
    cta: 'View demo',
  },
  automation: {
    title: 'Automation System',
    desc: 'Work that used to be retyped every day now runs on its own. AI reads the incoming data and the system handles the rest.',
    cta: 'View case study',
  },
  mobile: {
    title: '{n} Mobile App Demos',
    desc: 'App concepts, from street snacks to fitness, that you can try right in the browser without installing anything.',
    cta: 'View demo',
  },
  all: 'See all work',
}
