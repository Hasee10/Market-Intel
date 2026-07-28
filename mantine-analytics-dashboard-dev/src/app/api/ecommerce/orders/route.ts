import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  processing: 'blue',
  shipped: 'violet',
  delivered: 'teal',
  completed: 'teal',
  cancelled: 'red',
  refunded: 'red',
};

function colorForStatus(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? 'gray';
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
    .select('status, total_amount')
    .eq('seller_id', seller.id);

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to fetch order status' },
      { status: 500 },
    );
  }

  const orders = data ?? [];
  const totalCount = orders.length;

  const grouped = new Map<string, { count: number; value: number }>();
  for (const order of orders) {
    const status = order.status || 'Unknown';
    const entry = grouped.get(status) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += Number(order.total_amount);
    grouped.set(status, entry);
  }

  const result = Array.from(grouped.entries()).map(([status, { count, value }]) => ({
    status,
    count,
    value,
    percentage: totalCount ? Number(((count / totalCount) * 100).toFixed(1)) : 0,
    color: colorForStatus(status),
  }));

  return NextResponse.json({
    succeeded: true,
    data: result,
    errors: [],
    message: 'Order status retrieved successfully',
  });
}
