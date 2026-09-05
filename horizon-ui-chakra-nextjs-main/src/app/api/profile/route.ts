import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { sanitizeDomain } from '@/lib/domain';
import { SUPPORTED_CURRENCIES } from '@/types/products';
import { SUPPORTED_COUNTRIES } from '@/lib/market-intel/core/countries';

function mapPublicProfile(row: any) {
  return {
    isPublic: row?.is_public ?? false,
    displayName: row?.display_name ?? '',
    showPricePosition: row?.show_price_position ?? false,
    showRating: row?.show_rating ?? false,
    showCategoryRank: row?.show_category_rank ?? false,
    // Separate consent scope from isPublic - that one only ever gated peer
    // (other-seller) visibility. This gates showing on the public marketing
    // homepage to anonymous visitors, see migration 024.
    website: row?.website ?? '',
    showOnMarketingSite: row?.show_on_marketing_site ?? false,
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
    .select('is_public, display_name, show_price_position, show_rating, show_category_rank, website, show_on_marketing_site')
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
      reportingCurrency: seller.reportingCurrency,
      country: seller.country,
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

  const validCurrencyCodes = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));
  let reportingCurrency = seller.reportingCurrency;
  if (typeof body.reportingCurrency === 'string' && validCurrencyCodes.has(body.reportingCurrency)) {
    reportingCurrency = body.reportingCurrency;
    const { error } = await supabase
      .from('sellers')
      .update({ reporting_currency: reportingCurrency })
      .eq('id', seller.id);

    if (error) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: [error.message], message: 'Failed to update reporting currency' },
        { status: 400 },
      );
    }
  }

  const validCountryCodes = new Set(SUPPORTED_COUNTRIES.map((c) => c.code));
  let country = seller.country;
  if (typeof body.country === 'string' && validCountryCodes.has(body.country)) {
    country = body.country;
    const { error } = await supabase.from('sellers').update({ country }).eq('id', seller.id);

    if (error) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: [error.message], message: 'Failed to update country' },
        { status: 400 },
      );
    }
  }

  const publicProfile = body.publicProfile ?? {};

  // Website is stored as a bare domain (logo.dev looks up img.logo.dev/<domain>
  // directly) rather than whatever URL shape the seller typed in Settings.
  let website: string | null = null;
  if (typeof publicProfile.website === 'string' && publicProfile.website.trim()) {
    website = sanitizeDomain(publicProfile.website);
    if (!website) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: ['Website is not a valid domain'], message: 'Failed to update public profile' },
        { status: 400 },
      );
    }
  }

  // Showing your logo to every anonymous visitor is a bigger step than
  // opting into peer benchmarks, so it requires a real domain on file - no
  // silently-on-but-blank state that a UI bug could later render as an
  // empty/broken logo tile.
  const showOnMarketingSite = !!publicProfile.showOnMarketingSite;
  if (showOnMarketingSite && !website) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Add a website before enabling the public showcase'], message: 'Failed to update public profile' },
      { status: 400 },
    );
  }

  const { data: updatedProfile, error: profileError } = await supabase
    .from('seller_public_profile')
    .upsert({
      seller_id: seller.id,
      is_public: !!publicProfile.isPublic,
      display_name: publicProfile.displayName || null,
      show_price_position: !!publicProfile.showPricePosition,
      show_rating: !!publicProfile.showRating,
      show_category_rank: !!publicProfile.showCategoryRank,
      website,
      show_on_marketing_site: showOnMarketingSite,
    })
    .select('is_public, display_name, show_price_position, show_rating, show_category_rank, website, show_on_marketing_site')
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
      reportingCurrency,
      country,
      publicProfile: mapPublicProfile(updatedProfile),
    },
    errors: [],
    message: 'Settings updated successfully',
  });
}
