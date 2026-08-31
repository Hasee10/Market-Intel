'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { hasFeature } from '@/lib/market-intel/entitlements';
import { createClient } from '@/lib/supabase/server';

export type Seller = {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  planTier: string;
  onboardedAt: string | null;
  reportingCurrency: string;
  /** ISO 3166-1 alpha-2. Defaults to 'PK' at the DB level (migration 027). */
  country: string;
};

export type SellerDomain = {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
};

// Every authenticated request in this app already has a `sellers` row -
// the 013_seller_signup_trigger.sql trigger creates it at auth.users insert
// time. Returns null only if the caller isn't signed in.
//
// There is deliberately no dev bypass here any more. This used to fall back
// to "the newest `sellers` row" under BYPASS_AUTH=1, which meant the identity
// of the current user was whoever signed up last - fine with one seller,
// cross-tenant data exposure with two (leaks.md finding #2). To work on the
// dashboard locally, sign up a real account; the flow works end to end.
//
// Wrapped in React's cache() so the whole thing runs at most once per
// request. This is the hottest function in the app - every page, every
// /api/ecommerce/* route and most lib functions call it - and each call
// used to cost two round-trips: supabase.auth.getUser() goes over the
// network to Supabase's auth service (it is not a local JWT decode), then
// a `sellers` row lookup. The Market page alone reached it a dozen times
// via different lib modules. cache() is per-request and per-argument, so
// this changes nothing about isolation between users or between requests.
export const getCurrentSeller = cache(async function getCurrentSeller(): Promise<Seller | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('sellers')
    .select('id, user_id, business_name, email, plan_tier, onboarded_at, reporting_currency, country')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    businessName: data.business_name,
    email: data.email,
    planTier: data.plan_tier,
    onboardedAt: data.onboarded_at,
    reportingCurrency: data.reporting_currency,
    country: data.country,
  };
});

// Real server-side auth guard for the protected layouts (dashboard/apps/
// onboarding). middleware.ts's redirect only checks whether a
// sb-*-auth-token cookie is *present* - not whether it's still valid - so a
// stale/expired cookie sails past it, the dashboard shell renders, and only
// then does getCurrentSeller()'s real supabase.auth.getUser() check
// discover there's no real session, surfacing as an in-page "Not
// authenticated" error instead of a clean redirect. This closes that gap:
// every protected layout calls this before rendering anything, so a failed
// real auth check redirects to sign-in instead of ever showing the shell.
export async function requireSeller(): Promise<Seller> {
  const seller = await getCurrentSeller();
  if (!seller) {
    redirect('/auth/signin');
  }
  return seller;
}

// Same auth guard as requireSeller(), plus a redirect to /onboarding for any
// seller who hasn't picked a category yet. Signup used to drop a brand-new
// seller straight onto an empty Overview page with domain-selection buried
// as just one item in a "Getting started" checklist they could ignore -
// meaning the one thing that doesn't need their own store data (peer/
// competitor pricing, gated only by category) was the slowest thing to
// reach. dashboard/ and apps/ use this instead of requireSeller() so every
// route under them enforces the same order; onboarding/ itself must keep
// using plain requireSeller() or this would redirect-loop.
export async function requireOnboardedSeller(): Promise<Seller> {
  const seller = await requireSeller();
  const domain = await getPrimaryDomain(seller.id);
  if (!domain) {
    redirect('/onboarding');
  }
  return seller;
}

// A seller's primary domain, if they've completed onboarding
// (see app/onboarding). Null until seller_domains has an is_primary row.
// cache()d for the same reason as getCurrentSeller above - every dashboard
// page resolves it, and requireOnboardedSeller() resolves it again in the
// layout that wraps those same pages.
export const getPrimaryDomain = cache(async function getPrimaryDomain(
  sellerId: string,
): Promise<SellerDomain | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_domains')
    .select('category_id, seller_categories(slug, name)')
    .eq('seller_id', sellerId)
    .eq('is_primary', true)
    .maybeSingle();

  if (error || !data) return null;

  const category = Array.isArray(data.seller_categories)
    ? data.seller_categories[0]
    : data.seller_categories;

  if (!category) return null;

  return {
    categoryId: data.category_id,
    categorySlug: category.slug,
    categoryName: category.name,
  };
});

export async function listCategories() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_categories')
    .select('id, slug, name')
    .order('name');

  if (error || !data) return [];

  return data;
}

export type SellerDomainRow = {
  id: string;
  categoryId: string;
  categoryName: string;
  isPrimary: boolean;
};

// All of a seller's category links, not just the primary one -
// seller_domains has always supported many-to-many (see
// 011_create_seller_platform_tables.sql's unique(seller_id, category_id)),
// only the onboarding flow ever surfaced a single "primary" pick.
export async function listSellerDomains(sellerId: string): Promise<SellerDomainRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_domains')
    .select('id, category_id, is_primary, seller_categories(name)')
    .eq('seller_id', sellerId)
    .order('is_primary', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => {
    const category = Array.isArray(row.seller_categories) ? row.seller_categories[0] : row.seller_categories;
    return {
      id: row.id,
      categoryId: row.category_id,
      categoryName: category?.name ?? 'Unknown',
      isPrimary: row.is_primary,
    };
  });
}

// Just the slugs, for callers that need to resolve a market scope per
// domain (e.g. getMarketScopeForAllDomains) rather than render a list -
// listSellerDomains() above joins seller_categories(name) only, since
// that's all the Settings page needs, so this is a separate small query
// rather than widening that one's shape for every existing caller.
export const listSellerDomainSlugs = cache(async function listSellerDomainSlugs(
  sellerId: string,
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_domains')
    .select('seller_categories(slug)')
    .eq('seller_id', sellerId);

  if (error || !data) return [];

  return data
    .map((row: any) => {
      const category = Array.isArray(row.seller_categories) ? row.seller_categories[0] : row.seller_categories;
      return category?.slug as string | undefined;
    })
    .filter((slug): slug is string => Boolean(slug));
});

export type AutoAssignDomainsResult = {
  added: string[];
  skippedNeedsPremium: string[];
};

// Best-effort side effect of bulk CSV import: a category a seller's rows
// got auto-categorized into (see suggestCategoriesBatch in bulk-import's
// route) isn't visible on Market Definition/Competitors until it's also a
// tracked domain (seller_domains, distinct from a product's own
// category_id) - getMarketScope() reads domains, not product categories,
// to decide what a seller competes in. Without this, a seller importing
// products in a brand-new category would see them listed but never show
// up in competitor matching, with no obvious reason why.
//
// Mirrors api/domains/route.ts's POST handler exactly: the first domain a
// seller ever gets is always free (is_primary: true, no plan check);
// anything beyond that needs the Premium multi_domain entitlement. Skips
// categories already tracked. Never throws - a failure here should never
// break the product import itself, same posture as
// persistCompetitorMatches() in product-matching.ts.
export async function autoAssignDomainsForCategories(
  seller: Pick<Seller, 'id' | 'planTier'>,
  categoryIds: string[],
): Promise<AutoAssignDomainsResult> {
  const result: AutoAssignDomainsResult = { added: [], skippedNeedsPremium: [] };
  const uniqueCategoryIds = [...new Set(categoryIds)];
  if (uniqueCategoryIds.length === 0) return result;

  try {
    const supabase = await createClient();

    const { data: existingDomains } = await supabase
      .from('seller_domains')
      .select('category_id')
      .eq('seller_id', seller.id);
    const alreadyTracked = new Set((existingDomains ?? []).map((d) => d.category_id));

    const newCategoryIds = uniqueCategoryIds.filter((id) => !alreadyTracked.has(id));
    if (newCategoryIds.length === 0) return result;

    let hasAnyDomain = alreadyTracked.size > 0;
    const rows: { seller_id: string; category_id: string; is_primary: boolean }[] = [];

    for (const categoryId of newCategoryIds) {
      if (!hasAnyDomain) {
        // The very first domain a seller ever gets, free on every plan -
        // same rule as the manual "Add domain" flow.
        rows.push({ seller_id: seller.id, category_id: categoryId, is_primary: true });
        hasAnyDomain = true;
      } else if (hasFeature(seller.planTier, 'multi_domain')) {
        rows.push({ seller_id: seller.id, category_id: categoryId, is_primary: false });
      } else {
        result.skippedNeedsPremium.push(categoryId);
      }
    }

    if (rows.length === 0) return result;

    const { error } = await supabase.from('seller_domains').upsert(rows, { onConflict: 'seller_id,category_id' });
    if (!error) result.added.push(...rows.map((r) => r.category_id));
  } catch {
    // ignored - see function comment above
  }

  return result;
}
