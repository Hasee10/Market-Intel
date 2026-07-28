'server-only';

import { createClient, isBypassedNoSession } from '@/lib/supabase/server';

export type Seller = {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  planTier: string;
  onboardedAt: string | null;
};

export type SellerDomain = {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
};

// Every authenticated request in this app already has a `sellers` row -
// the 013_seller_signup_trigger.sql trigger creates it at auth.users insert
// time. Returns null only if the caller isn't signed in.
export async function getCurrentSeller(): Promise<Seller | null> {
  const supabase = await createClient();

  // Dev-only: BYPASS_AUTH=1 with no session - createClient() already handed
  // back a service-role client above, so just grab the first seller instead
  // of resolving a real auth.uid(). Remove once Clerk auth is wired up.
  if (await isBypassedNoSession()) {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, user_id, business_name, email, plan_tier, onboarded_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      businessName: data.business_name,
      email: data.email,
      planTier: data.plan_tier,
      onboardedAt: data.onboarded_at,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('sellers')
    .select('id, user_id, business_name, email, plan_tier, onboarded_at')
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
  };
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
