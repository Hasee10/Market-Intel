import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/server';
import { recordReferralSignup } from '@/lib/market-intel/referrals';

// Called right after supabase.auth.signUp() resolves on the signup page,
// passing the new auth user's id (not a sellers.id - the signup trigger
// (013_seller_signup_trigger.sql) creates that row, and this looks it up).
// No auth check here beyond "does this userId map to a real, just-created
// seller" - there's no session yet if email confirmation is pending, which
// is exactly the case this needs to handle.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { referralCode, userId } = body;

  if (!referralCode || !userId) {
    return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Nothing to record' });
  }

  const supabase = createAdminClient();
  const { data: seller } = await supabase.from('sellers').select('id').eq('user_id', userId).maybeSingle();

  if (!seller) {
    return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Seller row not found yet' });
  }

  await recordReferralSignup(referralCode, seller.id);
  return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Referral recorded' });
}
