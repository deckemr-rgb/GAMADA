/** en.ts — English copy. Must satisfy the shape of id.ts (type-checked). */
import type { Dict } from './id'
import { scenes } from './home/scenes'
import { stats } from './home/stats'
import { about } from './home/about'
import { services } from './home/services'
import { portfolio } from './home/portfolio'
import { ecosystem } from './home/ecosystem'
import { security } from './home/security'
import { why } from './home/why'
import { testimonials } from './home/testimonials'
import { faqPreview } from './home/faqPreview'
import { contact } from './home/contact'

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
    work: 'Work',
    process: 'Process',
    faq: 'FAQ',
    cta: 'Free Consultation',
    workMenu: [
      { hash: 'apk', title: '4 Mobile App Demos', desc: 'Try them inside a phone frame' },
      { hash: 'web', title: '6 Live Web Demos', desc: 'POS, podcast, canteen, tickets, camera rental' },
      { hash: 'proyek', title: 'Real ML & Automation Projects', desc: 'PhoneFarm, Automation System, ScrapPulse' },
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
      { label: 'Websites & Web Apps', to: '/#layanan' },
      { label: 'Mobile Apps', to: '/#layanan' },
      { label: 'Machine Learning & AI', to: '/#layanan' },
      { label: 'POS & Business Systems', to: '/#layanan' },
    ],
    portfolioTitle: 'Portfolio',
    allWork: 'All Work',
    github: 'GitHub',
    contactTitle: 'Contact',
    whatsapp: 'WhatsApp',
    location: 'Indonesia — remote friendly',
    rights: 'All rights reserved.',
    ecosystem: 'Part of the ecosystem',
    sceneLabel: 'Night illustration: hill silhouettes and fireflies',
  },
  home: {
    scenes: scenes.en,
    stats: stats.en,
    about: about.en,
    services: services.en,
    portfolio: portfolio.en,
    ecosystem: ecosystem.en,
    security: security.en,
    why: why.en,
    testimonials: testimonials.en,
    faqPreview: faqPreview.en,
    contact: contact.en,
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
    tools: {
      title: 'GAMADA Tools',
      eyebrow: 'Tools',
      lead: 'Automation for creators and businesses: comments, video editing and uploads.',
    },
    scrappulse: {
      title: 'ScrapPulse',
      eyebrow: 'Tools · Keyword research',
      lead: 'Track public conversation about your keywords: volume, sentiment and topics.',
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
