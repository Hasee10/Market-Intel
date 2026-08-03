import { NextRequest, NextResponse } from 'next/server';

import { MAX_IMPORT_ROWS } from '@/lib/csv';
import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';

type ImportRow = {
  sku?: string;
  title?: string;
  categoryId?: string;
  costPrice?: number;
  sellPrice?: number;
  stockQty?: number;
  isActive?: boolean;
};

// Upserts keyed on (seller_id, sku) - the unique index seller_products
// already has (011_create_seller_platform_tables.sql). Rows missing a sku
// or title can't be matched against existing rows on re-import, so they're
// skipped rather than silently creating unmatchable duplicates.
export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const body = await request.json();
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];

  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [`Too many rows: ${rows.length} (max ${MAX_IMPORT_ROWS} per import)`],
        message: `Split the file into batches of ${MAX_IMPORT_ROWS} rows or fewer.`,
      },
      { status: 413 },
    );
  }

  const valid = rows.filter((r) => r.sku && r.title);
  const skipped = rows.length - valid.length;

  if (valid.length === 0) {
    return NextResponse.json({
      succeeded: true,
      data: { imported: 0, skipped },
      errors: [],
      message: 'No valid rows to import',
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('seller_products').upsert(
    valid.map((r) => ({
      seller_id: seller.id,
      sku: r.sku,
      title: r.title,
      category_id: r.categoryId || null,
      cost_price: r.costPrice ?? null,
      sell_price: r.sellPrice ?? null,
      stock_qty: r.stockQty ?? null,
      is_active: r.isActive ?? true,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'seller_id,sku' },
  );

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to import products' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succeeded: true,
    data: { imported: valid.length, skipped },
    errors: [],
    message: 'Products imported successfully',
  });
}
