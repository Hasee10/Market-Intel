'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';

// useToast is behaviour, not styling - it renders outside this tree
// entirely. Kept while Chakra is still installed rather than building a
// toast system just for this page; it goes with the final Chakra removal.
import { useToast } from '@chakra-ui/react';

import { Card } from '@/components/ui/Card';
import { Table, THead, TH, TBody, TR, TD, Pill } from '@/components/ui/Table';
import { ProductThumb } from '@/components/ui/ProductThumb';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import {
  relativeTime,
  NOTIFICATION_TYPE_DOT,
  NOTIFICATION_TYPE_LABEL,
} from '@/lib/relative-time';
import {
  MdDelete,
  MdAdd,
  MdSearch,
  MdOutlinePriceCheck,
  MdOutlineNotificationsActive,
  MdOutlineVisibility,
  MdOutlineCheckCircle,
} from 'react-icons/md';

import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';
import { PageHeader } from '@/components/marketintel/PageHeader';
import type { Watchlist, WatchlistItem, ProductSearchResult } from '@/lib/market-intel/watchlists';
import type { Notification } from '@/lib/notifications/list';

// Same instant-insight pattern as Overview/Market (InsightStrip.tsx) - one
// plain-English headline instead of asking the seller to read a list.
// Priority: unread competitor price alerts (the thing this whole page
// exists to surface) > any other unread alert (e.g. low-stock, which also
// lands in this same feed) > "nothing tracked yet" (a real onboarding gap,
// not a calm state) > calm fallback with the actual tracked count, so
// "caught up" still says something concrete rather than just "all good".
function computeWatchlistInsight(notifications: Notification[], watchlists: Watchlist[]): Insight {
  const unread = notifications.filter((n) => !n.isRead);
  const unreadPriceAlerts = unread.filter((n) => n.type === 'price_alert');

  if (unreadPriceAlerts.length > 0) {
    return {
      tone: 'warning',
      icon: MdOutlinePriceCheck,
      headline: `${unreadPriceAlerts.length} competitor price change${unreadPriceAlerts.length === 1 ? '' : 's'} to review`,
      detail: 'A tracked product just moved - see Recent alerts below.',
    };
  }

  if (unread.length > 0) {
    return {
      tone: 'warning',
      icon: MdOutlineNotificationsActive,
      headline: `${unread.length} unread alert${unread.length === 1 ? '' : 's'}`,
      detail: 'See Recent alerts below for what changed.',
    };
  }

  const trackedCount = watchlists.reduce((sum, w) => sum + w.items.length, 0);
  if (trackedCount === 0) {
    return {
      tone: 'neutral',
      icon: MdOutlineVisibility,
      headline: "You're not tracking any competitors yet",
      detail: 'Search for a product below and add it to a watchlist to get price and stock alerts.',
    };
  }

  return {
    tone: 'good',
    icon: MdOutlineCheckCircle,
    headline: 'No new alerts',
    detail: `Tracking ${trackedCount} product${trackedCount === 1 ? '' : 's'} across ${watchlists.length} watchlist${watchlists.length === 1 ? '' : 's'} - nothing has changed.`,
  };
}

// Currency comes from the seller's own reporting setting - it used to be
// hardcoded to PKR here, which mislabelled every price for a seller reporting
// in anything else.
function formatPrice(value: number | null, currency: string) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

type WatchlistViewProps = {
  categorySlug: string | null;
  reportingCurrency: string;
  watchlists: Watchlist[];
  notifications: Notification[];
};

export default function WatchlistView({
  categorySlug,
  reportingCurrency,
  watchlists: initialWatchlists,
  notifications: initialNotifications,
}: WatchlistViewProps) {
  const toast = useToast();
  const [watchlists, setWatchlists] = useState(initialWatchlists);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  // 5 per page: the feed is capped at 20 by the page's own query, and the
  // alerts card sat above the watchlists themselves - twenty rows pushed the
  // thing the page is named after below the fold.
  const alertPage = usePagination(notifications, 5);

  async function handleCreateWatchlist() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.succeeded) {
        throw new Error(result.errors?.join(', ') || 'Failed to create watchlist');
      }
      setWatchlists((prev) => [result.data, ...prev]);
      setNewName('');
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'Failed to create watchlist' });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteWatchlist(id: string) {
    const response = await fetch(`/api/watchlists/${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.succeeded) {
      toast({ status: 'error', title: result.errors?.join(', ') || 'Failed to delete watchlist' });
      return;
    }
    setWatchlists((prev) => prev.filter((w) => w.id !== id));
  }

  function handleItemAdded(watchlistId: string, item: WatchlistItem) {
    setWatchlists((prev) =>
      prev.map((w) => (w.id === watchlistId ? { ...w, items: [item, ...w.items] } : w)),
    );
  }

  async function handleRemoveItem(watchlistId: string, itemId: string) {
    const response = await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.succeeded) {
      toast({ status: 'error', title: result.errors?.join(', ') || 'Failed to remove item' });
      return;
    }
    setWatchlists((prev) =>
      prev.map((w) => (w.id === watchlistId ? { ...w, items: w.items.filter((i) => i.id !== itemId) } : w)),
    );
  }

  async function handleMarkRead(notificationId: string) {
    await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
  }

  async function handleMarkAllRead() {
    const response = await fetch('/api/notifications/read-all', { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.succeeded) {
      toast({ status: 'error', title: result.errors?.join(', ') || 'Failed to mark alerts read' });
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div className="font-outfit">
      <PageHeader title="Watchlist" />

      {/* Computed from live state, not the initial props, so marking an
          alert read or adding a tracked product updates the headline
          without a page reload. */}
      <InsightStrip insight={computeWatchlistInsight(notifications, watchlists)} />

      <Card
        className="mb-5"
        title="Recent alerts"
        action={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
            >
              Mark all read ({unreadCount})
            </button>
          ) : null
        }
      >
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No price or stock alerts yet. Add a competitor product to a watchlist below to start
            tracking it.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {alertPage.visible.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-center justify-between gap-3 rounded-xl p-2.5 ${
                    n.isRead ? '' : 'bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    {/* Type dot: low_stock is about the seller's own product,
                        price_alert about a competitor's, and both land in
                        this one feed with nothing else separating them. */}
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        NOTIFICATION_TYPE_DOT[n.type] ?? 'bg-gray-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {n.title}
                        <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                          {NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{n.message}</p>
                      {/* The reason this is here: low-stock re-alerts fire at
                          most once a day per product, so a product sitting
                          under the threshold for a week produces several
                          identical messages. Without a timestamp they read as
                          the same alert duplicated rather than as what they
                          are - the same problem, still unfixed, days apart. */}
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Pagination
              page={alertPage.page}
              pageCount={alertPage.pageCount}
              onPageChange={alertPage.setPage}
              rangeStart={alertPage.rangeStart}
              rangeEnd={alertPage.rangeEnd}
              total={alertPage.total}
              label="alerts"
            />
          </>
        )}
      </Card>

      <Card className="mb-5">
        <div className="mb-4 flex flex-wrap gap-2.5">
          <input
            type="text"
            placeholder="New watchlist name (e.g. Mobile competitors)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-gray-800"
          />
          <button
            type="button"
            onClick={handleCreateWatchlist}
            disabled={creating}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            <MdAdd className="size-4" aria-hidden="true" />
            {creating ? 'Creating…' : 'New watchlist'}
          </button>
        </div>

        {watchlists.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No watchlists yet. Create one to start tracking competitor products.
          </p>
        )}
      </Card>

      {watchlists.map((watchlist) => (
        <WatchlistCard
          key={watchlist.id}
          watchlist={watchlist}
          categorySlug={categorySlug}
          reportingCurrency={reportingCurrency}
          onDelete={() => handleDeleteWatchlist(watchlist.id)}
          onItemAdded={(item) => handleItemAdded(watchlist.id, item)}
          onRemoveItem={(itemId) => handleRemoveItem(watchlist.id, itemId)}
        />
      ))}
    </div>
  );
}

function WatchlistCard({
  watchlist,
  categorySlug,
  reportingCurrency,
  onDelete,
  onItemAdded,
  onRemoveItem,
}: {
  watchlist: Watchlist;
  categorySlug: string | null;
  reportingCurrency: string;
  onDelete: () => void;
  onItemAdded: (item: WatchlistItem) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Distinguishes "typed too little to search yet" from "searched, found
  // nothing" - without it an empty result list is indistinguishable from the
  // initial state, which reads as a broken search.
  const [hasSearched, setHasSearched] = useState(false);

  // A watchlist has no size limit, and several of them render stacked on one
  // page, so an unpaged table here is the same scrolling problem the Market
  // and Competitors tables already fixed.
  const itemPage = usePagination(watchlist.items, 8);

  const trimmed = query.trim();

  // Live search: debounce keystrokes so every character doesn't fire a query,
  // and abort the in-flight request when the term changes. Without the abort,
  // a slow response for "lap" can land after a fast one for "laptop" and
  // overwrite the newer results.
  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (categorySlug) params.set('categorySlug', categorySlug);
        const response = await fetch(`/api/market-products/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        setResults(result.succeeded ? result.data : []);
        setHasSearched(true);
      } catch (error) {
        // An aborted request is a superseded search, not a failure.
        if ((error as Error).name !== 'AbortError') {
          setResults([]);
          setHasSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, categorySlug]);

  async function handleAdd(productId: string) {
    const response = await fetch(`/api/watchlists/${watchlist.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketProductId: productId }),
    });
    const result = await response.json();
    if (!response.ok || !result.succeeded) {
      toast({ status: 'error', title: result.errors?.join(', ') || 'Failed to add product' });
      return;
    }
    onItemAdded(result.data);
    setResults([]);
    setQuery('');
  }

  return (
    <Card
      className="mb-5"
      title={watchlist.name}
      action={
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {watchlist.items.length} tracked
          </span>
          {/* Deleting a watchlist takes every tracked product with it and
              there is no undo, so it asks first - the icon sits one click
              away from the remove-item button on every row. */}
          <button
            type="button"
            aria-label="Delete watchlist"
            onClick={() => {
              if (
                window.confirm(
                  watchlist.items.length > 0
                    ? `Delete "${watchlist.name}" and stop tracking its ${watchlist.items.length} product${watchlist.items.length === 1 ? '' : 's'}? This cannot be undone.`
                    : `Delete "${watchlist.name}"? This cannot be undone.`,
                )
              ) {
                onDelete();
              }
            }}
            className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-error-50 hover:text-error-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <MdDelete className="size-4" />
          </button>
        </div>
      }
    >
      <div className="relative mb-3">
        <MdSearch
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Search competitor products to track..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-gray-800"
        />
        {searching && (
          <span
            aria-label="Searching"
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500"
          />
        )}
      </div>

      {results.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5">
          {results.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-2 dark:bg-gray-800"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <ProductThumb src={r.imageUrl} alt="" categoryName={null} />
                <span className="min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">
                  {r.title} {r.platformName ? `· ${r.platformName}` : ''} ·{' '}
                  {formatPrice(r.price, reportingCurrency)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleAdd(r.id)}
                className="shrink-0 rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-600"
              >
                Track
              </button>
            </div>
          ))}
        </div>
      )}

      {hasSearched && !searching && results.length === 0 && (
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          No competitor products match “{trimmed}” in your market. Widen your{' '}
          <NextLink
            href="/dashboard/market/definition"
            className="font-medium text-brand-500 hover:underline dark:text-brand-400"
          >
            market definition
          </NextLink>{' '}
          if this looks wrong.
        </p>
      )}

      {watchlist.items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No products tracked yet in this watchlist.
        </p>
      ) : (
        <Table minWidth={560}>
          <THead>
            <TH>Product</TH>
            <TH>Platform</TH>
            <TH numeric>Price</TH>
            <TH>Stock</TH>
            <TH />
          </THead>
          <TBody>
            {itemPage.visible.map((item) => (
              <TR key={item.id}>
                <TD strong>
                  {/* categoryName is null on purpose: market_products carries
                      the scraped platform's own slug ("smartphones"), not a
                      seller category, so there is no tile colour to look up -
                      ProductThumb's neutral fallback is the honest option. */}
                  <span className="flex items-center gap-3">
                    <ProductThumb src={item.imageUrl} alt="" categoryName={null} />
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 hover:text-brand-500 hover:underline"
                    >
                      {item.title}
                    </a>
                  </span>
                </TD>
                <TD>{item.platformName ?? '—'}</TD>
                <TD numeric>{formatPrice(item.price, reportingCurrency)}</TD>
                <TD>
                  <Pill tone={item.inStock ? 'success' : 'error'}>
                    {item.inStock ? 'In stock' : 'Out of stock'}
                  </Pill>
                </TD>
                <TD>
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => onRemoveItem(item.id)}
                    className="flex size-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-error-50 hover:text-error-600 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    <MdDelete className="size-3.5" />
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {watchlist.items.length > 0 && (
        <Pagination
          page={itemPage.page}
          pageCount={itemPage.pageCount}
          onPageChange={itemPage.setPage}
          rangeStart={itemPage.rangeStart}
          rangeEnd={itemPage.rangeEnd}
          total={itemPage.total}
          label="products"
        />
      )}
    </Card>
  );
}
