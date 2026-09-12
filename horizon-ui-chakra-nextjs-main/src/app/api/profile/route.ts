import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { parseJsonBody } from '@/lib/api-validation';

import { getSellerProfile, mapPublicProfile } from '@/lib/market-intel/seller/settings';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { sanitizeDomain } from '@/lib/domain';
import { SUPPORTED_CURRENCIES } from '@/types/products';
import { SUPPORTED_COUNTRIES } from '@/lib/market-intel/core/countries';
import { apiError } from '@/lib/api-error';

// Thin wrapper - the actual query now lives in lib/market-intel/seller/settings.ts
// so apps/settings/page.tsx can call it directly server-side. Reconstructs the
// exact original error JSON on failure.
export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  try {
    const profile = await getSellerProfile(seller);
    return NextResponse.json({
      succeeded: true,
      data: profile,
      errors: [],
      message: 'Settings retrieved successfully',
    });
  } catch (err) {
    return apiError(err, 'Failed to fetch settings', 500, 'api/profile');
  }
}

// Every field optional, matching how the handler below already works: it
// updates only what was sent and leaves the rest alone, so absence has to
// stay meaningful. The typeof/validity checks in the body are kept too -
// they encode rules a schema can't (currency and country are checked
// against the supported lists, website is normalised to a bare domain).
//
// What this adds is the shape: publicProfile is now required to be an
// object when present, and the booleans to be booleans. The handler reads
// those through `!!`, so a string would previously have been coerced -
// "false" is truthy, which would have turned a setting on while the caller
// believed it was turning it off.
const ProfileUpdateSchema = z.object({
  businessName: z.string().optional(),
  reportingCurrency: z.string().optional(),
  country: z.string().optional(),
  publicProfile: z
    .object({
      isPublic: z.boolean().optional(),
      displayName: z.string().nullish(),
      showPricePosition: z.boolean().optional(),
      showRating: z.boolean().optional(),
      showCategoryRank: z.boolean().optional(),
      website: z.string().optional(),
      showOnMarketingSite: z.boolean().optional(),
    })
    .optional(),
});

export async function PUT(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const parsed = await parseJsonBody(request, ProfileUpdateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const supabase = await createClient();

  if (typeof body.businessName === 'string' && body.businessName.trim()) {
    const { error } = await supabase
      .from('sellers')
      .update({ business_name: body.businessName.trim() })
      .eq('id', seller.id);

    if (error) {
      return apiError(error, 'Failed to update business name', 400, 'api/profile');
    }
  }

  // Set<string>, not the literal union .map() infers: the whole job of this
  // set is to test an arbitrary caller-supplied string for membership, and
  // the narrow type makes exactly that call a compile error.
  const validCurrencyCodes = new Set<string>(SUPPORTED_CURRENCIES.map((c) => c.code));
  let reportingCurrency = seller.reportingCurrency;
  if (typeof body.reportingCurrency === 'string' && validCurrencyCodes.has(body.reportingCurrency)) {
    reportingCurrency = body.reportingCurrency;
    const { error } = await supabase
      .from('sellers')
      .update({ reporting_currency: reportingCurrency })
      .eq('id', seller.id);

    if (error) {
      return apiError(error, 'Failed to update reporting currency', 400, 'api/profile');
    }
  }

  const validCountryCodes = new Set<string>(SUPPORTED_COUNTRIES.map((c) => c.code));
  let country = seller.country;
  if (typeof body.country === 'string' && validCountryCodes.has(body.country)) {
    country = body.country;
    const { error } = await supabase.from('sellers').update({ country }).eq('id', seller.id);

    if (error) {
      return apiError(error, 'Failed to update country', 400, 'api/profile');
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
    return apiError(profileError, 'Failed to update public profile', 400, 'api/profile');
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
