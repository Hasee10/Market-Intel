'server-only';

import { createClient } from '@/lib/supabase/server';
import { convertCurrency, getLatestFxRates, type FxRates } from '@/lib/market-intel/fx';

export type ChurnSnapshot = {
  snapshotDate: string;
  churnRate: number | null;
  retentionRate: number | null;
  repeatPurchaseRate: number | null;
  avgClv: number | null;
  newCustomers: number;
  returningCustomers: number;
};

export async function getLatestChurnSnapshot(sellerId: string): Promise<ChurnSnapshot | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_churn_snapshots')
    .select(
      'snapshot_date, churn_rate, retention_rate, repeat_purchase_rate, avg_clv, new_customers, returning_customers',
    )
    .eq('seller_id', sellerId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    snapshotDate: data.snapshot_date,
    churnRate: data.churn_rate,
    retentionRate: data.retention_rate,
    repeatPurchaseRate: data.repeat_purchase_rate,
    avgClv: data.avg_clv,
    newCustomers: data.new_customers,
    returningCustomers: data.returning_customers,
  };
}

export type AtRiskCustomer = {
  id: string;
  label: string;
  daysSinceLastOrder: number;
  ordersCount: number;
  totalSpent: number;
  currency: string;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
};

function quintileScores(values: number[]): number[] {
  // Rank-based quintiles (1 = worst, 5 = best) - standard RFM scoring.
  // Ties share a rank; robust to skewed distributions (a handful of whale
  // customers) unlike fixed-width buckets.
  const sortedIdx = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v)
    .map((x) => x.i);

  const scores = new Array<number>(values.length);
  sortedIdx.forEach((originalIndex, rank) => {
    const percentile = values.length === 1 ? 1 : rank / (values.length - 1);
    scores[originalIndex] = Math.min(5, Math.floor(percentile * 5) + 1);
  });
  return scores;
}

const MIN_CUSTOMERS_FOR_RFM = 5;

// RFM segmentation (Recency/Frequency/Monetary quantile scoring) - the
// standard technique for "who's about to churn" at this data scale. "At
// risk" = recency score in the bottom 2 quintiles (long time since their
// last order) combined with a frequency or monetary score in the top 3
// (previously an engaged/valuable customer, not just a one-time visitor
// going quiet, which wouldn't be worth flagging).
// fxRatesOverride: report generation fetches one fx snapshot for the whole
// run and threads it through every collector (see
// docs/reports-v2-architecture.md's currency-consistency note); other
// callers omit it and get a fresh fetch.
export async function getAtRiskCustomers(
  sellerId: string,
  reportingCurrency: string,
  fxRatesOverride?: FxRates,
): Promise<AtRiskCustomer[]> {
  const supabase = await createClient();

  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('seller_customers')
      .select('id, email, external_customer_id, orders_count, total_spent, currency, last_order_at')
      .eq('seller_id', sellerId)
      .gt('orders_count', 0)
      .not('last_order_at', 'is', null),
    fxRatesOverride ? Promise.resolve(fxRatesOverride) : getLatestFxRates(),
  ]);

  if (error || !data || data.length < MIN_CUSTOMERS_FOR_RFM) return [];

  // Customers can each be in a different currency (seller_customers.currency)
  // - convert to the seller's reporting currency before ranking/scoring,
  // otherwise the monetary quintile (and the "biggest spender first" sort
  // below) would compare raw numbers across different units.
  const spendInReportingCurrency = data.map((c) =>
    convertCurrency(Number(c.total_spent), c.currency, reportingCurrency, fxRates),
  );

  const now = Date.now();
  const recencyDays = data.map((c) => (now - new Date(c.last_order_at!).getTime()) / (24 * 60 * 60 * 1000));
  // Lower recencyDays (more recent) should score higher, so invert before scoring.
  const recencyScores = quintileScores(recencyDays.map((d) => -d));
  const frequencyScores = quintileScores(data.map((c) => c.orders_count));
  const monetaryScores = quintileScores(spendInReportingCurrency);

  const results: AtRiskCustomer[] = [];
  data.forEach((customer, index) => {
    const recencyScore = recencyScores[index];
    const frequencyScore = frequencyScores[index];
    const monetaryScore = monetaryScores[index];

    if (recencyScore <= 2 && (frequencyScore >= 3 || monetaryScore >= 3)) {
      results.push({
        id: customer.id,
        label: customer.email || customer.external_customer_id || customer.id.slice(0, 8),
        daysSinceLastOrder: Math.round(recencyDays[index]),
        ordersCount: customer.orders_count,
        totalSpent: spendInReportingCurrency[index],
        currency: reportingCurrency,
        recencyScore,
        frequencyScore,
        monetaryScore,
      });
    }
  });

  return results.sort((a, b) => b.totalSpent - a.totalSpent);
}
