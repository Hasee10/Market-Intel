'server-only';

// Plan-tier boundaries - the concrete decision new_implementation_doc.md's
// "open decisions" section flagged as needed before gating anything:
//   free    - your own store analytics only (Overview, Products, Customers,
//             Orders, Settings, own churn/RFM).
//   paid    - + peer benchmarks and the watchlist/price-alerts loop.
//   premium - + product matching, pricing recommendations, forecasting,
//             anomaly detection, and multiple domains.
// No billing provider is wired up yet - this only gates rendering
// server-side (see UpgradeGate.tsx). Plan changes today happen by updating
// sellers.plan_tier directly (via Supabase) or via the referral reward in
// referrals.ts, not a self-serve checkout, since faking a payment flow
// would be worse than not having one.
export type PlanTier = 'free' | 'paid' | 'premium';

export type Feature =
  | 'peer_benchmarks'
  | 'watchlists'
  | 'product_matching'
  | 'pricing_recommendations'
  | 'forecasting'
  | 'anomaly_detection'
  | 'multi_domain';

const TIER_RANK: Record<PlanTier, number> = { free: 0, paid: 1, premium: 2 };

// Ordering principle (ROADMAP.md Phase B): a tier may only charge for
// things that actually render for a brand-new seller with no other sellers
// on the platform. Everything derived from scraped competitor data
// qualifies on day one; anything needing a peer network does not.
const FEATURE_MIN_TIER: Record<Feature, PlanTier> = {
  // Paid - the competitor-intelligence loop. All of these run purely off
  // scraped market data plus the seller's own catalog, so they work from
  // the first login with zero other customers on the platform.
  watchlists: 'paid',
  product_matching: 'paid',
  pricing_recommendations: 'paid',

  // Premium - derived analytics on top of accumulated history.
  forecasting: 'premium',
  anomaly_detection: 'premium',
  multi_domain: 'premium',

  // Premium, and deliberately not a headline feature: domain_benchmarks
  // needs MIN_SAMPLE_SIZE (3) opted-in sellers sharing a category before it
  // writes a single row (benchmarks-job.ts), so it renders empty until the
  // network reaches that density. It used to sit at 'paid', which meant the
  // cheapest upgrade was sold partly on a screen that cannot populate yet.
  // Treat it as upside that unlocks with scale, not as something we promise.
  peer_benchmarks: 'premium',
};

// No dev escape hatch. BYPASS_ENTITLEMENTS=1 used to unlock every gate, which
// meant local development never once exercised the free-tier experience -
// the thing every new seller actually sees. To view paid/premium screens,
// set your own `sellers.plan_tier` in Supabase, which is also how a real
// upgrade happens today (there is no checkout yet).
export function hasFeature(planTier: string, feature: Feature): boolean {
  const tier = (planTier in TIER_RANK ? planTier : 'free') as PlanTier;
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export function minTierFor(feature: Feature): PlanTier {
  return FEATURE_MIN_TIER[feature];
}

export function planLabel(tier: PlanTier): string {
  return { free: 'Free', paid: 'Paid', premium: 'Premium' }[tier];
}
