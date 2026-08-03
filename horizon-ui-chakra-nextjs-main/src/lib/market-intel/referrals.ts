'server-only';

import { randomInt } from 'crypto';

import { createClient } from '@/lib/supabase/server';

// Excludes I/O/0/1 - these codes get read aloud and retyped, and the
// ambiguous glyphs cost more in failed signups than the bits they add.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

// crypto.randomInt, not Math.random: a referral code is a bearer token for
// the free->paid reward, and Math.random is a seeded PRNG whose future
// output is derivable from observed draws (leaks.md finding #8). 32^8 = 40
// bits of real entropy, so enumerating a valid code isn't practical.
function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
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

// Display only ("N of 3 joined"). The reward is applied by the signup
// trigger in 018_referral_integrity.sql, which holds the authoritative
// threshold - keep the two in sync if it ever changes.
export const REWARD_JOINS_FOR_PAID = 3;

export async function getReferralStats(sellerId: string): Promise<ReferralStats> {
  const supabase = await createClient();
  const code = await getOrCreateReferralCode(sellerId);

  const { data } = await supabase.from('seller_referrals').select('status').eq('referrer_seller_id', sellerId);

  const joinedCount = (data ?? []).filter((r) => r.status === 'joined').length;
  const pendingCount = (data ?? []).filter((r) => r.status === 'pending').length;

  return { code, joinedCount, pendingCount };
}

// Referral *recording* deliberately has no TypeScript writer any more. It
// used to live here, called by /api/referrals/record with a caller-supplied
// userId over the service-role client - an endpoint that could not be
// session-gated (no session exists at signup while email confirmation is
// pending) and so let anyone forge joins until they earned the free->paid
// reward (leaks.md finding #1). The write now happens inside the signup DB
// trigger (018_referral_integrity.sql), where the only way to submit a code
// is to genuinely create an auth user. Do not reintroduce an HTTP writer.
