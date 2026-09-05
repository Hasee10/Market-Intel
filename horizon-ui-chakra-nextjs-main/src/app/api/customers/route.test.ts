import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Covers the zod validation added to POST /api/customers - previously
// there was no validation at all, not even a type check.

let currentSeller: any = { id: 'seller1' };
let insertedRow: any = null;

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getCurrentSeller: async () => currentSeller,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_customers') {
        return {
          insert: (row: any) => ({
            select: () => ({
              single: async (): Promise<{ data: any; error: null }> => {
                insertedRow = { id: 'c1', ...row };
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
  return new NextRequest('http://localhost/api/customers', { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => {
  currentSeller = { id: 'seller1' };
  insertedRow = null;
});

describe('POST /api/customers', () => {
  it('creates a customer with nothing but blank fields - nothing is required, unchanged from before', async () => {
    const response = await POST(makeRequest({ email: '', externalCustomerId: '', ordersCount: 0, totalSpent: 0, currency: 'PKR' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.succeeded).toBe(true);
    expect(insertedRow.email).toBeNull();
    expect(insertedRow.external_customer_id).toBeNull();
  });

  it('creates a customer from a real email', async () => {
    const response = await POST(makeRequest({ email: 'a@b.com', ordersCount: 0, totalSpent: 0, currency: 'PKR' }));
    expect(response.status).toBe(200);
    expect(insertedRow.email).toBe('a@b.com');
  });

  it('rejects a malformed email - new: the old code accepted any string as-is', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email', ordersCount: 0, totalSpent: 0, currency: 'PKR' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors[0]).toContain('email');
  });

  it('rejects a negative totalSpent - new: the old code accepted any number', async () => {
    const response = await POST(makeRequest({ ordersCount: 0, totalSpent: -100, currency: 'PKR' }));
    expect(response.status).toBe(400);
  });

  it('requires authentication', async () => {
    currentSeller = null;
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(401);
  });
});
