import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';

function mapPublicProfile(row: any) {
  return {
    isPublic: row?.is_public ?? false,
    displayName: row?.display_name ?? '',
    showPricePosition: row?.show_price_position ?? false,
    showRating: row?.show_rating ?? false,
    showCategoryRank: row?.show_category_rank ?? false,
  };
}

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const supabase = await createClient();
  const { data: publicProfile, error } = await supabase
    .from('seller_public_profile')
    .select('is_public, display_name, show_price_position, show_rating, show_category_rank')
    .eq('seller_id', seller.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to fetch settings' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: {
      businessName: seller.businessName,
      email: seller.email,
      planTier: seller.planTier,
      onboardedAt: seller.onboardedAt,
      publicProfile: mapPublicProfile(publicProfile),
    },
    errors: [],
    message: 'Settings retrieved successfully',
  });
}

export async function PUT(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const body = await request.json();
  const supabase = await createClient();

  if (typeof body.businessName === 'string' && body.businessName.trim()) {
    const { error } = await supabase
      .from('sellers')
      .update({ business_name: body.businessName.trim() })
      .eq('id', seller.id);

    if (error) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: [error.message], message: 'Failed to update business name' },
        { status: 400 },
      );
    }
  }

  const publicProfile = body.publicProfile ?? {};
  const { data: updatedProfile, error: profileError } = await supabase
    .from('seller_public_profile')
    .upsert({
      seller_id: seller.id,
      is_public: !!publicProfile.isPublic,
      display_name: publicProfile.displayName || null,
      show_price_position: !!publicProfile.showPricePosition,
      show_rating: !!publicProfile.showRating,
      show_category_rank: !!publicProfile.showCategoryRank,
    })
    .select('is_public, display_name, show_price_position, show_rating, show_category_rank')
    .single();

  if (profileError) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [profileError.message], message: 'Failed to update public profile' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: {
      businessName: body.businessName ?? seller.businessName,
      email: seller.email,
      planTier: seller.planTier,
      onboardedAt: seller.onboardedAt,
      publicProfile: mapPublicProfile(updatedProfile),
    },
    errors: [],
    message: 'Settings updated successfully',
  });
}
