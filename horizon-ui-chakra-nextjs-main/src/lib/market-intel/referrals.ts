'server-only';

import { createAdminClient, createClient } from '@/lib/supabase/server';

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Every seller gets a code lazily, the first time it's needed (Settings
// page load) - avoids a signup-time dependency and lets existing sellers
// pick one up automatically. Collisions are astronomically unlikely at
// this scale (36^6 codes) but retried once anyway since referral_code is
// unique.
export async function getOrCreateReferralCode(sellerId: string): Promise<string> {
  const supabase = await createClient();

  const { data: existing } = await supabase.from('sellers').select('referral_code').eq('id', sellerId).single();
  if (existing?.referral_code) return existing.referral_code;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateCode();
    const { error } = await supabase.from('sellers').update({ referral_code: code }).eq('id', sellerId);
    if (!error) return code;
  }

  throw new Error('Failed to generate a referral code');
}

export type ReferralStats = {
  code: string;
  joinedCount: number;
  pendingCount: number;
};

const REWARD_JOINS_FOR_PAID = 3;

export async function getReferralStats(sellerId: string): Promise<ReferralStats> {
  const supabase = await createClient();
  const code = await getOrCreateReferralCode(sellerId);

  const { data } = await supabase.from('seller_referrals').select('status').eq('referrer_seller_id', sellerId);

  const joinedCount = (data ?? []).filter((r) => r.status === 'joined').length;
  const pendingCount = (data ?? []).filter((r) => r.status === 'pending').length;

  return { code, joinedCount, pendingCount };
}

// Called once at signup time (see auth/signup/page.tsx, via
// /api/referrals/record) when a ?ref=CODE param was present. Uses the
// service-role client rather than the cookie-bound one: this runs
// immediately after supabase.auth.signUp() resolves, before there's
// necessarily a session (email confirmation may still be pending), and it
// needs to read/write the *referrer's* row, not the new seller's own.
// Links the new seller to whoever referred them and grants the growth
// reward - see REWARD_JOINS_FOR_PAID below. No payment provider exists yet
// (see entitlements.ts), so this is the one real, non-monetary way a
// seller can move off the free tier today: bring in enough sellers in the
// same category to make the benchmark pool worth more to everyone, and get
// rewarded for it directly.
export async function recordReferralSignup(referralCode: string, newSellerId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: referrer } = await supabase
    .from('sellers')
    .select('id, plan_tier')
    .eq('referral_code', referralCode)
    .maybeSingle();

  if (!referrer || referrer.id === newSellerId) return;

  await supabase.from('seller_referrals').insert({
    referrer_seller_id: referrer.id,
    referral_code: referralCode,
    status: 'joined',
    joined_seller_id: newSellerId,
    joined_at: new Date().toISOString(),
  });

  const { data: allReferrals } = await supabase
    .from('seller_referrals')
    .select('status')
    .eq('referrer_seller_id', referrer.id);

  const joinedCount = (allReferrals ?? []).filter((r) => r.status === 'joined').length;

  if (joinedCount >= REWARD_JOINS_FOR_PAID && referrer.plan_tier === 'free') {
    await supabase.from('sellers').update({ plan_tier: 'paid' }).eq('id', referrer.id);
  }
}
