/** en.ts — English copy. Must satisfy the shape of id.ts (type-checked). */
import type { Dict } from './id'
import { scenes } from './home/scenes.en'
import { stats } from './home/stats.en'
import { about } from './home/about.en'
import { services } from './home/services.en'
import { portfolio } from './home/portfolio.en'
import { ecosystem } from './home/ecosystem.en'
import { security } from './home/security.en'
import { why } from './home/why.en'
import { testimonials } from './home/testimonials.en'
import { faqPreview } from './home/faqPreview.en'
import { contact } from './home/contact.en'

export const en: Dict = {
  langName: 'English',
  meta: {
    siteTitle: 'GAMADA — Software & automation studio',
    description:
      'GAMADA builds websites, mobile apps, machine learning and business systems for Indonesian companies. Interactive demos you can try right in the browser.',
  },
  a11y: {
    skip: 'Skip to main content',
    home: 'GAMADA, go to home',
    mainNav: 'Main navigation',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menu: 'Menu',
    language: 'Language',
    readingProgress: 'Reading progress',
    loading: 'Loading page',
    sound: 'Sound',
    soundOn: '(on)',
    soundOff: '(off)',
    sceneNav: 'Scene navigation',
    goToScene: 'Go to scene',
    langFailed: 'That language could not be loaded. Check your connection and try again.',
  },
  error: {
    title: 'Oops, this page failed to load.',
    body: 'The connection may have dropped or the site was just updated. Please reload the page.',
    reload: 'Reload',
    home: 'Go home',
  },
  preloader: {
    caption: 'Software & automation studio',
    loading: 'Loading GAMADA',
    skip: 'Click to skip',
  },
  nav: {
    services: 'Services & Products',
    eco: 'Ecosystem',
    ecoMenu: 'Open the Ecosystem menu',
    work: 'Work',
    process: 'Process',
    faq: 'FAQ',
    cta: 'Free Consultation',
    workMenu: [
      { hash: 'apk', title: '{n} Mobile App Demos', desc: 'Try them inside a phone frame' },
      { hash: 'web', title: '{n} Live Web Demos', desc: 'Podcast, canteen, coffee shop, tickets, camera rental' },
      { hash: 'proyek', title: 'Real ML & Automation Projects', desc: 'PhoneFarm, Automation System' },
    ],
    workAll: 'See all work',
    menuNote: 'Indonesia · remote friendly',
  },
  wa: {
    tooltip: 'Chat with us',
    label: 'Chat with GAMADA on WhatsApp (new tab)',
    prefill: 'Hi GAMADA, I would like to consult about my project.',
  },
  footer: {
    blurb:
      'A software & automation studio for Indonesian businesses. We design, build and look after digital products, from websites to automation engines, with a calm and transparent process.',
    servicesTitle: 'Services',
    services: [
      { label: 'Services & Products', to: '/#layanan' },
      { label: 'All ecosystems', to: '/ekosistem' },
    ],
    ecoTitle: 'Ecosystem',
    portfolioTitle: 'Portfolio',
    allWork: 'All Work',
    nowPartOf: 'now part of {name}',
    github: 'GitHub',
    contactTitle: 'Contact',
    whatsapp: 'WhatsApp',
    location: 'Indonesia — remote friendly',
    rights: 'All rights reserved.',
    ecosystem: 'Part of the ecosystem',
    sceneLabel: 'Night illustration: hill silhouettes and fireflies',
  },
  home: {
    scenes,
    stats,
    about,
    services,
    portfolio,
    ecosystem,
    security,
    why,
    testimonials,
    faqPreview,
    contact,
  },
  pages: {
    building: 'This page is being built. Its content arrives in a later phase.',
    backHome: 'Back to home',
    karya: {
      title: 'All work',
      eyebrow: 'Portfolio',
      lead: 'Web demos, mobile apps and real GAMADA projects. Every one of them runs right in your browser.',
    },
    detail: {
      eyebrow: 'Work',
      back: 'Back to Work',
      byline: 'Demo by GAMADA',
      caseByline: 'Case study · a real GAMADA project',
    },
    proses: {
      title: 'From idea to live, without the drama',
      eyebrow: 'Process',
      lead: 'Four clear steps: consult, design, build, then launch with a warranty.',
    },
    faq: {
      title: 'Frequently asked questions',
      eyebrow: 'FAQ',
      lead: 'Cost, timelines, data security and what happens after launch.',
    },
    phonefarm: {
      title: 'PhoneFarm Panel',
      eyebrow: 'Panel · UI demo',
      lead: 'Twenty devices in one control panel.',
    },
    notFound: {
      title: 'The trail got lost in the dark',
      eyebrow: '404',
      lead: 'The page you are looking for does not exist or has moved. Follow the fireflies home.',
      cta: 'Go back home',
    },
  },
}
