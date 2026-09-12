import { LOW_STOCK_THRESHOLD } from '@/lib/market-intel/jobs/low-stock-job';
import { getDataFreshness, getStockOuts } from '@/lib/market-intel/market/market-insights';
import { getPrimaryDomain } from '@/lib/market-intel/seller/seller';
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

export async function GET(request: Request) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const domain = await getPrimaryDomain(seller.id);

  // Runs concurrently: none of these depend on each other, and serialising
  // them would make the home screen's latency their sum.
  const [notifications, stockOuts, freshness, lowStockCount] = await Promise.all([
    listNotifications(seller.id, 10),
    domain ? getStockOuts(domain.categorySlug, 5, seller.reportingCurrency) : [],
    domain ? getDataFreshness(domain.categorySlug) : [],
    countLowStock(request, seller.id),
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
  });
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
