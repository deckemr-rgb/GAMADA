/** Home section copy: scenes (EN). Must have exactly the shape of the Indonesian copy in ./scenes.ts. */
import type { scenes as idCopy } from './scenes'

export const scenes: typeof idCopy = {
  hero: {
    name: 'Explore',
    badge: 'A software & automation studio for Indonesian businesses',
    title: 'Ideas, made real.',
    body: 'GAMADA designs and builds websites, mobile apps, AI and business systems, from the first sketch to the day your customers actually use them.',
    ctaPrimary: 'Consult on WhatsApp',
    ctaSecondary: 'Explore the GAMADA ecosystem',
    demoNote: 'Interactive demos · try them right in your browser',
    waPrefill: 'Hi GAMADA, I have a project idea and would like a free consultation.',
  },
  tranquility: {
    name: 'Tranquility',
    eyebrow: 'A calm, transparent process',
    title: 'Tranquility',
    body: 'No drama and no hidden costs. You see progress every week, try the demo yourself, and always know what we are working on.',
    cta: 'See how we work',
  },
  biodiversity: {
    name: 'Biodiversity',
    eyebrow: 'A product ecosystem',
    title: 'Biodiversity',
    body: 'Websites, apps, automation and AI connected like a living forest. One team, one control panel, many devices.',
    cta: 'Explore the ecosystem',
  },
}
