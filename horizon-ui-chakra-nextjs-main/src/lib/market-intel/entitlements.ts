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
  | 'competitor_intel'
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
  // Competitor scorecards (ROADMAP.md C1). Paid rather than premium for the
  // same reason as the rest of this block: it is computed from scraped
  // marketplace listings, so it populates on a brand-new account with no peer
  // network. It renders empty for a seller whose market has no true
  // marketplace in it, which the page states outright rather than gating.
  competitor_intel: 'paid',

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

// DEMO MODE: every feature is unlocked for every seller, regardless of
// sellers.plan_tier, so the full app (including paid/premium screens) can be
// walked through live without seeding plan_tier rows in Supabase first.
// There is no billing provider wired up yet (see header comment), so this
// does not bypass any real payment - it only skips the manual-tier-setting
// step. The real per-feature tier logic below is untouched and still fully
// tested (see tierMeetsRequirement's tests in entitlements.test.ts) - flip
// DEMO_ALL_FEATURES_UNLOCKED back to false to restore real gating once a
// checkout flow exists and paid tiers need to mean something again.
const DEMO_ALL_FEATURES_UNLOCKED = true;

export function tierMeetsRequirement(planTier: string, feature: Feature): boolean {
  const tier = (planTier in TIER_RANK ? planTier : 'free') as PlanTier;
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export function hasFeature(planTier: string, feature: Feature): boolean {
  if (DEMO_ALL_FEATURES_UNLOCKED) return true;
  return tierMeetsRequirement(planTier, feature);
}

export function minTierFor(feature: Feature): PlanTier {
  return FEATURE_MIN_TIER[feature];
}

export function planLabel(tier: PlanTier): string {
  return { free: 'Free', paid: 'Paid', premium: 'Premium' }[tier];
}
