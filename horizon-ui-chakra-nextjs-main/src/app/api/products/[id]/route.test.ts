import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// These cover the two judgement calls made when ProductUpdateSchema was
// added, since both are the kind of thing that regresses silently:
//
//  - title stays optional, because the handler writes `title: body.title`
//    bare and an undefined there is dropped during serialisation, leaving
//    the column untouched. Requiring it would break partial updates that
//    work today.
//  - the nonnegative bounds DO match create, which is a deliberate
//    tightening: a negative price used to be written straight through.

let currentSeller: any = { id: 'seller1', country: 'PK', reportingCurrency: 'PKR' };
let updatedRow: any = null;

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getCurrentSeller: async () => currentSeller,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      update: (row: any) => {
        updatedRow = row;
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: async (): Promise<{ data: any; error: null }> => ({
                  data: { id: 'sp1', ...row, seller_categories: null },
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
    }),
  }),
}));

import { PUT } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/products/sp1', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = Promise.resolve({ id: 'sp1' });

beforeEach(() => {
  updatedRow = null;
  currentSeller = { id: 'seller1', country: 'PK', reportingCurrency: 'PKR' };
});

describe('PUT /api/products/[id] validation', () => {
  it('accepts an update that omits title, leaving the column untouched', async () => {
    const response = await PUT(makeRequest({ sellPrice: 500 }), { params });
    expect(response.status).toBe(200);
    // Undefined rather than null: null would clear the title, and this
    // update never mentioned it.
    expect(updatedRow.title).toBeUndefined();
  });

  it('still rejects a title that is present but blank', async () => {
    const response = await PUT(makeRequest({ title: '   ' }), { params });
    expect(response.status).toBe(400);
  });

  it('rejects a negative sell price, matching what create has always done', async () => {
    const response = await PUT(makeRequest({ title: 'Kettle', sellPrice: -5 }), { params });
    expect(response.status).toBe(400);
  });

  it('rejects a non-numeric price instead of writing it through', async () => {
    const response = await PUT(makeRequest({ title: 'Kettle', sellPrice: 'free' }), { params });
    expect(response.status).toBe(400);
  });

  it('returns 400 rather than throwing when the body is not valid JSON', async () => {
    const request = new NextRequest('http://localhost/api/products/sp1', {
      method: 'PUT',
      body: '{not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, { params });
    expect(response.status).toBe(400);
  });

  it('treats a blank sku as cleared, not as a validation failure', async () => {
    const response = await PUT(makeRequest({ title: 'Kettle', sku: '' }), { params });
    expect(response.status).toBe(200);
    expect(updatedRow.sku).toBeNull();
  });
});
