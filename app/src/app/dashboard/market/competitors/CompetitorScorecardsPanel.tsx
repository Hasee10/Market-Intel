'use client';

import { Card } from '@/components/ui/Card';
import { Table, THead, TH, TBody, TR, TD, Pill } from '@/components/ui/Table';
import { useMemo, useState } from 'react';
import {
  MdOutlineStorefront,
  MdOutlineListAlt,
  MdOutlineAttachMoney,
  MdOutlineTrendingDown,
  MdOutlineNewReleases,
  MdOutlineCheckCircle,
} from 'react-icons/md';

import { objectsToCsv, triggerCsvDownload } from '@/lib/csv';
import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import type {
  CompetitorLandscape,
  CompetitorScorecard,
  CompetitorMatchStats,
  CompetitorOverlap,
} from '@/lib/market-intel/market/competitors';

export type CompetitorScorecardsPanelProps = {
  /** What to call the scope in the empty-state copy, e.g. "Mobiles & Electronics" or "your tracked categories". */
  scopeLabel: string;
  reportingCurrency: string;
  landscape: CompetitorLandscape | null;
  overlap: CompetitorOverlap[];
  matchCounts: CompetitorMatchStats[];
  /**
   * Which scope the matched-listings export covers. Sent to
   * /api/competitors/matched-listings, which builds the CSV on demand - the
   * rows are no longer shipped with the page just in case someone clicks.
   */
  exportScope: 'primary' | 'all';
  /**
   * Which single domain the export covers, when exportScope is 'primary'.
   * Null means "whatever the seller's primary domain is", the behaviour
   * before the header switcher existed. Ignored for exportScope 'all'.
   */
  exportDomainSlug?: string | null;
  /**
   * Matched listings are always the current seller's own primary/all-domain
   * matches (see /api/competitors/matched-listings) - meaningless on a page
   * browsing a category with no seller context, like Explore. Defaults to
   * true so the two existing Competitors tabs render unchanged.
   */
  showMatchedListingsExport?: boolean;
};

function formatCurrencyAs(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null, digits = 0) {
  if (value == null) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSignedPercent(value: number | null) {
  if (value == null) return '—';
  const pct = value * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function monthsSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / (1000 * 60 * 60 * 24 * 30);
}

// The three things a scorecard is for, phrased as the seller would ask them.
// Kept as literal strings on the column headers rather than in a legend at the
// bottom, because a metric whose meaning lives elsewhere gets misread.
const COLUMN_HELP = {
  assortment: 'Share of every identified listing in your market that belongs to this seller.',
  priceIndex: 'Their median price against your market median. Negative means they undercut it.',
  repricing:
    'Share of price observations that moved in the window. We observe every two days, so a price that moves and moves back is invisible — this is a floor, not a count.',
  stock: 'Share of their listings currently in stock. Blank where the source does not report stock.',
  sold: 'Platform-reported units sold, rounded by the platform itself. A demand proxy, not sales data.',
  overlap:
    'Your SKUs with a plausible title match in their assortment, and how many of those you price below them on. Matched by title similarity, so treat it as directional.',
  trackedMatches:
    'Your own products where you opened the Competitors drawer and it saved a match against this seller. Builds up from your activity, not a fresh scan — a low or zero count usually means you have not reviewed those products yet.',
};

const dateStamp = () => new Date().toISOString().slice(0, 10);

// Same instant-insight pattern as Overview/Market/Watchlist (InsightStrip.tsx)
// - one plain-English headline about this tab's own competitor landscape,
// picked from the same figures the table below already computes (never a
// separate calculation, so the headline can't disagree with the row it's
// summarising). Priority: the steepest undercutter (>=5% below market -
// direct price pressure, the thing a seller most needs to know first) >
// a competitor new to this market in the last 2 months (same "new to this
// market" signal already shown as a table badge) > the dominant seller by
// assortment (>=30% of named supply - a market with one dominant player
// reads very differently from one that's evenly split) > a calm fallback
// that still states the real tracked count.
function computeCompetitorInsight(landscape: CompetitorLandscape, scopeLabel: string): Insight {
  const scorecards = landscape.scorecards;

  const undercutters = scorecards.filter(
    (c): c is CompetitorScorecard & { priceIndex: number } => c.priceIndex != null && c.priceIndex <= -0.05,
  );
  if (undercutters.length > 0) {
    const worst = undercutters.reduce((a, b) => (b.priceIndex < a.priceIndex ? b : a));
    return {
      tone: 'warning',
      icon: MdOutlineTrendingDown,
      headline: `${worst.name} prices ${formatSignedPercent(worst.priceIndex)} vs your market`,
      detail: 'Your steepest undercutter by price index right now.',
    };
  }

  const newEntrant = scorecards.find((c) => {
    const tenure = monthsSince(c.firstSeenAt);
    return tenure != null && tenure < 2;
  });
  if (newEntrant) {
    return {
      tone: 'neutral',
      icon: MdOutlineNewReleases,
      headline: `${newEntrant.name} entered your market recently`,
      detail: 'New in this market within the last 2 months - worth a look.',
    };
  }

  const dominant = scorecards.reduce((a, b) => (b.assortmentShare > a.assortmentShare ? b : a));
  if (dominant.assortmentShare >= 0.3) {
    return {
      tone: 'neutral',
      icon: MdOutlineStorefront,
      headline: `${dominant.name} carries ${formatPercent(dominant.assortmentShare, 0)} of named supply`,
      detail: 'Your biggest competitor by assortment in this market.',
    };
  }

  return {
    tone: 'good',
    icon: MdOutlineCheckCircle,
    headline: `Tracking ${scorecards.length} named competitor${scorecards.length === 1 ? '' : 's'} in ${scopeLabel}`,
    detail: 'No single seller dominates this market right now.',
  };
}

export default function CompetitorScorecardsPanel({
  scopeLabel,
  reportingCurrency,
  landscape,
  overlap,
  matchCounts,
  exportScope,
  exportDomainSlug = null,
  showMatchedListingsExport = true,
}: CompetitorScorecardsPanelProps) {
  const [exportingListings, setExportingListings] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const formatCurrency = (value: number | null) =>
    value == null ? '—' : formatCurrencyAs(value, reportingCurrency);

  const overlapByCompetitor = useMemo(() => new Map(overlap.map((row) => [row.externalId, row])), [overlap]);

  const matchCountsByCompetitor = useMemo(
    () => new Map(matchCounts.map((row) => [row.externalId, row])),
    [matchCounts],
  );

  const scorecards = useMemo(() => landscape?.scorecards ?? [], [landscape]);

  const scorecardsPage = usePagination(scorecards, 10);

  // Assortment concentration: top 5 by share plus one "Others" bucket, so the
  // bar list stays readable regardless of whether a market has 6 named
  // competitors or the full MAX_COMPETITORS=25. Reuses assortmentShare, which
  // the table already renders per-row - never a second calculation that could
  // disagree with it.
  const concentration = useMemo(() => {
    const sorted = [...scorecards].sort((a, b) => b.assortmentShare - a.assortmentShare);
    const top = sorted.slice(0, 5).map((c) => ({ name: c.name, share: c.assortmentShare }));
    const othersShare = sorted.slice(5).reduce((sum, c) => sum + c.assortmentShare, 0);
    return othersShare > 0.001 ? [...top, { name: 'Others', share: othersShare }] : top;
  }, [scorecards]);

  // Some Daraz sellers put a city in parentheses at the end of their display
  // name ("Y.M Traders (Karachi)") - a self-reported convention, not a
  // structured field (market_products carries no city column at all, see
  // migration 040's header). Parsed defensively and always shown next to a
  // coverage count, so this reads as "what a few sellers told us" rather than
  // a claim about where every competitor actually operates.
  const cityBreakdown = useMemo(() => {
    const CITY_SUFFIX = /\(([^()]+)\)\s*$/;
    const counts = new Map<string, number>();
    let withCity = 0;
    for (const c of scorecards) {
      const match = c.name.match(CITY_SUFFIX);
      if (!match) continue;
      withCity += 1;
      const city = match[1].trim();
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    const cities = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([city, count]) => ({ city, count }));
    return { cities, withCity, total: scorecards.length };
  }, [scorecards]);

  const exportScorecardsCsv = () => {
    const csv = objectsToCsv(
      scorecards.map((c) => ({
        name: c.name,
        platform: c.platformName,
        skuCount: c.skuCount,
        assortmentShare: formatPercent(c.assortmentShare, 1),
        medianPrice: c.medianPrice ?? '',
        priceIndex: formatSignedPercent(c.priceIndex),
        inStockRate: formatPercent(c.inStockRate),
        soldUnits: c.soldUnits,
      })),
      [
        { key: 'name', label: 'Competitor' },
        { key: 'platform', label: 'Platform' },
        { key: 'skuCount', label: 'SKU count' },
        { key: 'assortmentShare', label: 'Assortment share' },
        { key: 'medianPrice', label: `Median price (${reportingCurrency})` },
        { key: 'priceIndex', label: 'vs market' },
        { key: 'inStockRate', label: 'In stock' },
        { key: 'soldUnits', label: 'Units sold*' },
      ],
    );
    triggerCsvDownload(csv, `${exportScope === 'all' ? 'all-products' : 'primary-domain'}-competitor-scorecards-${dateStamp()}.csv`);
  };

  // Fetches the CSV instead of formatting an array the page already
  // carried: the rows now cross the wire only when this is clicked. 204
  // means the query found nothing, which is a message rather than a file.
  const exportMatchedListingsCsv = async () => {
    setExportingListings(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ scope: exportScope });
      if (exportScope === 'primary' && exportDomainSlug) params.set('domain', exportDomainSlug);
      const response = await fetch(`/api/competitors/matched-listings?${params.toString()}`);

      if (response.status === 204) {
        setExportError('No matched listings to export yet.');
        return;
      }
      if (!response.ok) {
        setExportError('Could not build the export. Please try again.');
        return;
      }

      const csv = await response.text();
      triggerCsvDownload(
        csv,
        `${exportScope === 'all' ? 'all-products' : 'primary-domain'}-matched-listings-${dateStamp()}.csv`,
      );
    } catch {
      setExportError('Could not build the export. Please try again.');
    } finally {
      setExportingListings(false);
    }
  };

  if (scorecards.length === 0) {
    return (
      <Card>
        <p className="mb-1.5 font-bold text-gray-900 dark:text-white">
          No named competitors in {scopeLabel} yet
        </p>
        <p className="mb-2.5 text-sm text-gray-500 dark:text-gray-400">
          A scorecard needs an identifiable competitor: either a named seller on a marketplace like
          Daraz, or a single-retailer platform — where the retailer <em>is</em> the seller, so the
          platform&apos;s own name identifies them completely. Both count here; this page is empty
          because there are no active, in-scope listings from either kind yet.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {landscape && landscape.anonymousSkuCount > 0
            ? `${landscape.anonymousSkuCount.toLocaleString()} listings in your market carry no attributed seller on a marketplace that otherwise names one — a genuine data gap, not a single-retailer source. Those listings still feed every other figure on the Market page.`
            : 'Once a tracked source returns listings inside your market definition, the competitors behind them appear here.'}
        </p>
      </Card>
    );
  }

  const summaryTiles = [
    {
      icon: MdOutlineStorefront,
      chip: 'bg-brand-50 text-brand-600 dark:bg-gray-800 dark:text-brand-400',
      label: 'Named competitors',
      value: String(scorecards.length),
      caption: `across ${landscape?.platformsWithIdentity.join(', ') || '—'}`,
    },
    {
      icon: MdOutlineListAlt,
      chip: 'bg-success-50 text-success-700 dark:bg-gray-800 dark:text-success-500',
      label: 'Listings with a named seller',
      value: (landscape?.identifiedSkuCount ?? 0).toLocaleString(),
      caption: `${(landscape?.anonymousSkuCount ?? 0).toLocaleString()} more have no seller to attribute`,
    },
    {
      icon: MdOutlineAttachMoney,
      chip: 'bg-brand-50 text-brand-700 dark:bg-gray-800 dark:text-brand-400',
      label: 'Your market median',
      value: formatCurrency(landscape?.marketMedianPrice ?? null),
      caption: 'every price index below is measured against this',
    },
  ];

  return (
    <>
      <InsightStrip insight={computeCompetitorInsight(landscape!, scopeLabel)} />

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {summaryTiles.map((tile, i) => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.label}
                className={
                  i > 0 ? 'border-gray-100 pt-4 sm:border-t-0 sm:pt-0 sm:pl-5 sm:border-l dark:border-gray-800' : ''
                }
              >
                <div className="mb-1 flex items-center gap-2.5">
                  <span
                    className={`flex size-8 items-center justify-center rounded-[10px] ${tile.chip}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{tile.label}</span>
                </div>
                <p className="text-[28px] font-bold text-gray-900 tabular-nums dark:text-white">
                  {tile.value}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tile.caption}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Card
          className="lg:col-span-2"
          title="Assortment concentration"
          action={
            <span className="text-xs text-gray-500 dark:text-gray-400">
              share of named supply
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            {concentration.map((row) => (
              <div key={row.name}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-sm ${row.name === 'Others' ? 'text-gray-500 italic dark:text-gray-400' : 'font-medium text-gray-900 dark:text-white'}`}
                  >
                    {row.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {formatPercent(row.share, 1)}
                  </span>
                </div>
                <span className="block h-2 w-full overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                  <span
                    className={`block h-full rounded ${row.name === 'Others' ? 'bg-gray-300 dark:bg-gray-600' : 'bg-brand-500'}`}
                    style={{ width: `${Math.min(100, row.share * 100)}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Seller locations">
          {cityBreakdown.withCity === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              None of your {cityBreakdown.total} named competitors state a city in their seller
              name. We have no structured location field to fall back on for this market.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Self-reported by the seller in their Daraz display name — {cityBreakdown.withCity} of{' '}
                {cityBreakdown.total} named competitors state one. Not a structured field, and not
                every seller who operates from a city says so.
              </p>
              <div className="flex flex-col gap-2">
                {cityBreakdown.cities.map(({ city, count }) => (
                  <div key={city} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-gray-700 dark:text-gray-300">{city}</span>
                    <Pill tone="brand">
                      {count} {count === 1 ? 'seller' : 'sellers'}
                    </Pill>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <p className="font-bold text-gray-900 dark:text-white">Scorecards</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ranked by assortment size inside your market definition, not overall — a seller with
              40,000 listings elsewhere counts here only for what they list against you. Repricing is
              measured over the last {landscape?.lookbackDays ?? 30} days.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={exportScorecardsCsv}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
            >
              Export scorecards CSV
            </button>
            {showMatchedListingsExport && (
              <button
                type="button"
                onClick={exportMatchedListingsCsv}
                disabled={exportingListings}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                {exportingListings ? 'Building CSV…' : 'Export matched listings CSV'}
              </button>
            )}
          </div>
        </div>
        {exportError && (
          <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{exportError}</p>
        )}
        <Table minWidth={1040}>
          <THead>
              <TH>Competitor</TH>
              <TH numeric title={COLUMN_HELP.assortment}>Assortment</TH>
              <TH numeric>Median price</TH>
              <TH numeric title={COLUMN_HELP.priceIndex}>vs market</TH>
              <TH numeric title={COLUMN_HELP.repricing}>Repricing</TH>
              <TH numeric title={COLUMN_HELP.stock}>In stock</TH>
              <TH numeric title={COLUMN_HELP.sold}>Units sold*</TH>
              <TH numeric title={COLUMN_HELP.overlap}>Overlap / you cheaper</TH>
              <TH numeric title={COLUMN_HELP.trackedMatches}>Your tracked matches</TH>
            </THead>
          <TBody>
            {scorecardsPage.visible.map((competitor) => {
              const head2head = overlapByCompetitor.get(competitor.externalId);
              const trackedMatches = matchCountsByCompetitor.get(competitor.externalId);
              const tenure = monthsSince(competitor.firstSeenAt);
              return (
                <TR key={competitor.externalId}>
                  <TD strong>
                    {competitor.name}
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Pill tone="brand">{competitor.platformName}</Pill>
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                        {competitor.brandCount} {competitor.brandCount === 1 ? 'brand' : 'brands'}
                        {tenure != null && tenure < 2 ? ' · new to this market' : ''}
                      </span>
                    </span>
                  </TD>
                  <TD numeric>
                    <span className="block text-sm text-gray-900 dark:text-white">
                      {competitor.skuCount.toLocaleString()}
                    </span>
                    {/* Assortment share as a bar as well as a number - the
                        relative size is the point, and 12 rows of bare
                        percentages don't compare at a glance. */}
                    <span className="mt-1 block h-1 w-full overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                      <span
                        className="block h-full rounded bg-brand-500"
                        style={{ width: `${Math.min(100, competitor.assortmentShare * 100)}%` }}
                      />
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {formatPercent(competitor.assortmentShare, 1)} of named supply
                    </span>
                  </TD>
                  <TD numeric>{formatCurrency(competitor.medianPrice)}</TD>
                  <TD numeric>
                    <span
                      className={`text-sm ${
                        competitor.priceIndex == null
                          ? 'text-gray-500 dark:text-gray-400'
                          : competitor.priceIndex < 0
                            ? 'text-error-600 dark:text-error-500'
                            : 'text-success-600 dark:text-success-500'
                      }`}
                    >
                      {formatSignedPercent(competitor.priceIndex)}
                    </span>
                  </TD>
                  <TD numeric>
                    {competitor.priceChangeRate == null ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        not yet observed
                      </span>
                    ) : (
                      <>
                        <span className="block text-sm text-gray-900 dark:text-white">
                          {formatPercent(competitor.priceChangeRate, 1)}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {competitor.observedSkuCount} SKUs tracked
                        </span>
                      </>
                    )}
                  </TD>
                  <TD numeric>{formatPercent(competitor.inStockRate)}</TD>
                  <TD numeric>
                    {competitor.soldUnits > 0 ? competitor.soldUnits.toLocaleString() : '—'}
                  </TD>
                  <TD numeric>
                    {!head2head || head2head.overlapCount === 0 ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">no match found</span>
                    ) : (
                      <>
                        <span className="block text-sm text-gray-900 dark:text-white">
                          {head2head.winCount}/{head2head.overlapCount}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          you are {formatSignedPercent(head2head.priceGap)} on median
                        </span>
                      </>
                    )}
                  </TD>
                  <TD numeric>
                    {!trackedMatches || trackedMatches.matchedProductCount === 0 ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">not yet tracked</span>
                    ) : (
                      <Pill tone="success">
                        {trackedMatches.matchedProductCount}{' '}
                        {trackedMatches.matchedProductCount === 1 ? 'product' : 'products'}
                      </Pill>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <Pagination
          page={scorecardsPage.page}
          pageCount={scorecardsPage.pageCount}
          onPageChange={scorecardsPage.setPage}
          rangeStart={scorecardsPage.rangeStart}
          rangeEnd={scorecardsPage.rangeEnd}
          total={scorecardsPage.total}
          label="competitors"
        />
      </Card>

      <Card>
        <details className="group">
          <summary className="cursor-pointer text-[15px] font-semibold text-gray-900 marker:content-none dark:text-white">
            <span className="inline-flex items-center gap-1.5">
              How to read this
              <span className="text-xs text-gray-400 transition-transform group-open:rotate-90">▸</span>
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <p>
              *Units sold is reported by the platform and rounded by it (&quot;1.2K sold&quot;). It is
              the only demand-side signal any source we track exposes, and it is a proxy — never treat
              it as your competitor&apos;s revenue.
            </p>
            <p>
              Overlap and the cheaper-than count are computed by comparing product titles, over your 60
              most recently updated active products. They point you at the right competitor to look at;
              they are not a reconciled catalog match.
            </p>
            <p>
              &quot;Your tracked matches&quot; is different from overlap above: it only counts products
              where you actually opened the Competitors drawer and a match was saved, so it accumulates
              over time rather than recalculating on every visit. Treat a zero here as &quot;not
              reviewed yet,&quot; not &quot;no match exists.&quot;
            </p>
            <p>
              Every figure is confined to your market definition. Change the segments, price band or
              platforms and this list changes with it.
            </p>
          </div>
        </details>
      </Card>
    </>
  );
}
