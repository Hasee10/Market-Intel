'server-only';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export type Seller = {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  planTier: string;
  onboardedAt: string | null;
  reportingCurrency: string;
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
export async function getCurrentSeller(): Promise<Seller | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('sellers')
    .select('id, user_id, business_name, email, plan_tier, onboarded_at, reporting_currency')
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
  };
}

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
export async function getPrimaryDomain(sellerId: string): Promise<SellerDomain | null> {
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
}

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
