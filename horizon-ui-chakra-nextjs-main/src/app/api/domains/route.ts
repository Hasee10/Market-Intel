import { NextRequest, NextResponse } from 'next/server';

import { hasFeature } from '@/lib/market-intel/entitlements';
import { getCurrentSeller, listCategories, listSellerDomains } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const [domains, categories] = await Promise.all([listSellerDomains(seller.id), listCategories()]);

  return NextResponse.json({
    succeeded: true,
    data: { domains, categories },
    errors: [],
    message: 'Domains retrieved successfully',
  });
}

export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const body = await request.json();
  if (!body.categoryId) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['categoryId is required'], message: 'categoryId is required' },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: existingDomains } = await supabase
    .from('seller_domains')
    .select('id')
    .eq('seller_id', seller.id);
  const isFirstDomain = !existingDomains || existingDomains.length === 0;

  if (!isFirstDomain && !hasFeature(seller.planTier, 'multi_domain')) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: ['Multiple domains require the Premium plan'],
        message: 'Multiple domains require the Premium plan',
      },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from('seller_domains')
    .upsert(
      { seller_id: seller.id, category_id: body.categoryId, is_primary: isFirstDomain },
      { onConflict: 'seller_id,category_id' },
    );

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to add domain' },
      { status: 400 },
    );
  }

  const domains = await listSellerDomains(seller.id);
  return NextResponse.json({ succeeded: true, data: domains, errors: [], message: 'Domain added successfully' });
}
