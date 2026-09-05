'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { autoAssignDomainsForCategories } from '@/lib/market-intel/seller/seller';
import { PATH_DASHBOARD } from '@/lib/paths';
import { SUPPORTED_COUNTRIES } from '@/lib/market-intel/core/countries';

const VALID_COUNTRY_CODES = new Set<string>(SUPPORTED_COUNTRIES.map((c) => c.code));
const MAX_ONBOARDING_DOMAINS = 3;

// Replaces the old single-domain setPrimaryDomain. Takes 1-3 category picks
// (the picker caps the UI at 3) and applies the same free-first/premium-rest
// rule the manual "Add domain" flow uses (autoAssignDomainsForCategories),
// rather than a second copy of that check living here.
export async function completeOnboarding(categoryIds: string[], country: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, plan_tier')
    .eq('user_id', user.id)
    .single();

  if (sellerError || !seller) {
    return { error: 'Could not find your seller account. Try signing in again.' };
  }

  const uniqueCategoryIds = [...new Set(categoryIds)].slice(0, MAX_ONBOARDING_DOMAINS);
  if (uniqueCategoryIds.length === 0) {
    return { error: 'Pick at least one category to continue' };
  }

  // This page only renders while the seller has no primary domain (see
  // page.tsx's redirect), so any seller_domains rows here are leftovers
  // from an abandoned attempt - clear them so "first domain is free"
  // applies to this submission, not a stale one, and re-running onboarding
  // doesn't layer duplicate/stale picks on top.
  await supabase.from('seller_domains').delete().eq('seller_id', seller.id);

  const result = await autoAssignDomainsForCategories(
    { id: seller.id, planTier: seller.plan_tier },
    uniqueCategoryIds,
  );

  if (result.added.length === 0) {
    return { error: 'Could not save your domain. Please try again.' };
  }

  // Onboarding stays a single round-trip: country and onboarded_at land in
  // the same submission as the domain picks, not a separate Settings visit.
  // An invalid/unmapped code silently keeps the column's own 'PK' default
  // rather than erroring the whole flow over a cosmetic field.
  await supabase
    .from('sellers')
    .update({
      onboarded_at: new Date().toISOString(),
      ...(VALID_COUNTRY_CODES.has(country) ? { country } : {}),
    })
    .eq('id', seller.id);

  redirect(PATH_DASHBOARD.market);
}
