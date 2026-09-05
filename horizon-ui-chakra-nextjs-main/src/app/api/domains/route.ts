import { NextRequest, NextResponse } from 'next/server';

import {
  autoAssignDomainsForCategories,
  getCurrentSeller,
  listCategories,
  listSellerDomains,
} from '@/lib/market-intel/seller/seller';

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

  // Same free-first/premium-rest rule onboarding's completeOnboarding uses
  // for domains 2-3 - one implementation, not two copies of the plan check.
  const result = await autoAssignDomainsForCategories(seller, [body.categoryId]);

  if (result.skippedNeedsPremium.length > 0) {
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

  // Both arrays empty means the category was already tracked (autoAssign
  // silently skips it) - idempotent success, not an error, matching the
  // upsert-based behaviour this replaced.
  const domains = await listSellerDomains(seller.id);
  return NextResponse.json({ succeeded: true, data: domains, errors: [], message: 'Domain added successfully' });
}
