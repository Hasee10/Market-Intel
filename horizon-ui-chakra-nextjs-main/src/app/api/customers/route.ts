import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';
import { CustomerDto } from '@/types/customer';

function mapCustomer(row: any): CustomerDto {
  return {
    id: row.id,
    externalCustomerId: row.external_customer_id,
    email: row.email,
    firstOrderAt: row.first_order_at,
    lastOrderAt: row.last_order_at,
    ordersCount: row.orders_count,
    totalSpent: Number(row.total_spent),
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  const { data, error } = await supabase
    .from('seller_customers')
    .select(
      'id, external_customer_id, email, first_order_at, last_order_at, orders_count, total_spent, currency, created_at, updated_at',
    )
    .eq('seller_id', seller.id)
    .order('last_order_at', { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to fetch customers' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: (data ?? []).map(mapCustomer),
    errors: [],
    message: 'Customers retrieved successfully',
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
    .select(
      'id, external_customer_id, email, first_order_at, last_order_at, orders_count, total_spent, currency, created_at, updated_at',
    )
    .single();

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to create customer' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: mapCustomer(data),
    errors: [],
    message: 'Customer created successfully',
  });
}
