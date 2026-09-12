import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { parseJsonBody } from '@/lib/api-validation';

import { MAX_IMPORT_ROWS } from '@/lib/csv';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

// Envelope only, on purpose. Every field on ImportRow is optional and the
// loop below already skips rows missing what it needs, counting them into
// the skipped totals the UI reports - that per-row tolerance is the whole
// point of a CSV importer, and a schema that rejected one bad cell would
// fail the entire import instead of one line of it. So this validates that
// a body arrived, is an object, and that rows (if sent) is an array; the
// rows themselves stay the loop's business.
//
// The real gain is the parse itself: a malformed JSON body used to throw
// out of request.json() unhandled, which is a 500 for what is a client
// error. One deliberate tightening - `rows` given a non-array value used to
// be silently treated as an empty import and reported as "0 imported",
// which told the caller nothing.
const BulkImportSchema = z.object({
  rows: z.array(z.unknown()).default([]),
});

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

  const parsed = await parseJsonBody(request, BulkImportSchema);
  if (parsed.error) return parsed.error;
  const rows = parsed.data.rows as ImportRow[];

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
