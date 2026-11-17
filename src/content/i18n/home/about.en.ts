/** Home section copy: about (EN). Must have exactly the shape of the Indonesian copy in ./about.ts. */
import type { about as idCopy } from './about'

export const about: typeof idCopy = {
  eyebrow: 'GAMADA at a glance',
  title: 'We build digital tools that people actually use.',
  lead: 'GAMADA is a software and automation studio for Indonesian businesses. We design point-of-sale systems, dashboards, mobile apps and small robots that take over repetitive work, so your team has time for the work that actually pays.',
  body: 'The way we work is simple. We listen to the problem first, then put a clickable prototype in front of you as early as we can. From there the system grows step by step, and you always know where things stand.',
  facts: [
    { title: 'Try it before you decide', text: 'The demos on this site run right in your browser. They are not just pictures.' },
    { title: 'Made for local business', text: 'Indonesian, rupiah and WhatsApp flows are part of the plan from day one.' },
    { title: 'Replies within {h} hours', text: 'Tell us what you need on WhatsApp and we will help you map out the first step.' },
  ],
  figureLabel: 'Illustration of three interfaces: a POS dashboard, a 20-device panel and an automation queue.',
  caption: 'Interface illustrations, not real data.',
  mock: {
    pos: {
      url: 'pos-dashboard · illustration',
      title: "Today's summary",
      today: 'Today',
      kpis: [
        { label: 'Orders', value: '128' },
        { label: 'Revenue', value: 'Rp 4.2M' },
        { label: 'Out of stock', value: '3' },
      ],
      chart: 'Sales, last 7 days',
      days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    },
    farm: {
      url: 'device-panel · illustration',
      title: 'Devices',
      online: 'online',
      busy: 'busy',
      idle: 'idle',
    },
    queue: {
      url: 'automation-queue · illustration',
      title: 'Task queue',
      jobs: [
        { name: 'Sync warehouse stock', status: 'Done' },
        { name: 'Pull marketplace orders', status: 'Running' },
        { name: 'Send daily report', status: 'Queued' },
        { name: 'Reply to customer chats', status: 'Queued' },
      ],
    },
  },
}
