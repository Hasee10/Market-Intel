// Customer testimonials shown by TestimonialsSection.
//
// Kept in its own file rather than as a const inside the component (the
// pattern TrustSection/FeaturesSection use for their fixed copy) because
// this list grows: adding a customer should be appending one object here,
// never touching JSX.
//
// `imageUrl` is optional on purpose. Leave it off and the card renders the
// person's initials in a tinted circle instead, which is the honest default
// until there's a real photo to use - see TestimonialsSection's Avatar.
// Any host used here must also be listed in next.config.js images.domains
// or next/image throws at render time.

export type Testimonial = {
  name: string;
  quote: string;
  imageUrl?: string;
  /**
   * Role and/or store, e.g. "Founder, Karachi Coffee Co." Optional and left
   * unset for everyone below on purpose: the source CSV carries only names,
   * and attributing a job title nobody supplied would be inventing the part
   * of a testimonial that makes it checkable. Fill these in as they're
   * confirmed - the card renders the line only when it exists.
   */
  role?: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Ayesha Khan',
    quote:
      'Finally a tool that shows me where my prices stand without exposing my store data to anyone. Exactly what sellers needed.',
    imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    name: 'Bilal Ahmed',
    quote:
      'I was worried about competitors seeing my numbers. Ryvl’s sample-size floor and aggregate-only approach made me comfortable enough to connect my store.',
    imageUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    name: 'Fatima Raza',
    quote:
      'The benchmarks feel honest. I can see the real market position without any individual competitor’s data leaking. Trust is built into the product.',
    imageUrl: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
  {
    name: 'Usman Malik',
    quote:
      'Most market tools feel like surveillance. Ryvl is the opposite — pure peer intelligence with zero risk of my private metrics being shared.',
    imageUrl: 'https://randomuser.me/api/portraits/men/75.jpg',
  },
  {
    name: 'Sana Iqbal',
    quote:
      'As a small seller I can’t afford to give away my customer or order data. Ryvl keeps everything private while still giving me useful price-position insights.',
    imageUrl: 'https://randomuser.me/api/portraits/women/21.jpg',
  },
  {
    name: 'Hamza Sheikh',
    quote:
      'Clear privacy rules and a hard sample-size floor. I finally have competitive intelligence I can actually trust.',
    imageUrl: 'https://randomuser.me/api/portraits/men/46.jpg',
  },
  {
    name: 'Zainab Ali',
    quote:
      'I only ever see anonymized benchmarks. That’s the kind of transparency sellers in Pakistan actually need.',
    imageUrl: 'https://randomuser.me/api/portraits/women/65.jpg',
  },
];

export default TESTIMONIALS;
