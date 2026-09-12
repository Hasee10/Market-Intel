import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { blankToNull, parseJsonBody } from '@/lib/api-validation';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getSellerCustomers, mapCustomer, CUSTOMER_COLUMNS } from '@/lib/market-intel/seller/customers';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

// Nothing is required here, unchanged from before - a customer can be
// created from just an externalCustomerId, just an email, or neither
// (matches NewCustomerDrawer, which doesn't mark either field mandatory).
// NewCustomerDrawer always sends every field with an initial empty-string
// value rather than omitting it, so blankToNull() is needed on all three
// string fields to keep "left blank" working as "not provided".
const CustomerCreateSchema = z.object({
  externalCustomerId: blankToNull(z.string().trim().min(1)),
  email: blankToNull(z.string().trim().email('email must be a valid email address')),
  ordersCount: z.number().int().nonnegative().nullish(),
  totalSpent: z.number().nonnegative().nullish(),
  currency: blankToNull(z.string().trim().min(1)),
});

// GET is a thin wrapper - see products.ts's header comment for why the real
// logic lives in customers.ts now.
export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  try {
    const data = await getSellerCustomers(seller.id);

    return NextResponse.json({
      succeeded: true,
      data,
      errors: [],
      message: 'Customers retrieved successfully',
    });
  } catch (err) {
    return apiError(err, 'Failed to fetch customers', 500, 'api/customers');
  }
}

export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const parsed = await parseJsonBody(request, CustomerCreateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_customers')
    .insert({
      seller_id: seller.id,
      external_customer_id: body.externalCustomerId || null,
      email: body.email || null,
      orders_count: body.ordersCount ?? 0,
      total_spent: body.totalSpent ?? 0,
      currency: body.currency || 'PKR',
    })
    .select(CUSTOMER_COLUMNS)
    .single();

  if (error) {
    return apiError(error, 'Failed to create customer', 400, 'api/customers');
  }

  return NextResponse.json({
    succeeded: true,
    data: mapCustomer(data),
    errors: [],
    message: 'Customer created successfully',
  });
}
