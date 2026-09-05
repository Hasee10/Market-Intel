import { describe, it, expect, vi, beforeEach } from 'vitest';

let rpcRows: any[] = [];
let rpcError: { message: string } | null = null;
const rpcCalls: any[] = [];

// Batch RPC responses are configured separately so a test can make the batch
// function fail (e.g. migration 047 not applied) while the single-title one
// still works, which is exactly the fallback path.
let batchRows: any[] = [];
let batchError: { code?: string; message: string } | null = null;
const batchCalls: any[] = [];

const supabase = {
  rpc: async (fn: string, params: any): Promise<{ data: any[] | null; error: any }> => {
    if (fn === 'market_top_similar_candidates') {
      rpcCalls.push(params);
      return { data: rpcError ? null : rpcRows, error: rpcError };
    }
    if (fn === 'market_top_similar_candidates_batch') {
      batchCalls.push(params);
      return { data: batchError ? null : batchRows, error: batchError };
    }
    throw new Error(`unexpected rpc ${fn}`);
  },
} as any;

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'mp1',
    title: 'GPU',
    price: '100000',
    currency: 'PKR',
    url: 'https://example.com/x',
    image_url: 'https://example.com/x.jpg',
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

import { CANDIDATE_BATCH_SIZE, findTopSimilarCandidates, findTopSimilarCandidatesBatch } from './candidate-search';

beforeEach(() => {
  rpcRows = [];
  rpcError = null;
  rpcCalls.length = 0;
  batchRows = [];
  batchError = null;
  batchCalls.length = 0;
  vi.restoreAllMocks();
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
      imageUrl: 'https://example.com/x.jpg',
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

describe('findTopSimilarCandidatesBatch', () => {
  it('sends titles in one call when they fit a single chunk, index-aligned', async () => {
    batchRows = [
      row({ id: 'a', query_index: 0 }),
      row({ id: 'b', query_index: 2 }),
      row({ id: 'c', query_index: 0 }),
    ];
    const result = await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], ['RTX 4070', 'Keyboard', 'Mouse']);

    expect(batchCalls).toHaveLength(1);
    expect(batchCalls[0]).toEqual({
      p_category_slugs: ['gpus'],
      p_platform_ids: ['p1'],
      p_query_titles: ['RTX 4070', 'Keyboard', 'Mouse'],
      p_limit: 100,
    });
    // Slot 1 matched nothing - it must still exist, as an empty array.
    expect(result).toHaveLength(3);
    expect(result[0].map((c) => c.id)).toEqual(['a', 'c']);
    expect(result[1]).toEqual([]);
    expect(result[2].map((c) => c.id)).toEqual(['b']);
  });

  // The whole point of CANDIDATE_BATCH_SIZE: one 20-title call measured 952ms
  // against 341ms for four concurrent 5-title calls (see migration 047).
  it('splits more titles than CANDIDATE_BATCH_SIZE across several concurrent calls', async () => {
    const titles = Array.from({ length: 12 }, (_, i) => `Product ${i}`);
    await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], titles);

    expect(CANDIDATE_BATCH_SIZE).toBe(5);
    expect(batchCalls.map((c) => c.p_query_titles)).toEqual([
      ['Product 0', 'Product 1', 'Product 2', 'Product 3', 'Product 4'],
      ['Product 5', 'Product 6', 'Product 7', 'Product 8', 'Product 9'],
      ['Product 10', 'Product 11'],
    ]);
  });

  // query_index is chunk-relative, so a row from the 2nd chunk carrying
  // query_index 0 must land on the 6th title, not the 1st. Getting this wrong
  // would silently score seller products against each other's competitors.
  it('resolves chunk-relative query_index back to the caller\'s absolute index', async () => {
    const titles = Array.from({ length: 7 }, (_, i) => `Product ${i}`);
    // Every chunk's mock response says query_index 0 and 1.
    batchRows = [row({ id: 'first', query_index: 0 }), row({ id: 'second', query_index: 1 })];
    const result = await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], titles);

    expect(batchCalls).toHaveLength(2);
    // Chunk 1 (titles 0-4) fills slots 0 and 1; chunk 2 (titles 5-6) fills 5 and 6.
    expect(result[0].map((c) => c.id)).toEqual(['first']);
    expect(result[1].map((c) => c.id)).toEqual(['second']);
    expect(result[2]).toEqual([]);
    expect(result[5].map((c) => c.id)).toEqual(['first']);
    expect(result[6].map((c) => c.id)).toEqual(['second']);
  });

  it('maps Postgres numeric strings the same way the single-title path does', async () => {
    batchRows = [row({ query_index: 0 })];
    const [first] = await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], ['RTX 4070']);
    expect(first[0].price).toBe(100000);
    expect(first[0].rating).toBe(4.5);
    expect(first[0].sellerExternalId).toBe('daraz-seller-a');
  });

  it('keeps a slot for a blank title without sending it to the database', async () => {
    batchRows = [row({ id: 'a', query_index: 0 }), row({ id: 'b', query_index: 1 })];
    const result = await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], ['RTX 4070', '   ', 'Mouse']);

    // The blank title is not sent, so the RPC only ever sees two titles...
    expect(batchCalls[0].p_query_titles).toEqual(['RTX 4070', 'Mouse']);
    // ...but the caller still gets three slots, with the blank one empty and
    // 'Mouse' in its ORIGINAL position 2, not the position it was sent in.
    expect(result).toHaveLength(3);
    expect(result[0].map((c) => c.id)).toEqual(['a']);
    expect(result[1]).toEqual([]);
    expect(result[2].map((c) => c.id)).toEqual(['b']);
  });

  it('gives duplicate titles their own independent slots', async () => {
    batchRows = [row({ id: 'a', query_index: 0 }), row({ id: 'b', query_index: 1 })];
    const result = await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], ['Same', 'Same']);
    expect(batchCalls[0].p_query_titles).toEqual(['Same', 'Same']);
    expect(result[0].map((c) => c.id)).toEqual(['a']);
    expect(result[1].map((c) => c.id)).toEqual(['b']);
  });

  it('returns one empty array per title, without calling the RPC, for an empty scope', async () => {
    const result = await findTopSimilarCandidatesBatch(supabase, [], ['p1'], ['a', 'b']);
    expect(result).toEqual([[], []]);
    expect(batchCalls).toHaveLength(0);
  });

  it('returns an empty result for no titles at all', async () => {
    const result = await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], []);
    expect(result).toEqual([]);
    expect(batchCalls).toHaveLength(0);
  });

  it('drops rows whose query_index is outside the range that was sent', async () => {
    batchRows = [row({ id: 'a', query_index: 0 }), row({ id: 'bad', query_index: 7 })];
    const result = await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], ['RTX 4070']);
    expect(result).toHaveLength(1);
    expect(result[0].map((c) => c.id)).toEqual(['a']);
  });

  it('does NOT fall back on an ordinary query error - it returns empty', async () => {
    batchError = { code: '42501', message: 'permission denied' };
    const result = await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], ['a', 'b']);
    expect(result).toEqual([[], []]);
    // A real error must not be retried as N single calls.
    expect(rpcCalls).toHaveLength(0);
  });

  // Migrations here are applied by hand, so the app can ship before 047 runs.
  for (const code of ['PGRST202', '42883']) {
    it(`falls back to per-title calls when the batch function is missing (${code})`, async () => {
      batchError = { code, message: 'could not find function' };
      rpcRows = [row({ id: 'single' })];
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await findTopSimilarCandidatesBatch(supabase, ['gpus'], ['p1'], ['RTX 4070', '  ', 'Mouse']);

      // One single-title call per non-blank title, and results land back in
      // their original slots - same contract as the batch path.
      expect(rpcCalls.map((c) => c.p_query_title)).toEqual(['RTX 4070', 'Mouse']);
      expect(result).toHaveLength(3);
      expect(result[0].map((c) => c.id)).toEqual(['single']);
      expect(result[1]).toEqual([]);
      expect(result[2].map((c) => c.id)).toEqual(['single']);
      expect(warn).toHaveBeenCalledOnce();
    });
  }
});
