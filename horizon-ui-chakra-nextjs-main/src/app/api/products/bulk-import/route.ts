import { NextRequest, NextResponse } from 'next/server';

import { MAX_IMPORT_ROWS } from '@/lib/csv';
import { getCountryProductConfig } from '@/lib/market-intel/countries';
import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_CURRENCIES } from '@/types/products';

type ImportRow = {
  sku?: string;
  title?: string;
  categoryId?: string;
  costPrice?: number;
  sellPrice?: number;
  stockQty?: number;
  isActive?: boolean;
  currency?: string;
};

const VALID_CURRENCY_CODES = new Set<string>(SUPPORTED_CURRENCIES.map((c) => c.code));

// A stable, deterministic key for rows with no SKU - not shown to the
// seller (see import_key's comment in migration 027), only used so
// re-uploading the same CSV updates the same row instead of creating a
// duplicate every time. Two genuinely different products sharing an exact
// title collapse to one row without a SKU to tell them apart - an honest
// limitation given there is no other stable identity to key on, not a bug.
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

// Upserts keyed on (seller_id, sku) when a row has one - the unique index
// seller_products already has (011_create_seller_platform_tables.sql) - or
// (seller_id, import_key) when it doesn't and the seller's country doesn't
// require one (countries.ts, migration 027). A row always needs a title;
// that's the one field no market can reasonably do without.
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

  const { skuRequired } = getCountryProductConfig(seller.country);
  const defaultCurrency = VALID_CURRENCY_CODES.has(seller.reportingCurrency) ? seller.reportingCurrency : 'PKR';

  const withSku: ImportRow[] = [];
  const withoutSku: ImportRow[] = [];
  let skippedMissingTitle = 0;
  let skippedMissingSku = 0;

  for (const r of rows) {
    if (!r.title) {
      skippedMissingTitle += 1;
      continue;
    }
    if (r.sku) {
      withSku.push(r);
    } else if (skuRequired) {
      skippedMissingSku += 1;
    } else {
      withoutSku.push(r);
    }
  }

  const skipped = skippedMissingTitle + skippedMissingSku;
  const skippedReasons: string[] = [];
  if (skippedMissingTitle > 0) skippedReasons.push(`${skippedMissingTitle} missing a title`);
  if (skippedMissingSku > 0) skippedReasons.push(`${skippedMissingSku} missing a required SKU`);

  if (withSku.length === 0 && withoutSku.length === 0) {
    return NextResponse.json({
      succeeded: true,
      data: { imported: 0, skipped, skippedReasons },
      errors: [],
      message: 'No valid rows to import',
    });
  }

  const toRow = (r: ImportRow, importKey: string | null) => ({
    seller_id: seller.id,
    sku: r.sku || null,
    import_key: importKey,
    title: r.title,
    category_id: r.categoryId || null,
    cost_price: r.costPrice ?? null,
    sell_price: r.sellPrice ?? null,
    stock_qty: r.stockQty ?? null,
    is_active: r.isActive ?? true,
    currency: r.currency && VALID_CURRENCY_CODES.has(r.currency) ? r.currency : defaultCurrency,
    updated_at: new Date().toISOString(),
  });

  const supabase = await createClient();

  // Two batches, not one: Supabase's upsert() takes a single conflict
  // target for the whole call, and has-SKU / no-SKU rows need different
  // ones (seller_id,sku vs seller_id,import_key).
  if (withSku.length > 0) {
    const { error } = await supabase
      .from('seller_products')
      .upsert(withSku.map((r) => toRow(r, null)), { onConflict: 'seller_id,sku' });

    if (error) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: [error.message], message: 'Failed to import products' },
        { status: 400 },
      );
    }
  }

  if (withoutSku.length > 0) {
    const { error } = await supabase
      .from('seller_products')
      .upsert(
        withoutSku.map((r) => toRow(r, slugifyTitle(r.title!))),
        { onConflict: 'seller_id,import_key' },
      );

    if (error) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: [error.message], message: 'Failed to import products' },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({
    succeeded: true,
    data: { imported: withSku.length + withoutSku.length, skipped, skippedReasons },
    errors: [],
    message: 'Products imported successfully',
  });
}
