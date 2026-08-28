'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { PATH_DASHBOARD } from '@/lib/paths';
import { SUPPORTED_COUNTRIES } from '@/lib/market-intel/countries';

const VALID_COUNTRY_CODES = new Set<string>(SUPPORTED_COUNTRIES.map((c) => c.code));

export async function setPrimaryDomain(categoryId: string, country: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (sellerError || !seller) {
    return { error: 'Could not find your seller account. Try signing in again.' };
  }

  // Only one primary domain per seller for now - clear any previous pick
  // before setting the new one so re-running onboarding doesn't leave two.
  await supabase
    .from('seller_domains')
    .update({ is_primary: false })
    .eq('seller_id', seller.id);

  const { error: domainError } = await supabase
    .from('seller_domains')
    .upsert(
      { seller_id: seller.id, category_id: categoryId, is_primary: true },
      { onConflict: 'seller_id,category_id' },
    );

  if (domainError) {
    return { error: 'Could not save your domain. Please try again.' };
  }

  // Onboarding stays a single round-trip: country and onboarded_at land in
  // the same update as the domain pick, not a separate Settings visit.
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
