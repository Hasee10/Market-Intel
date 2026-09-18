'server-only';

import type { FxRates } from '@/lib/market-intel/fx';
import { getRepeatStats } from '@/lib/market-intel/seller/repeat';
import { getLatestChurnSnapshot, getAtRiskCustomers } from '@/lib/market-intel/seller/rfm';
import { buildGrowthMetric } from '../metrics/growth';
import type { CustomerHealthSection } from '../schema';

// getAtRiskCustomers() already enforces its own MIN_CUSTOMERS_FOR_RFM
// threshold internally (rfm.ts) - below it, it returns [] rather than an
// unreliable score, which is what drives the "no cohort card" behavior here.
export async function collectCustomerHealth(
  sellerId: string,
  reportingCurrency: string,
  asOf: string,
  fxRates: FxRates,
  periodDays = 30,
): Promise<CustomerHealthSection | null> {
  const [churn, atRisk, repeat] = await Promise.all([
    getLatestChurnSnapshot(sellerId),
    getAtRiskCustomers(sellerId, reportingCurrency, fxRates),
    // Windowed repeat buyers over the report period (product notes
    // 2026-09-18). Fail-soft: the churn snapshot and at-risk list are the
    // section's backbone and must not disappear because this read failed.
    getRepeatStats(sellerId, reportingCurrency, periodDays).catch(() => null),
  ]);

  // Only meaningful when someone actually ordered in the window - a share
  // of zero customers is not a 0% repeat rate.
  const repeatBuyers: CustomerHealthSection['repeatBuyers'] =
    repeat && repeat.customersOrdered > 0
      ? {
          periodDays: repeat.periodDays,
          customersOrdered: repeat.customersOrdered,
          repeatCustomers: repeat.repeatCustomers,
          repeatShare: buildGrowthMetric(repeat.repeatShare, repeat.prior.customersOrdered > 0 ? repeat.prior.repeatShare : null),
          repeatRevenueShare: buildGrowthMetric(
            repeat.repeatRevenueShare,
            repeat.prior.customersOrdered > 0 ? repeat.prior.repeatRevenueShare : null,
          ),
        }
      : null;

  if (!churn && atRisk.length === 0 && !repeatBuyers) return null;

  const atRiskCohorts =
    atRisk.length > 0
      ? [
          {
            label: 'At-risk customers',
            count: atRisk.length,
            // A numeric recovery target is a claim about future behavior this
            // system has no basis to make from historical data alone - never
            // invented, stays null until a real win-back campaign baseline exists.
            recoveryTargetPct: null as number | null,
          },
        ]
      : [];

  return {
    retentionRate: churn?.retentionRate != null ? buildGrowthMetric(churn.retentionRate, null) : null,
    repeatPurchaseRate: churn?.repeatPurchaseRate ?? null,
    avgClv: churn?.avgClv != null ? { value: churn.avgClv, source: 'seller_private', asOf } : null,
    // 0 is a legitimate, reportable value here (a genuinely healthy sign) -
    // what must never happen is turning a 0 count into an actionable
    // "Win-Back Segment" card, which is why atRiskCohorts (built above) is
    // gated separately on length > 0, not on this field.
    atRiskCount: atRisk.length,
    atRiskCohorts,
    repeatBuyers,
  };
}
