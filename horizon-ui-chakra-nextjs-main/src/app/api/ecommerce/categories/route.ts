import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';

const PALETTE = ['blue', 'teal', 'violet', 'pink', 'orange', 'yellow', 'red', 'grape', 'cyan', 'lime'];

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
    .from('seller_products')
    .select('sell_price, stock_qty, is_active, seller_categories(name)')
    .eq('seller_id', seller.id)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to fetch category inventory value' },
      { status: 500 },
    );
  }

  const grouped = new Map<string, { value: number; products: number }>();
  for (const row of data ?? []) {
    const category = Array.isArray(row.seller_categories) ? row.seller_categories[0] : row.seller_categories;
    const name = category?.name ?? 'Uncategorized';
    const value = Number(row.sell_price ?? 0) * (row.stock_qty ?? 0);
    const entry = grouped.get(name) ?? { value: 0, products: 0 };
    entry.value += value;
    entry.products += 1;
    grouped.set(name, entry);
  }

  const totalValue = Array.from(grouped.values()).reduce((sum, g) => sum + g.value, 0);

  const result = Array.from(grouped.entries())
    .map(([category, { value, products }], index) => ({
      category,
      value,
      products,
      percentage: totalValue ? Number(((value / totalValue) * 100).toFixed(1)) : 0,
      color: PALETTE[index % PALETTE.length],
    }))
    .sort((a, b) => b.value - a.value);

  return NextResponse.json({
    succeeded: true,
    data: result,
    errors: [],
    message: 'Category inventory value retrieved successfully',
  });
}
