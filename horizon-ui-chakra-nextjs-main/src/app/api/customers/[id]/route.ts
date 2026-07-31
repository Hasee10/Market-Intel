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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_customers')
    .update({
      external_customer_id: body.externalCustomerId || null,
      email: body.email || null,
      orders_count: body.ordersCount ?? 0,
      total_spent: body.totalSpent ?? 0,
      currency: body.currency || 'PKR',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('seller_id', seller.id)
    .select(
      'id, external_customer_id, email, first_order_at, last_order_at, orders_count, total_spent, currency, created_at, updated_at',
    )
    .single();

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to update customer' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: mapCustomer(data),
    errors: [],
    message: 'Customer updated successfully',
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from('seller_customers')
    .delete()
    .eq('id', id)
    .eq('seller_id', seller.id);

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to delete customer' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: null,
    errors: [],
    message: 'Customer deleted successfully',
  });
}
