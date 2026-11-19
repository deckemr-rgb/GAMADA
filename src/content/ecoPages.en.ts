/** ecoPages.en.ts — English words of the ecosystem site pages (same shape as ecoPages.ts, loaded lazily). */
import type { EcoPagesCopy } from './ecoPages'

export const en: EcoPagesCopy = {
  constellation: {
    label: 'The GAMADA product constellation',
    hint: 'Point at or focus a star to see its product. Click to open it.',
    hintTouch: 'Tap a star to see its product, tap again to open it.',
    open: 'View product',
    openInti: 'View GAMADA Inti',
    listTitle: 'Products by ecosystem',
    starLabel: '{name}, {eco}',
    links: '{n} connections',
  },
  hub: {
    exploreProducts: 'Explore the products',
    panels: {
      eyebrow: 'Three ecosystems',
      title: 'One foundation, three ways to use it.',
      lead: 'Choose where you come in. Every product works on its own, and all of them share accounts, data and events through GAMADA Inti.',
      benefitsLabel: 'Benefits',
      productsLabel: 'Products',
      intiTitle: 'The shared foundation',
    },
    flow: {
      eyebrow: 'One event, seven products',
      title: 'How it all connects',
      lead: 'An example from the tour "A Day in {region}": heavy morning rain travels from an early warning all the way to market prices. Each step is handled by a different product.',
      steps: [
        'A flooding forecast triggers an early warning to the district and village heads in the risk zone.',
        'Residents in that zone get a message and report back over WhatsApp. Each report becomes a ticket at once.',
        'The morning briefing assembles itself: villages at risk, incoming reports and relief stock.',
        'The coordination meeting produces minutes and dispositions to the agencies without retyping.',
        'The emergency procurement package is checked: prices above market and affiliated bidders are flagged.',
        'Sandbag and tarpaulin needs are matched to verified local SMEs.',
        'A spike in staple prices is spotted early, and a market operation keeps prices steady.',
      ],
      cta: 'Watch it live in the tour, chapter {n}',
      listLabel: 'The flow of events between products',
    },
    tour: {
      eyebrow: 'Interactive tour',
      lead: 'About {m} minutes. Follow one rainy day in {region} from {start}: {n} products pass events to each other, and you can stop at any chapter to try it yourself.',
      pick: 'Choose a chapter',
    },
    faq: {
      eyebrow: 'Frequently asked',
      title: 'What people usually ask before starting',
      lead: 'Short answers on procurement, security and technical questions. The details are always discussed during consultation, around the needs of your agency or business.',
      items: [
        {
          id: 'pengadaan',
          q: 'How do we buy or procure it?',
          a: 'It starts with a consultation, then a personal demo with sample data close to your situation, then a proposal. The procurement route is agreed together and follows the rules that apply to your agency.',
        },
        {
          id: 'keamanan',
          q: 'How is the data kept secure?',
          a: 'Every user signs in with their own role and only sees the data their job needs. Every action is recorded in the GAMADA Inti audit trail, and data is encrypted in transit. You can see the role matrix and the audit trail in the demo itself.',
        },
        {
          id: 'server',
          q: 'Can it run on servers in Indonesia or on our own servers?',
          a: 'It can be installed on servers in Indonesia or on-premise at your agency. Where it runs, the hardware it needs and its maintenance are discussed during consultation.',
        },
        {
          id: 'integrasi',
          q: 'Can it connect to the systems we already use?',
          a: 'Yes, through an API or data export and import, for example from a regional finance system, a point-of-sale app or an existing population database. The scope of the integration is mapped together during consultation.',
        },
        {
          id: 'mulai',
          q: 'Do we have to buy everything at once?',
          a: 'No. You can start with one product. Because every product shares GAMADA Inti, the next one simply connects to the same accounts, data and audit trail.',
        },
      ],
    },
  },
  ecos: {
    'satu-daerah': {
      short: 'Citizen reports, leadership briefings, early warnings and spending oversight speak one language, so decisions come from the same data.',
      benefits: ['Citizen reports arrive tidy, as tickets', 'Leaders see the whole region on one screen', 'Warnings and procurement risks surface early'],
      story: [
        'Today, citizen reports are scattered over many channels, the leadership briefing is assembled by hand every morning, and disaster warnings rely on phone chains.',
        'With Satu Daerah, WhatsApp reports become tidy tickets, the risk map drives the warnings, and the morning briefing assembles itself from the night before.',
        'As a result, instructions from the top become agency tasks at once, and every step can be traced back to the original report.',
      ],
      buyers: [
        { who: 'Regional Head', benefit: 'A morning briefing that is ready without asking, and issues seen before they spread.' },
        { who: 'Regional Secretary and agencies', benefit: 'Minutes, dispositions, procurement and citizen documents checked automatically.' },
        { who: 'Communications Office', benefit: 'One citizen service channel over WhatsApp, and fast hoax clarifications.' },
        { who: 'Disaster Management Agency', benefit: 'Flood forecasts on the regional map and warnings to the right residents.' },
      ],
    },
    'usaha-pintar': {
      short: 'Checkout, stock, bookkeeping, the sales team and reputation run themselves, and react to local events such as floods or price spikes.',
      benefits: ['Stock and supplier POs run themselves', 'Receipts become journals, taxes ready on time', 'Sales team and reputation watched every day'],
      story: [
        'Business owners spend their evenings matching receipts, guessing stock and answering complaints one by one.',
        'With Usaha Pintar, every sale moves stock and supplier POs, photographed receipts become journal entries, and sales conversations are scored and coached.',
        'As a result, the business is ready for unusual days, such as heavy rain that lifts demand, and the owner has time to grow it.',
      ],
      buyers: [
        { who: 'Multi-branch shop owners', benefit: 'Stock, prices, books and customer complaints from every branch in one place.' },
        { who: 'Sales managers', benefit: 'Every conversation scored, and every agent coached where they are weak.' },
        { who: 'Banks and cooperatives', benefit: 'Applicant verification and a business health score from transaction data.' },
        { who: 'Procurement vendors', benefit: 'Matching tenders found, requirements ticked, bid documents assembled.' },
      ],
    },
    'pasar-daerah': {
      short: 'Government spending flows to verified local SMEs, and its effect on prices and district economies is readable every day.',
      benefits: ['Government needs matched to local SMEs', 'Working capital from a real business score', 'Prices and district economies read early'],
      story: [
        'Local governments want their spending to stay in the region, but ready and verified local SMEs are hard to find. SMEs, in turn, struggle to get working capital.',
        'With Pasar Daerah, government needs are matched to badged SMEs, a business score opens access to capital, and price signals show up days earlier.',
        'As a result, the government can measure the impact of its policies per district, from market operations to emergency purchases.',
      ],
      buyers: [
        { who: 'Cooperatives & SME Office', benefit: 'A storefront of verified local SMEs and health scores for the businesses it supports.' },
        { who: 'Trade & Industry Office', benefit: 'Staple price alerts and market operation recommendations.' },
        { who: 'Regional Planning Agency', benefit: 'Economic indicators for every district and measurable policy impact.' },
        { who: 'Regional banks', benefit: 'SME loan applicants with a business score and verification already in order.' },
      ],
    },
  },
  inti: {
    short: 'One account, one data layer, one audit trail. Whichever product you use, they all stand on the same foundation.',
    story: [
      'One account: everyone signs in once, then holds different roles in different products.',
      'One data layer: the same report, warning, purchase and price are visible to the products that need them, with no retyping.',
      'One trail: every action is recorded, so a single citizen report can be traced across six products.',
    ],
    modulesTitle: 'The four Inti modules',
    modulesLead: 'The parts every product shares. All of them can be tried in the GAMADA Inti demo.',
    modules: [
      { name: 'Inti ID', body: 'One account, many roles. The per-product access matrix changes as the role changes.' },
      { name: 'Inti Agen', body: 'The AI agent’s reasoning trail for every request: intent, tool, data, then the answer.' },
      { name: 'Inti Kanal', body: 'One combined inbox for WhatsApp, web and phone from every product.' },
      { name: 'Inti Data + Audit Log', body: 'A data trail graph of one event across products, and an audit log you can filter.' },
    ],
    trail: 'See the data trail',
    trailTour: 'Closing the day in the tour, chapter {n}',
    getsTitle: 'What every product gets',
    getsLead: 'Because it stands on Inti, the product you choose brings these four things with it.',
    gets: [
      { title: 'Sign in once, clear roles', body: 'One account for every product, with access per role.' },
      { title: 'Audit trail', body: 'Who, when and what changed, recorded in one place.' },
      { title: 'A shared AI agent', body: 'An assistant that reads data across products within your access rights.' },
      { title: 'Shared channels', body: 'WhatsApp, web and phone messages land in one inbox.' },
    ],
  },
  detail: {
    storyEyebrow: 'The story',
    storyTitle: 'From everyday problems to a connected system',
    flowEyebrow: 'Between products',
    flowLead: 'The order of events in the tour "A Day in {region}". Every step can be played as a chapter.',
    play: 'Play chapter {n}',
    productsEyebrow: 'Products',
    tryDemo: 'Try the demo',
    buyersEyebrow: 'Who it is for',
    buyersTitle: 'Benefits per type of buyer',
    buyersLead: 'Who feels the benefit most, and which products serve them.',
    connectsEyebrow: 'Across ecosystems',
    othersEyebrow: 'Explore',
    glyph: 'The {name} cluster in the constellation',
  },
  lab: {
    preview: 'Live preview',
    previewHint: 'Point at a card to play its preview.',
  },
}
