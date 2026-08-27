import { describe, it, expect } from 'vitest';
import { hasFeature, minTierFor, planLabel, tierMeetsRequirement } from './entitlements';

// Real per-tier gating logic, exercised directly since hasFeature itself is
// currently short-circuited by DEMO_ALL_FEATURES_UNLOCKED (see entitlements.ts).
// This is what gets restored when demo mode is switched back off, so it stays
// covered even though hasFeature doesn't currently call through to it.
describe('tierMeetsRequirement', () => {
  it('gates a paid-tier feature from a free seller', () => {
    expect(tierMeetsRequirement('free', 'watchlists')).toBe(false);
  });

  it('grants a paid-tier feature to a paid seller', () => {
    expect(tierMeetsRequirement('paid', 'watchlists')).toBe(true);
  });

  it('gates a premium-only feature from a paid seller', () => {
    expect(tierMeetsRequirement('paid', 'forecasting')).toBe(false);
  });

  it('grants a premium feature, and everything below it, to a premium seller', () => {
    expect(tierMeetsRequirement('premium', 'forecasting')).toBe(true);
    expect(tierMeetsRequirement('premium', 'watchlists')).toBe(true);
  });

  it('treats an unrecognized plan_tier value as free rather than granting access', () => {
    // Every feature requires at least 'paid', so a corrupt/unexpected
    // sellers.plan_tier value must never rank above 'free' here - this is
    // the entire safety property tierMeetsRequirement exists to guarantee.
    expect(tierMeetsRequirement('enterprise', 'watchlists')).toBe(false);
    expect(tierMeetsRequirement('', 'pricing_recommendations')).toBe(false);
  });
});

describe('hasFeature (demo mode)', () => {
  it('unlocks every feature for every plan tier, including free and unrecognized values', () => {
    expect(hasFeature('free', 'watchlists')).toBe(true);
    expect(hasFeature('free', 'forecasting')).toBe(true);
    expect(hasFeature('enterprise', 'peer_benchmarks')).toBe(true);
    expect(hasFeature('', 'multi_domain')).toBe(true);
  });
});

describe('minTierFor', () => {
  it('places the competitor-intelligence loop at paid, since it works from a seller\'s first login', () => {
    expect(minTierFor('watchlists')).toBe('paid');
    expect(minTierFor('product_matching')).toBe('paid');
    expect(minTierFor('pricing_recommendations')).toBe('paid');
  });

  it('keeps peer_benchmarks at premium, not paid, since it needs an opted-in peer network to render anything', () => {
    // Regression guard for the specific tier move documented in
    // entitlements.ts's own comment - it used to sit at 'paid', which sold
    // the cheapest upgrade partly on a screen that couldn't populate yet.
    expect(minTierFor('peer_benchmarks')).toBe('premium');
  });
});

describe('planLabel', () => {
  it('renders the display label for each tier', () => {
    expect(planLabel('free')).toBe('Free');
    expect(planLabel('paid')).toBe('Paid');
    expect(planLabel('premium')).toBe('Premium');
  });
});
