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

import { getSellerOrders } from './orders';

beforeEach(() => {
  response = { data: [], error: null };
});

describe('getSellerOrders', () => {
  it('throws the underlying Supabase error message rather than swallowing it', async () => {
    response = { data: null, error: { message: 'connection refused' } };
    await expect(getSellerOrders('seller1')).rejects.toThrow('connection refused');
  });

  it('returns an empty list rather than throwing when data is null with no error', async () => {
    response = { data: null, error: null };
    await expect(getSellerOrders('seller1')).resolves.toEqual([]);
  });

  it('maps a row to OrderDto shape, preferring the customer email over external id', async () => {
    response = {
      data: [
        {
          id: 'o1',
          customer_id: 'c1',
          external_order_id: 'EXT-1',
          order_date: '2026-01-01',
          total_amount: '99.5',
          currency: 'PKR',
          status: 'completed',
          created_at: '2026-01-01',
          seller_customers: { email: 'a@b.com', external_customer_id: 'CUST-1' },
        },
      ],
      error: null,
    };

    const [order] = await getSellerOrders('seller1');
    expect(order.customerLabel).toBe('a@b.com');
    expect(order.totalAmount).toBe(99.5);
  });

  it('falls back to the external customer id when the row has no email', async () => {
    response = {
      data: [
        {
          id: 'o2',
          customer_id: 'c2',
          external_order_id: 'EXT-2',
          order_date: '2026-01-02',
          total_amount: '10',
          currency: 'PKR',
          status: 'pending',
          created_at: '2026-01-02',
          seller_customers: { email: null, external_customer_id: 'CUST-2' },
        },
      ],
      error: null,
    };

    const [order] = await getSellerOrders('seller1');
    expect(order.customerLabel).toBe('CUST-2');
  });
});
