import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { convertCurrency, getLatestFxRates, type FxRates } from '@/lib/market-intel/fx';

function mapProduct(row: any, reportingCurrency: string, fxRates: FxRates) {
  const category = Array.isArray(row.seller_categories)
    ? row.seller_categories[0]
    : row.seller_categories;

  // Products can each be in a different currency (seller_products.currency)
  // - convert to the seller's reporting currency so ranking "by inventory
  // value" compares like with like, and so the displayed total means
  // something (a PKR 88,000 laptop and a EUR 12 item aren't directly
  // comparable without conversion).
  const sellPrice = convertCurrency(Number(row.sell_price ?? 0), row.currency, reportingCurrency, fxRates);
  const stockQty = row.stock_qty ?? 0;

  return {
    id: row.id,
    title: row.title,
    sku: row.sku,
    // seller_products.image_url (migration 049). Nullable - ProductThumb
    // falls back to the category tile, same as the Products page.
    imageUrl: row.image_url ?? null,
    category: category?.name ?? 'Uncategorized',
    sellPrice,
    costPrice:
      row.cost_price !== null ? convertCurrency(Number(row.cost_price), row.currency, reportingCurrency, fxRates) : null,
    stockQty,
    inventoryValue: sellPrice * stockQty,
    currency: reportingCurrency,
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
  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select(
        'id, sku, title, cost_price, sell_price, currency, stock_qty, is_active, image_url, seller_categories(name)',
      )
      .eq('seller_id', seller.id)
      .eq('is_active', true),
    getLatestFxRates(),
  ]);

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to fetch products' },
      { status: 500 },
    );
  }

  const mapped = (data ?? [])
    .map((row) => mapProduct(row, seller.reportingCurrency, fxRates))
    .sort((a, b) => b.inventoryValue - a.inventoryValue);

  return NextResponse.json({
    succeeded: true,
    data: mapped,
    errors: [],
    message: 'Top products retrieved successfully',
  });
}
