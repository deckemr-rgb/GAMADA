/** Home section copy: testimonials (EN). Must have exactly the shape of the Indonesian copy in ./testimonials.ts. */
import type { testimonials as idCopy } from './testimonials'

export const testimonials: typeof idCopy = {
  eyebrow: 'What it feels like',
  title: 'What working with us feels like.',
  lead: 'The three stories below are illustrations we wrote to show the outcomes we aim for. None of them is a real client review.',
  label: 'Illustration, not a real client review',
  carouselLabel: 'Illustrative testimonials',
  slideOf: (n: number, total: number) => `${n} of ${total}`,
  prev: 'Previous testimonial',
  next: 'Next testimonial',
  goTo: (n: number) => `Show testimonial ${n}`,
  pause: 'Pause autoplay',
  play: 'Resume autoplay',
  hint: 'Swipe, or use the arrow keys',
  status: (n: number, total: number, who: string) => `Testimonial ${n} of ${total}: ${who}`,
  items: [
    {
      icon: 'cup',
      service: 'POS & Business Systems',
      quote:
        'I used to log coffee bean stock in a notebook and it was off almost every week. Now the till and the stock talk to each other, so I check the daily report on my phone before closing up.',
      role: 'Coffee shop owner',
      place: 'Yogyakarta',
    },
    {
      icon: 'bag',
      service: 'Website & Automation',
      quote:
        'Orders that came in over chat used to be copied into a spreadsheet one by one. Now they all land in one dashboard and customers get an automatic confirmation. My evenings are a lot calmer.',
      role: 'Online store manager',
      place: 'Surabaya',
    },
    {
      icon: 'phone',
      service: 'Mobile App',
      quote:
        'Members no longer queue at the office just to ask what they still owe. They check it in the app, and the board can focus on the things that really need a face-to-face talk.',
      role: 'Savings & loan cooperative board member',
      place: 'Makassar',
    },
  ],
}
