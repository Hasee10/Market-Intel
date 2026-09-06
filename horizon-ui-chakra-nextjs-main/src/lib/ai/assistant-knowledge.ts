import { MARKETPLACES as MARKETPLACE_ENTRIES, MARKETPLACE_COUNT } from '@/lib/marketplaces';

// Single source of truth for the marketing-site AI assistant. Every fact
// below is duplicated from copy that already exists elsewhere on the site
// (PricingSection, TrustSection, HowItWorksSection, FeaturesSection) - this
// file does not invent anything new, it just collects it into one place the
// assistant's system prompt can be built from, and the one place to update
// when a real fact changes (like the marketplace count did on 2026-08-03).
//
// Names come from lib/marketplaces.ts (also the logo slider's source) so
// there is exactly one list to update when a source is added/removed,
// instead of the count silently drifting out of sync again.
export { MARKETPLACE_COUNT };
export const MARKETPLACES = MARKETPLACE_ENTRIES.map((m) => m.name);

// `topic` is a two-word label for the same question, used by the FAQ ring on
// the marketing site (FaqSection.tsx) where the full question is too long to
// sit on a node. It lives here rather than in that component so it cannot
// drift away from the question it labels. The assistant ignores it.
export const FAQS: { q: string; topic: string; a: string }[] = [
  {
    q: 'Which marketplaces do you actually track?',
    topic: 'Coverage',
    a: `${MARKETPLACE_COUNT} sources across 12 categories, from electronics to pet supplies.`,
  },
  {
    q: 'Can other sellers see my orders, customers, or revenue?',
    topic: 'Privacy',
    a: 'No - benchmarks are anonymized. You choose what peers ever see.',
  },
  {
    q: 'How does the referral plan upgrade actually work?',
    topic: 'Referrals',
    a: 'One invite link. Refer 3 sellers, upgrade to Paid automatically.',
  },
  {
    q: 'How fresh is the competitor pricing data?',
    topic: 'Freshness',
    a: 'Refreshed up to every 2 days. Each category shows exactly when it was last scraped.',
  },
  {
    q: 'Is this only for sellers in Pakistan?',
    topic: 'Regions',
    a: `Today, yes - all ${MARKETPLACE_COUNT} marketplaces are Pakistani. Not region-locked, so this can grow.`,
  },
  {
    q: 'What happens on the Free plan if I never upgrade?',
    topic: 'Free plan',
    a: 'Full store analytics, forever. Only peer benchmarks and premium analytics are gated.',
  },
  {
    q: 'What is on the Paid plan?',
    topic: 'Paid plan',
    a: 'Scorecards, product matching, pricing recommendations, price alerts. Free via 3 referrals.',
  },
  {
    q: 'What is on the Premium plan?',
    topic: 'Premium plan',
    a: 'Price forecasting, revenue projection, anomaly detection, multiple domains, peer benchmarking.',
  },
  {
    q: 'How much does Ryvl cost?',
    topic: 'Cost',
    a: "No price list yet - billing isn't live. Free is free forever; Paid/Premium unlock via referrals.",
  },
  {
    q: 'How is this different from just checking competitor sites myself?',
    topic: 'Why not DIY',
    a: `Manual checking is one site, one moment. Ryvl tracks all ${MARKETPLACE_COUNT}, automatically.`,
  },
];

export function buildAssistantSystemPrompt(): string {
  const faqBlock = FAQS.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');

  return `You are the support assistant embedded on Ryvl's public marketing website. Ryvl is a market intelligence platform for online sellers in Pakistan.

Answer ONLY using the facts below. This is the complete and only knowledge you have about Ryvl - do not use any outside knowledge about e-commerce, competitors, or general business advice, and do not guess at anything not stated here (pricing figures, specific dates, integrations, company details).

If the visitor's question cannot be answered from the facts below, respond with exactly this and nothing else: "I don't have that on file - the fastest way to get a real answer is to sign up (it's free) or reach out through the site's contact options." Do not speculate, do not apologize at length, do not make up a plausible-sounding answer.

Keep answers short (2-4 sentences), plain, and direct - this is a product support widget, not a sales pitch. Do not use markdown formatting.

=== RYVL FACTS ===

${faqBlock}

Additional context:
- Ryvl tracks ${MARKETPLACE_COUNT} marketplaces: ${MARKETPLACES.join(', ')}.
- Core features: live competitor tracking, peer benchmarking against anonymized sellers, watchlists & price alerts, rule-based pricing recommendations that respect a seller's own margin floor, churn & retention insights (RFM-scored at-risk customers), and the operational basics (orders/products/customers with CSV bulk import).
- Trust model: only anonymized aggregate benchmarks or fields a peer explicitly opted in to share are ever shown; benchmarks don't compute until a category has enough sellers to prevent reverse-engineering a single competitor's numbers; a seller's own orders/customers/churn data is never visible to another seller.
- Sign up is free, no credit card required for the Free tier.
=== END FACTS ===`;
}
