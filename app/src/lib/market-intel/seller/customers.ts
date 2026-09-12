'server-only';

import { createClient } from '@/lib/supabase/server';
import { CustomerDto } from '@/types/customer';

// Extracted from /api/customers' GET handler - same move as products.ts,
// see its header comment. Throws on error, matching the established
// (corrected-after-a-mistake, see overview.ts) contract. POST (customer
// creation) stays in the route file - a real mutation from a client form.

export const CUSTOMER_COLUMNS =
  'id, external_customer_id, email, first_order_at, last_order_at, orders_count, total_spent, currency, created_at, updated_at';

export function mapCustomer(row: any): CustomerDto {
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

export async function getSellerCustomers(sellerId: string): Promise<CustomerDto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('seller_customers')
    .select(CUSTOMER_COLUMNS)
    .eq('seller_id', sellerId)
    .order('last_order_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapCustomer);
}
