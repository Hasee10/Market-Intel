'use client';

import { useEffect, useState } from 'react';

import {
  PRICE_POSITION_BAND_LABEL,
  summarisePortfolioBands,
  type ClassifiedPortfolioProduct,
} from '@/lib/market-intel/core/price-position-bands';
import type { IApiResponse } from '@/types/api-response';

// The screen this panel replaces: checking price standing one product at a
// time, via the Competitors drawer, with no way to see "how many of my
// products are actually priced out of line" without opening every one of
// them.
//
// Each product plotted against its OWN category's median (getCategoryPricing
// - the same free-tier data the Market page's "Category pricing" card
// already shows), not a title-matched competitor. That is coarser than the
// drawer's per-product panel, and the trade is deliberate: it is what lets
// this cover the whole catalogue in one request instead of paying a
// competitor-matching query per product.

const BAND_STYLE: Record<string, string> = {
  'far-above': 'bg-error-500',
  above: 'bg-orange-400',
  'at-market': 'bg-gray-400',
  below: 'bg-brand-300',
  'far-below': 'bg-brand-500',
};

const MAX_EXAMPLES_PER_BAND = 4;

export function PortfolioPriceBandsPanel({ currency, className = '' }: { currency: string; className?: string }) {
  const [products, setProducts] = useState<ClassifiedPortfolioProduct[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/portfolio/price-positions')
      .then((res) => res.json())
      .then((data: IApiResponse<ClassifiedPortfolioProduct[]>) => {
        if (cancelled) return;
        if (!data.succeeded) {
          setError(true);
          return;
        }
        setProducts(data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const money = (v: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

  if (error) return null;

  if (products == null) {
    return (
      <div className={className}>
        <div className="h-5 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="mt-3 flex flex-col gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No active product has both a price and scraped competitor pricing for its category yet -
          this fills in as your catalogue and our coverage grow.
        </p>
      </div>
    );
  }

  const bands = summarisePortfolioBands(products);
  const busiest = Math.max(...bands.map((b) => b.count), 1);
  const outOfLine = (bands.find((b) => b.band === 'far-above')?.count ?? 0) +
    (bands.find((b) => b.band === 'far-below')?.count ?? 0);
  const hasPerUnit = products.some((p) => p.perUnit);

  return (
    <div className={className}>
      <p className="mb-1.5 text-[15px] leading-snug text-gray-900 dark:text-white">
        {outOfLine > 0 ? (
          <>
            <span className="text-lg font-semibold text-error-700 dark:text-error-500">
              {outOfLine} of {products.length}
            </span>{' '}
            products are priced 25% or more away from their category&apos;s median.
          </>
        ) : (
          <span className="font-semibold text-success-700 dark:text-success-500">
            Nothing in your catalogue is far off its category&apos;s median.
          </span>
        )}
      </p>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Comparing {products.length} priced product{products.length === 1 ? '' : 's'} against each
        one&apos;s own category median.
        {hasPerUnit && ' Multipack prices are compared per item; the category median is not.'}
      </p>

      <div className="flex flex-col gap-2">
        {bands.map(({ band, count, products: bandProducts }) => (
          <div key={band}>
            <div className="flex items-center gap-3">
              <span className="w-[92px] shrink-0 text-right text-xs text-gray-600 dark:text-gray-300">
                {PRICE_POSITION_BAND_LABEL[band]}
              </span>
              <span className="relative h-5 min-w-0 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                <span
                  className={`block h-full rounded ${BAND_STYLE[band]}`}
                  style={{ width: count === 0 ? 0 : `${(count / busiest) * 100}%` }}
                />
              </span>
              <span className="w-[72px] shrink-0 text-xs text-gray-600 tabular-nums dark:text-gray-300">
                {count === 0 ? <span className="text-gray-400 dark:text-gray-500">none</span> : `${count} product${count === 1 ? '' : 's'}`}
              </span>
            </div>

            {(band === 'far-above' || band === 'far-below') && bandProducts.length > 0 && (
              <ul className="mt-1 ml-[104px] flex flex-col gap-0.5">
                {bandProducts.slice(0, MAX_EXAMPLES_PER_BAND).map((p) => (
                  <li key={p.sellerProductId} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <span className="shrink-0 tabular-nums">
                      {money(p.price)}
                      {p.perUnit && '/item'} vs {money(p.categoryMedian)} median
                    </span>
                  </li>
                ))}
                {bandProducts.length > MAX_EXAMPLES_PER_BAND && (
                  <li className="text-xs text-gray-400 dark:text-gray-500">
                    +{bandProducts.length - MAX_EXAMPLES_PER_BAND} more
                  </li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PortfolioPriceBandsPanel;
