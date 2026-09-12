import { describe, it, expect, vi, beforeEach } from 'vitest';

// These two helpers look alike and differ in one deliberate way: what the
// caller is allowed to see. That difference is the whole point of each, so
// it is pinned here rather than left to be discovered the next time
// someone "tidies" them into one function.

const reportErrorMock = vi.fn();
vi.mock('@/lib/observability/report-error', () => ({
  reportError: (...args: unknown[]) => reportErrorMock(...args),
}));

import { apiError, cronError } from './api-error';

const PG_DETAIL = 'duplicate key value violates unique constraint "seller_products_sku_key"';

beforeEach(() => {
  reportErrorMock.mockClear();
});

describe('apiError (user-facing routes)', () => {
  it('never returns the underlying error text to the caller', async () => {
    const res = apiError(new Error(PG_DETAIL), 'Failed to create product', 400, 'api/products');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errors).toEqual(['Failed to create product']);
    expect(body.message).toBe('Failed to create product');
    expect(JSON.stringify(body)).not.toContain('seller_products_sku_key');
  });

  it('still records the real error server-side', () => {
    const err = new Error(PG_DETAIL);
    apiError(err, 'Failed to create product', 400, 'api/products');

    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    expect(reportErrorMock).toHaveBeenCalledWith(err, { scope: 'api/products', meta: { status: 400 } });
  });
});

describe('cronError (CRON_SECRET-gated routes only)', () => {
  it('returns the underlying error text - the workflow log is the only reader', async () => {
    const res = cronError(new Error('Failed to load devices: connection reset'), 'Failed to run push notifications job', 'api/cron/push-notifications');
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.errors).toEqual(['Failed to load devices: connection reset']);
    expect(body.message).toBe('Failed to run push notifications job');
  });

  it("falls back to 'Unknown error' for a non-Error throw, matching the original contract", async () => {
    const res = cronError('a string was thrown', 'Failed to refresh FX rates', 'api/cron/fx-rates');
    const body = await res.json();

    expect(body.errors).toEqual(['Unknown error']);
  });

  it('also records the error server-side, so nothing is lost by exposing it', () => {
    const err = new Error('boom');
    cronError(err, 'Failed to refresh FX rates', 'api/cron/fx-rates');

    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    expect(reportErrorMock).toHaveBeenCalledWith(err, { scope: 'api/cron/fx-rates', meta: { status: 500 } });
  });
});
