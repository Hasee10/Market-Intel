import 'server-only';

import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Database is not configured on this deployment.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getOrCreateDefaultWatchlist(accountId: string): Promise<string> {
  const supabase = getAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from('market_watchlists')
    .select('id')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from('market_watchlists')
    .insert({ account_id: accountId, name: 'My watchlist' })
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id as string;
}

export async function listWatchlistProductIds(accountId: string): Promise<string[]> {
  const supabase = getAdminClient();

  const { data: watchlists, error: watchlistsError } = await supabase
    .from('market_watchlists')
    .select('id')
    .eq('account_id', accountId);
  if (watchlistsError) throw watchlistsError;

  const watchlistIds = (watchlists ?? []).map((w) => w.id as string);
  if (watchlistIds.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from('market_watchlist_items')
    .select('product_id')
    .in('watchlist_id', watchlistIds);
  if (itemsError) throw itemsError;

  return (items ?? []).map((i) => i.product_id as string);
}

export async function addToWatchlist(accountId: string, productId: string): Promise<void> {
  const watchlistId = await getOrCreateDefaultWatchlist(accountId);
  const supabase = getAdminClient();

  const { error } = await supabase
    .from('market_watchlist_items')
    .upsert(
      { watchlist_id: watchlistId, product_id: productId },
      { onConflict: 'watchlist_id,product_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function removeFromWatchlist(accountId: string, productId: string): Promise<void> {
  const supabase = getAdminClient();

  const { data: watchlists, error: watchlistsError } = await supabase
    .from('market_watchlists')
    .select('id')
    .eq('account_id', accountId);
  if (watchlistsError) throw watchlistsError;

  const watchlistIds = (watchlists ?? []).map((w) => w.id as string);
  if (watchlistIds.length === 0) return;

  const { error } = await supabase
    .from('market_watchlist_items')
    .delete()
    .eq('product_id', productId)
    .in('watchlist_id', watchlistIds);
  if (error) throw error;
}
