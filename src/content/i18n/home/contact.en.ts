/** Home section copy: contact (EN). Must have exactly the shape of the Indonesian copy in ./contact.ts. */
import type { contact as idCopy } from './contact'

export const contact: typeof idCopy = {
  eyebrow: 'Start with a conversation',
  title: "Got an idea? Let's talk, it's free.",
  lead: "Tell us what you want to build or tidy up. We'll help you map the first step, with no jargon and no commitment.",
  waCta: 'Chat on WhatsApp',
  waPrefill: "Hi GAMADA, I have an idea and I'd like to talk about a project.",
  emailLabel: 'or email us at',
  points: {
    free: 'Free first consultation',
    reply: (h: number) => `We reply within ${h} hours`,
    estimate: 'Written cost & timeline estimate',
  },
  form: {
    title: 'Or fill in a short form',
    note: 'This form stores nothing. When you send it, your message opens in WhatsApp, ready for you to hit send.',
    name: 'Name',
    namePh: 'Your name',
    need: 'What do you need?',
    needPh: 'Choose one',
    needs: ['Website & Web App', 'Mobile App', 'Machine Learning & AI', 'POS & Business Systems', 'Something else'],
    message: 'Message',
    messagePh: 'Briefly describe your idea or the problem you want solved…',
    submit: 'Send via WhatsApp',
    errors: {
      name: 'May we have your name? At least 2 letters.',
      need: 'Pick the closest option, or "Something else".',
      message: 'Tell us a little more, at least 10 characters, so we can prepare a useful reply.',
    },
    successTitle: 'Just one more step.',
    successBody: 'WhatsApp opens in a new tab with your message already filled in. Hit send there and we will reply as soon as we can. If no tab appeared, use the button below.',
    successRetry: 'Open WhatsApp',
    successAgain: 'Write another message',
    newTab: '(new tab)',
    compose: (name: string, need: string, message: string) => `Hi GAMADA, I'm ${name}.\nI need: ${need}\n\n${message}`,
  },
}
