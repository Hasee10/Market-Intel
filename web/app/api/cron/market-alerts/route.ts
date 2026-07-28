import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/smtp';
import config from '@/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Database is not configured on this deployment.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function h(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type Change = {
  watchlistItemId: string;
  title: string;
  url: string;
  currency: string;
  oldPrice: number | null;
  newPrice: number | null;
};

function buildAlertEmailHtml(changes: Change[]): string {
  const rows = changes
    .map((c) => {
      const direction =
        c.oldPrice !== null && c.newPrice !== null && c.newPrice < c.oldPrice ? 'dropped' : 'changed';
      return `<li style="margin-bottom:12px;">
        <a href="${h(c.url)}" style="font-weight:600;color:#18181b;text-decoration:none;">${h(c.title)}</a>
        <div style="color:#71717a;font-size:13px;">
          Price ${direction}: ${c.currency} ${c.oldPrice?.toLocaleString() ?? '—'} &rarr; ${c.currency} ${c.newPrice?.toLocaleString() ?? '—'}
        </div>
      </li>`;
    })
    .join('');

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#18181b;">${changes.length} price change${changes.length > 1 ? 's' : ''} on your watchlist</h2>
      <p style="color:#71717a;">From ${h(config.title)} Market Intel.</p>
      <ul style="list-style:none;padding:0;">${rows}</ul>
      <p><a href="${h(config.url)}/intel/dashboard" style="color:#18181b;">View your dashboard</a></p>
    </div>
  `;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getAdminClient();

  const { data: items, error: itemsError } = await supabase
    .from('market_watchlist_items')
    .select('id, watchlist_id, product_id');
  if (itemsError) throw itemsError;
  if (!items || items.length === 0) {
    return NextResponse.json({ ok: true, accountsAlerted: 0, itemsAlerted: 0 });
  }

  const watchlistIds = [...new Set(items.map((i) => i.watchlist_id as string))];
  const productIds = [...new Set(items.map((i) => i.product_id as string))];

  const [{ data: watchlists, error: watchlistsError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase.from('market_watchlists').select('id, account_id').in('id', watchlistIds),
      supabase.from('market_products').select('id, title, url, currency').in('id', productIds),
    ]);
  if (watchlistsError) throw watchlistsError;
  if (productsError) throw productsError;

  const accountIds = [...new Set((watchlists ?? []).map((w) => w.account_id as string))];
  const { data: accounts, error: accountsError } = await supabase
    .from('market_accounts')
    .select('id, email')
    .in('id', accountIds);
  if (accountsError) throw accountsError;

  const { data: history, error: historyError } = await supabase
    .from('market_price_history')
    .select('product_id, price, recorded_at')
    .in('product_id', productIds)
    .order('recorded_at', { ascending: false });
  if (historyError) throw historyError;

  const latestTwoByProduct = new Map<string, number[]>();
  for (const row of history ?? []) {
    const productId = row.product_id as string;
    const list = latestTwoByProduct.get(productId) ?? [];
    if (list.length < 2) {
      list.push(row.price as number);
      latestTwoByProduct.set(productId, list);
    }
  }

  const { data: pastAlerts, error: pastAlertsError } = await supabase
    .from('market_alerts_sent')
    .select('watchlist_item_id, new_price, sent_at')
    .in(
      'watchlist_item_id',
      items.map((i) => i.id as string)
    )
    .order('sent_at', { ascending: false });
  if (pastAlertsError) throw pastAlertsError;

  const lastAlertedPriceByItem = new Map<string, number | null>();
  for (const alert of pastAlerts ?? []) {
    const itemId = alert.watchlist_item_id as string;
    if (!lastAlertedPriceByItem.has(itemId)) {
      lastAlertedPriceByItem.set(itemId, alert.new_price as number | null);
    }
  }

  const watchlistById = new Map((watchlists ?? []).map((w) => [w.id as string, w]));
  const productById = new Map((products ?? []).map((p) => [p.id as string, p]));
  const accountById = new Map((accounts ?? []).map((a) => [a.id as string, a]));

  const changesByAccount = new Map<string, Change[]>();

  for (const item of items) {
    const [newPrice, oldPrice] = latestTwoByProduct.get(item.product_id as string) ?? [];
    if (newPrice === undefined || oldPrice === undefined || newPrice === oldPrice) continue;

    const alreadyAlerted = lastAlertedPriceByItem.get(item.id as string);
    if (alreadyAlerted !== undefined && alreadyAlerted === newPrice) continue;

    const watchlist = watchlistById.get(item.watchlist_id as string);
    const product = productById.get(item.product_id as string);
    const account = watchlist ? accountById.get(watchlist.account_id as string) : undefined;
    if (!watchlist || !product || !account) continue;

    const change: Change = {
      watchlistItemId: item.id as string,
      title: product.title as string,
      url: product.url as string,
      currency: (product.currency as string) ?? 'PKR',
      oldPrice,
      newPrice,
    };

    const list = changesByAccount.get(account.id as string) ?? [];
    list.push(change);
    changesByAccount.set(account.id as string, list);
  }

  let accountsAlerted = 0;
  const alertRowsToInsert: { watchlist_item_id: string; reason: string; old_price: number | null; new_price: number | null }[] = [];

  for (const [accountId, changes] of changesByAccount) {
    const account = accountById.get(accountId);
    if (!account?.email) continue;
    try {
      await sendEmail({
        to: account.email as string,
        subject: `${changes.length} price change${changes.length > 1 ? 's' : ''} on your Market Intel watchlist`,
        html: buildAlertEmailHtml(changes),
      });
      accountsAlerted++;
      for (const c of changes) {
        alertRowsToInsert.push({
          watchlist_item_id: c.watchlistItemId,
          reason: 'price_change',
          old_price: c.oldPrice,
          new_price: c.newPrice,
        });
      }
    } catch (error) {
      console.error(`[cron/market-alerts] Failed to notify account ${accountId}:`, error);
    }
  }

  if (alertRowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from('market_alerts_sent').insert(alertRowsToInsert);
    if (insertError) throw insertError;
  }

  return NextResponse.json({
    ok: true,
    accountsAlerted,
    itemsAlerted: alertRowsToInsert.length,
  });
}
