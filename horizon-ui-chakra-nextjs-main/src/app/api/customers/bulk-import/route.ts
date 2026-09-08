import { NextRequest, NextResponse } from 'next/server';

import { MAX_IMPORT_ROWS } from '@/lib/csv';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

type ImportRow = {
  externalCustomerId?: string;
  email?: string;
  ordersCount?: number;
  totalSpent?: number;
  currency?: string;
};

// Upserts keyed on (seller_id, external_customer_id) - the unique index
// seller_customers already has. Rows without an external ID are skipped for
// the same re-import-safety reason as products.
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

  const valid = rows.filter((r) => r.externalCustomerId);
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
  const { error } = await supabase.from('seller_customers').upsert(
    valid.map((r) => ({
      seller_id: seller.id,
      external_customer_id: r.externalCustomerId,
      email: r.email || null,
      orders_count: r.ordersCount ?? 0,
      total_spent: r.totalSpent ?? 0,
      currency: r.currency || 'PKR',
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'seller_id,external_customer_id' },
  );

  if (error) {
    return apiError(error, 'Failed to import customers', 400, 'api/customers/bulk-import');
  }

  return NextResponse.json({
    succeeded: true,
    data: { imported: valid.length, skipped },
    errors: [],
    message: 'Customers imported successfully',
  });
}
