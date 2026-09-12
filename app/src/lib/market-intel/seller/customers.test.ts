import { describe, it, expect, beforeEach, vi } from 'vitest';

type Resp = { data: any; error: { message: string } | null };
let response: Resp = { data: [], error: null };

function fakeBuilder() {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (resolve: (v: Resp) => void) => resolve(response),
  };
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => fakeBuilder() }),
}));

import { getSellerCustomers } from './customers';

beforeEach(() => {
  response = { data: [], error: null };
});

describe('getSellerCustomers', () => {
  it('throws the underlying Supabase error message rather than swallowing it', async () => {
    response = { data: null, error: { message: 'connection refused' } };
    await expect(getSellerCustomers('seller1')).rejects.toThrow('connection refused');
  });

  it('returns an empty list rather than throwing when data is null with no error', async () => {
    response = { data: null, error: null };
    await expect(getSellerCustomers('seller1')).resolves.toEqual([]);
  });

  it('maps a row to CustomerDto shape', async () => {
    response = {
      data: [
        {
          id: 'c1',
          external_customer_id: 'EXT-1',
          email: 'a@b.com',
          first_order_at: '2026-01-01',
          last_order_at: '2026-02-01',
          orders_count: 3,
          total_spent: '150.5',
          currency: 'PKR',
          created_at: '2026-01-01',
          updated_at: '2026-02-01',
        },
      ],
      error: null,
    };

    const [customer] = await getSellerCustomers('seller1');
    expect(customer.externalCustomerId).toBe('EXT-1');
    expect(customer.totalSpent).toBe(150.5);
  });
});
