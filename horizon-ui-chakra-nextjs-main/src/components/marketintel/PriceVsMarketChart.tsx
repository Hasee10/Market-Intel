'use client';

import { useEffect, useState } from 'react';

import LineChart from '@/components/charts/LineChart';
import {
  summarisePriceVsMarket,
  type AlignedPricePoint,
} from '@/lib/market-intel/core/price-trend-alignment';
import type { IApiResponse } from '@/types/api-response';

// "Am I drifting out of the market, or is the market moving under me?" - the
// question a snapshot price panel cannot answer, because it only ever shows
// one instant. This is the seller's own price, forward-filled, over the
// market's daily P25-P75 band for the same 30 days.
//
// Same lesson as the price-position panel: the sentence comes before the
// picture. Thirty points and a shaded band still ask a reader to notice
// "spent more days above the band than in it" for themselves - counted and
// stated up front, the chart becomes the evidence for a claim already made
// rather than the only place the claim exists.

function formatMoney(v: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

export function PriceVsMarketChart({
  sellerProductId,
  currency,
  className = '',
}: {
  sellerProductId: string;
  currency: string;
  className?: string;
}) {
  const [points, setPoints] = useState<AlignedPricePoint[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    setError(false);

    fetch(`/api/products/${sellerProductId}/price-vs-market`)
      .then((res) => res.json())
      .then((data: IApiResponse<AlignedPricePoint[]>) => {
        if (cancelled) return;
        if (!data.succeeded) {
          setError(true);
          return;
        }
        setPoints(data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [sellerProductId]);

  if (error) return null;

  if (points == null) {
    return (
      <div className={className}>
        <div className="h-5 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="mt-3 h-[220px] animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  // No market coverage for this category at all - render nothing.
  if (points.length === 0) return null;

  const summary = summarisePriceVsMarket(points);

  // Not enough overlapping days between the seller's own price history and
  // a market band to say anything real yet - render nothing rather than a
  // box explaining that. This is a genuinely common state early on (the
  // market side needs several days of scrape history to clear
  // MIN_SAMPLE_FOR_BAND, migration 054), and a placeholder repeated on
  // every product a seller opens is a wall of identical text, not
  // information. Once real days accumulate this section starts rendering
  // on its own - nothing else has to change for that to happen.
  if (summary.daysWithBand === 0) return null;

  const bandData: ([number, number] | null)[] = points.map((p) =>
    p.marketP25 != null && p.marketP75 != null ? [p.marketP25, p.marketP75] : null,
  );
  const medianData = points.map((p) => p.marketMedian);
  const sellerData = points.map((p) => p.sellerPrice);
  const categories = points.map((p) => p.date.slice(5));

  // Reaching here guarantees at least one comparable day, so
  // currentPosition is never null - the early return above is what makes
  // this safe to read unconditionally.
  const currentPositionText =
    summary.currentPosition === 'above' ? 'above it' : summary.currentPosition === 'below' ? 'below it' : 'inside it';

  return (
    <div className={className}>
      <p className="mb-1.5 text-[15px] leading-snug text-gray-900 dark:text-white">
        Over the last {summary.daysWithBand} comparable day{summary.daysWithBand === 1 ? '' : 's'},
        you spent{' '}
        {summary.daysAbove > 0 && (
          <span className="font-semibold text-error-700 dark:text-error-500">
            {summary.daysAbove} above
          </span>
        )}
        {summary.daysAbove > 0 && (summary.daysBelow > 0 || summary.daysInside > 0) && ', '}
        {summary.daysBelow > 0 && (
          <span className="font-semibold text-success-700 dark:text-success-500">
            {summary.daysBelow} below
          </span>
        )}
        {summary.daysBelow > 0 && summary.daysInside > 0 && ', and '}
        {summary.daysInside > 0 && (
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {summary.daysInside} inside
          </span>
        )}{' '}
        the market band. You are currently <span className="font-semibold">{currentPositionText}</span>.
      </p>

      <div className="h-[220px]">
        <LineChart
          chartData={[
            { name: 'Market range', type: 'rangeArea', data: bandData },
            { name: 'Market median', type: 'line', data: medianData },
            { name: 'Your price', type: 'line', data: sellerData },
          ]}
          chartOptions={{
            chart: { toolbar: { show: false }, animations: { enabled: false } },
            xaxis: {
              categories,
              labels: { style: { colors: '#98A2B3', fontSize: '10px' }, rotate: 0 },
              tickAmount: 6,
            },
            yaxis: {
              labels: {
                style: { colors: '#98A2B3', fontSize: '10px' },
                formatter: (value: number) =>
                  new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency,
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(value),
              },
            },
            dataLabels: { enabled: false },
            markers: { size: 0 },
            stroke: { curve: 'smooth', width: [0, 2, 2.5], dashArray: [0, 4, 0] },
            fill: { opacity: [0.16, 1, 1] },
            // Neutral gray for the band, brand indigo for the market
            // median, near-black for the seller's own line - the seller's
            // price is the one thing on this chart that should never be
            // mistaken for a market figure.
            colors: ['#98A2B3', '#4B3AF0', '#111827'],
            legend: {
              show: true,
              fontSize: '11px',
              labels: { colors: '#6B7280' },
              markers: { size: 5 },
            },
            tooltip: {
              shared: true,
              custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
                const point = points[dataPointIndex];
                if (!point) return '';
                const band =
                  point.marketP25 != null && point.marketP75 != null
                    ? `${formatMoney(point.marketP25, currency)} – ${formatMoney(point.marketP75, currency)}`
                    : 'not enough listings that day';
                const seller =
                  point.sellerPrice != null ? formatMoney(point.sellerPrice, currency) : 'not yet listed';
                return `<div class="rounded-xl border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-700 dark:bg-gray-900" style="font-family:inherit;">
                  <div class="mb-1 text-[11px] text-gray-400 dark:text-gray-500">${point.date}</div>
                  <div class="text-xs text-gray-700 dark:text-gray-200">Your price: <span class="font-semibold">${seller}</span></div>
                  <div class="text-xs text-gray-700 dark:text-gray-200">Median: <span class="font-semibold">${formatMoney(point.marketMedian, currency)}</span></div>
                  <div class="text-[11px] text-gray-400 dark:text-gray-500">Band: ${band}</div>
                </div>`;
              },
            },
          }}
        />
      </div>
    </div>
  );
}

export default PriceVsMarketChart;
