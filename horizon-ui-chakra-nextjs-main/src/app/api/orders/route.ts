import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';
import { OrderDto } from '@/types/order';

function mapOrder(row: any): OrderDto {
  const customer = Array.isArray(row.seller_customers) ? row.seller_customers[0] : row.seller_customers;

  return {
    id: row.id,
    customerId: row.customer_id,
    customerLabel: customer?.email || customer?.external_customer_id || null,
    externalOrderId: row.external_order_id,
    orderDate: row.order_date,
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
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
    .from('seller_orders')
    .select(
      'id, customer_id, external_order_id, order_date, total_amount, currency, status, created_at, seller_customers(email, external_customer_id)',
    )
    .eq('seller_id', seller.id)
    .order('order_date', { ascending: false });

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to fetch orders' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: (data ?? []).map(mapOrder),
    errors: [],
    message: 'Orders retrieved successfully',
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
  if (!body.orderDate || body.totalAmount == null) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: ['orderDate and totalAmount are required'],
        message: 'orderDate and totalAmount are required',
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_orders')
    .insert({
      seller_id: seller.id,
      customer_id: body.customerId || null,
      external_order_id: body.externalOrderId || null,
      order_date: body.orderDate,
      total_amount: body.totalAmount,
      currency: body.currency || 'PKR',
      status: body.status || 'completed',
    })
    .select(
      'id, customer_id, external_order_id, order_date, total_amount, currency, status, created_at, seller_customers(email, external_customer_id)',
    )
    .single();

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to create order' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: mapOrder(data),
    errors: [],
    message: 'Order created successfully',
  });
}
