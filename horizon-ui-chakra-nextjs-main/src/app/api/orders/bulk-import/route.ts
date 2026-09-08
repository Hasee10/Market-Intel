import { NextRequest, NextResponse } from 'next/server';

import { MAX_IMPORT_ROWS } from '@/lib/csv';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

type ImportRow = {
  externalOrderId?: string;
  orderDate?: string;
  totalAmount?: number;
  currency?: string;
  status?: string;
  customerExternalId?: string;
};

// Upserts keyed on (seller_id, external_order_id). customerExternalId (if
// present) is resolved against the seller's own seller_customers rows to
// find customer_id - orders reference customers by our internal UUID, but a
// CSV export from the seller's store platform will only have its own
// external customer ID, not ours.
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

  const valid = rows.filter((r) => r.externalOrderId && r.orderDate && r.totalAmount != null);
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

  const externalCustomerIds = [...new Set(valid.map((r) => r.customerExternalId).filter(Boolean))];
  const customerIdByExternal = new Map<string, string>();
  if (externalCustomerIds.length > 0) {
    const { data: customers } = await supabase
      .from('seller_customers')
      .select('id, external_customer_id')
      .eq('seller_id', seller.id)
      .in('external_customer_id', externalCustomerIds as string[]);

    for (const c of customers ?? []) {
      if (c.external_customer_id) customerIdByExternal.set(c.external_customer_id, c.id);
    }
  }

  const { error } = await supabase.from('seller_orders').upsert(
    valid.map((r) => ({
      seller_id: seller.id,
      customer_id: r.customerExternalId ? customerIdByExternal.get(r.customerExternalId) ?? null : null,
      external_order_id: r.externalOrderId,
      order_date: r.orderDate,
      total_amount: r.totalAmount,
      currency: r.currency || 'PKR',
      status: r.status || 'completed',
    })),
    { onConflict: 'seller_id,external_order_id' },
  );

  if (error) {
    return apiError(error, 'Failed to import orders', 400, 'api/orders/bulk-import');
  }

  return NextResponse.json({
    succeeded: true,
    data: { imported: valid.length, skipped },
    errors: [],
    message: 'Orders imported successfully',
  });
}
