import { NextRequest } from 'next/server';

import { getSellerKpiTotals } from '@/lib/market-intel/seller/overview';
import { mobileError, mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// The seller's own business KPIs - revenue, orders, average order value,
// new customers - each against the prior period of the same length.
//
// These are the seller's OWN sales, from orders they imported. Nothing here
// is market data, which matters for the empty state: a seller who has never
// imported an order gets four zeros, and that is correct rather than broken.
// The client should say "import your orders" instead of rendering them.
//
// Composes getSellerKpiTotals, which is the computation half of the desktop
// Overview tiles. The desktop's getEcommerceStats formats those same
// numbers into currency strings with icon and colour names; reusing that
// return shape here was the obvious-looking mistake and would have been a
// bad one. A phone can't re-parse "$482,300.00" back into a number, can't
// localise it, and has no use for an icon vocabulary from a component
// library it doesn't run. Same source figures, different presentation
// layer - so the two clients can never disagree on the number itself.

// 90d is offered because a phone screen shows one number at a time and a
// 30-day window on a low-volume seller is noisy. Anything longer belongs on
// a desktop chart, not a tile.
const PERIODS: Record<string, number> = { '30d': 30, '90d': 90 };
const DEFAULT_PERIOD = '30d';

type KpiFormat = 'money' | 'count';

/**
 * Signed percentage against the prior period.
 *
 * Null - not zero - when there is nothing to compare against, so a brand
 * new account renders no change indicator rather than a confident "0%"
 * that claims flat performance it has no evidence for. The client is told
 * in MOBILE_API.md to hide the indicator on null.
 */
function diffPct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return Number((((current - prior) / prior) * 100).toFixed(1));
}

function direction(diff: number | null): 'up' | 'down' | 'flat' {
  if (diff === null || diff === 0) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

function kpi(
  key: string,
  label: string,
  value: number,
  prior: number,
  format: KpiFormat,
): { key: string; label: string; value: number; format: KpiFormat; diffPct: number | null; direction: string } {
  const diff = diffPct(value, prior);
  return {
    key,
    label,
    // Rounded at the boundary rather than at render time so every client
    // shows the same figure. AOV especially arrives with a long tail.
    value: format === 'money' ? Number(value.toFixed(2)) : value,
    format,
    diffPct: diff,
    direction: direction(diff),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const requested = request.nextUrl.searchParams.get('period') ?? DEFAULT_PERIOD;
  const periodDays = PERIODS[requested];

  // Rejected rather than silently falling back to 30d: a client asking for
  // a window it won't get, and being told it did, is a bug that surfaces as
  // wrong numbers rather than as an error.
  if (!periodDays) {
    return mobileError('Unsupported period', 400, [
      `period must be one of: ${Object.keys(PERIODS).join(', ')}.`,
    ]);
  }

  let totals;
  try {
    totals = await getSellerKpiTotals(seller.id, seller.reportingCurrency, periodDays);
  } catch {
    // getSellerKpiTotals throws on a real query failure rather than
    // returning empty, deliberately - see its header. Zero orders is a 200
    // with zeros; a broken query is a 500.
    return mobileError('Could not load your KPIs', 500);
  }

  return mobileOk({
    currency: seller.reportingCurrency,
    period: requested,
    comparedTo: `prior ${periodDays} days`,
    kpis: [
      kpi('revenue', 'Revenue', totals.revenue, totals.priorRevenue, 'money'),
      kpi('orders', 'Orders', totals.orders, totals.priorOrders, 'count'),
      kpi('aov', 'Average order value', totals.aov, totals.priorAov, 'money'),
      kpi('new_customers', 'New customers', totals.newCustomers, totals.priorNewCustomers, 'count'),
    ],
  });
}
