import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';

function mapProduct(row: any) {
  const category = Array.isArray(row.seller_categories)
    ? row.seller_categories[0]
    : row.seller_categories;

  const sellPrice = Number(row.sell_price ?? 0);
  const stockQty = row.stock_qty ?? 0;

  return {
    id: row.id,
    title: row.title,
    sku: row.sku,
    category: category?.name ?? 'Uncategorized',
    sellPrice,
    costPrice: row.cost_price !== null ? Number(row.cost_price) : null,
    stockQty,
    inventoryValue: sellPrice * stockQty,
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
    .from('seller_products')
    .select(
      'id, sku, title, cost_price, sell_price, stock_qty, is_active, seller_categories(name)',
    )
    .eq('seller_id', seller.id)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to fetch products' },
      { status: 500 },
    );
  }

  const mapped = (data ?? [])
    .map(mapProduct)
    .sort((a, b) => b.inventoryValue - a.inventoryValue);

  return NextResponse.json({
    succeeded: true,
    data: mapped,
    errors: [],
    message: 'Top products retrieved successfully',
  });
}
