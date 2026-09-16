import { NextRequest } from 'next/server';

import { LOW_STOCK_THRESHOLD } from '@/lib/market-intel/jobs/low-stock-job';
import {
  getMarketScope,
  getMarketScopeCoverage,
} from '@/lib/market-intel/market/market-definition';
import { getDataFreshness, getStockOuts } from '@/lib/market-intel/market/market-insights';
import { getDomainBenchmarks, getDomainPeers } from '@/lib/market-intel/seller/benchmarks';
import { resolveSelectedDomain, type SellerDomain } from '@/lib/market-intel/seller/seller';
import { listNotifications } from '@/lib/notifications/list';
import { createBearerClient, getBearerToken } from '@/lib/supabase/server';
import { mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// The mobile home screen, in one request.
//
// Everything here is already computed somewhere on the desktop; this is a
// composition, not new analysis. The reason it is one endpoint rather than
// five is the network it runs on: a seller on a Pakistani mobile connection
// pays a real latency cost per round trip, and a home screen that fans out
// to five requests shows five separate spinners.
//
// Deliberately no scraping is triggered from here. The scraper is a
// desktop-side cron concern and stays that way - this reads what the last
// run already wrote, so opening the app can never queue work.

export async function GET(request: NextRequest) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  // Honours ?categorySlug so the home screen follows the top-bar switcher,
  // like every other market-scoped screen. It used to hard-code the primary
  // domain, so switching category changed the Market and Competitors tabs
  // but left the dashboard behind - which reads as stale data rather than as
  // an unsupported param. resolveSelectedDomain is the shared helper the
  // domain-scoped desktop pages use, so a missing, stale or not-mine slug
  // falls back to the primary exactly as it did before - the no-param
  // default is unchanged. Not requireMobileCategory: the home screen must
  // still render with no category at all (domain: null), a 400 would break
  // the one screen a brand-new seller sees first.
  const domain = await resolveSelectedDomain(
    seller.id,
    request.nextUrl.searchParams.get('categorySlug'),
  );

  // Runs concurrently: none of these depend on each other, and serialising
  // them would make the home screen's latency their sum.
  const [notifications, stockOuts, freshness, lowStockCount, domainStats] = await Promise.all([
    listNotifications(seller.id, 10),
    domain ? getStockOuts(domain.categorySlug, 5, seller.reportingCurrency) : [],
    domain ? getDataFreshness(domain.categorySlug) : [],
    countLowStock(request, seller.id),
    buildDomainStats(request, seller.id, domain),
  ]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // The freshest scrape across the seller's platforms, so the app can say
  // how current the market figures are. A phone user has less context than
  // someone sitting on the dashboard, so stating the data's age matters
  // more here, not less.
  const lastScrapedAt = freshness.reduce<string | null>((latest, f) => {
    if (!latest) return f.lastScrapedAt;
    return f.lastScrapedAt > latest ? f.lastScrapedAt : latest;
  }, null);

  return mobileOk({
    seller: {
      businessName: seller.businessName,
      planTier: seller.planTier,
      currency: seller.reportingCurrency,
    },
    domain: domain ? { categorySlug: domain.categorySlug, categoryName: domain.categoryName } : null,
    // One counter per thing worth a badge. Kept flat rather than nested so
    // the client can bind straight to it.
    counts: {
      unreadAlerts: unreadCount,
      competitorStockOuts: stockOuts.length,
      lowStockProducts: lowStockCount,
    },
    // The three or four headlines the home screen actually renders. Each
    // carries the tone the desktop InsightStrip would give it, so the app
    // can colour them without re-deriving the rule.
    highlights: buildHighlights({
      unreadCount,
      stockOutCount: stockOuts.length,
      lowStockCount,
      hasDomain: Boolean(domain),
    }),
    recentAlerts: notifications.slice(0, 5).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
    marketData: {
      lastScrapedAt,
      platformsTracked: freshness.length,
    },
    // The stat tiles. Null when the seller has no category yet - the same
    // signal `domain: null` already carries, repeated here so a client
    // binding straight to this block doesn't have to look up.
    domainStats,
  });
}

/**
 * Three sellers must have opted in before any peer figure is published.
 *
 * Enforced upstream, not here: the benchmark job only writes a row once the
 * sample clears the floor, so `sellersInDomain` is null because there is no
 * row, not because this function hid one. Stated in the response anyway -
 * a client showing a dash needs to be able to explain the dash, and
 * "not published until 3 sellers opt in" is a different sentence from
 * "none", which is what the zeros beside it mean.
 */
const PEER_FLOOR = 3;

type DomainStats = {
  listingsTracked: number;
  platformsTracked: number;
  productsPriced: number;
  sellersInDomain: number | null;
  peersVisible: number;
  benchmarksTracked: number;
  peerFloor: number;
};

/**
 * The four tiles the desktop Market page shows above the fold, computed
 * from the same three sources it uses - market_scope_coverage for the
 * market side, domain_benchmarks and seller_public_profiles_view for the
 * peer side.
 *
 * Folded into /pulse rather than given an endpoint of its own because the
 * home screen renders them beside the highlights; a second request to fill
 * four numbers on a screen that has already loaded is the round trip this
 * endpoint exists to avoid.
 */
async function buildDomainStats(
  request: Request,
  sellerId: string,
  domain: SellerDomain | null,
): Promise<DomainStats | null> {
  if (!domain) return null;

  const [coverage, benchmarks, peers, productsPriced] = await Promise.all([
    getMarketScope(domain.categorySlug, sellerId).then(getMarketScopeCoverage),
    getDomainBenchmarks(domain.categoryId),
    getDomainPeers(domain.categoryId, sellerId),
    countPricedProducts(request, sellerId),
  ]);

  return {
    // Scraped listings matching the seller's full market definition - price
    // band, brands and cities included, not just category and platform. The
    // distinction mattered enough to need migration 041: the unfiltered
    // count could claim thousands while every figure on the page was
    // computed over a filtered fraction of them.
    listingsTracked: coverage.listingCount,
    platformsTracked: coverage.platformNames.length,
    productsPriced,
    // Null, never 0, below the floor. Collapsing the two would be a lie:
    // "not published yet" and "nobody is here" are different facts.
    sellersInDomain: benchmarks[0]?.sampleSize ?? null,
    peersVisible: peers.length,
    benchmarksTracked: benchmarks.length,
    peerFloor: PEER_FLOOR,
  };
}

/** Counted, not fetched - see countLowStock. */
async function countPricedProducts(request: Request, sellerId: string): Promise<number> {
  const token = getBearerToken(request);
  if (!token) return 0;

  const { count, error } = await createBearerClient(token)
    .from('seller_products')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .eq('is_active', true)
    .not('sell_price', 'is', null);

  return error ? 0 : (count ?? 0);
}

type HighlightTone = 'good' | 'warning' | 'neutral';

/**
 * The same priority order the desktop InsightStrip components use: what is
 * operational and time-sensitive first, then what is merely informative.
 * Returned as data rather than prose so the app controls presentation.
 */
function buildHighlights(input: {
  unreadCount: number;
  stockOutCount: number;
  lowStockCount: number;
  hasDomain: boolean;
}): { tone: HighlightTone; headline: string; detail: string }[] {
  const highlights: { tone: HighlightTone; headline: string; detail: string }[] = [];

  if (!input.hasDomain) {
    return [
      {
        tone: 'neutral',
        headline: 'Pick a category to start',
        detail: 'Choose what you sell and the market figures fill in from the next scrape.',
      },
    ];
  }

  if (input.unreadCount > 0) {
    highlights.push({
      tone: 'warning',
      headline: `${input.unreadCount} unread alert${input.unreadCount === 1 ? '' : 's'}`,
      detail: 'A tracked competitor moved on price or stock.',
    });
  }

  if (input.lowStockCount > 0) {
    highlights.push({
      tone: 'warning',
      headline: `${input.lowStockCount} product${input.lowStockCount === 1 ? '' : 's'} running low`,
      detail: `Under ${LOW_STOCK_THRESHOLD} units left - restock before the sale goes elsewhere.`,
    });
  }

  if (input.stockOutCount > 0) {
    highlights.push({
      tone: 'good',
      headline: `${input.stockOutCount} competitor product${input.stockOutCount === 1 ? ' is' : 's are'} out of stock`,
      detail: "That's demand nobody is filling right now.",
    });
  }

  if (highlights.length === 0) {
    highlights.push({
      tone: 'good',
      headline: 'Nothing needs you right now',
      detail: 'No unread alerts, no low stock, no competitor gaps to jump on.',
    });
  }

  return highlights;
}

/**
 * Counted rather than fetched: the home screen shows the number, never the
 * rows, and pulling the rows to call .length on them would be the same
 * waste the desktop pages were just audited for.
 */
async function countLowStock(request: Request, sellerId: string): Promise<number> {
  const token = getBearerToken(request);
  if (!token) return 0;

  const supabase = createBearerClient(token);
  const { count, error } = await supabase
    .from('seller_products')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .eq('is_active', true)
    .not('stock_qty', 'is', null)
    .lt('stock_qty', LOW_STOCK_THRESHOLD);

  return error ? 0 : (count ?? 0);
}
