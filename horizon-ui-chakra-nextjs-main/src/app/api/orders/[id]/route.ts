import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .from('seller_orders')
    .update({
      customer_id: body.customerId || null,
      external_order_id: body.externalOrderId || null,
      order_date: body.orderDate,
      total_amount: body.totalAmount,
      currency: body.currency || 'PKR',
      status: body.status || 'completed',
    })
    .eq('id', id)
    .eq('seller_id', seller.id)
    .select(
      'id, customer_id, external_order_id, order_date, total_amount, currency, status, created_at, seller_customers(email, external_customer_id)',
    )
    .single();

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to update order' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: mapOrder(data),
    errors: [],
    message: 'Order updated successfully',
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from('seller_orders').delete().eq('id', id).eq('seller_id', seller.id);

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to delete order' },
      { status: 400 },
    );
  }

  return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Order deleted successfully' });
}
