import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { blankToNull, parseJsonBody } from '@/lib/api-validation';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { OrderDto } from '@/types/order';
import { apiError } from '@/lib/api-error';

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

// Mirrors OrderCreateSchema in ../route.ts. orderDate and totalAmount are
// optional here where create requires them: the update writes both bare, so
// omitting one currently leaves that column untouched, and requiring them
// would reject partial updates that succeed today. Status is still held to
// the same four values the drawer's <Select> offers.
const OrderUpdateSchema = z.object({
  customerId: blankToNull(z.string().trim().min(1)),
  externalOrderId: blankToNull(z.string().trim().min(1)),
  orderDate: z.string().trim().min(1, 'orderDate cannot be empty').optional(),
  totalAmount: z.number({ invalid_type_error: 'totalAmount must be a number' }).optional(),
  currency: blankToNull(z.string().trim().min(1)),
  status: z.enum(['completed', 'pending', 'cancelled', 'refunded']).nullish(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;

  const parsed = await parseJsonBody(request, OrderUpdateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

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
    return apiError(error, 'Failed to update order', 400, 'api/orders/[id]');
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
    return apiError(error, 'Failed to delete order', 400, 'api/orders/[id]');
  }

  return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Order deleted successfully' });
}
