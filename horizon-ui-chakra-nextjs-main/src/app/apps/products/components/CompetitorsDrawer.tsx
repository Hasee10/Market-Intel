'use client';

import { Fragment, useEffect, useState } from 'react';

import { MdOutlineOpenInNew, MdOutlineStar, MdExpandMore, MdExpandLess } from 'react-icons/md';

import { Drawer } from '@/components/ui/Drawer';
import { Table, THead, TH, TBody, TR, TD, Pill } from '@/components/ui/Table';
import { IProduct } from '@/types/products';
import { IApiResponse } from '@/types/api-response';

type CompetitorListing = {
  matchedTitle: string;
  matchedPlatformName: string | null;
  matchedPrice: number | null;
  matchedUrl: string;
  rating: number | null;
  ratingCount: number | null;
  soldCount: number | null;
  confidence: number;
  sellerPrice: number | null;
  /** Signed fraction: -0.07 = you are 7% cheaper than this listing. */
  priceDeltaPct: number | null;
  reviewCount: number;
  topReviews: { author: string | null; rating: number | null; text: string }[];
};

type CompetitorsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  product: IProduct | null;
  /** Matches the reportingCurrency the API converts listing prices into. */
  reportingCurrency: string;
};

const formatCurrency = (amount: number | null, currency: string) =>
  amount == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const formatRating = (rating: number | null, ratingCount: number | null) => {
  if (rating == null) return '—';
  return ratingCount != null ? `${rating.toFixed(1)} (${ratingCount})` : rating.toFixed(1);
};

// Signed on purpose, and phrased from the seller's side: they are reading
// this to decide whether to move their own price, so "you" is the subject.
const formatPriceDelta = (pct: number) => {
  const rounded = pct * 100;
  if (Math.abs(rounded) < 0.5) return 'same price';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(0)}%`;
};

// Scraped titles occasionally carry un-decoded HTML entities (e.g.
// "Sorting &amp; Stacking") straight from the source page's markup. Decoding
// via a detached textarea uses the browser's own parser instead of a
// hand-rolled entity table, so it's correct for every entity, not just the
// common ones - safe here because we only ever read `.value` back out as
// plain text, never re-render the decoded string as HTML.
const decodeHtmlEntities = (text: string): string => {
  if (typeof window === 'undefined') return text;
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
};

export function CompetitorsDrawer({ isOpen, onClose, product, reportingCurrency }: CompetitorsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<CompetitorListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleExpanded = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen || !product) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/products/${product.id}/competitors`)
      .then((res) => res.json())
      .then((data: IApiResponse<CompetitorListing[]>) => {
        if (cancelled) return;
        if (!data.succeeded) {
          setError(data.message || 'Failed to load competitor listings');
          setListings([]);
          return;
        }
        setListings(data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load competitor listings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, product]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      // xl, where the Chakra original was lg: this is the only drawer in the
      // app carrying a seven-column table, and lg made every column scroll.
      size="xl"
      title={`Competitor listings${product ? ` — ${product.title}` : ''}`}
    >
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Listings below are in the same category and closely match this product&apos;s title - price isn&apos;t
        used to decide what counts as a match, only shown here for comparison. Daraz listings are other marketplace
        sellers; listings from other platforms are individual retailers stocking a comparable item, not
        competing sellers on the same marketplace.
      </p>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`competitor-loading-${i}`}
              className="h-5 animate-pulse rounded bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      )}

      {!loading && error && <p className="text-sm text-error-600 dark:text-error-500">{error}</p>}

      {!loading && !error && listings.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No comparable listings found for this product yet.
        </p>
      )}

      {!loading && !error && listings.length > 0 && (
        <Table minWidth={780}>
          <THead>
            <TH>Listing</TH>
            <TH>Platform</TH>
            <TH numeric>Price</TH>
            <TH numeric title="Your price against this listing's. Negative means you are cheaper.">
              vs yours
            </TH>
            <TH numeric>Rating</TH>
            {/* Native title attribute rather than a Tooltip component, the
                same way the Competitors page annotates its column headers. */}
            <TH numeric title="Demand proxy (platform-reported), not verified sales">
              Sold
            </TH>
            <TH>Reviews</TH>
          </THead>
          <TBody>
            {listings.map((listing, i) => {
              const title = decodeHtmlEntities(listing.matchedTitle);
              const isExpanded = expandedRows.has(i);
              return (
                <Fragment key={`${listing.matchedUrl}-${i}`}>
                  <TR>
                    <TD strong className="max-w-[240px]">
                      <a
                        href={listing.matchedUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={title}
                        className="flex items-center gap-1.5 hover:text-brand-500 hover:underline"
                      >
                        <span className="line-clamp-2">{title}</span>
                        <MdOutlineOpenInNew
                          className="size-3 shrink-0 text-gray-400"
                          aria-hidden="true"
                        />
                      </a>
                    </TD>
                    <TD>
                      {listing.matchedPlatformName ? (
                        <Pill tone="brand">{listing.matchedPlatformName}</Pill>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD numeric strong>
                      {formatCurrency(listing.matchedPrice, reportingCurrency)}
                    </TD>
                    <TD numeric>
                      {listing.priceDeltaPct == null ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">—</span>
                      ) : (
                        <span
                          className={`text-sm ${
                            Math.abs(listing.priceDeltaPct) < 0.005
                              ? 'text-gray-500 dark:text-gray-400'
                              : listing.priceDeltaPct < 0
                                ? 'text-success-600 dark:text-success-500'
                                : 'text-error-600 dark:text-error-500'
                          }`}
                        >
                          {formatPriceDelta(listing.priceDeltaPct)}
                        </span>
                      )}
                    </TD>
                    <TD numeric>
                      {listing.rating != null ? (
                        <span className="flex items-center justify-end gap-1">
                          <MdOutlineStar className="size-3 text-yellow-400" aria-hidden="true" />
                          {formatRating(listing.rating, listing.ratingCount)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD numeric>
                      {listing.soldCount == null ? '—' : listing.soldCount.toLocaleString()}
                    </TD>
                    <TD>
                      {listing.reviewCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(i)}
                          aria-expanded={isExpanded}
                          className="flex items-center gap-0.5 text-brand-500 transition-colors hover:text-brand-600 dark:text-brand-400"
                        >
                          {listing.reviewCount} review{listing.reviewCount === 1 ? '' : 's'}
                          {isExpanded ? (
                            <MdExpandLess className="size-3.5" aria-hidden="true" />
                          ) : (
                            <MdExpandMore className="size-3.5" aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        '—'
                      )}
                    </TD>
                  </TR>
                  {isExpanded && listing.topReviews.length > 0 && (
                    <TR className="hover:bg-transparent dark:hover:bg-transparent">
                      <TD colSpan={7} className="bg-gray-50 dark:bg-gray-800">
                        <div className="flex flex-col gap-2">
                          {listing.topReviews.map((review, ri) => (
                            <div key={ri}>
                              <div className="mb-0.5 flex items-center gap-1.5">
                                {review.rating != null && (
                                  <span className="flex items-center gap-0.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                                    <MdOutlineStar
                                      className="size-3 text-yellow-400"
                                      aria-hidden="true"
                                    />
                                    {review.rating.toFixed(1)}
                                  </span>
                                )}
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {review.author ?? 'Anonymous'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {decodeHtmlEntities(review.text)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </TD>
                    </TR>
                  )}
                </Fragment>
              );
            })}
          </TBody>
        </Table>
      )}
    </Drawer>
  );
}

export default CompetitorsDrawer;
