import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { blankToNull, parseJsonBody } from '@/lib/api-validation';
import { getSellerOrders, mapOrder, ORDER_COLUMNS } from '@/lib/market-intel/seller/orders';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

// The 4 values NewOrderDrawer/EditOrderDrawer's <Select> actually offers -
// see components/marketintel/OrdersTable.tsx's STATUS_COLORS for the same
// list used to color the badge. customerId/externalOrderId are always sent
// as '' rather than omitted when left blank, same as products/customers -
// see blankToNull()'s own comment.
const OrderCreateSchema = z.object({
  customerId: blankToNull(z.string().trim().min(1)),
  externalOrderId: blankToNull(z.string().trim().min(1)),
  orderDate: z.string().trim().min(1, 'orderDate is required'),
  totalAmount: z.number({ required_error: 'totalAmount is required', invalid_type_error: 'totalAmount must be a number' }),
  currency: blankToNull(z.string().trim().min(1)),
  status: z.enum(['completed', 'pending', 'cancelled', 'refunded']).nullish(),
});

// Thin wrapper - the actual query now lives in lib/market-intel/seller/orders.ts
// so apps/orders/page.tsx can call it directly server-side. Reconstructs the
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
    const orders = await getSellerOrders(seller.id);
    return NextResponse.json({
      succeeded: true,
      data: orders,
      errors: [],
      message: 'Orders retrieved successfully',
    });
  } catch (err) {
    return apiError(err, 'Failed to fetch orders', 500, 'api/orders');
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

  const parsed = await parseJsonBody(request, OrderCreateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

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
    .select(ORDER_COLUMNS)
    .single();

  if (error) {
    return apiError(error, 'Failed to create order', 400, 'api/orders');
  }

  return NextResponse.json({
    succeeded: true,
    data: mapOrder(data),
    errors: [],
    message: 'Order created successfully',
  });
}
