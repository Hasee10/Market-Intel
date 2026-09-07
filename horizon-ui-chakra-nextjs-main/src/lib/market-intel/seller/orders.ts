'server-only';

import { createClient } from '@/lib/supabase/server';
import { OrderDto } from '@/types/order';

// Extracted from /api/orders' GET handler - same move as customers.ts, see
// its header comment. Throws on error, matching the established contract.
// POST (order creation) stays in the route file - a real mutation from a
// client form.

export const ORDER_COLUMNS =
  'id, customer_id, external_order_id, order_date, total_amount, currency, status, created_at, seller_customers(email, external_customer_id)';

export function mapOrder(row: any): OrderDto {
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

export async function getSellerOrders(sellerId: string): Promise<OrderDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('seller_orders')
    .select(ORDER_COLUMNS)
    .eq('seller_id', sellerId)
    .order('order_date', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapOrder);
}
