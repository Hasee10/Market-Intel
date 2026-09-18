import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { getSellerCustomers } from '@/lib/market-intel/seller/customers';
import {
  getCohortRetention,
  getRepeatStats,
  type CohortRow,
  type RepeatStats,
} from '@/lib/market-intel/seller/repeat';
import {
  getAtRiskCustomers,
  getLatestChurnSnapshot,
  type AtRiskCustomer,
  type ChurnSnapshot,
} from '@/lib/market-intel/seller/rfm';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

import CustomersView from './CustomersView';

// Server Component - same move as apps/products/page.tsx. This page used to
// run TWO independent client fetches (the main list, and a second one
// nested inside <RetentionPanel />), each paying its own auth round trip;
// both are now one server-side fetch.
//
// getLatestChurnSnapshot/getAtRiskCustomers already fail soft internally
// (they return null/[] on a query error - a missing snapshot legitimately
// means "not enough order history yet", the same case as a real error, so
// that was already the correct behaviour and nothing here changes it).
// Still isolated with .catch() rather than trusted to never throw: the
// retention panel and the customer list were two structurally independent
// fetches before this change, and they should stay independent - a future
// change to rfm.ts that starts throwing must not be able to take the whole
// page down just because it now shares a Promise.all with the main list.
export default async function CustomersPage() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return <ErrorAlert title="Error loading customers" message="Not authenticated" />;
  }

  try {
    // repeatStats and cohorts join the same fail-soft group as the
    // retention snapshot: each is one panel, and one panel failing to load
    // must not take the customer list with it.
    const [customers, retentionSnapshot, atRiskCustomers, repeatStats, cohorts] = await Promise.all([
      getSellerCustomers(seller.id),
      getLatestChurnSnapshot(seller.id).catch((): ChurnSnapshot | null => null),
      getAtRiskCustomers(seller.id, seller.reportingCurrency).catch((): AtRiskCustomer[] => []),
      getRepeatStats(seller.id, seller.reportingCurrency).catch((): RepeatStats | null => null),
      getCohortRetention(seller.id).catch((): CohortRow[] => []),
    ]);

    return (
      <CustomersView
        customers={customers}
        retentionSnapshot={retentionSnapshot}
        atRiskCustomers={atRiskCustomers}
        reportingCurrency={seller.reportingCurrency}
        repeatStats={repeatStats}
        cohorts={cohorts}
      />
    );
  } catch (err) {
    return (
      <ErrorAlert
        title="Error loading customers"
        message={err instanceof Error ? err.message : 'Failed to fetch customers'}
      />
    );
  }
}
