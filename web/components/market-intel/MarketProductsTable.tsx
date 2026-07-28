'use client';

import { ExternalLink, Star } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PaginationControl } from '@/components/ui/pagination-control';
import { usePagination } from '@/lib/hooks/usePagination';
import type { MarketProduct } from '@/lib/market-intel/products';

const PRODUCTS_PER_PAGE = 50;

function formatPrice(currency: string, value: number | null): string {
  if (value === null) return '—';
  return `${currency} ${value.toLocaleString()}`;
}

function discountPercent(price: number | null, compareAtPrice: number | null): number | null {
  if (!price || !compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function MarketProductsTable({
  initial,
  initialWatchedIds,
}: {
  initial: MarketProduct[];
  initialWatchedIds: string[];
}) {
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [category, setCategory] = useState('all');
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [watched, setWatched] = useState<Set<string>>(() => new Set(initialWatchedIds));
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const { page, setPage } = usePagination();

  async function toggleWatch(productId: string) {
    if (pendingIds.has(productId)) return;
    const isWatched = watched.has(productId);

    setPendingIds((prev) => new Set(prev).add(productId));
    setWatched((prev) => {
      const next = new Set(prev);
      if (isWatched) next.delete(productId);
      else next.add(productId);
      return next;
    });

    try {
      const res = isWatched
        ? await fetch(`/api/market-intel/watchlist?productId=${encodeURIComponent(productId)}`, {
            method: 'DELETE',
          })
        : await fetch('/api/market-intel/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
          });
      if (!res.ok) throw new Error('Failed to update watchlist');
    } catch {
      // Revert on failure.
      setWatched((prev) => {
        const next = new Set(prev);
        if (isWatched) next.add(productId);
        else next.delete(productId);
        return next;
      });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }

  const platforms = useMemo(
    () => [...new Set(initial.map((p) => p.platformSlug))].sort(),
    [initial]
  );
  const categories = useMemo(
    () => [...new Set(initial.map((p) => p.categorySlug).filter((c): c is string => Boolean(c)))].sort(),
    [initial]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initial.filter((p) => {
      if (watchedOnly && !watched.has(p.id)) return false;
      if (platform !== 'all' && p.platformSlug !== platform) return false;
      if (category !== 'all' && p.categorySlug !== category) return false;
      if (q && !p.title.toLowerCase().includes(q) && !(p.brand ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initial, search, platform, category, watchedOnly, watched]);

  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  const startIndex = (page - 1) * PRODUCTS_PER_PAGE;
  const paginated = filtered.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="w-full max-w-xs rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          onChange={(e) => updateFilter(setSearch, e.target.value)}
          placeholder="Search title or brand..."
          type="text"
          value={search}
        />
        <select
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          onChange={(e) => updateFilter(setPlatform, e.target.value)}
          value={platform}
        >
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          onChange={(e) => updateFilter(setCategory, e.target.value)}
          value={category}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            checked={watchedOnly}
            className="h-3.5 w-3.5"
            onChange={(e) => updateFilter(setWatchedOnly, e.target.checked)}
            type="checkbox"
          />
          Watchlist only ({watched.size})
        </label>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {filtered.length} of {initial.length} products
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">
                <span className="sr-only">Watch</span>
              </th>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Platform</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2 font-medium">Discount</th>
              <th className="px-4 py-2 font-medium">Stock</th>
              <th className="px-4 py-2 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {paginated.map((p) => {
              const discount = discountPercent(p.price, p.compareAtPrice);
              return (
                <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                  <td className="px-4 py-2">
                    <button
                      aria-label={watched.has(p.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                      aria-pressed={watched.has(p.id)}
                      className="text-zinc-300 transition-colors hover:text-amber-500 disabled:opacity-50 dark:text-zinc-700"
                      disabled={pendingIds.has(p.id)}
                      onClick={() => toggleWatch(p.id)}
                      type="button"
                    >
                      <Star
                        aria-hidden="true"
                        className={`h-4 w-4 ${watched.has(p.id) ? 'fill-amber-500 text-amber-500' : ''}`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                        href={`/intel/products/${p.id}`}
                      >
                        {p.title}
                      </Link>
                      <a
                        aria-label="View original listing"
                        className="text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                        href={p.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    {p.brand && <p className="text-xs text-zinc-500 dark:text-zinc-400">{p.brand}</p>}
                  </td>
                  <td className="px-4 py-2 capitalize text-zinc-600 dark:text-zinc-400">{p.platformSlug}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{p.categorySlug ?? '—'}</td>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                    {formatPrice(p.currency, p.price)}
                    {p.compareAtPrice && p.compareAtPrice !== p.price && (
                      <span className="ml-1.5 text-xs text-zinc-400 line-through">
                        {formatPrice(p.currency, p.compareAtPrice)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {discount ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                        -{discount}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {p.inStock === null ? (
                      '—'
                    ) : p.inStock ? (
                      <span className="text-green-700 dark:text-green-400">In stock</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Out of stock</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(p.lastSeenAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400" colSpan={8}>
                  No products match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PRODUCTS_PER_PAGE && (
        <PaginationControl itemsPerPage={PRODUCTS_PER_PAGE} totalItems={filtered.length} />
      )}
    </div>
  );
}
