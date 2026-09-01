import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Covers the zod validation added to POST /api/orders - previously only
// `!body.orderDate || body.totalAmount == null` was checked (no type
// enforcement at all, and `status` accepted any truthy string).

let currentSeller: any = { id: 'seller1' };
let insertedRow: any = null;

vi.mock('@/lib/market-intel/seller', () => ({
  getCurrentSeller: async () => currentSeller,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_orders') {
        return {
          insert: (row: any) => ({
            select: () => ({
              single: async (): Promise<{ data: any; error: null }> => {
                insertedRow = { id: 'o1', ...row, seller_customers: null };
                return { data: insertedRow, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/orders', { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => {
  currentSeller = { id: 'seller1' };
  insertedRow = null;
});

describe('POST /api/orders', () => {
  it('creates an order with valid required fields', async () => {
    const response = await POST(makeRequest({ orderDate: '2026-08-30', totalAmount: 5000 }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.succeeded).toBe(true);
    expect(insertedRow.total_amount).toBe(5000);
    expect(insertedRow.status).toBe('completed');
  });

  it('rejects a missing orderDate with a 400, same as before', async () => {
    const response = await POST(makeRequest({ totalAmount: 5000 }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.succeeded).toBe(false);
    expect(data.errors[0]).toContain('orderDate');
  });

  it('rejects a missing totalAmount with a 400, same as before', async () => {
    const response = await POST(makeRequest({ orderDate: '2026-08-30' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors[0]).toContain('totalAmount');
  });

  it('rejects a totalAmount sent as a string - new: the old code would have inserted it as-is', async () => {
    const response = await POST(makeRequest({ orderDate: '2026-08-30', totalAmount: '5000' }));
    expect(response.status).toBe(400);
  });

  it('rejects an unknown status value - new: the old code accepted any truthy string', async () => {
    const response = await POST(makeRequest({ orderDate: '2026-08-30', totalAmount: 5000, status: 'shipped-ish' }));
    expect(response.status).toBe(400);
  });

  it('treats a blank customerId/externalOrderId the same as omitting them (form always sends "")', async () => {
    await POST(makeRequest({ orderDate: '2026-08-30', totalAmount: 5000, customerId: '', externalOrderId: '' }));

    expect(insertedRow.customer_id).toBeNull();
    expect(insertedRow.external_order_id).toBeNull();
  });

  it('accepts each of the 4 real status values', async () => {
    for (const status of ['completed', 'pending', 'cancelled', 'refunded']) {
      const response = await POST(makeRequest({ orderDate: '2026-08-30', totalAmount: 100, status }));
      expect(response.status).toBe(200);
    }
  });

  it('requires authentication', async () => {
    currentSeller = null;
    const response = await POST(makeRequest({ orderDate: '2026-08-30', totalAmount: 5000 }));
    expect(response.status).toBe(401);
  });
});
