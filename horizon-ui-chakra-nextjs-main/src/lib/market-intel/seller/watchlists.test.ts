import { describe, it, expect, beforeEach, vi } from 'vitest';

// Records every filter applied to a query so the assertions below can check
// that the seller scope actually reached Supabase, not just that the call
// returned. The point of these tests is the WHERE clause.
type Filters = Record<string, unknown>;

let selectResult: { data: unknown; error: { message: string } | null } = { data: null, error: null };
let deleteResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let lastSelectFilters: Filters = {};
let lastDeleteFilters: Filters = {};
let deleteCalled = false;

function builder(kind: 'select' | 'delete' | 'insert') {
  const filters: Filters = {};
  const b: any = {
    select: () => b,
    insert: () => builder('insert'),
    eq: (col: string, val: unknown) => {
      filters[col] = val;
      return b;
    },
    maybeSingle: () => {
      lastSelectFilters = filters;
      return Promise.resolve(selectResult);
    },
    single: () => Promise.resolve(selectResult),
    then: (resolve: (v: unknown) => void) => {
      if (kind === 'delete') {
        lastDeleteFilters = filters;
        return resolve(deleteResult);
      }
      lastSelectFilters = filters;
      return resolve(selectResult);
    },
  };
  return b;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => builder('select'),
      delete: () => {
        deleteCalled = true;
        return builder('delete');
      },
      insert: () => builder('insert'),
    }),
  }),
}));

import { deleteWatchlist, removeWatchlistItem, addWatchlistItem } from './watchlists';

beforeEach(() => {
  selectResult = { data: null, error: null };
  deleteResult = { data: [], error: null };
  lastSelectFilters = {};
  lastDeleteFilters = {};
  deleteCalled = false;
});

describe('deleteWatchlist', () => {
  it('scopes the delete to the calling seller, not just the watchlist id', async () => {
    deleteResult = { data: [{ id: 'w1' }], error: null };
    await deleteWatchlist('w1', 'seller1');
    expect(lastDeleteFilters).toEqual({ id: 'w1', seller_id: 'seller1' });
  });

  it("throws rather than reporting success when the row isn't the seller's", async () => {
    // A scoped delete that matches nothing comes back with no error and an
    // empty set - indistinguishable from success without this check.
    deleteResult = { data: [], error: null };
    await expect(deleteWatchlist('someone-elses', 'seller1')).rejects.toThrow('Watchlist not found');
  });
});

describe('removeWatchlistItem', () => {
  it('refuses when the item\'s parent watchlist belongs to another seller', async () => {
    selectResult = { data: null, error: null };
    await expect(removeWatchlistItem('item1', 'seller1')).rejects.toThrow('Watchlist item not found');
    expect(deleteCalled).toBe(false);
  });

  it('checks ownership through the parent watchlist before deleting', async () => {
    selectResult = { data: { id: 'item1' }, error: null };
    await removeWatchlistItem('item1', 'seller1');
    expect(lastSelectFilters).toEqual({
      id: 'item1',
      'seller_watchlists.seller_id': 'seller1',
    });
    expect(deleteCalled).toBe(true);
  });
});

describe('addWatchlistItem', () => {
  it("refuses to add to a watchlist the seller doesn't own", async () => {
    selectResult = { data: null, error: null };
    await expect(addWatchlistItem('w1', 'p1', 'seller1')).rejects.toThrow('Watchlist not found');
  });
});
