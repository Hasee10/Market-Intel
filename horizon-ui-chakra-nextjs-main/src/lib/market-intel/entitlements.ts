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

const FEATURE_MIN_TIER: Record<Feature, PlanTier> = {
  peer_benchmarks: 'paid',
  watchlists: 'paid',
  product_matching: 'premium',
  pricing_recommendations: 'premium',
  forecasting: 'premium',
  anomaly_detection: 'premium',
  multi_domain: 'premium',
};

export function hasFeature(planTier: string, feature: Feature): boolean {
  // Dev/test escape hatch, mirrors the BYPASS_AUTH pattern in seller.ts -
  // unset in production (Vercel), so real sellers still hit the real
  // plan-tier gate. Only set this locally when you want to see paid/premium
  // screens without changing your own sellers.plan_tier row.
  if (process.env.BYPASS_ENTITLEMENTS === '1') return true;
  const tier = (planTier in TIER_RANK ? planTier : 'free') as PlanTier;
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export function minTierFor(feature: Feature): PlanTier {
  return FEATURE_MIN_TIER[feature];
}

export function planLabel(tier: PlanTier): string {
  return { free: 'Free', paid: 'Paid', premium: 'Premium' }[tier];
}
