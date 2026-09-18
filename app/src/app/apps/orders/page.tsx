import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { getSellerOrders } from '@/lib/market-intel/seller/orders';
import { getReturnStats, type ReturnStats } from '@/lib/market-intel/seller/returns';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

import OrdersView from './OrdersView';

// Server Component - same move as apps/products/page.tsx and
// apps/customers/page.tsx: the client-side useFetch('/api/orders') waterfall
// (auth round trip + query) is now one server-side fetch before render.
//
// Return stats fail soft. The order list is what this page is for; a
// failed stats query degrades the strip to hidden rather than replacing
// the whole page with an error - same rule the Customers page applies to
// its retention panel.
export default async function OrdersPage() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return <ErrorAlert title="Error loading orders" message="Not authenticated" />;
  }

  try {
    const [orders, returnStats] = await Promise.all([
      getSellerOrders(seller.id),
      getReturnStats(seller.id, seller.reportingCurrency).catch((): ReturnStats | null => null),
    ]);
    return <OrdersView orders={orders} returnStats={returnStats} />;
  } catch (err) {
    return (
      <ErrorAlert
        title="Error loading orders"
        message={err instanceof Error ? err.message : 'Failed to fetch orders'}
      />
    );
  }
}
