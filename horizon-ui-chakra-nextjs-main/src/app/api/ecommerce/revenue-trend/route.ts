import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

const DAYS = 30;

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const supabase = await createClient();

  const start = new Date();
  start.setDate(start.getDate() - (DAYS - 1));
  start.setHours(0, 0, 0, 0);

  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('order_date, total_amount, currency')
      .eq('seller_id', seller.id)
      .gte('order_date', start.toISOString()),
    getLatestFxRates(),
  ]);

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to fetch revenue trend' },
      { status: 500 },
    );
  }

  const byDay = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }

  for (const order of data ?? []) {
    const key = new Date(order.order_date).toISOString().slice(0, 10);
    if (byDay.has(key)) {
      const amount = convertCurrency(Number(order.total_amount), order.currency, seller.reportingCurrency, fxRates);
      byDay.set(key, (byDay.get(key) ?? 0) + amount);
    }
  }

  const result = Array.from(byDay.entries()).map(([date, revenue]) => ({
    date,
    revenue: Number(revenue.toFixed(2)),
  }));

  return NextResponse.json({
    succeeded: true,
    data: result,
    errors: [],
    message: 'Revenue trend retrieved successfully',
  });
}
