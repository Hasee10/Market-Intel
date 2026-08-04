import { describe, it, expect } from 'vitest';
import { hasFeature, minTierFor, planLabel } from './entitlements';

describe('hasFeature', () => {
  it('gates a paid-tier feature from a free seller', () => {
    expect(hasFeature('free', 'watchlists')).toBe(false);
  });

  it('grants a paid-tier feature to a paid seller', () => {
    expect(hasFeature('paid', 'watchlists')).toBe(true);
  });

  it('gates a premium-only feature from a paid seller', () => {
    expect(hasFeature('paid', 'forecasting')).toBe(false);
  });

  it('grants a premium feature, and everything below it, to a premium seller', () => {
    expect(hasFeature('premium', 'forecasting')).toBe(true);
    expect(hasFeature('premium', 'watchlists')).toBe(true);
  });

  it('treats an unrecognized plan_tier value as free rather than granting access', () => {
    // Every feature requires at least 'paid', so a corrupt/unexpected
    // sellers.plan_tier value must never rank above 'free' here - this is
    // the entire safety property hasFeature exists to guarantee.
    expect(hasFeature('enterprise', 'watchlists')).toBe(false);
    expect(hasFeature('', 'pricing_recommendations')).toBe(false);
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
