import { describe, it, expect, vi, beforeEach } from 'vitest';

let rpcRows: any[] = [];
let rpcError: { message: string } | null = null;
const rpcCalls: any[] = [];

const supabase = {
  rpc: async (fn: string, params: any): Promise<{ data: any[] | null; error: { message: string } | null }> => {
    if (fn !== 'market_top_similar_candidates') throw new Error(`unexpected rpc ${fn}`);
    rpcCalls.push(params);
    return { data: rpcError ? null : rpcRows, error: rpcError };
  },
} as any;

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'mp1',
    title: 'GPU',
    price: '100000',
    currency: 'PKR',
    url: 'https://example.com/x',
    category_slug: 'gpus',
    platform_id: 'p1',
    platform_name: 'Daraz',
    rating: '4.5',
    rating_count: '10',
    sold_count: '20',
    seller_external_id: 'daraz-seller-a',
    similarity_score: 0.5,
    ...overrides,
  };
}

import { findTopSimilarCandidates } from './candidate-search';

beforeEach(() => {
  rpcRows = [];
  rpcError = null;
  rpcCalls.length = 0;
});

describe('findTopSimilarCandidates', () => {
  it('calls the RPC with the given scope, title and limit', async () => {
    await findTopSimilarCandidates(supabase, ['gpus'], ['p1', 'p2'], 'RTX 4070', 50);
    expect(rpcCalls).toEqual([
      { p_category_slugs: ['gpus'], p_platform_ids: ['p1', 'p2'], p_query_title: 'RTX 4070', p_limit: 50 },
    ]);
  });

  it('defaults the limit when not given', async () => {
    await findTopSimilarCandidates(supabase, ['gpus'], ['p1'], 'RTX 4070');
    expect(rpcCalls[0].p_limit).toBe(100);
  });

  it('maps numeric-string Postgres fields to real numbers', async () => {
    rpcRows = [row()];
    const result = await findTopSimilarCandidates(supabase, ['gpus'], ['p1'], 'RTX 4070');
    expect(result[0]).toEqual({
      id: 'mp1',
      title: 'GPU',
      price: 100000,
      currency: 'PKR',
      url: 'https://example.com/x',
      categorySlug: 'gpus',
      platformId: 'p1',
      platformName: 'Daraz',
      rating: 4.5,
      ratingCount: 10,
      soldCount: 20,
      sellerExternalId: 'daraz-seller-a',
    });
  });

  it('preserves null fields rather than coercing to 0', async () => {
    rpcRows = [row({ price: null, rating: null, rating_count: null, sold_count: null, seller_external_id: null })];
    const result = await findTopSimilarCandidates(supabase, ['gpus'], ['p1'], 'RTX 4070');
    expect(result[0].price).toBeNull();
    expect(result[0].rating).toBeNull();
    expect(result[0].ratingCount).toBeNull();
    expect(result[0].soldCount).toBeNull();
    expect(result[0].sellerExternalId).toBeNull();
  });

  it('returns an empty array without calling the RPC when categorySlugs is empty', async () => {
    const result = await findTopSimilarCandidates(supabase, [], ['p1'], 'RTX 4070');
    expect(result).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });

  it('returns an empty array without calling the RPC when platformIds is empty', async () => {
    const result = await findTopSimilarCandidates(supabase, ['gpus'], [], 'RTX 4070');
    expect(result).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });

  it('returns an empty array without calling the RPC for a blank query title', async () => {
    const result = await findTopSimilarCandidates(supabase, ['gpus'], ['p1'], '   ');
    expect(result).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });

  it('returns an empty array on an RPC error rather than throwing', async () => {
    rpcError = { message: 'boom' };
    const result = await findTopSimilarCandidates(supabase, ['gpus'], ['p1'], 'RTX 4070');
    expect(result).toEqual([]);
  });
});
