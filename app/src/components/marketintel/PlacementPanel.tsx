'use client';

import { useEffect, useMemo, useState } from 'react';

import { MdOutlineOpenInNew } from 'react-icons/md';

import LineChart from '@/components/charts/LineChart';
import { MetricHelp } from '@/components/ui/MetricHelp';
import { Table, THead, TH, TBody, TR, TD, Pill } from '@/components/ui/Table';
import type { ProductPlacement, PlatformPlacement } from '@/lib/market-intel/market/placement';
import type { IApiResponse } from '@/types/api-response';

// "Same product on multiple websites → which is the best traffic gateway",
// and "historical chart → our product placement", from the product notes.
// Sits in CompetitorsDrawer under the price-vs-market chart and follows that
// component's shape: self-fetching, because the drawer opens on demand.
//
// The score is a demand proxy and the panel says so in its first line -
// see placement.ts for why price is beside the score and not inside it.

type Props = { sellerProductId: string; currency: string; className?: string };

const SIGNAL_LABEL: Record<keyof PlatformPlacement['components'], string> = {
  sales: 'Sold',
  reviews: 'Reviews',
  rating: 'Rating',
  availability: 'In stock (30d)',
};

const SERIES_COLORS = ['#4B3AF0', '#0E9F6E', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];

function money(v: number | null, currency: string) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
}

function breakdown(p: PlatformPlacement) {
  return (Object.keys(p.components) as (keyof PlatformPlacement['components'])[])
    .map((k) => {
      const v = p.components[k];
      return `${SIGNAL_LABEL[k]}: ${v == null ? 'not reported anywhere' : `${v} pts`}`;
    })
    .join(' · ');
}

export function PlacementPanel({ sellerProductId, currency, className = '' }: Props) {
  const [data, setData] = useState<ProductPlacement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/products/${sellerProductId}/placement`)
      .then((res) => res.json())
      .then((body: IApiResponse<ProductPlacement>) => {
        if (cancelled) return;
        if (!body.succeeded || !body.data) {
          setError(body.message || 'Failed to load placement');
          return;
        }
        setData(body.data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load placement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sellerProductId]);

  // One line per platform. Dates are the union across platforms, sorted;
  // a platform with no observation on a date gets null, which Apex draws
  // as a gap rather than a false drop to zero.
  const chart = useMemo(() => {
    if (!data || data.platforms.length === 0) return null;
    const dates = Array.from(new Set(data.platforms.flatMap((p) => p.history.map((h) => h.date)))).sort();
    if (dates.length < 2) return null;
    const series = data.platforms.map((p) => {
      const byDate = new Map(p.history.map((h) => [h.date, h]));
      return {
        name: p.platformName,
        type: 'line' as const,
        data: dates.map((d) => byDate.get(d)?.price ?? null),
      };
    });
    const stockByDate = data.platforms.map((p) => new Map(p.history.map((h) => [h.date, h.inStock])));
    const rankByDate = data.platforms.map((p) => new Map(p.history.map((h) => [h.date, h.rank])));
    // Rank only from the first ranked observation onward, so the chart
    // starts where capture started instead of drawing a flat null run.
    const rankDates = dates.filter((d) => rankByDate.some((m) => m.get(d) != null));
    const rankSeries = data.platforms.map((p, i) => ({
      name: p.platformName,
      type: 'line' as const,
      data: rankDates.map((d) => rankByDate[i].get(d) ?? null),
    }));
    return { dates, series, stockByDate, rankByDate, rankDates, rankSeries };
  }, [data]);

  if (loading) {
    return <div className={`h-[140px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 ${className}`} />;
  }
  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-error-600 dark:text-error-500">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const { platforms, bestPlatform, caveats } = data;

  return (
    <div className={className}>
      <div className="mb-1 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Where this product is listed</h3>
        <MetricHelp label="How the demand score is calculated">
          {`Each platform is scored 0-100 from the signals it reports for this product: sold count (40), review count (30), rating (15) and how often the listing was in stock over the last 30 days (15). A signal no platform reports is left out and the rest are rescaled. Price is shown but not scored.`}
        </MetricHelp>
      </div>

      {platforms.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No matched listings on other platforms yet. Matches are found by title similarity on each scrape; a product
          with a very generic or very unusual title may not match anything.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
            Strongest demand on <span className="font-semibold text-gray-900 dark:text-white">{bestPlatform}</span>
            {platforms.length > 1 ? ` of ${platforms.length} platforms.` : '.'}{' '}
            <span className="text-gray-500 dark:text-gray-400">
              Your price: {money(data.sellerPrice, currency)}.
            </span>
          </p>

          <Table minWidth={720}>
            <THead>
              <TH>Platform</TH>
              <TH numeric title="Demand proxy, 0-100. Hover a score for the breakdown.">Demand</TH>
              <TH numeric>Price</TH>
              <TH>Stock</TH>
              <TH numeric>Rating</TH>
              <TH numeric>Reviews</TH>
              <TH numeric title="Platform-reported, not verified sales">Sold</TH>
              <TH numeric title="Share of scrapes in the last 30 days where the listing was in stock">In stock 30d</TH>
              <TH> </TH>
            </THead>
            <TBody>
              {platforms.map((p, i) => (
                <TR key={p.marketProductId}>
                  <TD>
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                      <span className="font-medium text-gray-900 dark:text-white">{p.platformName}</span>
                      {p.otherListingsOnPlatform > 0 && (
                        <span className="text-xs text-gray-400" title="Other matched listings on this platform, collapsed into this row">
                          +{p.otherListingsOnPlatform}
                        </span>
                      )}
                    </span>
                  </TD>
                  <TD numeric>
                    <span title={breakdown(p)}>
                      <Pill tone={i === 0 ? 'success' : 'neutral'}>{p.score}</Pill>
                    </span>
                  </TD>
                  <TD numeric>{money(p.price, currency)}</TD>
                  <TD>
                    <Pill tone={p.inStock ? 'success' : 'error'}>{p.inStock ? 'In stock' : 'Out'}</Pill>
                  </TD>
                  <TD numeric>{p.rating != null ? p.rating.toFixed(1) : '—'}</TD>
                  <TD numeric>{p.ratingCount ?? '—'}</TD>
                  <TD numeric>{p.soldCount ?? '—'}</TD>
                  <TD numeric>{p.availability != null ? `${Math.round(p.availability * 100)}%` : '—'}</TD>
                  <TD>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open listing on ${p.platformName}`}
                      className="text-gray-400 hover:text-brand-600"
                    >
                      <MdOutlineOpenInNew className="size-4" />
                    </a>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {chart && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Price over the last {data.historyDays} days · gaps are days the listing wasn&apos;t seen
              </p>
              <div className="h-[200px]">
                <LineChart
                  chartData={chart.series}
                  chartOptions={{
                    chart: { toolbar: { show: false }, animations: { enabled: false } },
                    xaxis: {
                      categories: chart.dates,
                      labels: { style: { colors: '#98A2B3', fontSize: '10px' }, rotate: 0 },
                      tickAmount: 6,
                    },
                    yaxis: {
                      labels: {
                        style: { colors: '#98A2B3', fontSize: '10px' },
                        formatter: (v: number) =>
                          new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(v),
                      },
                    },
                    dataLabels: { enabled: false },
                    markers: { size: 0 },
                    stroke: { curve: 'straight', width: 2 },
                    colors: SERIES_COLORS,
                    legend: { show: true, fontSize: '11px', labels: { colors: '#6B7280' }, markers: { size: 5 } },
                    tooltip: {
                      shared: true,
                      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
                        const date = chart.dates[dataPointIndex];
                        const rows = chart.series
                          .map((s, i) => {
                            const price = s.data[dataPointIndex];
                            if (price == null) return '';
                            const inStock = chart.stockByDate[i].get(date);
                            const rank = chart.rankByDate[i].get(date);
                            return `<div class="text-xs text-gray-700 dark:text-gray-200">${s.name}: <span class="font-semibold">${money(price, currency)}</span>${rank != null ? ` <span class="text-gray-400">#${rank} on page</span>` : ''}${inStock === false ? ' <span class="text-error-500">out of stock</span>' : ''}</div>`;
                          })
                          .join('');
                        return `<div class="rounded-xl border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-700 dark:bg-gray-900" style="font-family:inherit;"><div class="mb-1 text-[11px] text-gray-400 dark:text-gray-500">${date}</div>${rows}</div>`;
                      },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {chart && data.rankedPoints > 0 && chart.rankDates.length >= 2 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Position on the category page · lower is better · recorded from 2026-09-18
              </p>
              <div className="h-[160px]">
                <LineChart
                  chartData={chart.rankSeries}
                  chartOptions={{
                    chart: { toolbar: { show: false }, animations: { enabled: false } },
                    xaxis: {
                      categories: chart.rankDates,
                      labels: { style: { colors: '#98A2B3', fontSize: '10px' }, rotate: 0 },
                      tickAmount: 6,
                    },
                    // Reversed so #1 sits at the top: a line climbing means
                    // the listing is climbing the page.
                    yaxis: {
                      reversed: true,
                      min: 1,
                      forceNiceScale: true,
                      labels: { style: { colors: '#98A2B3', fontSize: '10px' }, formatter: (v: number) => `#${Math.round(v)}` },
                    },
                    dataLabels: { enabled: false },
                    markers: { size: 3 },
                    stroke: { curve: 'stepline', width: 2 },
                    colors: SERIES_COLORS,
                    legend: { show: true, fontSize: '11px', labels: { colors: '#6B7280' }, markers: { size: 5 } },
                    tooltip: {
                      shared: true,
                      y: { formatter: (v: number) => (v == null ? '—' : `#${v} on page`) },
                    },
                  }}
                />
              </div>
            </div>
          )}

          <ul className="mt-3 space-y-0.5 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
            {caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default PlacementPanel;
